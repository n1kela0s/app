import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ImagePlus, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SceneViewer from "@/components/SceneViewer";

export default function SceneEditor({ scene, onChange, onSelectLayer, selectedLayerId }) {
  const [newLayerUrl, setNewLayerUrl] = useState("");

  const updateLayer = (id, patch) => {
    if (!onChange) return;
    onChange({
      ...scene,
      layers: (scene.layers || []).map((l) => l.id === id ? { ...l, ...patch } : l),
    });
  };

  const addLayer = () => {
    const url = newLayerUrl.trim();
    if (!url) return;
    const newId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    onChange({
      ...scene,
      layers: [
        ...(scene.layers || []),
        { id: newId, url, x: 0.5, y: 0.5, w: 0.18, h: 0.18, z: (scene.layers || []).length },
      ],
    });
    setNewLayerUrl("");
    onSelectLayer?.(newId);
  };

  const removeLayer = (id) => {
    onChange({ ...scene, layers: (scene.layers || []).filter((l) => l.id !== id) });
    if (selectedLayerId === id) onSelectLayer?.(null);
  };

  const moveLayer = (id, dir) => {
    const layers = [...(scene.layers || [])];
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= layers.length) return;
    [layers[idx], layers[swap]] = [layers[swap], layers[idx]];
    onChange({ ...scene, layers });
  };

  const setBg = (url) => onChange({ ...scene, background_url: url });
  const setCaption = (caption) => onChange({ ...scene, caption });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Stage preview */}
        <div className="lg:col-span-2">
          <p className="mb-1 font-pixel text-[9px] uppercase tracking-widest text-fuchsia-300">Anteprima — trascina e ridimensiona i layer</p>
          {scene.background_url ? (
            <SceneViewer
              scene={scene}
              editable
              onLayerChange={updateLayer}
              onLayerSelect={onSelectLayer}
              selectedLayerId={selectedLayerId}
              className="rounded-xl border-2 border-fuchsia-500/30"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border-2 border-dashed border-fuchsia-500/20 bg-slate-950/60 p-6 text-center">
              <p className="text-xs text-slate-500">Inserisci un URL per lo sfondo per iniziare a comporre la scena.</p>
            </div>
          )}
        </div>

        {/* Layer panel */}
        <div className="rounded-xl border border-fuchsia-500/20 bg-slate-950/60 p-3">
          <p className="mb-2 font-pixel text-[9px] uppercase tracking-widest text-fuchsia-300">Sfondo</p>
          <Input
            data-testid="scene-bg-input"
            value={scene.background_url || ""}
            onChange={(e) => setBg(e.target.value)}
            placeholder="https://.../mappa.png"
            className="h-10 border-white/10 bg-slate-900/80 text-slate-50 placeholder:text-slate-600 focus-visible:border-fuchsia-500"
          />
          <Input
            data-testid="scene-caption-input"
            value={scene.caption || ""}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Didascalia (opzionale)"
            maxLength={140}
            className="mt-2 h-10 border-white/10 bg-slate-900/80 text-slate-50 placeholder:text-slate-600 focus-visible:border-fuchsia-500"
          />

          <p className="mb-1 mt-3 flex items-center justify-between font-pixel text-[9px] uppercase tracking-widest text-fuchsia-300">
            Layer ({(scene.layers || []).length})
          </p>
          <div className="space-y-1.5">
            <AnimatePresence>
              {(scene.layers || []).map((layer, idx) => (
                <motion.div
                  key={layer.id}
                  layout
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-2 rounded-md border p-1.5 ${selectedLayerId === layer.id ? "border-amber-400/70 bg-amber-500/5" : "border-white/5 bg-slate-900/40"}`}
                  data-testid={`scene-layer-row-${layer.id}`}
                >
                  <button onClick={() => onSelectLayer?.(layer.id)} className="flex flex-1 items-center gap-2 text-left">
                    <img src={layer.url} alt="" className="h-9 w-9 rounded bg-slate-950 object-contain" />
                    <span className="truncate text-[10px] text-slate-400">#{idx + 1} · {Math.round(layer.w * 100)}% × {Math.round(layer.h * 100)}%</span>
                  </button>
                  <button
                    title="Sposta avanti"
                    onClick={() => moveLayer(layer.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    title="Sposta indietro"
                    onClick={() => moveLayer(layer.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    data-testid={`scene-layer-delete-${layer.id}`}
                    title="Rimuovi layer"
                    onClick={() => removeLayer(layer.id)}
                    className="flex h-7 w-7 items-center justify-center rounded text-rose-400 hover:bg-rose-500/15"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {(scene.layers || []).length === 0 && (
              <p className="rounded-md border border-dashed border-white/5 px-2 py-3 text-center text-[10px] text-slate-600">Nessun layer</p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              data-testid="scene-new-layer-url"
              value={newLayerUrl}
              onChange={(e) => setNewLayerUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLayer(); } }}
              placeholder="URL nuovo layer..."
              className="h-9 flex-1 border-white/10 bg-slate-900/80 text-xs text-slate-50 placeholder:text-slate-600 focus-visible:border-fuchsia-500"
            />
            <Button
              data-testid="scene-add-layer-btn"
              onClick={addLayer}
              disabled={!newLayerUrl.trim()}
              className="h-9 rounded-md bg-fuchsia-600 px-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-fuchsia-500 disabled:opacity-40"
            >
              <ImagePlus className="mr-1 h-3.5 w-3.5" /> Aggiungi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
