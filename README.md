# Görsel Zihin Haritası — V4 GERÇEK ÜRÜN, 200 ₺ ÖMÜR BOYU PRO & APP STORE OTOMASYON PAKETİ

Bu paket; mevcut Görsel Zihin Haritası projesini bir "prototip/tuval demosundan" çıkarıp **%100 gerçek, ticari kalitede, 200 ₺ Tek Seferlik Ömür Boyu Erişim (Lifetime Pro) gelir modeline sahip, her türlü bellek/performans/tasarım uç durumu çözülmüş ve Apple App Store'a otomatik derlenip yüklenmeye hazır** eksiksiz bir uygulamaya dönüştürmek için hazırlanmıştır.

---

## Paket İçeriği

1. **`00_MASTER_PRODUCTION_200TL_AND_APPSTORE_V4.md` (Tek Seferde Uçtan Uca Kurulum - Önerilen)**
   - Kodlama ajanına (Antigravity, Cursor, Claude Code, Codex vb.) doğrudan tek seferde verebileceğiniz ana üretim talimatıdır. Aşağıdaki 6 modülün tamamını koordine eder ve otomatik doğrulama kapısından (`npm run verify:appstore`) geçirir.

2. **`modules/01_GERCEK_UYGULAMA_KABUGU_HARITALARIM_VE_UX.md`**
   - Uygulamayı tek ekranlı tuvalden tam kapsamlı bir native uygulamaya taşır: **"Haritalarım" Ana Ekranı** (canlı küçük resimler, klasörler/etiketler, arama, 30 günlük çöp kutusu, `.zihin` yedek dışa/içe aktarma), **30 Saniyelik Etkileşimli Mikro-Onboarding**, **Ayarlar & Hesap/Pro Yönetimi**, Dynamic Island / Safe Area ve iPad Split-View tam uyumu.

3. **`modules/02_200TL_OMUR_BOYU_PRO_FREEMIUM_VE_STOREKIT2.md`**
   - **Freemium Sınırları:** İlk **3 Harita** ve **~1.500 Temel İkon** ücretsiz; **4. haritadan itibaren** ve **25.000+ Akademik/Uzmanlık İkonu, AI Çizim, Sınırsız Nottan Kes, Metinden Harita ve 300 DPI PDF/SVG Çıktı** özelliklerinde **200 ₺ Ömür Boyu Erişim (`pro_lifetime_unlock`)** kilidi.
   - **Gerçek Native StoreKit 2 Swift Eklentisi (`StoreKitPlugin.swift`):** Üçüncü parti sunucu şartı olmadan doğrudan Apple StoreKit 2 ile tek tıkla satın alma, JWS kriptografik işlem doğrulama, çevrimdışı Keychain hak önbelleği, zorunlu **"Satın Alımları Geri Yükle"** ve minimalist yüksek dönüşümlü Paywall ekranı.

4. **`modules/03_EKSTREM_OPTIMIZASYON_BELLEK_VE_TASARIM_KORUMALARI.md`**
   - iOS `WKWebView` 256MB Canvas çökme koruması (eski iPad ve iPhone 12 dahil 3GB/4GB RAM cihazlarda sıfır beyaz ekran çökmesi), parçalı (tiled) 300 DPI PDF render, LRU `ImageBitmap` bellek yöneticisi, 1.000+ düğümde DOM sanallaştırma (virtualization), Apple Pencil `getCoalescedEvents` hassasiyeti, sanal klavye açılışında sıfır ekran zıplaması ve atomik `IndexedDB` çökme kurtarma sistemi.

5. **`modules/04_IOS_CAPACITOR_XCODE_IKON_SPLASH_VE_PRIVACY.md`**
   - `npx cap add ios` yapılandırması, Apple'ın zorunlu tuttuğu **`PrivacyInfo.xcprivacy` (Privacy Manifest)**, Türkçe/İngilizce kamera ve galeri izin metinleri (`InfoPlist.strings`), **alfasız (RGB) 1024x1024 App Store İkonu + Tüm Boyutlar & Launch Screen otomatik üretim betiği** ve yayına hazır `public/privacy.html` + `public/terms.html` yasal sayfaları.

6. **`modules/05_OTOMATIK_BUILD_IPA_IMZALAMA_VE_APPSTORE_YUKLEME.md`**
   - **Windows Bilgisayardan Bile App Store'a Doğrudan Yükleme:** `.github/workflows/ios-appstore-release.yml` (GitHub Actions `macos-15` bulut derleyicisi ile `.ipa` derleme, imzalama ve `xcrun altool` / `Fastlane` üzerinden doğrudan App Store Connect / TestFlight'a gönderim) + macOS için tek komutluk `npm run ios:ship` betiği + Apple'ın zorunlu tuttuğu 6.9" iPhone, 6.5" iPhone ve 13" iPad Pro çözünürlüklerinde **otomatik mağaza ekran görüntüsü üreten Playwright betiği**.

7. **`modules/06_APP_STORE_CONNECT_METINLERI_VE_ONAY_REHBERI.md`**
   - App Store Connect'e kopyala-yapıştır hazır Başlık, Alt Başlık, Anahtar Kelimeler (ASO), Açıklama, `200 ₺` Uygulama İçi Satın Alma tanımlama adımları, Apple İnceleme Ekibi (App Review) notları ve ret (Guideline 2.1, 3.1.1, 4.2, 5.1.1) önleme kontrol listesi.

---

## Hızlı Kullanım

1. Bu ZIP arşivini proje klasörünüze çıkarın (ör. `prompts-v4/` içine).
2. Kodlama ajanınıza şu komutu verin:
   > "`prompts-v4/00_MASTER_PRODUCTION_200TL_AND_APPSTORE_V4.md` ve `prompts-v4/modules/` altındaki 6 modülün tamamını eksiksiz oku ve projeyi uçtan uca gerçek ticari ürün + App Store yayınına hazır hale getir. Tüm ikon, ekran görüntüsü, iOS StoreKit 2, CI/CD yükleme betiklerini üret ve `npm run verify:appstore` ile canlı testleri sıfır hatayla tamamla."
