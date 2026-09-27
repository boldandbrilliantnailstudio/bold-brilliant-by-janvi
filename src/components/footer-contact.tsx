// Footer contact list (email, WhatsApp, phone, address, maps, hours). Each line is switched
// on/off from Admin > Contact & Social and hidden automatically when its value is empty.
// Also used as the live preview inside the admin tab.
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { whatsappLinkFor, type SiteSettingsValues } from "@/hooks/use-site-settings.tsx";
import { cn } from "@/lib/utils.ts";

type ContactSettings = Pick<
  SiteSettingsValues,
  | "email" | "whatsappNumber" | "phone" | "address" | "mapsUrl" | "hours"
  | "showFooterEmail" | "showFooterWhatsapp" | "showFooterPhone" | "showFooterAddress" | "showFooterMaps" | "showFooterHours"
>;

const ROW = "flex items-start gap-2 text-sm text-muted-foreground transition-colors hover:text-primary";

export default function FooterContact({ settings: s, className }: { settings: ContactSettings; className?: string }) {
  const hours = s.hours.filter((h) => h.day.trim() || h.time.trim());
  const items = [
    s.showFooterEmail && s.email.trim() && (
      <a key="email" href={`mailto:${s.email.trim()}`} className={ROW}>
        <Mail className="mt-0.5 size-4 shrink-0" /> <span className="break-all">{s.email.trim()}</span>
      </a>
    ),
    s.showFooterWhatsapp && s.whatsappNumber.trim() && (
      <a key="wa" href={whatsappLinkFor(s.whatsappNumber.trim())} target="_blank" rel="noopener noreferrer" className={ROW}>
        <WhatsappLogo size={16} className="mt-0.5 shrink-0" /> <span>WhatsApp: +{s.whatsappNumber.trim().replace(/^\+/, "")}</span>
      </a>
    ),
    s.showFooterPhone && s.phone.trim() && (
      <a key="phone" href={`tel:${s.phone.replace(/\s/g, "")}`} className={ROW}>
        <Phone className="mt-0.5 size-4 shrink-0" /> <span>Call: {s.phone.trim()}</span>
      </a>
    ),
    s.showFooterAddress && s.address.trim() && (
      <p key="addr" className={cn(ROW, "hover:text-muted-foreground")}>
        <MapPin className="mt-0.5 size-4 shrink-0" /> <span className="whitespace-pre-line">{s.address.trim()}</span>
      </p>
    ),
    s.showFooterMaps && s.mapsUrl.trim() && (
      <a key="maps" href={s.mapsUrl.trim()} target="_blank" rel="noopener noreferrer" className={ROW}>
        <Navigation className="mt-0.5 size-4 shrink-0" /> <span>Get Directions</span>
      </a>
    ),
    s.showFooterHours && hours.length > 0 && (
      <div key="hours" className="flex items-start gap-2 text-sm text-muted-foreground">
        <Clock className="mt-0.5 size-4 shrink-0" />
        <div>
          {hours.map((h, i) => (
            <p key={i}>
              {h.day} {h.day && h.time ? "·" : ""} {h.time}
            </p>
          ))}
        </div>
      </div>
    ),
  ].filter(Boolean);

  if (items.length === 0) return null;
  return <div className={cn("grid gap-2.5", className)}>{items}</div>;
}
