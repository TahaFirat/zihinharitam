# GÖRSEL ZİHİN HARİTASI UYGULAMASI — UÇTAN UCA MASTER GELİŞTİRME PROMPTU

> **Rol ve Hedef:** Sen kıdemli bir Cross-Platform Ürün Mühendisi, Grafik/Canvas Motoru Mimarı ve Mobil UX Tasarımcısısın. Görevin; **Telefon, Tablet (Kalem destekli) ve Bilgisayar** üzerinde kusursuz ve senkronize çalışan, tüm akademik bölümleri (Mühendislik, Tıp, Hukuk, Mimarlık, Temel Bilimler, Sosyal Bilimler vb.) kapsayan **sonsuz görsel çeşitliliğe sahip, renkli, çıkartma (sticker) tabanlı bir Görsel Zihin Haritası (Visual Mind Map)** uygulamasını eksiksiz ve üretime hazır (production-ready) kalitede inşa etmektir.

---

## 1. KESİN KALİTE KURALLARI (ANTI-LAZY KURALLARI)
1. **Sahte/Yarım Kod Yasak:** `// TODO`, `// buraya eklenecek`, basitleştirilmiş tek renkli kutucuklar veya statik 5-10 ikonluk sahte listeler kesinlikle kullanılmayacaktır.
2. **Sıfır Menü Kalabalığı (Zero-Menu Chrome):** Ekranın solunda, sağında veya altında alanı daraltan hantal araç çubukları OLMAYACAKTIR. Ekranın %100'ü tuvaldir; yalnızca haritanın kendisi rengârenk, organik ve zengin görsellidir, arayüz kabuğu (UI chrome) ise ultra sade ve minimalisttir.
3. **60/120 FPS Akıcılık:** Tuval üzerinde 500+ düğüm ve yüksek çözünürlüklü görsel varken bile telefon ve tablette pan/zoom (kaydırma/yakınlaştırma) işlemleri takılmasız çalışmalıdır.
4. **Cihazlar Arası Tam Uyum:** Aynı kod tabanı masaüstü tarayıcıda (fare + kısayollar), tablette (dokunmatik + Apple Pencil/Stylus) ve telefonda (tek başparmak ergonomisi) doğal (native) hissettirmelidir.

---

## 2. TEKNOLOJİ YIĞINI (TECH STACK)
- **Çekirdek Uygulama:** TypeScript (strict mode) + React 19 + Vite
- **Tuval ve Çizim Motoru:** HiDPI HTML5 Canvas 2D / WebGL2 hibrit mimarisi (organik dallar, gölgeler ve ızgara Canvas üzerinde; aktif metin düzenleme ve erişilebilirlik katmanı senkronize DOM/transform katmanında)
- **Mobil ve Tablet Native Paketleme:** Capacitor (iOS / iPadOS / Android) + Masaüstü için PWA
  - `@capacitor/camera` (ders notu/kitap şeması çekme)
  - `@capacitor/haptics` (dal uzatma, bırakma ve katlama sırasında zarif dokunsal geri bildirim)
  - `@capacitor/filesystem` & `@capacitor/share` (PDF/PNG dışa aktarma)
- **Yerel Depolama & Senkronizasyon:** Offline-first `IndexedDB` (Dexie.js + Yjs CRDT) + Bulut Senkronizasyon ve Ortak Görsel Havuzu için `Supabase` (PostgreSQL + `pgvector` + Storage CDN + Edge Functions + Realtime)
- **Arka Plan Temizleme (On-Device + Fallback):** Web/Android üzerinde `@imgly/background-removal` (WASM/WebGPU) ve iOS/iPadOS üzerinde native Vision API (`VNGenerateForegroundInstanceMaskRequest`) köprüsü.

---

## 3. TASARIM DİLİ VE TUVAL ESTETİĞİ
1. **Kağıt Dokulu Sonsuz Tuval:** Göz yormayan sıcak kırık beyaz noktalı defter zemini (`#FAF9F5`, nokta rengi `#E2E0D8`; Karanlık Çalışma Modunda `#12161F`, nokta rengi `#262D3D`).
2. **Merkezi Görsel Konu (Root Hub):**
   - Kullanıcı haritayı açtığında ortaya konusunu yazar ve merkezde büyük, canlı bir illüstrasyon/çıkartma (`140x140px` - `180x180px`) ile kalın tipografili ana başlık yer alır.
