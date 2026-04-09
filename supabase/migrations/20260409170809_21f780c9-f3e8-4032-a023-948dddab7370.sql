-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can delete holidays" ON public.holidays;
DROP POLICY IF EXISTS "Anyone can insert holidays" ON public.holidays;
DROP POLICY IF EXISTS "Anyone can read holidays" ON public.holidays;
DROP POLICY IF EXISTS "Anyone can update holidays" ON public.holidays;

-- Recreate with explicit anon and authenticated roles
CREATE POLICY "Anyone can read holidays" ON public.holidays FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert holidays" ON public.holidays FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update holidays" ON public.holidays FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete holidays" ON public.holidays FOR DELETE TO anon, authenticated USING (true);