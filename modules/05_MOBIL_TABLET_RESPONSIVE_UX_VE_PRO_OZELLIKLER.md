# MODÜL 5: TAM RESPONSIVE MOBİL / TABLET / MASAÜSTÜ UX VE PRO ÖZELLİKLER

Bu modülde ekran görüntüsünde sağdan kesilen `KeyboardVisualBar` hatasını onar ve uygulamayı her ekran boyutunda kusursuzlaştır.

## Yapılacak Mühendislik Değişiklikleri

1. **Kesilmeyen, Taşmasız `KeyboardVisualBar.tsx`:**
   - Ekran görüntüsünde `📷 Nottan Kes` ve `✏️ Karala` butonlarının sağdan kesilmesine yol açan sabit/taşan satır yapısını düzelt.
   - **Masaüstü (`>=1024px`):** `max-width: min(720px, calc(100vw - 32px))`, ekran sınırlarına akıllı kenetlenme (`viewport clamping` — sağdan, soldan, alttan asla taşmaz!), üst satırda temiz mod sekmeleri + eksiksiz aksiyon butonları, alt satırda fare tekerleği ve sol/sağ oklarla kayan pürüzsüz görsel karuseli.
   - **Tablet (`768px–1023px`):** `visualViewport` klavye üstüne veya alt güvenli alana (`safe-area-inset-bottom`) oturan, `48px` dokunma hedefli, kalem dostu geniş bar.
   - **Telefon (`<768px`):** Klavyenin tam üstüne yapışan `%100` genişlikte alt bar, yatay kaydırılabilir aksiyon hapları ve yukarı çekince açılan tam ekran **`+150 Görsel` Sonsuz Çıkartma Çekmecesi (`StickerGalleryDrawer`)**.

2. **Responsive `TopMinimalHUD.tsx` ve Mobil Başparmak Çubuğu:**
   - Dar ekranlarda üst menünün sıkışmasını önle; ikincil aksiyonları kompakt menüye topla ve telefon/tablette alt merkeze tek elle kullanım için **`[+ Yeni Dal]` `[🪄 Düzenle]` `[🎯 Merkez]` `[🔍 İkonlar]`** yüzen hapını ekle.

3. **Organik "Kutusuz Çıkartma" vs "Kart" Düğüm Stili & Çıkartma Boyutu (`S/M/L/XL`):**
   - Kullanıcının düğümleri ister klasik zihin haritasındaki gibi **doğrudan organik dalın üstünde duran büyük renkli çıkartma + temiz başlık (kutusuz)** ister **modern kart** olarak kullanabilmesini ve çıkartma boyutunu büyütebilmesini sağla.

4. **Hızlı Komut & İkon Paleti (`Cmd/Ctrl + K`):**
   - Hem masaüstünde hem tablette anında açılan, haritadaki düğümlere odaklanan veya 25.000+ offline ikonu anında arayıp seçili dala atayan hızlı palet ekle.
