// generate_click.js
// Генерим короткий "магнитный щелчок" и кодируем в MP3

const fs = require("fs");
const path = require("path");
const lamejs = require("lamejs");

// ---------- настройки звука ----------
const SAMPLE_RATE = 44100;     // Гц
const DURATION = 0.22;         // секунды, общая длительность
const BITRATE = 128;           // kbps MP3

// Слои щелчка (подбирались на ухо под "магнит + дерево")
const layers = [
  // резкий клик (высокочастотный)
  { f: 3000, a: 0.9, tau: 0.008 },   // tau — константа затухания (сек)
  // древесный "удар"
  { f: 180,  a: 0.45, tau: 0.040 },
  // лёгкий резонанс корпуса
  { f: 900,  a: 0.30, tau: 0.060 },
];

// Доп. короткий шум-импульс в начале (как реальный отрыв)
const NOISE_MS = 6;            // длительность шума (мс)
const NOISE_GAIN = 0.25;

// ---------- синтез ----------
const N = Math.floor(SAMPLE_RATE * DURATION);
const buf = new Float32Array(N);

for (let n = 0; n < N; n++) {
  const t = n / SAMPLE_RATE;

  // шумовой "щелчок" (импульс Хэмминга)
  if (t < NOISE_MS / 1000) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * t) / (NOISE_MS / 1000));
    const noise = (Math.random() * 2 - 1) * NOISE_GAIN * w;
    buf[n] += noise;
  }

  // сумма затухающих синусов (щелчок + дерево + резонанс)
  let s = 0;
  for (const L of layers) {
    const env = Math.exp(-t / L.tau);
    s += L.a * env * Math.sin(2 * Math.PI * L.f * t);
  }
  buf[n] += s;
}

// небольшой “перелёт” перед остановкой (как инерция)
for (let n = 0; n < N; n++) {
  const t = n / SAMPLE_RATE;
  const tail = Math.max(0, (0.22 - t) / 0.22); // плавный decay хвоста
  buf[n] *= tail ** 0.4;
}

// нормализация
let max = 0;
for (let i = 0; i < N; i++) max = Math.max(max, Math.abs(buf[i]));
const gain = max > 0 ? 0.95 / max : 1;

// float32 -> int16
const pcm16 = new Int16Array(N);
for (let i = 0; i < N; i++) {
  pcm16[i] = Math.max(-1, Math.min(1, buf[i] * gain)) * 0x7fff;
}

// ---------- MP3 кодирование ----------
const mp3encoder = new lamejs.Mp3Encoder(1, SAMPLE_RATE, BITRATE);
const blockSize = 1152;
let mp3Data = [];

for (let i = 0; i < pcm16.length; i += blockSize) {
  const chunk = pcm16.subarray(i, i + blockSize);
  const mp3buf = mp3encoder.encodeBuffer(chunk);
  if (mp3buf.length > 0) mp3Data.push(Buffer.from(mp3buf));
}
const end = mp3encoder.flush();
if (end.length > 0) mp3Data.push(Buffer.from(end));

const outDir = path.join(process.cwd(), "public", "sounds");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "click.mp3");
fs.writeFileSync(outFile, Buffer.concat(mp3Data));

console.log("✅ Сохранено:", outFile);
console.log("   Длительность:", DURATION, "сек,", "битрейт:", BITRATE, "kbps");
console.log("   Подстройки: layers[], NOISE_MS, NOISE_GAIN, DURATION");
