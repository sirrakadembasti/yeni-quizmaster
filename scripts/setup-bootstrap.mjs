import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CLEAN_INSTALL_CONFIRMATION,
  inspectInstallationState,
  isLocalPortOpen,
  readConfiguredPort,
  REQUIRED_PNPM_VERSION,
  resetInstallation,
  validateRuntime,
} from "./setup-bootstrap-lib.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptRoot, "..");
const host = "127.0.0.1";
const port = Math.min(65535, Math.max(1024, Number(process.env.SETUP_BOOTSTRAP_PORT) || 5049));
const token = crypto.randomBytes(24).toString("base64url");
const sessionValue = crypto.createHmac("sha256", token).update("quizmaster-bootstrap-session").digest("hex");
const csrfValue = crypto.createHmac("sha256", token).update("quizmaster-bootstrap-csrf").digest("hex");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

const job = {
  type: null,
  status: "idle",
  message: "Kurulum başlatılmayı bekliyor.",
  logs: [],
  wizardUrl: null,
  exitCode: null,
};

let wizardChild = null;
let server;

function pnpmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /pnpm(?:\.c?js)?$/i.test(npmExecPath)) {
    return { command: process.execPath, args: [npmExecPath, ...args] };
  }
  if (process.platform === "win32") {
    return { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "pnpm", ...args] };
  }
  return { command: "pnpm", args };
}

