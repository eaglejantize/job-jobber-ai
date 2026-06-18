import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Shield, Lock, Database, Users, Mail, FileText } from "lucide-react";

export default function Trust() {
  return (
    <Layout>
      <section className="container py-12 max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground mb-4">
            <Shield className="h-3.5 w-3.5" />
            Trust &amp; Security
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy">Security &amp; Privacy at Vektuor</h1>
          <p className="mt-3 text-muted-foreground">
            This page is maintained by the Vektuor team to answer common security and privacy
            questions about the Vektuor (CallCapture) service. It describes controls that are
            currently enabled in the product. It is not an independent certification or audit,
            and it is not issued or verified by our hosting providers.
          </p>
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <Lock className="h-5 w-5 text-navy" />
              <CardTitle className="text-lg">Authentication &amp; access</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink space-y-2">
              <p>
                Customer accounts use email and password sign-in. Passwords are checked against
                the Have I Been Pwned breach database during signup and password changes, and
                obviously compromised passwords are rejected.
              </p>
              <p>
                Sessions are managed by our auth provider and stored in the browser. Authenticated
                pages (Dashboard, Lead Inbox, Setup, Settings) are gated by route guards and a
                valid session.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <Database className="h-5 w-5 text-navy" />
              <CardTitle className="text-lg">Tenant isolation &amp; data access</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink space-y-2">
              <p>
                Each subscriber's business, assistant configuration, and captured leads are
                isolated per account. Database row-level security policies restrict read and
                write access so that authenticated users can only see and modify rows that
                belong to a business they own.
              </p>
              <p>
                Data is transmitted over TLS between the browser, our backend, and third-party
                services. Hosting is provided by Lovable Cloud (Supabase-managed Postgres and
                edge functions). We rely on the platform's standard encryption-at-rest for
                stored data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <Users className="h-5 w-5 text-navy" />
              <CardTitle className="text-lg">Subprocessors &amp; integrations</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink space-y-2">
              <p>We use the following third-party services to operate the product:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Lovable Cloud (Supabase)</strong> — authentication, database, edge functions.</li>
                <li><strong>Vapi</strong> — AI voice agent that answers incoming calls.</li>
                <li><strong>Twilio</strong> — phone number provisioning, call routing, and SMS notifications.</li>
                <li><strong>Stripe</strong> — subscription billing and payment processing. Card data is handled by Stripe and never stored on our servers.</li>
              </ul>
              <p>
                Each subprocessor handles only the data needed for its function (e.g. caller
                phone number and call transcript for Vapi/Twilio, billing email for Stripe).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <FileText className="h-5 w-5 text-navy" />
              <CardTitle className="text-lg">What data we collect</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink space-y-2">
              <p><strong>From subscribers:</strong> business name, industry, owner contact email and phone, alert phone, business hours, service area, AI assistant configuration, and billing identifiers returned by Stripe.</p>
              <p><strong>From callers:</strong> the information the AI receptionist captures during a call (typically caller name, callback phone, reason for the call, and a transcript/summary). This data appears in the subscriber's Lead Inbox.</p>
              <p>We do not sell caller or subscriber data, and we do not use it to train third-party models outside the call-handling flow.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <Mail className="h-5 w-5 text-navy" />
              <CardTitle className="text-lg">Privacy requests &amp; contact</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink space-y-2">
              <p>
                To request export or deletion of your account data, or to report a suspected
                security issue, contact us through the{" "}
                <Link to="/support" className="text-navy underline hover:no-underline">Support page</Link>
                {" "}and select the relevant request type. Please include enough detail for us to
                identify the affected account.
              </p>
              <p className="text-xs text-muted-foreground">
                Shared responsibility: Vektuor is responsible for the application code, access
                controls, and customer data handling described above. Our hosting platform is
                responsible for the underlying infrastructure. Subscribers are responsible for
                safeguarding their account credentials and the contents of their Lead Inbox.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}