3. **Organik Kıvrımlı Dallar (Tony Buzan Stili Tapered Bezier):**
   - Düz çizgi veya köşeli diyagram okları KULLANILMAZ.
   - Merkezden çıkan her ana dal, kök kısmında kalın (`10px-14px`), uca doğru zarifçe incelen (`3px-4px`) yumuşak kübik Bezier eğrisi olarak çizilir.
   - **Renk Paleti Disiplini:** Her ana dal canlı ve uyumlu bir renge sahiptir (`#F59E0B` Kehribar, `#0EA5E9` Okyanus Mavisi, `#10B981` Zümrüt, `#8B5CF6` Mor, `#F43F5E` Mercan, `#EC4899` Fuşya). Alt dallar, bağlı oldukları ana dalın rengini miras alır.
4. **Görsel Odaklı Düğümler (Visual-First Nodes):**
   - Her dalın üzerinde veya ucunda büyük, net, beyaz çıkartma konturlu (die-cut) görsel/illüstrasyon ve altında okunaklı (`Plus Jakarta Sans` veya `Nunito`, bold/semibold) konu başlığı bulunur.

---

## 4. KULLANICI DENEYİMİ VE SIFIR SÜRTÜNMELİ AKIŞ (TELEFON & TABLET ODAKLI)

### 4.1. Sürükle-Yaz (Drag-to-Branch) ile Butonsuz Dal Ekleme
- Herhangi bir düğümün kenarındaki zarif `+` tutamacından dışarı doğru parmak, kalem veya fare ile sürükleme yapıldığında, yay fiziğine sahip canlı bir Bezier dalı parmağı takip ederek uzar.
- Tek elle telefon kullanımı için `+` tutamacına sadece **tek dokunuş** yapıldığında da en uygun boş açıya otomatik dal atılır (çarpışma önleyici açı hesaplaması ile).
- Parmak bırakıldığı anda yeni düğüm oluşur, hafif bir haptic titreşim verilir ve doğrudan klavye açılarak metin girişi başlar.

### 4.2. Klavye Üstü "Anlık Görsel Öneri Şeridi" (En Kritik Özellik)
Kullanıcı ayrı bir "Resim Ekle" menüsüne GİRMEZ. Dal adını yazarken klavyenin hemen üstüne yapışık (`window.visualViewport` API ile iOS/Android klavye yüksekliğine milimetrik kenetlenen) akıllı bir şerit açılır:
- **Üst Satır — Görsel Tarz Sekmeleri ve Aksiyonlar:**
  - `[ ✨ Çizim ]` : El çizimi renkli illüstrasyonlar ve AI çıkartmaları (Varsayılan)
  - `[ 🧊 3D ]` : Hacimli 3D ikon ve objeler
  - `[ 📷 Fotoğraf ]` : Arka planı otomatik silinip çıkartmaya dönüştürülmüş gerçek fotoğraflar
  - `[ 📐 Şema ]` : Akademik diyagramlar, devre sembolleri, anatomik kesitler, mimari çizimler
  - Sağ Taraf Hızlı Aksiyon Butonları:
    - **`✨ AI Çiz`** : Yazılan niş akademik terim için anında harita stilinde özel çıkartma üretir.
    - **`📷 Nottan Kes`** : Kamerayı veya galeriyi açar; ders kitabındaki/slayttaki şemayı kırpıp arka planını silerek dala çıkartma olarak yapıştırır.
    - **`✏️ Karala`** : Küçük hızlı çizim pedi açar; kalemle/parmakla yapılan kaba karalamayı düzgün renkli çıkartmaya çevirir.
- **Alt Satır — Canlı Akışkan Görsel Karuseli:**
  - Kullanıcı harf girdikçe (`120ms` debounce) anlamsal arama çalışır ve 6-10 adet yüksek kaliteli görsel yatay kaydırılabilir şeritte anında belirir.
  - Görsele **tek dokunuş** yapıldığında yay animasyonuyla (`scale: 0.6 -> 1.08 -> 1.0`) dalın üzerine yerleşir.

