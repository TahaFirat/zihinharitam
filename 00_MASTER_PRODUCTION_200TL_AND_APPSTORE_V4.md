# GÖRSEL ZİHİN HARİTASI — V4 TAM TİCARİ UYGULAMA, 200 ₺ ÖMÜR BOYU PRO VE APP STORE OTOMATİK YAYIN MASTER PROMPTU

> **Rol ve Görev:** Sen Kıdemli bir iOS/Cross-Platform Ürün Mimarı, Grafik/Canvas Performans Mühendisi, Mobil Gelir (StoreKit 2 / IAP) Uzmanı ve App Store Release DevOps Mühendisisin.
>
> Mevcut projeyi tek ekranlı bir web demosundan çıkarıp; **Telefon (iPhone / Android), Tablet (iPad + Apple Pencil) ve Bilgisayar** üzerinde kusursuz çalışan, **belirli harita ve ikon sınırından sonra "200 ₺ Tek Seferlik Ömür Boyu Erişim" (Lifetime Pro) modeliyle gelir üreten**, her türlü bellek/performans/tasarım problemi önceden çözülmüş ve **Apple App Store Connect'e derlenip yüklenmeye %100 hazır gerçek bir ticari uygulamaya** dönüştüreceksin.

---

## 1. KESİN MÜHENDİSLİK İLKELERİ (SIFIR EKSİK / SIFIR SAHTE KOD)
1. **Gerçek Uygulama Zorunluluğu:** Sahte "Satın Alındı" alert'leri, kırık linkler, `TODO` yorumları, uydurma gizlilik linkleri veya yarım bırakılmış Xcode/CI dosyaları **KESİNLİKLE YASAKTIR**.
2. **Minimalist & Temiz Arayüz Disiplini:** Uygulama kabuğu (Ana Ekran, Üst Bar, Paywall, Ayarlar) aşırı sade, ferah, göz yormayan tipografi ve dingin renklerle (`#FAF9F5` sıcak kağıt / `#0F141D` koyu arduvaz) tasarlanacaktır; neon/karmaşık buton yığınları yasaktır. Renk cümbüşü yalnızca kullanıcının zihin haritası dallarında ve çıkartmalarında parlamalıdır.
3. **Merkezi Konfigürasyon (`src/config/appReleaseConfig.ts`):** Uygulama adı (varsayılan: **ZihinHaritam** — alt başlık: *Görsel Zihin Haritası & Not*), Bundle ID (`com.tahafirat.zihinharitam`), IAP Ürün Kodu (`com.tahafirat.zihinharitam.lifetime_pro`), varsayılan Türkiye fiyatı (`200 ₺` / App Store `₺199,99`), gizlilik/kullanım şartları URL'leri ve destek e-postası tek bir merkezi dosyadan yönetilecektir.

---

## 2. TAM UYGULAMA KABUĞU VE "HARİTALARIM" ÇALIŞMA ALANI (`modules/01` Detaylarıyla)

Uygulama açıldığında doğrudan sahipsiz bir tuvale düşmek yerine gerçek bir üretkenlik uygulaması akışı sunmalıdır:

