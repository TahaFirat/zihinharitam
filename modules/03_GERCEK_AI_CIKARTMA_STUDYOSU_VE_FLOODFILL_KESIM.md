# MODÜL 3: GERÇEK AI ÇIKARTMA STÜDYOSU VE KÖŞE FLOOD-FILL KESİM MOTORU

Bu modülde `AIStickerService.ts` ve `DieCutStickerProcessor.ts` dosyalarındaki kalitesiz/sahte üretimi ve hatalı arka plan silmeyi tamamen yenile.

## Kesin Kurallar ve Mimari

### 1. Sahte Prosedürel Çizimlerin Silinmesi
- Rastgele SVG daireleri/çokgenleri veya metin kutuları üreten tüm mock kodları sil.

### 2. `src/core/visuals/AIStickerDirector.ts` (Visual Art Director + 4'lü Aday Üretimi)
- **Adım 1 — Somut Görsel Çeviri:** Kullanıcının yazdığı terimi, haritanın üst konu bağlamıyla birleştirerek **tek ve net bir fiziksel nesne/sahne** tarifine (İngilizce) dönüştür. Asla soyut Türkçe kelimeyi ham olarak görsel modeline yollama!
- **Adım 2 — 4 Seçilebilir Sanat Stili:**
  1. `hand_drawn` (El çizimi mürekkep konturlu, suluboya/marker dolgulu çıkartma)
  2. `isometric_3d` (`systemdesign.io` ve 3D kil/stüdyo tarzı hacimli ikon)
  3. `scientific_atlas` (Tıbbi/mühendislik kesit ve ders kitabı illüstrasyonu)
  4. `flat_vector` (Modern çok renkli düz vektör rozet)
- **Adım 3 — Negatif Kısıt Kilidi:** Tüm promptlara `"isolated on pure solid #FFFFFF white background, centered full object with white padding, zero text, no words, no letters, no labels, no watermark"` kurallarını ekle.
- **Adım 4 — 4 Paralel Varyasyon + Çoklu Motor (BYOK + Anahtarsız Flux):**
  - Varsayılan olarak 4 farklı `seed` ile `Flux` modelinden (`512x512`, `nologo=true`, `enhance=false`) 4 aday çıkartmayı paralel üret ve kullanıcıya 2x2 / 1x4 seçim ızgarasında göster.
  - Ayarlar penceresinden isteğe bağlı **Gemini API Key**, **OpenAI API Key**, **Fal.ai Key** veya **Together AI Key** girilirse doğrudan o sağlayıcı üzerinden üretim yap.

### 3. `src/core/visuals/DieCutStickerProcessor.ts` V2 (BFS Corner Flood-Fill)
- Küresel beyaz piksel silme (`r > 240 && g > 240 && b > 240`) yöntemini **tamamen kaldır**.
- Bunun yerine görüntünün 4 köşesinden ve dış çerçeve piksellerinden başlayan **Queue tabanlı BFS Flood-Fill** uygula:
  - Sadece dış arka planla bağlantılı açık renkli pikselleri şeffaflaştır.
  - Koyu dış hat çizgisinin içinde kalan tüm iç beyazları (göz, diş, kemik, kağıt, bulut, bina cephesi) %100 koru!
  - Kenar geçiş piksellerine `1.5px` yumuşak alfa geçişi (anti-aliasing) uygula, ardından `8px` morfolojik genişletme ile pürüzsüz `#FFFFFF` die-cut konturu ve kağıt gölgesi ekle.
