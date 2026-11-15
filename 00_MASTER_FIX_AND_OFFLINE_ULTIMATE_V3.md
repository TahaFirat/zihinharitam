# GÖRSEL ZİHİN HARİTASI — V3 ACİL HATA ONARIMI, 120 FPS SIFIR TİTREME VE 25.000+ OFFLINE GÖRSEL MOTORU MASTER PROMPTU

> **Rol ve Görev:** Sen Kıdemli bir Canvas/Grafik Performans Mühendisi, Arama Motoru Mimarı ve Cross-Platform (Mobil/Tablet/Masaüstü) UX Uzmanısın.
> Mevcut projede ciddi kullanılabilirlik, performans ve alaka düzeyi hataları tespit edildi. Görevin; aşağıda kök nedenleriyle teşhis edilen **TÜM bozuklukları sıfıra indirmek**, uygulamayı **internet tamamen kapalıyken (100% Offline) bile 25.000+ renkli çıkartma ve akademik ikonla `<8ms` hızında çalışacak** hale getirmek ve telefon, tablet, bilgisayarda yağ gibi akan (60/120 FPS, sıfır titreme) kusursuz bir ürüne dönüştürmektir.

---

## 1. CANLI TESTTE TESPİT EDİLEN KRİTİK HATALAR (BUNLARI KÖKTEN ÇÖZ!)

1. **HATA 1 — Düğüm Taşırken Titreme (Jitter) ve Ağır Yavaşlık:**
   - **Kök Neden:** `pointermove` sırasında her pikselde React `useState` güncellenerek tüm düğümlerin yeniden render edilmesi; düğüm DOM kartlarında aktif sürükleme esnasında CSS `transition` açık kalması (imleçle CSS animasyonunun kavga etmesi); ekran/dünya koordinat dönüşümünde kümülatif delta yuvarlama kayması; ve ana iş parçacığında (main thread) piksel döngüsü çalıştırılması.
2. **HATA 2 — Başlıkla Alakasız İkonlar (`"mikroorganizma"` Yazınca Mantık Kapısı, Sunucu, Merdiven, Baca ve Minare Çıkması!):**
   - **Kök Neden:** `"mikroorganizma"` kelimesindeki `"mikro"` ön ekinin kısmi dizgi eşleşmesiyle (`includes` / 3-4 harf prefix) `"mikroservis"` ve `"mikrodenetleyici"` ikonlarını getirmesi; üst düğümün (`"çip"`) bağlam kelimelerinin alt düğüm sorgusunu kirletmesi; ve sonuç az bulunduğunda kalan boşlukların rastgele `SystemDesignVisualPack` / `ARASAAC` ikonlarıyla doldurulması (garbage fallback padding).
3. **HATA 3 — Görsellerin Çok Geç Değişmesi (3–5 Saniye Gecikme ve Yarış Durumu):**
   - **Kök Neden:** Her tuş vuruşunda dış API'lere (`api.iconify.design`, `arasaac`, `wikimedia`, `openverse`) onlarca paralel HTTP isteği atılması, `DuotoneStickerColorizer`'ın her ikon için ayrı `.svg` dosyası indirmesi ve önceki tuş vuruşuna ait isteklerin `AbortController` ile iptal edilmemesi.
4. **HATA 4 — Parçalanmış / Bozuk Çıkartma Görüntüsü (`"çip"` Düğümünün Üstündeki Bozuk Şema):**
   - **Kök Neden:** İnce çizgili diyagramlara veya SVG'lere Canvas üzerinde piksel bazlı Flood-Fill + `8px` morfolojik genişletme uygulanması; bu işlemin şemanın iç beyazlarını kemirip kahverengi/gri bozuk bloklar oluşturması.
