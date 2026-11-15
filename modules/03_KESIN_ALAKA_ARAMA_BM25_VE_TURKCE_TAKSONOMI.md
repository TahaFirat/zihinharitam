# MODÜL 3: KESİN ALAKA ARAMA MOTORU (`MiniSearch` BM25 + TÜRKÇE TAKSONOMİ)

Bu modülde `"mikroorganizma"` yazılınca mantık kapısı, sunucu, merdiven veya baca çıkması gibi alakasız sonuç hatalarını sonsuza dek yok et.

## Yapılacak Mühendislik Değişiklikleri

1. **Web Worker Tabanlı `<8ms` Arama (`src/workers/visualSearch.worker.ts`):**
   - `search-manifest.json` verisini Web Worker içinde `MiniSearch` indeksine yükle.
   - Ana iş parçacığı (UI) üzerinde hiçbir arama döngüsü çalıştırma; klavyede her harf basıldığında `<8ms` içinde sonuçları akıt.

2. **Ön-Ek Çarpışma Koruması ve Türkçe Akademik Taksonomi (`SemanticTaxonomyTR.ts`):**
   - `"mikro"` gibi bilimsel ön eklerin farklı disiplinlere sızmasını engelle (`mikroorganizma / mikrobiyoloji / mikrop / mikroskop` != `mikroçip / mikroservis / mikrodenetleyici`; `ekokardiyografi` != `ekonomi`).
   - En az **3.000+ Türkçe kök ve akademik terimi** (Tıp, Mikrobiyoloji, Biyoloji, Kimya, Fizik, Matematik, Bilgisayar/Sistem Mimarisi, Elektronik, Hukuk, Mimarlık, Tarih, Coğrafya, İktisat, Günlük Yaşam) doğrudan doğru İngilizce görsel anahtar kelimelere eşleyen kapsamlı bir taksonomi sözlüğü kur.
   - Türkçe çekim/yapım eklerini (`-lar/-ler`, `-in/-ın`, `-de/-da`, `-si/-sı`, `-lik/-lık`) güvenli kök uzunluğu (`>=3` harf) koruyarak soy.

3. **Sıfır Çöp Dolgu (Zero Garbage Padding) & Bağlam Yalıtımı:**
   - **KESİN YASAK:** Arama sonuçlarını sayıca çok göstermek için alaka skoru düşük rastgele ikonlarla veya varsayılan `SystemDesignVisualPack` öğeleriyle doldurma!
   - Üst düğümün başlığını alt düğümün arama metnine **katma**; harita bağlamını yalnızca eş sesli kelimelerde (`köprü`, `kapak`, `ağ`, `hücre`, `dalga`, `kuyruk`) `1.18x` sıralama çarpanı olarak kullan.

4. **`AbortController` + Sıra Numarası (`seqId`) Korumalı Online Katman:**
   - İsteğe bağlı çevrimiçi kaynaklar (`ARASAAC`, `Wikimedia`, `Openverse`) yalnızca `navigator.onLine` iken arka planda çalışsın; yeni tuş vuruşunda önceki tüm HTTP istekleri `abort()` edilsin ve eski yanıtların yeni sonuçları ezmesi engellensin.

5. **Zorunlu Otomatik Doğrulama (`scripts/verify-search-relevance.mjs`):**
   - `"mikroorganizma"`, `"çip"`, `"ekokardiyografi"`, `"mitral kapak"`, `"istinaf"`, `"yük dengeleyici"`, `"uçan payanda"`, `"op-amp"` dahil 20 Türkçe sorguyu offline test eden ve alakasız ikon çıkarsa hata fırlatan doğrulama betiğini yazıp çalıştır.