### 4.3. Mobil Ekranlar İçin "Dal Katlama" ve "Odak Modu"
- **Çift Dokunuşla Katlama (Collapse/Expand):** Herhangi bir dala çift dokunulduğunda tüm alt dalları kendi içine katlanır ve dalın ucunda `+5` gibi alt dal sayısını gösteren kompakt bir rozet belirir.
- **Odak Modu (Focus Dimming):** Küçük telefon ekranında çalışırken seçili ana dal dışındaki dalların opaklığını `%20`'ye düşüren tek tuşluk odak görünümü bulunur.
- **Otomatik Düzen (Smart Auto-Layout):** Dallar birbirine girdiğinde tek dokunuşla çakışmaları çözen kuvvet/radyal tabanlı organik hizalama motoru çalışır.

---

## 5. 4 KATMANLI "SONSUZ GÖRSEL MOTORU" MİMARİSİ

Tüm üniversite bölümlerini (Mühendislik, Tıp, Hukuk, Mimarlık, Edebiyat, İktisat vb.) kapsamak için görsel arama ve üretim şu 4 katmanlı boru hattından (pipeline) beslenir:

### Katman 1: Birleşik Açık Kaynak ve Akademik Görsel Kütüphaneleri
Arama servisi tek bir ikon paketine bağlı kalmaz; aşağıdaki kaynakları birleşik bir adaptör yapısıyla sorgular:
- **Genel & 3D:** Microsoft Fluent Emoji (3D & Color), OpenMoji, Iconify çok renkli koleksiyonları.
- **Tıp, Biyoloji & Kimya:** Bioicons, Servier Medical Art (CC-BY), NIH BioArt vektörleri (organlar, hücre yapıları, reseptörler, laboratuvar ekipmanları).
- **Mühendislik & Mimarlık:** Elektronik/devre sembolleri, mikrodenetleyici ve sensör çizimleri, mekanik/yapısal kesit vektörleri, mimari elemanlar.
- **Gerçek Fotoğraf & Ansiklopedik Şema:** Wikimedia Commons API (tarihi haritalar, hukuki semboller, teknik diyagramlar) + Unsplash / Pexels API.

### Katman 2: Çok Dilli Anlamsal Vektör Arama (Türkçe -> Küresel Eşleşme)
- Öğrenci Türkçe **`"Mitral kapak"`**, **`"Eviren yükselteç"`**, **`"İstinaf mahkemesi"`** veya **`"Uçan payanda"`** yazdığında, klasik kelime araması yerine **çok dilli embedding (`multilingual-e5-small` veya `text-embedding-3-small` + `pgvector`)** kullanılır.
- Böylece Türkçe sorgular, İngilizce veya Latince etiketlenmiş yüz binlerce akademik/tıbbi/teknik görselle `<40ms` içinde yüksek doğrulukla eşleşir.

### Katman 3: Stil Sabitli "Anlık AI Çıkartma" Üretimi ve Ortak Havuz (Semantic Cache)
Hazır kütüphanelerde bulunmayan çok spesifik kavramlar için (ör. *"Osmanlı'da İltizam Sistemi"*, *"Kamaşık Sayılarda Kutupsal Gösterim"*):
1. Edge Function üzerinden hızlı görsel üretim modeli (`Flux.1 Schnell` veya `Recraft V3 Illustration`) çağrılır.
2. **Sabit Stil Şablonu (Style-Lock Wrapper):** Kullanıcının yazdığı terim ve seçili bölüm bağlamı, şu sabit estetik şablonla birleştirilir:
   > `"Educational hand-drawn illustration sticker of [CONCEPT_IN_ENGLISH], bold clean dark ink outlines, vibrant marker and watercolor shading, isolated on pure solid white background, centered composition, zero text, zero letters, clean die-cut vector feel"`
