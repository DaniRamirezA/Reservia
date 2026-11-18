-- Reservia: registrar quién y cuándo canceló cada reserva.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('CLIENT', 'PROVIDER')),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

