#!/bin/sh
set -e

echo "==> [Xcode Cloud] ZihinHaritam Capacitor post-clone hazirligi baslatiliyor..."

export HOMEBREW_NO_AUTO_UPDATE=1

if ! command -v node >/dev/null 2>&1; then
  echo "==> Node.js kuruluyor..."
  brew install node
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "==> CocoaPods kuruluyor..."
  brew install cocoapods
fi

REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../.." && pwd)}"
cd "$REPO_ROOT"

echo "==> npm bagimliliklari kuruluyor..."
npm ci

echo "==> Alfasiz ikonlar, 25.000+ cevrimdisi cikartma dizini ve production bundle derleniyor..."
npm run generate:icons
npm run build

echo "==> Capacitor iOS senkronizasyonu yapiliyor..."
npx cap sync ios

echo "==> CocoaPods bagimliliklari kuruluyor..."
cd "$REPO_ROOT/ios/App"
pod install

if [ -n "${CI_BUILD_NUMBER:-}" ]; then
  echo "==> Xcode Cloud Build numarasi senkronize ediliyor: ${CI_BUILD_NUMBER}"
  xcrun agvtool new-version -all "${CI_BUILD_NUMBER}"
fi

echo "==> [Xcode Cloud] ZihinHaritam Capacitor iOS derlemeye hazir!"
