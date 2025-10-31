// scripts/verifyApiFiles.cjs
// Проверяет содержимое src/api/*.ts на соответствие ожидаемым маршрутам/экспортам

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const apiDir = path.join(ROOT, "src", "api");

const files = [
  "config.ts",
  "index.ts",
  "submitTz.ts",
  "panel.ts",
  "pdf.ts",
  "share.ts",
];

function read(p) {
  try { return fs.readFileSync(p, "utf-8"); } catch { return null; }
}
function must(pat, text, why) {
  const ok = pat.test(text);
  return [ok, ok ? "" : `❌ ${why} (не найдено: ${pat})`];
}

let allOk = true;
for (const f of files) {
  const full = path.join(apiDir, f);
  const content = read(full);
  if (content == null) {
    console.log(`✖ ${f} — файл не найден`);
    allOk = false;
    continue;
  }
  console.log(`\n— Проверка ${f}`);
  let ok = true;
  const fail = (msg) => { ok = false; console.log("   ", msg); };

  if (f === "config.ts") {
    const [t1, m1] = must(/export\s+const\s+API_BASE\s*=\s*["'`](http|\/)/, content, "Должен экспортироваться API_BASE");
    if (!t1) fail(m1);
  }

  if (f === "index.ts") {
    const [t1, m1] = must(/export\s*\*\s*from\s*["']\.\/submitTz["']/, content, "Должен реэкспортировать submitTz");
    const [t2, m2] = must(/export\s*\*\s*from\s*["']\.\/panel["']/, content, "Должен реэкспортировать panel");
    const [t3, m3] = must(/export\s*\*\s*from\s*["']\.\/pdf["']/, content, "Должен реэкспортировать pdf");
    const [t4, m4] = must(/export\s*\*\s*from\s*["']\.\/share["']/, content, "Должен реэкспортировать share");
    if (!t1) fail(m1); if (!t2) fail(m2); if (!t3) fail(m3); if (!t4) fail(m4);
  }

  if (f === "submitTz.ts") {
    const [t1, m1] = must(/fetch\(\s*`?\${?API_BASE}?\/tz/, content, "POST должен идти на `${API_BASE}/tz`");
    const [t2, m2] = must(/body:\s*JSON\.stringify\(payload\)/, content, "Нужно отправлять ВЕСЬ payload");
    if (!t1) fail(m1); if (!t2) fail(m2);
  }

  if (f === "panel.ts") {
    const [t1, m1] = must(/\/tz\/\$\{?encodeURIComponent\(id\)\}?\/view/, content, "GET view должен быть `/tz/:id/view`");
    const [t2, m2] = must(/\/tz\/promo\/validate\?code=/, content, "Проверка промо: `/tz/promo/validate?code=...&tzId=...`");
    if (!t1) fail(m1); if (!t2) fail(m2);
  }

  if (f === "pdf.ts") {
    const [t1, m1] = must(/\/tz\/\$\{?encodeURIComponent\(id\)\}?\/pdf\?type=client/, content, "Client PDF: `/tz/:id/pdf?type=client`");
    const [t2, m2] = must(/\/tz\/\$\{?encodeURIComponent\(id\)\}?\/pdf\?type=manager&promo=/, content, "Manager PDF: `/tz/:id/pdf?type=manager&promo=...`");
    if (!t1) fail(m1); if (!t2) fail(m2);
  }

  if (f === "share.ts") {
    const [t1, m1] = must(/location\.origin.*\/tz\/\$\{?encodeURIComponent\(id\)\}?\/pdf\?type=client/, content, "Share client ссылку формируем на `/tz/:id/pdf?type=client`");
    const [t2, m2] = must(/location\.origin.*\/tz\/\$\{?encodeURIComponent\(id\)\}?\/pdf\?type=manager&promo=/, content, "Share manager ссылку формируем на `/tz/:id/pdf?type=manager&promo=...`");
    const [t3, m3] = must(/fetch\(\s*`?\${?API_BASE}?\/tz\/\$\{?encodeURIComponent\(id\)\}?\/share/, content, "POST `/tz/:id/share` для письма менеджеру");
    if (!t1) fail(m1); if (!t2) fail(m2); if (!t3) fail(m3);
  }

  if (ok) console.log("   ✅ ОК");
  allOk = allOk && ok;
}

console.log("\n==== РЕЗУЛЬТАТ ====");
console.log(allOk ? "✅ ВСЁ ОК" : "❌ ЕСТЬ НЕСОВПАДЕНИЯ");
process.exit(allOk ? 0 : 1);