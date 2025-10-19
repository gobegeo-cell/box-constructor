// src/pdf/config.ts

/** =============== Бренд и контакты =============== */
export const PDF_BRAND = {
  name: "Пчёлкин",
  color: "#ce5e0c",
  logoUrl: "/brand/pchelkin.png",
  email: "public@pchelkinspb.ru",
  phone: "+7 967 550 19 81",
  site: "pchelkinspb.ru",
};

/** =============== Макет страницы и сетка =============== 
 * Примечание: новые поля добавлены так, чтобы не ломать старый рендерер.
 * Если у тебя есть собственные функции рендера, ориентируйся на новые поля.
 */
export const PDF_LAYOUT = {
  /** ЛЕГАСИ-поле (если где-то используется): */
  margin: 10, // для совместимости

  /** Новые точные поля (мм) */
  page: { size: "A4", orientation: "portrait" as const },
  marginsMM: { top: 10, right: 10, bottom: 10, left: 10 },

  /** Шапка «как на фото»: НЕ меняем расположение логотипа/QR */
  header: {
    keepHeaderAsIs: true, // важный флаг: рендерер не трогает текущий макет шапки
    // если старый рендер опирается на размеры логотипа — оставляем как было
    logoW: 60,
    logoH: 24,
    useBrandColorInHeader: false,
  },

  /** Вертикальная ОРАНЖЕВАЯ полоса слева (внутри полей) */
  brandStripe: {
    enabled: true,
    position: "left" as const,
    widthMM: 6,
    color: "#ce5e0c",
  },

  /** Главная зона: 2 колонки */
  columns: {
    cols: 2,
    gapMM: 10, // межколоночный отступ
    /** Левая колонка — ПРЕВЬЮ (скрин из Canvas/изображение), всегда есть */
    left: {
      type: "preview" as const,
      fit: "width" as const,     // вписываем по ширине колонки, высота по пропорции
      requireImage: true,        // изображение обязательно (без плейсхолдера)
      minDpi: 120,               // контроль печатного качества
    },
    /** Правая колонка — сверху «Описание», под ним — «Цвета» */
    right: {
      sectionsOrder: ["description", "colors"] as const,
      description: {
        heading: "Описание коробки",
        headingSizePt: 11,
        textSizePt: 9,
        lineGapMM: 3,
        // какие поля выводить и в каком порядке
        fields: ["type", "dimensions", "quantity", "materials", "print", "finishing"],
      },
      colors: {
        heading: "Цвета",
        headingSizePt: 10,
        swatchSizeMM: 16,        // квадраты 16×16 мм
        labelSizePt: 9,
        gapMM: 4,                // вертикальный отступ между строками цветов
        // фиксированный набор «как есть»: Крышка / Дно
        items: [
          { key: "lid", label: "Крышка" },
          { key: "bottom", label: "Дно" },
        ],
        // как отображать значение: HEX / CMYK / оба — решает рендерер
        showHex: true,
        showCMYK: false,
      },
    },
  },

  /** Таблицы логотипов/клише и прочие вещи — по умолчанию скрыты для этого макета */
  tables: {
    logosCliche: { enabled: false },
    sheets: { enabled: false },
  },

  /** Акцентная полоса ПЕРЕД блоком согласований на фото отсутствует — не выводим */
  accentBar: { enabled: false },

  /** Футер — контакты как есть (если у тебя уже реализован) */
  footer: {
    enabled: true,
    textSizePt: 8.5,
    textColor: "#666666",
    lineGapMM: 2,
    rightAligned: true,
  },

  /** Поддержка заливки таблиц/акцентов цветом бренда (если где-то нужно) */
  tableAccentFromBrand: true,
};

/** =============== Видимость секций =============== */
export const PDF_SECTIONS = {
  // Левый скрин
  previewFromCanvas: true,
  // Правая колонка — описание + цвета
  description: true,
  colors: true,

  // Скрываем лишнее (под этот макет)
  sheets: false,
  logosCount: false,
  note: false,   // «Примечание…» на фото не выводим
  footer: true,
};

/** =============== Тексты =============== */
export const PDF_TEXT = {
  title: "Техническое задание",
  subtitle: "Конструктор упаковки — Пчёлкин",
  // если понадобится включить примечание — поменяешь PDF_SECTIONS.note на true
  note: "Примечание: расчёт ориентировочный. Финальная цена уточняется после утверждения ТЗ и материалов.",
  titleSize: 13,
  subtitleSize: 9.5,
};

/** =============== Отображение цены (если используешь) =============== */
export const PRICE_OPTS = {
  showVAT: false,
  vatRate: 20,
  showDiscountRow: true,
};

/** =============== Имя файла (оставлено как у тебя) =============== */
export function makeFileName(d: { typeRu: string; w: number; h: number; d: number; qty: number }) {
  const safeType = String(d.typeRu || "box").replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  const w = Math.round(Number(d.w) || 0);
  const h = Math.round(Number(d.h) || 0);
  const depth = Math.round(Number(d.d) || 0);
  const qty = Math.round(Number(d.qty) || 0);
  const when = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-"); // уникальность (UTC)
  return `TZ_${safeType}_${w}x${h}x${depth}_${qty}_${when}.pdf`;
}

/** =============== Загрузка изображения (скрин всегда есть) =============== */
export async function fetchImageAsDataURL(url: string, timeoutMs = 7000): Promise<string | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });

    clearTimeout(id);
    if (!res.ok) return null;

    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("fetchImageAsDataURL failed", err);
    return null;
  }
}
