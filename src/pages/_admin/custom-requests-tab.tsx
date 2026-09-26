// Custom Requests admin tab: design requests from Shop > Custom Sets. Reply on WhatsApp (opens
// the customer's chat with a greeting pre-filled) and track each request New -> Replied -> Done.
// The same requests also arrive in Telegram once "Connect Telegram" is set up below.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ImageIcon, Mail, Palette, Send } from "lucide-react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { waNumber } from "@/lib/custom-request.ts";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, Spinner } from "./ui.tsx";

type CustomRequest = {
  id: string;
  request_number: number;
  name: string;
  whatsapp: string;
  email: string | null;
  set_name: string;
  details: string;
  reference_url: string | null;
  status: "New" | "Replied" | "Done" | "Cancelled";
  created_at: string;
};

const STATUSES: CustomRequest["status"][] = ["New", "Replied", "Done", "Cancelled"];
const STATUS_COLOR: Record<CustomRequest["status"], string> = {
  New: "bg-blue-500/10 text-blue-600",
  Replied: "bg-primary/10 text-primary",
  Done: "bg-emerald-500/10 text-emerald-600",
  Cancelled: "bg-destructive/10 text-destructive",
};
// Customers are promised a reply within 2-4 hours, so flag anything still New after 4.
const OVERDUE_HOURS = 4;

function hoursWaiting(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

function TelegramCard({ password }: { password: string }) {
  const [connecting, setConnecting] = useState(false);
  const connect = async () => {
    setConnecting(true);
    const { ok, data } = await adminApi.setupTelegram(password);
    setConnecting(false);
    if (ok) toast.success(data.message ?? "Telegram connected", { duration: 10000 });
    else toast.error(data.error ?? "Could not connect Telegram", { duration: 10000 });
  };
  return (
    <AdminCard className="space-y-3">
      <div className="flex items-center gap-2">
        <Send className="size-5 text-primary" />
        <p className="font-medium">Telegram alerts</p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>In Telegram, open @BotFather, send /newbot and copy the bot token.</li>
        <li>Add it in Vercel as TELEGRAM_BOT_TOKEN and Redeploy.</li>
        <li>Click Connect Telegram, then send /start to your bot. It replies with your chat ID.</li>
        <li>Add the chat ID in Vercel as TELEGRAM_CHAT_ID, Redeploy, and click Connect Telegram again.</li>
      </ol>
      <AdminButton onClick={() => void connect()} disabled={connecting}>
        {connecting ? <Spinner /> : <Send className="size-4" />} Connect Telegram
      </AdminButton>
    </AdminCard>
  );
}

export default function CustomRequestsTab({ password }: { password: string }) {
  const [requests, setRequests] = useState<CustomRequest[] | null>(null);

  useEffect(() => {
    void adminApi.list<CustomRequest>(password, "custom_requests").then(({ ok, data }) => {
      if (ok) setRequests(data.rows ?? []);
      else {
        setRequests([]);
        toast.error(data.error ?? "Could not load requests");
      }
    });
  }, [password]);

  const updateStatus = async (r: CustomRequest, status: CustomRequest["status"]) => {
    const { ok, data } = await adminApi.update(password, "custom_requests", { id: r.id, status });
    if (!ok) {
      toast.error(data.error ?? "Could not update request");
      return;
    }
    setRequests((prev) => prev?.map((x) => (x.id === r.id ? { ...x, status } : x)) ?? null);
  };

  const replyOnWhatsapp = (r: CustomRequest) => {
    const text = `Hi ${r.name}! This is Bold & Brilliant about your ${r.set_name} request #${r.request_number}.`;
    window.open(`https://wa.me/${waNumber(r.whatsapp)}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    if (r.status === "New") void updateStatus(r, "Replied");
  };

  const newCount = requests?.filter((r) => r.status === "New").length ?? 0;

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Custom Requests{newCount > 0 && <span className="pl-2 text-base text-primary">({newCount} new)</span>}</h2>
      <TelegramCard password={password} />

      {requests === null ? (
        <EmptyRow>Loading requests...</EmptyRow>
      ) : requests.length === 0 ? (
        <EmptyRow>No custom set requests yet.</EmptyRow>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const waited = hoursWaiting(r.created_at);
            const overdue = r.status === "New" && waited >= OVERDUE_HOURS;
            return (
              <AdminCard key={r.id} className={`space-y-3 ${overdue ? "border-destructive/50" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <Palette className="mt-1 size-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-medium">#{r.request_number} · {r.set_name}</p>
                      <p className="text-sm text-muted-foreground">{r.name} · {r.whatsapp}</p>
                      {r.email && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="size-3.5" /> {r.email}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words pt-2 text-sm">{r.details}</p>
                      {r.reference_url && (
                        <a href={r.reference_url} target="_blank" rel="noreferrer" className="mt-2 flex w-fit items-center gap-2">
                          <img src={r.reference_url} alt="Reference" className="size-20 rounded-xl object-cover ring-1 ring-border" />
                          <span className="flex items-center gap-1 text-xs text-primary"><ImageIcon className="size-3.5" /> Open photo</span>
                        </a>
                      )}
                      <p className="pt-2 text-xs text-muted-foreground">Received {new Date(r.created_at).toLocaleString("en-IN")}</p>
                      {overdue && (
                        <p className="flex items-center gap-1 pt-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="size-3.5" /> Waiting {waited} hours for a reply
                        </p>
                      )}
                    </div>
                  </div>
                  <select
                    value={r.status}
                    onChange={(e) => void updateStatus(r, e.target.value as CustomRequest["status"])}
                    className={`${FIELD} w-auto ${STATUS_COLOR[r.status]}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => replyOnWhatsapp(r)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-medium text-white hover:opacity-90"
                >
                  <WhatsappLogo size={18} weight="fill" /> Reply on WhatsApp
                </button>
              </AdminCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
