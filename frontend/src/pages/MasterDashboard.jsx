import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Projector, Send, Upload, LinkIcon, Users, History, LogOut, CheckCircle2 } from "lucide-react";
import { api, wsUrl, fileUrl, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function MasterDashboard() {
  const { code: paramCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(null);
  const [token, setToken] = useState(null);
  const [images, setImages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState("url"); // url | upload
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const wsRef = useRef(null);

  // Create or resume room
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
          toast.error("Errore creazione stanza");
        }
      }
    };
    setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WS
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
    ws.onclose = () => {};
    return () => ws.close();
  }, [code]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Codice copiato!");
    setTimeout(() => setCopied(false), 1500);
  };

  const copyPlayerLink = async () => {
    const link = `${window.location.origin}/join`;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiato!");
  };

  const send = async () => {
    if (!code || !token) return;
    setSending(true);
    try {
      let imgUrl = url.trim();
      let source = "url";
      if (mode === "upload") {
        if (!file) {
          toast.error("Seleziona un'immagine");
          setSending(false);
          return;
        }
        const form = new FormData();
        form.append("file", file);
        const up = await api.post(`/rooms/${code}/upload`, form, {
          headers: { "X-Master-Token": token, "Content-Type": "multipart/form-data" },
        });
        imgUrl = fileUrl(up.data.storage_path);
        source = "upload";
      } else {
        if (!imgUrl) {
          toast.error("Inserisci un URL");
          setSending(false);
          return;
        }
      }
      const res = await api.post(
        `/rooms/${code}/images`,
        { url: imgUrl, caption, source },
        { headers: { "X-Master-Token": token } }
      );
      setImages((prev) => [...prev, res.data]);
      setUrl("");
      setCaption("");
      setFile(null);
      toast.success("Inviata ai giocatori");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore invio");
    } finally {
      setSending(false);
    }
  };

  const closeRoom = async () => {
    if (!window.confirm("Chiudere la stanza? I giocatori verranno disconnessi.")) return;
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Creazione stanza...
      </div>
    );
  }

  const lastImage = images[images.length - 1];

  return (
    <div className="min-h-screen bg-zinc-950 font-body text-zinc-100" data-testid="master-dashboard">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Projector className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Master</p>
              <h1 className="font-heading text-lg font-bold tracking-tight">Control Room</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="room-code-display"
              onClick={copyCode}
              className="group flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 font-heading text-sm font-bold tracking-[0.2em] text-amber-400 transition-all hover:border-amber-500/60 hover:bg-amber-500/20"
            >
              {code}
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-70 group-hover:opacity-100" />}
            </button>
            <Button
              data-testid="copy-link-btn"
              variant="outline"
              onClick={copyPlayerLink}
              className="rounded-full border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-50"
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

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Stage area */}
          <section className="flex flex-col gap-6 lg:col-span-8">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Invia immagine</p>
                  <h2 className="font-heading text-2xl font-bold text-zinc-50">Proietta qualcosa</h2>
                </div>
                <div className="flex rounded-full border border-white/10 bg-black/40 p-1">
                  <button
                    data-testid="mode-url-btn"
                    onClick={() => setMode("url")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${mode === "url" ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-50"}`}
                  >
                    URL
                  </button>
                  <button
                    data-testid="mode-upload-btn"
                    onClick={() => setMode("upload")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${mode === "upload" ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-50"}`}
                  >
                    Upload
                  </button>
                </div>
              </div>

              {mode === "url" ? (
                <Input
                  data-testid="image-url-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://esempio.com/immagine.jpg"
                  className="h-12 border-white/10 bg-black/50 text-zinc-50 placeholder:text-zinc-600 focus-visible:border-amber-500"
                />
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-black/30 px-6 py-10 text-center transition-all hover:border-amber-500/50 hover:bg-amber-500/5" data-testid="file-upload-dropzone">
                  <Upload className="mb-2 h-8 w-8 text-amber-500" />
                  <p className="font-heading text-sm font-bold text-zinc-200">
                    {file ? file.name : "Trascina o clicca per caricare"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">JPG, PNG, GIF, WEBP — max 15MB</p>
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
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Didascalia</label>
                <Input
                  data-testid="caption-input"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Una breve frase..."
                  maxLength={140}
                  className="h-12 border-white/10 bg-black/50 text-zinc-50 placeholder:text-zinc-600 focus-visible:border-amber-500"
                />
                <p className="mt-1 text-right text-xs text-zinc-600">{caption.length}/140</p>
              </div>

              <Button
                data-testid="send-image-btn"
                onClick={send}
                disabled={sending}
                className="mt-4 h-14 w-full rounded-xl bg-amber-500 font-heading text-lg font-black uppercase tracking-widest text-zinc-950 transition-all duration-300 hover:bg-amber-400 hover:shadow-[0_0_40px_rgba(245,158,11,0.35)] disabled:opacity-50"
              >
                <Send className="mr-3 h-5 w-5" /> {sending ? "Invio..." : "Invia"}
              </Button>
            </div>

            {/* Preview last sent */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Ultima inviata</p>
              {lastImage ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                  <img src={lastImage.url} alt="last" className="max-h-[420px] w-full object-contain" />
                  {lastImage.caption && (
                    <p className="border-t border-white/5 bg-black/70 px-5 py-3 font-heading text-base text-zinc-100">{lastImage.caption}</p>
                  )}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-zinc-600">Nessuna immagine ancora inviata</p>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Spettatori</p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20" data-testid="online-count">
                  <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  {onlineCount} online
                </Badge>
              </div>
              <Separator className="my-4 bg-white/5" />
              <p className="text-sm text-zinc-400">
                Condividi il codice <span className="font-heading font-bold text-amber-400">{code}</span> con i tuoi amici. Si collegheranno da{" "}
                <span className="text-zinc-200">/join</span>.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Storico ({images.length})</p>
              </div>
              <ScrollArea className="h-[380px] pr-3">
                <div className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {[...images].reverse().map((img) => (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="overflow-hidden rounded-xl border border-white/5 bg-black/40"
                        data-testid={`history-item-${img.id}`}
                      >
                        <img src={img.url} alt={img.caption} className="h-32 w-full object-cover" />
                        {img.caption && <p className="px-3 py-2 text-xs text-zinc-300 line-clamp-2">{img.caption}</p>}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {images.length === 0 && (
                    <p className="py-6 text-center text-xs text-zinc-600">Nessuna immagine inviata</p>
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
