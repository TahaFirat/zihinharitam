import Foundation
import Security
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
        CAPPluginMethod(name: "checkEntitlements", returnType: CAPPluginReturnPromise)
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
        let initial = try await Product.products(for: Set(ids))
        for p in initial {
            cachedProducts[p.id] = p
        }
        if !initial.isEmpty || !allowSyncRetry {
            return initial
        }

        // Sandbox/TestFlight sessions occasionally return empty before AppStore sync warms up
        try? await AppStore.sync()
        try? await Task.sleep(nanoseconds: 350_000_000)

        let retried = try await Product.products(for: Set(ids))
        for p in retried {
            cachedProducts[p.id] = p
        }
        return retried
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
        let productId = call.getString("productId") ?? yearlyProductId
        Task {
            do {
                var product = cachedProducts[productId]
                if product == nil {
                    let products = try await fetchProductsWithRetry(ids: [productId])
                    product = products.first
                }
                guard let product = product else {
                    call.reject("App Store urunu (\(productId)) su anda Apple sunucularindan alinamadi. TestFlight/inceleme asamasinda App Store Connect -> Isletme (Ucretli Uygulamalar Sozlesmesi / Vergi ve Banka onayi) tamamlanip aktif olana kadar satin alma test urunu donmeyebilir.")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
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
