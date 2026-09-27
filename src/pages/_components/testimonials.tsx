import { Star } from "lucide-react";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import Carousel from "@/components/carousel.tsx";
import { useReviews } from "@/hooks/use-reviews.ts";

export default function Testimonials() {
  const reviews = useReviews();
  if (reviews.length === 0) return null;

  return (
    <section id="reviews" className="bg-gradient-to-b from-background via-secondary/40 to-background px-5 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Reviews" title="Loved By Our Clients" sub="Real feedback from clients across Rajkot and beyond." />
        <Reveal>
          <Carousel itemClassName="w-[85%] sm:w-[60%] lg:w-[31%]" autoPlay autoPlayInterval={3500}>
            {reviews.map((r) => (
              <div key={r.id} className="flex h-full flex-col rounded-3xl border bg-card/70 p-6 backdrop-blur">
                <div className="flex gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="size-4" fill={j < r.rating ? "currentColor" : "none"} />
                  ))}
                </div>
                <p className="flex-1 pt-4 text-sm text-muted-foreground">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4">
                  {r.photoUrl && <img src={r.photoUrl} alt={r.name} className="size-10 rounded-full object-cover" />}
                  <div>
                    <p className="font-serif text-lg leading-tight">{r.name}</p>
                    {r.serviceName && <p className="text-xs text-muted-foreground">{r.serviceName}</p>}
                  </div>
                </div>
              </div>
            ))}
          </Carousel>
        </Reveal>
      </div>
    </section>
  );
}