3. **Ortak Havuz Kaydı (Global Semantic Deduplication):** Üretilen görselin arka planı şeffaflaştırılır (`WebP`), Türkçe/İngilizce terim adı ve anlamsal vektörüyle birlikte `shared_stickers` veritabanına kaydedilir. Aynı veya eş anlamlı konuyu yazan bir sonraki kullanıcı, görseli **0 maliyetle ve 20ms içinde** hazır havuzdan çeker.

### Katman 4: Otomatik "Beyaz Konturlu Çıkartma" (Die-Cut Sticker) Bütünleştirici
Gerçek fotoğrafların, ders notu kırpmalarının ve çizimlerin aynı haritada yama gibi durmaması için tüm görseller tuvale eklenmeden önce **Die-Cut Sticker Pipeline**'ından geçer:
1. Görsel fotoğraf veya kamera çekimiyse önce arka plan silinir (Alpha maske çıkarılır).
2. Offscreen Canvas üzerinde alfa kanalına `8px` yarıçaplı morfolojik genişletme (dilation) uygulanarak pürüzsüz **kalın beyaz çıkartma konturu (`#FFFFFF`)** oluşturulur.
3. Dışına zarif bir kesim çizgisi (`1px rgba(15,23,42,0.08)`) ve yumuşak kağıt gölgesi (`drop-shadow: 0 6px 14px rgba(15,23,42,0.12)`) eklenir.
4. Sonuç `IndexedDB` ve CDN önbelleğine hafif `WebP` olarak kaydedilir.

---

## 6. ÖĞRENCİLER İÇİN SÜPER ÖZELLİKLER (SINAV VE ÇALIŞMA MODU)
1. **Aktif Hatırlama / Sınav Modu (Active Recall):**
   - Üstteki küçük göz/mezuniyet kepi ikonuna basıldığında **3 mod** sunulur:
     - *Metinleri Gizle:* Sadece resimler görünür; öğrenci resme bakıp terimi hatırlamaya çalışır, dokununca metin açılır.
     - *Görselleri/Alt Dalları Gizle:* Ana başlığa bakıp alt dalları tahmin eder, dokununca açılır.
2. **Ders Notundan Şema Kırpıcı (`📷 Nottan Kes`):**
   - PDF slayt görüntüsü veya defter fotoğrafı üzerinde serbest/dikdörtgen kırpma + otomatik perspektif düzeltme + arka plan temizleme / kontrast netleştirme (diyagram modu) ile saniyeler içinde haritaya şema aktarma.
3. **Yüksek Çözünürlüklü Çıktı ve Paylaşım:**
   - Baskıya uygun 300 DPI `PDF` (A4/A3 yatay poster), şeffaf arka planlı `PNG`, vektörel `SVG` ve ortak çalışma bağlantısı (canlı katılımcı avatarlarıyla).

---

## 7. VERİ MODELİ VE DOSYA MİMARİSİ

```text
src/
├── core/
│   ├── canvas/
│   │   ├── InfiniteViewport.ts       # Ataletli pan, pinch-to-zoom, 60fps culling & LOD
│   │   ├── OrganicBranchRenderer.ts  # Tapered kübik Bezier dal çizimi ve renk mirası
│   │   ├── RadialAutoLayout.ts       # Çarpışma önleyici organik dal yerleşim motoru
│   │   └── HitTestSpatialIndex.ts    # R-Tree (rbush) ile binlerce düğümde anlık dokunma tespiti
│   ├── visuals/
│   │   ├── VisualSearchOrchestrator.ts # 4 katmanlı paralel görsel arama ve önbellek yöneticisi
│   │   ├── DieCutStickerProcessor.ts   # Arka plan silme + beyaz çıkartma konturu + gölge üretici
│   │   ├── SketchToSticker.ts          # Kalem/parmak karalamasını çıkartmaya dönüştürücü
│   │   └── providers/                  # Fluent3D, Bioicons/Academic, Wikimedia/Unsplash, AISticker
│   └── sync/
│       ├── LocalStore.ts             # Dexie IndexedDB çevrimdışı kayıt ve görsel blob önbelleği
│       └── RealtimeCollab.ts         # Yjs / Supabase ortak çalışma ve canlı imleçler
├── components/
│   ├── CanvasStage.tsx               # Tam ekran sıfır menülü ana tuval + dokunmatik/kalem jestleri
│   ├── KeyboardVisualBar.tsx         # VisualViewport uyumlu klavye üstü canlı görsel şeridi
│   ├── NoteCropperModal.tsx          # Ders notundan/kameradan şema kesme ve çıkartmalaştırma
│   ├── QuickSketchPopover.tsx        # Tablet kalemi / parmak için hızlı çiz-dönüştür pedi
│   ├── TopMinimalHUD.tsx             # Yalnızca geri, harita adı, odak/sınav modu, paylaş ve avatarlar
│   └── ExportSheet.tsx               # PDF / PNG / SVG dışa aktarma paneli
└── types/
    └── mindmap.ts                    # MindMapDocument, MindNode, StickerAsset, VisualMode tipleri
```

