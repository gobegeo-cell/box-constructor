// backend/mailer.js  (ESM-версия, ПОД ЗАМЕНУ)
import nodemailer from "nodemailer";

function bool(v, def = false) {
  if (v === undefined || v === null || v === "") return def;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

let _transporter = null;

function buildTransport() {
  const port   = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== undefined ? bool(process.env.SMTP_SECURE) : port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
    logger: true,
    debug: true,
  });

  const mask = (s) => (s ? s.replace(/.(?=.{2})/g, "*") : s);
  console.log("[MAIL] init", {
    host: process.env.SMTP_HOST,
    port,
    secure,
    user: mask(process.env.SMTP_USER),
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  });

  return transporter;
}

export function getTransporter() {
  if (!_transporter) _transporter = buildTransport();
  return _transporter;
}

export async function verifyTransporter() {
  const transporter = getTransporter();
  try {
    await transporter.verify();
    console.log("[MAIL] SMTP ready");
    return { ok: true };
  } catch (err) {
    const msg = err?.response || err?.code || err?.message || String(err);
    console.error("[MAIL] verify error:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * sendManagerOrderMail(options) — новая сигнатура:
 *   { to, subject, text, replyTo?, attachments? }
 *
 * sendManagerOrderMail(order, managerPdf) — старая сигнатура: оставлена для совместимости
 */
export async function sendManagerOrderMail(arg1, arg2) {
  const transporter = getTransporter();

  // Новая сигнатура (объект)
  const isNewSignature =
    arg1 &&
    typeof arg1 === "object" &&
    ("to" in arg1 || "subject" in arg1 || "text" in arg1 || "attachments" in arg1) &&
    arg2 === undefined;

  if (isNewSignature) {
    const {
      to = process.env.MANAGER_EMAIL,
      subject = "(no subject)",
      text = "",
      replyTo,
      attachments = [],
    } = arg1 || {};

    if (!to) {
      console.warn("[MAIL] skipped: MANAGER_EMAIL is empty");
      return { ok: false, skipped: true, error: "MANAGER_EMAIL not set" };
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    try {
      const info = await transporter.sendMail({
        from, to, subject, text, attachments, ...(replyTo ? { replyTo } : {}),
      });
      console.log("[MAIL] sent:", info.messageId);
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      const msg = e?.response || e?.code || e?.message || String(e);
      console.error("[MAIL] send error:", msg);
      return { ok: false, error: msg };
    }
  }

  // Старая сигнатура (order, managerPdf)
  const order = arg1 || {};
  const managerPdf = arg2 || null;

  const to = process.env.MANAGER_EMAIL;
  if (!to) {
    console.warn("[MAIL] skipped: MANAGER_EMAIL is empty");
    return { ok: false, skipped: true, error: "MANAGER_EMAIL not set" };
  }

  const attachments = [];
  if (managerPdf?.path) {
    const fileName = managerPdf.path.split(/[\\/]/).pop() || `TZ_Manager_${Date.now()}.pdf`;
    attachments.push({ filename: fileName, path: managerPdf.path });
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = `Новая заявка ТЗ #${order?.id || "-"} / ${order?.client || "клиент"}`;
  const text =
    `Получена новая заявка\n` +
    `Клиент: ${order?.client || "-"}\n` +
    `ID: ${order?.id || "-"}\n` +
    `Дата: ${new Date(order?.date || Date.now()).toLocaleString("ru-RU")}\n`;

  try {
    const info = await transporter.sendMail({ from, to, subject, text, attachments });
    console.log("[MAIL] sent:", info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const msg = e?.response || e?.code || e?.message || String(e);
    console.error("[MAIL] send error:", msg);
    return { ok: false, error: msg };
  }
}
