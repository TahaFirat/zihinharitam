# ZihinHaritam — Google Play Store Yükleme Rehberi (v1.0.3 / Build 25)

## Hazır Yayın Dosyaları
- **Play Console (Önerilen)**: `ZihinHaritam-v1.0.3-b25-release.aab` (İmzalı, R8 + kaynak küçültme aktif, `versionCode 25`)
- **Direkt Tablet/Telefon Testi**: `ZihinHaritam-v1.0.3-b25-release.apk` (Aynı release anahtarıyla imzalı)
- **Mağaza Grafikleri**:
  - `icon-512x512.png` (Yeni 3D uygulama ikonu, 24-bit RGB)
  - `feature-graphic-1024x500.png` (Özellik grafiği)
  - `screenshots/phone/` (5 adet yüksek dönüşümlü pastel telefon görseli)
  - `screenshots/tablet-10/` (5 adet 10" tablet görseli)

## Google Play Ürün Kimlikleri & Güncel Fiyatlar
- **Aylık Pro Abonelik (`SUBS`)**: `com.tahafirat.zihinharitam.pro_monthly` → **349,99 ₺ / ay** (\$6.99)
- **Yıllık Pro Abonelik (`SUBS`)**: `com.tahafirat.zihinharitam.pro_yearly` → **2.099,99 ₺ / yıl** (\$39.99)
- **Ömür Boyu Pro (`INAPP`)**: `com.tahafirat.zihinharitam.lifetime_pro` → **3.499,99 ₺** (\$69.99)

## Sürüm 25 Yenilikleri
- Samsung S-Pen yan tuşu tam donanım silgi düzeltmesi (Chromium StylusTextSelector engeli aşıldı)
- Sürüklenebilir, kenara oturan ve küçültülebilen Samsung Notes tarzı çizim & ikon panelleri
- Yeni 3D uygulama ikonu ve App Store / Play Store arama uyumlu yüksek kontrastlı mağaza görselleri
- Ücretsiz kullanıcılar için Çöp Kutusu kaldırıldı (kalıcı silme)
- Güvenlik sertleştirmesi (CSP, SVG/JSON sanitizer, Yjs öksüz veritabanı temizliği, brute-force koruması)
