// Kurulum başlatıcısı (5049) ile sihirbaz (rastgele loopback port) arasında dar bir HTTP aktarıcı.
// Amaç: kullanıcı tek porta, tek URL'ye ve tek oturuma bakar. Yeni saldırı yüzeyi olduğu için
// yalnız beyaz listedeki yolları, yalnız 127.0.0.1 hedefine, sınırlı gövdeyle ve yönlendirme izlemeden aktarır.
import http from 'node:http';

export const PROXY_PREFIX = '/wizard';
export const MAX_BODY_BYTES = 64 * 1024; // sihirbazın express.json({ limit: "64kb" }) sınırıyla aynı

// [yöntem, başlatıcıdaki yol, sihirbazdaki yol]
const ROUTES = [
  ['GET', `${PROXY_PREFIX}`, '/setup'],
  ['GET', `${PROXY_PREFIX}/api/status`, '/api/status'],
  ['GET', `${PROXY_PREFIX}/api/app-health`, '/api/app-health'],
  ['POST', `${PROXY_PREFIX}/api/apply`, '/api/apply'],
  ['POST', `${PROXY_PREFIX}/api/start-app`, '/api/start-app'],
];

// Sihirbaza iletilecek istek başlıkları (beyaz liste). Host ve Origin değiştirilmez:
// sihirbazın sameOrigin denetimi başlatıcı adresi üzerinden aynen geçer.
const FORWARD_HEADERS = ['host', 'origin', 'content-type', 'x-setup-csrf', 'accept', 'accept-language', 'user-agent'];
const DROP_RESPONSE_HEADERS = new Set(['set-cookie', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate']);

export function matchRoute(method, pathname) {
  return ROUTES.find(([m, from]) => m === method && from === pathname) || null;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { if (!tooBig) { tooBig = true; reject(Object.assign(new Error('İstek gövdesi çok büyük.'), { statusCode: 413 })); } return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function reply(res, status, message) {
  if (res.headersSent) { res.end(); return; }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  if (status === 413) res.setHeader('connection', 'close');
  res.end(JSON.stringify({ message }), () => { if (status === 413) res.req?.destroy(); });
}

/**
 * Sihirbaz isteklerini aktarır.
 * @param {{ getTarget: () => ({ port: number, cookie: string } | null), timeoutMs?: number }} options
 * @returns {(req, res, pathname) => Promise<boolean>} yol bu aktarıcıya aitse true (yanıt verilmiştir)
 *
 * Kimlik doğrulama çağıranın işidir: bu işlev yalnız doğrulanmış isteklerle çağrılmalıdır.
 */
export function createWizardProxy({ getTarget, timeoutMs = 60_000 }) {
  return async function proxy(req, res, pathname) {
    if (pathname !== PROXY_PREFIX && !pathname.startsWith(`${PROXY_PREFIX}/`)) return false;
    const route = matchRoute(req.method || '', pathname);
    if (!route) { reply(res, 404, 'Kurulum sihirbazı yolu bulunamadı.'); return true; }
    const target = getTarget();
    if (!target) { reply(res, 503, 'Kurulum sihirbazı henüz hazır değil veya kapandı.'); return true; }

    let body = Buffer.alloc(0);
    if (route[0] === 'POST') {
      try { body = await readBody(req, MAX_BODY_BYTES); } catch (error) { reply(res, error.statusCode || 400, error.message); return true; }
    }

    const headers = {};
    for (const name of FORWARD_HEADERS) if (req.headers[name] !== undefined) headers[name] = req.headers[name];
    // Sihirbaz kimliği yalnızca sunucu tarafında eklenir; tarayıcı tek (başlatıcı) cookie'sini görür.
    headers.cookie = target.cookie;
    if (route[0] === 'POST') headers['content-length'] = String(body.length);

    await new Promise(resolve => {
      const upstream = http.request({ host: '127.0.0.1', port: target.port, method: route[0], path: route[2], headers, timeout: timeoutMs }, response => {
        // Yönlendirmeler izlenmez; olduğu gibi (Set-Cookie hariç) iletilir.
        res.statusCode = response.statusCode || 502;
        for (const [name, value] of Object.entries(response.headers)) {
          if (!DROP_RESPONSE_HEADERS.has(name) && value !== undefined) res.setHeader(name, value);
        }
        response.pipe(res);
        response.on('end', resolve);
        response.on('error', () => { res.destroy(); resolve(); });
      });
      upstream.on('timeout', () => { upstream.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })); });
      upstream.on('error', () => { reply(res, 502, 'Kurulum sihirbazına ulaşılamadı.'); resolve(); });
      upstream.end(body);
    });
    return true;
  };
}
