// backend/api/tz.js
import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { sendManagerOrderMail } from '../mailer.js';

const router = express.Router();

/**
 * POST /api/tz/:id/email-attach
 * form-data:
 *  - file: PDF
 *  - email: для Reply-To (необяз.)
 *  - subject: (необяз.)
 */
router.post('/:id/email-attach', async (req, res) => {
  const tmpFiles = [];
  try {
    const f = req.files?.file;
    if (!f?.data || !f?.size) {
      return res.status(400).json({ ok: false, error: 'No file attached' });
    }

    const id = req.params.id || '-';
    const replyTo = String(req.body?.email || '').trim() || undefined;
    const subject = String(req.body?.subject || `ТЗ #${id}`).slice(0, 200);
    const to = process.env.MANAGER_EMAIL;

    const safeName = (f.name || `TZ_${id}.pdf`).replace(/[^\w.\-]+/g, '_');
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}_${safeName}`);
    await fs.writeFile(tmpPath, f.data);
    tmpFiles.push(tmpPath);

    const text =
      `Автописьмо: ТЗ #${id}\n` +
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