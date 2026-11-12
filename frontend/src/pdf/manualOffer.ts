import type jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ManualOffer = {
  price: number;
  priceBasis: "unit" | "total";
  shipment: string;
  signatureDataUrl: string;
};

export const isGeoCode = (code: string) => ["GEO", "ГЕО"].includes(code.trim().toUpperCase());

export function validateOffer(offer: ManualOffer): boolean {
  return Number.isFinite(offer.price) && offer.price > 0 &&
    (offer.priceBasis === "unit" || offer.priceBasis === "total") &&
    offer.shipment.trim().length > 0 && offer.shipment.length <= 180 &&
    /^data:image\/(png|jpeg);base64,/.test(offer.signatureDataUrl);
}

export function offerAmounts(offer: ManualOffer, quantity: number) {
  const qty = Math.max(1, Math.floor(quantity || 1));
  const total = offer.priceBasis === "unit" ? offer.price * qty : offer.price;
  return { total, unit: total / qty };
}

export function drawManualOffer(doc: jsPDF, offer: ManualOffer | undefined, quantity: number, startY: number, margin: number) {
  if (!offer || !validateOffer(offer)) return;
  const money = (n: number) => n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { total, unit } = offerAmounts(offer, quantity);
  autoTable(doc, {
    startY, margin: { left: margin, right: margin },
    head: [["Цена и срок отгрузки"]],
    body: [[
      "Цена за штуку: " + money(unit) + " руб.\nСтоимость тиража: " + money(total) + " руб.\nСрок отгрузки: " + offer.shipment.trim(),
    ]],
    styles: { font: "NotoSans", fontSize: 10, cellPadding: 3, minCellHeight: 22 },
    headStyles: { fillColor: [206, 94, 12], textColor: 255, minCellHeight: 8 },
    rowPageBreak: "avoid",

  });
}

export function drawExecutorSignature(doc: jsPDF, offer: ManualOffer | undefined, x: number, y: number, width: number) {
  if (!offer || !validateOffer(offer)) return false;
  const image = doc.getImageProperties(offer.signatureDataUrl);
  const scale = Math.min(width / image.width, 16 / image.height);
  doc.addImage(offer.signatureDataUrl, image.fileType, x, y, image.width * scale, image.height * scale);
  return true;
}
