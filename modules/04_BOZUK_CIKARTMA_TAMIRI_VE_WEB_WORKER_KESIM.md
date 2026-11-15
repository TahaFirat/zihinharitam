# MODÜL 4: BOZUK ÇIKARTMA TAMİRİ VE WEB WORKER FOTOĞRAF KESİMİ

Bu modülde ekran görüntüsündeki `"çip"` düğümünün üstünde görünen parçalanmış/bozuk çıkartma hatasını ve ana ekran donmalarını çöz.

## Yapılacak Mühendislik Değişiklikleri

1. **`src/workers/stickerProcessor.worker.ts` (`OffscreenCanvas`):**
   - Raster görsel işleme (kamera fotoğrafı, `📷 Nottan Kes`, gerçek fotoğraf ve AI çıktıları) işlemlerinin %100'ünü ana iş parçacığından çıkarıp Web Worker içindeki `OffscreenCanvas`'a taşı.

2. **Akıllı İçerik Türü Algılayıcı (Şema vs İzole Nesne):**
   - Vektör SVG'ler bu piksel boru hattına **hiç girmez** (`PureVectorStickerizer` ile saf vektör kalır).
   - Diyagram, devre şeması, EKG, mimari plan veya ders notu kesitlerinde **piksel Flood-Fill UYGULAMA**! (İnce çizgilerin arasındaki beyaz alanların kemirilip bozulmasını önlemek için bu görselleri kontrastı iyileştirilmiş temiz **Yuvarlatılmış Beyaz Die-Cut Kağıt Kartı** içine al).
   - İzole nesne çizimleri ve fotoğraflarda ise yalnızca 4 dış köşeden başlayan BFS Flood-Fill + yumuşak kenar yumuşatma + pürüzsüz `#FFFFFF` die-cut konturu uygula.

3. **Bozuk Çıkartma Otomatik Tamir (Auto-Heal):**
   - Mevcut kayıtlı haritalarda veya şablonlarda piksel bozulmasına uğramış eski çıkartmaları açılışta algılayıp düğüm başlığına uygun net vektör çıkartmayla otomatik yenile.
