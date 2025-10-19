// src/api.tsx
// Единая точка фронтовых вызовов к бэкенду

const API_BASE = "http://localhost:4000"; // фронт стучит на порт бэка

type Json = any;

// --- helper: бросать ошибку, если статус не OK
async function asJson<T = any>(r: Response): Promise<T> {
  if (!r.ok) {
    let text = "";
    try { text = await r.text(); } catch {}
    throw new Error(text || r.statusText || "request_failed");
  }
  return r.json() as any;
}

// ======================= ORDERS =======================

// Отправить ПОЛНОЕ ТЗ на сервер → сервер создаёт JSON + два PDF и возвращает { id }
export async function submitTz({ tz }: { tz: Json }): Promise<{ id: string }> {
  const r = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tz }),
  });
  return asJson(r); // { id }
}

// Алиас для совместимости с BoxWithControls.tsx
export const submitReadyFiles = submitTz;

// ======================= PANEL (client/manager) =======================

// Прочитать панель (без промо = client, с промо = manager)
export async function loadPanel(orderId: string, promo?: string) {
  const url = promo
    ? `${API_BASE}/api/orders/${orderId}/panel?promo=${encodeURIComponent(promo)}`
    : `${API_BASE}/api/orders/${orderId}/panel`;
  const r = await fetch(url);
  return asJson(r); // { id, mode, tz, pdfs }
}

// Назначить ПЕРСОНАЛЬНЫЙ промо-код заказу, затем вернуть уже полную панель
export async function applyPromo(orderId: string, promo: string) {
  const r = await fetch(`${API_BASE}/api/orders/${orderId}/promo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promo }),
  });
  await asJson(r);
  return loadPanel(orderId, promo);
}

// ======================= PDF =======================

export function getPdfUrl(orderId: string, variant: "client" | "manager", promo?: string) {
  if (variant === "client") return `${API_BASE}/api/orders/${orderId}/pdf/client`;
  const qp = promo ? `?promo=${encodeURIComponent(promo)}` : "";
  return `${API_BASE}/api/orders/${orderId}/pdf/manager${qp}`;
}

export function openClientPdf(orderId: string) {
  window.open(getPdfUrl(orderId, "client"), "_blank", "noopener,noreferrer");
}

export function openManagerPdf(orderId: string, promo: string) {
  window.open(getPdfUrl(orderId, "manager", promo), "_blank", "noopener,noreferrer");
}

// ======================= MAIL =======================

// Отправить менеджеру письмо с менеджерским PDF
export async function share(orderId: string) {
  const r = await fetch(`${API_BASE}/api/orders/${orderId}/share`, { method: "POST" });
  await asJson(r);
  return { ok: true };
}

// Алиас
export const shareByEmail = share;
