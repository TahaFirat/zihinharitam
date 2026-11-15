# FAZ 1: SONSUZ TUVAL MOTORU, ORGANİK DALLAR VE SIFIR MENÜ UX

Bu fazda Görsel Zihin Haritası uygulamasının 60/120 FPS hızında çalışan çekirdek tuval motorunu ve "Sıfır Menü - Tam Ekran Tuval" etkileşimlerini eksiksiz inşa et.

## Gereksinimler
1. **Sonsuz Noktalı Defter Tuvali (`InfiniteViewport`):**
   - HiDPI (`devicePixelRatio`) destekli Canvas + DOM metin katmanı.
   - Fare tekerleği, iki parmak sıkıştırma (pinch-to-zoom `0.15x` – `4.0x`) ve ataletli (inertial) kaydırma.
   - Görüş alanı dışı düğümleri çizimden hariç tutan (viewport culling) `rbush` uzamsal indeksleme.
2. **Organik Tapered Bezier Dallar (`OrganicBranchRenderer`):**
   - Kökten kalın başlayıp uca doğru incelen pürüzsüz kübik Bezier kollar.
   - Her ana dala ayrı canlı renk ataması ve alt dallara otomatik renk mirası.
3. **Sürükle-Yaz (Drag-to-Branch) ve Tek El Kullanımı:**
   - Her düğümün çevresinde sürüklenebilir veya tek dokunuşla boş açıya dal atan `+` tutamacı.
   - Sürükleme sırasında yay fiziğiyle uzayan canlı önizleme dalı; bırakıldığında anında yeni düğüm oluşturma ve başlık düzenleme moduna geçme.
4. **Dal Katlama ve Odak Modu:**
   - Çift dokunuşla alt dalları katlama/açma (`+N` rozeti ile).
   - Seçili ana dal dışındakileri solduran **Odak Modu** ve çarpışmaları çözen **Otomatik Radyal Düzen** motoru.
5. **iOS / Mobil Dokunma Koruması:**
   - `touch-action: none`, metin seçimi/büyüteç engeli ve `PointerEvent` tabanlı kalem/parmak/fare ayrımı.