1. **"Haritalarım" Ana Ekranı (`src/components/HomeWorkspace.tsx`):**
   - **Üst Başlık:** Minimalist uygulama logosu, arama çubuğu (`Harita veya düğüm ara...`), Pro rozeti / `"Pro'ya Geç • 200 ₺"` zarif hapı ve `⚙️ Ayarlar` ikonu.
   - **Hızlı Başlangıç Şeridi:** `[+ Boş Görsel Harita]`, `[🪄 Metinden Harita Kur]` ve yatay kaydırılabilir **Hazır Akademik Şablonlar** (*Sistem Mimarisi, Kardiyoloji/Tıp, Elektronik, Hukuk, Mimarlık*).
   - **Klasör ve Filtre Sekmeleri:** `Tümü`, `📌 Sabitlenenler`, `📚 Ders & Sınav`, `💻 Mühendislik`, `🗑️ Çöp Kutusu (30 Gün)`.
   - **Canlı Önizlemeli Harita Kartları:** Her harita kaydedildiğinde tuvalden otomatik üretilen hafif `WebP` küçük resmi (`thumbnailDataUrl`), düğüm sayısı, son düzenleme zamanı ve üç nokta menüsü (*Yeniden Adlandır, Çoğalt, Sabitle, `.zihin` Yedek İndir, Çöpe Taşı*).
   - **Harita Sayacı Göstergesi (Ücretsiz Kullanıcılar İçin):** Alt köşede veya üst şeritte sade ve şık bir ilerleme göstergesi: `Ücretsiz Harita: 2 / 3 Kullanıldı` (kullanıcıyı şaşırtmaz, şeffaf bilgi verir).
2. **30 Saniyelik Etkileşimli İlk Açılış Tanıtımı (`OnboardingOverlay.tsx`):**
   - Yalnızca ilk açılışta görünen, tek dokunuşla geçilebilir (`Atla`), az metinli, görsel animasyonlu 3 kart:
     1. *Dalı Parmağınla Çek & Yaz*
     2. *Yazarken Binlerce Renkli Çıkartmayı Tek Tıkla Seç*
     3. *Sınav Moduyla Gizle, Hatırla ve Poster Olarak Paylaş*
3. **Ayarlar, Yedekleme & Yasal Merkez (`SettingsModal.tsx`):**
   - Tema seçimi (`Açık Defter / Koyu Çalışma / Sistem`), Varsayılan Düğüm Stili (`Organik Çıkartma / Modern Kart`), Haptik Titreşim Aç/Kapat.
   - **Pro Durumu & Satın Alımları Geri Yükle (`Restore Purchases` — Apple Zorunlu!).**
   - **Tüm Verileri Yedekle (`.zihin` ZIP/JSON paketi dışa/içe aktar)** — cihaz değiştirirken veri kaybını %100 önler.
   - Uygulama içi açılabilir **Gizlilik Politikası**, **Kullanım Koşulları (EULA)** ve **İletişim / Destek** bağlantıları.

---

## 3. FREEMIUM KOTALARI VE "200 ₺ ÖMÜR BOYU ERİŞİM" SİSTEMİ (`modules/02` Detaylarıyla)

### 3.1. Net Ücretsiz vs. Ömür Boyu Pro (`200 ₺`) Kural Matrisi
Merkezi bir `EntitlementManager.ts` servisi üzerinden tüm kapıları yönet:

