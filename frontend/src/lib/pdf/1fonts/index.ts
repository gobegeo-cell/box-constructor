import type jsPDF from "jspdf";
import * as F from "../../../pdf/fonts-base64";

export function registerFonts(doc: jsPDF) {
  try {
    const REG =
      (F as any).NOTO_SANS_REGULAR_B64 ??
      (F as any).NOTO_SANS_REGULAR ??
      (F as any).NotoSansRegular ??
      (F as any).NOTO_SANS_REGULAR_BASE64;

    const BOLD =
      (F as any).NOTO_SANS_BOLD_B64 ??
      (F as any).NOTO_SANS_BOLD ??
      (F as any).NotoSansBold ??
      (F as any).NOTO_SANS_BOLD_BASE64;

    if (typeof REG === "string" && REG.length > 0) {
      doc.addFileToVFS("NotoSans-Regular.ttf", REG);
      doc.addFont("NotoSans-Regular.ttf", "noto", "normal");
    }
    if (typeof BOLD === "string" && BOLD.length > 0) {
      doc.addFileToVFS("NotoSans-Bold.ttf", BOLD);
      doc.addFont("NotoSans-Bold.ttf", "noto", "bold");
    }

    // если зарегистрировали хотя бы regular — используем его
    try {
      doc.setFont("noto", "normal");
    } catch {
      doc.setFont("helvetica", "normal");
    }
  } catch {
    try { doc.setFont("helvetica", "normal"); } catch {}
  }
}
