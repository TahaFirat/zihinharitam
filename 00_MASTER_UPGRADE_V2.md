# GÖRSEL ZİHİN HARİTASI — V2 MEGA GÜÇLENDİRME VE KUSURSUZLAŞTIRMA PROMPTU

> **Rol ve Görev:** Sen Kıdemli bir Görsel Arama Motoru Mimarı, Grafik/Canvas Mühendisi ve Ürün Tasarımcısısın. Mevcut projede (`src/core/canvas/*`, `src/core/visuals/*`, `src/components/*`, `src/data/academicTemplates.ts`) tuval iskeleti çalışıyor; ANCAK **görsel/ikon çeşitliliği çok yetersiz kalıyor**, **AI çıkartma üretimi kalitesiz/sahte veya anlamsız sonuçlar veriyor** ve **uygulama haritanın konusunu kendi algılayıp proaktif görsel/alt-dal öneremiyor**.
>
> Görevin; mevcut çalışan tuval ve senkronizasyon mimarisini bozmadan, görsel motorunu, bağlam zekâsını, AI üretim boru hattını ve sistem tasarımı / akademik haritalama yeteneklerini **dünya standardında, kusursuz çalışan bir V2 sürümüne** yükseltmektir.

---

## 1. TEŞHİS EDİLEN HATALAR VE KESİN YASAKLAR (BUNLARI TAMAMEN TEMİZLE!)

Mevcut kod tabanındaki (`SemanticConceptEngine.ts`, `OpenLibraryAdapters.ts`, `AIStickerService.ts`, `DieCutStickerProcessor.ts`, `KeyboardVisualBar.tsx`) şu zayıflıkları tespit et ve **tamamen kaldır**:

1. **YASAK 1 — Sahte/Prosedürel "AI Çizim" Hilesi Yasak:** `AIStickerService.ts` içinde metnin hash'ini alıp rastgele daireler, Bezier lekeleri, geometrik şekiller veya kutu içine yazı yazarak "AI çıkartma ürettim" gibi davranan her türlü prosedürel SVG/Canvas uydurmasını **DERHAL SİL**.
2. **YASAK 2 — Ham Türkçe Sorguyu İngilizce İkon API'sine Göndermek Yasak:** Kullanıcının yazdığı `"Mitral kapak"`, `"İstinaf"`, `"Yük dengeleyici"`, `"Uçan payanda"` gibi Türkçe terimleri çevirmeden ve somut görsel metaforlara (visual proxy) genişletmeden doğrudan Iconify/Wikimedia'ya göndermek 0 veya alakasız 2 sonuç döndürür. Her sorgu çok katmanlı kavram genişleticiden geçmek zorundadır.
3. **YASAK 3 — Siyah-Beyaz Ruhsuz İkonları Olduğu Gibi Basmak Yasak:** Tek renkli (`currentColor` / `#000000`) düz çizgi ikonları haritaya çıplak siyah silüet olarak koymak yasaktır. Tek renkli teknik/akademik vektörler mutlaka **`DuotoneStickerColorizer`** boru hattından geçirilerek dalın rengiyle uyumlu **3 katmanlı renkli çıkartmaya** (yumuşak pastel gövde dolgusu + koyu mürekkep kontur + vurgu tonu + beyaz die-cut kesim çerçevesi) dönüştürülecektir.
4. **YASAK 4 — Küresel Beyaz Piksel Silme Hatası Yasak:** `DieCutStickerProcessor.ts` içinde `if (r > 240 && g > 240 && b > 240) alpha = 0` gibi tüm görseldeki beyazları silen ilkel eşikleme kullanma! Bu yöntem göz akını, kemikleri, dişleri, hukuk parşömenlerini, bulutları ve beyaz laboratuvar önlüklerini deler. Sadece **4 köşeden başlayan BFS (Breadth-First Search) Flood-Fill Kenar Maskeleme** kullanılacaktır.
5. **YASAK 5 — 30-50 Kelimelik Dar Sözlükle Yetinmek Yasak:** Sadece şablonlardaki kelimeleri tanıyan göstermelik sözlükler yasaktır. Herhangi bir konudaki binlerce terim için **her aramada en az 30–80 arası zengin, renkli ve alakalı görsel** dönecektir.

