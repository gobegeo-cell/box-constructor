// src/components/PriceEstimator.tsx — мгновенное скачивание PDF на ПК + фоновая отправка менеджеру
import React, { useMemo, useState, useEffect } from "react";
import generateClientQuote from "../pdf/clientQuote";
import generateManagerQuote from "../pdf/managerQuote";
import { useBoxStore } from "../store/useBoxStore";
import { useUiStore } from "../store/useUiStore";
import { estimateCost } from "../lib/constructor/costing";

/* ===== helpers ===== */
const fmtCur = (n: number, currency: string) =>
  `${Number(n || 0).toLocaleString("ru-RU")} ${currency}`;
const fmtInt = (n: number) => Number(n || 0).toLocaleString("ru-RU");

/* ==== logo helpers (как у тебя) ==== */
function normalizeSideKey(k: string): string {
  const s = (k || "").toLowerCase().trim().replace(/\s+/g, "_");
  if (/^крышка$|^top$|^lid$|^top_lid$|^lid_top$/.test(s)) return "top";
  if (/^дно$|^bottom$|^base$|^bottom_base$|^bot$/.test(s)) return "bottom";
  if (/^передний_клапан$|^клапан_передний$|^front_flap$|^flap_front$/.test(s)) return "front_flap";
  if (/^перед$|^front$|^front_panel$|^face$/.test(s)) return "front";
  if (/^зад$|^спинка$|^back$/.test(s)) return "back";
  if (/^лево$|^левая$|^left$/.test(s)) return "left";
  if (/^право$|^правая$|^right$/.test(s)) return "right";
  return s;
}
function getFaceMM(side: string, dims: { W: number; H: number; D: number }) {
  const s = normalizeSideKey(side);
  switch (s) {
    case "front":
    case "back":
    case "front_flap":
      return { w: dims.W, h: dims.H };
    case "left":
    case "right":
      return { w: dims.D, h: dims.H };
    case "top":
    case "bottom":
      return { w: dims.W, h: dims.D };
    default:
      return { w: dims.W, h: dims.H };
  }
}
function hasRealAsset(it: any): boolean {
  if (!it) return false;
  const hasFile = typeof File !== "undefined" && it.file instanceof File;
  const hasBlob = typeof Blob !== "undefined" && it.blob instanceof Blob;
  const content = typeof it.content === "string" ? it.content : "";
  const contentOk = content.startsWith("blob:") || content.startsWith("data:") || /^https?:\/\//i.test(content);
  const src = typeof it.src === "string" ? it.src : "";
  const srcOk = src.length > 0;
  const blobOrDataSrc = srcOk && (src.startsWith("blob:") || src.startsWith("data:"));
  const objUrl = typeof it.objectURL === "string" && it.objectURL.startsWith("blob:");
  const hasUrl = typeof it.url === "string" && it.url.length > 0;
  const hasData = !!(it.dataUrl || it.base64 || it.imageData);
  const hasSvgOrText = !!(it.svg || it.text || it.image);
  return hasFile || hasBlob || contentOk || objUrl || blobOrDataSrc || srcOk || hasUrl || hasData || hasSvgOrText || it.enabled === true;
}
function numSmart(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/-?\d*\.?\d+/);
    return m ? parseFloat(m[0]) : null;
  }
  return null;
}
function pickFromSizeString(s: string): { w: number; h: number } | null {
  const t = s.replace(",", ".").toLowerCase();
  const m = t.match(/(-?\d*\.?\d+)\s*[x×х*]\s*(-?\d*\.?\d+)/i);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}
