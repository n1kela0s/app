import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Skull, Minus, ChevronLeft, ChevronRight, X } from "lucide-react";
import Pokeball from "@/components/Pokeball";

const CAT = {
  ally:    { icon: Shield, color: "emerald", border: "border-emerald-500/40", glow: "shadow-[0_0_30px_rgba(16,185,129,0.5)]", chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50", label: "Alleato" },
  neutral: { icon: Minus,  color: "amber",   border: "border-amber-500/40",   glow: "shadow-[0_0_30px_rgba(251,191,36,0.5)]",  chip: "bg-amber-500/20 text-amber-300 border-amber-500/50",     label: "Neutro" },
  enemy:   { icon: Skull,  color: "rose",    border: "border-rose-500/40",    glow: "shadow-[0_0_30px_rgba(244,63,94,0.5)]",   chip: "bg-rose-500/20 text-rose-300 border-rose-500/50",        label: "Nemico" },
};

function romanize(n) {
  if (n <= 0) return "";
  const map = [["M",1000],["CM",900],["D",500],["CD",400],["C",100],["XC",90],["L",50],["XL",40],["X",10],["IX",9],["V",5],["IV",4],["I",1]];
  let out = ""; let num = n;
  for (const [r, v] of map) { while (num >= v) { out += r; num -= v; } }
  return out;
}

export default function TurnTrack({
  ordered,        // array di pokemon attivi ordinati per iniziativa desc
  activeId,       // id del pokemon attualmente in turno
  round,          // numero round (1+)
  roundEnd,       // bool — overlay "tocca agli allenatori"
  isMaster,       // master mostra controlli
  onPrev,
  onNext,
  onCloseRoundEnd, // master può chiudere overlay con il next
  onRemove,        // master: rimuovi un pokemon dal campo
}) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  // Auto-scroll: mantieni la card attiva al centro del track (con padding 50% ai lati)
  useEffect(() => {
    if (!scrollRef.current || !activeRef.current) return;
    const container = scrollRef.current;
    const card = activeRef.current;
    const cRect = container.getBoundingClientRect();
    const tRect = card.getBoundingClientRect();
    const cardCenter = (tRect.left + tRect.right) / 2 - cRect.left + container.scrollLeft;
    const target = cardCenter - cRect.width / 2;
    container.scrollTo({ left: target, behavior: "smooth" });
  }, [activeId, ordered.length]);

  if (!ordered || ordered.length === 0) return null;

  return (
    <div className="relative" data-testid="turn-track">
      {/* Round header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-4 py-1.5 backdrop-blur-md">
            <p className="font-pixel text-[8px] uppercase tracking-[0.3em] text-amber-300/70">Round</p>
            <p className="font-heading text-lg font-black tracking-wider text-amber-200" data-testid="turn-round-roman">
              {romanize(round)}
            </p>
          </div>
          <div className="hidden text-xs text-slate-500 sm:block">
            {ordered.findIndex((p) => p.id === activeId) + 1}<span className="text-slate-700"> / {ordered.length}</span> · turno
          </div>
        </div>

        {isMaster && (
          <div className="flex items-center gap-2" data-testid="turn-controls">
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

      {/* Horizontal track — scrollbar nascosta, padding ai lati per permettere centraggio della prima/ultima card */}
      <div
        ref={scrollRef}
        className="relative overflow-x-auto scroll-smooth pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-end gap-4 pt-6 sm:gap-5" style={{ paddingInline: "50%" }}>
          {ordered.map((img, idx) => {
            const cat = img.category || "neutral";
            const meta = CAT[cat];
            const Icon = meta.icon;
            const isActive = img.id === activeId;
            return (
              <motion.div
                key={img.id}
                ref={isActive ? activeRef : null}
                layout
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className={`group/card relative flex flex-shrink-0 flex-col items-center gap-2 ${isActive ? "z-10" : ""}`}
                data-testid={`turn-slot-${img.id}`}
                data-active={isActive}
              >
                {/* rank */}
                <div className={`flex h-6 w-6 items-center justify-center rounded-full font-heading text-[11px] font-black ring-2 ring-slate-950 ${isActive ? "bg-gradient-to-br from-amber-300 to-orange-400 text-slate-950 shadow-[0_0_14px_rgba(251,191,36,0.7)]" : "bg-slate-800 text-slate-400"}`}>
                  {idx + 1}
                </div>

                {/* card */}
                <motion.div
                  layout
                  animate={{
                    scale: isActive ? 1 : 0.78,
                    y: isActive ? -4 : 4,
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className={`relative overflow-hidden rounded-2xl border-2 bg-slate-950 ${meta.border} ${isActive ? meta.glow : "opacity-70 grayscale-[20%]"}`}
                  style={{ width: isActive ? 200 : 130 }}
                >
                  {isActive && (
                    <motion.div
                      animate={{ opacity: [0.35, 0.7, 0.35] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cat === "ally" ? "from-emerald-500/20" : cat === "enemy" ? "from-rose-500/20" : "from-amber-500/20"} via-transparent to-transparent`}
                    />
                  )}
                  <div className={`flex items-center justify-center bg-slate-950/80 ${isActive ? "h-44" : "h-28"}`}>
                    <img src={img.url} alt={img.caption} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="border-t border-white/5 bg-slate-950/85 px-2 py-1.5 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${meta.chip}`}>
                      <Icon className="h-2 w-2" /> {meta.label}
                    </span>
                    {img.caption && (
                      <p className={`mt-1 font-heading font-bold tracking-tight text-slate-100 line-clamp-1 ${isActive ? "text-sm" : "text-[10px]"}`}>
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
