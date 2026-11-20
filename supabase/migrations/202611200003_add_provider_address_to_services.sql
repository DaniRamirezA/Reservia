ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS provider_address TEXT;

UPDATE public.services AS s
SET provider_address = p.address
FROM public.profiles AS p
WHERE p.id = s.provider_id
  AND p.role = 'PROVIDER';