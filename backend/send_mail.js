// backend/mailer.js
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

export async function sendManagerOrderMail({ to, subject, text, attachments = [] }) {
  try {
    // Формируем тело письма
    const emailData = {
      from: process.env.YANDEX_FROM,
      to: [to],
      subject: subject,
      text_body: text || "",
    };

    // Если есть вложения (PDF)
    if (attachments.length > 0) {
      const fs = await import("fs");
      const path = await import("path");

      const filePath = attachments[0].path;
      const fileName = path.basename(filePath);
      const fileData = fs.readFileSync(filePath).toString("base64");

      emailData.attachments = [
        {
          name: fileName,
          content_type: "application/pdf",
          content: fileData,
        },
      ];
    }

    // Отправляем запрос к API Yandex Postbox
    const response = await fetch("https://postbox.api.cloud.yandex.net/v2/email/outbound-emails", {
      method: "POST",
      headers: {
        "Authorization": `Api-Key ${process.env.YANDEX_POSTBOX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    const result = await response.json();

    if (response.ok) {
      console.log("[MAIL] Отправлено через Postbox:", result.id || "(без ID)");
      return { ok: true, id: result.id };
    } else {
      console.error("[MAIL] Ошибка Postbox:", result);
      return { error: result.message || "Ошибка Postbox" };
    }
  } catch (e) {
    console.error("[MAIL] Критическая ошибка:", e);
    return { error: e.message };
  }
}
