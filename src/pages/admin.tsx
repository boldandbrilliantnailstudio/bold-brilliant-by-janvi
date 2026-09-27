// Full studio admin panel: sign in with the admin password, then manage the website from a
// hamburger menu. Day-to-day work (orders, shop, coupons...) and Website Settings (contact,
// text, invoice design, emails) are shown as separate groups in the menu.
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { SITE } from "@/lib/site-config.ts";
import { clearStoredPassword, getStoredPassword, storePassword } from "./_admin/api.ts";
import DashboardTab from "./_admin/dashboard-tab.tsx";
import OrdersTab from "./_admin/orders-tab.tsx";
import ProductsTab from "./_admin/products-tab.tsx";
import CustomSetsTab from "./_admin/custom-sets-tab.tsx";
import CouponsTab from "./_admin/coupons-tab.tsx";
import BannersTab from "./_admin/banners-tab.tsx";
import BookingsTab from "./_admin/bookings-tab.tsx";
import ServicesTab from "./_admin/services-tab.tsx";
import CustomRequestsTab from "./_admin/custom-requests-tab.tsx";
import ReviewsTab from "./_admin/reviews-tab.tsx";
import CustomersTab from "./_admin/customers-tab.tsx";
import SiteSettingsTab from "./_admin/site-settings-tab.tsx";
import ContentTab from "./_admin/content-tab.tsx";
import InvoiceTemplateTab from "./_admin/invoice-template-tab.tsx";
import EmailsTab from "./_admin/emails-tab.tsx";
import TemplatesTab from "./_admin/templates-tab.tsx";
import SendHistoryTab from "./_admin/send-history-tab.tsx";

const TABS = [
  { id: "dashboard", label: "Dashboard", group: "manage", Component: DashboardTab },
  { id: "orders", label: "Orders", group: "manage", Component: OrdersTab },
  { id: "bookings", label: "Bookings", group: "manage", Component: BookingsTab },
  { id: "services", label: "Services & Slots", group: "manage", Component: ServicesTab },
  { id: "requests", label: "Custom Requests", group: "manage", Component: CustomRequestsTab },
  { id: "products", label: "Shop", group: "manage", Component: ProductsTab },
  { id: "custom-sets", label: "Custom Sets", group: "manage", Component: CustomSetsTab },
  { id: "customers", label: "Customers", group: "manage", Component: CustomersTab },
  { id: "coupons", label: "Coupons", group: "manage", Component: CouponsTab },
  { id: "banners", label: "Coupon Banners", group: "manage", Component: BannersTab },
  { id: "reviews", label: "Reviews", group: "manage", Component: ReviewsTab },
  { id: "settings", label: "Contact & Social", group: "settings", Component: SiteSettingsTab },
  { id: "content", label: "Website Text", group: "settings", Component: ContentTab },
  { id: "invoice", label: "Invoice Design", group: "settings", Component: InvoiceTemplateTab },
  { id: "emails", label: "Emails", group: "settings", Component: EmailsTab },
  { id: "templates", label: "Message Templates", group: "settings", Component: TemplatesTab },
  { id: "send-history", label: "Send History", group: "settings", Component: SendHistoryTab },
] as const;
type TabId = (typeof TABS)[number]["id"];

const GROUPS = [
  { id: "manage", label: "Manage" },
  { id: "settings", label: "Website Settings" },
] as const;

// Studio name + logo for the admin panel chrome (login screen, header). Read directly with the
// public anon key - site_settings is publicly readable - so it works before the admin signs in.
function useStudioBranding(): { brand: string; logoUrl: string } {
  const [brand, setBrand] = useState(SITE.brand);
  const [logoUrl, setLogoUrl] = useState<string>(SITE.logo);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("site_settings")
      .select("brand,logo_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { brand?: string; logo_url?: string | null } | null;
        if (row?.brand) setBrand(row.brand);
        if (row?.logo_url) setLogoUrl(row.logo_url);
      });
  }, []);

  return { brand, logoUrl };
}