5. **HATA 5 — Şablon Alt Başlığı Kalıntısı ve Sağdan Kesilen Yüzen Şerit:**
   - **Kök Neden:** Kullanıcı şablondaki `"Kardiyoloji"` kök düğümünün adını `"çip"` olarak değiştirdiğinde altında hâlâ eski `"Kardiyoloji De..."` alt-etiketinin (`subtitle`) kalması; ayrıca `KeyboardVisualBar` içindeki üst aksiyon satırında `📷 Nottan Kes` ve `✏️ Karala` butonları ile 9. ikonun sağ kenardan taşarak kesilmesi (clipping).

---

## 2. MİMARİ DEVRİM 1: %100 OFFLINE ÇALIŞAN 25.000+ ÜCRETSİZ İKON & ÇIKARTMA MOTORU

İnternet yavaşken veya **uçak modunda (100% Offline)** bile her konuya anında (`<8ms`) onlarca alakalı, rengârenk çıkartma getirmek için dış API bağımlılığını birincil olmaktan çıkar ve açık kaynaklı paketleri doğrudan projeye entegre et!

### 2.1. Kurulacak Ücretsiz Açık Kaynak NPM Paketleri
`package.json` içine şu paketleri gerçekten kur (`npm install`):
- **Doğal Çok Renkli (Multi-Color) Çıkartma & İllüstrasyon Paketleri (`devDependencies` — derleme zamanı şardlama için):**
  - `@iconify-json/fluent-emoji-flat` (~1.530 canlı renkli illüstrasyon: mikroorganizma/mikrop, kalp, beyin, akciğer, DNA, mikroskop, petri kabı, kemik, terazi, mahkeme binası, çip, pil, anten, hayvanlar, bitkiler, coğrafya, araçlar)
  - `@iconify-json/fluent-color` (~890 Microsoft Fluent çok renkli gradyan sistem ve üretkenlik ikonu)
  - `@iconify-json/openmoji` (~4.200 siyah mürekkep dış hatlı, el çizimi tadında çok renkli çıkartma)
  - `@iconify-json/icon-park` (~2.658 çok renkli vektör ikonu: tıp, mühendislik, mimarlık, bilim, donanım, grafikler)
  - `@iconify-json/flat-color-icons` (~312 çok renkli iş, veritabanı, devre, belge, mühendislik ikonu)
  - `@iconify-json/logos`, `@iconify-json/devicon`, `@iconify-json/skill-icons` (~2.200 yazılım, bulut, veritabanı, ağ, işletim sistemi ve mühendislik logosu)
- **Akademik & Teknik Uzmanlık Paketleri (`devDependencies` — Vektör Renklendirici ile canlı çıkartmaya dönüşecek):**
  - `@iconify-json/healthicons` (~1.500 tıp, kardiyoloji, mikrobiyoloji, anatomi, cerrahi, ilaç, klinik ikonu)
  - `@iconify-json/medical-icon` (~144 klinik ve hastane uzmanlık ikonu)
  - `@iconify-json/game-icons` (~4.100 ansiklopedik nesne: bakteri, virüs, parazit, hücre, organlar, tokmak, terazi, ferman, sütun, kemer, köprü, dişli, devre, deney tüpü, tarihî semboller)
  - `@iconify-json/tabler`, `@iconify-json/carbon`, `@iconify-json/ph` (~12.000+ net mühendislik, sistem mimarisi, matematik, fizik, yapay zekâ, hukuk, finans ikonu)
- **Çalışma Zamanı Arama & Offline PWA Paketleri (`dependencies` / `devDependencies`):**
  - `minisearch` (Hafif, `<8ms` bulanık/BM25 tam metin arama motoru)
  - `vite-plugin-pwa` + `workbox-window` (Tüm uygulama kabuğunu ve yerel ikon şardlarını %100 offline önbelleğe alan Service Worker)

