import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Swords, UserRound, ArrowRight, Zap } from "lucide-react";
import Pokeball from "@/components/Pokeball";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 font-body pokeball-pattern" data-testid="landing-page">
      {/* Background gradient arena */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-red-950/40" />
      <div className="absolute -right-24 -top-24 h-[500px] w-[500px] rounded-full bg-red-600/20 blur-[120px]" />
      <div className="absolute -left-24 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-[120px]" />
      <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[140px]" />

      {/* Faint poké-grid */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle at center, #ffffff 1px, transparent 1px)",
        backgroundSize: "32px 32px"
      }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <Pokeball className="h-8 w-8" />
          <span className="font-heading text-lg font-black tracking-wider text-slate-50">POKÉ ARENA</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
          <Zap className="h-3 w-3 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">Live Battle</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-84px)] max-w-6xl flex-col items-center justify-center px-6 pb-20 md:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="mb-6"
        >
          <Pokeball className="h-20 w-20 drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]" spin />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-4 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-red-400 font-pixel"
        >
          Gym Battle Broadcast
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="max-w-4xl text-center font-heading text-4xl font-black leading-tight tracking-tight text-slate-50 sm:text-5xl lg:text-6xl xl:text-7xl"
        >
          Scegli il tuo{" "}
          <span className="bg-gradient-to-r from-red-500 via-amber-400 to-red-500 bg-clip-text text-transparent">
            Pokémon
          </span>
          <br />
          e vai in battaglia.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-6 max-w-xl text-center text-base text-slate-400 sm:text-lg"
        >
          Tool per sessioni di <span className="text-amber-400">gioco da tavolo Pokémon</span>: l'Arena Master mostra in tempo reale le immagini dei Pokémon che combattono a tutti gli allenatori al tavolo.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-5 md:grid-cols-2"
        >
          <button
            data-testid="create-room-btn"
            onClick={() => navigate("/master/new")}
            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border-2 border-red-500/40 bg-gradient-to-br from-red-600/20 via-red-900/10 to-slate-900/40 p-7 text-left transition-all duration-300 hover:border-red-500 hover:shadow-[0_0_50px_rgba(220,38,38,0.4)] hover:-translate-y-1"
          >
            <div className="absolute right-4 top-4 opacity-20 transition-opacity group-hover:opacity-40">
              <Pokeball className="h-16 w-16" />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/50">
              <Swords className="h-6 w-6" />
            </div>
            <div className="relative">
              <p className="font-pixel text-[9px] uppercase tracking-widest text-red-400">Arena Master</p>
              <h3 className="mt-1 font-heading text-2xl font-bold text-slate-50">Crea Arena</h3>
              <p className="mt-2 text-sm text-slate-400">Apri una nuova arena. Mostra i Pokémon in battaglia agli allenatori al tavolo.</p>
            </div>
            <span className="relative mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-red-400">
              Inizia scontro <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>

          <button
            data-testid="join-room-btn"
            onClick={() => navigate("/join")}
            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border-2 border-blue-500/40 bg-gradient-to-br from-blue-600/20 via-blue-900/10 to-slate-900/40 p-7 text-left transition-all duration-300 hover:border-blue-500 hover:shadow-[0_0_50px_rgba(59,130,246,0.35)] hover:-translate-y-1"
          >
            <div className="absolute right-4 top-4 opacity-20 transition-opacity group-hover:opacity-40">
              <Pokeball className="h-16 w-16" />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/50">
              <UserRound className="h-6 w-6" />
            </div>
            <div className="relative">
              <p className="font-pixel text-[9px] uppercase tracking-widest text-blue-400">Allenatore</p>
              <h3 className="mt-1 font-heading text-2xl font-bold text-slate-50">Entra in Arena</h3>
              <p className="mt-2 text-sm text-slate-400">Hai il codice? Siediti al tavolo e preparati alla battaglia.</p>
            </div>
            <span className="relative mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-400">
              Entra <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>
        </motion.div>
      </main>
    </div>
  );
}