// Checks the admin password against the server. "invalid" only means the server actively
// rejected it (401 - wrong password); any other failure (offline, cold start, etc.) is reported
// separately so the caller doesn't sign a valid admin out just because one request hiccuped.
type PasswordCheck = { status: "valid" } | { status: "invalid"; error: string } | { status: "unknown" };

async function checkPassword(password: string): Promise<PasswordCheck> {
  try {
    const res = await fetch("/api/admin-orders?stats=1", { headers: { "x-admin-password": password } });
    if (res.ok) return { status: "valid" };
    if (res.status === 401) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { status: "invalid", error: data.error ?? "Incorrect password" };
    }
    // Server/config error (500, etc.) - we can't tell if the password is right, so don't sign out.
    return { status: "unknown" };
  } catch {
    // Network error (offline, dev machine hiccup) - same as above, stay signed in.
    return { status: "unknown" };
  }
}

function Login({ onSignedIn }: { onSignedIn: (password: string) => void }) {
  const { brand, logoUrl } = useStudioBranding();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await checkPassword(password);
    setLoading(false);
    if (result.status === "invalid") {
      setError(result.error);
      return;
    }
    if (result.status === "unknown") {
      setError("Could not reach the server. Please check your connection and try again.");
      return;
    }
    storePassword(password);
    onSignedIn(password);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logoUrl} alt={brand} className="size-24 shrink-0 rounded-full object-cover ring-1 ring-border" />
          <h1 className="font-serif text-2xl leading-tight">{brand}</h1>
        </div>
        <p className="pt-4 text-center text-sm text-muted-foreground">Enter the admin password to manage your website.</p>
        <input
          type="password"
          required
          autoFocus
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-5 h-12 w-full rounded-xl border bg-background px-4 text-sm"
        />
        {error && <p className="pt-2 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {loading && <Loader2 className="size-4 animate-spin" />} Sign In
        </button>
      </form>
    </div>
  );
}

function Dashboard({ password, onSignOut }: { password: string; onSignOut: () => void }) {
  const { brand, logoUrl } = useStudioBranding();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const Component = active.Component;

  const choose = (id: TabId) => {
    setTab(id);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3">
        <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-xl border bg-background hover:bg-muted">
          <Menu className="size-5" />
        </button>
        <img src={logoUrl} alt={brand} className="size-8 shrink-0 rounded-full object-cover ring-1 ring-border" />
        <h1 className="truncate font-serif text-xl">{brand}</h1>
        <span className="ml-auto shrink-0 text-sm text-muted-foreground">{active.label}</span>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-4">
              <h2 className="px-2 font-serif text-xl">Menu</h2>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-xl hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-5">
              {GROUPS.map((g) => (
                <div key={g.id}>
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                  <div className="space-y-1">
                    {TABS.filter((t) => t.group === g.id).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => choose(t.id)}
                        className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <button onClick={onSignOut} className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              <LogOut className="size-4" /> Sign Out
            </button>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <Component password={password} />
      </main>
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(() => getStoredPassword());
  const [verifying, setVerifying] = useState(!!password);

  // Re-validate a stored password on load, in case it's been changed since the last visit.
  // Only ever signs the admin out when the server actively rejects the password (401) - a
  // network hiccup or cold-start error must never log a valid admin out on a simple refresh.
  useEffect(() => {
    if (!password) return;
    void checkPassword(password).then((result) => {
      if (result.status === "invalid") {
        clearStoredPassword();
        setPassword(null);
        toast.error("Your admin session expired. Please sign in again.");
      }
      setVerifying(false);
    });
  }, [password]);

  if (verifying) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!password) return <Login onSignedIn={setPassword} />;
  return (
    <Dashboard
      password={password}
      onSignOut={() => {
        clearStoredPassword();
        setPassword(null);
      }}
    />
  );
}
