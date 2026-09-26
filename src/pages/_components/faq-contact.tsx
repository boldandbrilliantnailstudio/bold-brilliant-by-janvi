import { Clock, MapPin, Navigation } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import { useSiteSettings } from "@/hooks/use-site-settings.tsx";
import { useSiteContent, useSiteContentList } from "@/hooks/use-site-content.ts";

type Faq = { q: string; a: string };

const DEFAULT_FAQS: Faq[] = [
  { q: "Where is the best nail art studio in Rajkot?", a: "Bold & Brilliant is at Astha Chowk, Railnagar, Rajkot - 360001. Girls and women visit us from all over Rajkot and Gujarat for bridal nails, extensions and custom nail art." },
  { q: "How long does a nail art appointment take?", a: "Most sets take 1 to 2 hours. Bridal and detailed 3D designs can take up to 3 hours." },
  { q: "How long will my nail art last?", a: "Gel and extensions usually last 3 to 4 weeks with proper care." },
  { q: "Can I bring my own design reference?", a: "Absolutely. Share a photo while booking and we'll customise it for you." },
  { q: "Do you do bridal nail trials?", a: "Yes, we recommend a trial 1 to 2 weeks before your wedding." },
  { q: "Is the studio hygienic?", a: "All tools are sterilised after every client and we use fresh files and buffers." },
];

export default function FaqContact() {
  const settings = useSiteSettings();
  const content = useSiteContent();
  const faqsFromAdmin = useSiteContentList<Faq>(content, "faq");
  const faqs = faqsFromAdmin?.length ? faqsFromAdmin : DEFAULT_FAQS;

  return (
    <>
      <section id="faq" className="px-5 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="FAQ" title="Frequently Asked Questions" />
          <Reveal>
            <Accordion type="single" collapsible className="rounded-3xl border bg-card px-6">
              {faqs.map((f, i) => (
                <AccordionItem key={`${f.q}-${i}`} value={`${f.q}-${i}`}>
                  <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      <section id="contact" className="px-5 pb-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeading eyebrow="Visit us" title="Find Our Studio" />
          <Reveal>
            <div className="grid gap-6 rounded-[2rem] border bg-card p-8 shadow-sm md:grid-cols-2 md:p-12">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <MapPin className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl">Studio Location</h3>
                    <address className="not-italic text-muted-foreground">{settings.address}</address>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Clock className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl">Opening Hours</h3>
                    {settings.hours.map((h) => (
                      <p key={h.day} className="text-muted-foreground">{h.day}: {h.time}</p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-center gap-4 md:items-end">
                <a href={settings.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-medium text-primary-foreground transition-transform hover:scale-105">
                  <Navigation className="size-4" /> Open in Google Maps
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
