// backend/mailer.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { lookup as mimeLookup } from 'mime-types';
import { setGlobalDispatcher, Agent, request as urequest } from 'undici';

const POSTBOX_URL = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';

// Сборка тела письма под Postbox
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
        const content_type = mimeLookup(name) || 'application/pdf';
        return { name, content_type, content };
      });
  }
  return email;
}

// Один HTTP POST с заданным агентом
async function postWithAgent(body, agent) {
  const prev = agent ? setGlobalDispatcher(agent) : null;
  try {
    const res = await urequest(POSTBOX_URL, {
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

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { ok: true, data };
    } else {
      const msg = data?.message || `HTTP ${res.statusCode} ${txt}`;
      return { ok: false, error: msg, status: res.statusCode, raw: txt };
    }
  } finally {
    if (prev) setGlobalDispatcher(prev);
  }
}

// Двухступенчатая отправка: (1) IPv4 агент, (2) fallback агент по умолчанию
async function sendViaPostbox(emailData) {
  if (!process.env.YANDEX_POSTBOX_API_KEY) {
    return { ok: false, error: 'YANDEX_POSTBOX_API_KEY is empty' };
  }

  const emailBody = buildEmailData(emailData);

  // 1) IPv4
  try {
    const agent4 = new Agent({
      connect: { timeout: 10_000, family: 4 },
      keepAliveTimeout: 30_000,
      headersTimeout: 20_000,
    });
    const r1 = await postWithAgent(emailBody, agent4);
    if (r1.ok) return { ok: true, id: r1.data?.id || '(no id)' };
    // если ответ от сервера с кодом — это уже не "fetch failed", вернём подробности
    if (r1.status) {
      console.error('[MAIL] Postbox http error (IPv4):', r1.status, r1.error);
      return { ok: false, error: r1.error };
    }
    // если нет status — значит это не HTTP-ответ, пробуем fallback
    console.warn('[MAIL] IPv4 try failed (no HTTP status), fallback to default agent…');
  } catch (e) {
    console.warn('[MAIL] IPv4 agent error:', e?.message, e?.code || '', e?.cause?.message || '');
  }

  // 2) Fallback: агент по умолчанию
  try {
    const r2 = await postWithAgent(emailBody, null);
    if (r2.ok) return { ok: true, id: r2.data?.id || '(no id)' };
    if (r2.status) {
      console.error('[MAIL] Postbox http error (fallback):', r2.status, r2.error);
      return { ok: false, error: r2.error };
    }
    throw new Error(r2.error || 'Unknown fallback error');
  } catch (e) {
    console.error('[MAIL] sendViaPostbox error (fallback):', e?.message, e?.code || '', e?.cause?.message || '');
    return { ok: false, error: e?.message || 'fetch failed' };
  }
}

export async function sendManagerOrderMail({
  to, subject, text, replyTo, attachments = [],
}) {
  const FROM = process.env.YANDEX_FROM || `Box Constructor <${process.env.MANAGER_EMAIL || 'public@pchelkinspb.ru'}>`;
  if (!to) to = process.env.MANAGER_EMAIL;
  if (!to) return { ok: false, error: 'MANAGER_EMAIL not set' };

  const emailData = { from: FROM, to, subject, text, attachments };
  if (replyTo) emailData.reply_to = [replyTo];

  const r = await sendViaPostbox(emailData);
  if (r.ok) {
    console.log('[MAIL] Postbox sent:', r.id);
  } else {
    console.error('[MAIL] sendViaPostbox error:', r.error);
  }
  return r;
}