import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import AmbientVideo from "@/components/ambient-video.tsx";
import { useSiteSettings } from "@/hooks/use-site-settings.tsx";
import PromoBanner from "./promo-banner.tsx";

// 3D-inspired glossy nail shapes (pure CSS gradients, no 3D library)
const NAILS = [
  { left: "6%", top: "22%", size: 54, rot: -18, hue: "from-pink-300 via-rose-400 to-fuchsia-500", dur: 7 },
  { left: "86%", top: "18%", size: 42, rot: 22, hue: "from-amber-100 via-yellow-300 to-amber-500", dur: 8 },
  { left: "80%", top: "70%", size: 60, rot: -8, hue: "from-rose-100 via-pink-200 to-rose-400", dur: 9 },
  { left: "12%", top: "74%", size: 38, rot: 30, hue: "from-fuchsia-200 via-pink-400 to-rose-600", dur: 6.5 },
];
const SPARKS = Array.from({ length: 8 }, (_, i) => ({ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, d: 3 + (i % 4) }));

export default function Hero() {
  const reduce = useReducedMotion();
  const settings = useSiteSettings();
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <section id="top" className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-gradient-to-b from-rose-50 via-pink-50 to-background">
      {/* Video only - no poster image, so the video appears directly. */}
      <AmbientVideo src={settings.heroVideoUrl} className="absolute inset-0 h-full w-full object-cover" />
      {/* Light wash over the video so the section reads bright, with a soft fade into the page below. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/35 to-background/90" />
      <div className="absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-pink-400/25 blur-[80px]" />
      <div className="absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-amber-300/20 blur-[80px]" />

      {!reduce && (
        <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
          {NAILS.map((n, i) => (
            <motion.div
              key={i}
              className="absolute [perspective:600px]"
              style={{ left: n.left, top: n.top }}
              animate={{ y: [0, -22, 0] }}
              transition={{ duration: n.dur, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                className={`relative rounded-t-full rounded-b-[40%] bg-gradient-to-br ${n.hue} shadow-[0_20px_40px_-10px_rgba(236,72,153,0.45)]`}
                style={{ width: n.size, height: n.size * 1.5, rotate: n.rot }}
                animate={{ rotateY: [0, 25, -25, 0], rotateX: [0, 10, 0] }}
                transition={{ duration: n.dur * 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute left-[18%] top-[10%] h-[45%] w-[22%] rounded-full bg-white/70 blur-[2px]" />
              </motion.div>
            </motion.div>
          ))}
          {SPARKS.map((s, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-primary/70 shadow-[0_0_8px_2px_rgba(236,72,153,0.5)]"
              style={{ left: s.left, top: s.top }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 0.5] }}
              transition={{ duration: s.d, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-28 pt-28 text-center md:pb-0 md:pt-28">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/80 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-primary shadow-sm backdrop-blur-md"
        >
          <Sparkles className="size-3.5 text-amber-500" /> Luxury Nail Studio · Rajkot
        </motion.p>
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.15, ease }}
          className="pt-6 font-serif text-5xl font-semibold leading-[1.05] text-balance text-foreground sm:text-6xl md:text-8xl"
        >
          Beautiful Nails.{" "}
          <em className="bg-gradient-to-r from-primary via-rose-500 to-primary bg-clip-text font-medium text-transparent">
            Your Signature Style.
          </em>
        </motion.h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease }}
          className="mx-auto max-w-xl pt-6 text-base text-muted-foreground md:text-lg"
        >
          Rajkot's premium nail art studio for bridal nails, extensions, French tips and 3D designs, hand-crafted with precision and care.
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease }}
          className="flex flex-col items-center justify-center gap-3 pt-8 sm:flex-row"
        >
          <a href="/book" className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-medium text-primary-foreground shadow-[0_10px_40px_-8px] shadow-primary transition-all hover:scale-105">
            Book Your Appointment <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a href="/shop" className="rounded-full border border-primary/25 bg-white/80 px-8 py-4 font-medium text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-white">
            Shop Nail Sets
          </a>
        </motion.div>
        <PromoBanner placement="hero" className="mx-auto mt-8 max-w-xl" />
      </div>
    </section>
  );
}
