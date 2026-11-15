# MODÜL 6: APP STORE CONNECT METİNLERİ, 200 ₺ IAP KURULUMU VE İLK SEFERDE ONAY REHBERİ

Proje kökünde `appstore-submission/APP_STORE_CONNECT_REHBERI.md` dosyasını oluştur ve aşağıdaki tüm bilgileri kopyala-yapıştır hazır şekilde sun:

## 1. App Store Connect Mağaza Bilgileri (Türkçe - Birincil & İngilizce - İkincil)
- **Uygulama Adı (TR):** `ZihinHaritam: Görsel Not & İkon` *(30 karakter sınırı içinde)*
- **Alt Başlık (TR):** `Renkli Zihin Haritası & Sınav` *(30 karakter sınırı içinde)*
- **Anahtar Kelimeler (TR - 100 Karakter ASO):** `zihin haritası,mind map,ders notu,sınav,tus,yks,hmgs,diyagram,şema,çıkartma,not alma,özet,mimarlık`
- **Uygulama Adı (EN):** `MindSticker: Visual Mind Maps`
- **Alt Başlık (EN):** `Study Notes, Diagrams & Icons`
- **Anahtar Kelimeler (EN - 100 Karakter ASO):** `mind map,visual notes,study,flashcards,system design,diagram,sticker,medical,law,brainstorm,offline`
- **Kategori:** Birincil: `Education (Eğitim)` | İkincil: `Productivity (Üretkenlik)`
- **Yaş Sınırı:** `4+`

## 2. "200 ₺ Ömür Boyu Erişim" Uygulama İçi Satın Alma (IAP) Kurulum Adımları
App Store Connect -> **Monetization -> In-App Purchases -> (+)** menüsünde:
1. **Type:** `Non-Consumable` (Tüketilmeyen — Ömür Boyu Kilit Açma)
2. **Reference Name:** `Lifetime Pro Unlock (Omur Boyu Erisim)`
3. **Product ID:** `com.tahafirat.zihinharitam.lifetime_pro`
4. **Price Schedule:** Başlangıç Ülkesi Türkiye (`TRY`) -> **`₺199,99` (200 TL)** basamağını seç (diğer tüm ülkeleri Apple otomatik kur eşitlemesiyle doldurur).
5. **App Store Localization (TR):**
   - *Display Name:* `Ömür Boyu Pro Erişim`
   - *Description:* `Sınırsız zihin haritası, 25.000+ akademik çıkartma, nottan şema kesme ve 300 DPI PDF çıktısını tek ödemeyle ömür boyu açar.`
6. **App Store Localization (EN):**
   - *Display Name:* `Lifetime Pro Access`
   - *Description:* `Unlock unlimited visual mind maps, 25,000+ academic stickers, note cropping, and 300 DPI PDF export forever with one payment.`
7. **Review Screenshot:** `appstore-submission/screenshots/iphone-6.9/05-paywall-pro.png` görselini yükle.
8. **ÖNEMLİ:** İlk sürümü göndermeden önce *App Version* sayfasındaki **"In-App Purchases and Subscriptions"** bölümünden bu ürünü (`+` ile) sürüme mutlaka bağla! (Bağlanmazsa ilk incelemede `Product.products(for:)` boş döner!).

## 3. Windows veya Mac Üzerinden 5 Dakikada Yükleme Adımları
Rehberin içine adım adım:
- App Store Connect -> *Users and Access -> Integrations -> App Store Connect API* altından `.p8` anahtarı alma,
- GitHub Repository -> *Settings -> Secrets and variables -> Actions* içine eklenecek 4 gizli değişkenin net tablosu,
- `Actions -> iOS App Store Release -> Run workflow` butonuna basarak `.ipa` dosyasının doğrudan TestFlight / App Store Connect'e düşürülmesi anlatılmalıdır.

## 4. Apple İnceleme Ekibi Notu (App Review Information -> Notes)
Apple inceleme uzmanının uygulamayı hiç takılmadan onaylaması için kopyala-yapıştır hazır İngilizce inceleme notu:
> "Thank you for reviewing ZihinHaritam (MindSticker)!
> 1. No account or login is required — the app works 100% offline right out of the box with 5 built-in academic templates and local icon search.
> 2. Free Tier includes up to 3 active mind maps and ~1,500 starter icons.
> 3. Lifetime Pro (`com.tahafirat.zihinharitam.lifetime_pro`, Non-Consumable one-time purchase) can be tested by creating a 4th map from the Home Workspace, tapping any 'PRO' badged academic sticker in the visual bar, or tapping the 'Pro' pill in the top header.
> 4. 'Restore Purchases' (`AppStore.sync()`) is prominently available both on the Paywall sheet and inside Settings."

## 5. Otomatik Ön-Kontrol Betiği (`scripts/verify-appstore-readiness.mjs`)
`npm run verify:appstore` komutu çalıştırıldığında ikon alfa kanalını, `PrivacyInfo.xcprivacy` varlığını, `StoreKitPlugin.swift` kaydını, 3 harita freemium kilidini, 25.000+ offline ikon alaka testini ve TypeScript/Vite üretim derlemesini tek seferde denetleyip yeşil onay raporu basmalıdır.
