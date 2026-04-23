import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LogIn } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
      toast.error("Inserisci codice e nome");
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
      toast.error(err?.response?.data?.detail || "Errore nella connessione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 font-body" data-testid="join-page">
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="grain-overlay" />

      <button
        onClick={() => navigate("/")}
        className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300 backdrop-blur-md transition-colors hover:border-white/30 hover:text-zinc-50"
        data-testid="back-btn"
      >
        <ArrowLeft className="h-4 w-4" /> Indietro
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/50 p-8 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.6)]"
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Giocatore</p>
        <h1 className="mb-1 font-heading text-3xl font-black tracking-tight text-zinc-50">Entra nella stanza</h1>
        <p className="mb-8 text-sm text-zinc-500">Il master ti ha dato un codice? Usalo qui.</p>

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Codice stanza</label>
            <Input
              data-testid="room-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="h-12 border-white/10 bg-black/50 font-heading text-2xl font-bold tracking-[0.3em] text-zinc-50 placeholder:text-zinc-700 focus-visible:border-amber-500 focus-visible:ring-amber-500/40"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Il tuo nome</label>
            <Input
              data-testid="player-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Luca"
              maxLength={40}
              className="h-12 border-white/10 bg-black/50 text-zinc-50 placeholder:text-zinc-700 focus-visible:border-amber-500 focus-visible:ring-amber-500/40"
            />
          </div>
          <Button
            data-testid="join-submit-btn"
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-full bg-amber-500 font-heading text-base font-bold text-zinc-950 transition-all duration-300 hover:bg-amber-400 hover:shadow-[0_0_40px_rgba(245,158,11,0.35)]"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {loading ? "Connessione..." : "Entra"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
