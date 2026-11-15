# MODÜL 3: EKSTREM OPTİMİZASYON, BELLEK GÜVENLİĞİ VE TASARIM UÇ DURUMLARI

Gerçek kullanıcıların eski/yeni telefonlarda, tabletlerde ve bilgisayarlarda karşılaşabileceği **tüm performans, çökme ve görsel bozulma senaryolarını** peşinen engelle:

## 1. iOS WKWebView Çökme (Jetsam / White-Screen) Korumaları
1. **Canvas Piksel Bütçesi Sınırı (`MAX_CANVAS_AREA = 16_777_216`):**
   - Retina iPad veya 3x DPR iPhone ekranlarında tam ekran Canvas oluşturulurken `effectiveDpr = Math.min(window.devicePixelRatio || 1, isMobileOrTablet ? 2 : 2.5)` sınırını uygula ve `canvas.width * canvas.height` çarpımının asla `4096 * 4096` sınırı aşmamasını garantile.
2. **Parçalı (Tiled) 300 DPI PDF ve Poster Render Motoru (`ExportSheet.tsx`):**
   - Harita genişliği `6000px x 4500px` olduğunda `3x` ölçekli tek bir Canvas açmak `324 MB` RAM tüketir ve iPhone/iPad uygulamasını anında kapatır!
   - Bunun yerine haritayı güvenli boyutlara ölçekleyerek veya `2048x2048` karolar halinde çizip PDF/PNG çıktısını sıfır bellek taşmasıyla üret.
3. **LRU Görsel Önbellek Temizleyicisi (`StickerMemoryCache.ts`):**
   - Aynı anda en fazla `180` çözülmüş görsel / `ObjectURL` tut; sınır aşıldığında en eski kullanılmayan `blob:` adreslerini `URL.revokeObjectURL` ile serbest bırak.

## 2. 1.000+ Düğümde 60/120 FPS Sanallaştırma (Viewport Virtualization)
- Haritada 500–1.000 düğüm varken tüm düğümleri React DOM içinde tutma!
- `InfiniteViewport` görüş dikdörtgenini (`worldLeft - 240`, `worldTop - 240`, `worldRight + 240`, `worldBottom + 240`) `HitTestSpatialIndex` (`rbush`) üzerinden `<0.4ms` içinde sorgula ve **yalnızca ekranda görünen düğümleri (+ aktif düzenlenen/sürüklenen düğümü)** DOM'a bas.
- Görünmeyen dalların Bezier eğrilerini de başlangıç/bitiş sınırlayıcı kutusu görüş alanıyla kesişmiyorsa Canvas çiziminde atla (branch frustum culling).

## 3. Girdi, Klavye ve Kalem Kusursuzluğu
- **Apple Pencil Hassasiyeti:** `QuickSketchPopover` ve dal çekme işlemlerinde `e.getCoalescedEvents?.()` kullanarak 120Hz/240Hz kalem noktalarını kayıpsız yakala; kalem aktifken 400ms boyunca avuç içi dokunuşlarını (`pointerType === 'touch'`) yoksay.
- **iOS Klavye Zıplama Kilidi:** Metin girişi (`input` / `textarea`) odaklandığında iOS WKWebView'un tüm sayfayı yukarı itmesini engellemek için `window.scrollTo(0, 0)` kilidi uygula ve `visualViewport.height` farkını kullanarak düzenlenen düğümü klavyenin üstündeki açık alana otomatik ortala.
- **Uygulama Arka Plana Atıldığında Anında Kayıt:** `document.addEventListener('visibilitychange')` ve `window.addEventListener('pagehide')` olaylarında bekleyen (`debounced`) tüm harita değişikliklerini anında `IndexedDB`'ye yaz!

## 4. Görsel & Tipografik Uç Durum Korumaları
- **Boş veya Çok Uzun Başlıklar:** Başlık boş bırakılırsa `"Yeni Konu"` ata; 120 karakterlik çok uzun akademik cümle yazılırsa kart genişliğini `max-width: 280px` ile sınırla, dengeli satır kaydırma (`text-wrap: balance`, `overflow-wrap: anywhere`) uygula ve `ResizeObserver` ile düğüm boyutu değiştikçe dal bağlantı uçlarını canlı güncelle.
- **Bozuk Görsel Yedek Kalkanı (`onError` Self-Healing):** Herhangi bir çevrimiçi görsel yüklenemezse kırık resim ikonu (`broken image`) **ASLA** görünmesin; `onError` anında otomatik olarak o başlığa en uygun yerel offline vektör çıkartma devreye girsin!
- **Karanlık Mod Kontrast Koruması:** Koyu çalışma modunda (`#0F141D`) koyu çizgili şemaların veya çıkartmaların kaybolmaması için her çıkartmanın beyaz die-cut konturu sayesinde karanlık zeminde de %100 net parlamasını garantile.
