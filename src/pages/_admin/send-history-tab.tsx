// Send History admin tab (Hissa 8 fix): every ad-hoc email/WhatsApp message ever sent from
// Admin > Customers > Send Message, newest first - so the studio can see who was messaged,
// when, and with what. Read-only, backed by api/admin-send-message.ts?resource=log.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle } from "lucide-react";
import { AdminCard, EmptyRow } from "./ui.tsx";

type SendLogRow = {
  id: string;
  user_id: string;
  channel: "email" | "whatsapp";
  subject: string | null;
  body: string;
  sent_at: string;
  customerName: string;
  customerPhone: string;
};

async function callLog(password: string): Promise<{ ok: boolean; data: { log?: SendLogRow[]; error?: string } }> {
  const res = await fetch("/api/admin-send-message?resource=log", { headers: { "x-admin-password": password } });
  return { ok: res.ok, data: (await res.json()) as { log?: SendLogRow[]; error?: string } };
}

export default function SendHistoryTab({ password }: { password: string }) {
  const [log, setLog] = useState<SendLogRow[] | null>(null);

  useEffect(() => {
    void callLog(password).then(({ ok, data }) => {
      if (ok) setLog(data.log ?? []);
      else toast.error(data.error ?? "Could not load send history");
    });
  }, [password]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Send History</h2>
        <p className="text-sm text-muted-foreground">Every ad-hoc email and WhatsApp message sent from Admin &gt; Customers &gt; Send Message.</p>
      </div>
      {log === null ? (
        <EmptyRow>Loading send history...</EmptyRow>
      ) : log.length === 0 ? (
        <EmptyRow>No messages sent yet.</EmptyRow>
      ) : (
        <div className="space-y-3">
          {log.map((l) => (
            <AdminCard key={l.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {l.channel === "email" ? <Mail className="size-4 text-primary" /> : <MessageCircle className="size-4 text-primary" />}
                  <div>
                    <p className="font-medium">{l.customerName}</p>
                    <p className="text-xs text-muted-foreground">{l.customerPhone}</p>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{new Date(l.sent_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              {l.subject && <p className="text-sm font-medium">{l.subject}</p>}
              {l.channel === "email" ? (
                <div className="line-clamp-3 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: l.body }} />
              ) : (
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{l.body}</p>
              )}
            </AdminCard>
          ))}
        </div>
      )}
    </div>
  );
}