### Temel Veri Şeması (`mindmap.ts`)
```typescript
export type VisualStyleMode = 'illustration' | '3d' | 'photo' | 'diagram';

export interface StickerAsset {
  id: string;
  url: string;                  // Yerel blob URL veya CDN WebP URL
  mode: VisualStyleMode;
  source: 'library' | 'ai_pool' | 'note_crop' | 'sketch';
  dieCutProcessed: boolean;
  aspectRatio: number;
}

export interface MindNode {
  id: string;
  parentId: string | null;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  branchColor: string;
  collapsed: boolean;
  sticker?: StickerAsset;
  examHidden?: boolean;
}
```

---

## 8. MOBİL & iOS / TABLET KRİTİK TEKNİK DETAYLAR
1. **iOS / Android Klavye Kenetlenmesi:** `window.visualViewport` üzerindeki `resize` ve `scroll` olaylarını dinleyerek `KeyboardVisualBar` bileşenini klavyenin tam üst kenarına `transform: translate3d(...)` ile sıfır titremeyle sabitle. Klavye açıldığında düzenlenen düğümü otomatik olarak görünür alanın merkezine kaydır.
2. **iOS Dokunma Hatalarını Önleme:** Tuval üzerinde `-webkit-touch-callout: none`, `-webkit-user-select: none`, `touch-action: none` kurallarını uygula; büyüteç (loupe) çıkmasını ve sayfanın lastik gibi kaymasını (overscroll bounce) tamamen engelle.
3. **Apple Pencil / Stylus Ayrımı:** `PointerEvent.pointerType === 'pen'` algılandığında avuç içi reddi (palm rejection) uygula; parmakla tuval kaydırılırken kalemle doğrudan dal çekilebilsin veya hızlı çizim yapılabilsin.

---

## 9. UYGULAMA ADIMLARI VE TESLİMAT BEKLENTİSİ
Uygulamayı tek seferde çalışır, derlenir (`npm run build` sıfır hata) ve tüm etkileşimleri canlı test edilebilir şekilde kur:
1. Önce **Sonsuz Tuval, Tapered Organik Bezier Dallar, Sürükle-Yaz Dal Ekleme, Dal Katlama ve Otomatik Düzen** çekirdeğini kur.
2. Ardından **`VisualViewport` Uyumlu Klavye Üstü Canlı Görsel Şeridini** (`[✨ Çizim | 🧊 3D | 📷 Fotoğraf | 📐 Şema]` sekmeleriyle) entegre et.
3. **4 Katmanlı Görsel Motorunu** (Açık kütüphane adaptörleri + Çok dilli semantik eşleştirme + AI Çıkartma & Ortak Havuz servisi + Offscreen Canvas **Die-Cut Beyaz Kontur** işlemcisi) eksiksiz bağla.
4. **`📷 Nottan Kes` (Kırpma + Arka Plan Silme -> Çıkartma)**, **`✏️ Karala`**, **Aktif Hatırlama Sınav Modu** ve **Yüksek Çözünürlüklü PDF/PNG Çıktı** modüllerini tamamla.
5. Başlangıçta test edilebilmesi için **Mühendislik, Tıp, Hukuk ve Mimarlık** bölümlerine ait zengin görselli hazır örnek harita şablonlarını uygulamaya dahil et.