function getPnpmVersion() {
  const invocation = pnpmInvocation(["--version"]);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function runtimeStatus() {
  return validateRuntime(process.version, getPnpmVersion());
}

function appendLog(chunk) {
  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  for (const line of text.split(/[\r\n]+/).filter(Boolean)) job.logs.push(line.slice(0, 1000));
  job.logs = job.logs.slice(-250);
}

function startPnpmJob(type, args, successMessage) {
  if (job.status === "running") throw new Error("Başka bir kurulum işlemi halen çalışıyor.");
  const invocation = pnpmInvocation(args);
  job.type = type;
  job.status = "running";
  job.message = type === "dependencies" ? "Paketler ve kütüphaneler hazırlanıyor..." : "Kurulum sihirbazı başlatılıyor...";
  job.logs = [];
  job.exitCode = null;
  job.wizardUrl = null;

  const child = spawn(invocation.command, invocation.args, {
    cwd: projectRoot,
    env: { ...process.env, FORCE_COLOR: "0" },
    windowsHide: true,
    shell: false,
  });
  child.stdout.on("data", (chunk) => {
    appendLog(chunk);
    if (type === "wizard") {
      const match = chunk.toString("utf8").match(/http:\/\/127\.0\.0\.1:\d+\/setup\?token=[A-Za-z0-9_-]+/);
      if (match) {
        job.wizardUrl = match[0];
        job.message = "Ana kurulum sihirbazı hazır.";
      }
    }
  });
  child.stderr.on("data", appendLog);
  child.once("error", (error) => {
    job.status = "error";
    job.message = `İşlem başlatılamadı: ${error.message}`;
  });
  child.once("close", (code) => {
    job.exitCode = code;
    if (code === 0) {
      job.status = "success";
      job.message = successMessage;
      if (type === "wizard") setTimeout(() => server?.close(), 1500);
    } else {
      job.status = "error";
      job.message = `İşlem ${code ?? "bilinmeyen"} çıkış koduyla başarısız oldu.`;
    }
  });
  return child;
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function authenticated(req) {
  const supplied = cookies(req)["quizmaster.bootstrap"] || "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(sessionValue);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sameOrigin(req) {
  try {
    const origin = new URL(String(req.headers.origin || ""));
    return origin.hostname === host && Number(origin.port || 80) === port;
  } catch {
    return false;
  }
}

function authorizeMutation(req) {
  return authenticated(req) && sameOrigin(req) && req.headers["x-setup-csrf"] === csrfValue;
}

function securityHeaders(res, contentType = "application/json; charset=utf-8") {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

function json(res, status, payload) {
  securityHeaders(res);
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) throw new Error("İstek gövdesi çok büyük.");
  }
  return body ? JSON.parse(body) : {};
}

function publicStatus() {
  return {
    project: packageJson.name,
    directory: projectRoot,
    platform: `${process.platform}/${process.arch}`,
    hostname: os.hostname(),
    runtime: runtimeStatus(),
    installation: inspectInstallationState(projectRoot),
    job,
    configuredPort: readConfiguredPort(projectRoot),
  };
}

function renderClientScript() {
  return String.raw`
const CSRF=document.querySelector('meta[name="setup-csrf"]').content;
const REQUIRED_CONFIRMATION=document.querySelector("main").dataset.confirmation;
const byId=id=>document.getElementById(id);
async function api(url,options={}){options.headers={"Content-Type":"application/json","X-Setup-CSRF":CSRF,...options.headers};const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw new Error(data.message||"İşlem başarısız");return data}
function evidenceLabel(e){return Object.entries(e).filter(([,v])=>v).map(([k])=>({installationLock:"Kurulum kilidi",environmentFile:"Ortam dosyası",applicationDatabase:"Uygulama veritabanı",sessionDatabase:"Oturum veritabanı",deploymentConfig:"Dağıtım profili",pendingInstallation:"Yarım işlem",uploadedFiles:"Yüklenen dosyalar",dependenciesInstalled:"Paketler"}[k]||k)).join(", ")||"Kurulum verisi yok"}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function render(s){const i=s.installation,r=s.runtime,j=s.job;byId("summary").innerHTML='<div class="metric">Node.js<b>'+escapeHtml(r.nodeVersion||"Bulunamadı")+' '+(r.nodeSupported?"✓":"✕")+'</b></div><div class="metric">pnpm<b>'+escapeHtml(r.pnpmVersion||"Bulunamadı")+' '+(r.pnpmSupported?"✓":"✕")+'</b></div><div class="metric">Dizin<b>'+escapeHtml(s.directory)+'</b></div><div class="metric">Bulunanlar<b>'+escapeHtml(evidenceLabel(i.evidence))+'</b></div>';const names={fresh:"Yeni kurulum",partial:"Yarım/eski kurulum",installed:"Uygulama zaten kurulu"};byId("state").textContent=names[i.state];byId("state").className="state "+(i.state==="fresh"?"ok":"warn");byId("message").textContent=j.message;byId("logs").textContent=j.logs.length?j.logs.join("\n"):"Henüz işlem çıktısı yok.";byId("logs").scrollTop=byId("logs").scrollHeight;byId("danger").classList.toggle("hidden",i.state==="fresh");byId("wizard").disabled=i.state==="installed"||j.status==="running"||!i.evidence.dependenciesInstalled;byId("install").disabled=j.status==="running";if(j.wizardUrl)location.href=j.wizardUrl}
async function refresh(){try{render(await api("/api/status"))}catch(e){byId("message").textContent=e.message;byId("message").className="error"}}
byId("install").onclick=async()=>{try{await api("/api/install",{method:"POST",body:"{}"});refresh()}catch(e){alert(e.message)}};
byId("wizard").onclick=async()=>{try{await api("/api/wizard",{method:"POST",body:"{}"});refresh()}catch(e){alert(e.message)}};
byId("refresh").onclick=refresh;
byId("reset").onclick=async()=>{if(!byId("backupAck").checked||byId("confirmation").value!==REQUIRED_CONFIRMATION){alert("Yedek onayı ve doğrulama metni eksik.");return}if(!confirm("Bu işlem mevcut QuizMaster verilerini aktif kurulumdan kaldıracaktır. Devam edilsin mi?"))return;try{const data=await api("/api/reset",{method:"POST",body:JSON.stringify({backupAcknowledged:true,confirmation:byId("confirmation").value})});alert("Yedek oluşturuldu: "+data.backupRoot);byId("confirmation").value="";byId("backupAck").checked=false;refresh()}catch(e){alert(e.message)}};
refresh();setInterval(refresh,1000);
`;
}

function renderPage() {
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="setup-csrf" content="${csrfValue}">
<title>QuizMaster Kurulum Başlatıcısı</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#141b2d;--line:#2b3650;--text:#f7f8fc;--muted:#aeb9ce;--brand:#7867ff;--ok:#2fd69f;--warn:#ffb84d;--danger:#ff5f68}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#1a2040,var(--bg) 45%);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{width:min(980px,calc(100% - 32px));margin:32px auto}.hero,.card{background:rgba(20,27,45,.96);border:1px solid var(--line);border-radius:18px;padding:24px;box-shadow:0 18px 60px #0005}.hero h1{margin:0 0 8px;font-size:30px}.hero p,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin:18px 0}.metric{background:#0e1527;border:1px solid var(--line);border-radius:14px;padding:14px}.metric b{display:block;margin-top:4px}.card{margin-top:18px}.state{display:inline-flex;border-radius:999px;padding:6px 11px;font-weight:700;background:#2a3150}.state.ok{color:var(--ok)}.state.warn{color:var(--warn)}button{border:0;border-radius:12px;padding:12px 16px;background:var(--brand);color:white;font-weight:750;cursor:pointer}button.secondary{background:#27314a}button.danger{background:var(--danger)}button:disabled{opacity:.45;cursor:not-allowed}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}pre{min-height:160px;max-height:320px;overflow:auto;background:#080d19;border:1px solid var(--line);border-radius:12px;padding:14px;white-space:pre-wrap;color:#ced8ea}.danger-zone{border-color:#6d3238}.danger-zone input[type=text]{width:100%;background:#0b1120;border:1px solid #6d4248;color:white;border-radius:10px;padding:11px;margin:10px 0}.hidden{display:none}.error{color:#ff9da3}.success{color:var(--ok)}code{color:#d9d3ff}@media(max-width:600px){.wrap{width:min(100% - 18px,980px);margin:10px auto}.hero,.card{padding:17px}}
</style></head><body><main class="wrap" data-confirmation="${CLEAN_INSTALL_CONFIRMATION}">
<section class="hero"><h1>QuizMaster Kurulum Başlatıcısı</h1><p>Ön kontrol, paket kurulumu ve güvenli ilk yapılandırma tek akışta yürütülür.</p><div id="summary" class="grid"></div><span id="state" class="state">Denetleniyor</span></section>
<section class="card"><h2>Kurulum işlemleri</h2><p id="message" class="muted">Durum okunuyor...</p><div class="actions"><button id="install">Paketleri Kur / Onar</button><button id="wizard" class="secondary">Kurulum Sihirbazına Geç</button><button id="refresh" class="secondary">Yeniden Denetle</button></div><pre id="logs">Henüz işlem çıktısı yok.</pre></section>
<section id="danger" class="card danger-zone hidden"><h2>Temiz kurulum</h2><p class="error"><strong>Dikkat:</strong> Kullanıcılar, sınavlar, anketler, sonuçlar, oturumlar, yapılandırma ve yüklenen dosyalar aktif kurulumdan kaldırılır. Önce doğrulanmış, tarihli yedek alınır.</p><label><input id="backupAck" type="checkbox"> Zorunlu yedek alınacağını ve uygulamanın durdurulması gerektiğini anlıyorum.</label><p>Devam etmek için <code>${CLEAN_INSTALL_CONFIRMATION}</code> yazın:</p><input id="confirmation" type="text" autocomplete="off"><button id="reset" class="danger">Yedekle ve Temiz Kuruluma Geç</button></section>
</main><script src="/bootstrap.js" defer></script></body></html>`;
}

async function handler(req, res) {
  const requestUrl = new URL(req.url || "/", `http://${host}:${port}`);
  if (requestUrl.pathname === "/setup" && requestUrl.searchParams.get("token") === token) {
    securityHeaders(res, "text/plain; charset=utf-8");
    res.statusCode = 303;
    res.setHeader("Set-Cookie", `quizmaster.bootstrap=${encodeURIComponent(sessionValue)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`);
    res.setHeader("Location", "/setup");
    return res.end("Yönlendiriliyor...");
  }
  if (!authenticated(req)) return json(res, 403, { message: "Geçersiz veya süresi dolmuş kurulum oturumu." });
  if (req.method === "GET" && requestUrl.pathname === "/setup") {
    securityHeaders(res, "text/html; charset=utf-8");
    return res.end(renderPage());
  }
  if (req.method === "GET" && requestUrl.pathname === "/bootstrap.js") {
    securityHeaders(res, "application/javascript; charset=utf-8");
    return res.end(renderClientScript());
  }
  if (req.method === "GET" && requestUrl.pathname === "/api/status") return json(res, 200, publicStatus());
  if (req.method !== "POST" || !authorizeMutation(req)) return json(res, 403, { message: "Kurulum isteği doğrulanamadı." });

  try {
    if (requestUrl.pathname === "/api/install") {
      startPnpmJob("dependencies", ["install", "--frozen-lockfile"], "Paket ve kütüphane kurulumu tamamlandı.");
      return json(res, 202, { message: "Paket kurulumu başlatıldı." });
    }
    if (requestUrl.pathname === "/api/wizard") {
      const current = inspectInstallationState(projectRoot);
      if (current.state === "installed") throw new Error("Uygulama zaten kurulu. Sihirbaz yeniden başlatılamaz.");
      if (!current.evidence.dependenciesInstalled) throw new Error("Önce paket kurulumunu tamamlayın.");
      wizardChild = startPnpmJob("wizard", ["--filter", "quiz-master-server", "setup"], "QuizMaster kurulumu tamamlandı.");
      wizardChild.once("close", () => { wizardChild = null; });
      return json(res, 202, { message: "Kurulum sihirbazı başlatılıyor." });
    }
    if (requestUrl.pathname === "/api/reset") {
      if (job.status === "running" || wizardChild) throw new Error("Çalışan kurulum işlemi varken temiz kurulum başlatılamaz.");
      const configuredPort = readConfiguredPort(projectRoot);
      if (await isLocalPortOpen(configuredPort)) throw new Error(`Uygulama ${configuredPort} portunda çalışıyor. Önce servisi durdurun.`);
      const payload = await readJson(req);
      const result = resetInstallation(projectRoot, payload);
      job.type = "reset";
      job.status = "success";
      job.message = "Doğrulanmış yedek alındı; temiz kurulum için ortam hazır.";
      job.logs = [`Yedek: ${result.backupRoot}`, `Doğrulanan dosya sayısı: ${result.files}`];
      return json(res, 200, { message: job.message, backupRoot: result.backupRoot, files: result.files });
    }
    return json(res, 404, { message: "Kurulum işlemi bulunamadı." });
  } catch (error) {
    return json(res, 409, { message: error instanceof Error ? error.message : "Kurulum işlemi tamamlanamadı." });
  }
}

function openBrowser(url) {
  if (process.argv.includes("--no-open")) return;
  try {
    let child;
    if (process.platform === "win32") child = spawn("cmd.exe", ["/d", "/s", "/c", "start", "", url], { detached: true, windowsHide: true, stdio: "ignore" });
    else if (process.platform === "darwin") child = spawn("open", [url], { detached: true, stdio: "ignore" });
    else if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child?.unref();
  } catch {
    // URL terminalde de gösterilir; tarayıcı açılması zorunlu değildir.
  }
}

if (process.argv.includes("--check-only")) {
  console.log(JSON.stringify(publicStatus(), null, 2));
  process.exit(0);
}

const runtime = runtimeStatus();
if (!runtime.nodeSupported || !runtime.pnpmSupported) {
  console.error(`Desteklenmeyen çalışma ortamı. Node.js: ${runtime.nodeVersion}; pnpm: ${runtime.pnpmVersion || "bulunamadı"}.`);
  console.error(`Node.js 22/24 LTS ve pnpm ${REQUIRED_PNPM_VERSION} gereklidir. Windows'ta kurulum.bat, Linux/macOS'ta ./kurulum.sh çalıştırın.`);
  process.exit(1);
}

server = http.createServer((req, res) => handler(req, res).catch((error) => json(res, 500, { message: error.message })));
server.listen(port, host, () => {
  const url = `http://${host}:${port}/setup?token=${token}`;
  console.log(`QuizMaster kurulum başlangıcı: ${url}`);
  console.log("Bu bağlantıyı paylaşmayın. Kurulum ekranı yalnız bu bilgisayardan erişilebilir.");
  openBrowser(url);
});

server.on("error", (error) => {
  console.error(`Kurulum başlangıç sunucusu açılamadı: ${error.message}`);
  process.exitCode = 1;
});
