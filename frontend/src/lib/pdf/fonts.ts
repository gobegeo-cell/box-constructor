// src/pdf/fonts.ts
// Регистрирует NotoSans (Regular/Bold) в jsPDF из base64 для КАЖДОГО экземпляра doc.

import { NotoSansRegular, NotoSansBold } from "./fonts-base64";

// отмечаем именно экземпляры jsPDF, для которых уже выполнена регистрация
const registeredDocs = new WeakSet<object>();

/** Чистим base64: отрезаем data:*;base64, и убираем все пробельные символы */
function cleanup(b64: string): string {
  if (!b64) return "";
  const i = b64.indexOf(";base64,");
  const raw = i !== -1 ? b64.slice(i + ";base64,".length) : b64;
  return raw.replace(/\s+/g, "");
}

/**
 * Регистрирует семейство "NotoSans" (normal/bold) в ПЕРЕДАННОМ doc.
 * Возвращает true, если всё ок или уже зарегистрировано для этого doc.
 */
export async function registerFonts(doc: any): Promise<boolean> {
  if (!doc || typeof doc.addFileToVFS !== "function" || typeof doc.addFont !== "function") {
    console.warn("[fonts] registerFonts: некорректный doc");
    return false;
  }

  // если уже делали для этого doc — выходим
  if (registeredDocs.has(doc)) return true;

  try {
    const reg64 = cleanup(NotoSansRegular);
    const bld64 = cleanup(NotoSansBold);
    if (!reg64 || !bld64) {
      console.warn("[fonts] пустые base64 (Regular/Bold)");
      return false;
    }

    // регистрация в VFS КОНКРЕТНОГО doc
    doc.addFileToVFS("NotoSans-Regular.ttf", reg64);
    doc.addFileToVFS("NotoSans-Bold.ttf",    bld64);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans-Bold.ttf",    "NotoSans", "bold");

    registeredDocs.add(doc);
    return true;
  } catch (e) {
    console.error("[fonts] registerFonts failed:", e);
    return false;
  }
}
