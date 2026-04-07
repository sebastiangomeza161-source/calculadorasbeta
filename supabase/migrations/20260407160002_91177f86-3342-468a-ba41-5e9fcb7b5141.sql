
DROP POLICY "Service role can manage maturity overrides" ON public.maturity_overrides;

CREATE POLICY "Anyone can insert maturity overrides"
ON public.maturity_overrides
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update maturity overrides"
ON public.maturity_overrides
FOR UPDATE
USING (true)
WITH CHECK (true);