---

## 2. OTONOM KONU & BAĞLAM ZEKÂSI (`src/core/visuals/TopicContextIntelligence.ts`)

Uygulama, kullanıcının bölüm seçmesine gerek kalmadan haritadaki **Kök Düğüm (Root) -> Üst Dallar (Ancestors) -> Kardeş Dallar (Siblings) -> Aktif Düğüm** grafiğini anlık analiz ederek konuyu kendi algılamalıdır:

### 2.1. Otomatik Disiplin ve Bağlam Tespiti
Haritadaki kelimelerden ağırlıklı skorlama yaparak aktif disiplini gerçek zamanlı belirle ve `KeyboardVisualBar` üstünde zarif bir hap olarak göster (ör. `🧠 Bağlam: Sistem Tasarımı & Bulut`, `🧠 Bağlam: Kardiyoloji & Anatomi`, `🧠 Bağlam: Ceza & Medeni Hukuk`, `🧠 Bağlam: Mimarlık & Yapı Statiği`):
- Desteklenecek Ana Disiplin Profilleri:
  1. `system_design_cs` (Yazılım Mimarisi, Dağıtık Sistemler, Ağlar, Bulut, Veritabanı, AI/ML)
  2. `electronics_robotics` (Gömülü Sistemler, Devreler, Mikrodenetleyici, Sensör, Haberleşme/RF, Kontrol)
  3. `medicine_biology` (Anatomi, Fizyoloji, Patoloji, Farmakoloji, Histoloji, Biyokimya, Klinik)
  4. `law_governance` (Anayasa, Ceza, Medeni, İdare, Ticaret Hukuku, Yargılama, Uluslararası İlişkiler)
  5. `architecture_civil` (Mimari Tasarım, Sanat Tarihi, Yapı Elemanları, Statik, Şehir Planlama)
  6. `exact_sciences` (Fizik, Kimya, Matematik, Sayısal Yöntemler, Termodinamik)
  7. `humanities_social` (Tarih, Coğrafya, Edebiyat, Felsefe, Psikoloji, Sosyoloji)
  8. `business_economics` (Finans, Borsa, Mikro/Makro İktisat, Pazarlama, İşletme, Lojistik)

### 2.2. Eş Sesli ve Çok Anlamlı Kelime Çözümleyici (Contextual Disambiguation)
Aynı kelime farklı haritalarda tamamen farklı görseller getirmelidir:
- `"Köprü"` -> `system_design_cs` içinde **Network Bridge / Switch**, `architecture_civil` içinde **Asma/Kemer Köprü**, `medicine_biology` içinde **Pons / Diş Köprüsü**.
- `"Kapak"` -> `medicine_biology` içinde **Kalp Kapakçığı (Heart Valve)**, `electronics_robotics` içinde **Muhafaza/Valf**, genel bağlamda **Kitap/Şişe Kapağı**.
- `"Kemer"` -> `architecture_civil` içinde **Mimaride Kemer/Tonoz (Arch/Vault)**, genel bağlamda **Bel Kemeri**.
- `"Ağ"`, `"Hücre"`, `"Kuyruk (Queue)"`, `"Yük (Load)"`, `"Dava"`, `" Akım"`, `"Dalga"` gibi tüm teknik terimleri aktif harita bağlamına göre anlamlandır.

