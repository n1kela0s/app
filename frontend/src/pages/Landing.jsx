import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Projector, UserRound, ArrowRight } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const bg = "https://images.unsplash.com/photo-1760170437237-a3654545ab4c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwxfHxkYXJrJTIwY2luZW1hdGljJTIwbW92aWUlMjB0aGVhdGVyfGVufDB8fHx8MTc3Njk4MTcxNHww&ixlib=rb-4.1.0&q=85";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-zinc-950 font-body" data-testid="landing-page">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />
      <div className="absolute inset-0 bg-black/75" />
      <div className="grain-overlay" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <Projector className="h-6 w-6 text-amber-500" />
          <span className="font-heading text-lg font-black tracking-tight text-zinc-50">PROIETTA</span>
        </div>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">beta</span>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-6xl flex-col items-center justify-center px-6 pb-20 md:px-12">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-amber-500"
        >
          Cinema privato per amici
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="max-w-4xl text-center font-heading text-4xl font-black leading-none tracking-tighter text-zinc-50 sm:text-5xl lg:text-7xl"
        >
          Proietta il tuo mondo.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-6 max-w-xl text-center text-base text-zinc-400 sm:text-lg"
        >
          Il master invia immagini e didascalie ai giocatori in tempo reale. Un'esperienza condivisa, immersiva, istantanea.
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
            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-900/10 p-7 text-left transition-all duration-300 hover:border-amber-500/60 hover:from-amber-500/30 hover:shadow-[0_0_40px_rgba(245,158,11,0.25)]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-zinc-950">
              <Projector className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-zinc-50">Crea stanza</h3>
              <p className="mt-1 text-sm text-zinc-400">Diventa il master. Carica o incolla immagini e proiettale a tutti.</p>
            </div>
            <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-amber-400">
              Inizia <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>

          <button
            data-testid="join-room-btn"
            onClick={() => navigate("/join")}
            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-7 text-left backdrop-blur-md transition-all duration-300 hover:border-white/30 hover:bg-zinc-900/60"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-50">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold text-zinc-50">Entra come giocatore</h3>
              <p className="mt-1 text-sm text-zinc-400">Inserisci il codice stanza e goditi lo spettacolo.</p>
            </div>
            <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
              Connettiti <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>
        </motion.div>
      </main>
    </div>
  );
}
