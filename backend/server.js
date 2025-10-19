// backend/server.js
import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import quotesRouter from "./api/quotes.js";
import tzRouter from "./api/tz.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// --- ACCESS: проверка промокода по .env ---
// Пример: GET http://localhost:4000/api/access/check?code=BOX2025
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

// ====== Почтовая отправка (soft режим, код не обязателен) ======
app.post("/api/quotes/send", async (req, res) => {
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
    const accessInfo = access ? `Код доступа: ${access}` : "Код доступа: — (не указан)";

    const to = String(req.body?.to || process.env.MANAGER_EMAIL || "").trim();
    if (!to) return res.status(400).json({ ok: false, error: "No recipient" });

    const subject = String(req.body?.subject || "ТЗ (менеджер)").slice(0, 200);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE).toLowerCase() !== "false",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      logger: true,
      debug: true,
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: `Автоматическая отправка ТЗ\n${accessInfo}`,
      attachments: [
        {
          filename: f.name || `TZ_Manager_${Date.now()}.pdf`,
          content: f.data,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("[MAIL] sent:", info.messageId);
    res.json({ ok: true, id: info.messageId });
  } catch (e) {
    const msg = e?.response || e?.code || e?.message || String(e);
    console.error("[MAIL] error:", msg);
    res.status(500).json({ ok: false, error: msg || "Mail send failed" });
  }
});

// ====== TZ и QUOTES роутеры ======
app.use("/api/tz", tzRouter);
app.use("/api/quotes", quotesRouter);

// ====== ENV DEBUG ======
app.get("/api/mail/env", (req, res) => {
  res.json({
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER?.slice(0, 2) + "***" + process.env.SMTP_USER?.slice(-2),
    SMTP_FROM: process.env.SMTP_FROM,
    MANAGER_EMAIL: process.env.MANAGER_EMAIL,
    ACCESS_CODES: (process.env.ACCESS_CODES || "").split(",").length,
  });
});

// ====== SMTP проверка ======
app.get("/api/mail/verify", async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE).toLowerCase() !== "false",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.verify();
    res.json({ ok: true, message: "SMTP ready" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ====== Старт сервера ======
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend up on http://localhost:${PORT}`);
});
