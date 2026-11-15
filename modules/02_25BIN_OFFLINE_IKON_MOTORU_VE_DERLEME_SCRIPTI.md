# MODÜL 2: 25.000+ ÜCRETSİZ AÇIK KAYNAK OFFLINE İKON MOTORU & PWA ÖNBELLEĞİ

Bu modülde uygulamanın internet tamamen kapalıyken bile binlerce çok renkli çıkartma ve akademik ikona `<8ms` hızında erişmesini sağla.

## Yapılacak Mühendislik Değişiklikleri

1. **NPM Paketlerinin Kurulumu:**
   - `@iconify-json/fluent-emoji-flat`, `@iconify-json/fluent-color`, `@iconify-json/openmoji`, `@iconify-json/icon-park`, `@iconify-json/flat-color-icons`, `@iconify-json/logos`, `@iconify-json/devicon`, `@iconify-json/skill-icons`, `@iconify-json/healthicons`, `@iconify-json/medical-icon`, `@iconify-json/game-icons`, `@iconify-json/tabler`, `@iconify-json/carbon`, `@iconify-json/ph`, `minisearch`, `vite-plugin-pwa` paketlerini kur.

2. **`scripts/build-offline-icon-shards.mjs` Derleyici Betiği:**
   - `package.json` içinde `"predev": "node scripts/build-offline-icon-shards.mjs"` ve `"prebuild": "node scripts/build-offline-icon-shards.mjs"` olarak bağla (eğer şardlar zaten güncel olarak üretilmişse hash kontrolüyle `<100ms`'de geçsin).
   - Yüklü `@iconify-json/*` paketlerinden 20.000–25.000+ ikonu ayıklayıp `public/offline-packs/search-manifest.json` ve `public/offline-packs/shards/shard-XX.json` dosyalarına böl.
   - Her ikona İngilizce tokenlarının yanı sıra kapsamlı Türkçe karşılıklarını ve disiplin etiketlerini (`medicine_bio`, `system_cs`, `electronics`, `law`, `architecture`, `science`, `general`) göm.

3. **`BuiltInMultiColorAtlas.ts` (145+ Özel Çok Renkli Çıkartma):**
   - `SystemDesignVisualPack` (65+ sistem mimarisi ikonu) + **80+ yeni çok renkli Bilim, Mikrobiyoloji, Tıp, Elektronik, Hukuk ve Mimarlık illüstrasyonu** (bakteri, virüs, bakteriyofaj, petri kabı, mikroskop, hücre, mitokondri, DNA, nöron, kalp kapakçıkları, EKG, nefron, akciğer, mikroçip, PCB, op-amp, pil/BMS, adalet terazisi, hakim tokmağı, kanun kitabı, kemer/tonoz, uçan payanda, sütun, kubbe, atom, prizma) ekle.

4. **`PureVectorStickerizer.ts` (`<0.5ms` Saf Vektör Çıkartma Üreticisi):**
   - Vektör SVG'ler için piksel tabanlı Canvas işlemini tamamen kaldır.
   - Çok renkli SVG'lere saf SVG die-cut beyaz kontur/rozet ve gölge sar; tek renkli uzmanlık ikonlarını (`healthicons`, `game-icons`, `tabler`, `carbon`, `ph`) aktif dalın rengine (`branchColor`) uyumlu 3 tonlu pastel rozet + koyu mürekkep çizgili canlı çıkartmalara dönüştür.

5. **Tam Offline PWA (`vite.config.ts` -> `VitePWA`):**
   - Tüm uygulama varlıklarını ve `/offline-packs/**` dosyalarını Workbox ile önbelleğe al; uçak modunda %100 çalışmasını sağla.
