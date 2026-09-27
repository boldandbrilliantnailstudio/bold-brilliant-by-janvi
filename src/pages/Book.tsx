// Standalone Booking page - own URL (/book), no Home hero or other home page sections.
import Header from "./_components/header.tsx";
import Booking from "./_components/booking.tsx";
import MyBookings from "./_components/my-bookings.tsx";
import Footer from "./_components/footer.tsx";
import BackToTop from "./_components/back-to-top.tsx";
import BottomNav from "./_components/bottom-nav.tsx";
import PromoBanner from "./_components/promo-banner.tsx";

export default function BookPage() {
  return (
    <>
      <PromoBanner placement="top_bar" className="rounded-none" />
      <Header />
      <main className="pb-16 pt-24 md:pb-0 md:pt-28">
        <Booking />
        <MyBookings />
      </main>
      <Footer />
      <BackToTop />
      <BottomNav />
    </>
  );
}
