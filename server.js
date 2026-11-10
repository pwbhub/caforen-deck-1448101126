'use strict';
// Caforen Node runtime: no third-party dependencies.
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'site-config.json');
const CREDS_FILE = path.join(DATA_DIR, 'admin-credentials.json');
const WEB_ROOTS = new Set(['css', 'js', 'pages', 'standalone']);
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};

// Optional straightforward .env support without npm install.
try {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (!m || Object.hasOwn(process.env, m[1])) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
} catch (err) { if (err.code !== 'ENOENT') throw err; }

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
if (!Number.isSafeInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error('Invalid PORT');
const SESSION_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
let creds;
let config = {};

function send(res, status, body, type = 'application/json; charset=utf-8', headers = {}) {
  res.writeHead(status, {'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store',...headers});
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
function fail(res, code, message) { send(res, code, {error: message}); }
function validConfig(o) {
  if (!o || Array.isArray(o) || typeof o !== 'object') return false;
  const allowed = new Set(['version','brand','login','saver','announcement','links','strips','routes','defaultRoute','colors','css','js','texts','scene','csv','session','security','meta']);
  return Object.keys(o).every(k=>allowed.has(k)) && (!o.routes || Array.isArray(o.routes)) && (!o.texts || Array.isArray(o.texts));
}
function publicConfig(c) {
  const copy = structuredClone(c);
  if (copy.security && typeof copy.security === 'object') delete copy.security.adminKey;
  return copy;
}
async function atomicJSON(filename, payload) {
  const tmp = filename + '.' + crypto.randomBytes(5).toString('hex') + '.tmp';
  try { await fsp.writeFile(tmp, JSON.stringify(payload, null, 2)+'\n', {mode:0o600,flag:'wx'}); await fsp.rename(tmp, filename); }
  finally { await fsp.rm(tmp, {force:true}).catch(()=>{}); }
}
function hashPassword(password, salt) { return crypto.scryptSync(password, Buffer.from(salt,'hex'), 64).toString('hex'); }
async function init() {
  await fsp.mkdir(DATA_DIR, {recursive:true, mode:0o700});
  try { config = JSON.parse(await fsp.readFile(CONFIG_FILE,'utf8')); } catch(err) { if(err.code!=='ENOENT')throw err; await atomicJSON(CONFIG_FILE, {}); }
  if (!validConfig(config)) throw new Error('Invalid stored site-config.json');
  const envPassword = process.env.CAFOREN_ADMIN_PASSWORD;
  if (envPassword && envPassword.length < 12) throw new Error('CAFOREN_ADMIN_PASSWORD must be at least 12 characters');
  if (envPassword) {
    // Password from .env overrides persisted credentials; .env is ignored by git.
    const salt = crypto.randomBytes(16).toString('hex');
    creds = {salt,hash:hashPassword(envPassword,salt)};
  } else {
    try { creds = JSON.parse(await fsp.readFile(CREDS_FILE,'utf8')); }
    catch(err) {
      if(err.code!=='ENOENT')throw err;
      const password = crypto.randomBytes(18).toString('base64url');
      const salt = crypto.randomBytes(16).toString('hex');
      creds = {salt,hash:hashPassword(password,salt)};
      await atomicJSON(CREDS_FILE, creds);
      process.stdout.write('\n[SETUP] First-run Node Admin password (save it now): '+password+'\n');
    }
  }
}
function parseCookies(req) {
  const match = /(?:^|;\s*)caforen_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie||'');
  return match ? match[1] : null;
}
function isAuthenticated(req) {
  const id = parseCookies(req);
  const entry = id && sessions.get(id);
  if (!entry) return false;
  if (entry.expires < Date.now()) {sessions.delete(id); return false;}
  entry.expires = Date.now() + SESSION_MS;
  return true;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser local CLI clients
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
async function bodyJSON(req, max=1024*1024) {
  let size=0; const chunks=[];
  for await (const chunk of req) { size+=chunk.length; if(size>max) throw Object.assign(new Error('Request is too large'),{status:413}); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'),{status:400}); }
}
function clientIP(req) { return req.socket.remoteAddress || 'unknown'; }
function checkAttempts(req) {
  const ip=clientIP(req); const entry=attempts.get(ip)||{count:0,reset:0};
  if(entry.reset<Date.now()) {entry.count=0;entry.reset=Date.now()+15*60*1000;}
  attempts.set(ip,entry);return entry;
}
async function staticFile(req,res,pathname) {
  if (req.method!=='GET' && req.method!=='HEAD') return fail(res,405,'Method not allowed');
  let relative;
  try { relative=decodeURIComponent(pathname); } catch {return fail(res,400,'Bad URL encoding');}
  if(relative==='/' ) relative='/index.html';
  const parts=relative.split('/').filter(Boolean);
  if(parts.some(p=>p.startsWith('.')||p==='..'||p.includes('\\')||p.includes('\0')))return fail(res,403,'Forbidden');
  if(parts.length!==1 && !WEB_ROOTS.has(parts[0]))return fail(res,404,'Not found');
  if(parts.length===1 && parts[0]!=='index.html')return fail(res,404,'Not found');
  const name=path.resolve(ROOT,'.'+relative);
  if(!name.startsWith(ROOT+path.sep))return fail(res,403,'Forbidden');
  try {
    const stat=await fsp.stat(name);
    if(!stat.isFile())return fail(res,404,'Not found');
    const ext=path.extname(name).toLowerCase();if(!MIME[ext])return fail(res,403,'Forbidden');
    const headers={'Content-Type':MIME[ext],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Length':stat.size};
    res.writeHead(200,headers);if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(name).on('error',()=>res.destroy()).pipe(res);
  } catch(err) { if(err.code==='ENOENT'||err.code==='EISDIR')return fail(res,404,'Not found');return fail(res,500,'Unable to read file'); }
}
async function handler(req,res) {
  const u = new URL(req.url, 'http://localhost');
  const p=u.pathname;
  if(p==='/api/health' && req.method==='GET')return send(res,200,{ok:true,app:'Caforen',runtime:'node',version:'1.0.0'});
  if(p==='/js/data/site-config.js' && req.method==='GET') {
    return send(res,200,'window.CA_SITE_CONFIG='+JSON.stringify(publicConfig(config)).replace(/</g,'\\u003c')+';\n','text/javascript; charset=utf-8');
  }
  if(p==='/api/config' && req.method==='GET')return send(res,200,publicConfig(config));
  if(p==='/api/admin/session' && req.method==='GET')return send(res,200,{authenticated:isAuthenticated(req)});
  if(p==='/api/admin/login' && req.method==='POST') {
    if(!sameOrigin(req))return fail(res,403,'Invalid origin');
    const guard=checkAttempts(req);
    if(guard.count>=8)return fail(res,429,'Too many attempts. Try again in 15 minutes.');
    const body=await bodyJSON(req,4096);
    const supplied=typeof body.password==='string' ? body.password : '';
    const check=hashPassword(supplied,creds.salt);
    if(!crypto.timingSafeEqual(Buffer.from(check,'hex'),Buffer.from(creds.hash,'hex'))){guard.count++;return fail(res,401,'Invalid password');}
    guard.count=0;
    const id=crypto.randomBytes(32).toString('base64url');
    sessions.set(id,{expires:Date.now()+SESSION_MS});
    const secure = req.socket.encrypted || (process.env.TRUST_HTTPS_PROXY==='1' && req.headers['x-forwarded-proto']==='https');
    const cookie='caforen_session='+id+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(secure?'; Secure':'');
    return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':cookie});
  }
  if(p==='/api/admin/logout' && req.method==='POST') {
    if(!sameOrigin(req))return fail(res,403,'Invalid origin');
    sessions.delete(parseCookies(req));
    return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':'caforen_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  }
  if(p==='/api/admin/config' && req.method==='PUT') {
    if(!sameOrigin(req))return fail(res,403,'Invalid origin');
    if(!isAuthenticated(req))return fail(res,401,'Node Admin login required');
    const incoming=await bodyJSON(req);
    if(!validConfig(incoming))return fail(res,422,'Unsupported configuration shape');
    // Browser-side key hashes must never be served as a shared security credential.
    const next=publicConfig(incoming);
    next.meta={...((next.meta && typeof next.meta==='object')?next.meta:{}),updatedAt:Date.now(),updatedBy:'node-admin'};
    await atomicJSON(CONFIG_FILE,next);
    config=next;
    return send(res,200,{ok:true,updatedAt:next.meta.updatedAt});
  }
  if(p==='/node-admin' && req.method==='GET') {
    const html=await fsp.readFile(path.join(ROOT,'node-admin.html'),'utf8');
    return send(res,200,html,'text/html; charset=utf-8');
  }
  if(p.startsWith('/api/'))return fail(res,404,'API not found');
  return staticFile(req,res,p);
}
async function start() {
  await init();
  const server=http.createServer((req,res)=>{handler(req,res).catch(err=>{console.error('[HTTP]',err); if(!res.headersSent)fail(res,err.status||500,err.status?err.message:'Internal server error');else res.destroy();});});
  server.listen(PORT,HOST,()=>console.log('Caforen Node running: http://'+HOST+':'+server.address().port+'\nNode Admin: http://'+HOST+':'+server.address().port+'/node-admin'));
  return server;
}
if(require.main===module)start().catch(err=>{console.error(err);process.exitCode=1;});
module.exports={start,validConfig,publicConfig};
