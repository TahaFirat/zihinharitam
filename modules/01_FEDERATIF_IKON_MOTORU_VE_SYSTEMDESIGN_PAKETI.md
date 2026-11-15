# MODÜL 1: 8 KAYNAKLI FEDERATİF İKON MOTORU, DUOTONE RENKLENDİRİCİ VE `systemdesign.io` PAKETİ

Bu modülde `src/core/visuals/VisualSearchOrchestrator.ts` ve `src/core/visuals/providers/` altındaki tüm görsel arama mimarisini yeniden inşa ederek **her konu için 40–100+ renkli ve yüksek kaliteli görsel** dönmesini sağla.

## İnşa Edilecek Dosyalar ve Sorumluluklar

### 1. `src/core/visuals/providers/SystemDesignVisualPack.ts`
`https://systemdesign.io/` kalitesinde, yerleşik (0ms çevrimdışı çalışan), çok renkli, izometrik derinlikli ve beyaz die-cut çerçeveli **en az 65 adet** sistem tasarımı, yazılım mimarisi ve elektronik mühendisliği SVG çıkartması oluştur:
- **Trafik & Ağ:** Load Balancer, API Gateway, Reverse Proxy, CDN, DNS, WAF Firewall, Rate Limiter, Router/Switch, VPC Cloud, WebSocket, REST/GraphQL/gRPC.
- **Veritabanı & Önbellek:** SQL Primary, Read Replica, Sharded DB, NoSQL Document, Redis In-Memory Cache, Vector DB, Graph DB, Time-Series DB, S3 Object Storage, Data Lake, Elastic Search.
- **Servis & Kuyruk:** Microservice, Serverless Lambda, Kubernetes Pod/Cluster, Docker Container, Kafka Stream, Message Queue, Pub/Sub, Worker Node, Circuit Breaker, Auth/OAuth Shield.
- **AI & Donanım/Elektronik:** LLM Engine, Neural Network, GPU Cluster, Mobile/Web Client, IoT Sensor, Microcontroller/Arduino, Op-Amp, Logic Gates, PCB, Battery/BMS, Servo Motor, RF/SDR Antenna, Autonomous UAV/Drone.
- Her öğenin hem Türkçe hem İngilizce zengin anahtar kelime ve eş anlamlı etiket dizisi (`tagsTr`, `tagsEn`, `domain`) bulunmalıdır.

### 2. `src/core/visuals/providers/ArasaacPictogramAdapter.ts`
- Hem `https://api.arasaac.org/v1/pictograms/tr/search/{query}` hem `https://api.arasaac.org/v1/pictograms/en/search/{query}` uç noktalarını paralel sorgula.
- Dönen sonuçları `https://static.arasaac.org/pictograms/${id}/${id}_500.png` URL'siyle haritanın el çizimi çıkartma stiline doğrudan bağla.

### 3. `src/core/visuals/providers/IconifyMultiSourceAdapter.ts`
İki ayrı paralel kanal çalıştır:
- **Kanal A (Doğal Çok Renkli Setler):** `prefixes=openmoji,fluent-emoji,fluent-emoji-flat,noto,twemoji,icon-park,flat-color-icons,fxemoji,streamline-emojis,logos,devicon,skill-icons,vscode-icons&limit=64`
- **Kanal B (Uzmanlık Vektör Setleri):** `prefixes=healthicons,game-icons,carbon,ph,lucide,tabler,mdi&limit=64` -> Bu kanaldan gelen tüm SVG'leri **`DuotoneStickerColorizer.ts`** üzerinden geçir!

### 4. `src/core/visuals/DuotoneStickerColorizer.ts`
Tek renkli (`currentColor` / `#000`) SVG ikonları haritada çirkin siyah lekeler olarak göstermemek için:
- Ham SVG kodunu çek (`https://api.iconify.design/{prefix}/{name}.svg`),
- Dalın `branchColor` rengini baz alarak HSL uzayında:
  - Yumuşak krem-pastel arka rozet dolgusu (`lightness: 94%`),
  - %22 opaklıkta ikincil derinlik katmanı,
  - Koyu doygun mürekkep ana çizgi rengi (`lightness: 24%`, `saturation: 75%`),
  - Dışına `6px` saf beyaz (`#FFFFFF`) die-cut çıkartma çerçevesi ve hafif alt gölge sararak Data URL / Blob SVG olarak üret!

### 5. `src/core/visuals/CompositeStickerComposer.ts`
- Sorguda sıfat/durum belirteçleri varsa (*"şifreli / güvenli" -> 🔒*, *"hızlı / anlık / önbellek" -> ⚡*, *"dağıtık / küme" -> 🖧*, *"hata / iptal / red" -> ❌*, *"onay / kesin" -> ✅*, *"kablosuz / uzaktan" -> 📡*, *"otomatik / AI" -> ✨*), en iyi eşleşen ana çıkartmanın sağ alt köşesine beyaz konturlu mikro-rozet işleyerek bileşik çıkartma seçenekleri oluştur.

### 6. `WikimediaAtlasAdapter.ts` & `OpenverseAdapter.ts`
- Wikimedia Commons (`filetype:svg` bilimsel/anatomik/mimari diyagramlar ve fotoğraflar) ile Openverse (`https://api.openverse.org/v1/images/`) kaynaklarını paralel bağla, kırık veya metin ağırlıklı belge taramalarını filtrele.

### 7. Akıllı Sıralama ve Tekilleştirme (`VisualSearchOrchestrator.ts`)
- Sonuçları alaka skoru + çok renklilik + aktif disiplin uyumuna göre puanla, aynı ikonu tekrar gösterme ve önbellekten `<30ms` içinde ilk dalgayı, `<350ms` içinde tam 50–100 görsellik seti akıt (progressive streaming).