### 2.3. Soyut Kavram -> Somut Görsel Metafor (Visual Proxy) Motoru
Soyut akademik kavramların doğrudan resmi olmaz; bunları somut görsel nesnelere eşle:
- `"İstinaf"` / `"Temyiz"` -> `["scales of justice", "judge gavel", "courthouse", "legal scroll", "wax seal", "law book"]`
- `"Gecikme (Latency)"` -> `["stopwatch", "lightning bolt", "speedometer", "hourglass", "fast network"]`
- `"Ölçeklenebilirlik (Scalability)"` -> `["server cluster", "expanding arrows", "cloud network", "modular blocks", "growth chart"]`
- `"Homeostaz"` -> `["balance scale", "thermometer", "human body equilibrium", "water drop", "heartbeat"]`
- `"Enflasyon"` -> `["rising price chart", "banknote", "shopping basket", "percentage arrow up", "coins"]`

### 2.4. Daha Harf Yazmadan "Proaktif Alt Dal + İkon" Önerisi (Zero-Keystroke Prediction)
- Kullanıcı bir düğümden (`+` tutamacından) yeni bir dal çekip bıraktığı anda, **input henüz boşken bile** üst düğümün konusuna göre **6–8 adet hazır alt konu + eşleşmiş renkli çıkartma** öner!
- Örnek: Üst düğüm `"Sistem Tasarımı (System Design)"` ise yeni dal açıldığı an şeritte tek tıkla eklenebilir hazır öneri çipleri belirmeli:
  `[⚖️ Load Balancer]` `[⚡ Redis Önbellek]` `[🌐 CDN Dağıtım]` `[🗄️ Veritabanı Sharding]` `[📨 Mesaj Kuyruğu (Kafka)]` `[🛡️ API Gateway]`
- Örnek: Üst düğüm `"Kalp Anatomisi"` ise: `[🫀 Mitral Kapak]` `[🩸 Aort Damarı]` `[⚡ Sinoatriyal Düğüm]` `[🫁 Pulmoner Arter]` `[💪 Miyokard]`.
- Kullanıcı bu çiplerden birine dokunduğunda **hem dalın adı yazılır hem de renkli çıkartması anında dala yerleşir!**

### 2.5. Çok Dilli Canlı Kavram Köprüsü (Türkçe Kök Çözümleyici + Wikipedia/Wikidata Çapraz Dil API)
1. **Türkçe Morfolojik Ek Soyucu:** Kelime sonundaki çekim ve yapım eklerini (`-ler/-lar`, `-in/-ın/-un/-ün`, `-de/-da`, `-den/-dan`, `-si/-sı`, `-i/-ı`, `-lik/-lık`) soyarak kökü bul (`"kapakçıkları"` -> `"kapakçık"` / `"kapak"`).
2. **Geniş Yerel Akademik Ontoloji (`AcademicOntologyTR.ts`):** En az 800+ çekirdek akademik/teknik Türkçe kavramın İngilizce karşılıklarını ve görsel metafor etiketlerini çevrimdışı `0ms` hızında tut.
3. **Canlı Wikipedia & Wikidata Çapraz Dil Çözücü (`CrossLingualWikiBridge.ts`):** Yerel sözlükte olmayan en uç Türkçe terimler için (ör. `"Kardiyak Tamponad"`, `"Tımar Sistemi"`, `"evrişimli sinir ağı"`, `"Gotik uçan payanda"`):
   - `https://tr.wikipedia.org/w/api.php?action=query&list=search&srsearch={term}&srlimit=3&format=json&origin=*` ile Türkçe maddeyi bul,
   - Aynı istek veya takip eden `prop=langlinks|pageimages&lllang=en&pithumbsize=400&origin=*` çağrısıyla **tam İngilizce akademik karşılığını** (`Flying buttress`, `Cardiac tamponade` vb.) ve varsa **ansiklopedik şemasını/görselini** `<150ms` içinde çekip `IndexedDB` içine kalıcı önbellekle!

---

## 3. 8 KAYNAKLI FEDERATİF GÖRSEL MOTORU VE `systemdesign.io` MİMARİ PAKETİ

Her aramada en az **40 ila 100+ yüksek kaliteli, renkli çıkartma** döndürmek için `VisualSearchOrchestrator.ts` içinde şu **8 kaynağı paralel (`Promise.allSettled`) ve kademeli akış (streaming)** olarak çalıştır:

