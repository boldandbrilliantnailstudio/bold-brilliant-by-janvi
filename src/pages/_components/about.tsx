import { Brush, Gem, HeartHandshake, ScanEye, ShieldCheck } from "lucide-react";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import { useSiteSettings } from "@/hooks/use-site-settings.tsx";
import { useSiteContent, useSiteContentList } from "@/hooks/use-site-content.ts";

type WhyCard = { title: string; text: string };

// Icons cycle in this order for admin-added cards; the built-in defaults keep their own icons.
const CARD_ICONS = [Brush, HeartHandshake, Gem, ScanEye];

const DEFAULT_CARDS: WhyCard[] = [
  { title: "Creative Designs", text: "Original artwork, trend-led and hand-painted." },
  { title: "Custom Styles", text: "Shapes, shades and details tailored to you." },
  { title: "Premium Experience", text: "Quality products in a calm, beautiful studio." },
  { title: "Attention to Detail", text: "Clean cuticles, precise lines, lasting finish." },
];

const DEFAULT_ABOUT =
  "Bold & Brilliant is a nail studio in Rajkot where nails become wearable art.\n\nFrom minimal elegance to intricate bridal and 3D designs, every set is thoughtfully created around your style, occasion and personality.";

export default function About() {
  const settings = useSiteSettings();
  const content = useSiteContent();
  const aboutText = content?.about?.body.trim() || DEFAULT_ABOUT;
  const cardsFromAdmin = useSiteContentList<WhyCard>(content, "why_choose_us");
  const cards = cardsFromAdmin?.length ? cardsFromAdmin : DEFAULT_CARDS;

  return (
    <section id="about" className="bg-gradient-to-b from-background via-secondary/50 to-background px-5 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 pb-14 md:grid-cols-2">
          <Reveal>
            <img src={settings.logoUrl} alt={settings.brand} loading="lazy" className="mx-auto aspect-square w-full max-w-xs rounded-[2rem] object-cover shadow-2xl shadow-primary/20 sm:max-w-sm" />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="pb-3 text-xs font-medium uppercase tracking-[0.3em] text-primary">About me</p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">About {settings.brand}</h2>
            <div className="space-y-4 whitespace-pre-line pt-6 text-muted-foreground">{aboutText}</div>
            <p className="flex items-center gap-2 pt-6 text-sm font-medium">
              <ShieldCheck className="size-5 text-primary" /> Sterilised tools & strict hygiene for every client
            </p>
          </Reveal>
        </div>

        <SectionHeading eyebrow="Why choose us" title="Crafted With Intention" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => {
            const Icon = CARD_ICONS[i % CARD_ICONS.length];
            return (
              <Reveal key={`${c.title}-${i}`} delay={i * 0.08}>
                <div className="group h-full rounded-3xl border bg-card/70 p-6 backdrop-blur transition-all duration-500 hover:-translate-y-2 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
                  <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="pt-5 font-serif text-2xl">{c.title}</h3>
                  <p className="pt-2 text-sm text-muted-foreground">{c.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
