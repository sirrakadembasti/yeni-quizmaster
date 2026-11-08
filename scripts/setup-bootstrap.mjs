import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEFAULT_MANAGER, createInvocation, detectInstalledManager, detectVersion, hasLegacyPnpmTree } from './package-manager.mjs';
import { createWizardProxy, PROXY_PREFIX } from './setup-proxy.mjs';
import {
  CLEAN_INSTALL_CONFIRMATION,
  describePortConflict,
  inspectInstallationState,
  isLocalPortOpen,
  readConfiguredPort,
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

// Sihirbaza ancak bu oturumda paket kurulumu doğrulanınca geçilebilir.
let packagesReady = false;

let wizardChild = null;
// Sihirbaz rastgele bir loopback portta çalışır; tarayıcı yalnız bu başlatıcının portunu görür.
let wizardTarget = null;
let server;

// Arayüzde sunulan yöneticiler: npm 11+ (varsayılan, package-lock.json ile) ve Bun (deneysel).
const UI_MANAGERS = ["npm", "bun"];
// Önerilen yönetici: bu dizinde kurulu olan > npm 11+ > Bun > npm (hiçbiri yoksa).
// (Eski pnpm kurulumları npm'e geçer; npm ci node_modules'ü yeniden kurar.)
function preferredManager() {
  const installed = detectInstalledManager(projectRoot);
  if (installed) return installed;
  const runtime = runtimeStatus();
  if (runtime.npmSupported) return "npm";
  if (runtime.bunSupported) return "bun";
  return DEFAULT_MANAGER;
}

// Öncelik: arayüz seçimi > QUIZMASTER_PM > önerilen.
function chooseManager(requested) {
  if (UI_MANAGERS.includes(requested)) return requested;
  if (UI_MANAGERS.includes(process.env.QUIZMASTER_PM)) return process.env.QUIZMASTER_PM;
  return preferredManager();
}

// npm yalnız 11 ve üstünde desteklenir (Node 22 ile gelen npm 10 desteklenmez).
function assertManagerUsable(manager) {
  if (manager !== "npm") return;
  const runtime = runtimeStatus();
  if (!runtime.npmSupported) {
    throw new Error(`npm ${runtime.minNpmMajor} veya üstü gerekli (bulunan: ${runtime.npmVersion || "yok"}). npm'i güncelleyin: npm install -g npm@${runtime.minNpmMajor}`);
  }
}

let runtimeSnapshot;
function runtimeStatus() {
  // Status polling must not start synchronous package-manager processes on every request.
  // Runtime versions are fixed for this bootstrap session; installation/job
  // state is still read afresh by publicStatus().
  return runtimeSnapshot ??= validateRuntime(process.version, detectVersion("npm") ?? "", detectVersion("bun") ?? "");
}

function appendLog(chunk) {
  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  for (const line of text.split(/[\r\n]+/).filter(Boolean)) job.logs.push(line.slice(0, 1000));
  job.logs = job.logs.slice(-250);
}

function startPackageJob(type, op, successMessage, manager = "npm") {
  if (job.status === "running") throw new Error("Başka bir kurulum işlemi halen çalışıyor.");
  let invocation;
  if (type === 'upgrade') {
    invocation = {command:process.execPath,args:[path.join(scriptRoot,'upgrade.mjs'),'--project',projectRoot,'--parent-lease']};
  } else {
    // Yönetici açık seçimden gelir; alt süreçler de QUIZMASTER_PM ile aynı seçimi görür.
    invocation = createInvocation(manager, op, { root: projectRoot, env: process.env });
  }
  job.type = type;
  job.status = "running";
  job.message = type === "dependencies" ? (manager === "bun" ? "Bun ile paketler hazırlanıyor..." : "Paketler ve kütüphaneler hazırlanıyor...") : type === "upgrade" ? "Mevcut kurulum yedeklenip güncelleniyor..." : "Kurulum sihirbazı başlatılıyor...";
  job.logs = [];
  job.exitCode = null;
  job.wizardUrl = null;
  if (type === "wizard") {
    console.log("");
    console.log("Sihirbaz başlatılıyor. Terminal açık kalmalı; sihirbaz bu sürecin altındadır.");
  }

  const childEnv = { ...process.env, FORCE_COLOR: "0", QUIZMASTER_PM: manager };
  if (type === "dependencies") childEnv.CI = "true";
  let wizardSession = null;
  if (type === "wizard") {
    // Sihirbaz boş bir portta açılır (SETUP_PORT=0) ve kendi anahtarını bu süreçten alır;
    // tarayıcı çerezi sunucu tarafında bu anahtardan türetilir (bkz. createWizardProxy).
    const wizardToken = crypto.randomBytes(24).toString("base64url");
    wizardSession = crypto.createHmac("sha256", wizardToken).update("quizmaster-setup-session").digest("hex");
    childEnv.SETUP_PORT = "0";
    childEnv.SETUP_TOKEN = wizardToken;
    childEnv.SETUP_API_BASE = PROXY_PREFIX;
  }

  const child = spawn(invocation.command, invocation.args, {
    cwd: invocation.cwd ?? projectRoot,
    env: childEnv,
    windowsHide: true,
    shell: false,
  });
  child.stdin.on('error', () => {});
  child.stdout.on("data", (chunk) => {
    appendLog(chunk);
    if (type === "wizard") {
      const match = chunk.toString("utf8").match(/http:\/\/127\.0\.0\.1:(\d+)\/setup\?token=[A-Za-z0-9_-]+/);
      if (match) {
        wizardTarget = { port: Number(match[1]), cookie: `quizmaster.setup=${wizardSession}` };
        job.wizardUrl = PROXY_PREFIX;
        job.message = "Ana kurulum sihirbazı hazır. Terminali açık tutun; sihirbaz bu süreçte çalışır.";
      }
    }
  });
  child.stderr.on("data", appendLog);
  child.once("error", (error) => {
    job.status = "error";
    job.message = `İşlem başlatılamadı: ${error.message}`;
  });
  child.once("close", (code) => {
    if (type === "wizard") wizardTarget = null;
    job.exitCode = code;
    if (code === 0) {
      job.status = "success";
      job.message = successMessage;
      if (type === "dependencies") {
        const deps = inspectInstallationState(projectRoot).dependencies;
        packagesReady = deps.ready;
        if (!packagesReady) {
          job.status = "error";
          job.message = "Paket kurulumu bitti ancak doğrulama eksik. 'Paketleri Kur / Onar' ile tekrar deneyin.";
        }
      }
      if (type === "wizard") {
        console.log("");
        console.log("Kurulum sihirbazı tamamlandı. Başlatıcı birkaç saniye içinde kapanacak.");
        console.log("Bu terminal kapandıktan sonra kurulum betiğine yeniden gerek yoktur.");
        setTimeout(() => {
          server?.close();
          setTimeout(() => process.exit(0), 200);
        }, 1500);
      }
    } else {
      job.status = "error";
      job.message = `İşlem ${code ?? "bilinmeyen"} çıkış koduyla başarısız oldu.`;
      if (type === "dependencies") packagesReady = false;
      if (type === "wizard") {
        console.log("");
        console.log("Sihirbaz kapandı. Başlatıcı açık kaldı; loglar yukarıda görünür.");
        console.log("Gerekirse tekrar deneyin veya temiz kurulum yapın.");
      }
    }
  });
  return child;
}

const startUpgradeJob = (successMessage) => startPackageJob("upgrade", null, successMessage, chooseManager());

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
    packagesReady,
    bootstrapPort: port,
    // pnpm kaldırıldı: eski pnpm ağacı varsa npm ci node_modules'ü silip yeniden kurar.
    legacyPnpm: hasLegacyPnpmTree(projectRoot),
    configuredPort: readConfiguredPort(projectRoot),
  };
}