### Kaynak 1: `SystemDesignVisualPack.ts` (`systemdesign.io` Kalitesinde Yerleşik Sistem & Mühendislik Mimarisi Kütüphanesi)
`https://systemdesign.io/` estetiğinden ilham alan, **sıfır ağ gecikmeli (yerleşik), çok renkli, izometrik derinlikli ve temiz konturlu 65+ özel SVG mimari çıkartma bileşeni** oluştur. Her biri katmanlı gradyanlara, net ikonografiye ve beyaz die-cut çerçeveye sahip olmalıdır:
- **Ağ & Trafik:** `Load Balancer (L4/L7)`, `API Gateway`, `Reverse Proxy (Nginx)`, `CDN Edge Network`, `DNS Resolver`, `WAF / Firewall Shield`, `Rate Limiter`, `NAT / Router`, `VPC Cloud`, `WebSocket Bi-Directional`, `gRPC / REST / GraphQL`.
- **Veri & Depolama:** `SQL Primary DB`, `Read Replica DB`, `Sharded Database Cluster`, `NoSQL Document Store`, `Redis In-Memory Cache`, `Time-Series DB`, `Graph DB`, `Vector Database (pgvector/FAISS)`, `Object Storage Bucket (S3)`, `Data Warehouse / Lake`, `Search Engine Index (Elastic)`.
- **Hesaplama & Mesajlaşma:** `Microservice Node`, `Serverless Function`, `Kubernetes Cluster / Pod`, `Docker Container`, `Kafka Event Stream`, `Message Queue (RabbitMQ/SQS)`, `Pub/Sub Broker`, `Cron / Background Worker`, `Circuit Breaker`.
- **AI, Donanım & Elektronik:** `LLM / Transformer Node`, `Neural Network Layers`, `GPU Compute Cluster`, `Client Mobile / Tablet / Web`, `IoT Edge Sensor`, `Microcontroller (MCU/Arduino)`, `Op-Amp Amplifier`, `Logic Gates (AND/OR/XOR)`, `PCB Circuit`, `Battery / BMS Pack`, `Servo / Actuator`, `RF Antenna / SDR Signal`, `Telemetry Drone / UAV`.

### Kaynak 2: ARASAAC Çok Renkli Eğitsel El Çizimi API (`ArasaacPictogramAdapter.ts`)
- Zihin haritası estetiğine birebir uyan (kalın siyah mürekkep dış hat + canlı renkli dolgu) **13.000+ açık eğitsel illüstrasyon** sunar ve CORS açıktır!
- Hem Türkçe `https://api.arasaac.org/v1/pictograms/tr/search/{encodeURIComponent(trQuery)}` hem de İngilizce `https://api.arasaac.org/v1/pictograms/en/search/{encodeURIComponent(enQuery)}` uç noktalarını sorgula.
- Dönen `_id` değerlerinden yüksek çözünürlüklü şeffaf PNG URL'sini üret: `https://static.arasaac.org/pictograms/${id}/${id}_500.png`.

### Kaynak 3: Iconify Çok Renkli (Multi-Color) Çıkartma ve Teknoloji Logoları (`IconifyColorAdapter.ts`)
- `https://api.iconify.design/search?query=${encodeURIComponent(enToken)}&prefixes=openmoji,fluent-emoji,fluent-emoji-flat,noto,twemoji,icon-park,flat-color-icons,fxemoji,streamline-emojis,logos,devicon,skill-icons,vscode-icons&limit=64`
- Özellikle `openmoji` (4.200+ el çizimi konturlu renkli çıkartma), `icon-park` (2.600+ çok renkli teknik/iş/tıp/mimarlık ikonu), `fluent-emoji` (3D/renkli) ve `logos`/`devicon`/`skill-icons` (tüm yazılım ve sistem tasarımı teknolojileri) setlerine öncelik ver.

