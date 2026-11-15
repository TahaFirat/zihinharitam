# MODÜL 4: CAPACITOR iOS PROJESİ, XCODE YAPILANDIRMASI, İKON/SPLASH VE PRIVACY MANIFEST

Bu modülde projeye gerçek native iOS katmanını (`ios/`) ekle ve Apple'ın otomatik ikili (binary) taramasından tek seferde geçecek tüm yerel dosyaları üret.

## 1. Capacitor iOS Kurulumu ve Paket Kimliği
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/status-bar`, `@capacitor/keyboard` paketlerini uyumlu sürümlerle yapılandır.
- `capacitor.config.ts`:
  - `appId`: `'com.tahafirat.zihinharitam'`
  - `appName`: `'ZihinHaritam'`
  - `webDir`: `'dist'`
  - `ios.contentInset`: `'never'` (Safe area kontrolünü CSS `env(safe-area-inset-*)` ile milimetrik yönetmek için)
  - `ios.backgroundColor`: `'#FAF9F5'`
  - `plugins.Keyboard.resize`: `'none'` (`visualViewport` ile pürüzsüz kontrol için)

## 2. Otomatik İkon ve Launch Screen Üretici (`scripts/generate-app-icons-and-splash.mjs`)
Apple, `1024x1024` App Store ikonunda **alfa (şeffaflık) kanalı varsa paketi reddeder (`ITMS-90717`)**!
- Saf Node.js (`canvas` veya saf PNG/SVG->PNG encoder / `sharp` — projeye `sharp` devDependency olarak kurarak %100 kesin piksel çıktısı al!) kullanan bir betik yaz:
  1. Sıcak krem/indigo gradyan zeminli, ortasında canlı organik renkli dallar ve beyaz die-cut çıkartma yıldızı bulunan modern, minimal, yazısız bir **1024x1024 uygulama ikonu** tasarla.
  2. `.flatten({ background: '#1E1B4B' }).png({ compressionLevel: 9 })` ile **alfa kanalını %100 kaldır (24-bit RGB)**!
  3. `ios/App/App/Assets.xcassets/AppIcon.appiconset/` içine tüm gerekli boyutları ve tam uyumlu `Contents.json` dosyasını üret.
  4. `ios/App/App/Assets.xcassets/Splash.imageset/` içine temiz açılış ekranı görsellerini (`2732x2732`) üret.
  5. PWA için `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/apple-touch-icon.png` ikonlarını üret.

## 3. Zorunlu Apple Privacy Manifest (`ios/App/App/PrivacyInfo.xcprivacy`)
Bu dosyayı tam ve geçerli Apple plist XML şemasıyla oluştur:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>C617.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>35F9.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>E174.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```
Ve bu dosyanın `ios/App/App.xcodeproj/project.pbxproj` içindeki `Resources` derleme aşamasına (PBXResourcesBuildPhase) eklendiğinden emin ol!

## 4. `Info.plist` İzinleri ve Şifreleme Beyanı
`ios/App/App/Info.plist` (ve `tr.lproj/InfoPlist.strings` + `en.lproj/InfoPlist.strings`) içine şu anahtarları eksiksiz işle:
- `NSCameraUsageDescription`: `"Ders kitabınızdaki, defterinizdeki veya slaytlardaki diyagramların fotoğrafını çekip zihin haritanıza çıkartma olarak eklemek için kameranıza erişim gerekir."`
- `NSPhotoLibraryUsageDescription`: `"Galerinizdeki ders notu şemalarını ve görselleri seçip zihin haritanızdaki dallara eklemek için fotoğraf arşivinize erişim gerekir."`
- `NSPhotoLibraryAddUsageDescription`: `"Oluşturduğunuz görsel zihin haritası posterlerini cihazınızın galerisine kaydetmek için izin gerekir."`
- `ITSAppUsesNonExemptEncryption`: `<false/>` (TestFlight / App Store yüklemesinde şifreleme onayı takılmasını önler).
- Hem iPhone hem iPad yönelimleri (`UISupportedInterfaceOrientations` & `UISupportedInterfaceOrientations~ipad`) tam desteklensin ve `UIRequiresFullScreen = false` olarak ayarlansın (iPad çoklu görev uyumu için!).

## 5. Yasal Web Sayfaları (`public/privacy.html`, `public/terms.html`, `public/support.html`)
- App Store Connect incelemesinde zorunlu olan Gizlilik Politikası, Kullanım Koşulları (Standart Apple EULA uyumlu) ve Destek/İletişim sayfalarını temiz, duyarlı (responsive) HTML sayfaları olarak `public/` altına ekle.