function pickMM(it: any): { w: number; h: number } | null {
  if (!it || typeof it !== "object") return null;
  if (it.size_mm && typeof it.size_mm === "object") {
    const w = numSmart(it.size_mm.w);
    const h = numSmart(it.size_mm.h);
    if (w && h && w > 0 && h > 0) return { w, h };
  }
  const wKeys = ["wMM","widthMM","w_mm","mmW","width","w","sizeW","realWMM","realWidthMM","constructorWMM","constructorWidthMM","realW","constructorW","W"];
  const hKeys = ["hMM","heightMM","h_mm","mmH","height","h","sizeH","realHMM","realHeightMM","constructorHMM","constructorHeightMM","realH","constructorH","H"];
  for (const wk of wKeys) for (const hk of hKeys) {
    const w = numSmart((it as any)[wk]);
    const h = numSmart((it as any)[hk]);
    if (w && h && w > 0 && h > 0) return { w, h };
  }
  const sizeObj = (it as any).sizeMM ?? (it as any).mm ?? (it as any).MM ?? (it as any).size ?? (it as any).size_mm ?? (it as any).constructorSize ?? (it as any).realSize;
  if (typeof sizeObj === "string") {
    const p = pickFromSizeString(sizeObj);
    if (p) return p;
  }
  if (sizeObj && typeof sizeObj === "object") {
    const w = numSmart(sizeObj.w ?? sizeObj.width ?? sizeObj.W);
    const h = numSmart(sizeObj.h ?? sizeObj.height ?? sizeObj.H);
    if (w && h && w > 0 && h > 0) {
      const isDefault50 = Math.round(w) === 50 && Math.round(h) === 50;
      const hasScale = !!(it.scale || it.scaleX || it.scaleY || it.sx || it.sy || it.scale?.x || it.scale?.z);
      const hasContent = typeof it.content === "string" || typeof it.src === "string" || (typeof File !== "undefined" && it.file instanceof File);
      if (!(isDefault50 && (hasScale || hasContent))) return { w, h };
    }
  }
  return null;
}
function pickPctOrScale(it: any, face: { w: number; h: number }): { w: number; h: number } | null {
  if (!it || typeof it !== "object") return null;
  const pW = numSmart((it as any).pctW ?? (it as any).wPct ?? (it as any).percentW);
  const pH = numSmart((it as any).pctH ?? (it as any).hPct ?? (it as any).percentH);
  if (pW && pH) {
    const kW = pW > 1 ? pW / 100 : pW;
    const kH = pH > 1 ? pH / 100 : pH;
    const w = Math.max(0, kW) * face.w;
    const h = Math.max(0, kH) * face.h;
    return w > 0 && h > 0 ? { w, h } : null;
  }
  const s = numSmart((it as any).scale);
  if (s && s > 0) {
    const k = s > 2 ? s / 100 : s;
    return { w: k * face.w, h: k * face.h };
  }
  const sx = numSmart((it as any).scale?.x ?? (it as any).sx ?? (it as any).scaleX);
  const sz = numSmart((it as any).scale?.z ?? (it as any).sy ?? (it as any).scaleY);
  const k = (sx && sz) ? Math.min(sx, sz) : (sx || sz || null);
  if (k && k > 0) {
    const kk = k > 2 ? k / 100 : k;
    return { w: kk * face.w, h: kk * face.h };
  }
  return null;
}
function extractLogosMeta(logos: any, dims: { W: number; H: number; D: number }, boxType?: string) {
  const out: { side: string; wMM: number; hMM: number }[] = [];
  if (!logos || typeof logos !== "object") return out;
  for (const [sideRaw, v] of Object.entries(logos)) {
    let side = normalizeSideKey(String(sideRaw));
    if (boxType === "casket" && side === "front" && !(logos as any)["front_flap"]) side = "front_flap";
    if (boxType !== "casket" && side === "front_flap") side = "front";
    const face = getFaceMM(side, dims);
    const list = Array.isArray(v) ? v : [v];
    for (const it of list) {
      if (!hasRealAsset(it)) continue;
      let mm = pickMM(it);
      if (!mm) mm = pickPctOrScale(it, face);
      if (!mm) continue;
      const wMM = Math.round(mm.w * 10) / 10;
      const hMM = Math.round(mm.h * 10) / 10;
      if (wMM > 0 && hMM > 0) out.push({ side, wMM, hMM });
    }
  }
  return out;
}

