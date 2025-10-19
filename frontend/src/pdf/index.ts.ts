import type jsPDF from "jspdf";
import { NOTO_SANS_REGULAR_B64, NOTO_SANS_BOLD_B64 } from "../../../pdf/fonts-base64";

export function registerFonts(doc: jsPDF) {
  try {
    if (NOTO_SANS_REGULAR_B64) {
      doc.addFileToVFS("NotoSans-Regular.ttf", NOTO_SANS_REGULAR_B64);
      doc.addFont("NotoSans-Regular.ttf", "noto", "normal");
    }
    if (NOTO_SANS_BOLD_B64) {
      doc.addFileToVFS("NotoSans-Bold.ttf", NOTO_SANS_BOLD_B64);
      doc.addFont("NotoSans-Bold.ttf", "noto", "bold");
    }
    doc.setFont("noto", "normal");
  } catch {
    try { doc.setFont("helvetica", "normal"); } catch {}
  }
}
