import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { History, LogOut, Projector } from "lucide-react";
import { api, wsUrl } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

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
    if (!stored) {
      navigate("/join");
      return;
    }
    const p = JSON.parse(stored);
    setPlayer(p);

    // Load history
    api.get(`/rooms/${code}`).then((res) => {
      const imgs = res.data.images || [];
      setHistory(imgs);
      if (imgs.length > 0) setCurrent(imgs[imgs.length - 1]);
    }).catch(() => toast.error("Stanza non disponibile"));

    const ws = new WebSocket(wsUrl(code, "player", p.id));
    wsRef.current = ws;
    ws.onopen = () => setStatus("online");
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "image") {
          setCurrent(msg.data);
          setHistory((prev) => [...prev, msg.data]);
        } else if (msg.type === "room_closed") {
          toast.info("La stanza è stata chiusa dal master");
          setTimeout(() => navigate("/"), 1500);
        }
      } catch {}
    };
    ws.onclose = () => setStatus("offline");
    ws.onerror = () => setStatus("offline");

    return () => ws.close();
  }, [code, navigate]);

  const leaveRoom = () => {
    localStorage.removeItem(`player_${code}`);
    navigate("/");
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-body text-zinc-100" data-testid="player-view">
      {/* Top bar */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
          <Projector className="h-4 w-4 text-amber-500" />
          <span className="font-heading text-xs font-bold tracking-[0.2em] text-amber-400">{code}</span>
          <span className="mx-1 h-3 w-px bg-white/10" />
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${status === "online" ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            {player?.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <button
                data-testid="player-history-trigger"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-zinc-300 backdrop-blur-md transition-all hover:border-amber-500/40 hover:text-amber-400"
              >
                <History className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-md border-white/10 bg-zinc-950/95 text-zinc-100 backdrop-blur-2xl">
              <SheetHeader>
                <SheetTitle className="font-heading text-2xl font-bold text-zinc-50">Storico</SheetTitle>
                <p className="text-sm text-zinc-500">{history.length} immagini ricevute in questa sessione</p>
              </SheetHeader>
              <ScrollArea className="mt-6 h-[calc(100vh-140px)] pr-3">
                <div className="flex flex-col gap-4">
                  {[...history].reverse().map((img) => (
                    <div key={img.id} className="overflow-hidden rounded-xl border border-white/5 bg-black/40" data-testid={`player-history-${img.id}`}>
                      <img src={img.url} alt={img.caption} className="w-full object-cover" />
                      {img.caption && <p className="border-t border-white/5 px-4 py-3 font-heading text-sm text-zinc-200">{img.caption}</p>}
                      <p className="px-4 pb-3 text-xs text-zinc-600">{new Date(img.created_at).toLocaleTimeString()}</p>
                    </div>
                  ))}
                  {history.length === 0 && <p className="py-8 text-center text-sm text-zinc-600">Ancora nulla...</p>}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <button
            data-testid="player-leave-btn"
            onClick={leaveRoom}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-zinc-300 backdrop-blur-md transition-all hover:border-rose-500/40 hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-20">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex h-full w-full flex-col items-center justify-center"
              data-testid="current-image-container"
            >
              <img
                src={current.url}
                alt={current.caption}
                className="max-h-[75vh] max-w-[92vw] rounded-2xl object-contain shadow-[0_30px_120px_rgba(0,0,0,0.8)]"
                data-testid="current-image"
              />
              {current.caption && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mt-6 max-w-3xl rounded-2xl border border-white/10 bg-black/70 px-6 py-4 text-center backdrop-blur-2xl"
                  data-testid="current-caption"
                >
                  <p className="font-heading text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl md:text-3xl">
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
              className="flex flex-col items-center gap-4"
              data-testid="waiting-state"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="flex h-20 w-20 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10"
              >
                <Projector className="h-9 w-9 text-amber-400" />
              </motion.div>
              <p className="font-heading text-lg font-bold tracking-tight text-zinc-300">In attesa del master...</p>
              <p className="text-sm text-zinc-600">Le immagini appariranno qui in tempo reale</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
