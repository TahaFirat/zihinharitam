import Foundation
import Security
import UIKit
import Capacitor
import StoreKit

@available(iOS 15.0, *)
@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKitBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchaseLifetime", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentOfferCodeRedeemSheet", returnType: CAPPluginReturnPromise)
    ]

    private let monthlyProductId = "com.tahafirat.zihinharitam.pro_monthly"
    private let yearlyProductId = "com.tahafirat.zihinharitam.pro_yearly"
    private let lifetimeProductId = "com.tahafirat.zihinharitam.lifetime_pro"
    private var allProProductIds: Set<String> {
        return [monthlyProductId, yearlyProductId, lifetimeProductId]
    }

    private let keychainService = "com.tahafirat.zihinharitam.entitlements"
    private let keychainAccount = "pro_lifetime_unlock"
    private var updatesTask: Task<Void, Never>?
    private var cachedProducts: [String: Product] = [:]
    private var purchaseInFlight = false

    override public func load() {
        updatesTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    if let self = self, self.allProProductIds.contains(transaction.productID) {
                        let notRevoked = (transaction.revocationDate == nil)
                        let notExpired = (transaction.expirationDate == nil || transaction.expirationDate! > Date())
                        self.saveKeychainEntitlement(notRevoked && notExpired)
                    }
                    await transaction.finish()
                }
            }
        }
        // Best-effort prefetch of Monthly, Yearly & Lifetime Pro product metadata on launch
        Task.detached { [weak self] in
            guard let self = self else { return }
            _ = try? await self.fetchProductsWithRetry(ids: Array(self.allProProductIds), allowSyncRetry: false)
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    private func fetchProductsWithRetry(ids: [String], allowSyncRetry: Bool = true) async throws -> [Product] {
        let requested = Set(ids)
        var foundById: [String: Product] = [:]

        let initial = (try? await Product.products(for: requested)) ?? []
        for p in initial {
            cachedProducts[p.id] = p
            foundById[p.id] = p
        }

        // If any requested product ID didn't return in the batch (e.g. cold StoreKit cache), retry missing IDs individually!
        var missing = requested.subtracting(foundById.keys)
        if !missing.isEmpty && allowSyncRetry {
            try? await Task.sleep(nanoseconds: 250_000_000)
            for mid in missing {
                if let single = try? await Product.products(for: [mid]).first {
                    cachedProducts[single.id] = single
                    foundById[single.id] = single
                }
            }
            missing = requested.subtracting(foundById.keys)
            if !missing.isEmpty {
                try? await AppStore.sync()
                try? await Task.sleep(nanoseconds: 350_000_000)
                let retried = (try? await Product.products(for: missing)) ?? []
                for p in retried {
                    cachedProducts[p.id] = p
                    foundById[p.id] = p
                }
            }
        }
        return ids.compactMap { foundById[$0] }
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? Array(allProProductIds)
        Task {
            do {
                let products = try await fetchProductsWithRetry(ids: ids)
                let mapped = products.map { p in
                    return [
                        "id": p.id,
                        "title": p.displayName,
                        "description": p.description,
                        "displayPrice": p.displayPrice,
                        "price": NSDecimalNumber(decimal: p.price).doubleValue
                    ] as [String: Any]
                }
                call.resolve(["products": mapped])
            } catch {
                call.reject("StoreKit urunleri alinamadi: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchaseLifetime(_ call: CAPPluginCall) {
        // Strict SKU Lock: NEVER fall back silently to a different plan (prevents wrong-tier charges!)
        guard let rawId = call.getString("productId")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rawId.isEmpty,
              allProProductIds.contains(rawId) else {
            call.reject("Gecersiz plan secimi. Lutfen satin almak istediginiz paketi tekrar secin.")
            return
        }
        let productId = rawId

        if purchaseInFlight {
            call.reject("Devam eden bir satin alma islemi var. Lutfen mevcut pencerenin tamamlanmasini bekleyin.")
            return
        }
        purchaseInFlight = true

        Task {
            defer { self.purchaseInFlight = false }
            do {
                var product = cachedProducts[productId]
                if product == nil || product?.id != productId {
                    let products = try await fetchProductsWithRetry(ids: [productId])
                    product = products.first(where: { $0.id == productId })
                }
                guard let product = product, product.id == productId else {
                    call.reject("Secilen plan (\(productId)) su anda App Store sunucularindan alinamadi. Lutfen birazdan tekrar deneyin.")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        guard allProProductIds.contains(transaction.productID) else {
                            call.reject("Beklenmeyen urun kimligi dogrulandi.")
                            return
                        }
                        saveKeychainEntitlement(true)
                        await transaction.finish()
                        call.resolve([
                            "purchased": true,
                            "productId": transaction.productID,
                            "transactionId": String(transaction.id)
                        ])
                    case .unverified(_, let error):
                        call.reject("Dogrulanamayan islem: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.resolve(["purchased": false, "cancelled": true])
                case .pending:
                    call.resolve(["purchased": false, "pending": true])
                @unknown default:
                    call.resolve(["purchased": false])
                }
            } catch {
                call.reject("Satin alma hatasi: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let unlocked = await hasVerifiedEntitlement()
                saveKeychainEntitlement(unlocked)
                call.resolve(["restored": unlocked, "isLifetimePro": unlocked])
            } catch {
                call.reject("Geri yukleme basarisiz: \(error.localizedDescription)")
            }
        }
    }

    @objc func checkEntitlements(_ call: CAPPluginCall) {
        Task {
            let unlocked = await hasVerifiedEntitlement()
            call.resolve(["isLifetimePro": unlocked])
        }
    }

    @objc func presentOfferCodeRedeemSheet(_ call: CAPPluginCall) {
        if #available(iOS 16.0, *) {
            Task { @MainActor in
                guard let scene = self.bridge?.viewController?.view.window?.windowScene
                        ?? UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else {
                    call.reject("Teklif kodu penceresi acilamadi.")
                    return
                }
                do {
                    try await AppStore.presentOfferCodeRedeemSheet(in: scene)
                    try? await AppStore.sync()
                    let unlocked = await self.hasVerifiedEntitlement()
                    self.saveKeychainEntitlement(unlocked)
                    call.resolve(["presented": true, "isLifetimePro": unlocked])
                } catch {
                    call.reject("Teklif kodu ekrani kapatildi veya hata olustu: \(error.localizedDescription)")
                }
            }
        } else {
            call.reject("Hediye/teklif kodu kullanimi iOS 16 ve uzeri gerektirir.")
        }
    }

    private func hasVerifiedEntitlement() async -> Bool {
        var sawRevokedOrExpired = false
        let now = Date()
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                if allProProductIds.contains(transaction.productID) {
                    let active = (transaction.revocationDate == nil) &&
                        (transaction.expirationDate == nil || transaction.expirationDate! > now)
                    if active {
                        saveKeychainEntitlement(true)
                        return true
                    } else {
                        sawRevokedOrExpired = true
                    }
                }
            }
        }
        if sawRevokedOrExpired {
            saveKeychainEntitlement(false)
            return false
        }
        return readKeychainEntitlement()
    }

    private func saveKeychainEntitlement(_ unlocked: Bool) {
        UserDefaults.standard.set(unlocked, forKey: keychainAccount)
        let data = Data((unlocked ? "1" : "0").utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    private func readKeychainEntitlement() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess,
           let data = item as? Data,
           let str = String(data: data, encoding: .utf8) {
            return str == "1"
        }
        return UserDefaults.standard.bool(forKey: keychainAccount)
    }
}
