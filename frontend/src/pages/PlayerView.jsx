import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { History, LogOut, Shield, Minus, Skull, X } from "lucide-react";
import { api, wsUrl } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Pokeball from "@/components/Pokeball";
import TurnTrack from "@/components/TurnTrack";

const CATS = [
  {
    key: "ally",
    label: "Alleati",
    icon: Shield,
    accent: "emerald",
    border: "border-emerald-500/30",
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    glow: "from-emerald-500/20 via-transparent to-transparent",
    stripe: "from-emerald-500/10 to-transparent",
  },
  {
    key: "neutral",
    label: "Neutri",
    icon: Minus,
    accent: "amber",
    border: "border-amber-500/30",
    pill: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    glow: "from-amber-500/15 via-transparent to-transparent",
    stripe: "from-amber-500/10 to-transparent",
  },
  {
    key: "enemy",
    label: "Nemici",
    icon: Skull,
    accent: "rose",
    border: "border-rose-500/30",
    pill: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    glow: "from-rose-500/20 via-transparent to-transparent",
    stripe: "from-rose-500/10 to-transparent",
  },
];

export default function PlayerView() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [player, setPlayer] = useState(null);
  const [overlay, setOverlay] = useState(null); // { id, url, caption }
  const [turn, setTurn] = useState({ active: false, round: 1, active_id: null, round_end: false });
  const wsRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(`player_${code}`);
    if (!stored) { navigate("/join"); return; }
    const p = JSON.parse(stored);
    setPlayer(p);

    api.get(`/rooms/${code}`).then((res) => {
      const imgs = res.data.images || [];
      setHistory(imgs);
    }).catch(() => toast.error("Arena non disponibile"));

    const socketUrl = wsUrl(code, "player", p.id);
    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("online");

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "image") {
          const img = { ...msg.data, active: msg.data.active !== false };
          setHistory((prev) => [...prev, img]);
          toast.success(`Nuovo ${img.category === "ally" ? "Alleato" : img.category === "enemy" ? "Nemico" : "Pokémon neutro"}!`, { duration: 1800 });
        } else if (msg.type === "image_removed_field") {
          setHistory((prev) => prev.map((i) => i.id === msg.id ? { ...i, active: false } : i));
        } else if (msg.type === "image_deleted") {
          setHistory((prev) => prev.filter((i) => i.id !== msg.id));
        } else if (msg.type === "image_initiative_updated") {
          setHistory((prev) => prev.map((i) => i.id === msg.id ? { ...i, initiative: msg.initiative } : i));
        } else if (msg.type === "history_cleared") {
          setHistory([]);
          toast.info("Il Master ha pulito la cronologia");
        } else if (msg.type === "overlay_show") {
          setOverlay(msg.data);
        } else if (msg.type === "overlay_hide") {
          setOverlay(null);
        } else if (msg.type === "turn_state") {
          setTurn(msg.data);
        } else if (msg.type === "room_closed") {
          toast.info("L'arena è stata chiusa dal master");
          setTimeout(() => navigate("/"), 1500);
        }
      } catch (err) {
        console.error("Errore parsing messaggio:", err);
      }
    };

    ws.onclose = () => setStatus("offline");
    ws.onerror = () => setStatus("offline");

    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [code, navigate]);

  const leaveRoom = () => {
    localStorage.removeItem(`player_${code}`);
    navigate("/");
  };

  const active = history.filter((i) => i.active !== false);
  const byCat = {
    ally: active.filter((i) => (i.category || "neutral") === "ally"),
    neutral: active.filter((i) => (i.category || "neutral") === "neutral"),
    enemy: active.filter((i) => (i.category || "neutral") === "enemy"),
  };
  const allHaveInitiative = active.length > 0 && active.every((i) => i.initiative !== null && i.initiative !== undefined);
  const orderedActive = allHaveInitiative
    ? [...active].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
    : [];
  const rankMap = (() => {
    if (!allHaveInitiative) return {};
    const map = {};
    orderedActive.forEach((img, idx) => { map[img.id] = idx + 1; });
    return map;
  })();
  const inTurnMode = allHaveInitiative && turn.active && orderedActive.some((p) => p.id === turn.active_id);
  const anyActive = active.length > 0;

  return (
    <div className="relative flex min-h-screen w-screen flex-col overflow-hidden bg-slate-950 font-body text-slate-100 pokeball-pattern" data-testid="player-view">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />

      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3 rounded-full border-2 border-red-500/30 bg-slate-950/70 px-4 py-2 backdrop-blur-md">
          <Pokeball className="h-6 w-6" />
          <span className="font-heading text-sm font-bold tracking-[0.25em] text-red-400">{code}</span>
          <span className="mx-1 h-3 w-px bg-white/10" />
          <span className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className={`h-1.5 w-1.5 rounded-full ${status === "online" ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            {player?.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <button
                data-testid="player-history-trigger"
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-500/30 bg-slate-950/70 text-amber-400 backdrop-blur-md transition-all hover:border-amber-500/80 hover:bg-amber-500/10"
              >
                <History className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-md border-amber-500/20 bg-slate-950/95 text-slate-100 backdrop-blur-2xl">
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Pokeball className="h-8 w-8" />
                  <div>
                    <p className="font-pixel text-[9px] uppercase tracking-widest text-amber-400">Pokédex Battaglia</p>
                    <SheetTitle className="font-heading text-2xl font-bold text-slate-50">Storico</SheetTitle>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{history.length} Pokémon schierati in questa sessione</p>
              </SheetHeader>
              <ScrollArea className="mt-6 h-[calc(100vh-160px)] pr-3">
                <div className="flex flex-col gap-4">
                  {[...history].reverse().map((img) => {
                    const cat = img.category || "neutral";
                    const meta = CATS.find((c) => c.key === cat);
                    const Icon = meta.icon;
                    const isActive = img.active !== false;
                    return (
                      <div key={img.id} className={`overflow-hidden rounded-xl border-2 ${meta.border} bg-slate-900/60`} data-testid={`player-history-${img.id}`}>
                        <div className="relative">
                          <img src={img.url} alt={img.caption} className={`w-full object-cover ${isActive ? "" : "opacity-50 grayscale"}`} />
                          <div className="absolute left-2 top-2 flex gap-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.pill}`}>
                              <Icon className="h-2.5 w-2.5" /> {meta.label.slice(0, -1)}
                            </span>
                            {!isActive && (
                              <span className="rounded-full border border-slate-600 bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sconfitto</span>
                            )}
                          </div>
                        </div>
                        {img.caption && <p className="border-t border-white/5 px-4 py-3 font-heading text-sm text-slate-100">{img.caption}</p>}
                        <p className="px-4 pb-3 text-xs text-slate-600">{new Date(img.created_at).toLocaleTimeString()}</p>
                      </div>
                    );
                  })}
                  {history.length === 0 && <p className="py-8 text-center text-sm text-slate-600">Ancora nessun Pokémon...</p>}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <button
            data-testid="player-leave-btn"
            onClick={leaveRoom}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-rose-500/30 bg-slate-950/70 text-rose-400 backdrop-blur-md transition-all hover:border-rose-500/80 hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col gap-3 px-4 pb-6 pt-2 sm:px-6">
        {!anyActive ? (
          <div className="flex flex-1 items-center justify-center" data-testid="waiting-state">
            <div className="flex flex-col items-center gap-6">
              <Pokeball className="h-24 w-24 drop-shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-shake" />
              <div className="text-center">
                <p className="font-pixel text-[10px] uppercase tracking-[0.3em] text-red-400">In attesa</p>
                <p className="mt-2 font-heading text-2xl font-bold tracking-tight text-slate-200">Il Master sta scegliendo...</p>
                <p className="mt-2 text-sm text-slate-500">I Pokémon appariranno nelle sezioni Alleati, Neutri e Nemici</p>
              </div>
            </div>
          </div>
        ) : inTurnMode ? (
          <div className="flex flex-1 flex-col justify-center" data-testid="player-turn-track">
            <TurnTrack
              ordered={orderedActive}
              activeId={turn.active_id}
              round={turn.round}
              roundEnd={turn.round_end}
              isMaster={false}
            />
          </div>
        ) : (
          CATS.filter((meta) => meta.key !== "neutral" || byCat.neutral.length > 0).map((meta) => {
            const list = byCat[meta.key];
            const Icon = meta.icon;
            return (
              <section
                key={meta.key}
                data-testid={`zone-${meta.key}`}
                className={`relative flex flex-1 flex-col rounded-2xl border-2 ${meta.border} bg-slate-900/40 p-4 backdrop-blur-sm`}
              >
                <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b ${meta.stripe}`} />
                <div className="relative mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${meta.pill}`}>
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </span>
                    <span className="font-pixel text-[9px] text-slate-500">{list.length} in campo</span>
                  </div>
                </div>

                <div className="relative min-h-[120px] flex-1">
                  {list.length === 0 ? (
                    <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-600">
                      Nessun {meta.label.slice(0, -1).toLowerCase()} schierato
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-stretch gap-3">
                      <AnimatePresence>
                        {list.map((img) => {
                          const rank = rankMap[img.id];
                          return (
                          <motion.div
                            key={img.id}
                            layout
                            initial={{ opacity: 0, scale: 0.85, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -12 }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            className={`group relative flex w-[170px] flex-col overflow-hidden rounded-xl border-2 ${meta.border} bg-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.55)] sm:w-[200px]`}
                            data-testid={`zone-${meta.key}-card-${img.id}`}
                          >
                            <div className="relative flex h-32 items-center justify-center bg-slate-950/80 sm:h-40">
                              <div className={`absolute inset-0 bg-gradient-to-br ${meta.glow}`} />
                              <img src={img.url} alt={img.caption} className="relative max-h-full max-w-full object-contain" />
                              {rank && (
                                <div
                                  data-testid={`player-rank-${img.id}`}
                                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-heading text-sm font-black text-slate-950 ring-2 ring-slate-950 shadow-[0_0_14px_rgba(251,191,36,0.7)]"
                                >
                                  {rank}
                                </div>
                              )}
                            </div>
                            {img.caption && (
                              <p className="border-t border-white/5 bg-slate-950/80 px-3 py-2 text-center font-heading text-[11px] font-bold tracking-tight text-slate-100 line-clamp-2 sm:text-xs">
                                {img.caption}
                              </p>
                            )}
                          </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* OVERLAY broadcast immagine — copre tutto */}
      <AnimatePresence>
        {overlay && (
          <motion.div
            key={overlay.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md"
            data-testid="player-overlay"
          >
            <button
              data-testid="player-overlay-close"
              onClick={() => setOverlay(null)}
              title="Chiudi"
              className="absolute right-5 top-5 z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-rose-500/50 bg-slate-950/80 text-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.4)] backdrop-blur-md transition-all hover:border-rose-500 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <X className="h-5 w-5" />
            </button>

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex max-h-[92vh] max-w-[94vw] flex-col items-center gap-4 px-6"
            >
              <img
                src={overlay.url}
                alt={overlay.caption || "broadcast"}
                className="max-h-[78vh] max-w-full rounded-2xl border-2 border-fuchsia-500/30 object-contain shadow-[0_30px_120px_rgba(0,0,0,0.85)]"
                data-testid="player-overlay-image"
              />
              {overlay.caption && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="max-w-3xl rounded-xl border border-fuchsia-500/30 bg-slate-950/80 px-6 py-3 text-center font-heading text-base font-bold text-fuchsia-100 shadow-[0_0_30px_rgba(217,70,239,0.2)] sm:text-lg md:text-xl"
                  data-testid="player-overlay-caption"
                >
                  {overlay.caption}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
