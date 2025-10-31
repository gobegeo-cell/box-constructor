// src/pdf/clientQuote.ts
import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import {
  PDF_BRAND,
  PDF_LAYOUT,
  PDF_SECTIONS,
  PDF_TEXT,
  makeFileName,
  fetchImageAsDataURL,
} from "./config";
import { registerFonts } from "./fonts";

/* ====== Страница и сетка ====== */
const PAGE = { W: 210, H: 297 };
const M = PDF_LAYOUT.margin ?? 14;

const GRID = {
  headLeft:  { x: M, y: 30},
  headRight: { x: PAGE.W - M - 73.55, y: 12, w: 73.55, h: 29.29 },
  barY:8+ 25.25 + 8,

  preview: { x: M, y: 12 + 29.29 + 10, w: 90.75, h: 58 },
  colors:  { x: M, y: 12 + 29.29 + 10 + 58 + 6 },

  rightColX: M + ((PAGE.W - 2 * M - (PDF_LAYOUT.colGap ?? 8)) / 2) + (PDF_LAYOUT.colGap ?? 8),
  paramsY: 10+ 30.30 + 55,

  tableYOffset: 8,
};

/* ====== Helpers ====== */
const normalizeSideKey = (k: string) => (k || "").toLowerCase().trim().replace(/\s+/g, "_");

function sideRu(k: string): string {
  switch (normalizeSideKey(k)) {
    case "top": return "Крышка";
    case "bottom": return "Дно";
    case "front_flap": return "Передний клапан";
    case "front": return "Перед";
    case "back": return "Зад";
    case "left": return "Лево";
    case "right": return "Право";
    default: return k;
  }
}

function mapBoxTypeRu(t: string) {
  switch (t) {
    case "casket": return "Шкатулка";
    case "lidBottom": return "Крышка-дно";
    case "drawer": return "Пенал";
    case "hex": return "Шестигранная";
    case "case":
    case "futlyar": return "Футляр";
    default: return t || "Коробка";
  }
}

function mapLam(v: "none" | "matt" | "gloss") {
  return v === "matt" ? "Матовая" : v === "gloss" ? "Глянцевая" : "Нет";
}

function mapWrap(v: string) {
  switch (v) {
    case "designer_120": return "Дизайнерская 120 г/м²";
    case "offset_150":   return "Офсетная 150 г/м²";
    case "coated_150":   return "Мелованная 150 г/м²";
    case "none":         return "—";
    default:             return v || "—";
  }
}

function mapBase(v: "chip_1_5" | "chip_2_0" | string) {
  return v === "chip_1_5" ? "Переплётный картон 1.5 мм"
       : v === "chip_2_0" ? "Переплётный картон 2.0 мм"
       : String(v || "—");
}

const hexToRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return { r: 232, g: 232, b: 232 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const rgbToCmyk = (r: number, g: number, b: number) => {
  const R = r / 255, G = g / 255, B = b / 255;
  const K = 1 - Math.max(R, G, B);
  if (K >= 0.999) return { c: 0, m: 0, y: 0, k: 100 };
  const C = (1 - R - K) / (1 - K);
  const M = (1 - G - K) / (1 - K);
  const Y = (1 - B - K) / (1 - K);
  return { c: Math.round(C * 100), m: Math.round(M * 100), y: Math.round(Y * 100), k: Math.round(K * 100) };
};

function getFaceMM(side: string, dims: { W: number; H: number; D: number }) {
  const s = normalizeSideKey(side);
  switch (s) {
    case "front":
    case "back":
    case "front_flap": return { w: dims.W, h: dims.H };
    case "left":
    case "right":      return { w: dims.D, h: dims.H };
    case "top":
    case "bottom":     return { w: dims.W, h: dims.D };
    default:           return { w: dims.W, h: dims.H };
  }
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
  const w = parseFloat(m[1]); const h = parseFloat(m[2]);
  return (w > 0 && h > 0) ? { w, h } : null;
}

function pickMM(it: any): { w: number; h: number } | null {
  if (!it || typeof it !== "object") return null;

  if (it.size_mm && typeof it.size_mm === "object") {
    const w = numSmart(it.size_mm.w);
    const h = numSmart(it.size_mm.h);
    if (w && h && w > 0 && h > 0) return { w, h };
  }

  const wKeys = ["wMM", "widthMM", "w_mm", "mmW", "width", "w", "sizeW", "realWMM", "realWidthMM", "constructorWMM", "constructorWidthMM", "realW", "constructorW", "W"];
  const hKeys = ["hMM", "heightMM", "h_mm", "mmH", "height", "h", "sizeH", "realHMM", "realHeightMM", "constructorHMM", "constructorHeightMM", "realH", "constructorH", "H"];
  for (const wk of wKeys) for (const hk of hKeys) {
    const w = numSmart((it as any)[wk]); const h = numSmart((it as any)[hk]);
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
      const hasScale    = !!(it.scale || it.scaleX || it.scaleY || it.sx || it.sy || it.scale?.x || it.scale?.z);
      const hasContent  = typeof it.content === "string" || typeof it.src === "string" || (typeof File !== "undefined" && it.file instanceof File);
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
    return (w > 0 && h > 0) ? { w, h } : null;
  }

  const s  = numSmart((it as any).scale);
  if (s && s > 0) {
    const k = s > 2 ? s / 100 : s;
    return { w: k * face.w, h: k * face.h };
  }

  const sx = numSmart((it as any).scale?.x ?? (it as any).sx ?? (it as any).scaleX);
  const sz = numSmart((it as any).scale?.z ?? (it as any).sy ?? (it as any).scaleY);
  const k  = (sx && sz) ? Math.min(sx, sz) : (sx || sz || null);
  if (k && k > 0) {
    const kk = k > 2 ? k / 100 : k;
    return { w: kk * face.w, h: kk * face.h };
  }

  return null;
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

function extractLogosMeta(
  logos: any,
  dims: { W: number; H: number; D: number },
  boxType?: string
): { side: string; wMM: number; hMM: number }[] {
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

/* === DPR-корректный снимок Canvas (встроенный хелпер) === */
async function getCanvasSnapshot() {
  const c = (window as any).__boxCanvas as HTMLCanvasElement | undefined
    || (document.querySelector("#box-canvas canvas") as HTMLCanvasElement | null)
    || (document.querySelector("canvas") as HTMLCanvasElement | null);

  if (!c || !c.width || !c.height) return null;

  // дождёмся 2 кадров, чтобы рендер точно завершился
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const dataUrl: string = await new Promise((resolve) => {
    if (c.toBlob) {
      c.toBlob((blob) => {
        if (!blob) return resolve(c.toDataURL("image/png", 1));
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result as string);
        fr.readAsDataURL(blob);
      }, "image/png", 0.95);
    } else {
      resolve(c.toDataURL("image/png", 1));
    }
  });

  return { dataUrl, w: c.width, h: c.height };
}

/* ====== Типы аргументов ====== */
type Finishing = { blindEmboss?: boolean; foilStamp?: boolean; spotUV?: boolean; magnetsPair?: boolean; };
type Args = {
  boxType: string;
  widthMM: number; heightMM: number; depthMM: number;
  quantity: number;

  baseBoard: "chip_1_5" | "chip_2_0" | string;
  wrapPaper: string;
  print: "logosOnly" | "fullWrap";
  finishing?: Finishing;

  // опционально для клиентского PDF:
  sideColors?: string[];   // [ ... , lid=4, bottom=5 ]
  logos?: any;             // объект логотипов как в конструкторе
};

export default async function generateClientQuote(args: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // === ШРИФТЫ: включаем те же NotoSans, что в старом проекте ===
  await registerFonts(doc);
  const setNormal = () => doc.setFont("NotoSans", "normal");
  const setBold   = () => doc.setFont("NotoSans", "bold");
  setNormal();

  // Мета
  doc.setProperties({
    title: `${PDF_TEXT.title} — ${PDF_BRAND.name}`,
    subject: "Клиентское ТЗ",
    author: PDF_BRAND.name,
  });

  // Цвет бренда
  const brandHex = PDF_BRAND.color || "#ce5e0c";
  const n = parseInt(brandHex.slice(1), 16);
  const brandRGB: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];

  /* ====== HEADER ====== */
  setBold();   doc.setFontSize(PDF_TEXT.titleSize ?? 13); doc.setTextColor(0,0,0);
  doc.text(PDF_TEXT.title, GRID.headLeft.x, GRID.headLeft.y);
  setNormal(); doc.setFontSize(PDF_TEXT.subtitleSize ?? 9.5); doc.setTextColor(100);
  doc.text(PDF_TEXT.subtitle, GRID.headLeft.x, GRID.headLeft.y + 5.5);

  // Логотип
  const logoData = await fetchImageAsDataURL(PDF_BRAND.logoUrl);
  if (logoData) {
    doc.addImage(
      logoData,
      "PNG",
      GRID.headRight.x,
      GRID.headRight.y,
      PDF_LAYOUT.logoW ?? 80,
      PDF_LAYOUT.logoH ?? 32,
      undefined,
      "FAST"
    );
  }

  // QR (опц.)
  if (PDF_SECTIONS.qr) {
    try {
      const qrUrl = /^https?:\/\//i.test(PDF_BRAND.site) ? PDF_BRAND.site : `https://${PDF_BRAND.site}`;
      const { default: QRCode } = await import("qrcode");
      const qrData = await QRCode.toDataURL(qrUrl, { margin: 0, width: 256 });
      doc.addImage(qrData, "PNG", GRID.headRight.x + (PDF_LAYOUT.logoW ?? 100) - 30, GRID.headRight.y + (PDF_LAYOUT.logoH ?? 32) + 2, 22, 22);
    } catch {}
  }

  // линия
  doc.setDrawColor(...brandRGB); doc.setLineWidth(0.5);
  doc.line(M, GRID.barY, PAGE.W - M, GRID.barY);

  /* ====== PREVIEW (Canvas) — БЕЗ ИСКАЖЕНИЙ ====== */
  if (PDF_SECTIONS.previewFromCanvas) {
    // (опционально) можно временно выключить окружение в сцене, если ты добавил это в BoxWithControls
    // (window as any).__screenshotMode = true;

    const snap = await getCanvasSnapshot();

    // (window as any).__screenshotMode = false;

    if (snap) {
      // Вписываем в рамку с сохранением пропорций и центрированием
      const frameX = GRID.preview.x;
      const frameY = GRID.preview.y;
      const frameW = GRID.preview.w;
      const frameH = GRID.preview.h;

      const ratio = snap.h / snap.w;            // исходные пропорции
      const fitW = frameW;
      const fitH = fitW * ratio;
      const tooTall = fitH > frameH;

      const imgW = tooTall ? frameH / ratio : fitW;
      const imgH = tooTall ? frameH : fitH;

      const x = frameX + (frameW - imgW) / 2;
      const y = frameY + (frameH - imgH) / 2;

      doc.addImage(snap.dataUrl, "PNG", x, y, imgW, imgH, undefined, "FAST");

      
    }
  }

  /* ====== ПАРАМЕТРЫ ЗАКАЗА ====== */
  const rightX = GRID.rightColX;
  let ry = GRID.paramsY;
  setBold(); doc.setFontSize(11); doc.setTextColor(0);
  doc.text("Параметры заказа", rightX, ry); ry += 5;
  setNormal(); doc.setFontSize(10);

  const lamText =
    args.wrapPaper === "designer_120"
      ? "Ламинация: нет"
      : `Ламинация: ${mapLam("matt")}`; // при необходимости подставь фактическую

  const headerLines: string[] = [];
  headerLines.push(`Тип: ${mapBoxTypeRu(args.boxType)}`);
  headerLines.push(`Габариты (мм): W ${args.widthMM} × H ${args.heightMM} × D ${args.depthMM}`);
  headerLines.push(`Тираж: ${Math.max(1, Math.floor(args.quantity))} шт.`);
  headerLines.push(`Основа: ${mapBase(args.baseBoard)}`);
  headerLines.push(`Оклейка: ${mapWrap(args.wrapPaper)} (${lamText})`);
  const innerWrap = (args.boxType === "lidBottom" || args.boxType === "casket") ? args.wrapPaper : "none";
  headerLines.push(`Футеровка: ${mapWrap(innerWrap)}`);
  headerLines.push(`Печать: ${args.print === "fullWrap" ? "Полноцвет (вся площадь)" : "Только логотипы"}`);

  const wrapToCol = (txt: string) => doc.splitTextToSize(txt, (PAGE.W - 2*M - (PDF_LAYOUT.colGap ?? 8))/2);
  for (const L of headerLines) {
    const wrapped = wrapToCol(L);
    doc.text(wrapped, rightX, ry);
    ry += 5 + (wrapped.length - 1) * 4.2;
  }

  /* ====== ЦВЕТА (CMYK) ====== */
  if (PDF_SECTIONS.colors) {
    let y = GRID.colors.y;
    setBold(); doc.setFontSize(11); doc.setTextColor(0);
    doc.text("Цвет коробки", M, y); y += 5; // исправил опечатку
    setNormal(); doc.setFontSize(10);

    const labels = ["Крышка", "Дно"];
    const indices = [4, 5];
    const colorsArr: string[] = Array.isArray(args.sideColors) ? args.sideColors : [];
    const rowH = 8.5;

    for (let idx = 0; idx < indices.length; idx++) {
      const i = indices[idx];
      const hex = (colorsArr?.[i] || "#E8E8E8").toUpperCase();
      const { r, g, b } = hexToRgb(hex);
      const cmyk = rgbToCmyk(r, g, b);

      doc.setDrawColor(180);
      doc.setFillColor(r, g, b);
      doc.rect(M, y - 4.5, 10, 6, "FD");
      doc.text(`${labels[idx]}: ${hex} (C${cmyk.c} M${cmyk.m} Y${cmyk.y} K${cmyk.k})`, M + 14, y);
      y += rowH;
    }
  }

  /* ====== КЛИШЕ (без цен) ====== */
  if (PDF_SECTIONS.clicheTable) {
    const dims = { W: Number(args.widthMM) || 0, H: Number(args.heightMM) || 0, D: Number(args.depthMM) || 0 };
    const logosMeta = extractLogosMeta(args.logos || {}, dims, args.boxType);

    if (logosMeta.length > 0) {
      const afterColorsY = (doc as any).lastAutoTable?.finalY ?? (GRID.colors.y + 22);
      const startY = Math.max(afterColorsY, GRID.colors.y + 22) + GRID.tableYOffset;

      const body: RowInput[] = logosMeta.map((r, idx) => ([
        String(idx + 1),
        sideRu(r.side),
        `${r.wMM} × ${r.hMM}`,
        ((r.wMM * r.hMM) / 100).toFixed(1),  // площадь см²
        "—", // сюда можно подставлять процессы, если есть
      ]));

      autoTable(doc, {
        startY,
        head: [["№", "Сторона", "Размер (мм)", "Площадь (см²)", "Процессы"]],
        body,
        styles:     { font: "NotoSans", fontSize: 9.5, cellPadding: 2 },
        headStyles: {
          font: "NotoSans", fontStyle: "bold",
          fillColor: (PDF_LAYOUT.tableAccentFromBrand ? brandRGB : [206, 94, 12]) as any,
          textColor: 255, halign: "left",
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "right" as const },
          1: { cellWidth: 34 },
          2: { cellWidth: 34 },
          3: { cellWidth: 28, halign: "right" as const },
          4: { cellWidth: 24, halign: "left" as const },
        },
        margin: { left: M, right: M },
      });
    }
  }

  /* ====== СОГЛАСОВАНИЕ ====== */
  {
    const y = ((doc as any).lastAutoTable?.finalY ?? (GRID.colors.y + 22)) + 12;
    setBold(); doc.setFontSize(11); doc.setTextColor(0);
    doc.text("Согласование", M, y);

    const boxTop = y + 1.5;
    const boxH = 24;
    const pageW = doc.internal.pageSize.getWidth();
    doc.setDrawColor(200); doc.rect(M, boxTop, pageW - 2*M, boxH);

    setNormal(); doc.setFontSize(10);
    doc.text("Заказчик: ____________________", M + 4,  boxTop + 7);
    doc.text("Исполнитель: ________________", M + 110, boxTop + 7);
    doc.text("Дата: _________", M + 4,  boxTop + 15);
    doc.text("Подпись: ______", M + 60, boxTop + 15);
  }

  /* ====== ФУТЕР ====== */
  if (PDF_SECTIONS.footer) {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(9); doc.setTextColor(120);
    try {
      const siteUrl = /^https?:\/\//i.test(PDF_BRAND.site) ? PDF_BRAND.site : `https://${PDF_BRAND.site}`;
      doc.textWithLink(PDF_BRAND.site,  M,       pageH - 8, { url: siteUrl });
      doc.textWithLink(PDF_BRAND.email, M + 42,  pageH - 8, { url: `mailto:${PDF_BRAND.email}` });
      doc.textWithLink(PDF_BRAND.phone, M + 140, pageH - 8, { url: `tel:${PDF_BRAND.phone.replace(/\s|\(|\)|-/g, "")}` });
    } catch {
      doc.text(`${PDF_BRAND.site} • ${PDF_BRAND.email} • ${PDF_BRAND.phone}`, M, pageH - 8);
    }
  }

     /* ====== Сохранение с красивым именем ====== */
  const fileName = makeFileName({
    typeRu: mapBoxTypeRu(args.boxType),
    w: Math.round(args.widthMM || 0),
    h: Math.round(args.heightMM || 0),
    d: Math.round(args.depthMM || 0),
    qty: Math.max(1, Math.floor(args.quantity || 1)),
  });

  // Новое поведение: если второй аргумент { returnBlob: true } — отдаём Blob, иначе сохраняем как раньше
  // Подпись функции: export default async function generateClientQuote(args: Args, opts?: { returnBlob?: boolean })
  const anyArgs = arguments as unknown as [Args, { returnBlob?: boolean }?];
  const opts = (anyArgs && anyArgs[1]) || { returnBlob: false };

  if (opts && opts.returnBlob) {
    const blob = doc.output("blob") as Blob;
    return { blob, fileName };
  } else {
    doc.save(fileName);
    return;
  }
}
