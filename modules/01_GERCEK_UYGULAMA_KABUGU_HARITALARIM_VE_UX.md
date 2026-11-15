# MODÜL 1: GERÇEK UYGULAMA KABUĞU, "HARİTALARIM" ÇALIŞMA ALANI VE MİNİMALİST UX

Bu modülde uygulamayı tek sayfalık bir tuval demosundan çıkarıp Apple App Store kalitesinde, tam yaşam döngüsüne sahip gerçek bir üretkenlik uygulamasına dönüştür.

## 1. Uygulama Ekran Akışı (Navigation State Machine)
- **Ekran 1 — `HomeWorkspace` ("Haritalarım" Kütüphanesi):**
  - Açılışta (kullanıcının son açık bıraktığı durum tercihine göre veya sol üstteki `← Haritalarım` butonuyla) hızlı, sade bir çalışma alanı sunar.
  - **Üst Bar:** Sol tarafta minimal logo + `ZihinHaritam`, ortada/sağda anlık arama (`Harita adı veya içindeki konuyu ara...`), sağda Pro rozeti (`👑 Pro` veya `Kilidi Aç • 200 ₺`) ve `⚙️` Ayarlar butonu.
  - **Hızlı Oluşturma Kartları:**
    1. `+ Yeni Görsel Harita` (Merkez konuyu soran temiz başlangıç kutusuyla açar)
    2. `🪄 Metinden / Nottan Harita` (Ders notunu yapıştırıp otomatik dallandırır)
    3. `📚 Hazır Şablonlar` (Sistem Tasarımı, Tıp/Kardiyoloji, Elektronik, Hukuk, Mimarlık)
  - **Klasörler & Etiketler:** `Tümü`, `📌 Sabitlenenler`, `🎓 Vize / Final`, `💻 Teknik & Mimari`, `🗑️ Çöp Kutusu`.
  - **Canlı Harita Kartları:** Haritadan çıkarken veya otomatik kayıtta üretilen hafif `480x320 WebP` küçük resim (`thumbnailDataUrl`), başlık, düğüm sayısı (`24 dal`), son düzenleme tarihi ve bağlam menüsü (*Yeniden Adlandır, Kopyasını Oluştur, Klasör Değiştir, `.zihin` Dosyası Olarak Yedekle, Çöpe Taşı*).
  - **30 Günlük Çöp Kutusu:** Öğrencilerin yanlışlıkla sildiği sınav haritalarını tek dokunuşla geri yükleyebilmesi (`deletedAt` alanı ile yumuşak silme).
- **Ekran 2 — `CanvasStage` (Sıfır Menü Kalabalıklı Görsel Harita Tuvali):**
  - Sol üstte `←` (`Haritalarım`'a dönüş, geçişte otomatik küçük resim günceller).
  - Tüm odak noktası noktalı kağıt tuval, organik renkli dallar ve çıkartmalardır.
- **Ekran 3 — `OnboardingOverlay` (İlk Açılış 3 Adımlı Mikro-Rehber):**
  - Yalnızca `localStorage.getItem('onboarding_v4_done')` yokken bir kez açılır; sade vektör illüstrasyonlu 3 hızlı kart ve sağ üstte `Atla` butonu bulunur.

## 2. Apple HIG & Mobil/Tablet Ergonomi Kuralları
- Tüm dokunmatik butonlar ve `+` dal çekme tutamaçları en az **`44x44px` görünür veya görünmez dokunma alanına (hit slop)** sahip olmalıdır.
- **Safe Area & Dynamic Island:** Üst bar `padding-top: max(12px, env(safe-area-inset-top))`, alt barlar ve çekmeceler `padding-bottom: max(12px, env(safe-area-inset-bottom))` kullanmalıdır.
- **iPad Split-View & Stage Manager:** Pencere genişliği anlık değiştiğinde (`320px` dar bölünmüş ekrandan `1366px` tam ekrana kadar) hiçbir modal, üst bar veya klavye şeridi ekran dışına taşmamalıdır.
