import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Upload, LinkIcon, Users, History, LogOut, CheckCircle2, Swords, Search, Sparkles, Shield, Skull, Minus, X, Trash2, Volume2, ImagePlus, Eye, EyeOff, RotateCcw, Zap } from "lucide-react";
import axios from "axios";
import { api, wsUrl, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Pokeball from "@/components/Pokeball";
import TurnTrack from "@/components/TurnTrack";
import SceneEditor from "@/components/SceneEditor";

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
  const [overlaySending, setOverlaySending] = useState(false);
  const [sceneDraft, setSceneDraft] = useState({ background_url: "", caption: "", layers: [] });
  const [sceneHistory, setSceneHistory] = useState([]);
  const [sceneActive, setSceneActive] = useState(null);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const layerThrottleRef = useRef({});
  const [turnRound, setTurnRound] = useState(1);
  const [turnActiveId, setTurnActiveId] = useState(null);
  const [turnRoundEnd, setTurnRoundEnd] = useState(false);
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
        else if (msg.type === "image_turn_action_updated") {
          setImages((prev) => prev.map((i) => i.id === msg.id ? {
            ...i,
            ...(msg.actions !== undefined ? { actions: msg.actions } : {}),
            ...(msg.evaded !== undefined ? { evaded: msg.evaded } : {}),
            ...(msg.clashed !== undefined ? { clashed: msg.clashed } : {}),
          } : i));
        } else if (msg.type === "round_reset") {
          setImages((prev) => prev.map((i) => i.active !== false ? { ...i, actions: 0, evaded: false, clashed: false } : i));
        }
      } catch {}
    };
    return () => ws.close();
  }, [code]);

  // Load scene history from localStorage (last 5 per room)
  useEffect(() => {
    if (!code) return;
    try {
      const cached = localStorage.getItem(`scenes_${code}`);
      if (cached) setSceneHistory(JSON.parse(cached));
    } catch {}
  }, [code]);

  const persistSceneHistory = (next) => {
    setSceneHistory(next);
    try { localStorage.setItem(`scenes_${code}`, JSON.stringify(next)); } catch {}
  };

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

  const updateInitiative = async (id, raw) => {
    const value = raw === "" || raw === null || raw === undefined ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || !Number.isFinite(value))) return;
    // Optimistic update
    setImages((prev) => prev.map((i) => i.id === id ? { ...i, initiative: value } : i));
    try {
      await api.patch(
        `/rooms/${code}/images/${id}/initiative`,
        { initiative: value },
        { headers: { "X-Master-Token": token } }
      );
    } catch {
      toast.error("Errore aggiornamento iniziativa");
    }
  };

  const updateTurnAction = async (id, patch) => {
    // optimistic update
    setImages((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
    try {
      await api.patch(
        `/rooms/${code}/images/${id}/turn_action`,
        patch,
        { headers: { "X-Master-Token": token } }
      );
    } catch {
      toast.error("Errore aggiornamento azione");
    }
  };

  const setActionsCount = (id, n) => {
    const value = Math.max(0, Math.min(5, n));
    updateTurnAction(id, { actions: value });
  };

  const toggleEvaded = (img) => {
    const newEvaded = !img.evaded;
    const patch = { evaded: newEvaded };
    if (newEvaded) {
      patch.actions = Math.min(5, (img.actions || 0) + 1);
    } else {
      patch.actions = Math.max(0, (img.actions || 0) - 1);
    }
    updateTurnAction(img.id, patch);
  };

  const toggleClashed = (img) => {
    const newClashed = !img.clashed;
    const patch = { clashed: newClashed };
    if (newClashed) {
      patch.actions = Math.min(5, (img.actions || 0) + 1);
    } else {
      patch.actions = Math.max(0, (img.actions || 0) - 1);
    }
    updateTurnAction(img.id, patch);
  };

  const resetRoundActions = async () => {
    setImages((prev) => prev.map((i) => i.active !== false ? { ...i, actions: 0, evaded: false, clashed: false } : i));
    try {
      await api.post(`/rooms/${code}/round/reset_actions`, {}, { headers: { "X-Master-Token": token } });
    } catch {}
  };

  const showScene = async (overrideScene) => {
    if (!code || !token) return;
    const sceneToSend = overrideScene || sceneDraft;
    const bg = (sceneToSend.background_url || "").trim();
    if (!bg) { toast.error("Inserisci un URL di sfondo"); return; }
    setOverlaySending(true);
    try {
      const res = await api.post(
        `/rooms/${code}/scene`,
        {
          background_url: bg,
          caption: sceneToSend.caption || "",
          layers: (sceneToSend.layers || []).map((l) => ({
            id: l.id,
            url: l.url,
            x: l.x, y: l.y, w: l.w, h: l.h, z: l.z || 0,
          })),
        },
        { headers: { "X-Master-Token": token } }
      );
      setSceneActive(res.data);
      // Sync the IDs returned by the server back into draft (so future PATCH layer works)
      setSceneDraft((d) => ({ ...d, layers: res.data.layers }));
      // Update history (last 5, dedupe by background+caption)
      const entry = { ...res.data };
      const dedup = sceneHistory.filter((h) => !(h.background_url === bg && (h.caption || "") === (entry.caption || "")));
      const next = [entry, ...dedup].slice(0, 5);
      persistSceneHistory(next);
      toast.success("Scena mostrata ai giocatori");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore invio scena");
    } finally {
      setOverlaySending(false);
    }
  };

  const hideScene = async () => {
    if (!code || !token) return;
    try {
      await api.delete(`/rooms/${code}/overlay`, { headers: { "X-Master-Token": token } });
      setSceneActive(null);
      toast.success("Scena chiusa");
    } catch {
      toast.error("Errore chiusura scena");
    }
  };

  const removeSceneFromHistory = (id) => {
    persistSceneHistory(sceneHistory.filter((h) => h.id !== id));
  };

  // Live PATCH del layer: ottimistico locale + throttle al server (40ms)
  const patchLayer = (layerId, patch) => {
    // optimistic update
    setSceneDraft((d) => ({
      ...d,
      layers: (d.layers || []).map((l) => l.id === layerId ? { ...l, ...patch } : l),
    }));
    if (!sceneActive) return; // se non è in onda, niente broadcast
    const now = Date.now();
    const last = layerThrottleRef.current[layerId] || 0;
    layerThrottleRef.current[layerId] = now;
    const send = async () => {
      try {
        await api.patch(
          `/rooms/${code}/scene/layers/${layerId}`,
          patch,
          { headers: { "X-Master-Token": token } }
        );
      } catch {}
    };
    if (now - last > 40) {
      send();
    } else {
      // dopo 60ms invia comunque l'ultimo valore
      clearTimeout(layerThrottleRef.current[`${layerId}_t`]);
      layerThrottleRef.current[`${layerId}_t`] = setTimeout(send, 80);
    }
  };

  const handleSceneChange = (next) => {
    setSceneDraft(next);
    // Se la scena è attiva e il layer esiste già lato server, fai PATCH live invece di un full re-broadcast
    // (qui lasciamo il PATCH al chiamante drag/resize tramite SceneViewer.editable)
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

  // Auto-initialize / validate turn state when initiatives change
  useEffect(() => {
    if (!code || !token) return;
    const _active = images.filter((i) => i.active !== false);
    const _allHave = _active.length > 0 && _active.every((i) => i.initiative !== null && i.initiative !== undefined);
    const _ordered = _allHave
      ? [..._active].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
      : [];
    const _inTurn = _allHave && _ordered.length > 0;

    const broadcast = async (round, activeId, roundEnd, isActive) => {
      try {
        await api.post(
          `/rooms/${code}/turn`,
          { round, active_id: activeId, round_end: roundEnd, active: isActive },
          { headers: { "X-Master-Token": token } }
        );
      } catch {}
    };

    if (!_inTurn) {
      if (turnActiveId !== null || turnRoundEnd) {
        setTurnActiveId(null);
        setTurnRound(1);
        setTurnRoundEnd(false);
        broadcast(1, null, false, false);
      }
      return;
    }
    const stillValid = _ordered.some((p) => p.id === turnActiveId);
    if (!stillValid) {
      const firstId = _ordered[0]?.id || null;
      setTurnActiveId(firstId);
      setTurnRoundEnd(false);
      broadcast(turnRound, firstId, false, true);
    } else {
      // re-broadcast current state (in case order changed but active still valid)
      broadcast(turnRound, turnActiveId, turnRoundEnd, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token, images.map((i) => `${i.id}:${i.initiative}:${i.active}`).join("|")]);

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

  // Iniziativa: rank map calcolato solo quando TUTTI gli attivi hanno un valore
  const allHaveInitiative = active.length > 0 && active.every((i) => i.initiative !== null && i.initiative !== undefined);
  const orderedActive = (() => {
    if (!allHaveInitiative) return [];
    return [...active].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
  })();
  const rankMap = (() => {
    if (!allHaveInitiative) return {};
    const map = {};
    orderedActive.forEach((img, idx) => { map[img.id] = idx + 1; });
    return map;
  })();
  const turnIndex = orderedActive.findIndex((p) => p.id === turnActiveId);
  const inTurnMode = allHaveInitiative && orderedActive.length > 0;

  // Broadcast turn state to all clients
  const broadcastTurnState = async (round, activeId, roundEnd, isActive = true) => {
    if (!code || !token) return;
    try {
      await api.post(
        `/rooms/${code}/turn`,
        { round, active_id: activeId, round_end: roundEnd, active: isActive },
        { headers: { "X-Master-Token": token } }
      );
    } catch {}
  };

  const turnPrev = () => {
    if (!inTurnMode) return;
    if (turnRoundEnd) {
      setTurnRoundEnd(false);
      broadcastTurnState(turnRound, turnActiveId, false, true);
      return;
    }
    if (turnIndex > 0) {
      const newId = orderedActive[turnIndex - 1].id;
      setTurnActiveId(newId);
      broadcastTurnState(turnRound, newId, false, true);
    } else if (turnRound > 1) {
      const newRound = turnRound - 1;
      const newId = orderedActive[orderedActive.length - 1].id;
      setTurnRound(newRound);
      setTurnActiveId(newId);
      broadcastTurnState(newRound, newId, false, true);
    }
  };

  const turnNext = () => {
    if (!inTurnMode) return;
    if (turnRoundEnd) {
      const newRound = turnRound + 1;
      const newId = orderedActive[0].id;
      setTurnRound(newRound);
      setTurnActiveId(newId);
      setTurnRoundEnd(false);
      broadcastTurnState(newRound, newId, false, true);
      // reset azioni per il nuovo round
      resetRoundActions();
      return;
    }
    if (turnIndex < orderedActive.length - 1) {
      const newId = orderedActive[turnIndex + 1].id;
      setTurnActiveId(newId);
      broadcastTurnState(turnRound, newId, false, true);
    } else {
      setTurnRoundEnd(true);
      broadcastTurnState(turnRound, turnActiveId, true, true);
    }
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

            {/* IN CAMPO + INIZIATIVA */}
            {inTurnMode && (
              <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-slate-900/70 to-slate-900/40 p-5 backdrop-blur-md" data-testid="turn-track-master">
                <TurnTrack
                  ordered={orderedActive}
                  activeId={turnActiveId}
                  round={turnRound}
                  roundEnd={turnRoundEnd}
                  isMaster={true}
                  onPrev={turnPrev}
                  onNext={turnNext}
                  onCloseRoundEnd={turnNext}
                  onRemove={removeFromField}
                  onActionsChange={setActionsCount}
                  onToggleEvaded={toggleEvaded}
                  onToggleClashed={toggleClashed}
                />
              </div>
            )}
            <div className={inTurnMode ? "" : "grid grid-cols-1 gap-5 xl:grid-cols-3"}>
              <div className={`rounded-2xl border-2 border-white/5 bg-slate-900/40 p-6 xl:col-span-2 ${inTurnMode ? "hidden" : ""}`}>
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-pixel text-[9px] uppercase tracking-widest text-amber-400">In campo ora</p>
                  <span className="text-xs text-slate-500">{active.length} attivi {allHaveInitiative && <span className="ml-2 text-amber-300">· ordine attivo</span>}</span>
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
                                const rank = rankMap[img.id];
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
                                  {rank && (
                                    <div
                                      data-testid={`rank-badge-${img.id}`}
                                      title={`Iniziativa ${img.initiative} — turno #${rank}`}
                                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-heading text-[12px] font-black text-slate-950 ring-2 ring-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                                    >
                                      {rank}
                                    </div>
                                  )}
                                  <button
                                    data-testid={`remove-field-${img.id}`}
                                    onClick={() => removeFromField(img.id)}
                                    title="Rimuovi dal campo"
                                    className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/90 text-rose-400 opacity-0 ring-1 ring-rose-500/40 transition-all hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
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

              {/* INIZIATIVA panel */}
              <div className="rounded-2xl border-2 border-amber-500/20 bg-slate-900/60 p-5 backdrop-blur-md" data-testid="initiative-panel">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-pixel text-[9px] uppercase tracking-widest text-amber-300">Iniziativa</p>
                    <p className="text-[10px] text-slate-500">Più alto = primo turno</p>
                  </div>
                </div>
                {active.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-600">Nessun Pokémon in campo</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(() => {
                      // Ordina per rank (se tutti compilati), altrimenti per ordine di ingresso
                      const list = allHaveInitiative
                        ? [...active].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
                        : active;
                      return list.map((img) => {
                        const cat = img.category || "neutral";
                        const meta = CATEGORY_META[cat];
                        const Icon = meta.icon;
                        const rank = rankMap[img.id];
                        return (
                          <div
                            key={img.id}
                            data-testid={`initiative-row-${img.id}`}
                            className={`flex items-center gap-2 rounded-lg border bg-slate-950/60 p-2 transition-all ${rank ? "border-amber-500/30" : "border-white/5"}`}
                          >
                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-slate-950">
                              <img src={img.url} alt="" className="h-full w-full object-contain" />
                              {rank && (
                                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-heading text-[10px] font-black text-slate-950 ring-2 ring-slate-900">
                                  {rank}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
                                <Icon className={`h-2.5 w-2.5 ${cat === "ally" ? "text-emerald-400" : cat === "enemy" ? "text-rose-400" : "text-amber-400"}`} />
                                <span className="text-slate-500">{meta.short}</span>
                              </p>
                              <p className="truncate font-heading text-xs text-slate-200">
                                {img.caption || "Pokémon"}
                              </p>
                            </div>
                            <input
                              data-testid={`initiative-input-${img.id}`}
                              type="number"
                              inputMode="numeric"
                              value={img.initiative ?? ""}
                              onChange={(e) => updateInitiative(img.id, e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                              placeholder="—"
                              className="h-9 w-16 rounded-md border border-amber-500/30 bg-slate-950 text-center font-heading text-sm font-bold text-amber-200 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </div>
                        );
                      });
                    })()}
                    {!allHaveInitiative && (
                      <p className="mt-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-center text-[10px] text-amber-300/80" data-testid="initiative-incomplete">
                        Inserisci un valore per ogni Pokémon per attivare l'ordine di turno.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* OVERLAY: invio immagine generica ai giocatori */}
            <div className="rounded-2xl border-2 border-fuchsia-500/20 bg-slate-900/60 p-6 backdrop-blur-md" data-testid="overlay-panel">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-600/20 text-fuchsia-300">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-pixel text-[9px] uppercase tracking-widest text-fuchsia-300">Broadcast Immagine</p>
                    <h2 className="font-heading text-xl font-bold text-slate-50">Mostra un'immagine ai giocatori</h2>
                  </div>
                </div>
                {sceneActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
                  </span>
                )}
              </div>

              <SceneEditor
                scene={sceneDraft}
                onChange={(next) => {
                  setSceneDraft(next);
                  // Se la scena è attiva, broadcast PATCH live per ogni layer cambiato
                  if (sceneActive) {
                    const before = sceneActive.layers || [];
                    const after = next.layers || [];
                    after.forEach((nl) => {
                      const ol = before.find((o) => o.id === nl.id);
                      if (!ol) return;
                      const patch = {};
                      ["x", "y", "w", "h", "z", "url"].forEach((k) => {
                        if (ol[k] !== nl[k]) patch[k] = nl[k];
                      });
                      if (Object.keys(patch).length > 0) {
                        patchLayer(nl.id, patch);
                      }
                    });
                    // Aggiorna anche sceneActive per il prossimo confronto
                    setSceneActive({ ...sceneActive, layers: after });
                  }
                }}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
              />

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  data-testid="scene-show-btn"
                  onClick={() => showScene()}
                  disabled={overlaySending || !sceneDraft.background_url?.trim()}
                  className="h-12 flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 font-heading font-black uppercase tracking-wider text-white hover:from-fuchsia-500 hover:to-pink-400 disabled:opacity-40"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {overlaySending ? "Invio..." : sceneActive ? "Aggiorna scena" : "Mostra ai giocatori"}
                </Button>
                {sceneActive && (
                  <Button
                    data-testid="scene-hide-btn"
                    onClick={hideScene}
                    variant="outline"
                    className="h-12 rounded-xl border-rose-500/40 bg-rose-500/5 font-heading font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                  >
                    <EyeOff className="mr-2 h-4 w-4" /> Chiudi
                  </Button>
                )}
              </div>

              {sceneHistory.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 font-pixel text-[9px] uppercase tracking-widest text-fuchsia-300">Cronologia scene ({sceneHistory.length}/5)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {sceneHistory.map((h) => (
                      <div
                        key={h.id}
                        className="group relative overflow-hidden rounded-lg border border-fuchsia-500/20 bg-slate-950/60"
                        data-testid={`scene-history-${h.id}`}
                      >
                        <button
                          onClick={() => { setSceneDraft({ background_url: h.background_url, caption: h.caption || "", layers: (h.layers || []).map((l) => ({ ...l })) }); showScene(h); }}
                          title="Carica e mostra"
                          className="block w-full"
                          data-testid={`scene-replay-${h.id}`}
                        >
                          <img src={h.background_url} alt={h.caption || "scene"} className="h-20 w-full object-cover transition-transform group-hover:scale-105" />
                          {(h.layers || []).length > 0 && (
                            <span className="absolute left-1 top-1 rounded-full bg-fuchsia-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-950">
                              +{h.layers.length}
                            </span>
                          )}
                        </button>
                        {h.caption && <p className="px-2 py-1 text-[10px] text-slate-400 line-clamp-1">{h.caption}</p>}
                        <button
                          onClick={() => removeSceneFromHistory(h.id)}
                          title="Rimuovi"
                          data-testid={`scene-remove-${h.id}`}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/90 text-rose-400 opacity-0 ring-1 ring-rose-500/40 transition-opacity hover:bg-rose-500/20 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
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