### 2.2. Derleme Zamanı Offline İkon Şardlayıcı (`scripts/build-offline-icon-shards.mjs`)
Ana JS paketini şişirmeden 25.000+ ikonu yerel diskten milisaniyede sunmak için `package.json` içindeki `"predev"` ve `"prebuild"` adımlarına otomatik çalışan bir Node.js derleme betiği ekle:
1. Yüklü tüm `@iconify-json/*` paketlerini okur; oklar, düz çizgiler, harf/rakam kutuları gibi anlamsız UI kalabalığını filtreleyip **en kaliteli 20.000–25.000+ ikonu** seçer.
2. **Zengin Türkçe + İngilizce + Latince Çeviri & Taksonomi Sözlüğü** kullanarak her ikonun İngilizce adını ve kategorisini Türkçe karşılıklarıyla etiketler (ör. `microbe` -> `"mikrop mikroorganizma bakteri virüs patojen biyoloji enfeksiyon"`, `stethoscope` -> `"stetoskop oskültasyon muayene doktor klinik tıp kardiyoloji"`, `chip / cpu` -> `"çip mikroçip işlemci tümdevre entegre devre yarıiletken donanım"`, `load-balancer` -> `"yük dengeleyici trafik dağıtıcı sunucu ağ"`).
3. İki çıktı üretir:
   - `public/offline-packs/search-manifest.json`: Yalnızca `{ id, pack, name, trTags, enTags, domain, isMultiColor, shardId }` içeren sıkıştırılmış arama indeksi.
   - `public/offline-packs/shards/shard-00.json` ... `shard-23.json`: İkonların `{ viewBox, body }` SVG verilerini tutan ~24 adet hızlı yerel JSON parçası.
4. **Üstüne Yerleşik Çok Renkli Bilim & Sistem Paketi (`BuiltInMultiColorAtlas.ts`):**
   - `SystemDesignVisualPack` (65+ `systemdesign.io` stili mimari çıkartma) YANINA, **Mikrobiyoloji, Tıp/Anatomi, Elektronik, Hukuk, Mimarlık ve Temel Bilimler** için özel tasarlanmış **80+ çok renkli, katmanlı SVG illüstrasyon çıkartması** ekle (Bakteri, Virüs/Bakteriyofaj, Petri Kabı, Hücre & Organeller, Mitokondri, DNA Çift Sarmalı, Nöron/Sinaps, Kalp Odacıkları & Kapakçıklar, EKG Dalga Monitörü, Böbrek/Nefron, Akciğer Alveol, Mikroçip/Wafer, PCB Devre, Op-Amp, Osiloskop, Lityum Pil/BMS, Adalet Terazisi, Hakim Tokmağı, Anayasa/Kanun Kitabı, Mühürlü İlâm, Kemer/Tonoz, Gotik Uçan Payanda, Korint Sütunu, Kubbe Kesiti, Atom Orbitali, Prizma).

### 2.3. Sıfır Piksel Bozulmalı Saf SVG Çıkartma Motoru (`PureVectorStickerizer.ts`)
- **KRİTİK KURAL:** Vektörel SVG ikonları **ASLA** `Canvas` piksellerine çevirip Flood-Fill veya morfolojik piksel genişletmeye sokma! (`"çip"` düğümündeki bozuk görüntü hatasını tamamen bitirir).
- Doğal çok renkli SVG'leri (`openmoji`, `fluent-emoji-flat`, `fluent-color`, `icon-park`, `flat-color-icons`, `logos`, `BuiltInMultiColorAtlas`) doğrudan vektörel beyaz die-cut kontur filtresi (`<filter><feMorphology in="SourceAlpha" operator="dilate" radius="3.5" .../><feFlood flood-color="#FFFFFF"/>...</filter>`) veya temiz beyaz çıkartma rozetiyle `<0.3ms` içinde Data URI olarak üret!
- Tek renkli uzmanlık SVG'lerini (`healthicons`, `game-icons`, `tabler`, `carbon`, `ph`) ise `branchColor` (dal rengi) ile uyumlu **3 katmanlı Duotone Vektör Çıkartma Kartına** (yumuşak pastel arka rozet + `%20` vurgu katmanı + koyu doygun mürekkep çizgisi + kalın `#FFFFFF` beyaz die-cut çerçeve) saf SVG string şablonuyla `<0.5ms` içinde dönüştür!

