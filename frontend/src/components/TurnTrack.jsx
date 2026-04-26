import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Skull, Minus, ChevronLeft, ChevronRight, X, Swords } from "lucide-react";
import Pokeball from "@/components/Pokeball";

const CAT = {
  ally:    { icon: Shield, color: "emerald", border: "border-emerald-500/40", glow: "shadow-[0_0_40px_rgba(16,185,129,0.55)]", chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50", label: "Alleato", grad: "from-emerald-500/30 via-emerald-500/0 to-emerald-500/0", aura: "rgba(16,185,129,0.4)" },
  neutral: { icon: Minus,  color: "amber",   border: "border-amber-500/40",   glow: "shadow-[0_0_40px_rgba(251,191,36,0.55)]", chip: "bg-amber-500/20 text-amber-300 border-amber-500/50",     label: "Neutro",  grad: "from-amber-500/25 via-amber-500/0 to-amber-500/0",     aura: "rgba(251,191,36,0.4)" },
  enemy:   { icon: Skull,  color: "rose",    border: "border-rose-500/40",    glow: "shadow-[0_0_40px_rgba(244,63,94,0.55)]",  chip: "bg-rose-500/20 text-rose-300 border-rose-500/50",        label: "Nemico",  grad: "from-rose-500/30 via-rose-500/0 to-rose-500/0",         aura: "rgba(244,63,94,0.4)" },
};

function romanize(n) {
  if (n <= 0) return "";
  const map = [["M",1000],["CM",900],["D",500],["CD",400],["C",100],["XC",90],["L",50],["XL",40],["X",10],["IX",9],["V",5],["IV",4],["I",1]];
  let out = ""; let num = n;
  for (const [r, v] of map) { while (num >= v) { out += r; num -= v; } }
  return out;
}

export default function TurnTrack({
  ordered,
  activeId,
  round,
  roundEnd,
  isMaster,
  onPrev,
  onNext,
  onCloseRoundEnd,
  onRemove,
  heroMode = false,   // player view: layout più drammatico, card più grandi, atmosfera arena
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const center = () => {
      const container = scrollRef.current;
      if (!container || cancelled) return;
      const card = container.querySelector('[data-active="true"]');
      if (!card) return;
      const target = card.offsetLeft + card.offsetWidth / 2 - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    };
    center();
    const ids = [80, 250, 450, 700].map((d) => setTimeout(center, d));
    // re-center quando cambia la dimensione del viewport
    const onResize = () => center();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      ids.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
    };
  }, [activeId, ordered.length]);

  if (!ordered || ordered.length === 0) return null;

  const activePoke = ordered.find((p) => p.id === activeId);
  const activeCat = activePoke ? (activePoke.category || "neutral") : "neutral";
  const activeMeta = CAT[activeCat];

  // Sizing — più grandi in heroMode (player view)
  const sizes = heroMode
    ? { activeW: "clamp(220px, 32vw, 320px)", inactiveW: "clamp(120px, 16vw, 190px)", activeH: "clamp(180px, 26vw, 260px)", inactiveH: "clamp(110px, 16vw, 160px)", gap: "gap-4 sm:gap-6 md:gap-7" }
    : { activeW: "200px", inactiveW: "130px", activeH: "176px", inactiveH: "112px", gap: "gap-4 sm:gap-5" };

  return (
    <div className={`relative ${heroMode ? "py-2" : ""}`} data-testid="turn-track">
      {/* Atmospheric backdrop (heroMode only) */}
      {heroMode && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {/* radial pulse synced con categoria del pokémon attivo */}
          <motion.div
            key={activeId + "-aura"}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0.45, 0.7, 0.45], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${activeMeta.aura} 0%, transparent 65%)` }}
          />
          {/* arena floor stripe */}
          <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${activeMeta.grad}`} />
          {/* sparse animated dots */}
          {[...Array(14)].map((_, i) => (
            <motion.span
              key={i}
              className="absolute block h-1 w-1 rounded-full bg-white/30"
              style={{ left: `${(i * 73) % 100}%`, top: `${(i * 41) % 100}%` }}
              animate={{ opacity: [0.1, 0.6, 0.1], y: [0, -8, 0] }}
              transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
            />
          ))}
        </div>
      )}

      {/* Round header */}
      <div className={`relative mb-3 flex items-center ${heroMode ? "flex-col gap-2" : "justify-between gap-3"}`}>
        <div className={`flex items-center gap-3 ${heroMode ? "flex-col" : ""}`}>
          <motion.div
            key={`round-${round}`}
            initial={{ scale: 0.7, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className={`relative flex items-center ${heroMode ? "flex-col gap-1 px-6 py-2" : "gap-3 px-4 py-1.5"} rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 backdrop-blur-md`}
          >
            <p className={`font-pixel uppercase tracking-[0.3em] text-amber-300/70 ${heroMode ? "text-[8px]" : "text-[8px]"}`}>Round</p>
            <p className={`font-heading font-black tracking-wider text-amber-200 ${heroMode ? "text-2xl sm:text-3xl" : "text-lg"}`} data-testid="turn-round-roman">
              {romanize(round)}
            </p>
          </motion.div>
          {!heroMode && (
            <div className="hidden text-xs text-slate-500 sm:block">
              {ordered.findIndex((p) => p.id === activeId) + 1}<span className="text-slate-700"> / {ordered.length}</span> · turno
            </div>
          )}
        </div>

        {heroMode && activePoke && (
          <motion.div
            key={activeId + "-name"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col items-center gap-1"
          >
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest ${activeMeta.chip}`}>
              <Swords className="h-3 w-3" />
              In azione · {ordered.findIndex((p) => p.id === activeId) + 1}<span className="opacity-60"> / {ordered.length}</span>
            </span>
          </motion.div>
        )}

        {isMaster && (
          <div className={`flex items-center gap-2 ${heroMode ? "absolute right-0 top-0" : ""}`} data-testid="turn-controls">
            <button
              data-testid="turn-prev-btn"
              onClick={onPrev}
              title="Turno precedente"
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-500/40 bg-slate-950/80 text-amber-300 transition-all hover:border-amber-400 hover:bg-amber-500/15 hover:text-amber-200 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              data-testid="turn-next-btn"
              onClick={onNext}
              title={roundEnd ? "Round successivo" : "Turno successivo"}
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-400 bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.5)] transition-all hover:from-amber-400 hover:to-orange-400 active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal track */}
      <div
        ref={scrollRef}
        className="relative overflow-x-auto scroll-smooth pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className={`flex items-end pt-8 ${sizes.gap}`}
          style={{ width: "max-content", paddingInline: "50%" }}
        >
          {ordered.map((img, idx) => {
            const cat = img.category || "neutral";
            const meta = CAT[cat];
            const Icon = meta.icon;
            const isActive = img.id === activeId;
            return (
              <motion.div
                key={img.id}
                layout
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className={`group/card relative flex flex-shrink-0 flex-col items-center gap-2 ${isActive ? "z-10" : ""}`}
                data-testid={`turn-slot-${img.id}`}
                data-active={isActive}
              >
                {/* rank */}
                <motion.div
                  layout
                  className={`flex items-center justify-center rounded-full font-heading font-black ring-2 ring-slate-950 ${
                    isActive
                      ? "bg-gradient-to-br from-amber-300 to-orange-400 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.85)]"
                      : "bg-slate-800 text-slate-400"
                  } ${heroMode && isActive ? "h-9 w-9 text-base" : heroMode ? "h-7 w-7 text-xs" : isActive ? "h-7 w-7 text-[12px]" : "h-6 w-6 text-[11px]"}`}
                >
                  {idx + 1}
                </motion.div>

                {/* card */}
                <motion.div
                  layout
                  animate={{
                    scale: isActive ? 1 : (heroMode ? 0.86 : 0.78),
                    y: isActive ? -2 : (heroMode ? 6 : 4),
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className={`relative overflow-hidden rounded-2xl border-2 bg-slate-950/95 ${meta.border} ${isActive ? meta.glow : "opacity-75"}`}
                  style={{
                    width: isActive ? sizes.activeW : sizes.inactiveW,
                  }}
                >
                  {/* Inactive subtle desaturation */}
                  {!isActive && <div className="pointer-events-none absolute inset-0 bg-slate-950/30" />}

                  {/* Pulse glow when active */}
                  {isActive && (
                    <>
                      <motion.div
                        animate={{ opacity: [0.35, 0.7, 0.35] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${meta.grad}`}
                      />
                      {/* sparkle orbs around active */}
                      {heroMode && [...Array(6)].map((_, i) => (
                        <motion.span
                          key={i}
                          className="pointer-events-none absolute block h-1.5 w-1.5 rounded-full"
                          style={{
                            left: `${15 + (i * 17) % 70}%`,
                            top: `${10 + (i * 23) % 70}%`,
                            background: meta.aura,
                            boxShadow: `0 0 8px ${meta.aura}`,
                          }}
                          animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.3, 0.6] }}
                          transition={{ duration: 2 + (i % 3) * 0.5, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
                        />
                      ))}
                    </>
                  )}

                  <div
                    className="relative flex items-center justify-center bg-slate-950/80"
                    style={{ height: isActive ? sizes.activeH : sizes.inactiveH }}
                  >
                    <motion.img
                      src={img.url}
                      alt={img.caption}
                      className={`relative max-h-full max-w-full object-contain ${isActive && heroMode ? "drop-shadow-[0_8px_18px_rgba(0,0,0,0.7)]" : ""}`}
                      animate={isActive && heroMode ? { y: [0, -6, 0] } : { y: 0 }}
                      transition={isActive && heroMode ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : {}}
                    />
                  </div>
                  <div className={`border-t border-white/5 bg-slate-950/85 px-2 text-center ${heroMode && isActive ? "py-2" : "py-1.5"}`}>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-bold uppercase tracking-wider ${meta.chip} ${heroMode && isActive ? "text-[10px]" : "text-[8px]"}`}>
                      <Icon className="h-2 w-2" /> {meta.label}
                    </span>
                    {img.caption && (
                      <p className={`mt-1 font-heading font-bold tracking-tight text-slate-100 line-clamp-1 ${
                        isActive ? (heroMode ? "text-base sm:text-lg" : "text-sm") : (heroMode ? "text-[11px]" : "text-[10px]")
                      }`}>
                        {img.caption}
                      </p>
                    )}
                  </div>

                  {isMaster && onRemove && (
                    <button
                      data-testid={`turn-remove-${img.id}`}
                      onClick={() => onRemove(img.id)}
                      title="Rimuovi dal campo"
                      className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/90 text-rose-400 opacity-0 ring-1 ring-rose-500/40 transition-all hover:bg-rose-500/20 hover:text-rose-300 group-hover/card:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* End-of-round overlay */}
      <AnimatePresence>
        {roundEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-slate-950/96 backdrop-blur-xl"
            data-testid="round-end-screen"
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
            >
              <motion.div
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}
              >
                <Pokeball className="h-44 w-44 drop-shadow-[0_0_60px_rgba(251,191,36,0.6)]" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="px-6 text-center"
            >
              <p className="font-pixel text-[10px] uppercase tracking-[0.45em] text-amber-300/80">
                Fine round {romanize(round)}
              </p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
                Ora tocca agli <span className="bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">allenatori</span>
              </h2>
              <p className="mt-4 text-sm text-slate-500 sm:text-base">
                {isMaster ? "Premi → quando sei pronto a iniziare il prossimo round." : "Il Master sta gestendo gli allenatori..."}
              </p>
            </motion.div>

            {isMaster && (
              <motion.button
                data-testid="round-end-next-btn"
                onClick={onCloseRoundEnd}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="group flex items-center gap-3 rounded-full border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 font-heading text-base font-black uppercase tracking-widest text-slate-950 shadow-[0_0_40px_rgba(251,191,36,0.5)] transition-all hover:from-amber-400 hover:to-orange-400 hover:shadow-[0_0_60px_rgba(251,191,36,0.7)] active:scale-95 sm:text-lg"
              >
                Round {romanize(round + 1)}
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
