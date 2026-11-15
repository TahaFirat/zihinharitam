# MODÜL 5: OTOMATİK IPA DERLEME, İMZALAMA VE APP STORE CONNECT YÜKLEME HATTI

Kullanıcı ister **Windows 11 bilgisayardan (GitHub Actions macOS bulut derleyicisiyle)** ister **bir Mac bilgisayardan** tek komutla `.ipa` paketini derleyip doğrudan **Apple App Store Connect / TestFlight**'a yükleyebilmelidir!

## 1. Buluttan Doğrudan App Store'a Yükleme (`.github/workflows/ios-appstore-release.yml`)
Bu GitHub Actions iş akışını eksiksiz oluştur:
- **Tetikleyiciler:** `workflow_dispatch` (GitHub arayüzünden tek tıkla "App Store'a Yükle" butonu + sürüm/build numarası girişi) ve `push: tags: ['v*']`.
- **Çalışma Ortamı:** `runs-on: macos-15` (Xcode 16+ ile).
- **Adımlar:**
  1. Node.js 22 kurulumu, `npm ci`, offline şardların ve ikonların üretimi (`npm run generate:icons && npm run build`), doğrulama testleri (`npm run verify:appstore`).
  2. `npx cap sync ios` ile web paketinin ve yerel Swift StoreKit 2 eklentisinin iOS projesine aktarılması.
  3. Geçici macOS Keychain oluşturma, `BUILD_CERTIFICATE_BASE64` (`Apple Distribution` `.p12`) ve `BUILD_PROVISION_PROFILE_BASE64` (`.mobileprovision`) sırlarını içe aktarma VEYA App Store Connect API Key (`APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID`, `APPSTORE_PRIVATE_KEY_P8`) ile **Xcode Automatic Signing (`-allowProvisioningUpdates`)** çalıştırma!
     - **Çok Önemli Kolaylık:** İş akışını öyle kur ki, kullanıcı sertifika/profil uğraşmak istemezse **YALNIZCA 4 GitHub Secret** (`APPLE_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY_P8` + yerel `Apple Distribution` `.p12`) ile veya otomatik imzalamayla sıfır zahmetle imzalasın!
  4. Build numarasını (`CURRENT_PROJECT_VERSION = ${{ github.run_number }}`) otomatik artırma (`xcrun agvtool new-version -all ${{ github.run_number }}`).
  5. `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphoneos -archivePath build/App.xcarchive archive` ile arşivleme.
  6. Dinamik `ExportOptions.plist` (`method: app-store-connect`, `uploadSymbols: true`, `signingStyle: automatic/manual`) ile `.ipa` dışa aktarma (`xcodebuild -exportArchive ...`).
  7. **Doğrudan App Store Connect'e Yükleme:**
     `xcrun altool --upload-app --type ios --file "build/ipa/App.ipa" --apiKey "$APPSTORE_KEY_ID" --apiIssuer "$APPSTORE_ISSUER_ID"`
  8. Ayrıca üretilen `.ipa` dosyasını ve mağaza ekran görüntülerini GitHub Workflow Artifact olarak da indirilebilir kaydet!

## 2. macOS Yerel Tek Komutla Yükleme Betiği (`scripts/ios-build-and-upload.sh` & `fastlane/Fastfile`)
- `package.json` içine `"ios:prepare": "npm run generate:icons && npm run build && npx cap sync ios"` ve `"ios:ship": "bash scripts/ios-build-and-upload.sh"` komutlarını ekle.
- `fastlane/Fastfile` ve `fastlane/Appfile` dosyalarını da hazırla (`lane :release` -> `build_app` + `upload_to_testflight` / `upload_to_app_store`).

## 3. Otomatik App Store Mağaza Ekran Görüntüsü Üreticisi (`scripts/capture-appstore-screenshots.mjs`)
Apple App Store Connect'in zorunlu kıldığı **birebir piksel çözünürlüklerinde** mağaza görsellerini otomatik çeken betiği yaz (`package.json` -> `"appstore:screenshots"`):
- **iPhone 6.9" Ekran (`1320 x 2868` px):** 5 sahne
- **iPhone 6.5" Ekran (`1284 x 2778` px):** 5 sahne
- **iPad Pro 13" Ekran (`2064 x 2752` px):** 5 sahne
- Çekilecek 5 Sahne:
  1. *Kardiyoloji / Tıp Görsel Zihin Haritası (Renkli organik dallar ve canlı çıkartmalar)*
  2. *Klavye Üstü Anlık Çıkartma Şeridi (%100 Çevrimdışı 25.000+ İkon)*
  3. *Dağıtık Sistem Mimarisi (`systemdesign.io` stili çapraz oklu harita & Koyu Çalışma Modu)*
  4. *"Haritalarım" Çalışma Alanı ve Hazır Akademik Şablonlar*
  5. *Aktif Hatırlama Sınav Modu & 200 ₺ Ömür Boyu Pro Ekranı*
- Tüm görseller alfasız 24-bit PNG olarak `appstore-submission/screenshots/{iphone-6.9,iphone-6.5,ipad-13}/` klasörlerine kaydedilsin!