---

## 3. MİMARİ DEVRİM 2: KESİN ALAKA ARAMA MOTORU (`searchWorker.ts` — SIFIR ALAKASIZ İKON!)

`"mikroorganizma"` yazıldığında mantık kapısı, sunucu, merdiven veya baca gelmesini **%100 imkânsız** kılan arama kuralları:

1. **Arama Motorunu Web Worker'a Taşı (`src/workers/visualSearch.worker.ts`):**
   - `MiniSearch` (BM25 algoritması) Web Worker içinde çalışır; ana UI iş parçacığını `0ms` bloklar ve her harf vuruşunda **`<8ms`** içinde sonuç döner!
2. **Bileşik Kelime & Ön-Ek Çarpışma Koruması (Prefix Collision Guard):**
   - **YASAK:** 3-5 harflik kaba `substring` veya `startsWith("mikro")` eşleşmesiyle farklı kökleri birbirine karıştırmak YASAKTIR!
   - `"mikroorganizma"`, `"mikrobiyoloji"`, `"mikrop"`, `"mikroskop"`, `"mikoz"` -> **Biyoloji/Tıp kümesi** (`microbe`, `bacteria`, `virus`, `cell`, `petri`, `microscope`, `fungi`, `amoeba`, `parasite`). ASLA `"mikroçip"`, `"mikroservis"`, `"mikrodenetleyici"` ile eşleşemez!
   - `"ekokardiyografi"` -> **Kardiyoloji kümesi** (`echocardiogram`, `heart`, `ultrasound`, `cardiogram`, `pulse`). ASLA `"ekonomi"` veya `"ekoloji"` ile eşleşemez!
   - `MiniSearch` yapılandırmasında `prefix: (term) => term.length >= 4` yalnızca son yazılmakta olan yarım kelime için ve düşük ağırlıkla (`0.35`) çalışmalı; tam kelime ve taksonomi eşleşmesi `5.0x` ağırlık almalıdır.
3. **Sıkı Alaka Eşiği — Rastgele İkonla Doldurma YASAĞI (Zero Garbage Padding):**
   - Bir sorguda eşik puanının (`minScore`) altında kalan alakasız ikonları listeyi kalabalık göstermek için **KESİNLİKLE EKLEME!**
   - Bunun yerine alaka çeşitliliğini **Anlamsal Taksonomi Genişleticisi (`SemanticTaxonomyTR.ts`)** ile sağla:
     - Örn. `"mikroorganizma"` -> `["microbe", "bacteria", "virus", "bacterium", "microscope", "petri-dish", "cell", "dna", "amoeba", "fungi", "infection", "biology", "laboratory"]` kelimelerini genişleterek **yalnızca biyoloji/mikrobiyoloji** alanından 60+ gerçek, çeşitli ve %100 alakalı ikon getir!
     - Örn. `"çip"` -> `["microchip", "cpu", "processor", "integrated-circuit", "semiconductor", "wafer", "electronics", "hardware", "memory", "silicon"]` kelimelerinden 60+ gerçek donanım/elektronik ikonu getir!
4. **Bağlam Sızıntısını Önle (Context Pollution Guard):**
   - Üst düğümün (`parent`) başlığını alt düğümün arama sorgusuna ham metin olarak **EKLEME!** (`"çip"` altındaki `"mikroorganizma"` aramasına `"çip"` kelimesi eklenirse sonuçlara mantık kapısı karışır!).
   - Üst düğüm bağlamını **YALNIZCA** eş sesli kelimelerde (`"köprü"`, `"kapak"`, `"ağ"`, `"hücre"`, `"kuyruk"`, `"dalga"`, `"kilit"`, `"merkez"`) eşit puanlı sonuçların sıralamasını belirleyen hafif bir çarpan (`1.18x` boost) olarak kullan!
