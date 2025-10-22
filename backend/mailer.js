// backend/mailer.js

export async function sendViaPostbox(emailData) {
  try {
    const res = await fetch('https://postbox.api.cloud.yandex.net/v2/email/outbound-emails', {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${process.env.YANDEX_POSTBOX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error('[MAIL] Postbox error:', res.status, data);
      return { ok: false, status: res.status, error: data.message || 'Postbox error' };
    }

    const data = await res.json().catch(() => ({}));
    console.log('[MAIL] Postbox sent:', data.id || '(no id)');
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[MAIL] send error:', err.message);
    return { ok: false, error: err.message };
  }
}
