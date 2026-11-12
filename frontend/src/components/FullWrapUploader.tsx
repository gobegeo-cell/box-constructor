import React, { useEffect, useRef, useState } from "react";
import { useBoxStore } from "../store/useBoxStore";

export default function FullWrapUploader() {
  const artwork = useBoxStore((s) => s.fullWrapArtwork);
  const setArtwork = useBoxStore((s) => s.setFullWrapArtwork);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  async function upload(file?: File) {
    if (!file) return;
    const id = ++request.current;
    setError("");
    setLoading(false);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Выберите изображение PNG, JPG или WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Размер файла не должен превышать 20 МБ.");
      return;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (id !== request.current) return;
      // Keep the preview bounded for mobile GPUs. The original file is not uploaded.
      const factor = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * factor));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * factor));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setArtwork({ dataUrl: canvas.toDataURL("image/png"), name: file.name });
    } catch {
      if (id === request.current) setError("Не удалось прочитать изображение. Выберите другой файл.");
    } finally {
      URL.revokeObjectURL(url);
      if (id === request.current) setLoading(false);
    }
  }

  return (
    <div style={{ margin: "8px 0", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
      <label style={{ display: "block", fontWeight: 600 }}>
        Макет полноцветной печати
        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "block", width: "100%", marginTop: 8 }}
          onChange={(e) => { void upload(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
      </label>
      <div style={{ fontSize: 12, marginTop: 6 }}>PNG, JPG или WebP, до 20 МБ. Изображение накладывается по развёртке 3D-модели. Это предварительный вид, не печатная развёртка.</div>
      {loading && <div role="status">Загружаю макет…</div>}
      {error && <div role="alert" style={{ color: "#b00020", marginTop: 6 }}>{error}</div>}
      {artwork && <div style={{ marginTop: 8 }}>
        <img src={artwork.dataUrl} alt="Загруженный макет полноцвета" style={{ width: 100, height: 70, objectFit: "contain", background: "white" }} />
        <div style={{ overflowWrap: "anywhere" }}>{artwork.name}</div>
        <button type="button" onClick={() => { request.current++; setLoading(false); setError(""); setArtwork(null); }}>Удалить макет</button>
      </div>}
    </div>
  );
}
