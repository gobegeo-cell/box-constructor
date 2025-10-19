// backend/send_mail.js  (ESM-версия, ПОД ЗАМЕНУ)
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { sendManagerOrderMail } from "./mailer.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const args    = process.argv.slice(2);
const pdfPath = args[0];
const toEmail = args[1] || process.env.MANAGER_EMAIL;

function looksLikeNodemailerOk(result) {
  return !!(result && (result.messageId || (Array.isArray(result.accepted) && result.accepted.length > 0)));
}

async function main() {
  try {
    if (!pdfPath) {
      console.error("Не указан путь к PDF");
      console.error("Пример: node send_mail.js ./storage/pdfs/TEST_manager.pdf manager@example.com");
      process.exit(1);
    }
    const abs = path.resolve(__dirname, pdfPath);
    if (!fs.existsSync(abs)) {
      console.error("Файл не найден:", abs);
      process.exit(1);
    }

    const mailOpts = {
      to: toEmail,
      subject: "Тестовое письмо с PDF менеджера",
      text: "Пожалуйста, найдите прикреплённый PDF менеджера.",
      attachments: [{ path: abs }]
    };

    const result = await sendManagerOrderMail(mailOpts);

    if (result?.ok || result?.skipped || looksLikeNodemailerOk(result)) {
      console.log("Письмо отправлено успешно ✅");
      if (result?.messageId) console.log("messageId:", result.messageId);
      process.exit(0);
    } else {
      console.error("Ошибка отправки письма:", result?.error || JSON.stringify(result));
      process.exit(2);
    }
  } catch (e) {
    console.error("Критическая ошибка:", e?.message || e);
    process.exit(2);
  }
}

main();