/* ===== компонент ===== */
export default function PriceEstimator() {
  // store: коробка
  const { width, height, depth, boxType, sideColors, logos } = useBoxStore((s: any) => ({
    width: s.width, height: s.height, depth: s.depth,
    boxType: s.boxType, sideColors: s.sideColors, logos: s.logos,
  }));

  // store: код/сброс
  const status          = useUiStore((s) => s.status);
  const error           = useUiStore((s) => s.error);
  const checkAccessCode = useUiStore((s) => s.checkAccessCode);
  const resetAccess     = useUiStore((s) => s.resetAccess);

  // локальные состояния
  const [quantity, setQuantity] = useState<number>(100);
  const currency = "₽";

  // печать / отделка
  const [print, setPrint] = useState<"logosOnly" | "fullWrap">("logosOnly");
  const [finBlind, setFinBlind] = useState(false);
  const [finFoil, setFinFoil] = useState(false);
  const [finUV, setFinUV] = useState(false);
  const [finMagnets, setFinMagnets] = useState(false);

  // материалы
  const [baseBoard, setBaseBoard] = useState<"chip_1_5" | "chip_2_0">("chip_1_5");
  const [wrapPaper, setWrapPaper] = useState<string>("designer_120");
  const [lamination, setLamination] = useState<"none" | "matt" | "gloss">("none");
  const [wrapLam, setWrapLam] = useState<"none" | "matt" | "gloss">("none");

  // доп. опции
  const [innerMode, setInnerMode] = useState<"none" | "bottom">("none");
  const [drawerSleeveInner, setDrawerSleeveInner] = useState<boolean>(false);
  const [lidLong, setLidLong] = useState<boolean>(false);

  // промокод
  const [promo, setPromo] = useState<string>("");

  // занятость (защита от дабл-кликов)
  const [isBusy, setIsBusy] = useState(false);

  // ламинация
  const lamDisabled = wrapPaper === "designer_120";
  const lamRequired = wrapPaper === "offset_150" || wrapPaper === "coated_150";
  const lamValue = boxType === "casket" ? wrapLam : lamination;
  const setLamValue = (v: "none" | "matt" | "gloss") =>
    boxType === "casket" ? setWrapLam(v) : setLamination(v);

  useEffect(() => {
    if (lamDisabled) {
      boxType === "casket" ? setWrapLam("none") : setLamination("none");
    } else if (lamRequired) {
      boxType === "casket"
        ? wrapLam === "none" && setWrapLam("matt")
        : lamination === "none" && setLamination("matt");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapPaper, boxType]);

  const innerPaperAuto = boxType === "lidBottom" || boxType === "casket" ? wrapPaper : "none";

  // inputs
  const inputs = useMemo(() => {
    const W = Number(width) || 250, H = Number(height) || 80, D = Number(depth) || 160;
    const logosMeta = extractLogosMeta(logos, { W, H, D }, String(boxType || ""));
    const base = {
      widthMM: W, heightMM: H, depthMM: D, boxType,
      quantity: Math.max(1, Math.floor(quantity)), currency, print,
      baseBoard, wrapPaper: wrapPaper as any, innerPaper: innerPaperAuto as any,
      innerMode, drawerSleeveInner,
      finishing: { blindEmboss: finBlind, foilStamp: finFoil, spotUV: finUV, magnetsPair: finMagnets },
      logosMeta,
    };
    const lamObj = boxType === "casket"
      ? { wrapLamination: lamDisabled ? "none" : wrapLam || (lamRequired ? "matt" : "none") }
      : { lamination: lamDisabled ? "none" : lamination || (lamRequired ? "matt" : "none") };
    const lidLongObj = boxType === "lidBottom" ? { lidLong: !!lidLong } : {};
    return { ...base, ...lamObj, ...lidLongObj };
  }, [width,height,depth,boxType,quantity,currency,print,baseBoard,wrapPaper,lamination,wrapLam,innerPaperAuto,innerMode,lamDisabled,lamRequired,finBlind,finFoil,finUV,finMagnets,lidLong,drawerSleeveInner,logos]);

  const out = useMemo(() => estimateCost(inputs as any), [inputs]);

  // pricing derived from calculator
  const pricing = useMemo(() => buildPricing(out, quantity), [out, quantity]);

  // Sheets (consumption)
  const sheets = (out && (out.sheets1000x700 || out.sheets)) || {};
  const boardSheets = Number(sheets.board || 0);
  const wrapSheets  = Number(sheets.wrap  || 0);
  const innerSheets = Number(sheets.inner || 0);
  const lamSheets   = Number(sheets.lamination || 0);

  function handleShare() {
    const text = `Добрый день! Хочу заказать упаковку.\nТип коробки: ${boxType}\nРазмер: ${width}×${height}×${depth} мм\nТираж: ${quantity} шт.\nПромокод: ${promo || "—"}`;
    const shareData = { title: "Заказ упаковки — Пчёлкин", text, url: window.location.href };
    if ((navigator as any)?.share) (navigator as any).share(shareData).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + window.location.href)}`, "_blank");
  }

  // отправка менеджеру (устойчиво для HTTPS/CORS); НЕ БЛОКИРУЕТ скачивание
  async function sendManagerEmail(blob: Blob, pricingData: any, meta: any) {
    const isPageHttps = typeof location !== "undefined" && location.protocol === "https:";
    const envApi = (import.meta.env.VITE_API_URL || "").trim();
    let API = envApi || ""; // если пусто — используем относительный путь
    if (isPageHttps && API.startsWith("http://")) {
      // избегаем mixed-content
      API = "";
    }
    const to = import.meta.env.VITE_MANAGER_EMAIL || "public@pchelkinspb.ru";
    const form = new FormData();
    form.append("to", to);
    form.append("subject", "Менеджерское ТЗ — Конструктор упаковки");
    form.append("meta", JSON.stringify(meta));
    form.append("pricing", JSON.stringify(pricingData));
    form.append("file", blob, "TZ_Manager.pdf");
    try {
      const code = (meta?.promo || "").toString().trim().toUpperCase();
      if (code) form.append("access", code);
    } catch {}
    const res = await fetch(`${API}/api/quotes/send`, {
      method: "POST",
      body: form,
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Send email failed: ${res.status} ${text}`);
    }
  }

  // мгновенное скачивание клиентского PDF + фоновая отправка менеджеру с логами
