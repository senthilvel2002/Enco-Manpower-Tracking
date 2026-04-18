/**
 * Canvas helpers for react-easy-crop output → data URL (JPEG).
 */

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
      img.crossOrigin = "anonymous";
    }
    img.src = url;
  });
}

/**
 * @param {string} imageSrc - object URL or data URL
 * @param {import("react-easy-crop").Area} pixelCrop - crop area in image pixels
 * @param {{ maxSide?: number, quality?: number }} [opts]
 */
export async function getCroppedImgDataUrl(imageSrc, pixelCrop, opts = {}) {
  const { maxSide = 1200, quality = 0.9 } = opts;
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  let { width, height } = pixelCrop;
  if (width < 1 || height < 1) {
    throw new Error("Invalid crop");
  }
  const scale = maxSide > 0 ? Math.min(1, maxSide / Math.max(width, height)) : 1;
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality
    );
  });
}
