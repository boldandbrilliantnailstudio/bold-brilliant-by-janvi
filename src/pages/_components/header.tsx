import { NAV } from "@/lib/site-config.ts";
import { useSiteSettings } from "@/hooks/use-site-settings.tsx";
import { useCart } from "@/hooks/use-cart.tsx";
import { useState } from "react";
import { ShoppingBasket } from "lucide-react";
import CartDialog from "./cart-dialog.tsx";

const ICON_BTN = "relative grid size-10 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent";

// Simple top navbar. Profile lives in the bottom nav, and the full menu lives in the footer,
// so there is no hamburger menu here - it would just duplicate those.
export default function Header() {
  const [showCart, setShowCart] = useState(false);
  const { count } = useCart();
  const settings = useSiteSettings();

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-border bg-card/85 px-4 py-3 text-foreground shadow-sm backdrop-blur-md">
        <a href="/" className="flex items-center gap-2.5">
          <img src={settings.logoUrl} alt={settings.brand} className="size-14 rounded-full object-cover ring-1 ring-border" />
          <span className="font-serif text-xl font-semibold leading-none">{settings.brand}</span>
        </a>
        <ul className="hidden gap-6 text-sm lg:gap-7 md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="transition-colors hover:text-primary">{n.label}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2.5">
          <a href="/book" className="hidden rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground transition-transform hover:scale-105 md:inline-block">
            Book Now
          </a>
          <button aria-label={`Open basket (${count} items)`} onClick={() => setShowCart(true)} className={ICON_BTN}>
            <ShoppingBasket className="size-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
                {count}
              </span>
            )}
          </button>
        </div>
      </nav>

      <CartDialog open={showCart} onClose={() => setShowCart(false)} />
    </header>
  );
}
