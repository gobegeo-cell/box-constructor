// backend/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// роутеры из папки api
import accessRouter from './api/access.js';   // <-- правильный путь
import quotesRouter from './api/quotes.js';   // если нужен
import tzRouter from './api/tz.js';           // если нужен

// отправка почты через Postbox
import { sendManagerOrderMail } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// статический фронтенд (оставляю как у тебя)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ===== API routes =====
app.use('/api/access', accessRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/tz', tzRouter);

// единый маршрут для отправки писем через Postbox
app.post('/api/send', async (req, res) => {
  try {
    const { to, subject, text, attachments } = req.body || {};

    if (!to) {
      return res.status(400).json({ success: false, error: 'No recipient (to)' });
    }

    const result = await sendManagerOrderMail({
      to,
      subject: subject || '(no subject)',
      text: text || '',
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    if (result?.ok) {
      return res.status(200).json({ success: true, id: result.id });
    } else {
      return res.status(502).json({ success: false, error: result?.error || 'Postbox send failed' });
    }
  } catch (err) {
    console.error('[MAIL] crash:', err?.message || err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// простой healthcheck, чтобы не было "Cannot GET /"
app.get('/', (_req, res) => {
  res.type('text/plain').send('Backend OK');
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Render-friendly port (как у тебя было)
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('[ACCESS] router mounted at /api/access');
  console.log(`Backend up on http://localhost:${PORT}`);
});
