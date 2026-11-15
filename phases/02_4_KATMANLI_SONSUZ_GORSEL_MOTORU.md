# FAZ 2: 4 KATMANLI SONSUZ GÖRSEL MOTORU VE DIE-CUT ÇIKARTMA İŞLEMCİSİ

Bu fazda her akademik bölüme (Mühendislik, Tıp, Hukuk, Mimarlık, Temel ve Sosyal Bilimler) sonsuz görsel sağlayan 4 katmanlı görsel motorunu ve görsel bütünleştirici (Die-Cut Sticker) boru hattını inşa et.

## Gereksinimler
1. **4 Görsel Mod ve Çoklu Kaynak Orkestratörü (`VisualSearchOrchestrator`):**
   - `illustration` (El çizimi renkli illüstrasyonlar + AI ortak havuzu)
   - `3d` (Fluent Emoji 3D ve hacimli ikonlar)
   - `photo` (Unsplash / Pexels / Wikimedia gerçek nesne ve yapı fotoğrafları)
   - `diagram` (Bioicons, Servier Medical Art, devre/mühendislik sembolleri, mimari kesitler ve Wikimedia SVG diyagramları)
2. **Türkçe -> Çok Dilli Anlamsal Arama (Semantic Vector Search):**
   - Kullanıcı Türkçe terim yazdığında (`"Mitral kapak"`, `"Op-Amp"`, `"İstinaf"`, `"Kemer tonoz"`) çok dilli vektör araması (`pgvector` + yerel eş anlamlı/akademik sözlük önbelleği) ile İngilizce/Latince etiketli bilimsel kütüphanelerden `<40ms` içinde sonuç getir.
3. **Stil Sabitli Anlık AI Çıkartma Üretimi & Ortak Havuz (`shared_stickers`):**
   - Kütüphanede bulunmayan niş kavramlar için Edge Function üzerinden `Flux.1 Schnell` / `Recraft V3` çağrısı yap.
   - Tüm üretimleri sabit el çizimi çıkartma stiline kilitle (koyu mürekkep dış hat, canlı marker/suluboya dolgu, saf beyaz arka plan, sıfır yazı).
   - Üretilen her çıkartmayı vektör embedding'i ile ortak veritabanına kaydet; sonraki kullanıcılara sıfır maliyetle anında sun.
4. **Otomatik Beyaz Konturlu Çıkartma Efekti (`DieCutStickerProcessor`):**
   - Fotoğrafların ve ders notu kesitlerinin arka planını temizle.
   - Offscreen Canvas'ta alfa maskesini `8px` genişleterek etrafına pürüzsüz beyaz çıkartma konturu (`#FFFFFF`), ince kesim sınırı ve yumuşak kağıt gölgesi ekle.
   - İşlenmiş çıkartmaları çevrimdışı hız için `IndexedDB` içinde `WebP` Blob olarak önbellekle.
