# ZihinHaritam Ücretsiz AI Edge Proxy (Cloudflare Worker)

iOS, Android ve Web uygulamalarının **API anahtarı sızdırmadan** ve **0 TL maliyetle** (günde 100+ kullanıcı kapasitesiyle) metin/PDF'den zihin haritası üretmesini sağlayan Cloudflare Worker servisi.

## 3 Adımda Ücretsiz Canlıya Alma

```bash
cd cloudflare-ai-worker
npm install
npx wrangler login
```

### İsteğe Bağlı Ücretsiz AI Anahtarlarını Ekle (Günlük 1.7M+ Token Kapasitesi İçin)
*(Hiç anahtar eklemeseniz bile Cloudflare Workers AI'nin günlük 10.000 ücretsiz neuron kotası otomatik çalışır!)*

```bash
# 1) Cerebras Free (1.000.000 token/gün ücretsiz): https://cloud.cerebras.ai
npx wrangler secret put CEREBRAS_API_KEY

# 2) Groq Free (600.000 token/gün ücretsiz): https://console.groq.com
npx wrangler secret put GROQ_API_KEY

# 3) Google Gemini AI Studio Free: https://aistudio.google.com/apikey
npx wrangler secret put GEMINI_API_KEY
```

### Yayınla & Uygulamaya Bağla

```bash
npx wrangler deploy
```

Çıkan `https://zihinharitam-ai-proxy.<hesabin>.workers.dev` adresini kök dizindeki `.env` dosyasına eklemeniz yeterlidir:

```env
VITE_AI_API_URL=https://zihinharitam-ai-proxy.<hesabin>.workers.dev
```
