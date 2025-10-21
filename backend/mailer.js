// backend/mailer.js — исправленная версия
import fetch from 'node-fetch'; // ✅ добавлено: нужно для Node < 18
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

function buildEmailData({ from, to, subject, text, attachments = [] }) {
  const email = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject: subject || '(no subject)',
    text_body: text || '',
  };

  // вложения (PDF и др.)
  if (attachments && attachments.length) {
    email.attachments = attachments
      .filter(a => a?.path && fs.existsSync(a.path))
      .map(a => {
        const filePath = a.path;
        const name = a.filename || path.basename(filePath);
        const content = fs.readFileSync(filePath).toString('base64');
        const content_type = name.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream';
        return { name, content_type, content };
      });
  }

  return email;
}

async function sendViaPostbox(emailData) {
  const res = await fetch('https://postbox.api.cloud.yandex.net/v2/email/outbound-emails', {
    method: 'POST',
    headers: {
      Authorization: `Api-Key ${process.env.YANDEX_POSTBOX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailData),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  if (!res.ok) {
    const msg = data?.message || `[Postbox ${res.status}] ${JSON.stringify(data)}`;
    throw new Error(msg);
  }

  console.log('[MAIL] Postbox sent:', data.id || '(no id)');
  return { ok: true, id: data.id };
}

export async function sendManagerOrderMail(arg1, arg2) {
  const isNew =
    arg1 && typeof arg1 === 'object' &&
    (('to' in arg1) || ('subject' in arg1) || ('text' in arg1) || ('attachments' in arg1)) &&
    arg2 === undefined;

  const FROM = process.env.YANDEX_FROM || `Box Constructor <${process.env.MANAGER_EMAIL || 'public@pchelkinspb.ru'}>`;

  if (isNew) {
    const { to = process.env.MANAGER_EMAIL, subject = '(no subject)', text = '', replyTo, attachments = [] } = arg1 || {};

    if (!to) return { ok: false, skipped: true, error: 'MANAGER_EMAIL not set' };

    const emailData = buildEmailData({ from: FROM, to, subject, text, attachments });
    if (replyTo) emailData.reply_to = replyTo;

    try {
      return await sendViaPostbox(emailData);
    } catch (e) {
      console.error('[MAIL] send error:', e.message || e);
      return { ok: false, error: e.message || String(e) };
    }
  }

  const order = arg1 || {};
  const managerPdf = arg2 || null;

  const to = process.env.MANAGER_EMAIL;
  if (!to) return { ok: false, skipped: true, error: 'MANAGER_EMAIL not set' };

  const attachments = [];
  if (managerPdf?.path) {
    const fileName = managerPdf.path.split(/[\\/]/).pop() || `TZ_Manager_${Date.now()}.pdf`;
    attachments.push({ filename: fileName, path: managerPdf.path });
  }

  const subject = `Новая заявка ТЗ #${order?.id || '-'} / ${order?.client || 'клиент'}`;
  const text =
    `Получена новая заявка\n` +
    `Клиент: ${order?.client || '-'}\n` +
    `ID: ${order?.id || '-'}\n` +
    `Дата: ${new Date(order?.date || Date.now()).toLocaleString('ru-RU')}\n`;

  try {
    const emailData = buildEmailData({ from: FROM, to, subject, text, attachments });
    return await sendViaPostbox(emailData);
  } catch (e) {
    console.error('[MAIL] send error:', e.message || e);
    return { ok: false, error: e.message || String(e) };
  }
}