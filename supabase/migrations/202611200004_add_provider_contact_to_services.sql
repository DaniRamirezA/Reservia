ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS provider_phone TEXT,
  ADD COLUMN IF NOT EXISTS provider_website TEXT,
  ADD COLUMN IF NOT EXISTS provider_avatar_url TEXT;

UPDATE public.services AS s
SET
  provider_phone = p.phone,
  provider_website = p.website,
  provider_avatar_url = p.avatar_url,
  provider_address = p.address
FROM public.profiles AS p
WHERE p.id = s.provider_id
  AND p.role = 'PROVIDER';