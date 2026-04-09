
CREATE TABLE public.inflation_inputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  rate NUMERIC NOT NULL DEFAULT 0.025,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE public.inflation_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read inflation_inputs"
  ON public.inflation_inputs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert inflation_inputs"
  ON public.inflation_inputs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update inflation_inputs"
  ON public.inflation_inputs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete inflation_inputs"
  ON public.inflation_inputs FOR DELETE
  TO anon, authenticated
  USING (true);
