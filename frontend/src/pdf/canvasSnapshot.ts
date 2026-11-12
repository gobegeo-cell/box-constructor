/** Trim unused canvas space so the box fills its PDF preview frame. */
export async function getCanvasSnapshot() {
  const source = (window as any).__boxCanvas as HTMLCanvasElement | undefined
    || document.querySelector<HTMLCanvasElement>("#box-canvas canvas")
    || document.querySelector<HTMLCanvasElement>("canvas");
  if (!source?.width || !source.height) return null;
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width, h = canvas.height;
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, (w * h - 1) * 4];
  const transparent = corners.every(i => data[i + 3] < 16);
  const bg = [data[0], data[1], data[2]];
  let left = w, right = -1, top = h, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const visible = data[i + 3] > 16 && (transparent ||
        Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]),
          Math.abs(data[i + 2] - bg[2])) > 12);
      if (!visible) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return { dataUrl: canvas.toDataURL("image/png"), w, h };
  const padding = Math.max(4, Math.ceil(Math.max(right - left + 1, bottom - top + 1) * 0.05));
  left = Math.max(0, left - padding); top = Math.max(0, top - padding);
  right = Math.min(w - 1, right + padding); bottom = Math.min(h - 1, bottom + padding);
  const cropped = document.createElement("canvas");
  cropped.width = right - left + 1;
  cropped.height = bottom - top + 1;
  const output = cropped.getContext("2d");
  if (!output) return null;
  output.drawImage(canvas, left, top, cropped.width, cropped.height,
    0, 0, cropped.width, cropped.height);
  return { dataUrl: cropped.toDataURL("image/png"), w: cropped.width, h: cropped.height };
}
