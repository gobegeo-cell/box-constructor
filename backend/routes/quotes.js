// routes/quotes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // парсит multipart/form-data из FormData
const nodemailer = require("nodemailer");

// безопасный JSON-парсер (строка/объект)
function safeJson(x) { try { return typeof x === "string" ? JSON.parse(x) : x; } catch { return x; } }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// POST /api/quotes/send
router.post("/api/quotes/send", upload.single("file"), async (req, res) => {
  try {
    const { to, subject, meta, pricing } = req.body;
    const file = req.file; // Buffer и мета файла из FormData

    if (!file) return res.status(400).json({ ok: false, error: "No file" });

    // Транспорт (Яндекс SMTP 465 secure=true) — берёт из .env бэка
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.yandex.ru",
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // (опц) проверить соединение
    try { await transporter.verify(); } catch (e) { console.warn("[MAIL VERIFY WARN]", e?.message || e); }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Box Constructor" <public@pchelkinspb.ru>',
      to: to || process.env.MANAGER_EMAIL || "public@pchelkinspb.ru",
      subject: subject || "Менеджерское ТЗ",
      html: `
        <p>Во вложении менеджерская версия ТЗ.</p>
        <pre style="font:12px/1.4 monospace">${escapeHtml(JSON.stringify({
          meta: safeJson(meta), pricing: safeJson(pricing)
        }, null, 2))}</pre>
      `,
      attachments: [{
        filename: "TZ_Manager.pdf",
        content: file.buffer,
        contentType: "application/pdf",
      }],
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("[MAIL ERROR]", e);
    res.status(500).json({ ok: false, error: e?.message || "send failed" });
  }
});

module.exports = router;
