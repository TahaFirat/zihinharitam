# MODÜL 1: 60/120 FPS SIFIR TİTREME (ZERO-JITTER) TUVAL VE SÜRÜKLEME REFAKTÖRÜ

Bu modülde düğüm taşırken oluşan titreme (`jitter`), gecikme ve koordinat kayması sorunlarını tamamen ortadan kaldır.

## Yapılacak Mühendislik Değişiklikleri

1. **`WorldTransformLayer` Birleşik Koordinat Sistemi (`CanvasStage.tsx`):**
   - Tüm DOM düğümlerini tek bir GPU katmanı içinde tut:
     `transform: translate3d(${panX}px, ${panY}px, 0) scale(${zoom}); transformOrigin: 0 0; will-change: transform;`
   - Her `MindNode` elemanı yalnızca kendi dünya koordinatında konumlanır:
     `transform: translate3d(${node.x}px, ${node.y}px, 0) translate(-50%, -50%);`
   - Aktif etkileşim (`pan`, `zoom`, `drag`, `branchPull`) sırasında sahneye `data-interacting="true"` ekle ve CSS'te `.canvas-stage[data-interacting="true"] * { transition: none !important; }` kuralını zorunlu kıl!

2. **Transient rAF Sürükleme Motoru (`0` React Re-Render):**
   - `pointerdown` olayında `stageContainerRef.current.setPointerCapture(e.pointerId)` kullan.
   - `pointermove` sırasında **ASLA** `setMapDocument` veya `useState` güncelleme!
   - Başlangıç ekran noktasından (`startClientX`, `startClientY`) itibaren saf fark hesabı yap:
     `dxWorld = (e.clientX - startClientX) / viewport.zoom`
     `dyWorld = (e.clientY - startClientY) / viewport.zoom`
   - Taşınan düğümün ve alt dallarının (subtree) geçici koordinatlarını `transientNodesRef` içinde tut, `requestAnimationFrame` içinde ilgili DOM düğümlerinin `style.transform` özelliğini doğrudan güncelle ve Canvas Bezier dallarını yeniden çiz.
   - Yalnızca `pointerup` / `pointercancel` anında tek seferde kalıcı React state ve `IndexedDB` kaydı yap.

3. **Alt-Ağaç Birlikte Taşıma (Subtree Drag) & Klavye Kısayolları:**
   - Bir düğüm taşındığında varsayılan olarak altındaki tüm bağlı alt dallar da aynı `(dxWorld, dyWorld)` kadar akıcı hareket etsin (`Alt` tuşu basılıyken yalnızca tek düğüm hareket etsin).
   - `Tab` (Alt dal oluştur), `Enter` (Kardeş dal oluştur), `Delete/Backspace` (Seçili düğümü sil), `Space + Sürükle` (Tuvali kaydır), `Cmd/Ctrl + Z / Y` (Geri/İleri al) kısayollarını eksiksiz çalıştır.

4. **Şablon Alt-Etiketi (`subtitle`) Temizliği:**
   - Kullanıcı şablondan gelen bir düğümün başlığını değiştirdiğinde (ör. `"Kardiyoloji"` -> `"çip"`), eski şablon `subtitle` metnini otomatik temizle ki `"çip"` altında `"Kardiyoloji De..."` gibi saçma kalıntılar kalmasın.
