#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Bu betik yerel macOS (Xcode 16+) içindir."
  echo "Windows 11 kullanıyorsanız GitHub Actions (.github/workflows/ios-appstore-release.yml) üzerinden tek tıkla bulutta derleyip App Store Connect'e yükleyebilirsiniz!"
  exit 1
fi

: "${APPLE_TEAM_ID:?APPLE_TEAM_ID ortam değişkeni gerekli (örn: export APPLE_TEAM_ID=ABCD123456)}"
: "${APPSTORE_KEY_ID:?APPSTORE_KEY_ID ortam değişkeni gerekli}"
: "${APPSTORE_ISSUER_ID:?APPSTORE_ISSUER_ID ortam değişkeni gerekli}"
ASC_KEY_PATH="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_${APPSTORE_KEY_ID}.p8}"

if [[ ! -f "$ASC_KEY_PATH" ]]; then
  echo "Hata: App Store Connect API .p8 anahtarı bulunamadı: $ASC_KEY_PATH"
  exit 1
fi

BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"

echo "==> [1/6] İkonlar, offline 25.000+ çıkartma şardları ve web paketi derleniyor..."
npm run generate:icons
npm run build
npm run verify:appstore

echo "==> [2/6] Capacitor iOS senkronizasyonu ve CocoaPods kurulumu..."
npx cap sync ios
(cd ios/App && pod install)

echo "==> [3/6] Build numarası güncelleniyor ($BUILD_NUMBER)..."
(cd ios/App && xcrun agvtool new-version -all "$BUILD_NUMBER")

echo "==> [4/6] Xcode Archive oluşturuluyor..."
mkdir -p build/ipa
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -archivePath build/App.xcarchive \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$APPSTORE_KEY_ID" \
  -authenticationKeyIssuerID "$APPSTORE_ISSUER_ID" \
  archive

echo "==> [5/6] İmzalı App Store .ipa dışa aktarılıyor..."
cat > build/ExportOptions.local.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>destination</key>
    <string>export</string>
    <key>manageAppVersionAndBuildNumber</key>
    <true/>
    <key>method</key>
    <string>app-store-connect</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>teamID</key>
    <string>${APPLE_TEAM_ID}</string>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportOptionsPlist build/ExportOptions.local.plist \
  -exportPath build/ipa \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$APPSTORE_KEY_ID" \
  -authenticationKeyIssuerID "$APPSTORE_ISSUER_ID"

IPA_FILE="$(ls build/ipa/*.ipa | head -n 1)"
echo "==> [6/6] App Store Connect / TestFlight'a yükleniyor: $IPA_FILE"
xcrun altool --upload-app \
  --type ios \
  --file "$IPA_FILE" \
  --apiKey "$APPSTORE_KEY_ID" \
  --apiIssuer "$APPSTORE_ISSUER_ID"

echo "BAŞARILI! ZihinHaritam ($BUILD_NUMBER) App Store Connect'e yüklendi."
