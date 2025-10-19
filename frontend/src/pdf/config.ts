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

/** =============== Макет страницы и таблиц =============== */
export const PDF_LAYOUT = {
  margin: 14,
  logoW: 80,
  logoH: 32,
  tableAccentFromBrand: true,
  colGap: 8,
};

/** =============== Секции (включатели блоков) =============== */
export const PDF_SECTIONS = {
  previewFromCanvas: true,
  colors: true,
  clicheTable: true, // в клиентском PDF — без столбца "Стоимость"
  note: false,
  footer: true,
  qr: true,          // опц. QR со ссылкой на сайт
};

/** =============== Тексты =============== */
export const PDF_TEXT = {
  title: "Техническое задание",
  subtitle: "Конструктор упаковки — Пчёлкин",
  note: "Примечание:  цена уточняется после утверждения ТЗ и материалов.",
  titleSize: 13,
  subtitleSize: 9.5,
};

/** =============== Имя файла =============== */
export function makeFileName(d: { typeRu: string; w: number; h: number; d: number; qty: number }) {
  return `TZ_${d.typeRu}_${d.w}x${d.h}x${d.d}_${d.qty}.pdf`;
}

/** =============== Подгрузка изображений =============== */
export async function fetchImageAsDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
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
