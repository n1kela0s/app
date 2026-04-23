import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LogIn } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Pokeball from "@/components/Pokeball";

export default function JoinRoom() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (!c || !n) {
      toast.error("Inserisci codice arena e nome allenatore");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/rooms/join", { code: c, name: n });
      localStorage.setItem(
        `player_${c}`,
        JSON.stringify({ id: res.data.player_id, name: res.data.name })
      );
      navigate(`/play/${c}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Arena non trovata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 font-body pokeball-pattern" data-testid="join-page">
      <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-red-600/20 blur-[140px]" />
      <div className="absolute -right-40 bottom-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[140px]" />

      <button
        onClick={() => navigate("/")}
        className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-300 backdrop-blur-md transition-colors hover:border-white/30 hover:text-slate-50"
        data-testid="back-btn"
      >
        <ArrowLeft className="h-4 w-4" /> Indietro
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md rounded-2xl border-2 border-blue-500/30 bg-slate-900/70 p-8 backdrop-blur-xl shadow-[0_20px_80px_rgba(59,130,246,0.2)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <Pokeball className="h-10 w-10" />
          <div>
            <p className="font-pixel text-[9px] uppercase tracking-widest text-blue-400">Allenatore</p>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-50">Entra in Arena</h1>
          </div>
        </div>
        <p className="mb-8 text-sm text-slate-400">L'Arena Master ti ha dato un codice? Digitalo qui per unirti alla battaglia.</p>

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="mb-2 block font-pixel text-[9px] uppercase tracking-widest text-blue-400">Codice Arena</label>
            <Input
              data-testid="room-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="h-14 border-white/10 bg-slate-950/80 text-center font-heading text-3xl font-bold tracking-[0.4em] text-slate-50 placeholder:text-slate-700 focus-visible:border-red-500 focus-visible:ring-red-500/40"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block font-pixel text-[9px] uppercase tracking-widest text-blue-400">Nome Allenatore</label>
            <Input
              data-testid="player-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Ash"
              maxLength={40}
              className="h-12 border-white/10 bg-slate-950/80 text-slate-50 placeholder:text-slate-700 focus-visible:border-red-500 focus-visible:ring-red-500/40"
            />
          </div>
          <Button
            data-testid="join-submit-btn"
            type="submit"
            disabled={loading}
            className="h-14 w-full rounded-xl bg-red-600 font-heading text-base font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-red-500 hover:shadow-[0_0_40px_rgba(220,38,38,0.5)]"
          >
            <LogIn className="mr-2 h-5 w-5" />
            {loading ? "Connessione..." : "Entra in battaglia"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
