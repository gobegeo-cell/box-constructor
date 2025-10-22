// backend/mailer.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Сетевой стек: принудительно IPv4 + таймауты, стабильнее чем fetch
import { setGlobalDispatcher, Agent, request } from 'undici';
setGlobalDispatcher(new Agent({
  connect: { timeout: 10_000, family: 4 },   // <— IPv4
  keepAliveTimeout: 30_000,
  headersTimeout: 20_000,
}));

const POSTBOX_URL = 'https://postbox.api.cloud.yandex.net/v2/email/outbound-emails';

function buildEmailData({ from, to, subject, text, attachments = [] }) {
  const email = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject: subject || '(no subject)',
    text_body: text || '',
  };

  if (attachments?.length) {
    email.attachments = attachments
      .filter(a => a?.path && fs.existsSync(a.path))
      .map(a => {
        const filePath = a.path;
        const name = a.filename || path.basename(filePath);
        const content = fs.readFileSync(filePath).toString('base64');
        const content_type = mime.lookup(name) || 'application/pdf';
        return { name, content_type, content };
      });
  }
  return email;
}

async function postJSON(url, { body, attempts = 2 }) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await request(url, {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${process.env.YANDEX_POSTBOX_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const txt = await res.body.text();
      let data = {};
      try { data = txt ? JSON.parse(txt) : {}; } catch {}
      if (res.statusCode >= 200 && res.statusCode < 300) return { ok: true, data };
      const msg = data?.message || `HTTP ${res.statusCode} ${txt}`;
      throw new Error(msg);
    } catch (e) {
      lastErr = e;
      if (i < attempts) await new Promise(r => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

async function sendViaPostbox(emailData) {
  try {
    if (!process.env.YANDEX_POSTBOX_API_KEY) throw new Error('YANDEX_POSTBOX_API_KEY is empty');
    const resp = await postJSON(POSTBOX_URL, { body: emailData, attempts: 2 });
    const id = resp.data?.id || '(no id)';
    console.log('[MAIL] Postbox sent:', id);
    return { ok: true, id };
  } catch (e) {
    console.error('[MAIL] sendViaPostbox error:', e?.message || String(e));
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function sendManagerOrderMail({
  to, subject, text, replyTo, attachments = [],
}) {
  const FROM =
    process.env.YANDEX_FROM ||
    `Box Constructor <${process.env.MANAGER_EMAIL || 'public@pchelkinspb.ru'}>`;

  if (!to) to = process.env.MANAGER_EMAIL;
  if (!to) return { ok: false, error: 'MANAGER_EMAIL not set' };

  const emailData = buildEmailData({ from: FROM, to, subject, text, attachments });
  if (replyTo) emailData.reply_to = [replyTo];

  return await sendViaPostbox(emailData);
}
