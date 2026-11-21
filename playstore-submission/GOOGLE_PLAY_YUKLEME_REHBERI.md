# ZihinHaritam — Google Play Store Eksiksiz Hazırlık & Yükleme Rehberi

Tüm teknik gereksinimler (**Android API 35 / Target SDK 35**, **Google Play Billing Library v7.1.1**, **Kalıcı 2048-bit RSA Upload Keystore**, **512×512 İkon**, **1024×500 Özellik Grafiği**, **10 Adet Çerçeveli Ekran Görüntüsü**, **TR & EN Mağaza Metinleri** ve **Gizlilik/Destek Web Sayfaları**) hazırlandı.

---

## 1. Kalıcı İmzalı Uygulama Paketleri (`versionCode: 16`, `versionName: 1.0.2`)
- **Google Play Yükleme Dosyası (`.aab`)**: `playstore-submission/ZihinHaritam-v1.0.2-b16-release.aab`
- **Doğrudan Android Cihazda Test İçin (`.apk`)**: `playstore-submission/ZihinHaritam-v1.0.2-b16-release.apk`
- **Paket Kimliği (`applicationId`)**: `com.tahafirat.zihinharitam`
- **Kalıcı Yükleme Anahtarı (Saklayın / Yedekleyin)**: `.secrets/zihinharitam-upload.jks`
  - **Alias**: `zihinharitam-upload`
  - **SHA-1**: `D9:73:4D:9F:54:89:1B:D2:1E:BA:D4:8D:38:09:BA:26:B7:12:BF:8B`
  - **SHA-256**: `36:65:96:97:6D:35:FA:2F:35:94:A6:67:84:9A:F8:2A:C2:8A:5C:9C:24:0A:59:C8:C0:2F:79:DB:69:EF:E8:B2`

---

## 2. Google Play Console — Uygulama Oluşturma Bilgileri
| Alan | Değer |
|---|---|
| **Uygulama Adı (TR)** | `Zihin Haritası: ZihinHaritam` |
| **Uygulama Adı (EN)** | `Mind Map: ZihinHaritam` |
| **Varsayılan Dil** | `Türkçe (Türkiye)` |
| **Uygulama veya Oyun** | `Uygulama` |
| **Ücretsiz veya Ücretli** | `Ücretsiz` (Uygulama içi satın alma içerir) |
| **Kategori** | `Eğitim` (Etiketler: Zihin Haritası, Not Alma, Ders Çalışma, Üretkenlik) |

---

## 3. Mağaza Girişi Görselleri ve Metinleri (Sürükle-Bırak Hazır)
- **Uygulama Simgesi (512×512 PNG)**: `playstore-submission/icon-512x512.png`
- **Özellik Grafiği (1024×500 PNG)**: `playstore-submission/feature-graphic-1024x500.png`
- **Telefon Ekran Görüntüleri (5 Adet, 1080×1920)**: `playstore-submission/screenshots/phone/01..05.png`
- **10" Tablet Ekran Görüntüleri (5 Adet, 1600×2560)**: `playstore-submission/screenshots/tablet-10/01..05.png`
- **Kısa Açıklama (TR — 79/80 karakter)**: `playstore-submission/metadata/tr-TR/short_description.txt`
- **Tam Açıklama (TR)**: `playstore-submission/metadata/tr-TR/full_description.txt`
- **İngilizce Metinler (`en-US`)**: `playstore-submission/metadata/en-US/`

---

## 4. Google Play Politika & Uygulama İçeriği Form Cevapları (Birebir İşaretleyin)
1. **Gizlilik Politikası URL**: `https://tahafirat.github.io/zihinharitam/privacy.html`
2. **Uygulama Erişimi (App Access)**: `Özel erişim olmadan tüm işlevler kullanılabilir` (Giriş / hesap zorunluluğu yok).
3. **Reklamlar (Ads)**: `Hayır, uygulamam reklam içermiyor`.
4. **İçerik Derecelendirme (IARC)**: `Referans, Haber veya Eğitim` -> Tüm şiddet/kumar/uygunsuz içerik soruları `Hayır` -> **PEGI 3 / Herkes (Everyone)**.
5. **Hedef Kitle**: `13-15`, `16-17`, `18 ve üzeri` (Çocuklara yönelik tasarım beyanı gerektirmez).
6. **Haber / COVID-19 / Devlet / Finans / Sağlık Uygulaması mı?**: Hepsi `Hayır`.
7. **Veri Güvenliği (Data Safety)**:
   - Uygulamanız zorunlu kullanıcı verisi topluyor veya paylaşıyor mu? **`Hayır`** (Tüm haritalar, notlar ve fotoğraflar kullanıcının cihazında yerel olarak saklanır; satın alma işlemleri yalnızca Google Play Faturalandırma tarafından yönetilir).

---

## 5. Google Play Faturalandırma (Abonelikler ve Ömür Boyu Pro Ürün ID'leri)
`.aab` dosyasını ilk kez **Dahili Test (Internal Testing)** veya **Kapalı Test** kanalına yüklediğinizde Google Play `PlayBillingPlugin` (`com.android.billingclient:billing:7.1.1`) kütüphanesini otomatik algılayacak ve **Para Kazanma → Ürünler** menüsünü açacaktır. Aynı ID'leri birebir tanımlayın:

1. **Abonelik 1 — Aylık Pro**
   - **Ürün Kimliği (Product ID)**: `com.tahafirat.zihinharitam.pro_monthly`
   - **Fiyat**: Türkiye `249,99 ₺ / ay` | Global `$4.99 / mo`
2. **Abonelik 2 — Yıllık Pro**
   - **Ürün Kimliği (Product ID)**: `com.tahafirat.zihinharitam.pro_yearly`
   - **Fiyat**: Türkiye `1.499,99 ₺ / yıl` | Global `$29.99 / yr`
3. **Uygulama İçi Ürün (Tek Seferlik) — Ömür Boyu Pro**
   - **Ürün Kimliği (Product ID)**: `com.tahafirat.zihinharitam.lifetime_pro`
   - **Fiyat**: Türkiye `2.499,99 ₺` | Global `$49.99`
