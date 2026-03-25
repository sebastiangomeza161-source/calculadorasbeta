
CREATE TABLE public.daily_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  price numeric NOT NULL,
  bid numeric DEFAULT 0,
  ask numeric DEFAULT 0,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticker, recorded_date)
);

ALTER TABLE public.daily_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.daily_prices
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow service role insert" ON public.daily_prices
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow anon insert" ON public.daily_prices
  FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX idx_daily_prices_ticker_date ON public.daily_prices(ticker, recorded_date DESC);
