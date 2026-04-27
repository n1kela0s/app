import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * SceneViewer — visualizza scena (sfondo + layers sovrapposti) mantenendo aspect-ratio.
 * Lo stage usa coordinate normalizzate 0..1 sia per posizione (centro layer) sia per dimensione.
 *
 * Props:
 *   scene: { background_url, caption, layers: [{ id, url, x, y, w, h }] }
 *   onLayerChange?: (id, patch) => void  (master only)
 *   onLayerSelect?: (id|null) => void
 *   selectedLayerId?: string|null
 *   editable?: bool
 *   className?: string
 *   stageHeight?: string (CSS height)
 *   subdued?: bool — modalità "sfondo soft" (fade)
 */
export default function SceneViewer({
  scene,
  onLayerChange,
  onLayerSelect,
  selectedLayerId,
  editable = false,
  className = "",
  stageHeight,
  subdued = false,
}) {
  const stageRef = useRef(null);
  const [stageRect, setStageRect] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const update = () => {
      if (!stageRef.current) return;
      const r = stageRef.current.getBoundingClientRect();
      setStageRect({ width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  if (!scene || !scene.background_url) return null;

  return (
    <div
      ref={stageRef}
      className={`relative w-full overflow-hidden bg-slate-950 ${className}`}
      style={{ height: stageHeight, aspectRatio: stageHeight ? undefined : "16 / 9" }}
      onPointerDown={(e) => {
        if (editable && onLayerSelect && e.target === stageRef.current) onLayerSelect(null);
      }}
    >
      <img
        src={scene.background_url}
        alt={scene.caption || "scena"}
        className={`absolute inset-0 h-full w-full object-cover ${subdued ? "opacity-30 grayscale-[20%]" : ""}`}
        draggable={false}
      />
      {(scene.layers || []).map((layer, idx) => (
        <SceneLayerNode
          key={layer.id}
          layer={layer}
          stageWidth={stageRect.width}
          stageHeight={stageRect.height}
          editable={editable}
          selected={selectedLayerId === layer.id}
          onLayerChange={onLayerChange}
          onSelect={onLayerSelect}
          z={idx}
          subdued={subdued}
        />
      ))}
    </div>
  );
}

function SceneLayerNode({ layer, stageWidth, stageHeight, editable, selected, onLayerChange, onSelect, z, subdued }) {
  const [drag, setDrag] = useState(null);  // { startX, startY, originX, originY, mode: 'move'|'resize' }

  // Convert normalized coords to pixels
  const w = layer.w * stageWidth;
  const h = layer.h * stageHeight;
  const left = layer.x * stageWidth - w / 2;
  const top = layer.y * stageHeight - h / 2;

  const handlePointerDown = (e, mode) => {
    if (!editable || !onLayerChange) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect?.(layer.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: layer.x, y: layer.y, w: layer.w, h: layer.h },
      mode,
    });
  };

  const handlePointerMove = (e) => {
    if (!drag || !stageWidth) return;
    const dx = (e.clientX - drag.startX) / stageWidth;
    const dy = (e.clientY - drag.startY) / stageHeight;
    if (drag.mode === "move") {
      const nx = clamp(drag.origin.x + dx, drag.origin.w / 2, 1 - drag.origin.w / 2);
      const ny = clamp(drag.origin.y + dy, drag.origin.h / 2, 1 - drag.origin.h / 2);
      onLayerChange(layer.id, { x: nx, y: ny });
    } else if (drag.mode === "resize") {
      const nw = clamp(drag.origin.w + dx * 2, 0.04, 1);
      // mantieni aspect ratio originale del layer
      const ratio = drag.origin.h / drag.origin.w || 1;
      const nh = clamp(nw * ratio, 0.04, 1);
      onLayerChange(layer.id, { w: nw, h: nh });
    }
  };

  const handlePointerUp = (e) => {
    if (!drag) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    setDrag(null);
  };

  return (
    <motion.div
      className={`absolute touch-none ${editable ? "cursor-move select-none" : "pointer-events-none"} ${selected ? "ring-2 ring-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.55)]" : ""}`}
      style={{
        left,
        top,
        width: w,
        height: h,
        zIndex: 10 + z,
      }}
      animate={drag ? {} : { left, top, width: w, height: h }}
      transition={{ type: "tween", duration: drag ? 0 : 0.16, ease: "easeOut" }}
      onPointerDown={(e) => handlePointerDown(e, "move")}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-testid={`scene-layer-${layer.id}`}
    >
      <img
        src={layer.url}
        alt=""
        className={`pointer-events-none h-full w-full object-contain ${subdued ? "opacity-50" : ""}`}
        draggable={false}
      />
      {editable && selected && (
        <div
          data-testid={`scene-layer-resize-${layer.id}`}
          onPointerDown={(e) => handlePointerDown(e, "resize")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-amber-300 bg-slate-950 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
          title="Ridimensiona"
        />
      )}
    </motion.div>
  );
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