function renderClientScript() {
  return String.raw`
const CSRF=document.querySelector('meta[name="setup-csrf"]').content;
const REQUIRED_CONFIRMATION=document.querySelector("main").dataset.confirmation;
const byId=id=>document.getElementById(id);
async function api(url,options={}){options.headers={"Content-Type":"application/json","X-Setup-CSRF":CSRF,...options.headers};const r=await fetch(url,options);const data=await r.json();if(!r.ok){const err=new Error(data.message||"İşlem başarısız");err.data=data;throw err}return data}
function evidenceLabel(e){return Object.entries(e).filter(([,v])=>v).map(([k])=>({installationLock:"Kurulum kilidi",environmentFile:"Ortam dosyası",applicationDatabase:"Uygulama veritabanı",sessionDatabase:"Oturum veritabanı",deploymentConfig:"Dağıtım profili",pendingInstallation:"Yarım işlem",uploadedFiles:"Yüklenen dosyalar",dependenciesInstalled:"Paketler"}[k]||k)).join(", ")||"Kurulum verisi yok"}
let notice=null;
function notify(text,kind){notice={text:String(text),kind:kind||"error",until:Date.now()+15000};applyNotice()}
function applyNotice(){if(notice&&Date.now()<notice.until){byId("message").textContent=notice.text;byId("message").className=notice.kind}else{notice=null}}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function render(s){const i=s.installation,r=s.runtime,j=s.job,ready=!!s.packagesReady,installed=i.state==="installed",running=j.status==="running";byId("summary").innerHTML='<div class="metric">Node.js<b>'+escapeHtml(r.nodeVersion||"Bulunamadı")+' '+(r.nodeSupported?"✓":"✕")+'</b></div><div class="metric">npm (11+)<b>'+escapeHtml(r.npmVersion||"Bulunamadı")+' '+(r.npmSupported?"✓":"✕")+'</b></div><div class="metric">Bun (Deneysel)<b>'+escapeHtml(r.bunVersion?(r.bunVersion+" (Hazır)"):"Kurulu değil")+' '+(r.bunSupported?"✓":"—")+'</b></div><div class="metric">Dizin<b>'+escapeHtml(s.directory)+'</b></div><div class="metric">Bulunanlar<b>'+escapeHtml(evidenceLabel(i.evidence))+'</b></div><div class="metric">Paket adımı<b>'+(installed?'Güncelleme paket adımını içerir':ready?'Bu oturumda tamamlandı ✓':'Önce “Paketleri Kur / Onar” ✕')+'</b></div>';const names={fresh:"Yeni kurulum",partial:"Yarım/eski kurulum",installed:"Uygulama zaten kurulu"};byId("state").textContent=names[i.state];byId("state").className="state "+(i.state==="fresh"?"ok":"warn");let tip=j.message;if(installed){tip=j.type==="upgrade"?j.message:"Uygulama kurulu. Servisi durdurup “Mevcut Kurulumu Güncelle” ile verileri koruyarak güncelleyebilirsiniz."}else if(running){tip=j.message}else if(!ready){tip=i.evidence.dependenciesInstalled?"Paketler diskte var; sihirbaza geçmek için önce “Paketleri Kur / Onar” adımını çalıştırın.":"Önce “Paketleri Kur / Onar” ile paketleri kurun."}else{tip="Paket adımı tamam. Kurulum sihirbazına geçebilirsiniz."}if(s.legacyPnpm&&!running&&!ready){tip+=" Not: Eski pnpm kurulumu bulundu; pnpm artık desteklenmiyor, paket adımı node_modules klasörünü silip npm ile yeniden kurar."}byId("message").textContent=tip;byId("message").className=j.status==="error"?"error":j.status==="success"?"success":"muted";applyNotice();byId("logs").textContent=j.logs.length?j.logs.join("\n"):"Henüz işlem çıktısı yok.";byId("logs").scrollTop=byId("logs").scrollHeight;byId("danger").classList.toggle("hidden",i.state==="fresh");const wizard=byId("wizard");wizard.disabled=installed||running||!ready;if(installed){wizard.title="Uygulama zaten kurulu; sihirbaz kapalı. Temiz kurulum gerekir."}else if(!ready){wizard.title="Önce paket kurulum adımını tamamlayın."}else{wizard.title="Kurulum sihirbazını başlat"}byId("install").disabled=running;byId("upgrade").disabled=!installed||running;if(!installed&&j.wizardUrl)location.href=j.wizardUrl}
let refreshPending=null;function refresh(){if(refreshPending)return refreshPending;refreshPending=(async()=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);try{render(await api("/api/status",{signal:controller.signal}))}catch(e){byId("message").textContent=e.message;byId("message").className="error"}finally{clearTimeout(timer);refreshPending=null}})();return refreshPending}
byId("upgrade").onclick=async()=>{try{await api("/api/upgrade",{method:"POST",body:"{}"});refresh()}catch(e){notify(e.message)}};
byId("install").onclick=async()=>{try{const sel=byId("pkgManager");const manager=sel?sel.value:"npm";await api("/api/install",{method:"POST",body:JSON.stringify({packageManager:manager})});refresh()}catch(e){notify(e.message)}};
byId("wizard").onclick=async()=>{
  const sel=byId("pkgManager");
  const manager=sel?sel.value:"npm";
  try{
    await api("/api/wizard",{method:"POST",body:JSON.stringify({packageManager:manager})});
    refresh();
  }catch(e){
    notify(e.message);
    refresh();
  }
};
byId("refresh").onclick=refresh;
let resetArmedUntil=0;
const RESET_LABEL=byId("reset").textContent;
function disarmReset(){resetArmedUntil=0;byId("reset").textContent=RESET_LABEL}
byId("reset").onclick=async()=>{
  if(!byId("backupAck").checked||byId("confirmation").value!==REQUIRED_CONFIRMATION){disarmReset();notify("Yedek onayı ve doğrulama metni eksik.");return}
  if(Date.now()>=resetArmedUntil){
    resetArmedUntil=Date.now()+10000;
    byId("reset").textContent="Emin misiniz? Onaylamak için tekrar tıklayın";
    notify("Bu işlem mevcut QuizMaster verilerini aktif kurulumdan kaldıracaktır. Devam etmek için 10 saniye içinde düğmeye tekrar tıklayın.","warn");
    setTimeout(()=>{if(resetArmedUntil&&Date.now()>=resetArmedUntil){disarmReset();notice=null}},10100);
    return;
  }
  disarmReset();
  try{
    const data=await api("/api/reset",{method:"POST",body:JSON.stringify({backupAcknowledged:true,confirmation:byId("confirmation").value})});
    byId("confirmation").value="";byId("backupAck").checked=false;
    notify("Yedek oluşturuldu: "+data.backupRoot,"success");
    refresh();
  }catch(e){notify(e.message)}
};
refresh();setInterval(refresh,1000);
`;
}

