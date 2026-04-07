
CREATE TABLE public.maturity_overrides (
  ticker TEXT PRIMARY KEY,
  maturity_date TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.maturity_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read maturity overrides"
ON public.maturity_overrides
FOR SELECT
USING (true);

CREATE POLICY "Service role can manage maturity overrides"
ON public.maturity_overrides
FOR ALL
USING (true)
WITH CHECK (true);
