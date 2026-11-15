# FAZ 3: KLAVYE ÜSTÜ CANLI GÖRSEL ŞERİDİ, NOTTAN KES VE SINAV MODU

Bu fazda telefon ve tablet kullanımını rakipsiz hız ve kolaylığa ulaştıran klavye üstü canlı öneri şeridini, ders notu kırpıcısını, kalemle çiz-dönüştür aracını ve aktif hatırlama sınav modunu inşa et.

## Gereksinimler
1. **Klavye Üstü Canlı Görsel Öneri Şeridi (`KeyboardVisualBar`):**
   - `window.visualViewport` API dinleyicisi ile iOS, iPadOS ve Android sanal klavyesinin tam üst kenarına sıfır boşluk ve sıfır titremeyle kenetlenir (masaüstünde düzenlenen düğümün hemen altında yüzen kompakt bar olarak açılır).
   - Üst satırda `[ ✨ Çizim | 🧊 3D | 📷 Fotoğraf | 📐 Şema ]` mod geçiş hapları ile sağda `✨ AI Çiz`, `📷 Nottan Kes`, `✏️ Karala` butonları yer alır.
   - Alt satırda kullanıcı dal başlığını yazarken `120ms` debounce ile canlı akan görsel karuseli bulunur; tek dokunuşla görsel dala yay animasyonuyla yerleşir.
2. **Ders Notundan / Slayttan Anlık Kes-Yapıştır (`NoteCropperModal`):**
   - Kamera, galeri veya panodan (clipboard) alınan ders kitabı/slayt görüntüsünü kırpar, arka planını siler veya "Şema Netleştirme" filtresi uygular ve beyaz konturlu çıkartma olarak dala yapıştırır.
3. **Kalem / Parmak "Karala-Dönüştür" (`QuickSketchPopover`):**
   - Özellikle tablet + kalem kullanıcıları için hızlı mini çizim alanı; çizilen kaba şekli ya temiz vektör çıkartmaya ya da dal başlığıyla birleştirerek renkli AI çıkartmasına dönüştürür.
4. **Aktif Hatırlama / Sınav Modu (`ExamRecallMode`):**
   - Tek dokunuşla "Metinleri Gizle (Resimden Tahmin Et)" veya "Alt Dalları Gizle (Başlıktan Tahmin Et)" çalışma modunu çalıştırır; gizli öğelere dokunuldukça kart açılır gibi görünür hale gelir.
