#!/usr/bin/env node
// QuizMaster yaşam döngüsü: node scripts/app.mjs start|stop|status|logs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  commandFor, isAlive, isPortOpen, paths, readEnvValue, readPidFile, resolveMode, startProcess, stopProcess, tailText,
} from './app-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = paths(root);

const HELP = `Kullanım: node scripts/app.mjs <komut> [seçenekler]

  start [--mode dev|production] [--json]   Uygulamayı arka planda başlatır
  stop                                      Çalışan uygulamayı (süreç ağacıyla) durdurur
  status [--json]                           Çalışıyor mu? (çıkış kodu 0: çalışıyor, 3: durmuş)
  logs [--lines N] [--follow]               Son log satırlarını gösterir

--mode verilmezse server/.env içindeki NODE_ENV kullanılır (production → derlenmiş sürüm, aksi hâlde pnpm dev).
`;

function parse(argv) {
  const options = { json: false, follow: false, lines: 50, mode: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--follow' || arg === '-f') options.follow = true;
    else if (arg === '--lines') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--lines pozitif bir tam sayı bekler.');
      options.lines = value;
    } else if (arg === '--mode') {
      const value = argv[++i];
      if (value !== 'dev' && value !== 'production') throw new Error("--mode 'dev' veya 'production' olmalıdır.");
      options.mode = value;
    } else throw new Error(`Bilinmeyen seçenek: ${arg}`);
  }
  return options;
}

function logPathFor(mode) {
  return path.join(p.logDir, mode === 'production' ? 'app-production.log' : 'app-dev.log');
}

function print(options, data, text) {
  console.log(options.json ? JSON.stringify(data) : text);
}

async function start(options) {
  const mode = resolveMode(options.mode, p.envFile);
  if (mode === 'production' && !fs.existsSync(p.distEntry)) {
    console.error('Üretim derlemesi bulunamadı (dist/index.cjs). Önce: pnpm build');
    return 1;
  }
  const { command, args } = commandFor(mode, root);
  try {
    const record = startProcess({
      command, args, cwd: root, logPath: logPathFor(mode), pidFile: p.pidFile, mode,
      env: { NODE_ENV: mode === 'production' ? 'production' : 'development' },
    });
    print(options, { started: true, ...record }, `Başlatıldı (${mode}, PID ${record.pid}). Log: ${path.relative(root, record.logFile)}`);
    return 0;
  } catch (error) {
    if (options.json) console.log(JSON.stringify({ started: false, code: error.code ?? 'ERROR', message: error.message, pid: error.pid }));
    else console.error(error.message);
    return error.code === 'ALREADY_RUNNING' ? 4 : 1;
  }
}

async function stop(options) {
  const result = await stopProcess(p.pidFile);
  const messages = {
    'no-record': 'Kayıtlı bir uygulama süreci yok.',
    'not-running': `Süreç zaten kapalıydı (PID ${result.pid}); kayıt temizlendi.`,
    'still-running': `Süreç durdurulamadı (PID ${result.pid}). Elle sonlandırmanız gerekebilir.`,
  };
  print(options, result, result.stopped ? `Durduruldu (PID ${result.pid}).` : messages[result.reason]);
  return result.stopped || result.reason !== 'still-running' ? 0 : 1;
}

async function status(options) {
  const record = readPidFile(p.pidFile);
  const running = Boolean(record && isAlive(record.pid));
  const apiPort = Number(readEnvValue(p.envFile, 'PORT')) || 5000;
  const [api, web] = await Promise.all([isPortOpen(apiPort), isPortOpen(5173)]);
  const data = { running, pid: running ? record.pid : null, mode: record?.mode ?? null, startedAt: record?.startedAt ?? null, apiPort, apiReachable: api, devUiReachable: web };
  const lines = running
    ? [`Çalışıyor (PID ${record.pid}${record.mode ? `, ${record.mode}` : ''}${record.startedAt ? `, ${record.startedAt}` : ''})`]
    : [record ? 'Durmuş (kayıtlı süreç yok olmuş).' : 'Durmuş.'];
  lines.push(`API ${apiPort}: ${api ? 'açık' : 'kapalı'}${web ? ' | Arayüz 5173: açık' : ''}`);
  print(options, data, lines.join('\n'));
  return running ? 0 : 3;
}

async function logs(options) {
  const record = readPidFile(p.pidFile);
  const mode = record?.mode ?? resolveMode(options.mode, p.envFile);
  const file = record?.logFile && fs.existsSync(record.logFile) ? record.logFile : logPathFor(mode);
  if (!fs.existsSync(file)) { console.error(`Log dosyası yok: ${path.relative(root, file)}`); return 1; }
  console.log(tailText(fs.readFileSync(file, 'utf8'), options.lines));
  if (!options.follow) return 0;
  let position = fs.statSync(file).size;
  fs.watchFile(file, { interval: 500 }, current => {
    if (current.size < position) position = 0;
    if (current.size === position) return;
    const fd = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(current.size - position);
    fs.readSync(fd, buffer, 0, buffer.length, position);
    fs.closeSync(fd);
    position = current.size;
    process.stdout.write(buffer.toString('utf8'));
  });
  return new Promise(() => {});
}

const commands = { start, stop, status, logs };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') { console.log(HELP); process.exit(command ? 0 : 2); }
  if (!commands[command]) { console.error(`Bilinmeyen komut: ${command}\n\n${HELP}`); process.exit(2); }
  let options;
  try { options = parse(rest); } catch (error) { console.error(error.message); process.exit(2); }
  commands[command](options).then(code => process.exit(code), error => { console.error(error?.message || error); process.exit(1); });
}