### Kaynak 4: Uzmanlık Vektör Setleri + Otomatik 3-Tonlu Renkli Çıkartma Dönüştürücü (`DuotoneStickerColorizer.ts`)
- Tıp (`healthicons` — 1.500+ anatomi, klinik, cerrahi, ilaç ikonu), ansiklopedik figürler (`game-icons` — 4.100+ detaylı nesne, organ, terazi, dişli, kale, kemer, iksir, devre, silah, doğa ikonu), sistem/kurumsal (`carbon`, `mdi`, `ph`, `lucide`, `tabler`) için Iconify araması yap:
  `https://api.iconify.design/search?query=${encodeURIComponent(enToken)}&prefixes=healthicons,game-icons,carbon,ph,lucide,tabler,mdi&limit=64`
- **KRİTİK İŞLEM (`DuotoneStickerColorizer`):** Bu kaynaklardan gelen tek renkli SVG'leri **ASLA siyah-beyaz bırakma!** SVG metnini çekip dinamik olarak:
  1. Arka planına dalın renginden türetilmiş yumuşak pastel bir çıkartma rozeti (`rx="24"` yuvarlatılmış rozet veya organik kontur dolgusu, ör. `%16` opaklıkta dal rengi + sıcak krem taban),
  2. İkon çizgilerine ve dolgularına dal renginin koyu doygun mürekkep tonu + ikincil vurgu tonu (duotone),
  3. En dışına da kalın beyaz (`#FFFFFF`) die-cut çıkartma çerçevesi ve gölge ekle!
  Böylece **200.000+ teknik ve tıbbi ikon**, haritanın renk paletiyle %100 uyumlu canlı çıkartmalara dönüşür!

### Kaynak 5: Bileşik Kavram Çıkartma Bestecisi (`CompositeStickerComposer.ts`)
- Kullanıcı sıfat + isim veya eylem + nesne içeren bir kavram yazdığında (*"Şifreli Veritabanı"*, *"Dağıtık Önbellek"*, *"Reddedilen Dava"*, *"Akut Kalp Yetmezliği"*, *"Kablosuz Sensör"*), ana nesne çıkartmasının sağ alt köşesine anlamlı bir **mikro-rozet** (`🔒`, `⚡`, `❌`, `✅`, `🚨`, `📡`, `🔄`, `⚖️`) entegre ederek bileşik çıkartma adayları da üret ve öneri listesine ekle!

### Kaynak 6: Wikimedia Commons Akademik SVG Atlas & Şema Adaptörü (`WikimediaAtlasAdapter.ts`)
- `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(enQuery + ' filetype:svg')}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=400&format=json&origin=*`
- Tıp için *Servier Medical Art / Blausen / Gray's Anatomy*, mühendislik için devre ve blok şemaları, mimarlık için kesit/plan çizimleri, hukuk ve tarih için arma/harita SVG'lerini doğrudan getirir.

### Kaynak 7: Openverse (700M+ Açık Lisanslı İllüstrasyon & Fotoğraf) (`OpenverseAdapter.ts`)
- `https://api.openverse.org/v1/images/?q=${encodeURIComponent(enQuery)}&page_size=20` (İllüstrasyon modunda `&category=illustration`, Fotoğraf modunda `&category=photograph` parametresiyle) anonim ve CORS uyumlu olarak zengin görseller çeker.

### Kaynak 8: Akademik Görsel Atlaslar (Hukuk, Tıp, Mimarlık, Temel Bilimler Yerleşik Vektör Seti)
- İnternet kesik olsa bile her disiplinin en temel 40'ar ikonik sembolünü (Terazi, Tokmak, Anayasa, Mahkeme, Dosya, Mühür; Kalp, Beyin, Akciğer, Nefron, Nöron, DNA, Mikroskop, Stetoskop; Korint Sütunu, Kemer, Kubbe, Uçan Payanda, Kesit Plan, Pergel; Atom, Prizma, İntegral, Matris, Üラス/Erlenmayer) çok renkli SVG olarak yerleşik paketle.