function generatePDF() {
  try {
    const metaCommon = {
      boxType,
      widthMM: Number(width) || 0,
      heightMM: Number(height) || 0,
      depthMM: Number(depth) || 0,
      quantity: Math.max(1, Number(quantity) || 1),
      baseBoard, wrapPaper, print,
      finishing: { blindEmboss: finBlind, foilStamp: finFoil, spotUV: finUV, magnetsPair: finMagnets },
      sideColors, logos,
    };

    const promoClean = (typeof promo === "string" && promo.trim())
      ? promo.trim().toUpperCase()
      : "";

    // 1) СКАЧИВАНИЕ КЛИЕНТСКОГО PDF — СРАЗУ (не ждём)
    // generateClientQuote внутри сам вызовет doc.save(fileName)
    void generateClientQuote(metaCommon);

    // 2) МЕНЕДЖЕРСКИЙ PDF + ОТПРАВКА — В ФОНЕ, НЕ БЛОКИРУЕТ UI
    setTimeout(() => {
      (async () => {
        try {
          console.log("[TZ] manager: generating…");
          const managerBlob = await generateManagerQuote({
            boxType,
            widthMM: Number(width) || 0,
            heightMM: Number(height) || 0,
            depthMM: Number(depth) || 0,
            quantity: Math.max(1, Number(quantity) || 1),
            baseBoard, wrapPaper, print,
            finishing: { blindEmboss: finBlind, foilStamp: finFoil, spotUV: finUV, magnetsPair: finMagnets },
            sideColors, logos,
            pricing,
            promoCode: promoClean || undefined,
          });

          console.log("[TZ] manager: sending…");
          await sendManagerEmail(managerBlob, pricing, {
            boxType,
            width: Number(width) || 0,
            height: Number(height) || 0,
            depth: Number(depth) || 0,
            quantity: Math.max(1, Number(quantity) || 1),
            baseBoard, wrapPaper, print,
            promo: promoClean || undefined,
          });
          console.log("[TZ] manager: sent OK");
        } catch (e) {
          console.error("[TZ] manager: FAILED", e);
        }
      })();
    }, 0);

  } catch (err) {
    console.error("Ошибка генерации/отправки PDF:", err);
  }
}


  const isChecking = status === "checking";
  const isAppDown = typeof navigator !== "undefined" ? !navigator.onLine : false; // оффлайн: шапку прячем

  // нижняя часть скрыта до ввода кода (или ЯПРОМКОД)
  const codeLocalBypass = (promo || "").trim().toUpperCase() === "ЯПРОМКОД";
  const canRevealBottom = status === "ok" || codeLocalBypass;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, marginTop: 10 }}>
      {!isAppDown && <div style={{ fontWeight: 700, marginBottom: 8 }}>Конфигуратор</div>}

      {/* Тираж */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "6px 0", flexWrap: "wrap" }}>
        <label>Тираж</label>
        <input
          type="number" min={1} value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.floor(+e.currentTarget.value || 1)))}
          style={{ width: 100, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }}
        />
      </div>

      {/* Материалы */}
      <div style={{ borderTop: "1px dashed #ddd", paddingTop: 8, marginTop: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Материалы</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "6px 0", flexWrap: "wrap" }}>
          <label>Основа</label>
          <select value={baseBoard} onChange={(e) => setBaseBoard(e.currentTarget.value as any)} style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }}>
            <option value="chip_1_5">Переплётный картон 1.5 мм</option>
            <option value="chip_2_0">Переплётный картон 2.0 мм</option>
          </select>

          <label>Бумага</label>
          <select value={wrapPaper} onChange={(e) => setWrapPaper(e.currentTarget.value)} style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }}>
            <option value="designer_120">Дизайнерская 120 г/м²</option>
            <option value="offset_150">Офсетная 150 г/м²</option>
            <option value="coated_150">Мелованная 150 г/м²</option>
          </select>

          <label>Ламинация</label>
          <select value={lamValue} onChange={(e) => setLamValue(e.currentTarget.value as any)} style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }} disabled={lamDisabled}>
            <option value="none" disabled={lamRequired}>Нет</option>
            <option value="matt">Матовая</option>
            <option value="gloss">Глянец</option>
          </select>
        </div>
      </div>

      {/* Кашировка / клапан */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        <label>
          <input type="checkbox" checked={innerMode === "bottom"} onChange={(e) => setInnerMode(e.currentTarget.checked ? "bottom" : "none")} /> Кашировка внутри дно
        </label>
        <label>
          <input type="checkbox" checked={drawerSleeveInner} onChange={(e) => setDrawerSleeveInner(e.currentTarget.checked)} /> Кашировка футляр внутри
        </label>
        {boxType === "lidBottom" && (
          <label>
            <input type="checkbox" checked={lidLong} onChange={(e) => setLidLong(e.currentTarget.checked)} /> Удлинённый клапан
          </label>
        )}
      </div>

      {/* Печать / отделка */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "6px 0", flexWrap: "wrap" }}>
        <label>Печать</label>
        <select value={print} onChange={(e) => setPrint(e.currentTarget.value as "logosOnly" | "fullWrap")} style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }}>
          <option value="logosOnly">Только логотипы</option>
          <option value="fullWrap">Полноцвет</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "6px 0", flexWrap: "wrap" }}>
        <label>Отделка</label>
        <label><input type="checkbox" checked={finBlind} onChange={(e) => setFinBlind(e.currentTarget.checked)} /> Слепое тиснение (клише)</label>
        <label><input type="checkbox" checked={finFoil} onChange={(e) => setFinFoil(e.currentTarget.checked)} /> Тиснение фольгой (клише)</label>
        <label><input type="checkbox" checked={finUV} onChange={(e) => setFinUV(e.currentTarget.checked)} /> Выборочный УФ</label>
        <label><input type="checkbox" checked={finMagnets} onChange={(e) => setFinMagnets(e.currentTarget.checked)} /> Магниты (пара)</label>
      </div>

      {/* Промокод и доступ */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <input
          placeholder="Промокод"
          value={promo}
          onChange={(e) => setPromo(e.currentTarget.value)}
          style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8, minWidth: 160 }}
        />
        <button
          type="button"
          disabled={!promo.trim() || isChecking}
          onClick={() => checkAccessCode(promo.trim())}
          style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 10, background: "#fff", cursor: isChecking ? "wait" : "pointer", opacity: !promo.trim() || isChecking ? 0.6 : 1 }}
        >
          {isChecking ? "Проверяю…" : "Открыть"}
        </button>
        <button
          type="button"
          disabled={isChecking}
          onClick={() => { setPromo(""); resetAccess(); }}
          style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 10, background: "#fff", cursor: isChecking ? "not-allowed" : "pointer", opacity: isChecking ? 0.6 : 1 }}
        >
          Сброс
        </button>
      </div>

      {/* НИЖНЯЯ ЧАСТЬ: видна только при валидном коде */}
      {canRevealBottom ? (
        <>
          <div style={{ marginTop: 16, padding: "14px 16px 12px", border: "1px solid #E5E5E5", borderRadius: 12, background: "#fff" }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Печать и отделка</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 32, rowGap: 6, fontSize: 15 }}>
              <div>Материалы: <b>{fmtCur(Number((out as any)?.materialCost || 0), currency)}</b></div>
              <div>Ламинация: <b>{fmtCur(Number((out as any)?.laminationCost || 0), currency)}</b></div>
              <div>Печать: <b>{fmtCur(Number((out as any)?.printCost || 0), currency)}</b></div>
              <div>Клише: <b>{fmtCur(Number((out as any)?.clicheCost || 0), currency)}</b></div>
              <div>Отделка: <b>{fmtCur(Number((out as any)?.finishingCost || 0), currency)}</b></div>
              <div>Работы: <b>{fmtCur(Number((out as any)?.workCost || 0), currency)}</b></div>
              <div style={{ gridColumn: "1 / -1" }}>Накладные: <b>{fmtCur(Number((out as any)?.overhead || 0), currency)}</b></div>
            </div>

            <div style={{ marginTop: 8, background: "#fafafa", border: "1px dashed #ddd", borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, marginTop: 8 }}>Расход листов (1000×700 мм)</div>
              <div>Картон: <b>{fmtInt(boardSheets)}</b> лист.</div>
              <div>Оклейка: <b>{fmtInt(wrapSheets)}</b> лист.</div>
              {String(boxType) === "drawer" ? (
                <>
                  <div>Кашировка дно: <b>{fmtInt(Math.max(0, Number((out as any)?.sheetsBreakdown?.trayInnerSheets ?? 0)))}</b> лист.</div>
                  <div>Кашировка футляр: <b>{fmtInt(Math.max(0, Number((out as any)?.sheetsBreakdown?.sleeveInnerSheets ?? 0)))}</b> лист.</div>
                </>
              ) : (
                innerSheets > 0 && <div>Кашировка: <b>{fmtInt(innerSheets)}</b> лист.</div>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 18 }}>
              Итого: <b>{fmtCur(Number((out as any)?.total || 0), currency)}</b>
              <span style={{ opacity: 0.7 }}> &nbsp;(≈ {fmtCur(Number((out as any)?.perUnit || 0), currency)} за шт.)</span>
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 8, lineHeight: 1.35 }}>
              Расчёт ориентировочный. Тарифы/формулы правятся в <code>lib/costing.ts</code>.
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #ddd", opacity: .85 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Панель закрыта</div>
          <div style={{ fontSize: 13, opacity: .8 }}>Введите код и нажмите «Открыть», чтобы показать материали.</div>
        </div>
      )}

      {/* Действия */}
      <div style={{ marginTop: 8, background: "#fafafa", border: "1px dashed #ddd", borderRadius: 8, padding: 8 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={generatePDF}
            disabled={isBusy}
            title={isBusy ? "Идёт формирование…" : "Скачать ТЗ (PDF)"}
            style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 10, background: "#fff", cursor: isBusy ? "wait" : "pointer", opacity: isBusy ? 0.65 : 1 }}
          >
            {isBusy ? "Формирую…" : "Скачать ТЗ (PDF)"}
          </button>
          <button onClick={handleShare} style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 10, background: "#fff", cursor: "pointer" }}>
            Поделиться
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== смета ===== */
function buildPricing(out: any, qty: number) {
  const currency = "₽";
  const materialCost   = Number(out?.materialCost || 0);
  const laminationCost = Number(out?.laminationCost || 0);
  const printCost      = Number(out?.printCost || 0);
  const clicheCost     = Number(out?.clicheCost || 0);
  const finishingCost  = Number(out?.finishingCost || 0);
  const workCost       = Number(out?.workCost || 0);
  const overhead       = Number(out?.overhead || 0);
  const lamPlusPrint = laminationCost + printCost;
  const workPlusFin  = workCost + finishingCost;
  const rows = [
    { label: "Материалы",          amount: materialCost },
    { label: "Ламинация + Печать", amount: lamPlusPrint },
    { label: "Клише",              amount: clicheCost },
    { label: "Работы + Отделка",   amount: workPlusFin },
    { label: "Накладные",          amount: overhead },
  ];
  const q = Math.max(1, Number(qty || 1));
  const total   = Number.isFinite(out?.total)   ? Number(out.total)   : rows.reduce((s, r) => s + r.amount, 0);
  const perUnit = Number.isFinite(out?.perUnit) ? Number(out.perUnit) : total / q;
  return { currency, rows, total, perUnit };
}
