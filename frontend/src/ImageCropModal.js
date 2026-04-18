import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { getCroppedImgDataUrl } from "./cropImageUtils";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(dataUrl: string) => void} props.onConfirm
 * @param {number} [props.aspect] - width/height (1 = square, 4/3, 16/9, etc.)
 * @param {string} [props.title]
 */
export default function ImageCropModal({ open, onClose, onConfirm, aspect = 1, title = "Adjust image" }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setErr("");
    }
  }, [open]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    setErr("");
    const url = URL.createObjectURL(f);
    setImageSrc((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    setErr("");
    try {
      const dataUrl = await getCroppedImgDataUrl(imageSrc, croppedAreaPixels, { maxSide: 1200, quality: 0.88 });
      onConfirm(dataUrl);
      onClose();
    } catch (e) {
      setErr(e.message || "Could not crop image.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button type="button" className="text-slate-400 hover:text-white text-xl leading-none px-2" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!imageSrc ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Choose image</label>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500/20 file:px-3 file:py-2 file:text-sky-200"
                onChange={handleFile}
              />
            </div>
          ) : (
            <>
              <div className="relative w-full h-64 rounded-xl overflow-hidden bg-black border border-white/10">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  showGrid
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.02}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-sky-300 underline"
                onClick={() => {
                  if (imageSrc && imageSrc.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
                  setImageSrc(null);
                  setCroppedAreaPixels(null);
                }}
              >
                Pick a different file
              </button>
            </>
          )}

          {err && <p className="text-sm text-rose-400">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border border-white/20 text-slate-300 text-sm font-bold px-4 py-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!imageSrc || !croppedAreaPixels || busy}
              className="rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-bold px-5 py-2"
              onClick={handleConfirm}
            >
              {busy ? "Saving…" : "Use this crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