---

## 4. GERÇEK KALİTEDE AI ÇIKARTMA STÜDYOSU VE KÖŞE FLOOD-FILL KESİM (`AIStickerDirector.ts`)

Kullanıcı **`✨ AI Çiz`** butonuna bastığında "mal gibi" uyduruk şekiller veya bozuk yazılar çıkmasını %100 engelleyen yeni mimari:

### 4.1. Sanat Yönetmeni (Visual Art Director) Prompt Derleyicisi
Kullanıcının yazdığı Türkçe/teknik başlığı doğrudan görsel modele gönderme! Önce `TopicContextIntelligence` üzerinden somut İngilizce görsel sahneye çevir ve seçilebilir **4 Çizim Stili** sun:
1. **`El Çizimi Çıkartma` (Varsayılan):**
   `"Single clean die-cut sticker illustration of {CONCRETE_ENGLISH_VISUAL_SUBJECT}, charming educational hand-drawn editorial vector style, crisp dark ink outlines, vibrant watercolor and marker shading, centered full object with generous white margin, isolated on pure solid #FFFFFF white background, zero text, no words, no letters, no labels, no numbers, no watermark"`
2. **`3D İzometrik / Sistem İkonu` (`systemdesign.io` / 3D tarzı):**
   `"Single cute isometric 3D icon of {CONCRETE_ENGLISH_VISUAL_SUBJECT}, smooth matte clay and glossy plastic materials, clean studio lighting, centered object isolated on pure solid #FFFFFF white background, zero text, no letters, no labels"`
3. **`Akademik / Tıbbi Atlas Çizimi`:**
   `"Clean scientific textbook illustration of {CONCRETE_ENGLISH_VISUAL_SUBJECT}, detailed anatomical or technical cross-section, vivid clean color coding, isolated on pure solid #FFFFFF white background, no text labels, no letters, no watermark"`
4. **`Minimalist Flat Rozet`:**
   `"Modern flat multi-color vector emblem of {CONCRETE_ENGLISH_VISUAL_SUBJECT}, geometric clean shapes, bold harmonious palette, isolated on pure solid #FFFFFF white background, no text, no letters"`

### 4.2. Çoklu Sağlayıcı (Multi-Provider BYOK + Sıfır Ayarlı Flux Çalıştırıcı) & 4'lü Aday Seçimi
- Üst barda veya AI penceresinde küçük bir **`⚙️ AI Motoru`** ayarı sun:
  - Varsayılan (Anahtarsız Anında Çalışan): Yüksek kaliteli `Flux` uç noktası (`model=flux`, `width=512&height=512`, `nologo=true`, `enhance=false`, farklı `seed` değerleriyle paralel **4 farklı aday görsel** üretir; böylece kullanıcı tek bir kötü sonuca mahkûm olmaz, 4 adaydan en beğendiğini tek tıkla seçer veya `"🔄 Yeni Varyasyonlar"` der!).
  - Opsiyonel API Anahtarı Desteği (`localStorage` üzerinde güvenli yerel kayıt): **Google Gemini (`gemini-2.5-flash-image` / Imagen 3)**, **OpenAI (`gpt-image-1` / `dall-e-3`)**, **Fal.ai (`fal-ai/flux/schnell`)** veya **Together AI (`black-forest-labs/FLUX.1-schnell`)** anahtarı girildiğinde doğrudan o motoru kullanır.
- Görsel yüklenirken sahte rastgele SVG çizmek yerine şık bir iskelet (shimmer) yükleyici göster; eğer ağ hatası olursa kullanıcıya dürüstçe bildirip en yakın 8 federatif vektör/illüstrasyon çıkartmasını alternatif olarak sun.

