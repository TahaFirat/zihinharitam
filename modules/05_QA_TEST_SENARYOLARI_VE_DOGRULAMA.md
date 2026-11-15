# MODÜL 5: ZORUNLU GÖRSEL KALİTE VE CANLI TARAYICI DOĞRULAMA PAKETİ (QA)

Kodlama tamamlandığında işi bitirmeden önce aşağıdaki doğrulama adımlarını eksiksiz çalıştır ve hataları sıfırla:

1. **Derleme & Tip Güvenliği:**
   - `npm run build` sıfır TypeScript ve Vite paketleme hatasıyla tamamlanmalıdır.

2. **20 Zorlu Kavramda Görsel Zenginlik Testi:**
   Aşağıdaki Türkçe ve teknik sorguların her biri `VisualSearchOrchestrator` üzerinde test edildiğinde **en az 25+ adet kırık olmayan (`naturalWidth > 0`), renkli çıkartma** döndürmelidir:
   - *Sistem Tasarımı & Yazılım:* `"Yük Dengeleyici"`, `"API Gateway"`, `"Veritabanı Sharding"`, `"Mesaj Kuyruğu"`, `"Redis Önbellek"`, `"Mikroservis"`
   - *Elektronik & Mühendislik:* `"Eviren Yükselteç (Op-Amp)"`, `"Mantık Kapıları"`, `"Mikrodenetleyici"`, `"Lityum Batarya BMS"`
   - *Tıp & Biyoloji:* `"Mitral Kapak"`, `"Sinoatriyal Düğüm"`, `"Nöron Sinaps"`, `"Böbrek Nefron"`
   - *Hukuk:* `"İstinaf Mahkemesi"`, `"Kuvvetler Ayrılığı"`, `"Delil Tespiti"`, `"Sözleşme Hukuku"`
   - *Mimarlık & Tarih:* `"Uçan Payanda"`, `"Korint Sütunu"`, `"Jeodezik Kubbe"`, `"Osmanlı Tımar Sistemi"`

3. **Bağlam ve Proaktif Öneri Testi:**
   - `"Sistem Tasarımı"` haritasında yeni dal eklendiğinde klavye şeridi açılır açılmaz (yazı yazmadan) hazır mimari alt konu + çıkartma çipleri görünmelidir.
   - `"Köprü"` kelimesi Sistem Tasarımı haritasında ağ bileşeni, Mimarlık haritasında yapısal köprü görselleri getirmelidir.

4. **AI Çıkartma & Flood-Fill Kesim Testi:**
   - `✨ AI Çiz` aksiyonu 4 aday görsel sunmalı, sahte rastgele geometrik SVG üretmemeli ve `DieCutStickerProcessor` iç beyaz detayları delmeden dış beyaz arka planı temizleyip beyaz çıkartma konturu eklemelidir.

5. **Çoklu Ekran Boyutu Testi:**
   - `375x812` (Mobil), `820x1180` (Tablet) ve `1440x900` (Masaüstü) görünümlerinde klavye üstü şerit, `+80 Görsel` çekmecesi, çapraz oklar ve PDF/PNG çıktısı kusursuz çalışmalıdır.