5. **İptal Edilebilir Online Zenginleştirme (`AbortController`):**
   - Offline sonuçlar `<8ms` içinde anında şeride yerleşir (`debounce` sadece `16ms` — yani tek kare!).
   - Eğer cihaz internete bağlıysa (`navigator.onLine`), arka planda `ARASAAC`, `Wikimedia` ve `Openverse` istekleri ayrı bir `AbortController` ile çalışır; yeni harf basıldığı anda eski HTTP istekleri `controller.abort()` ile derhal öldürülür ve geç gelen hiçbir eski yanıt ekrana yazılamaz (`requestSeqId` kontrolü).

---

## 4. MİMARİ DEVRİM 3: 60/120 FPS SIFIR TİTREME (ZERO-JITTER) TUVAL & SÜRÜKLEME MOTORU

Düğüm taşırken veya haritayı kaydırırken oluşan titremeyi (`jitter`) ve takılmayı tamamen yok etmek için `CanvasStage.tsx` ve `InfiniteViewport.ts` mimarisini şu kurallarla yeniden yaz:

1. **Sürükleme Sırasında Sıfır React Re-Render (Transient Drag Pattern):**
   - `pointerdown` anında `e.currentTarget.setPointerCapture(e.pointerId)` çağrısı **sabit ana sahne kapsayıcısı (`stageRef`)** üzerinde yapılır (asla hareket eden düğümün kendi üzerinde değil!).
   - Başlangıç koordinatları bir kez kaydedilir:
     `startScreenX = e.clientX`, `startScreenY = e.clientY`
     `startNodeWorldX = node.x`, `startNodeWorldY = node.y` (ve alt-ağaç taşınıyorsa tüm alt düğümlerin başlangıç `{x, y}` haritası!).
   - `pointermove` boyunca **`setDocument` / `useState` ÇAĞRILMAZ!**
   - Bunun yerine `transientPositionsRef.current` güncellenir, tek bir `requestAnimationFrame` döngüsü içinde:
     - Taşınan düğüm (ve alt dalları) DOM elemanlarının `style.transform = translate3d(${worldX}px, ${worldY}px, 0)` değeri doğrudan güncellenir,
     - Canvas üzerindeki organik Bezier dalları ve çapraz oklar yeniden çizilir.
   - `pointerup` / `pointercancel` anında son konum tek seferde React state'ine, Undo geçmişine ve `IndexedDB`'ye kaydedilir!
2. **CSS `transition` Kilidi (Titremenin 1 Numaralı Sebebi!):**
   - Sahne üzerinde sürükleme, kaydırma veya yakınlaştırma aktifken (`data-interacting="true"`), düğüm kapsayıcılarında ve dünya katmanında **`transition: none !important`** kuralı zorunlu uygulanır. Yalnızca "Otomatik Düzen (`Düzenle`)" butonuna basıldığında `320ms cubic-bezier(0.22, 1, 0.36, 1)` animasyonu geçici olarak açılır.
3. **Birleşik GPU Dünya Katmanı (`WorldTransformLayer`):**
   - Her düğümü ayrı ayrı ekran pikseline çarpıp yuvarlamak yerine, tüm DOM düğümlerini tek bir `<div className="world-dom-layer" style={{ transform: 'translate3d(panX, panY, 0) scale(zoom)', transformOrigin: '0 0' }}>` içine yerleştir; düğümler kendi dünya koordinatlarında (`translate3d(node.x, node.y, 0)`) dursun. Böylece yakınlaştırma/kaydırma sırasında Canvas ile DOM arasında **0.0 piksel kayma** olur!
4. **Akıllı Alt-Ağaç Taşıma (Subtree Drag) + Tek Düğüm Modu:**
   - Bir ana dalı sürüklerken alt dallarının geride kalıp dalları spagetti gibi bükeceği sorunu çöz: Varsayılan olarak bir düğüm sürüklendiğinde **kendisine bağlı alt dallar da onunla birlikte pürüzsüzce kaysın** (`Alt` tuşu basılıysa veya üstteki mini anahtarla sadece tek düğüm taşınsın).
