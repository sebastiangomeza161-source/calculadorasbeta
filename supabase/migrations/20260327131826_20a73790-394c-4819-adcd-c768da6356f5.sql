CREATE TABLE public.cer_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  value numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cer_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.cer_values FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow service role insert" ON public.cer_values FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Allow service role update" ON public.cer_values FOR UPDATE TO service_role USING (true) WITH CHECK (true);