-- Internal notifications for appointment cancellations only.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  cancelled_by TEXT NOT NULL CHECK (cancelled_by IN ('CLIENT', 'PROVIDER')),
  cancelled_by_name TEXT NOT NULL,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own notifications" ON public.notifications;
CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users mark their own notifications as read" ON public.notifications;
CREATE POLICY "Users mark their own notifications as read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_appointment_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM 'CANCELLED' AND NEW.status = 'CANCELLED' THEN
    IF NEW.cancelled_by = 'CLIENT' THEN
      target_user := NEW.provider_id;
    ELSIF NEW.cancelled_by = 'PROVIDER' THEN
      target_user := NEW.client_id;
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (
      recipient_id,
      appointment_id,
      business_name,
      service_name,
      appointment_date,
      appointment_time,
      cancelled_by,
      cancelled_by_name,
      cancellation_reason
    ) VALUES (
      target_user,
      NEW.id,
      COALESCE(NEW.provider_name, 'Establecimiento'),
      COALESCE(NEW.service_name, 'Servicio'),
      NEW.date,
      NEW.time,
      NEW.cancelled_by,
      CASE WHEN NEW.cancelled_by = 'CLIENT' THEN COALESCE(NEW.client_name, 'Cliente') ELSE COALESCE(NEW.provider_name, 'Proveedor') END,
      NULLIF(BTRIM(NEW.cancellation_reason), '')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointment_cancellation_notification ON public.appointments;
CREATE TRIGGER appointment_cancellation_notification
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_appointment_cancellation();
