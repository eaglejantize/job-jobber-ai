import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Settings as SettingsIcon,
  LogOut,
  Search,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { INDUSTRIES, industryLabel } from "@/lib/industries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import LeadCard, { type Lead } from "@/components/LeadCard";
import { Switch } from "@/components/ui/switch";

type Client = {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  alert_phone: string | null;
  industry: string | null;
  payment_status: string;
  setup_status: string;
  created_at: string;
};

type Tab = "overview" | "subscribers" | "create" | "settings";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "subscribers", label: "Subscribers", icon: Users },
  { id: "create", label: "Create Test Account", icon: UserPlus },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("callcapture_clients")
      .select("id, business_name, owner_name, email, alert_phone, industry, payment_status, setup_status, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load accounts", description: error.message, variant: "destructive" });
    } else {
      setClients((data ?? []) as Client[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100">
      <aside className="w-60 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700">
          <Link to="/admin" className="text-lg font-semibold tracking-tight text-white">
            Vektuor <span className="text-emerald-500">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 py-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium border-l-2 transition-colors ${
                  active
                    ? "border-emerald-500 bg-slate-900/60 text-white"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-slate-900 hover:bg-slate-700 text-slate-300"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto">
        <header className="px-8 py-5 border-b border-slate-800">
          <h1 className="text-xl font-semibold text-white">
            {TABS.find((t) => t.id === tab)?.label}
          </h1>
        </header>
        <div className="p-8">
          {loading && tab !== "create" && tab !== "settings" ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : tab === "overview" ? (
            <OverviewTab clients={clients} />
          ) : tab === "subscribers" ? (
            <SubscribersTab clients={clients} onChange={refresh} />
          ) : tab === "create" ? (
            <CreateTestAccountTab onCreated={refresh} />
          ) : (
            <SettingsTab />
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------------- Status badge ---------------- */

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const styles: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    trial: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    manual: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    suspended: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  const cls = styles[s] ?? "bg-slate-700 text-slate-300 border-slate-600";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status || "—"}
    </span>
  );
}

/* ---------------- Overview ---------------- */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function OverviewTab({ clients }: { clients: Client[] }) {
  const total = clients.length;
  const active = clients.filter((c) => c.payment_status === "active").length;
  const pending = clients.filter((c) => c.payment_status === "pending").length;
  const trial = clients.filter((c) => c.payment_status === "trial").length;
  const recent = clients.slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Accounts" value={total} />
        <StatCard label="Active" value={active} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Trial" value={trial} />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Recent signups
        </h2>
        <ClientsTable rows={recent} />
      </section>
    </div>
  );
}

/* ---------------- Subscribers ---------------- */

function SubscribersTab({ clients, onChange }: { clients: Client[]; onChange: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "trial" | "pending" | "manual" | "suspended">("all");
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);

  async function openLeads(c: Client) {
    setViewing(c);
    setLeads(null);
    const { data } = await supabase
      .from("callcapture_leads")
      .select("*")
      .eq("client_id", c.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setLeads((data as Lead[]) ?? []);
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter !== "all" && (c.payment_status || "").toLowerCase() !== filter) return false;
      if (!q) return true;
      return (
        c.business_name?.toLowerCase().includes(q) ||
        c.owner_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    });
  }, [clients, query, filter]);

  async function update(id: string, patch: Partial<Client>) {
    setBusyId(id);
    const { error } = await supabase.from("callcapture_clients").update(patch).eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account updated" });
      onChange();
    }
  }

  async function hardDelete(id: string) {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("delete-subaccount", {
      body: { client_id: id },
    });
    setBusyId(null);
    setPendingDelete(null);
    const errMsg = error?.message || (data as { error?: string })?.error;
    if (errMsg) {
      toast({ title: "Delete failed", description: errMsg, variant: "destructive" });
    } else {
      toast({ title: "Subaccount permanently deleted" });
      onChange();
    }
  }

  const filters: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "trial", label: "Trial" },
    { id: "pending", label: "Pending" },
    { id: "manual", label: "Manual" },
    { id: "suspended", label: "Suspended" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business, owner, or email…"
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                filter === f.id
                  ? "bg-emerald-500 border-emerald-500 text-slate-900 font-semibold"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ClientsTable
        rows={rows}
        actions={(c) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={busyId === c.id}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300"
                aria-label="Actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-slate-200">
              <DropdownMenuItem onClick={() => openLeads(c)}>
                View Leads
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  setBusyId(c.id);
                  const { data, error } = await supabase.functions.invoke("update-vapi-agent", { body: { client_id: c.id } });
                  setBusyId(null);
                  if (error || !(data as { ok?: boolean })?.ok) {
                    const msg = error?.message || (data as { error?: string })?.error || "Unknown error";
                    toast({ title: "Sync failed", description: msg, variant: "destructive" });
                  } else {
                    toast({ title: "Agent synced" });
                  }
                }}
              >
                Sync Agent
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem onClick={() => update(c.id, { payment_status: "active", setup_status: "Active" })}>
                Activate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => update(c.id, { payment_status: "pending" })}>
                Set Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => update(c.id, { payment_status: "suspended", setup_status: "Suspended" })}>
                Suspend
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-400"
                onClick={() => setPendingDelete(c)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This permanently removes <span className="text-white">{pendingDelete?.business_name}</span> ({pendingDelete?.email}) from the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={() => pendingDelete && hardDelete(pendingDelete.id)}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!viewing} onOpenChange={(o) => { if (!o) { setViewing(null); setLeads(null); } }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-slate-900 text-slate-100 border-slate-700">
          <SheetHeader>
            <SheetTitle className="text-white">{viewing?.business_name} · Leads</SheetTitle>
            <SheetDescription className="text-slate-400">{viewing?.email}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {leads === null ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-slate-400">No leads captured yet.</p>
            ) : (
              leads.map((l) => <LeadCard key={l.id} lead={l} />)
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------------- Clients table ---------------- */

function ClientsTable({
  rows,
  actions,
}: {
  rows: Client[];
  actions?: (c: Client) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-10 text-center text-slate-400 text-sm">
        No accounts to show.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Business</th>
            <th className="text-left px-4 py-3 font-medium">Owner</th>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Industry</th>
            <th className="text-left px-4 py-3 font-medium">Phone</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Setup</th>
            <th className="text-left px-4 py-3 font-medium">Created</th>
            {actions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {rows.map((c) => (
            <tr key={c.id} className="bg-slate-800 hover:bg-slate-700/60 transition-colors">
              <td className="px-4 py-3 text-white font-medium">{c.business_name}</td>
              <td className="px-4 py-3 text-slate-300">{c.owner_name}</td>
              <td className="px-4 py-3 text-slate-300">{c.email}</td>
              <td className="px-4 py-3 text-slate-300">{industryLabel(c.industry) ?? "—"}</td>
              <td className="px-4 py-3 text-slate-300">{c.alert_phone ?? "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={c.payment_status} /></td>
              <td className="px-4 py-3 text-slate-300">{c.setup_status}</td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
              {actions && <td className="px-4 py-3 text-right">{actions(c)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Create Test Account ---------------- */

function CreateTestAccountTab({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    email: "",
    alert_phone: "",
    industry: "hvac",
    payment_status: "manual",
    setup_status: "Active",
  });
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("callcapture_clients").insert({
      id,
      business_name: form.business_name,
      owner_name: form.owner_name,
      email: form.email,
      alert_phone: form.alert_phone,
      industry: form.industry,
      payment_status: form.payment_status,
      setup_status: form.setup_status,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not create test account", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Test account created", description: `ID: ${id}` });
    setForm((f) => ({ ...f, business_name: "", owner_name: "", email: "", alert_phone: "" }));
    onCreated();
  }

  const inputCls =
    "w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider";

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Business Name</label>
          <input required className={inputCls} value={form.business_name} onChange={(e) => set("business_name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Owner Name</label>
          <input required className={inputCls} value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input required type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input required className={inputCls} value={form.alert_phone} onChange={(e) => set("alert_phone", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Industry</label>
          <select className={inputCls} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
            {INDUSTRIES.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Payment Status</label>
          <select className={inputCls} value={form.payment_status} onChange={(e) => set("payment_status", e.target.value)}>
            <option value="active">active</option>
            <option value="manual">manual</option>
            <option value="pending">pending</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Setup Status</label>
          <select className={inputCls} value={form.setup_status} onChange={(e) => set("setup_status", e.target.value)}>
            <option>Active</option>
            <option>Payment Pending</option>
            <option>Setup In Progress</option>
            <option>Pending Review</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create Test Account
      </button>
    </form>
  );
}

/* ---------------- Settings ---------------- */

function SettingsTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <BypassBillingCard />
    </div>
  );
}

function BypassBillingCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("callcapture_app_settings" as never)
        .select("bypass_billing, updated_at")
        .eq("id", true)
        .maybeSingle();
      if (error) {
        toast({ title: "Failed to load settings", description: error.message, variant: "destructive" });
        setEnabled(false);
        return;
      }
      const row = data as { bypass_billing: boolean; updated_at: string } | null;
      setEnabled(row?.bypass_billing ?? false);
      setUpdatedAt(row?.updated_at ?? null);
    })();
  }, []);

  async function toggle(next: boolean) {
    if (enabled === null) return;
    const prev = enabled;
    setEnabled(next);
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("callcapture_app_settings" as never)
      .update({
        bypass_billing: next,
        updated_at: new Date().toISOString(),
        updated_by: userData.user?.id ?? null,
      })
      .eq("id", true)
      .select("updated_at")
      .maybeSingle();
    setSaving(false);
    if (error) {
      setEnabled(prev);
      toast({ title: "Failed to update setting", description: error.message, variant: "destructive" });
      return;
    }
    const row = data as { updated_at: string } | null;
    setUpdatedAt(row?.updated_at ?? new Date().toISOString());
    toast({
      title: next ? "Billing bypass enabled" : "Billing bypass disabled",
      description: next
        ? "New signups will skip Stripe and start a 30-day trial."
        : "New signups will be routed to Stripe checkout.",
    });
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
      <h2 className="text-lg font-semibold text-white">Billing bypass</h2>
      <p className="mt-2 text-sm text-slate-400">
        When enabled, new signups skip Stripe checkout and are activated with a 30-day trial
        (status shows as <span className="text-blue-400">Active (Trial)</span>).
      </p>

      <div className="mt-6 flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-900/60 border border-slate-700">
        <div>
          <div className="text-sm font-medium text-white">Bypass Stripe checkout</div>
          <div className="text-xs text-slate-400 mt-1">
            {updatedAt ? `Last changed ${new Date(updatedAt).toLocaleString()}` : "Not yet configured"}
          </div>
        </div>
        <Switch
          checked={enabled ?? false}
          disabled={enabled === null || saving}
          onCheckedChange={toggle}
        />
      </div>

      {enabled && (
        <div className="mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-300">
          Bypass is ON. Live signups will skip payment — turn off before production launch.
        </div>
      )}
    </div>
  );
}