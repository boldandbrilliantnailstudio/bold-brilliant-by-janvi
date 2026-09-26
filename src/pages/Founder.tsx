// Standalone Founder page (/founder) - own URL, no Home hero or other home page sections.
// This is the only place "Janvi Sarang" is shown by name across the site.
import Header from "./_components/header.tsx";
import Founder from "./_components/founder.tsx";
import Footer from "./_components/footer.tsx";
import BackToTop from "./_components/back-to-top.tsx";
import BottomNav from "./_components/bottom-nav.tsx";
import PromoBanner from "./_components/promo-banner.tsx";

export default function FounderPage() {
  return (
    <>
      <PromoBanner placement="top_bar" className="rounded-none" />
      <Header />
      <main className="pb-16 pt-24 md:pb-0 md:pt-28">
        <Founder />
      </main>
      <Footer />
      <BackToTop />
      <BottomNav />
    </>
  );
}
