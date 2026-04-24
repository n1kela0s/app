import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Upload, LinkIcon, Users, History, LogOut, CheckCircle2, Swords, Search, Sparkles, Shield, Skull, Minus, X, Trash2, Volume2 } from "lucide-react";
import axios from "axios";
import { api, wsUrl, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Pokeball from "@/components/Pokeball";

const CATEGORY_META = {
  ally:    { label: "Alleato", short: "Alleato",    icon: Shield, accent: "emerald", bg: "from-emerald-600 to-emerald-500", hover: "hover:from-emerald-500 hover:to-emerald-400", ring: "rgba(16,185,129,0.45)" },
  neutral: { label: "Neutro",  short: "Neutro",     icon: Minus,  accent: "amber",   bg: "from-amber-600 to-amber-500",     hover: "hover:from-amber-500 hover:to-amber-400",     ring: "rgba(251,191,36,0.45)" },
  enemy:   { label: "Nemico",  short: "Nemico",     icon: Skull,  accent: "rose",    bg: "from-rose-700 to-rose-500",       hover: "hover:from-rose-600 hover:to-rose-400",       ring: "rgba(244,63,94,0.45)" },
};

const CATEGORY_CHIP = {
  ally:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  neutral: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  enemy:   "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export default function MasterDashboard() {
  const { code: paramCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(null);
  const [token, setToken] = useState(null);
  const [images, setImages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState("pokemon");
  const [file, setFile] = useState(null);
  const [pokeQuery, setPokeQuery] = useState("");
  const [pokePreview, setPokePreview] = useState(null);
  const [pokeLoading, setPokeLoading] = useState(false);
  const [pokeList, setPokeList] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [sendingCat, setSendingCat] = useState(null);
  const [copied, setCopied] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const setup = async () => {
      const existing = paramCode && paramCode !== "new" ? paramCode.toUpperCase() : null;
      const stored = existing ? localStorage.getItem(`master_${existing}`) : null;

      if (existing && stored) {
        const { token } = JSON.parse(stored);
        setCode(existing);
        setToken(token);
        const res = await api.get(`/rooms/${existing}`).catch(() => null);
        if (res) setImages(res.data.images || []);
      } else {
        try {
          const res = await api.post("/rooms");
          const { room_code, master_token } = res.data;
          localStorage.setItem(`master_${room_code}`, JSON.stringify({ token: master_token }));
          setCode(room_code);
          setToken(master_token);
          navigate(`/master/${room_code}`, { replace: true });
        } catch {
          toast.error("Errore creazione arena");
        }
      }
    };
    setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!code) return;
    const ws = new WebSocket(wsUrl(code, "master", "master"));
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "presence_count") setOnlineCount(msg.players || 0);
      } catch {}
    };
    return () => ws.close();
  }, [code]);

  // Load Pokémon names list once (for autocomplete)
  useEffect(() => {
    if (pokeList.length > 0) return;
    const cached = localStorage.getItem("poke_names_v1");
    if (cached) {
      try { setPokeList(JSON.parse(cached)); return; } catch {}
    }
    axios.get("https://pokeapi.co/api/v2/pokemon?limit=1025")
      .then(({ data }) => {
        const names = data.results.map((r, i) => ({ name: r.name, id: i + 1 }));
        setPokeList(names);
        try { localStorage.setItem("poke_names_v1", JSON.stringify(names)); } catch {}
      })
      .catch(() => {});
  }, [pokeList.length]);

  // Filter suggestions
  useEffect(() => {
    const q = pokeQuery.trim().toLowerCase();
    if (!q || pokeList.length === 0) { setSuggestions([]); return; }
    const starts = pokeList.filter((p) => p.name.startsWith(q));
    const contains = pokeList.filter((p) => !p.name.startsWith(q) && p.name.includes(q));
    setSuggestions([...starts, ...contains].slice(0, 8));
    setHighlightIdx(-1);
  }, [pokeQuery, pokeList]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Codice arena copiato!");
    setTimeout(() => setCopied(false), 1500);
  };

  const copyPlayerLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/join`);
    toast.success("Link copiato!");
  };

  const searchPokemon = async (e, overrideName) => {
    e?.preventDefault();
    const q = (overrideName ?? pokeQuery).trim().toLowerCase();
    if (!q) return;
    setShowSuggestions(false);
    setPokeLoading(true);
    setPokePreview(null);
    try {
      const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(q)}`);
      const artwork = data.sprites?.other?.["official-artwork"]?.front_default
        || data.sprites?.other?.home?.front_default
        || data.sprites?.front_default;
      if (!artwork) throw new Error("no-sprite");
      const name = data.name.charAt(0).toUpperCase() + data.name.slice(1);
      const types = data.types.map((t) => t.type.name).join(" / ");
      setPokePreview({
        id: data.id,
        name,
        types,
        url: artwork,
        hp: data.stats?.find((s) => s.stat.name === "hp")?.base_stat,
        cry: data.cries?.latest || data.cries?.legacy || null,
      });
    } catch {
      toast.error("Pokémon non trovato. Riprova con un altro nome o numero.");
    } finally {
      setPokeLoading(false);
    }
  };

  const pickSuggestion = (s) => {
    setPokeQuery(s.name);
    setShowSuggestions(false);
    searchPokemon(null, s.name);
  };

  const handlePokeKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && highlightIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[highlightIdx]); }
    else if (e.key === "Escape") { setShowSuggestions(false); }
  };

  const playCry = (src) => {
    if (!src) return;
    try {
      const audio = new Audio(src);
      audio.volume = 0.55;
      audio.play().catch(() => {});
    } catch {}
  };

  const getCryFromImage = (img) => {
    if (!img || img.source !== "pokemon") return null;
    const m = img.url && img.url.match(/\/(\d+)\.(png|gif|webp|jpg|jpeg)(\?.*)?$/i);
    if (!m) return null;
    return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${m[1]}.ogg`;
  };

  const send = async (category) => {
    if (!code || !token) return;
    setSendingCat(category);
    try {
      let imgUrl = url.trim();
      let source = "url";
      let finalCaption = caption;
      let cryToPlay = null;
      if (mode === "upload") {
        if (!file) { toast.error("Seleziona un'immagine"); setSendingCat(null); return; }
        const form = new FormData();
        form.append("file", file);
        const up = await api.post(`/rooms/${code}/upload`, form, {
          headers: { "X-Master-Token": token, "Content-Type": "multipart/form-data" },
        });
        imgUrl = fileUrl(up.data.storage_path);
        source = "upload";
      } else if (mode === "pokemon") {
        if (!pokePreview) { toast.error("Cerca prima un Pokémon"); setSendingCat(null); return; }
        imgUrl = pokePreview.url;
        source = "pokemon";
        cryToPlay = pokePreview.cry;
        if (!finalCaption) {
          finalCaption = `#${String(pokePreview.id).padStart(3, "0")} ${pokePreview.name} — ${pokePreview.types.toUpperCase()}`;
        }
      } else {
        if (!imgUrl) { toast.error("Inserisci un URL"); setSendingCat(null); return; }
      }
      const res = await api.post(
        `/rooms/${code}/images`,
        { url: imgUrl, caption: finalCaption, source, category },
        { headers: { "X-Master-Token": token } }
      );
      setImages((prev) => [...prev, res.data]);
      playCry(cryToPlay);
      setUrl(""); setCaption(""); setFile(null); setPokeQuery(""); setPokePreview(null);
      toast.success(`Schierato come ${CATEGORY_META[category].label}!`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore invio");
    } finally {
      setSendingCat(null);
    }
  };

  const removeFromField = async (id) => {
    try {
      await api.post(`/rooms/${code}/images/${id}/remove`, {}, { headers: { "X-Master-Token": token } });
      setImages((prev) => prev.map((i) => i.id === id ? { ...i, active: false } : i));
      toast.success("Rimosso dal campo");
    } catch {
      toast.error("Errore rimozione");
    }
  };

  const deleteImage = async (id) => {
    try {
      await api.delete(`/rooms/${code}/images/${id}`, { headers: { "X-Master-Token": token } });
      setImages((prev) => prev.filter((i) => i.id !== id));
      toast.success("Pokémon eliminato");
    } catch {
      toast.error("Errore eliminazione");
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Pulire tutta la cronologia e il campo? L'azione è irreversibile.")) return;
    try {
      await api.delete(`/rooms/${code}/images`, { headers: { "X-Master-Token": token } });
      setImages([]);
      toast.success("Cronologia pulita");
    } catch {
      toast.error("Errore pulizia");
    }
  };

  const closeRoom = async () => {
    if (!window.confirm("Chiudere l'arena? Gli allenatori verranno disconnessi.")) return;
    try {
      await api.post(`/rooms/${code}/close`, {}, { headers: { "X-Master-Token": token } });
      localStorage.removeItem(`master_${code}`);
      navigate("/");
    } catch {
      toast.error("Errore chiusura");
    }
  };

  if (!code) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-500">
        <Pokeball className="h-14 w-14" spin />
        <p className="font-heading tracking-wider">Apertura arena...</p>
      </div>
    );
  }

  const active = images.filter((i) => i.active !== false);
  const byCat = {
    ally: active.filter((i) => (i.category || "neutral") === "ally"),
    neutral: active.filter((i) => (i.category || "neutral") === "neutral"),
    enemy: active.filter((i) => (i.category || "neutral") === "enemy"),
  };

  const canSend = mode === "pokemon" ? !!pokePreview : mode === "upload" ? !!file : !!url.trim();

  return (
    <div className="min-h-screen bg-slate-950 font-body text-slate-100 pokeball-pattern" data-testid="master-dashboard">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-red-950/30 to-transparent" />

      <header className="sticky top-0 z-30 border-b-2 border-red-600/30 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Pokeball className="h-10 w-10" />
            <div>
              <p className="font-pixel text-[9px] uppercase tracking-widest text-red-400">Arena Master</p>
              <h1 className="font-heading text-lg font-bold tracking-tight">Control Room</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="room-code-display"
              onClick={copyCode}
              className="group flex items-center gap-2 rounded-full border-2 border-red-500/40 bg-red-500/10 px-5 py-2 font-heading text-base font-bold tracking-[0.3em] text-red-300 transition-all hover:border-red-500 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(220,38,38,0.35)]"
            >
              {code}
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-70 group-hover:opacity-100" />}
            </button>
            <Button
              data-testid="copy-link-btn"
              variant="outline"
              onClick={copyPlayerLink}
              className="rounded-full border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-slate-50"
            >
              <LinkIcon className="mr-2 h-4 w-4" /> Link
            </Button>
            <Button
              data-testid="close-room-btn"
              variant="outline"
              onClick={closeRoom}
              className="rounded-full border-rose-500/30 bg-transparent text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <LogOut className="mr-2 h-4 w-4" /> Chiudi
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-6 lg:col-span-8">
            <div className="rounded-2xl border-2 border-red-500/20 bg-slate-900/60 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/20 text-red-400">
                    <Swords className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-pixel text-[9px] uppercase tracking-widest text-red-400">Mostra Pokémon</p>
                    <h2 className="font-heading text-2xl font-bold text-slate-50">Schiera il Pokémon</h2>
                  </div>
                </div>
                <div className="flex rounded-full border border-white/10 bg-slate-950/80 p-1">
                  <button
                    data-testid="mode-pokemon-btn"
                    onClick={() => setMode("pokemon")}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${mode === "pokemon" ? "bg-red-600 text-white" : "text-slate-400 hover:text-slate-50"}`}
                  >
                    <Sparkles className="h-3 w-3" /> PokéAPI
                  </button>
                  <button
                    data-testid="mode-url-btn"
                    onClick={() => setMode("url")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${mode === "url" ? "bg-red-600 text-white" : "text-slate-400 hover:text-slate-50"}`}
                  >
                    URL
                  </button>
                  <button
                    data-testid="mode-upload-btn"
                    onClick={() => setMode("upload")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${mode === "upload" ? "bg-red-600 text-white" : "text-slate-400 hover:text-slate-50"}`}
                  >
                    Upload
                  </button>
                </div>
              </div>

              {mode === "pokemon" ? (
                <div className="space-y-3">
                  <form onSubmit={searchPokemon} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        data-testid="pokemon-search-input"
                        value={pokeQuery}
                        onChange={(e) => { setPokeQuery(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        onKeyDown={handlePokeKeyDown}
                        placeholder="Nome o numero (es. charizard, 25, mewtwo)"
                        className="h-12 border-white/10 bg-slate-950/80 pl-10 text-slate-50 placeholder:text-slate-600 focus-visible:border-red-500"
                        autoComplete="off"
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div
                          data-testid="pokemon-suggestions"
                          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-amber-500/30 bg-slate-950/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
                        >
                          {suggestions.map((s, idx) => (
                            <button
                              key={s.name}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickSuggestion(s)}
                              onMouseEnter={() => setHighlightIdx(idx)}
                              data-testid={`pokemon-suggestion-${s.name}`}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${highlightIdx === idx ? "bg-red-500/20" : "hover:bg-white/5"}`}
                            >
                              <span className="font-pixel text-[9px] text-amber-400">#{String(s.id).padStart(3, "0")}</span>
                              <span className="font-heading text-sm capitalize text-slate-100">{s.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      data-testid="pokemon-search-btn"
                      disabled={pokeLoading}
                      className="h-12 rounded-lg bg-amber-500 px-5 font-heading font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-400"
                    >
                      {pokeLoading ? "..." : "Cerca"}
                    </Button>
                  </form>

                  {pokePreview && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-4 rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-red-500/10 p-4"
                      data-testid="pokemon-preview"
                    >
                      <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-xl bg-slate-950/60">
                        <img src={pokePreview.url} alt={pokePreview.name} className="h-24 w-24 object-contain" data-testid="pokemon-preview-image" />
                      </div>
                      <div className="flex-1">
                        <p className="font-pixel text-[9px] uppercase tracking-widest text-amber-400">#{String(pokePreview.id).padStart(3, "0")}</p>
                        <h3 className="font-heading text-2xl font-bold text-slate-50">{pokePreview.name}</h3>
                        <p className="mt-1 text-sm uppercase tracking-wider text-slate-300">{pokePreview.types}</p>
                        {pokePreview.hp && (
                          <p className="mt-1 text-xs text-slate-500">HP base: <span className="text-emerald-400">{pokePreview.hp}</span></p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {!pokePreview && !pokeLoading && (
                    <p className="text-xs text-slate-500">Digita il nome o il numero del Pokédex, poi premi <span className="text-amber-400">Cerca</span>. L'artwork ufficiale apparirà qui.</p>
                  )}
                </div>
              ) : mode === "url" ? (
                <Input
                  data-testid="image-url-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://.../charizard.png"
                  className="h-12 border-white/10 bg-slate-950/80 text-slate-50 placeholder:text-slate-600 focus-visible:border-red-500"
                />
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-500/30 bg-slate-950/60 px-6 py-10 text-center transition-all hover:border-red-500/70 hover:bg-red-500/5" data-testid="file-upload-dropzone">
                  <Upload className="mb-2 h-8 w-8 text-red-400" />
                  <p className="font-heading text-sm font-bold text-slate-200">
                    {file ? file.name : "Carica immagine Pokémon"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">JPG, PNG, GIF, WEBP — max 15MB</p>
                  <input
                    data-testid="file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              )}

              <div className="mt-4">
                <label className="mb-2 block font-pixel text-[9px] uppercase tracking-widest text-amber-400">Didascalia {mode === "pokemon" && <span className="text-slate-600 normal-case tracking-normal">(auto se vuota)</span>}</label>
                <Input
                  data-testid="caption-input"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={mode === "pokemon" ? "Lascia vuoto per #025 Pikachu — ELECTRIC" : "es. Charizard lv.65 — Lanciafiamme"}
                  maxLength={140}
                  className="h-12 border-white/10 bg-slate-950/80 text-slate-50 placeholder:text-slate-600 focus-visible:border-amber-500"
                />
                <p className="mt-1 text-right text-xs text-slate-600">{caption.length}/140</p>
              </div>

              {/* Three launch buttons: Alleato / Neutro / Nemico */}
              <div className="mt-5">
                <p className="mb-2 font-pixel text-[9px] uppercase tracking-widest text-slate-400">Scegli lo schieramento</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {["ally", "neutral", "enemy"].map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const Icon = meta.icon;
                    const loading = sendingCat === cat;
                    return (
                      <button
                        key={cat}
                        data-testid={`send-${cat}-btn`}
                        onClick={() => send(cat)}
                        disabled={!canSend || sendingCat !== null}
                        className={`flex h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${meta.bg} ${meta.hover} font-heading text-sm font-black uppercase tracking-wider text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40`}
                        style={{ boxShadow: !canSend ? "none" : `0 0 24px ${meta.ring}` }}
                      >
                        <Icon className="h-5 w-5" />
                        {loading ? "Invio..." : `Lancia ${meta.label}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* IN CAMPO - Tre sezioni */}
            <div className="rounded-2xl border-2 border-white/5 bg-slate-900/40 p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-pixel text-[9px] uppercase tracking-widest text-amber-400">In campo ora</p>
                <span className="text-xs text-slate-500">{active.length} attivi</span>
              </div>
              {active.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-600">Nessun Pokémon in campo</p>
              ) : (
                <div className="space-y-5">
                  {["ally", "neutral", "enemy"].map((cat) => {
                    const list = byCat[cat];
                    const meta = CATEGORY_META[cat];
                    const Icon = meta.icon;
                    return (
                      <div key={cat} data-testid={`field-${cat}-section`}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CATEGORY_CHIP[cat]}`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                          <span className="text-[11px] text-slate-600">{list.length}</span>
                        </div>
                        {list.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-white/5 px-3 py-3 text-center text-[11px] text-slate-600">—</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                            <AnimatePresence>
                              {list.map((img) => {
                                const cry = getCryFromImage(img);
                                return (
                                <motion.div
                                  key={img.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.85 }}
                                  className={`group relative overflow-hidden rounded-xl border-2 bg-slate-950 ${CATEGORY_CHIP[cat].replace("text-", "").replace(/bg-[\w/-]+/, "")}`}
                                  data-testid={`field-item-${img.id}`}
                                >
                                  <img src={img.url} alt={img.caption} className="h-28 w-full object-contain bg-slate-950/60" />
                                  {img.caption && <p className="border-t border-white/5 px-2 py-1.5 text-[11px] text-slate-300 line-clamp-1">{img.caption}</p>}
                                  {cry && (
                                    <button
                                      data-testid={`play-cry-${img.id}`}
                                      onClick={() => playCry(cry)}
                                      title="Riproduci verso"
                                      className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/90 text-amber-300 ring-1 ring-amber-400/40 transition-all hover:bg-amber-500/20 hover:text-amber-200 hover:ring-amber-400/80 active:scale-95"
                                    >
                                      <Volume2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    data-testid={`remove-field-${img.id}`}
                                    onClick={() => removeFromField(img.id)}
                                    title="Rimuovi dal campo"
                                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/90 text-rose-400 opacity-0 ring-1 ring-rose-500/40 transition-all hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-2xl border-2 border-blue-500/20 bg-slate-900/60 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <p className="font-pixel text-[9px] uppercase tracking-widest text-blue-400">Allenatori</p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20" data-testid="online-count">
                  <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  {onlineCount} al tavolo
                </Badge>
              </div>
              <Separator className="my-4 bg-white/5" />
              <p className="text-sm text-slate-400">
                Condividi il codice <span className="font-heading font-bold tracking-wider text-red-400">{code}</span> con gli allenatori al tavolo. Si collegano da{" "}
                <span className="text-slate-200">/join</span>.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-amber-500/20 bg-slate-900/60 p-6 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-amber-400" />
                  <p className="font-pixel text-[9px] uppercase tracking-widest text-amber-400">Pokédex Battaglia ({images.length})</p>
                </div>
                {images.length > 0 && (
                  <button
                    data-testid="clear-history-btn"
                    onClick={clearHistory}
                    title="Pulisci cronologia"
                    className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300 transition-all hover:bg-rose-500/15 hover:text-rose-200"
                  >
                    <Trash2 className="h-3 w-3" /> Pulisci
                  </button>
                )}
              </div>
              <ScrollArea className="h-[380px] pr-3">
                <div className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {[...images].reverse().map((img) => {
                      const cat = img.category || "neutral";
                      const meta = CATEGORY_META[cat];
                      const Icon = meta.icon;
                      const isActive = img.active !== false;
                      return (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="group relative overflow-hidden rounded-xl border border-white/5 bg-slate-950/60"
                          data-testid={`history-item-${img.id}`}
                        >
                          <img src={img.url} alt={img.caption} className={`h-32 w-full object-cover ${isActive ? "" : "opacity-60 grayscale"}`} />
                          <div className="absolute left-2 top-2 flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${CATEGORY_CHIP[cat]}`}>
                              <Icon className="h-2.5 w-2.5" /> {meta.short}
                            </span>
                            {!isActive && (
                              <span className="rounded-full border border-slate-600 bg-slate-950/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Sconfitto</span>
                            )}
                          </div>
                          <button
                            data-testid={`delete-history-${img.id}`}
                            onClick={() => deleteImage(img.id)}
                            title="Elimina dalla cronologia"
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/90 text-rose-400 opacity-0 ring-1 ring-rose-500/40 transition-all hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {img.caption && <p className="px-3 py-2 text-xs text-slate-300 line-clamp-2">{img.caption}</p>}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {images.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-600">Nessun Pokémon mostrato</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