5. **Şablon Alt-Başlık (`subtitle`) Temizliği:**
   - Kullanıcı bir şablon düğümünün ana başlığını tamamen değiştirdiğinde (örneğin `"Kardiyoloji"` başlığını `"çip"` yaptığında), şablondan kalan alakasız `subtitle` (`"Kardiyoloji De..."`) otomatik temizlensin veya kullanıcı tarafından tek tıkla düzenlenebilsin!

---

## 5. MİMARİ DEVRİM 4: WEB WORKER FOTOĞRAF KESİMİ & BOZUK ÇIKARTMA TAMİRİ

1. **`src/workers/stickerProcessor.worker.ts` (`OffscreenCanvas`):**
   - Kamera/galeri fotoğrafları, `📷 Nottan Kes` ve AI tarafından üretilen raster görseller **yalnızca Web Worker içinde** işlenir; ana ekran asla donmaz.
2. **Şema / Diyagram Koruması (Bozuk `"çip"` Görseli Çözümü):**
   - Worker görüntüyü analiz eder: Eğer görsel ince çizgili bir teknik şema, devre diyagramı, EKG veya metin/kesit çizimiyse (yüksek iç beyaz oranı + ince kenar yoğunluğu), iç beyazları kemiren Flood-Fill **UYGULANMAZ**; görsel kontrastı netleştirilip etrafına temiz, yuvarlatılmış **Beyaz Die-Cut Kağıt Çıkartma Kartı + Gölge** sarılarak %100 okunaklı korunur!
   - Yalnızca izole nesne/fotoğraflarda 4 köşeden BFS Flood-Fill + yumuşak kenar + beyaz die-cut kontur uygulanır.
3. **Bozuk Kayıt Otomatik İyileştirici (Auto-Heal Migration):**
   - Uygulama açılışında eski sürümden kalma bozuk/boş çıkartmaları tespit edip düğüm başlığına en uygun temiz vektör çıkartmayla otomatik yenileyen bir onarım adımı çalıştır.

---

## 6. TAM RESPONSIVE MOBİL, TABLET & MASAÜSTÜ DENEYİMİ + EKSTRA SÜPER ÖZELLİKLER

Ekran görüntüsünde `KeyboardVisualBar` içindeki `📷 Nottan Kes` butonunun ve son ikonun sağdan kesildiği hatayı gider ve tüm ekran boyutlarında kusursuzlaştır:

1. **Taşmasız 3 Kademeli `KeyboardVisualBar`:**
   - **Masaüstü (`>=1024px`):** Genişliği `min(720px, calc(100vw - 32px))` olan, ekran kenarlarından taşması matematiksel olarak engellenmiş (`clamp` pozisyonlu), hiçbir butonu kesilmeyen 2 temiz satırlı yüzen panel + sol/sağ kaydırma okları + yatay tekerlek (`wheel`) kaydırma desteği.
   - **Tablet (`768px–1023px`):** Sanal klavye veya ekran alt güvenli alanına (`safe-area-inset-bottom`) kenetlenen, `48px` dokunma hedefli, kalem (Apple Pencil/Stylus) dostu geniş şerit.
   - **Mobil Telefon (`<768px`):** Klavye üstüne tam genişlikte (`100vw`) oturan kompakt alt çekmece; üst satır yatay kaydırılabilir mod/aksiyon hapları, alt satır akıcı parmak karuseli ve yukarı kaydırınca açılan tam ekran **`+150 Görsel` Çıkartma Galerisi**.
