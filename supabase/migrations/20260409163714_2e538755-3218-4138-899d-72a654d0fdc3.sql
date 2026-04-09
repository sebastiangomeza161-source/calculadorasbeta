
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  label text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read holidays"
  ON public.holidays FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert holidays"
  ON public.holidays FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update holidays"
  ON public.holidays FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete holidays"
  ON public.holidays FOR DELETE
  USING (true);
