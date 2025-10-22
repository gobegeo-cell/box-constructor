// backend/server.js
import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { sendManagerOrderMail } from "./mailer.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(fileUpload());

// ====== ACCESS: проверка промокода ======
app.get("/api/access/check", (req, res) => {
  try {
    const code = String(req.query.code || "").trim().toUpperCase();
    const validCodes = (process.env.ACCESS_CODES || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const canSeePrices = !!code && validCodes.includes(code);
    res.json({ ok: true, canSeePrices });
  } catch (err) {
    console.error("[ACCESS] check error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});
console.log("[ACCESS] router mounted at /api/access");

// ====== POSTBOX: отправка писем менеджеру ======
app.post("/api/quotes/send", async (req, res) => {
  const tmpFiles = [];
  try {
    const f = req.files?.file;
    if (!f?.data || !f?.size) {
      return res.status(400).json({ ok: false, error: "No file attached" });
    }

    const access = String(
      req.body?.accessCode || req.body?.promo || req.body?.access || ""
    )
      .trim()
      .toUpperCase();
    const accessInfo = access
      ? `Код доступа: ${access}`
      : "Код доступа: — (не указан)";

    const to = String(req.body?.to || process.env.MANAGER_EMAIL || "").trim();
    if (!to) return res.status(400).json({ ok: false, error: "No recipient" });

    const subject = String(req.body?.subject || "ТЗ (менеджер)").slice(0, 200);
    const replyTo =
      String(req.body?.replyTo || req.body?.email || "").trim() || undefined;

    const safeName = (f.name || `TZ_Manager_${Date.now()}.pdf`).replace(
      /[^\w.\-]+/g,
      "_"
    );
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}_${safeName}`);
    await fs.writeFile(tmpPath, f.data);
    tmpFiles.push(tmpPath);

    const text =
      `Автоматическая отправка ТЗ\n` +
      `${accessInfo}\n` +
      (replyTo ? `Ответить на: ${replyTo}\n` : "");

    const result = await sendManagerOrderMail({
      to,
      subject,
      text,
      replyTo,
      attachments: [{ filename: safeName, path: tmpPath }],
    });

    if (!result?.ok) {
      console.error("[MAIL] send error:", result?.error);
      return res
        .status(500)
        .json({ ok: false, error: result?.error || "Mail send failed" });
    }

    console.log("[MAIL] Postbox sent:", result.id || "(no id)");
    res.json({ ok: true, id: result.id });
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("[MAIL] error:", msg);
    res.status(500).json({ ok: false, error: msg });
  } finally {
    for (const p of tmpFiles) {
      try {
        await fs.unlink(p);
      } catch {}
    }
  }
});

// ====== ENV DEBUG ======
app.get("/api/mail/env", (req, res) => {
  res.json({
    POSTBOX_KEY: process.env.YANDEX_POSTBOX_API_KEY ? "present" : "missing",
    CONFIGURED: !!(process.env.YANDEX_FROM && process.env.MANAGER_EMAIL),
  });
});

// ====== VERIFY ======
app.get("/api/mail/verify", async (req, res) => {
  const ok =
    !!process.env.YANDEX_POSTBOX_API_KEY &&
    !!process.env.YANDEX_FROM &&
    !!process.env.MANAGER_EMAIL;
  if (ok) res.json({ ok: true, message: "Postbox ready (env present)" });
  else
    res.status(400).json({
      ok: false,
      error: "Missing YANDEX_POSTBOX_API_KEY / YANDEX_FROM / MANAGER_EMAIL",
    });
});

// ====== NET DEBUG ======
app.get("/api/net/ping-postbox", async (_req, res) => {
  try {
    const r = await fetch(
      "https://postbox.api.cloud.yandex.net/v2/email/outbound-emails",
      { method: "HEAD" }
    );
    res.json({ ok: r.ok, status: r.status });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message || String(e) });
  }
});

// ====== FRONTEND ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚙️ Раздаём статические файлы из Vite-сборки
app.use(express.static(path.resolve(__dirname, "../../frontend/dist")));

// SPA fallback (для React/Vite роутов)
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../frontend/dist", "index.html"));
});

// ====== Глобальный обработчик ошибок ======
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  res
    .status(500)
    .json({ ok: false, error: err?.message || "Internal server error" });
});

// ====== Запуск ======
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ Backend + Frontend up on http://localhost:${PORT}`)
);
