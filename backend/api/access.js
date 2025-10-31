// backend/api/access.js
import express from "express";

const router = express.Router();

/**
 * GET /api/access/check?code=BOX2025
 * Возвращает { ok:true, canSeePrices:boolean }
 */
router.get("/check", (req, res) => {
  try {
    const code = String(req.query.code || "").trim().toUpperCase();
    const validCodes = (process.env.ACCESS_CODES || "")
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const canSeePrices = !!code && validCodes.includes(code);
    res.json({ ok: true, canSeePrices });
  } catch (err) {
    console.error("[ACCESS] check error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;