
UPDATE public.callcapture_clients
SET vapi_phone_number_id = '1b023a8a-5769-4b29-98b0-e86c91bea2a9',
    vapi_assistant_id = '05941684-9bec-4122-8c83-d16a57bd0376',
    assigned_callcapture_number = '+19048933328',
    webhook_status = 'configured',
    number_status = 'active'
WHERE id = '05bcba6e-920c-46ee-8c2b-5032116cc767';

UPDATE public.callcapture_calls
SET client_id = '05bcba6e-920c-46ee-8c2b-5032116cc767'
WHERE vapi_call_id = '019f1bc4-7343-7000-af81-78ac0e837515';

UPDATE public.callcapture_leads
SET client_id = '05bcba6e-920c-46ee-8c2b-5032116cc767'
WHERE raw_payload->>'vapi_call_id' = '019f1bc4-7343-7000-af81-78ac0e837515';
