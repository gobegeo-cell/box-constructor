// backend/api/quotes.js
import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { sendManagerOrderMail } from '../mailer.js';

const router = express.Router();

function isAccessValid(code) {
  const valid = (process.env.ACCESS_CODES || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  const c = String(code || '').trim().toUpperCase();
  return !!c && valid.includes(c);
}

/**
 * POST /api/quotes/send
 * form-data:
 *  - file: PDF
 *  - subject: string
 *  - replyTo / email: string
 *  - accessCode / promo / access: string
 *  - to: (необязательно) адрес получателя, по умолчанию MANAGER_EMAIL
 */
router.post('/send', async (req, res) => {
  const tmpFiles = [];
  try {
    const f = req.files?.file;
    if (!f?.data || !f?.size) {
      return res.status(400).json({ ok: false, error: 'No file attached' });
    }

    const to = String(req.body?.to || process.env.MANAGER_EMAIL || '').trim();
    if (!to) return res.status(400).json({ ok: false, error: 'No recipient' });

    const subject = String(req.body?.subject || 'ТЗ (менеджер)').slice(0, 200);
    const replyTo = String(req.body?.replyTo || req.body?.email || '').trim() || undefined;

    const access =
      req.body?.accessCode ?? req.body?.promo ?? req.body?.access ?? '';
    const accessInfo = isAccessValid(access)
      ? `Код доступа: ${String(access).toUpperCase()} (валиден)`
      : `Код доступа: ${access ? String(access).toUpperCase() + ' (НЕ валиден)' : '— (не указан)'}`;

    const safeName = (f.name || `TZ_Manager_${Date.now()}.pdf`).replace(/[^\w.\-]+/g, '_');
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}_${safeName}`);
    await fs.writeFile(tmpPath, f.data);
    tmpFiles.push(tmpPath);

    const text =
      `Автоматическая отправка ТЗ\n` +
      `${accessInfo}\n` +
      (replyTo ? `Ответить на: ${replyTo}\n` : '');

    const result = await sendManagerOrderMail({
      to,
      subject,
      text,
      replyTo,
      attachments: [{ filename: safeName, path: tmpPath }],
    });

    if (!result?.ok) {
      console.error('[MAIL] send error:', result?.error);
      return res.status(500).json({ ok: false, error: result?.error || 'Mail send failed' });
    }

    console.log('[MAIL] sent via Postbox:', result.id || '(no id)');
    res.json({ ok: true, id: result.id });
  } catch (e) {
    console.error('[MAIL] error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  } finally {
    for (const p of tmpFiles) {
      try { await fs.unlink(p); } catch {}
    }
  }
});

export default router;