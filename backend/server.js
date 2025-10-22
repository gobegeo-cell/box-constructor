// backend/server.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import accessRouter from './access.js';
import { sendViaPostbox } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Static frontend build (Vite или React)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API routes
app.use('/api/access', accessRouter);

// Route for sending mail
app.post('/api/send', async (req, res) => {
  try {
    const result = await sendViaPostbox(req.body);
    if (result.ok) {
      res.status(200).json({ success: true, id: result.id });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('[MAIL] crash:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Serve index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ✅ Render-friendly port
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('[ACCESS] router mounted at /api/access');
  console.log(`Backend up on http://localhost:${PORT}`);
});
