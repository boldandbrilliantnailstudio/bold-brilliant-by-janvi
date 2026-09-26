// Founder bio - only shown on its own page (/founder), not on the home page. This is the only
// place the founder's name is displayed by name across the site.
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import { useSiteSettings } from "@/hooks/use-site-settings.tsx";
import { useSiteContent } from "@/hooks/use-site-content.ts";

const DEFAULT_BIO =
  "What started as a love for nail art grew into a space where I can turn creative ideas into personalised nail sets, crafted with patience, precision and lots of love.";

export default function Founder() {
  const settings = useSiteSettings();
  const content = useSiteContent();
  const bio = content?.founder?.body.trim() || DEFAULT_BIO;
  const founderName = settings.byline.replace(/^by\s+/i, "");

  return (
    <section className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <SectionHeading eyebrow="Meet the Founder" title="About the Artist" />
        <Reveal>
          <div className="rounded-[2rem] border bg-card/60 p-6 shadow-2xl shadow-primary/10 backdrop-blur-sm md:p-10">
            <img
              src={settings.founderPhotoUrl}
              alt={`Founder and nail artist at the ${settings.brand} studio`}
              loading="lazy"
              width={320}
              height={320}
              className="mx-auto aspect-square w-40 rounded-full object-cover object-top shadow-xl shadow-primary/20 sm:w-48"
            />
            <h2 className="pt-6 text-center font-serif text-3xl font-semibold">Hi, I&apos;m {founderName}</h2>
            <p className="pt-1 text-center text-sm font-medium uppercase tracking-[0.25em] text-primary">The artist behind {settings.brand}</p>
            <div className="space-y-4 whitespace-pre-line pt-6 text-center text-muted-foreground">{bio}</div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
