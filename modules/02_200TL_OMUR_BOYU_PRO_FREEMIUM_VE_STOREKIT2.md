# MODÜL 2: 200 ₺ ÖMÜR BOYU PRO (LIFETIME IAP), KOTA MOTORU VE NATIVE STOREKIT 2

Bu modülde uygulamanın gelir modelini Apple App Store İnceleme Yönergelerine (özellikle **Guideline 3.1.1 - In-App Purchase** ve **Guideline 2.1 - IAP Completeness**) %100 uyumlu olacak şekilde inşa et.

## 1. Kota ve Hak Yöneticisi (`src/core/monetization/EntitlementManager.ts`)

### Ücretsiz (Free) Kota Sınırları
1. **Harita Limiti (`FREE_MAP_LIMIT = 3`):**
   - Kullanıcının çöp kutusunda olmayan aktif harita sayısı `< 3` iken yeni boş harita, şablondan harita, harita çoğaltma veya `.zihin` içe aktarma serbesttir.
   - Kullanıcı **4. haritayı** oluşturmak istediğinde işlem durdurulur ve `LifetimePaywallModal` (`triggerReason: 'map_limit'`) açılır.
   - *Adil Kullanım Kuralı:* Kullanıcının mevcut 3 haritası asla kilitlenmez; mevcut haritalarını her zaman açıp düzenleyebilir. Harita başına 45 düğüme kadar ücretsizdir, 46. düğümde Pro ekranı gösterilir.
2. **İkon ve Çıkartma Limiti (`isStickerFree(sticker, indexInSearch)`):**
   - `search-manifest.json` ve yerleşik paketlerdeki temel genel/emoji ikonlardan oluşan **~1.500 ikonluk `tier: 'free'` başlangıç havuzu** ücretsizdir.
   - Arama şeridinde ilk **6 temel sonuç** ücretsiz kullanılabilir; **7. sıradan sonraki tüm zengin alternatifler**, **25.000+ uzmanlık ikonu** (`healthicons`, `systemdesign.io` mimari paketi, hukuk/mimarlık/mühendislik özel atlasları, `Duotone` dal rengi uyumlu çıkartmalar) ve **`+150 Görsel` Sonsuz Galeri** öğeleri `tier: 'pro'` olarak işaretlenir.
   - Pro ikonların sağ üst köşesinde zarif bir `PRO` rozeti görünür; tıklandığında o ikonun önizlemesiyle birlikte `LifetimePaywallModal` (`triggerReason: 'pro_sticker'`, `previewSticker`) açılır!
3. **Üretkenlik Araçları Deneme Hakları:**
   - `📷 Nottan Kes`: Ücretsizde **3 kesim hakkı**, 4. kesimde Pro.
   - `🪄 Metinden Otomatik Harita` & `✨ AI Çiz`: Ücretsizde **1'er ücretsiz deneme**, sonrasında Pro.
   - `PDF / SVG 300 DPI Poster Çıktısı` & `Tam Sınav Modu`: Pro özelliği (ücretsizde standart PNG çıktısı açık kalır).

## 2. Ürün Tanımı ve Fiyatlandırma (`200 ₺ Ömür Boyu Erişim`)
- **Tür:** `Non-Consumable` (Tüketilmeyen — Tek Seferlik Ömür Boyu Satın Alma)
- **Product ID:** `com.tahafirat.zihinharitam.lifetime_pro` (`appReleaseConfig.ts` üzerinden okunur)
- **Türkiye Mağaza Fiyatı:** **200 ₺** (App Store Connect fiyat basamağı `₺199,99`).
- **KRİTİK APPLE ONAY KURALI:** Paywall ekranında fiyat metni **mutlaka StoreKit'ten gelen `product.displayPrice` (`localizedPriceString`)** alanından okunmalıdır! Böylece Türkiye'deki kullanıcı `₺199,99` görürken, Apple'ın Kaliforniya/İrlanda'daki inceleme uzmanı kendi mağaza para birimini (`$4.99` / `€5.99`) görür ve uygulama "sabit yanlış para birimi" nedeniyle reddedilmez. Yalnızca çevrimdışı/web ortamında `200 ₺` yedek metni gösterilir.

## 3. Gerçek Native Swift StoreKit 2 Eklentisi (`ios/App/App/Plugins/StoreKitPlugin.swift`)
Üçüncü parti hesap kurulumu beklemeden kutudan çıktığı anda App Store Connect ile çalışan Swift StoreKit 2 eklentisini eksiksiz yaz:

```swift
import Foundation
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

    private var updatesTask: Task<Void, Never>?

    override public func load() {
        updatesTask = Task.detached {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                }
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: Set(ids))
                let mapped = products.map { p in
                    return [
                        "id": p.id,
                        "title": p.displayName,
                        "description": p.description,
                        "displayPrice": p.displayPrice,
                        "price": NSDecimalNumber(decimal: p.price).doubleValue
                    ] as [String : Any]
                }
                call.resolve(["products": mapped])
            } catch {
                call.reject("StoreKit urunleri alinamadi: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchaseLifetime(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId gerekli")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Urun App Store'da bulunamadi: \(productId)")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
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
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }
}
```
- **Önemli:** Capacitor 6/7 özel yerel eklenti kaydı için `MainViewController: BridgeViewController` sınıfı oluşturup `capacitorDidLoad()` içinde `bridge?.registerPluginInstance(StoreKitPlugin())` ile kaydet ve `Main.storyboard` içindeki sınıf adını bu özel controller'a bağla!
- **iOS Guideline 3.1.1 Koruması:** `Capacitor.getPlatform() === 'ios'` iken **ASLA** Stripe, Iyzico veya dış web ödeme linki gösterme; yalnızca Apple StoreKit 2 üzerinden ödeme al! Web/Masaüstü ortamında ise test amaçlı geliştirici Sandbox satın alma akışını çalıştır.
