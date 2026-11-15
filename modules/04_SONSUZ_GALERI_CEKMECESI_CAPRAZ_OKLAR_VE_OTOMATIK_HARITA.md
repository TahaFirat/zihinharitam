# MODÜL 4: SONSUZ ÇIKARTMA GALERİSİ, ÇAPRAZ İLİŞKİ OKLARI VE OTOMATİK HARİTA KURUCU

Bu modülde "Sıfır Menü - Tam Ekran Tuval" sadeliğini bozmadan kullanıcı deneyimini profesyonel seviyeye çıkaran etkileşim araçlarını ekle.

## İnşa Edilecek Bileşenler

### 1. `src/components/StickerGalleryDrawer.tsx` (Sonsuz Görsel Çekmecesi)
- `KeyboardVisualBar` içindeki yatay karuselin yanına **`🔍 +80 Görsel`** butonu ekle.
- Açıldığında:
  - Üstte **Görsel Metafor Öneri Çipleri** (kullanıcının yazdığı konunun farklı görsel açılarını tek tıkla aratır),
  - Tarz sekmeleri (`Tümü`, `El Çizimi`, `Sistem Mimarisi`, `3D & Renkli`, `Tıbbi/Akademik`, `Fotoğraf`, `Şema`),
  - **"Dal Rengine Uydur"** anahtarı ve **Köşe Mikro-Rozet Seçici** (`🔒`, `⚡`, `✅`, `❌`, `⚠️`, `🔥`, `📡`, `⚖️`),
  - Kaydırdıkça yeni sonuçlar yükleyen (infinite scroll) 4–8 sütunlu hızlı ızgara.

### 2. `src/core/canvas/CrossLinkRenderer.ts` (`systemdesign.io` & Akademik Çapraz İlişki Okları)
- İki farklı daldaki düğümler arasında (ör. `API Gateway ---> Auth Service` veya `İlk Derece ---> İstinaf`) yönlü, yumuşak Bezier eğrili, akış animasyonlu kesikli oklar (`CrossLink`) çiz.
- Okun ortasında çift tıklanıp düzenlenebilen zarif bir etiket hapı (`"HTTPS / JWT"`, `"tetikler"`, `"temyiz"`) bulunsun.
- `MindMapDocument` veri modeline `crossLinks: CrossLink[]` dizisini geriye dönük uyumlu şekilde ekle; PDF/PNG/SVG dışa aktarmada bu okları da eksiksiz çiz.

### 3. `src/components/SmartMapGeneratorModal.tsx` (Ders Notundan / Konudan Otomatik Görsel Harita)
- Üst minimal HUD barına küçük bir **`🪄 Metinden Harita`** butonu ekle.
- Kullanıcı bir konu başlığı veya ders notu metni yapıştırdığında:
  1. Metni ana başlıklar ve alt dallar halinde ayrıştırır,
  2. `RadialAutoLayout` ile çakışmasız yerleştirir,
  3. **Her düğüm için `VisualSearchOrchestrator` üzerinden birbirinden farklı, konuya tam uyumlu renkli çıkartmaları paralel bulup otomatik yerleştirir!**

### 4. Teknik/Formül Rozeti, Mini-Harita Radarı ve 5 Bayrak Gemisi Şablon
- Düğümlere isteğe bağlı kompakt teknik alt-etiket (`subtitle` / formül / kanun maddesi / port bilgisi) desteği ekle.
- Sağ alt köşeye katlanabilir **Mini-Harita Radarı** ve uzaklaştırmada **Semantic Zoom (LOD)** ekle.
- `src/data/academicTemplates.ts` içine **`Dağıtık Sistem Mimarisi (System Design)`** şablonunu ekle ve **Tıp, Mühendislik, Hukuk, Mimarlık** şablonlarını zengin çok renkli çıkartmalar ve çapraz oklarla güncelle.
