import { Home, ShoppingBag, CalendarCheck, PackageSearch, User } from "lucide-react";
import { useProfile } from "@/hooks/use-profile.ts";
import { cn } from "@/lib/utils.ts";

// Mobile-only bottom app bar. Each item opens its own standalone page - this is the only
// navigation on mobile (no header hamburger menu), so it always shows the full app-like nav.
const ITEMS = [
  { label: "Home", href: "/", Icon: Home },
  { label: "Shop", href: "/shop", Icon: ShoppingBag },
  { label: "Book", href: "/book", Icon: CalendarCheck },
  { label: "Orders", href: "/orders", Icon: PackageSearch },
] as const;

export default function BottomNav() {
  const { profile, isSignedIn, avatarUrl } = useProfile();
  const initial = isSignedIn && profile ? profile.fullName.charAt(0).toUpperCase() : null;

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ label, href, Icon }) => (
          <li key={href}>
            <a href={href} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary">
              <Icon className="size-5" />
              {label}
            </a>
          </li>
        ))}
        <li>
          <a href="/profile" className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary">
            {isSignedIn && avatarUrl ? (
              <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="size-5 rounded-full object-cover" />
            ) : (
              <span className={cn("grid size-5 place-items-center rounded-full", initial && "bg-primary text-primary-foreground")}>
                {initial ? <span className="text-[10px] font-serif font-semibold">{initial}</span> : <User className="size-5" />}
              </span>
            )}
            Profile
          </a>
        </li>
      </ul>
    </nav>
  );
}
