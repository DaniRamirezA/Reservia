ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department TEXT;

COMMENT ON COLUMN public.profiles.department IS 'Departamento colombiano del usuario o proveedor; city conserva el municipio.';