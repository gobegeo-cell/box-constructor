// backend/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import accessRouter from "./api/access.js";  // <-- правильный путь
import quotesRouter from "./api/quotes.js";  // <-- правильный путь
import tzRouter     from "./api/tz.js";      // <-- правильный путь

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 10000;

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: false,
  })
);

// ===== API routes =====
app.use("/api/access", accessRouter);
app.use("/api/quotes", quotesRouter);
app.use("/api/tz", tzRouter);

// ===== Serve frontend (Vite build) =====
const frontendPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendPath));

// SPA fallback: любые неизвестные пути -> index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ===== Health (опционально) =====
app.get("/", (_req, res) => {
  res.type("text/plain").send("Backend OK");
});

// ===== Start =====
app.listen(PORT, () => {
  console.log("[ACCESS] router mounted at /api/access");
  console.log("[QUOTES] router mounted at /api/quotes");
  console.log("[TZ] router mounted at /api/tz");
  console.log(`✅ Backend up on http://localhost:${PORT}`);
});