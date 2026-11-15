# FAZ 4: CİHAZLAR ARASI SENKRONİZASYON, CANLI ORTAK ÇALIŞMA, ÇIKTI VE MAĞAZA HAZIRLIĞI

Bu fazda uygulamanın Telefon, Tablet ve Bilgisayar arasında gerçek zamanlı senkronizasyonunu, yüksek çözünürlüklü dışa aktarma seçeneklerini ve App Store / Google Play yayına hazırlık cilasını tamamla.

## Gereksinimler
1. **Çevrimdışı Öncelikli (Offline-First) Kayıt ve Bulut Senkronizasyonu:**
   - İnternet yokken bile tüm harita düzenlemeleri ve önbellekteki çıkartmalar `IndexedDB` üzerinde anında çalışır.
   - Bağlantı kurulduğunda `Yjs CRDT` / `Supabase` üzerinden telefon, tablet ve bilgisayar arasında veri kayıpsız senkronize olur.
2. **Gerçek Zamanlı Ortak Çalışma:**
   - Sağ üstteki minimal HUD barında haritada aktif olan ekip arkadaşlarının/öğrencilerin profil avatarları ve tuval üzerindeki canlı imleçleri görünür.
3. **Profesyonel Dışa Aktarma (`ExportSheet`):**
   - 300 DPI baskı kalitesinde `PDF` (A4 / A3 poster), şeffaf arka planlı yüksek çözünürlüklü `PNG`, vektörel `SVG` ve tek tıkla salt-okunur veya düzenlenebilir paylaşım linki.
4. **Capacitor iOS / iPadOS / Android Üretim Cilası:**
   - Safe-area (`env(safe-area-inset-*)`) tam uyumu, iPad Split-View / Stage Manager pencere boyutlandırma uyumu, `@capacitor/haptics` dokunsal geri bildirimleri ve bellek sızıntısı önleyici Canvas kaynak yönetimi.