### 4.3. Köşeden Tohumlamalı Flood-Fill Arka Plan Silici (`DieCutStickerProcessor.ts` V2)
- Görselin 4 köşesinden (`(0,0)`, `(w-1,0)`, `(0,h-1)`, `(w-1,h-1)`) ve kenar piksellerinden başlayan **BFS (Breadth-First Search) Flood-Fill** algoritması kur (renk toleransı `deltaE <= 28` + `2px` yumuşak kenar yumuşatma / anti-aliased feathering).
- Böylece arka plandaki düz beyaz %100 şeffaf olurken, koyu mürekkep konturun **içinde kalan beyaz bölgeler** (göz akı, kemik, diş, kağıt, bulut, mermer sütun) **kesinlikle korunur ve delinmez!**
- Ardından temizlenen alfa maskesine `8px` morfolojik genişletme (dilation) uygulayarak pürüzsüz `#FFFFFF` beyaz die-cut çıkartma konturu ve kağıt gölgesi ekle.

---

## 5. KULLANICI DENEYİMİNİ ZİRVEYE TAŞIYAN YENİ ÖZELLİKLER (SIFIR MENÜ KALABALIĞI KORUNARAK!)

1. **Genişletilebilir "Sonsuz Çıkartma Galerisi" Çekmecesi (`src/components/StickerGalleryDrawer.tsx`):**
   - `KeyboardVisualBar` içindeki yatay şeritte ilk 14 görsel anında akarken, şeridin sağındaki **`🔍 +80 Görsel`** butonuna basıldığında ekranın alt yarısında (masaüstünde şık bir yüzen panel olarak) **Sonsuz Çıkartma Galerisi** açılır.
   - İçinde:
     - **Görsel Metafor Hapları:** (Örn. `"İstinaf"` için `[⚖️ Terazi]`, `[🔨 Tokmak]`, `[🏛️ Mahkeme]`, `[📜 Karar İlâmı]`, `[印 Mühür]`) — tıklanınca o metaforun onlarca ikonunu getirir.
     - **Kaynak/Tarz Filtreleri:** `Tümü`, `El Çizimi`, `Sistem Mimarisi`, `3D & Emoji`, `Tıbbi/Teknik`, `Fotoğraf`, `Şema`.
     - **Renk Uyumu Anahtarı:** `"Dal Rengine Uydur"` açıkken tüm duotone çıkartmalar aktif dalın rengine bürünür.
     - **Köşe Rozeti Ekle:** Seçilen herhangi bir çıkartmanın köşesine tek tıkla `🔒`, `⚡`, `✅`, `❌`, `⚠️`, `🔥`, `1️⃣`, `2️⃣` rozeti iliştirme.

2. **Dallar Arası Animasyonlu Çapraz İlişki Okları (`src/core/canvas/CrossLinkRenderer.ts`):**
   - Özellikle `systemdesign.io` mimari diyagramlarında (ör. *API Gateway -> Auth Service*, *Worker -> S3*), tıpta (*Renin -> Anjiyotensin*) ve hukukta (*İlk Derece -> İstinaf -> Yargıtay*) iki farklı dal arasında ilişki kurmak şarttır!
   - Seçili bir düğümde çıkan küçük **`🔗 İlişki Çek`** ikonuyla başka herhangi bir düğüme kesikli, akış animasyonlu (marching ants) zarif bir eğri ok çekilebilsin ve okun ortasındaki hap etikete ilişki adı (`"gRPC"`, `"tetikler"`, `"önbelleğe yazar"`, `"temyiz"`) yazılsın.

