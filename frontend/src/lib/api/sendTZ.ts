export async function sendTZ(pdf: Blob, opts: { webhookUrl: string; fileName: string; meta?: Record<string, any>; authToken?: string; }) {
  const fd = new FormData();
  fd.append('file', pdf, opts.fileName);
  if (opts.meta) fd.append('meta', JSON.stringify(opts.meta));
  const headers: Record<string,string> = {};
  if (opts.authToken) headers['Authorization'] = \Bearer \\;
  const res = await fetch(opts.webhookUrl, { method: 'POST', headers, body: fd, mode: 'cors' });
  if (!res.ok) throw new Error(\sendTZ failed: \ \\);
}
