# MODÜL 2: OTONOM KONU ALGILAMA, ÇAPRAZ DİL KÖPRÜSÜ VE PROAKTİF ÖNERİ ZEKÂSI

Bu modülde uygulamanın haritadaki konuyu kendi kendine anlamasını, Türkçe en niş terimleri bile küresel görsel kütüphanelerle eşleştirmesini ve daha kullanıcı yazmadan akıllı öneriler sunmasını sağla.

## İnşa Edilecek Dosyalar ve Sorumluluklar

### 1. `src/core/visuals/TopicContextIntelligence.ts`
- Haritadaki tüm düğümleri ve aktif düğümün köküne kadar olan atasal zinciri (`Root -> ... -> Parent -> Node`) analiz eder.
- **Disiplin Sınıflandırıcı:** `system_design_cs`, `electronics_robotics`, `medicine_biology`, `law_governance`, `architecture_civil`, `exact_sciences`, `humanities_social`, `business_economics` disiplinlerine olasılık skoru atar.
- **Çok Anlamlı Kelime Çözücü (Homonym Resolver):** `"Köprü"`, `"Kapak"`, `"Kemer"`, `"Ağ"`, `"Hücre"`, `"Kuyruk"`, `"Yük"`, `"Dava"`, `"Dalga"`, `"Merkez"`, `"Katman"`, `" Kilit"` gibi bağlama göre anlam değiştiren kelimelerin İngilizce arama terimlerini aktif disipline göre yeniden yazar.

### 2. `src/core/visuals/AcademicOntologyTR.ts` & Türkçe Ek Soyucu
- Türkçe sondan eklemeli yapıyı çözen hafif bir morfolojik kök bulucu (`kapakçıklarının -> kapakçık`, `mahkemeleri -> mahkeme`, `dengeleyiciler -> dengeleyici`) yaz.
- Tüm mühendislik dalları, sistem tasarımı, tıp/anatomi, hukuk, mimarlık, temel bilimler, tarih ve iktisat için **800+ kavramlık zengin bir Türkçe -> İngilizce + Somut Görsel Metafor (Visual Proxy) haritası** kur.
- **Somut Metafor Kuralı:** Soyut kavramlar (*İstinaf, Temyiz, Enflasyon, Gecikme, Ölçeklenebilirlik, Entropi, Homeostaz, Egemenlik, Amortisman*) her zaman çizilebilir somut fiziksel nesnelere (`gavel`, `scales`, `stopwatch`, `server cluster`, `thermometer`, `crown/parliament` vb.) genişletilmelidir.

### 3. `src/core/visuals/CrossLingualWikiBridge.ts`
- Yerel ontolojide bulunmayan her türlü spesifik akademik/tarihi/tıbbi terim için:
  1. `tr.wikipedia.org/w/api.php` üzerinden arama + `langlinks` (`lllang=en`) ve `pageimages` sorgusu yapar,
  2. Bulunan İngilizce başlığı, kategori ipuçlarını ve Wikipedia görselini `IndexedDB` sözlük önbelleğine yazar,
  3. Böylece 100.000'den fazla akademik kavram için bile sıfır API anahtarıyla doğru İngilizce teknik terime ulaşılır!

### 4. Proaktif "Sıfır Tuş" (Zero-Keystroke) Alt Dal & İkon Önericisi
- Kullanıcı bir düğümden yeni dal çıkardığında (metin kutusu henüz boşken), üst düğümün başlığına ve aktif disipline göre **6–8 adet mantıklı alt başlık + hazır çıkartma** önerisi üret.
- Kullanıcı önerilen çipe tıkladığında hem dalın başlığını doldur hem de çıkartmasını anında ata!
