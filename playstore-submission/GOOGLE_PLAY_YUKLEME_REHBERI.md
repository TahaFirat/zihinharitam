# ZihinHaritam — Google Play Store Hazır Teslimat Rehberi (`com.tahafirat.zihinharitam`)

Google Play Console kontrolünde aktif Google hesabınızda (`tafifirat@gmail.com`) henüz **Google Play Geliştirici Hesabı** kaydının tamamlanmamış olduğu (`https://play.google.com/console/u/0/signup`) görüldü. Hesabınızı açtığınız anda (veya farklı bir geliştirici hesabınız varsa ona geçtiğinizde) **hiçbir ek derleme yapmadan** doğrudan yükleyebilmeniz için tüm imzalı paketler ve mağaza görselleri hazırlandı:

## 1. Hazır İmzalı Uygulama Dosyaları (API 35 / Target SDK 35 Uyumlu)
- **Google Play Yükleme Paketi (`.aab`)**: `playstore-submission/ZihinHaritam-v1.0.2-b15-release.aab` (Üretim / Kapalı Test kanalına doğrudan sürükleyip bırakabilirsiniz)
- **Doğrudan Kurulabilir Android Paketi (`.apk`)**: `playstore-submission/ZihinHaritam-v1.0.2-b15-release.apk`
- **Paket Kimliği (`applicationId`)**: `com.tahafirat.zihinharitam`
- **Sürüm (`versionName` / `versionCode`)**: `1.0.2` (`15`)

## 2. Hazır Profesyonel Mağaza Görselleri
- **512×512 Yüksek Çözünürlüklü İkon**: `playstore-submission/icon-512x512.png`
- **1024×500 Özellik Grafiği (Feature Graphic)**: `playstore-submission/feature-graphic-1024x500.png`
- **Telefon Ekran Görüntüleri (5 Adet, 1080×1920 Çerçeveli Tanıtım)**: `playstore-submission/screenshots/phone/01..05.png`
- **10" Tablet Ekran Görüntüleri (5 Adet, 1600×2560 Çerçeveli Tanıtım)**: `playstore-submission/screenshots/tablet-10/01..05.png`

## 3. Hazır Türkçe & İngilizce Mağaza Metinleri ve Yasal Bağlantılar
- **Uygulama Adı (TR)**: `playstore-submission/metadata/tr-TR/title.txt` (`Zihin Haritası: ZihinHaritam`)
- **Kısa Açıklama (TR)**: `playstore-submission/metadata/tr-TR/short_description.txt`
- **Tam Açıklama (TR)**: `playstore-submission/metadata/tr-TR/full_description.txt`
- **Gizlilik Politikası URL**: `https://tahafirat.github.io/zihinharitam/privacy.html`
- **Destek URL**: `https://tahafirat.github.io/zihinharitam/support.html`

## 4. Otomatik GitHub Actions Yüklemesi (İsteğe Bağlı)
Google Play Console açıldıktan sonra Service Account JSON anahtarınızı GitHub deponuzda `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` olarak eklediğinizde `.github/workflows/android-playstore-release.yml` her sürümü otomatik olarak doğrudan Google Play Console'a gönderir.
