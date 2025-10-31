// pages/api/quotes/send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import nodemailer from "nodemailer";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // ==== ENV LOGS (временно, для проверки что .env.local подхватился) ====
  console.log("[ENV CHECK] SMTP_HOST   =", process.env.SMTP_HOST);
  console.log("[ENV CHECK] SMTP_PORT   =", process.env.SMTP_PORT);
  console.log("[ENV CHECK] SMTP_SECURE =", process.env.SMTP_SECURE);
  console.log("[ENV CHECK] SMTP_USER   =", process.env.SMTP_USER);
  console.log("[ENV CHECK] SMTP_FROM   =", process.env.SMTP_FROM);
  console.log("[ENV CHECK] MANAGER_EMAIL =", process.env.MANAGER_EMAIL);

  try {
    // -------- parse multipart/form-data
    const form = formidable({ multiples: false });
    const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve({ fields: flds, files: fls })));
    });

    const to = String(fields.to || process.env.MANAGER_EMAIL || "public@pchelkinspb.ru");
    const subject = String(fields.subject || "Менеджерское ТЗ");
    const meta = fields.meta ? safeJson(fields.meta) : {};
    const pricing = fields.pricing ? safeJson(fields.pricing) : {};

    const file = files.file as formidable.File;
    if (!file?.filepath) {
      return res.status(400).json({ ok: false, error: "No file" });
    }

    const fileBuffer = fs.readFileSync(file.filepath);

    // -------- SMTP (Яндекс, порт 465, secure=true)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.yandex.ru",
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true", // 465 -> true
      auth: {
        user: process.env.SMTP_USER!, // public@pchelkinspb.ru
        pass: process.env.SMTP_PASS!, // пароль из .env.local
      },
    });

    // проверка соединения (опционально)
    await transporter.verify().catch((e) => {
      console.warn("[MAIL VERIFY WARN]", e?.message || e);
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Box Constructor" <public@pchelkinspb.ru>',
      to,
      subject,
      html: `
        <p>Во вложении менеджерская версия ТЗ.</p>
        <pre style="font:12px/1.4 monospace">${escapeHtml(JSON.stringify({ meta, pricing }, null, 2))}</pre>
      `,
      attachments: [
        { filename: "TZ_Manager.pdf", content: fileBuffer, contentType: "application/pdf" },
      ],
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[MAIL ERROR]", e);
    res.status(500).json({ ok: false, error: e?.message || "send failed" });
  }
}

function safeJson(x: any) {
  try { return typeof x === "string" ? JSON.parse(x) : x; } catch { return x; }
}
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
