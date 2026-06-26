import { Navigate, useLocation } from "react-router-dom";

// The legacy /signup page called supabase.auth.signUp() directly, which is
// rate-limited by Supabase Auth (50s "over_email_send_rate_limit"). The
// canonical signup flow lives at /start and uses the signup-tenant edge
// function (admin.createUser, no email-send throttle). Redirect inbound links.
export default function Signup() {
  const location = useLocation();
  return <Navigate to={`/start${location.search}`} replace />;
}
