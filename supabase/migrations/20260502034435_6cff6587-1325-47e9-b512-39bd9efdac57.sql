-- 1. Add subscription_status column
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS subscription_status text;

-- 2. Normalize existing payment_status values to lowercase
UPDATE public.callcapture_clients
   SET payment_status = lower(payment_status)
 WHERE payment_status IS NOT NULL
   AND payment_status <> lower(payment_status);

-- 3. Trigger: on insert into callcapture_clients, link user_id by email if missing
CREATE OR REPLACE FUNCTION public.link_client_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id INTO NEW.user_id
      FROM auth.users
     WHERE lower(email) = lower(NEW.email)
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_client_to_user ON public.callcapture_clients;
CREATE TRIGGER trg_link_client_to_user
BEFORE INSERT ON public.callcapture_clients
FOR EACH ROW EXECUTE FUNCTION public.link_client_to_user();

-- 4. Trigger: on new auth user, backfill matching client rows
CREATE OR REPLACE FUNCTION public.link_user_to_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    UPDATE public.callcapture_clients
       SET user_id = NEW.id
     WHERE user_id IS NULL
       AND lower(email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_user_to_clients ON auth.users;
CREATE TRIGGER trg_link_user_to_clients
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_user_to_clients();

-- 5. Backfill: link any existing client rows to existing users by email
UPDATE public.callcapture_clients c
   SET user_id = u.id
  FROM auth.users u
 WHERE c.user_id IS NULL
   AND lower(c.email) = lower(u.email);