// backend/api/tz.js
import express from "express";
import fs from "fs";
import path from "path";
import fileUpload from "express-fileupload";
import nodemailer from "nodemailer";
import { isAccessValid } from "../utils/access.js";

export const router = express.Router();

/* --------- Простое файловое хранилище JSON --------- */
const STORAGE_DIR = path.resolve(process.cwd(), "storage");
const STORE_FILE  = path.join(STORAGE_DIR, "tz-store.json");

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ data: {}, seq: 1 }, null, 2), "utf8");
}
function loadStore() {
  ensureStorage();
  try { return JSON.parse(fs.readFileSync(STORE_FILE, "utf8")); } catch { return { data: {}, seq: 1 }; }
}
function saveStore(st) {
  ensureStorage();
  fs.writeFileSync(STORE_FILE, JSON.stringify(st, null, 2), "utf8");
}
function nextId(st) {
  const id = String(st.seq || 1).padStart(6, "0");
  st.seq = (st.seq || 1) + 1;
  return id;
}

/* --------- Nodemailer (один транспорт) --------- */
function mailer() {
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE).toLowerCase() !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
  return t;
}

/* --------- Middlewares --------- */
router.use(express.json({ limit: "1mb" })); // JSON

const uploadMw = fileUpload({
  useTempFiles: false,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  abortOnLimit: true,
});

/* --------- Роуты --------- */

router.get("/health", (_req, res) => res.json({ ok: true, name: "tz-api", ts: Date.now() }));

// Создать/обновить ТЗ (без генерации PDF и без отправок)
router.post("/", (req, res) => {
  try {
    const body = req.body || {};
    const st = loadStore();

    let id = body.tzId && String(body.tzId).trim();
    if (id && st.data[id]) {
      st.data[id] = {
        ...(st.data[id] || {}),
        master_tz: body.master_tz ?? st.data[id].master_tz,
        client_view: body.client_view ?? st.data[id].client_view,
        manager_view: body.manager_view ?? st.data[id].manager_view,
        meta: body.meta ?? st.data[id].meta,
        updatedAt: new Date().toISOString(),
      };
    } else {
      id = nextId(st);
      st.data[id] = {
        tzId: id,
        master_tz: body.master_tz ?? {},
        client_view: body.client_view ?? {},
        manager_view: body.manager_view ?? {},
        meta: body.meta ?? {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    saveStore(st);
    res.json({ ok: true, tzId: id });
  } catch (e) {
    console.error("[TZ] save error:", e);
    res.status(500).json({ ok: false, error: "save failed" });
  }
});

// Получить представление (client|manager) без генерации PDF
router.get("/:id/view", (req, res) => {
  try {
    const st = loadStore();
    const rec = st.data?.[req.params.id];
    if (!rec) return res.status(404).json({ ok: false, error: "tz not found" });

    // для ПАНЕЛИ: код обязателен — иначе viewType будет "client" (панель не откроется)
    const code = String(req.query?.promo || req.query?.access || req.query?.code || "")
      .trim().toUpperCase();
    const isMgr = isAccessValid(code);

    const view = isMgr ? rec.manager_view : rec.client_view;
    return res.json({ ok: true, tzId: rec.tzId, viewType: isMgr ? "manager" : "client", view });
  } catch (e) {
    console.error("[TZ] view error:", e);
    res.status(500).json({ ok: false, error: "view failed" });
  }
});

// ПРИНЯТЬ ГОТОВЫЙ PDF и отправить менеджеру (SOFT ACCESS)
router.post("/:id/email-attach", uploadMw, async (req, res) => {
  try {
    const st = loadStore();
    const rec = st.data?.[req.params.id];
    if (!rec) return res.status(404).json({ ok: false, error: "tz not found" });

    // МЯГКАЯ проверка: код НЕ обязателен
    const code = String(
      req.body?.promo || req.body?.accessCode || req.body?.access || req.body?.code || ""
    ).trim().toUpperCase();
    const codeOk = code && isAccessValid(code);
    if (!codeOk && code) {
      console.warn("[TZ ACCESS] invalid (soft):", code);
    }

    const f = req.files?.file; // {name, data:Buffer, mimetype, size}
    if (!f?.data || !f.size) return res.status(400).json({ ok: false, error: "no file" });

    const to = String(req.body?.to || process.env.MANAGER_EMAIL || "").trim();
    if (!to) return res.status(400).json({ ok: false, error: "no recipient" });

    // Тема/текст письма
    const tagTs = new Date().toISOString();
    const subject = String(req.body?.subject || `TZ #${rec.tzId} (attach) ${tagTs}`).slice(0, 200);
    const text = [
      `Автоматическая отправка PDF (front-generated) по ТЗ #${rec.tzId}.`,
      `Дата: ${tagTs}`,
      codeOk ? `Код доступа: ${code}` : (code ? `Код доступа: ${code} (НЕВЕРНЫЙ)` : "Код доступа: — (не указан)"),
    ].join("\n");

    const transporter = mailer();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments: [
        {
          filename: f.name || `TZ_Manager_${rec.tzId}.pdf`,
          content: f.data,                 // Buffer
          contentType: "application/pdf",
        },
      ],
    });

    console.log("[TZ] email-attach sent:", info.messageId, "tzId:", rec.tzId, "to:", to);
    res.json({ ok: true, id: info.messageId });
  } catch (e) {
    console.error("[TZ] email-attach error:", e);
    res.status(500).json({ ok: false, error: "email failed" });
  }
});

export default router;
