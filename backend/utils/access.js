// backend/utils/access.js
export function isAccessValid(code) {
  const raw = String(process.env.ACCESS_CODES || "");
  const list = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const q = String(code || "").trim().toUpperCase();
  return !!q && list.includes(q);
}
