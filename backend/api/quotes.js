// backend/api/quotes.js
import express from "express";
import multer from "multer";
import { sendManagerOrderMail, verifyTransporter } from "../mailer.js";
import { isAccessValid } from "../utils/access.js";

export const router = express.Router();

// === Настройки загрузки: размер до 25 МБ, только один файл ===
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

// безопасный JSON-парсер
function safeJson(x) { try { return typeof x === "string" ? JSON.parse(x) : x; } catch { return x; } }

// простая HTML-табличка сводки
function summaryHtml(meta, pricing, accessCode) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rows = [
    ["Тип", esc(meta?.boxType || "—")],
    ["Размеры (мм)", `W ${esc(meta?.width || meta?.widthMM || "—")} × H ${esc(meta?.height || meta?.heightMM || "—")} × D ${esc(meta?.depth || meta?.depthMM || "—")}`],
    ["Тираж", esc(meta?.quantity || meta?.qty || "—")],
    ["Основа", esc(meta?.baseBoard || "—")],
    ["Оклейка", esc(meta?.wrapPaper || "—")],
    ["Печать", esc(meta?.print || "—")],
    ["Код доступа", esc(accessCode || "—")],
  ];
  const money = (v) => `${Number(v || 0).toLocaleString("ru-RU")} ${pricing?.currency || "₽"}`;
  const total = pricing?.total != null ? money(pricing.total) : "—";
  const per = pricing?.perUnit != null ? money(pricing.perUnit) : "—";
  return `
    <table style="font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;border-collapse:collapse">
      ${rows.map(([k,v]) => `<tr><td style="padding:4px 8px;color:#666">${k}</td><td style="padding:4px 8px">${v}</td></tr>`).join("")}
      <tr><td style="padding:4px 8px;color:#666">Итого</td><td style="padding:4px 8px"><b>${total}</b></td></tr>
      <tr><td style="padding:4px 8px;color:#666">Цена за шт.</td><td style="padding:4px 8px"><b>${per}</b></td></tr>
    </table>
  `;
}

// POST /api/quotes/send
router.post("/quotes/send", upload.single("file"), async (req, res) => {
  try {
    const to = req.body?.to;
    const subject = req.body?.subject || "Менеджерское ТЗ";
    const meta = safeJson(req.body?.meta);
    const pricing = safeJson(req.body?.pricing);
    const accessCode = String(req.body?.accessCode || req.body?.promo || "").trim().toUpperCase();
    const file = req.file;

    if (!file) return res.status(400).json({ ok: false, error: "No file" });

    // лёгкая проверка типа
    const okType = (file.mimetype || "").includes("pdf") || file.originalname?.toLowerCase().endsWith(".pdf");
    if (!okType) return res.status(400).json({ ok: false, error: "Only PDF allowed" });

    // обязательная проверка кода доступа, если ACCESS_CODES указан
    const mustCheck = String(process.env.ACCESS_CODES || "").trim().length > 0;
    if (mustCheck && !isAccessValid(accessCode)) {
      console.warn("[ACCESS] invalid code:", accessCode);
      return res.status(403).json({ ok: false, error: "Access code required or invalid" });
    }

    // (опц) проверка SMTP
    if (typeof verifyTransporter === "function") {
      try { await verifyTransporter(); } catch (e) { console.warn("[MAIL VERIFY WARN]", e?.message || e); }
    }

    // тема по умолчанию, если фронт не прислал
    const now = new Date().toLocaleString("ru-RU");
    const fallbackSubject =
      `ТЗ (менеджер) — ${meta?.boxType || "коробка"} — ${meta?.quantity || meta?.qty || ""} шт — ${now}`;

    const mail = await sendManagerOrderMail({
      to,
      subject: subject || fallbackSubject,
      text: `Во вложении менеджерская версия ТЗ.\nКод доступа: ${accessCode || "—"}`,
      html:
        `<p>Во вложении менеджерская версия ТЗ.</p>` +
        summaryHtml(meta, pricing, accessCode) +
        `<pre style="font:12px/1.4 monospace;background:#fafafa;padding:8px;border-radius:8px;border:1px solid #eee;margin-top:8px">${escapeJson(
          { meta, pricing, accessCode }
        )}</pre>`,
      attachments: [{
        filename: file.originalname || "TZ_Manager.pdf",
        content: file.buffer,
        contentType: file.mimetype || "application/pdf",
      }],
    });

    const ok = !!(mail && (mail.ok || mail.skipped || mail.messageId || (Array.isArray(mail.accepted) && mail.accepted.length)));
    if (ok) return res.json({ ok: true });

    return res.status(500).json({ ok: false, error: mail?.error || "send failed" });
  } catch (e) {
    console.error("[MAIL ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "send failed" });
  }
});

function escapeJson(obj) {
  const s = JSON.stringify(obj, null, 2);
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export default router;