2. **Tam Responsive `TopMinimalHUD` ve Mobil Alt Hızlı Aksiyon Hapı:**
   - Dar ekranlarda üst bardaki butonlar asla üst üste binmez veya ekran dışına taşmaz; mobilde ikincil araçlar şık bir `⋯ Araçlar` menüsünde toplanır ve ekranın altında tek başparmakla erişilen **`[+ Yeni Dal]` `[🪄 Düzenle]` `[🎯 Merkez]` `[🔍 İkon Ara]`** hızlı kontrol hapı yer alır.
3. **Organik "Kutusuz Çıkartma Dalı" vs "Kart" Görünüm Seçeneği:**
   - Klasik zihin haritası estetiği için düğümlerde ister **Yüzen Büyük Çıkartma + Kutusuz Kalın Başlık (Organik Defter Stili)** ister **Modern Kart Stili** seçilebilsin ve çıkartma boyutu (`S / M / L / XL`) tek tıkla büyütülebilsin!
4. **Hızlı Klavye & Komut Paleti (`Cmd/Ctrl + K`):**
   - `Tab`: Alt dal ekle | `Enter`: Kardeş dal ekle | `Delete/Backspace`: Düğümü sil | `Space + Sürükle`: Tuvali kaydır | `Cmd/Ctrl + Z / Y`: Geri/İleri al | `Cmd/Ctrl + K`: Herhangi bir düğüme veya ikona anında zıplayan Hızlı Komut & İkon Arama Paleti!
5. **%100 Offline PWA Kurulumu (`vite-plugin-pwa`):**
   - Service Worker tüm uygulama dosyalarını ve `public/offline-packs/` altındaki yerel ikon şardlarını önbelleğe alır; üst HUD'da zarif bir çevrimdışı/hazır göstergesi bulunur.

---

## 7. ZORUNLU OTOMATİK TEST BETİĞİ VE CANLI QA KAPISI (BU GEÇMEDEN TESLİM ETME!)

İşi tamamladım demeden önce şu 3 doğrulamayı **bizzat çalıştırıp sıfır hatayla geçirmek zorundasın**:

1. **Otomatik Alaka & Hız Doğrulama Betiği (`scripts/verify-search-relevance.mjs`):**
   - Bu Node betiğini yaz ve `npm run verify:search` olarak çalıştır. Betik **internet kullanmadan (sadece yerel offline şardlarla)** şu 20 Türkçe sorguyu test etmelidir:
     `"mikroorganizma"`, `"bakteri"`, `"virüs"`, `"çip"`, `"ekokardiyografi"`, `"mitral kapak"`, `"oskültasyon"`, `"yük dengeleyici"`, `"veritabanı"`, `"api gateway"`, `"op-amp"`, `"pil batarya"`, `"istinaf mahkemesi"`, `"anayasa"`, `"uçan payanda"`, `"kemer tonoz"`, `"osmanlı"`, `"deprem"`, `"dna gen"`, `"yapay sinir ağı"`.
   - **Kesin Kriter:** Her sorgu `<15ms` altında en az `20+` sonuç döndürmeli; `"mikroorganizma"` sorgusunun ilk 20 sonucunda **HİÇBİR** sunucu, mantık kapısı, çip, merdiven veya baca ikonu bulunmamalı (bulunursa `process.exit(1)` ile hata fırlatmalı!).
2. **Üretim Derlemesi (`npm run build`):**
   - `prebuild` offline şard derleyicisi + `tsc` + `vite build` + `vite-plugin-pwa` Service Worker üretimi **0 hata** ile tamamlanmalıdır.
3. **Canlı Tarayıcı Testi (`375x812` Mobil, `820x1180` Tablet, `1440x900` Masaüstü):**
   - Bir düğüme `"mikroorganizma"` yazıldığında anında mikroskop, bakteri, virüs, petri kabı, hücre ikonlarının geldiğini; `"çip"` yazıldığında temiz mikroçip/CPU çıkartmalarının geldiğini; sürükleme esnasında titremenin 0 olduğunu ve yüzen şeritte hiçbir butonun kesilmediğini tarayıcıda bizzat doğrula!
