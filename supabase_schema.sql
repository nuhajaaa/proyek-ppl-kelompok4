-- ==============================================================================
-- ANINDITA CREATIVE — SUPABASE DATABASE SCHEMA, STORAGE & RLS POLICIES
-- ==============================================================================
-- Sinkron 100% dengan skema produksi live pada proyek Supabase.
-- Menjalankan skrip ini secara idempotent aman pada proyek baru maupun existing.
-- ==============================================================================

-- 1. TABEL: site_content (brand, stats, ticker, showcase, about, process, cta)
CREATE TABLE IF NOT EXISTS public.site_content (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL: services (Daftar layanan & paket harga)
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short_desc TEXT DEFAULT '',
  price BIGINT NOT NULL DEFAULT 0 CHECK (price >= 0),
  price_label TEXT DEFAULT 'Mulai dari',
  package TEXT DEFAULT '',
  estimate TEXT DEFAULT '',
  icon TEXT DEFAULT 'video',
  media_url TEXT DEFAULT '',
  gradient TEXT DEFAULT 'linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABEL: portfolio (Galeri karya terpilih)
CREATE TABLE IF NOT EXISTS public.portfolio (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  badge TEXT DEFAULT '',
  client TEXT DEFAULT '',
  year TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  gradient TEXT DEFAULT 'linear-gradient(135deg, #442416 0%, #8c5d3b 50%, #3a1e12 100%)',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABEL: testimonials (Ulasan klien)
CREATE TABLE IF NOT EXISTS public.testimonials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  rating INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  quote TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL: orders (Pesanan & Brief Klien)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  brand_name TEXT DEFAULT '',
  deadline TEXT DEFAULT '',
  reference_link TEXT DEFAULT '',
  brief_notes TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal BIGINT NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'pending_wa' CHECK (status IN ('pending_wa', 'processing', 'done', 'cancelled')),
  status_label TEXT NOT NULL DEFAULT 'Menunggu WhatsApp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- TRIGGERS & INDEXES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['site_content', 'services', 'portfolio', 'testimonials', 'orders']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || tbl || '_updated_at'
        AND tgrelid = ('public.' || tbl)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_services_sort_order ON public.services (sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_sort_order ON public.portfolio (sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_portfolio_category ON public.portfolio (category);
CREATE INDEX IF NOT EXISTS idx_testimonials_sort_order ON public.testimonials (sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & GRANTS (Non-Overlapping Per-Role Policies)
-- ==============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.site_content, public.services, public.portfolio, public.testimonials TO anon;
GRANT INSERT ON public.orders TO anon;
GRANT ALL ON public.site_content, public.services, public.portfolio, public.testimonials, public.orders TO authenticated, service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Public (anon): read-only CMS tables, insert-only orders
CREATE POLICY "Allow public read site_content" ON public.site_content
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read services" ON public.services
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read portfolio" ON public.portfolio
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read testimonials" ON public.testimonials
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public insert orders" ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Authenticated Admin: full CRUD on CMS tables & read/update on orders
CREATE POLICY "Allow full access site_content" ON public.site_content
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Allow full access services" ON public.services
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Allow full access portfolio" ON public.portfolio
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Allow full access testimonials" ON public.testimonials
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Allow public read orders" ON public.orders
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Allow public update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Allow authenticated delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- ==============================================================================
-- SUPABASE STORAGE BUCKET (Public Media CDN for CMS Photos & Videos)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read media bucket" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'media');

CREATE POLICY "Authenticated upload media bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated update media bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (SELECT auth.uid()) IS NOT NULL)
  WITH CHECK (bucket_id = 'media' AND (SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated delete media bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (SELECT auth.uid()) IS NOT NULL);
