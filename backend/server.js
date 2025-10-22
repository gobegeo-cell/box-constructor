// backend/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import fileUpload from "express-fileupload"; // добавлено для FormData

// роутеры
import accessRouter from "./api/access.js";
import quotesRouter from "./api/quotes.js";
import tzRouter from "./api/tz.js";

// отправка через Postbox
import { sendManagerOrderMail } from "./mailer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: false,
  })
);

// ===== Подключение статического фронтенда =====
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// ===== API маршруты =====
app.use("/api/access", accessRouter);
app.use("/api/quotes", quotesRouter);
app.use("/api/tz", tzRouter);

// ===== Ручная отправка письма через Postbox =====
app.post("/api/send", async (req, res) => {
  try {
    const { to, subject, text } = req.body || {};

    if (!to) {
      return res.status(400).json({ success: false, error: "No recipient (to)" });
    }

    const attachments = [];

    // Принимаем файл, если фронт шлёт FormData (например, manager ТЗ)
    if (req.files && req.files.file) {
      attachments.push({
        filename: req.files.file.name,
        content: req.files.file.data.toString("base64"),
      });
    }

    const result = await sendManagerOrderMail({
      to,
      subject: subject || "Box Constructor TZ",
      text: text || "",
      attachments,
    });

    if (result?.ok) {
      res.status(200).json({ success: true, id: result.id });
    } else {
      res
        .status(502)
        .json({ success: false, error: result?.error || "Postbox send failed" });
    }
  } catch (err) {
    console.error("[MAIL] crash:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ===== Healthcheck =====
app.get("/", (_req, res) => {
  res.type("text/plain").send("Backend OK");
});

// ===== SPA fallback =====
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// ===== Запуск =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ACCESS] router mounted at /api/access`);
  console.log(`[QUOTES] router mounted at /api/quotes`);
  console.log(`[TZ] router mounted at /api/tz`);
  console.log(`✅ Backend up on http://localhost:${PORT}`);
});