3. **Tek Tıkla "🪄 Alt Dalları Öner" ve "📄 Ders Notundan Otomatik Zihin Haritası Kur" (`src/components/SmartMapGeneratorModal.tsx`):**
   - **Alt Dal Önerici (`🪄`):** Herhangi bir düğüm seçildiğinde, `TopicContextIntelligence` o konunun 5 mantıklı alt başlığını **her birinin renkli çıkartması hazır seçilmiş şekilde** önerir; öğrenci ister tek tek ister `"Tümünü Ekle"` ile saniyede dallandırır.
   - **Metinden / Konudan Harita Kurucu (`📄 Metin -> Harita`):** Üst minimal HUD barındaki küçük sihirli sayfa ikonuna basıldığında; öğrenci ders slaytından bir paragraf, madde işaretli not veya sadece bir konu başlığı (ör. *"Mikroservis Mimarisi ve Ölçekleme"* veya *"Kraniyal Sinirler"*) yazar. Sistem metni hiyerarşik dallara ayırır, radyal düzene dizer ve **her bir düğüm için Federatif Görsel Motorundan en uygun renkli çıkartmayı otomatik bulup yerleştirir!**

4. **Teknik / Akademik Mikro-Etiket ve Formül Rozeti + Mini-Harita Radarı:**
   - Düğüm başlığının altına isteğe bağlı kompakt bir teknik rozet (`Port 443 • HTTPS`, `O(log N)`, `CMK m.272`, `V = I·R`) eklenebilsin.
   - Sağ alt köşede sadece harita büyüdüğünde beliren, tek dokunuşla açılıp kapanan yarı saydam **Mini-Harita (Radar)** ve `%40` altı uzaklaştırmada yaprak kalabalığını sadeleştiren **Anlamsal Yakınlaştırma (Semantic Zoom LOD)** bulunsun.

5. **Zenginleştirilmiş 5 Başlangıç Şablonu (`src/data/academicTemplates.ts`):**
   - Şablon galerisine **1. Dağıtık Sistem Mimarisi (`systemdesign.io` stili çapraz oklu ve çok renkli mimari çıkartmalı)** şablonunu başyapıt olarak ekle; mevcut **2. Tıp (Kardiyovasküler Anatomi)**, **3. Elektronik & Gömülü Sistemler**, **4. Hukuk (Yargılama & Kanun Yolları)** ve **5. Mimarlık (Yapı & Taşıyıcı Sistemler)** şablonlarını da yeni çok renkli çıkartma motoru ve çapraz ilişki oklarıyla baştan sona yenile.

---

## 6. ZORUNLU DOĞRULAMA VE CANLI TARAYICI TEST KRİTERLERİ (QA GATE)

Geliştirmeyi bitirdiğinde görevi tamamladım demeden önce hem `npm run build` sıfır hatayla geçmeli hem de canlı tarayıcıda şu testleri bizzat doğrulamalısın:
1. **Çeşitlilik Testi:** Türkçe olarak sırasıyla `"Yük Dengeleyici"`, `"Mitral Kapak"`, `"İstinaf"`, `"Uçan Payanda"`, `"Op-Amp"`, `"Osmanlı Tımar"`, `"Veritabanı Sharding"` yazıldığında her birinde **en az 25+ renkli, kırık link içermeyen (`naturalWidth > 0`) görsel** listelenmelidir.
2. **Bağlam Algılama Testi:** Kök düğüm `"Sistem Tasarımı"` iken yeni dal çekildiğinde daha harf yazmadan sistem mimarisi alt konu + ikon önerileri gelmeli; alt dala `"Köprü"` yazıldığında ağ/sistem ikonu, kök `"Mimarlık"` iken `"Köprü"` yazıldığında mimari köprü görselleri öne çıkmalıdır.
3. **AI Çıkartma & Flood-Fill Testi:** `✨ AI Çiz` tıklandığında rastgele prosedürel şekiller DEĞİL, gerçek görsel üretim adayları gelmeli ve beyaz konturlu çıkartma kesiminde iç beyaz bölgeler delinmemelidir.
4. **Mobil / Tablet / Masaüstü Sıfır Taşma Testi:** `375x812` (Telefon), `820x1180` (Tablet) ve `1440x900` (Masaüstü) boyutlarında `KeyboardVisualBar`, `StickerGalleryDrawer` ve `CrossLink` okları sıfır taşma ve 60 FPS akıcılıkla çalışmalıdır.