| Özellik | Ücretsiz Sürüm (Free) | Ömür Boyu Pro (`200 ₺` Tek Seferlik) |
| :--- | :--- | :--- |
| **Aktif Zihin Haritası Sayısı** | **En fazla 3 aktif harita** (4. harita oluşturma / çoğaltma / içe aktarmada Pro ekranı açılır) | **Sınırsız harita ve klasör** |
| **Harita Başına Düğüm** | Harita başı **45 düğüme kadar** ücretsiz (mevcut haritayı bozmaz, 46. düğümde nazikçe Pro'ya davet eder) | **Sınırsız düğüm ve alt dal** |
| **İkon & Çıkartma Kütüphanesi** | **~1.500 Temel Başlangıç İkonu** + her aramadaki **ilk 6 standart ikon** açık | **25.000+ Tüm Akademik, Tıbbi, Hukuk, Mimarlık, `systemdesign.io` Paketi + Duotone Renk Uyumu + Sonsuz Galeri** |
| **Ders Notundan Kes (`📷`)** | İlk **3 kesim** ücretsiz deneme | **Sınırsız şema/fotoğraf kesimi** |
| **Metinden Harita (`🪄`) & `✨ AI Çiz`** | **1 ücretsiz deneme** hakkı | **Sınırsız otomatik harita & AI çıkartma** |
| **Dışa Aktarma & Sınav Modu** | Standart PNG çıktısı (köşede minik zarif uygulama imzası) + Temel Önizleme | **300 DPI Filigransız A4/A3 PDF, Vektörel SVG, Şeffaf PNG + Tam Sınav Modu** |

- **KRİTİK GÜVENLİK & KULLANICI DOSTU KURAL:** Kullanıcının mevcut haritaları **ASLA kilitlenmez veya silinmez**. Ayrıca ücretsiz harita sayacının çöp kutusuna atıp geri alarak delinmemesi için toplam aktif harita sayısı (`activeMapsCount >= 3`) kontrol edilir.
- **Pro İkon Gösterimi:** Klavye üstü şeritte ve `+150 Görsel` çekmecesinde Pro ikonlar çirkin bulanık kutularla gizlenmez; net görünür ve sağ üst köşelerinde minik altın/kehribar bir **`PRO`** rozeti taşır. Kullanıcı dokunduğunda o çıkartmanın dalın üzerinde nasıl duracağını canlı önizlemeyle gösteren zarif Paywall açılır!

### 3.2. Minimalist, Yüksek Dönüşümlü "Ömür Boyu Pro — 200 ₺" Paywall (`LifetimePaywallModal.tsx`)
- **Tasarım:** Göz yormayan tek ekranlık modern kart; üstte kilit açma tetikleyicisine göre dinamik başlık (ör. *"4. Haritanı Oluşturmak İçin Ömür Boyu Pro'ya Geç"* veya *"25.000+ Akademik Çıkartmanın Kilidini Aç"*).
- **Net Değer Vaadi (4 Kısa Madde):**
  - ♾️ **Sınırsız Görsel Zihin Haritası & Klasör**
  - 🎨 **25.000+ Tıp, Mühendislik, Hukuk, Mimarlık & Sistem Tasarımı Çıkartması (%100 Çevrimdışı)**
  - 📸 **Sınırsız Ders Notundan Şema Kesme, Sınav Modu & 300 DPI PDF Poster Çıktısı**
  - 🔒 **Abonelik Yok! Aylık Ücret Yok! Tek Sefer Öde, Ömür Boyu Kullan.**
- **Fiyat Gösterimi (Apple App Review 3.1.1 Kuralı!):**
  - StoreKit 2'den dönen `product.localizedPriceString` değerini birincil olarak göster (Türkiye'de mağazada **`₺199,99` / `200 ₺`**, Apple'ın ABD test cihazında ise otomatik `$4.99` görünür — bu sayede Apple incelemesinden tek seferde geçer!). Çevrimdışı/Web önizlemesinde `200 ₺ • Tek Seferlik` gösterilir.
- **Zorunlu Alt Bağlantılar:** Ana **`Ömür Boyu Erişimi Aç — 200 ₺`** butonunun hemen altında **`Satın Alımları Geri Yükle`**, **`Kullanım Koşulları`** ve **`Gizlilik Politikası`** linkleri net şekilde yer alır.

### 3.3. Gerçek Native Swift StoreKit 2 Köprüsü (`ios/App/App/Plugins/StoreKitPlugin.swift`)
- Herhangi bir üçüncü parti abonelik paneline mecbur kalmadan doğrudan Apple **StoreKit 2** (`import StoreKit`) ile çalışan yerleşik bir Capacitor Swift eklentisi yaz ve `BridgeViewController` içine kaydet:
  - `getProducts({ productIds })`: `Product.products(for:)` ile canlı fiyat ve para birimini getirir.
  - `purchaseLifetime({ productId })`: `product.purchase()` çağrısını başlatır, `VerificationResult<Transaction>.verified(let transaction)` kriptografik JWS imzasını doğrular, `await transaction.finish()` çağırır ve sonucu JS katmanına döner.
  - `restorePurchases()`: `try await AppStore.sync()` çalıştırıp `Transaction.currentEntitlements` üzerinden `pro_lifetime_unlock` hakkını geri yükler (kullanıcı telefon sıfırlasa veya iPad'ine geçse bile 0 ücretle Pro hakkı anında açılır!).
  - `checkEntitlements()`: Uygulama her açıldığında ve `Transaction.updates` dinleyicisinde arka planda çalışır; doğrulanmış Pro hakkını çevrimdışı kullanım için iOS `Keychain` / şifreli yerel depoya yazar.
- Aynı arayüzü (`BillingService.ts`) opsiyonel RevenueCat (`VITE_REVENUECAT_IOS_KEY` tanımlıysa) ve Web/Geliştirici Sandbox Simülatörü ile uyumlu bir adaptör olarak kur.

---

## 4. ÖNGÖRÜLEN TÜM OPTİMİZASYON, BELLEK VE TASARIM PROBLEMLERİ (`modules/03` Detaylarıyla)

Gerçek cihazlarda (özellikle 3GB/4GB RAM'li iPad 7./8./9. nesil, iPhone 11/12/SE ve orta segment Android tabletlerde) yaşanabilecek **tüm teknik ve görsel sorunları** peşinen çöz:

1. **iOS WKWebView 256MB Canvas Bellek Çökmesi Koruması (`CanvasMemoryGuard.ts`):**
   - Ana tuval DPR değerini mobil/tablette `Math.min(window.devicePixelRatio || 1, 2)` ile sınırla ve maksimum piksel alanını `16.777.216 px²` (`4096x4096`) altında tut.
   - 300 DPI A3/A4 PDF dışa aktarımında tek parça dev Canvas açıp iOS WebView'ı çökertmek yerine **Parçalı Dilim Render (Tiled Offscreen Rendering, `2048x2048` karolar)** kullan!
   - **LRU Görsel Doku Önbelleği:** Bellekte en fazla `180` aktif çıkartma URL/ImageBitmap tut; görüş alanından çıkan eski Blob URL'leri `URL.revokeObjectURL()` ile temizle.
2. **1.000+ Düğümde DOM Sanallaştırma (Viewport Node Virtualization):**
   - `HitTestSpatialIndex` (`rbush`) sorgusuyla sadece o anki ekran dikdörtgeni (`+220px` tampon bölge) içindeki düğümleri DOM'da render et! Ekran dışındaki 900 düğüm DOM'da sıfır maliyet yaratır; böylece dev bir TUS/Hukuk/Sistem Mimarisi haritası bile iPhone 12'de sabit 60 FPS, iPad Pro'da 120 FPS akar!
3. **Sürükleme & Yakınlaştırma Sırasında GPU Gölge Optimizasyonu:**
   - CSS `filter: drop-shadow(...)` mobil GPU'da pan/zoom sırasında kare düşüşü (frame drop) yapar. Çıkartma gölgelerini ya SVG içine önceden fırınla ya da `data-interacting="true"` anında hafif GPU katmanına geçirerek sıfır takılma sağla.
4. **Sanal Klavye Açılışında "Üst Barın Uçması" Sorunu (iOS WKWebView Keyboard Scroll Fix):**
   - `html, body, #root { position: fixed; inset: 0; overflow: hidden; width: 100%; height: 100%; overscroll-behavior: none; }` kilidi ve `visualViewport` dinleyicisi ile iOS klavyesi açıldığında sayfanın yukarı kaymasını %100 engelle; yalnızca aktif düzenlenen düğümü klavyenin üstündeki görünür alanın tam ortasına yumuşakça kaydır (`panToKeepNodeAboveKeyboard`).
5. **Uzun Türkçe Kelime Taşması ve Dinamik Dal Bağlantı Noktası (`ResizeObserver`):**
   - Uzun Türkçe terimlerde (*"Elektrokardiyografik"*, *"Kuvvetler Ayrılığı İlkesi"*) düğüm kartı genişlediğinde `ResizeObserver` gerçek genişlik/yüksekliği ölçüp Bezier dalının giriş noktasını milimetrik güncellesin; yazı veya dal asla üst üste binmesin!
6. **Atomik Çevrimdışı Kayıt, Otomatik Yedek Noktası ve Şema Göçü (`LocalStore.ts` V4):**
   - Her harita için son 5 otomatik geri dönüş noktasını (`recoverySnapshots`) tut; elektrik/şarj kesilse bile bozuk JSON oluşmasın.
   - V1/V2/V3 veritabanından V4'e sıfır veri kaybıyla geçiş (`Dexie.version(4).upgrade(...)`) uygula.

---

## 5. TAM iOS / XCODE PROJESİ, İKONLAR, GİZLİLİK MANİFESTOSU VE OTOMATİK APP STORE YÜKLEME (`modules/04` & `05` Detaylarıyla)

Projede App Store yayını için eksik **tek bir dosya bile** bırakma:

1. **Otomatik iOS Uygulama İkonu ve Açılış Ekranı Üreticisi (`scripts/generate-app-icons-and-splash.mjs`):**
   - Yüksek estetikli, temiz, merkezi görsel zihin haritası amblemli uygulama ikonunu vektörel olarak çizip **1024x1024 px 24-bit RGB (KESİNLİKLE ALFA/ŞEFFAFLIK KANALI OLMAYAN — Apple şeffaf kanallı ikonu reddeder!)** dahil tüm iPhone & iPad `AppIcon.appiconset` boyutlarını (`Contents.json` ile birlikte) ve `Splash.imageset` görsellerini otomatik üret!
2. **Eksiksiz Native `ios/` Klasörü, İzinler ve Apple Privacy Manifest (`PrivacyInfo.xcprivacy`):**
   - Capacitor iOS platformunu (`@capacitor/ios`) kur ve yapılandır (`ios/App/...`).
   - **Apple Zorunlu `ios/App/App/PrivacyInfo.xcprivacy`:** `NSPrivacyAccessedAPICategoryUserDefaults` (`CA92.1`), `NSPrivacyAccessedAPICategoryFileTimestamp` (`C617.1`), `NSPrivacyAccessedAPICategoryDiskSpace` (`E174.1`), `NSPrivacyTracking = false` bildirimlerini eksiksiz ekle (bu dosya yoksa Apple yüklenen `.ipa` paketini anında e-postayla reddeder!).
   - **`Info.plist` & Türkçe/İngilizce `InfoPlist.strings`:** Kamera (`NSCameraUsageDescription`: *"Ders notlarınızdan ve kitaplarınızdan şema veya görsel kırpıp zihin haritanıza çıkartma olarak eklemek için kameranıza erişilir."*) ve Fotoğraf Arşivi (`NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`) açıklamalarını Apple kurallarına tam uygun, somut örnekli olarak ekle; `ITSAppUsesNonExemptEncryption = NO` ayarını ekle (her yüklemede şifreleme sorusu çıkmasını önler!).
   - **Xcode StoreKit Test Dosyası (`ios/App/MindMapProducts.storekit`):** `com.tahafirat.zihinharitam.lifetime_pro` (`₺199.99`, Non-Consumable) ürününü tanımla.
3. **Yayına Hazır Yasal Sayfalar (`public/privacy.html`, `public/terms.html`, `public/support.html`):**
   - App Store Connect'in zorunlu kıldığı Gizlilik Politikası, Kullanım Koşulları ve Destek sayfalarını temiz, Türkçe + İngilizce çift dilli statik HTML sayfaları olarak üret.
4. **Hem Windows'tan (GitHub Actions Cloud macOS) Hem Mac'ten Tek Komutla `.ipa` Derleme & App Store Connect Yükleme:**
   - **`.github/workflows/ios-appstore-release.yml`:** Windows bilgisayarda geliştirme yapılırken bile tek bir `git tag v1.0.0 && git push --tags` (veya GitHub üzerinden `Run workflow` butonu) ile `macos-15` sunucusunda çalışan, Apple Dağıtım Sertifikasını + Provisioning Profile'ı + App Store Connect API Anahtarını (`.p8`) kuran, `npm run verify:appstore && npm run build`, `npx cap sync ios`, `xcodebuild archive`, `xcodebuild -exportArchive` adımlarını çalıştırıp üretilen **`.ipa` dosyasını doğrudan `xcrun altool --upload-app` ile App Store Connect / TestFlight'a yükleyen** tam otomatik iş akışını kur!
   - **`scripts/ios-build-and-upload.sh` & `fastlane/Fastfile`:** Yerel bir Mac üzerinde tek komutla (`npm run ios:ship`) arşivleyip App Store Connect'e yükleyen betiği ve `ios/ExportOptions.plist` şablonunu hazırla.
5. **Otomatik App Store Ekran Görüntüsü Üreticisi (`scripts/capture-appstore-screenshots.mjs`):**
   - Uygulamayı canlı başlatıp Apple'ın zorunlu tuttuğu tam piksel çözünürlüklerinde (**iPhone 6.9" `1320x2868`**, **iPhone 6.5" `1284x2778`**, **iPad Pro 13" `2064x2752`**) 5'er adet yüksek çözünürlüklü mağaza ekran görüntüsünü (*1. Zengin Görsel Harita Tuvali, 2. Klavye Üstü 25.000+ Anlık Çıkartma, 3. Ders Notundan Şema Kes & Sınav Modu, 4. Haritalarım Çalışma Alanı, 5. Koyu Çalışma Modu & Sistem Mimarisi*) otomatik çekip `appstore-submission/screenshots/` klasörüne kaydeden betiği yaz!
6. **App Store Connect Teslimat Rehberi (`appstore-submission/APP_STORE_CONNECT_REHBERI.md`):**
   - Tüm mağaza metinlerini, `200 ₺` Ömür Boyu Pro ürün kurulumunu, GitHub Secrets anahtar tablosunu ve Apple inceleme ekibine yazılacak onay notunu proje içinde hazır üret.

---

## 6. ZORUNLU SON KONTROL VE TEST KAPISI (`npm run verify:appstore`)

`scripts/verify-appstore-readiness.mjs` adında kapsamlı bir doğrulama betiği yaz ve çalıştır. İşini bitirmeden önce bu betik aşağıdakilerin **%100'ünü otomatik doğrulamalıdır**:
1. Offline ikon şardları üretilmiş ve 20 Türkçe akademik sorguda alaka & `<15ms` hız testi geçmiş mi?
2. `Free` modda 3 haritaya izin verilip **4. harita oluşturulduğunda** `200 ₺` Ömür Boyu Pro Paywall açılıyor mu? Pro ikonlara tıklandığında Paywall tetikleniyor mu ve `"Satın Alımları Geri Yükle"` akışı çalışıyor mu?
3. `1024x1024` App Store ikonu mevcut mu ve **alfa (şeffaflık) kanalı içermiyor mu** (`colorType === 2` RGB kontrolü)?
4. `ios/App/App/PrivacyInfo.xcprivacy`, `StoreKitPlugin.swift`, `Info.plist` izin metinleri (`ITSAppUsesNonExemptEncryption = false` dahil), `ExportOptions.plist`, `.github/workflows/ios-appstore-release.yml`, `public/privacy.html` ve `public/terms.html` eksiksiz yerinde mi?
5. `tsc --noEmit` ve `vite build` sıfır hatayla tamamlanıyor mu ve canlı tarayıcıda Mobil (`375x812`), Tablet (`820x1180`) ve Masaüstü (`1440x900`) görünümlerinde sıfır konsol hatası ve sıfır taşma var mı?
