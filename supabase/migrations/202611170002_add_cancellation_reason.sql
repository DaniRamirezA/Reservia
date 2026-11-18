-- Registrar el motivo opcional de cada cancelación.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
