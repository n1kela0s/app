import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { History, LogOut } from "lucide-react";
import { api, wsUrl } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Pokeball from "@/components/Pokeball";

export default function PlayerView() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [player, setPlayer] = useState(null);
  const wsRef = useRef(null);

 useEffect(() => {
  const stored = localStorage.getItem(`player_${code}`);
  if (!stored) { navigate("/join"); return; }
  const p = JSON.parse(stored);
  setPlayer(p);

  // Caricamento iniziale dello storico
  api.get(`/rooms/${code}`).then((res) => {
    const imgs = res.data.images || [];
    setHistory(imgs);
    if (imgs.length > 0) setCurrent(imgs[imgs.length - 1]);
  }).catch(() => toast.error("Arena non disponibile"));

  // Inizializzazione WebSocket
  const socketUrl = wsUrl(code, "player", p.id);
  const ws = new WebSocket(socketUrl);
  wsRef.current = ws;

  ws.onopen = () => {
    console.log("Connesso all'arena!"); // Debug
    setStatus("online");
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      console.log("Messaggio ricevuto:", msg); // Debug fondamentale

      if (msg.type === "image") {
        // AGGIORNAMENTO LIVE
        setCurrent(msg.data);
        // Usiamo la funzione di callback per lo storico per evitare bug con gli stati precedenti
        setHistory((prev) => [...prev, msg.data]);
        
        // Piccola notifica opzionale
        toast.success("Nuovo Pokémon in campo!", { duration: 2000 });
      } else if (msg.type === "room_closed") {
        toast.info("L'arena è stata chiusa dal master");
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err) {
      console.error("Errore parsing messaggio:", err);
    }
  };

  ws.onclose = (e) => {
    console.log("WebSocket chiuso:", e.reason);
    setStatus("offline");
  };

  ws.onerror = () => setStatus("offline");

  // Cleanup: chiudiamo il socket quando il componente viene smontato
  return () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };
}, [code, navigate]);

  const leaveRoom = () => {
    localStorage.removeItem(`player_${code}`);
    navigate("/");
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-body text-slate-100 pokeball-pattern" data-testid="player-view">
      {/* Arena floor gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-red-950/20" />
      <div className="absolute bottom-0 left-1/2 h-[50vh] w-[120vw] -translate-x-1/2 rounded-[50%] bg-red-600/10 blur-[120px]" />

      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4">
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
                  {[...history].reverse().map((img) => (
                    <div key={img.id} className="overflow-hidden rounded-xl border border-amber-500/20 bg-slate-900/60" data-testid={`player-history-${img.id}`}>
                      <img src={img.url} alt={img.caption} className="w-full object-cover" />
                      {img.caption && <p className="border-t border-amber-500/20 px-4 py-3 font-heading text-sm text-slate-100">{img.caption}</p>}
                      <p className="px-4 pb-3 text-xs text-slate-600">{new Date(img.created_at).toLocaleTimeString()}</p>
                    </div>
                  ))}
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

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-20">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full w-full flex-col items-center justify-center"
              data-testid="current-image-container"
            >
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-red-500/30 via-amber-400/20 to-blue-500/30 blur-2xl" />
                <img
                  src={current.url}
                  alt={current.caption}
                  className="relative max-h-[70vh] max-w-[92vw] rounded-2xl border-2 border-red-500/20 object-contain shadow-[0_30px_120px_rgba(0,0,0,0.9)]"
                  data-testid="current-image"
                />
              </div>
              {current.caption && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mt-6 max-w-3xl rounded-2xl border-2 border-amber-500/30 bg-slate-950/85 px-8 py-4 text-center backdrop-blur-2xl shadow-[0_0_40px_rgba(251,191,36,0.15)]"
                  data-testid="current-caption"
                >
                  <p className="font-heading text-xl font-bold tracking-tight text-amber-300 sm:text-2xl md:text-3xl">
                    {current.caption}
                  </p>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-6"
              data-testid="waiting-state"
            >
              <Pokeball className="h-24 w-24 drop-shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-shake" />
              <div className="text-center">
                <p className="font-pixel text-[10px] uppercase tracking-[0.3em] text-red-400">In attesa</p>
                <p className="mt-2 font-heading text-2xl font-bold tracking-tight text-slate-200">Il Master sta scegliendo...</p>
                <p className="mt-2 text-sm text-slate-500">Il prossimo Pokémon apparirà qui in tempo reale</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
