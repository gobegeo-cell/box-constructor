// backend/mailer.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// ✅ глобально используем fetch (Node 18+), а если нет — подхватываем node-fetch
let safeFetch = globalThis.fetch;
if (!safeFetch) {
  const { default: fetchImport } = await import('node-fetch');
  safeFetch = fetchImport;
}

// ===== buildEmailData =====
function buildEmailData({ from, to, subject, text, attachments = [] }) {
  const email = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject: subject || '(no subject)',
    text_body: text || '',
  };

  if (attachments?.length) {
    email.attachments = attachments
      .filter((a) => a?.path && fs.existsSync(a.path))
      .map((a) => {
        try {
          const filePath = a.path;
          const name = a.filename || path.basename(filePath);
          const content = fs.readFileSync(filePath).toString('base64');
          const content_type = mime.lookup(name) || 'application/octet-stream';
          return { name, content_type, content };
        } catch (e) {
          console.warn('[MAIL] cannot attach file:', a.path, e.message);
          return null;
        }
      })
      .filter(Boolean);
  }

  if (!email.text_body && !email.attachments?.length) {
    console.warn('[MAIL] empty email body');
  }

  return email;
}

// ===== sendViaPostbox =====
async function sendViaPostbox(emailData) {
  try {
    const res = await safeFetch(
      'https://postbox.api.cloud.yandex.net/v2/email/outbound-emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Api-Key ${process.env.YANDEX_POSTBOX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      }
    );

    let data = {};
    try {
      data = await res.json();
    } catch (_) {}

    if (!res.ok) {
      const msg =
        data?.message || `[Postbox ${res.status}] ${JSON.stringify(data)}`;
      throw new Error(msg);
    }

    console.log('[MAIL] Postbox sent:', data.id || '(no id)');
    return { ok: true, id: data.id };
  } catch (e) {
    console.error('[MAIL] sendViaPostbox error:', e.message);
    return { ok: false, error: e.message || String(e) };
  }
}

// ===== sendManagerOrderMail =====
export async function sendManagerOrderMail({
  to,
  subject,
  text,
  replyTo,
  attachments = [],
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
