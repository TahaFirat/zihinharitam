-- ============================================================================
-- GÖRSEL ZİHİN HARİTASI — SUPABASE + PGVECTOR BULUT VE ORTAK HAVUZ ŞEMASI
-- ============================================================================

create extension if not exists vector;

-- 1. Cihazlar Arası Zihin Haritası Kayıt Tablosu
create table if not exists public.mindmaps (
  id text primary key,
  title text not null,
  department text not null default 'genel',
  root_node_id text not null,
  nodes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Küresel Ortak Çıkartma Havuzu (Global Semantic Sticker Deduplication Pool)
create table if not exists public.shared_stickers (
  id uuid primary key default gen_random_uuid(),
  concept_tr text not null,
  concept_en text not null,
  department text not null default 'genel',
  style_mode text not null default 'illustration',
  webp_url text not null,
  aspect_ratio real not null default 1.0,
  embedding vector(384) not null,
  usage_count integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists shared_stickers_embedding_idx
  on public.shared_stickers
  using hnsw (embedding vector_cosine_ops);

-- 3. Çok Dilli Anlamsal Vektör Eşleştirme RPC (<20ms Ortak Havuz Sorgusu)
create or replace function public.match_shared_stickers(
  query_embedding vector(384),
  match_threshold float default 0.78,
  match_count int default 8,
  filter_mode text default 'illustration'
)
returns table (
  id uuid,
  concept_tr text,
  concept_en text,
  webp_url text,
  aspect_ratio real,
  similarity float
)
language sql stable
as $$
  select
    s.id,
    s.concept_tr,
    s.concept_en,
    s.webp_url,
    s.aspect_ratio,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.shared_stickers s
  where s.style_mode = filter_mode
    and 1 - (s.embedding <=> query_embedding) > match_threshold
  order by s.embedding <=> query_embedding
  limit match_count;
$$;
