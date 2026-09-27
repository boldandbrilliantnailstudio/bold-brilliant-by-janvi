import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import Index from "./pages/Index.tsx";
import ShopPage from "./pages/Shop.tsx";
import ProductPage from "./pages/Product.tsx";
import BookPage from "./pages/Book.tsx";
import OrdersPage from "./pages/Orders.tsx";
import ProfilePage from "./pages/Profile.tsx";
import FounderPage from "./pages/Founder.tsx";
import AdminPage from "./pages/admin.tsx";
import { CartProvider } from "./hooks/use-cart.tsx";
import { SiteSettingsProvider } from "./hooks/use-site-settings.tsx";
import ProfileProvider from "./components/profile/profile-provider.tsx";

// /admin shows a separate password-gated dashboard for the studio owner - see src/pages/admin.tsx.
// Shop, Book, Orders, Profile and Founder each have their own standalone page (no home page
// sections) - see src/pages/Shop.tsx, Book.tsx, Orders.tsx, Profile.tsx and Founder.tsx.
// /shop/<slug> is a single product's own page (see src/pages/Product.tsx) - it's checked before
// the plain /shop list so a product slug never falls through to the shop grid.
const path = window.location.pathname;
const isAdmin = path.startsWith("/admin");
const productSlugMatch = /^\/shop\/([^/]+)\/?$/.exec(path);
const isShop = !productSlugMatch && path.startsWith("/shop");
const isBook = path.startsWith("/book");
const isOrders = path.startsWith("/orders");
const isProfile = path.startsWith("/profile");
const isFounder = path.startsWith("/founder");

// Browsers sometimes restore the previous scroll position on reload (or when returning from the
// back-forward cache), dropping visitors into the middle of the page instead of the top. Force
// every fresh load to start at the top, unless the url points at a specific section via a hash.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const forceScrollTop = () => {
  if (!window.location.hash) {
    window.scrollTo(0, 0);
  }
};

forceScrollTop();
// Some browsers restore scroll position after the initial script runs (once layout/images settle),
// so re-apply on the window's load event and when the page is restored from cache.
window.addEventListener("load", forceScrollTop);
window.addEventListener("pageshow", forceScrollTop);

function CurrentPage() {
  if (productSlugMatch) return <ProductPage slug={decodeURIComponent(productSlugMatch[1])} />;
  if (isShop) return <ShopPage />;
  if (isBook) return <BookPage />;
  if (isOrders) return <OrdersPage />;
  if (isProfile) return <ProfilePage />;
  if (isFounder) return <FounderPage />;
  return <Index />;
}

createRoot(document.getElementById("root")!).render(
  isAdmin ? (
    <>
      <AdminPage />
      <Toaster position="top-center" richColors />
    </>
  ) : (
    <SiteSettingsProvider>
      <CartProvider>
        <ProfileProvider>
          <CurrentPage />
        </ProfileProvider>
        <Toaster position="top-center" richColors />
      </CartProvider>
    </SiteSettingsProvider>
  ),
);
