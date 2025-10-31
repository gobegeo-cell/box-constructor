export const PDF_BRAND = {
  name: "Пчёлкин",
  color: "#ce5e0c",
  logoUrl: "/brand/pchelkin.png",
  email: "public@pchelkinspb.ru",
  phone: "+7 967 550 19 81",
  site: "pchelkinspb.ru",
};

export const PDF_LAYOUT = {
  margin: 10,
  page: { size: "A4", orientation: "portrait" as const },
  marginsMM: { top: 10, right: 10, bottom: 10, left: 10 },
  header: { keepHeaderAsIs: true, logoW: 60, logoH: 24, useBrandColorInHeader: false },
  brandStripe: { enabled: true, position: "left" as const, widthMM: 6, color: "#ce5e0c" },
  columns: {
    cols: 2,
    gapMM: 10,
    left: { type: "preview" as const, fit: "width" as const, requireImage: true, minDpi: 120 },
    right: {
      sectionsOrder: ["description", "colors"] as const,
      description: { heading: "Описание коробки", headingSizePt: 11, textSizePt: 9, lineGapMM: 3, fields: ["type", "dimensions", "quantity", "materials", "print", "finishing"] },
      colors: { heading: "Цвета", headingSizePt: 10, swatchSizeMM: 16, labelSizePt: 9, gapMM: 4, items: [{ key: "lid", label: "Крышка" }, { key: "bottom", label: "Дно" }], showHex: true, showCMYK: false }
    }
  },
  tables: { logosCliche: { enabled: false }, sheets: { enabled: false } },
  accentBar: { enabled: false },
  footer: { enabled: true, textSizePt: 8.5, textColor: "#666666", lineGapMM: 2, rightAligned: true },
  tableAccentFromBrand: true
};

export const PDF_SECTIONS = {
  previewFromCanvas: true,
  description: true,
  colors: true,
  sheets: false,
  logosCount: false,
  note: false,
  footer: true
};

export const PDF_TEXT = {
  title: "Техническое задание",
  subtitle: "Конструктор упаковки — Пчёлкин",
  note: "Примечание: расчёт ориентировочный. Финальная цена уточняется после утверждения ТЗ и материалов.",
  titleSize: 13,
  subtitleSize: 9.5
};

export const PRICE_OPTS = { showVAT: false, vatRate: 20, showDiscountRow: true };

export const fetchImageAsDataURL = async (_url: string) => null;

export const makeFileName = (p: { typeRu: string; w: number; h: number; d: number; qty: number }) => {
  const safe = (s: string) => s.replace(/[^a-z0-9а-яё _-]+/gi, "").trim();
  let name = `${safe(p.typeRu)}_${p.w}x${p.h}x${p.d}_${p.qty}`;
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  return name || "quote.pdf";
};