function managerOptions() {
  const preferred = preferredManager();
  const labels = { npm: "npm (11 ve üstü — varsayılan)", bun: "Bun (Deneysel — CLI kurulumu doğrulandı)" };
  return ["npm", "bun"].map((name) => `<option value="${name}"${name === preferred ? " selected" : ""}>${labels[name]}</option>`).join("");
}

function renderPage() {
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="setup-csrf" content="${csrfValue}">
<title>QuizMaster Kurulum Başlatıcısı</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#141b2d;--line:#2b3650;--text:#f7f8fc;--muted:#aeb9ce;--brand:#7867ff;--ok:#2fd69f;--warn:#ffb84d;--danger:#ff5f68}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#1a2040,var(--bg) 45%);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{width:min(980px,calc(100% - 32px));margin:32px auto}.hero,.card{background:rgba(20,27,45,.96);border:1px solid var(--line);border-radius:18px;padding:24px;box-shadow:0 18px 60px #0005}.hero h1{margin:0 0 8px;font-size:30px}.hero p,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin:18px 0}.metric{background:#0e1527;border:1px solid var(--line);border-radius:14px;padding:14px}.metric b{display:block;margin-top:4px}.card{margin-top:18px}.state{display:inline-flex;border-radius:999px;padding:6px 11px;font-weight:700;background:#2a3150}.state.ok{color:var(--ok)}.state.warn{color:var(--warn)}button{border:0;border-radius:12px;padding:12px 16px;background:var(--brand);color:white;font-weight:750;cursor:pointer}button.secondary{background:#27314a}button.danger{background:var(--danger)}button:disabled{opacity:.45;cursor:not-allowed}.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px}pre{min-height:160px;max-height:320px;overflow:auto;background:#080d19;border:1px solid var(--line);border-radius:12px;padding:14px;white-space:pre-wrap;color:#ced8ea}.danger-zone{border-color:#6d3238}.danger-zone input[type=text]{width:100%;background:#0b1120;border:1px solid #6d4248;color:white;border-radius:10px;padding:11px;margin:10px 0}.hidden{display:none}.error{color:#ff9da3}.success{color:var(--ok)}.warn{color:var(--warn)}code{color:#d9d3ff}@media(max-width:600px){.wrap{width:min(100% - 18px,980px);margin:10px auto}.hero,.card{padding:17px}}
</style></head><body><main class="wrap" data-confirmation="${CLEAN_INSTALL_CONFIRMATION}">
<section class="hero"><h1>QuizMaster Kurulum Başlatıcısı</h1><p>Ön kontrol, paket kurulumu ve güvenli ilk yapılandırma tek akışta yürütülür.</p><div id="summary" class="grid"></div><span id="state" class="state">Denetleniyor</span></section>
<section class="card"><h2>Kurulum işlemleri</h2><p id="message" class="muted">Durum okunuyor...</p><div class="actions"><label id="pkgManagerWrap" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:8px 12px;background:#0e1527;border:1px solid var(--line);border-radius:12px;">Paket Yöneticisi: <select id="pkgManager" style="background:#141b2d;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:4px 8px;font:inherit;">${managerOptions()}</select></label><button id="install">Paketleri Kur / Onar</button><button id="wizard" class="secondary">Kurulum Sihirbazına Geç</button><button id="upgrade" class="secondary" disabled>Mevcut Kurulumu Güncelle</button><button id="refresh" class="secondary">Yeniden Denetle</button></div><pre id="logs">Henüz işlem çıktısı yok.</pre></section>
<section id="danger" class="card danger-zone hidden"><h2>Temiz kurulum</h2><p class="error"><strong>Dikkat:</strong> Kullanıcılar, sınavlar, anketler, sonuçlar, oturumlar, yapılandırma ve yüklenen dosyalar aktif kurulumdan kaldırılır. Önce doğrulanmış, tarihli yedek alınır.</p><label><input id="backupAck" type="checkbox"> Zorunlu yedek alınacağını ve uygulamanın durdurulması gerektiğini anlıyorum.</label><p>Devam etmek için <code>${CLEAN_INSTALL_CONFIRMATION}</code> yazın:</p><input id="confirmation" type="text" autocomplete="off"><button id="reset" class="danger">Yedekle ve Temiz Kuruluma Geç</button></section>
</main><script src="/bootstrap.js" defer></script></body></html>`;
}

const wizardProxy = createWizardProxy({ getTarget: () => wizardTarget });

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
  // Sihirbaz yolları (/wizard…): kimlik doğrulandı; değiştirici istekler ayrıca aynı origin olmalıdır.
  if (requestUrl.pathname === PROXY_PREFIX || requestUrl.pathname.startsWith(`${PROXY_PREFIX}/`)) {
    if (req.method !== "GET" && !sameOrigin(req)) return json(res, 403, { message: "Kurulum isteği doğrulanamadı." });
    if (await wizardProxy(req, res, requestUrl.pathname)) return;
  }
  if (req.method === "GET" && requestUrl.pathname === "/setup") {
    securityHeaders(res, "text/html; charset=utf-8");
    return res.end(renderPage());
  }
  if (req.method === "GET" && requestUrl.pathname === "/bootstrap.js") {
    securityHeaders(res, "application/javascript; charset=utf-8");
    return res.end(renderClientScript());
  }
  if (req.method === "GET" && requestUrl.pathname === "/api/status") {
    // Active authorized polling keeps long install/build jobs observable.
    // Unauthenticated requests were rejected above and never receive a cookie.
    res.setHeader("Set-Cookie", `quizmaster.bootstrap=${encodeURIComponent(sessionValue)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`);
    return json(res, 200, publicStatus());
  }
  if (req.method !== "POST" || !authorizeMutation(req)) return json(res, 403, { message: "Kurulum isteği doğrulanamadı." });

  try {
    if (requestUrl.pathname === "/api/install") {
      const payload = await readJson(req).catch(() => ({}));
      const manager = chooseManager(payload?.packageManager);
      assertManagerUsable(manager);
      const successMessage = manager === "bun" ? "Bun ile paket ve kütüphane kurulumu tamamlandı." : "Paket ve kütüphane kurulumu tamamlandı.";
      // Bun için kilit dosyası depoda tutulmaz (bun.lock yok sayılır); donmuş kurulum yalnız npm içindir.
      startPackageJob("dependencies", { type: "install", frozen: manager !== "bun" }, successMessage, manager);
      return json(res, 202, { message: `Paket kurulumu (${manager}) başlatıldı.` });
    }
    if (requestUrl.pathname === "/api/upgrade") {
      if (inspectInstallationState(projectRoot).state !== "installed") throw new Error("Güncelleme yalnız kurulu sistemde kullanılabilir.");
      await readJson(req);
      startUpgradeJob("Yedek, derleme ve migration tamamlandı. Servisi yeniden başlatıp web arayüzündeki Sunucu Durumu ve girişi doğrulayın.");
      return json(res, 202, { message: "Veriler korunarak güncelleme başlatıldı." });
    }
    if (requestUrl.pathname === "/api/wizard") {
      const current = inspectInstallationState(projectRoot);
      if (current.state === "installed") throw new Error("Uygulama zaten kurulu (installation.lock var). Yeniden kurulum için önce 'Yedekle ve Temiz Kuruluma Geç' ile sıfırlayın.");
      if (!current.evidence.dependenciesInstalled) throw new Error("Paketler eksik. Önce 'Paketleri Kur / Onar' adımını tamamlayın.");
      if (!packagesReady) throw new Error("Sihirbaza geçmek için önce bu ekranda 'Paketleri Kur / Onar' adımını çalıştırıp bitirin.");
      const payload = await readJson(req);
      if (wizardChild) throw new Error("Kurulum sihirbazı zaten çalışıyor.");
      const manager = chooseManager(payload?.packageManager);
      assertManagerUsable(manager);
      wizardChild = startPackageJob("wizard", { type: "run", workspace: "server", script: "setup" }, "QuizMaster kurulumu tamamlandı.", manager);
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
if (!runtime.nodeSupported || (!runtime.npmSupported && !runtime.bunSupported)) {
  console.error(`Desteklenmeyen çalışma ortamı. Node.js: ${runtime.nodeVersion}; npm: ${runtime.npmVersion || "bulunamadı"}; bun: ${runtime.bunVersion || "bulunamadı"}.`);
  console.error(`Node.js 22/24 LTS ve npm 11 veya üstü (ya da deneysel Bun) gereklidir; Node.js 22 ile gelen npm 10 için: npm install -g npm@11. Windows'ta kurulum.bat, Linux/macOS'ta ./kurulum.sh çalıştırın.`);
  process.exit(1);
}

server = http.createServer((req, res) => handler(req, res).catch((error) => json(res, 500, { message: error.message })));

function reportListenFailure(error) {
  if (error && (error.code === "EADDRINUSE" || /EADDRINUSE|address already in use/i.test(String(error.message || error)))) {
    console.error(describePortConflict(port).message);
  } else {
    console.error(`Kurulum başlangıç sunucusu açılamadı: ${error?.message || error}`);
    console.error("");
    console.error("Yapılması gerekenler:");
    console.error("  1. Aynı anda açık ikinci bir kurulum başlatıcısı olmadığından emin olun.");
    console.error("  2. Antivirüs / güvenlik duvarının yerel 127.0.0.1 bağlantılarını engellemediğini doğrulayın.");
    console.error("  3. kurulum.bat dosyasını yeniden çalıştırın.");
    console.error("");
    console.error("Not: Kurulum verileri bu hata nedeniyle değiştirilmez.");
  }
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
}

server.on("error", reportListenFailure);

isLocalPortOpen(port, 400).then((occupied) => {
  if (occupied) {
    reportListenFailure(Object.assign(new Error(`listen EADDRINUSE: address already in use 127.0.0.1:${port}`), { code: "EADDRINUSE" }));
    return;
  }
  server.listen(port, host, () => {
    const url = `http://${host}:${port}/setup?token=${token}`;
    console.log(`QuizMaster kurulum başlangıcı: ${url}`);
    console.log("Bu bağlantıyı paylaşmayın. Kurulum ekranı yalnız bu bilgisayardan erişilebilir.");
    console.log("");
    console.log("Önemli: Bu terminali sihirbaz bitene kadar KAPATMAYIN.");
    console.log("Sihirbaz bu sürecin altında çalışır; terminal kapanırsa kurulum yarıda kalır.");
    console.log("Sihirbaz başarıyla biterse başlatıcı otomatik kapanır.");
    openBrowser(url);
  });
});
