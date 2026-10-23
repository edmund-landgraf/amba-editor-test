// Dev server: serves the editor statically and proxies /api/pf2/* -> PF2E_API_BASE/api/*.
// Usage: node dev-server.js   (env: PORT=8080, PF2E_API_BASE=http://localhost:3333)
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // prod: 127.0.0.1 behind nginx
const TARGET = new URL((process.env.PF2E_API_BASE || process.env.PF2_API_BASE || 'http://localhost:3333').replace(/\/api\/?$/, ''));
const ROOT = __dirname;
// Load gitignored .env.local (KEY=VALUE lines) so PF2_ART_PASSWORD survives restarts. Shell env wins; values never logged.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}
console.log('[art] PF2_ART_PASSWORD ' + (process.env.PF2_ART_PASSWORD ? 'set' : 'NOT set (add it to .env.local)'));
// Optional art unlock: if PF2_ART_PASSWORD is set in the launching shell, unlock art server-side and keep
// the art cookie in memory. It is attached ONLY to proxied GET image routes; browser cookies are never forwarded.
const IMAGE_ROUTE = /^\/api\/pf2\/(monsters|user-monsters)\/-?\d+\/image(\/thumb)?$/;
let artCookie = null, unlocking = null;
function unlockArt() {
  if (!process.env.PF2_ART_PASSWORD) return Promise.resolve(null);
  if (unlocking) return unlocking;
  unlocking = new Promise(resolve => {
    const body = JSON.stringify({ password: process.env.PF2_ART_PASSWORD });
    const r = http.request({ hostname: TARGET.hostname, port: TARGET.port || 80, method: 'POST', path: '/api/art/unlock',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
      res.resume();
      const sc = [].concat(res.headers['set-cookie'] || []).map(c => c.split(';')[0]).filter(Boolean);
      artCookie = res.statusCode === 200 && sc.length ? sc.join('; ') : null;
      console.log('[art] unlock ' + (artCookie ? 'ok' : 'failed (status ' + res.statusCode + ')'));
      resolve(artCookie);
    });
    r.on('error', e => { console.log('[art] unlock error: ' + e.message); resolve(null); });
    r.end(body);
  }).finally(() => { unlocking = null; });
  return unlocking;
}
function proxy(u, res, isImage, retried) {
  const headers = { accept: isImage ? 'image/*' : 'application/json' };
  if (isImage && artCookie) headers.cookie = artCookie;
  const p = http.request({ hostname: TARGET.hostname, port: TARGET.port || 80, method: 'GET',
    path: '/api/' + u.pathname.slice('/api/pf2/'.length) + u.search, headers }, r => {
    if (isImage && !retried && (r.statusCode === 401 || r.statusCode === 404) && process.env.PF2_ART_PASSWORD) {
      r.resume(); return unlockArt().then(() => proxy(u, res, true, true));
    }
    const h = { 'content-type': r.headers['content-type'] || 'application/json' };
    if (isImage && r.headers['cache-control']) h['cache-control'] = r.headers['cache-control'];
    res.writeHead(r.statusCode, h); r.pipe(res);
  });
  p.on('error', e => { res.writeHead(502); res.end(JSON.stringify({ error: 'pf2 api unreachable', detail: e.message })); });
  p.end();
}
// Read-only WG preview proxy: GET /api/wg/<type>?id=|name= -> POST WG_API_BASE/find-<fn> (AMBA wgFindFunction mapping).
// Default target is AMBA's DEFAULT_WG_DOCKER_API_BASE. No cookies/auth headers forwarded either way.
const WG_BASE = new URL((process.env.WG_API_BASE_URL || 'http://localhost:8000/functions/v1').replace(/\/$/, '') + '/');
// Runtime source = WG edge functions only (the same find-* + params WG's fetchContent uses; content-store.ts FETCH_REQUEST_MAP).
// No runtime Postgres: in prod WG lives on another box. WG_SOURCE defaults to (and only supports) 'gateway'.
const WG_SOURCE = process.env.WG_SOURCE || 'gateway';
if (WG_SOURCE !== 'gateway') console.log('[wg] WG_SOURCE=' + WG_SOURCE + ' ignored: runtime lookups always use the edge functions');
function edge(fn, body) {
  return new Promise((ok, no) => {
    const b = JSON.stringify(body);
    const p = http.request(new URL(fn, WG_BASE), { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b), accept: 'application/json' } }, r => {
      let s = ''; r.setEncoding('utf8'); r.on('data', c => (s += c));
      r.on('end', () => { try { const j = JSON.parse(s); r.statusCode < 300 ? ok(j) : no(new Error(fn + ' HTTP ' + r.statusCode)); } catch { no(new Error(fn + ' bad JSON, HTTP ' + r.statusCode)); } });
    });
    p.setTimeout(30000, () => p.destroy(new Error(fn + ' timeout'))); p.on('error', no); p.end(b);
  });
}
const ttlA = (ms, fn) => { let v, t = 0, pend; return async () => { if (v && Date.now() - t < ms) return v; if (!pend) pend = fn().then(x => { v = x; t = Date.now(); pend = null; return x; }, e => { pend = null; if (v) return v; throw e; }); return pend; }; };
// Build-time index for data no edge function can filter by (scripts/build-wg-index.js -> data/wg-index.json, gitignored).
const IDX_FILE = path.join(__dirname, 'data', 'wg-index.json'); let idx = null, idxM = 0;
function wgIndex() {
  try { const m = fs.statSync(IDX_FILE).mtimeMs; if (!idx || m !== idxM) { idx = JSON.parse(fs.readFileSync(IDX_FILE, 'utf8')); idxM = m; console.log('[wg] index loaded, built ' + idx.builtAt); } }
  catch { if (!idx) { console.log('[wg] data/wg-index.json missing: run node scripts/build-wg-index.js'); idx = { aon: {}, names: {}, groupCounts: {}, creatureAbilities: {} }; } }
  return idx;
}
// Ability-block types: WG's AbilityBlockType union, parsed from supabase/functions/_shared/content.d.ts (mtime-cached).
let abT = null, abK = '';
function abilityTypes() {
  const f = 'supabase/functions/_shared/content.d.ts', k = mkey([f]); if (abT && k === abK) return abT; abK = k;
  const m = /type AbilityBlockType =([^;]+);/.exec(fs.readFileSync(path.join(WG_REPO, f), 'utf8'));
  return (abT = m ? [...m[1].matchAll(/'([a-z-]+)'/g)].map(x => x[1]) : []);
}
// These find-* accept only id/content_sources (no name), so names resolve to ids via the build-time index.
const ID_ONLY = new Set(['ancestry', 'background', 'class', 'archetype', 'class-archetype', 'versatile-heritage']);
async function wgProxy(u, res) {
  const t = decodeURIComponent(u.pathname.slice('/api/wg/'.length)); let id = u.searchParams.get('id'); const name = u.searchParams.get('name');
  const send = (c, o) => { res.writeHead(c, { 'content-type': 'application/json; charset=utf-8', 'x-wg-source': 'edge' }); res.end(JSON.stringify(o)); };
  let ab = []; try { ab = abilityTypes(); } catch {}
  const fn = /^[a-z-]+$/.test(t) ? (ab.includes(t) ? 'find-ability-block' : t === 'inv-item' ? 'find-item' : 'find-' + t) : null;
  if (!fn || (!id && !name)) return send(400, { error: 'need /api/wg/<type>?id= or ?name=' });
  if (!(id && /^\d+$/.test(id)) && ID_ONLY.has(t)) { const hit = (wgIndex().names[t] || {})[String(name || id).toLowerCase().trim()]; if (!hit) return send(200, { status: 'success', data: [] }); id = String(hit); }
  const body = id && /^\d+$/.test(id) ? { id: +id } : { name: name || id };
  if (fn === 'find-ability-block' && body.name) body.type = t; // find-ability-block's own type filter (as WG UI passes it)
  try { send(200, await edge(fn, body)); } catch (e) { send(502, { error: 'wg edge function failed', detail: e.message }); }
}
// Read-only GET /api/wg-lookup?type=condition&name= : WG keeps conditions hardcoded in its frontend (no DB table),
// so parse them from the local WG checkout (read-only). Skills and creature abilities have no linkable WG entity.
const WG_REPO = process.env.WG_REPO || 'D:/repos/wanderers-guide';
let wgConds = null, wgCondsKey = '';
const mkey = files => files.map(f => { try { return fs.statSync(path.join(WG_REPO, f)).mtimeMs; } catch { return 0; } }).join(',');
function loadConds() {
  const k = mkey(['frontend/src/process/conditions/condition-handler.ts']); if (wgConds && k === wgCondsKey) return wgConds; wgCondsKey = k;
  const src = fs.readFileSync(path.join(WG_REPO, 'frontend/src/process/conditions/condition-handler.ts'), 'utf8');
  wgConds = []; const re = /name:\s*'([^']+)',\s*description:\s*`([\s\S]*?)`,/g; let m;
  while ((m = re.exec(src))) wgConds.push({ id: m[1].replace(/ /g, '~'), name: m[1], description: m[2].replace(/\n\s+/g, '\n\n'), type: 'condition' });
  return wgConds;
}
// Static WG descriptions (skills, attributes, saves, proficiencies, AC, Perception, senses, speed, resistance, weakness),
// parsed verbatim from the WG frontend drawers. Only the Description text; character Breakdown/Timeline is not applicable.
const WG_DRAWERS = 'frontend/src/drawers/types/';
const hcl = s => s.replace(/\$?\{convertToHardcodedLink\('([a-z-]+)',\s*'([^']+)'(?:,\s*'([^']+)')?\)\}/g, (_, t, n, disp) => '[' + (disp || n) + '](link_' + t + '_' + n.replace(/ /g, '~') + ')');
const jsxText = s => { s = s.trim(); const t = /^\{\s*`([\s\S]*)`\s*\}$/.exec(s); return t ? hcl(t[1]) : hcl(s).replace(/\s+/g, ' ').trim(); };
const richBlocks = f => [...fs.readFileSync(path.join(WG_REPO, WG_DRAWERS, f), 'utf8').matchAll(/<RichText[^>]*>([\s\S]*?)<\/RichText>/g)].map(m => jsxText(m[1]));
let wgStatic = null, wgStaticKey = '';
const SPEC_FILES = ['frontend/src/process/specializations/weapon-specializations.ts', 'frontend/src/process/specializations/armor-specializations.ts'];
const STATIC_FILES = ['StatProfDrawer.tsx', 'StatAttrDrawer.tsx', 'StatAcDrawer.tsx', 'StatPerceptionDrawer.tsx', 'StatSpeedDrawer.tsx', 'StatResistWeakDrawer.tsx'].map(f => WG_DRAWERS + f);
function loadStatic() {
  const k = mkey([...STATIC_FILES, ...SPEC_FILES]); if (wgStatic && k === wgStaticKey) return wgStatic; wgStaticKey = k;
  const out = [], add = (type, key, label, description, file) => out.push({ type, id: key, key, name: label, description: description.replace(/\n[ \t]+/g, '\n').replace(/\n/g, '\n\n'), file: WG_DRAWERS + file });
  for (const [file, fn] of [['StatProfDrawer.tsx', 'getProfDescription'], ['StatAttrDrawer.tsx', 'getAttributeDescription']]) {
    const src = fs.readFileSync(path.join(WG_REPO, WG_DRAWERS, file), 'utf8'), body = src.slice(src.indexOf('function ' + fn));
    for (const m of body.matchAll(/if \(\w+(?: === '([A-Z_]+)'|\.startsWith\('([A-Z_]+)'\))\) \{\s*return `([\s\S]*?)`;\s*\}/g)) {
      const key = m[1] || m[2] + '*', raw = (m[1] || m[2]).replace(/_+$/, '');
      const type = raw.startsWith('SKILL_') ? 'skill' : raw.startsWith('SAVE_') ? 'save' : raw.startsWith('ATTRIBUTE_') ? 'attribute' : 'proficiency';
      const label = raw.replace(/^(SKILL|SAVE|ATTRIBUTE)_/, '').toLowerCase().replace(/_/g, ' ');
      add(type, key, label, hcl(m[3]), file);
    }
  }
  const ac = richBlocks('StatAcDrawer.tsx'), per = richBlocks('StatPerceptionDrawer.tsx'), sp = richBlocks('StatSpeedDrawer.tsx'), rw = richBlocks('StatResistWeakDrawer.tsx');
  if (ac[0]) add('ac', 'AC', 'armor class', ac[0], 'StatAcDrawer.tsx');
  per.forEach(t => { const m = /^An? (precise|imprecise|vague) sense/i.exec(t); m ? add('sense', m[1].toUpperCase(), m[1] + ' sense', t, 'StatPerceptionDrawer.tsx') : /Perception measures/.test(t) && add('perception', 'PERCEPTION', 'perception', t, 'StatPerceptionDrawer.tsx'); });
  if (sp[0]) add('speed', 'SPEED', 'speed', sp[0], 'StatSpeedDrawer.tsx');
  rw.forEach(t => /^If you have resistance/.test(t) ? add('resistance', 'RESISTANCE', 'resistance', t, 'StatResistWeakDrawer.tsx') : /^If you have a weakness/.test(t) && add('weakness', 'WEAKNESS', 'weakness', t, 'StatResistWeakDrawer.tsx'));
  // Weapon/armor groups: critical/armor specialization text from WG specialization constants (verbatim).
  SPEC_FILES.forEach((f, i) => { const src = fs.readFileSync(path.join(WG_REPO, f), 'utf8'); for (const m of src.matchAll(/name:\s*'([^']+)',\s*description:\s*`([\s\S]*?)`,/g)) out.push({ type: i ? 'armor-group' : 'weapon-group', id: m[1].toUpperCase(), key: m[1].toUpperCase(), name: m[1].toLowerCase(), description: hcl(m[2]), file: f }); });
  // Attribute display names come from the WG description's first word ("Strength measures ...").
  out.forEach(e => { if (e.type === 'attribute') { const w = /^(\w+) measures/.exec(e.description); e.abbr = e.name; if (w) e.name = w[1].toLowerCase(); }
    if (e.type === 'save') { const w = /^An? (\w+) saving throw/.exec(e.description); e.abbr = e.name; if (w) e.name = w[1].toLowerCase(); } });
  return (wgStatic = out);
}
// Skill actions: WG StatProfDrawer.tsx fetches ability blocks and keeps type 'action' with meta_data.skill.
// Runtime: find-ability-block { type: 'action' } (edge filter), same meta_data.skill rule, cached 10 min.
const loadSkillActs = ttlA(600000, async () => ((await edge('find-ability-block', { type: 'action' })).data || []).filter(a => a.meta_data && a.meta_data.skill).map(a => ({ id: a.id, name: a.name, skill: a.meta_data.skill })));
const EDGE_LOOKUPS = new Set(['creature-ability']);
const STATIC_TYPES = new Set(['weapon-group', 'armor-group', 'skill', 'save', 'attribute', 'proficiency', 'ac', 'perception', 'sense', 'speed', 'resistance', 'weakness']);
async function wgLookup(u, res) {
  const type = u.searchParams.get('type'), name = String(u.searchParams.get('name') || u.searchParams.get('id') || '').replace(/~/g, ' ').toLowerCase().trim();
  res.setHeader('content-type', 'application/json; charset=utf-8');
  const send = (c, o) => { res.writeHead(c); res.end(JSON.stringify(o)); };
  if (type === 'meta') { try { return send(200, { data: { abilityTypes: abilityTypes(), lookupTypes: ['condition', ...STATIC_TYPES, ...EDGE_LOOKUPS], indexBuiltAt: wgIndex().builtAt || null } }); } catch (e) { return send(502, { error: e.message }); } }
  if (type === 'aon') {
    const m = /^https?:\/\/2e\.aonprd\.com\/([A-Za-z]+)\.aspx\?ID=(\d+)/i.exec(u.searchParams.get('url') || '');
    if (!m) return send(400, { error: 'need url=https://2e.aonprd.com/<Page>.aspx?ID=<n>' });
    return send(200, { data: wgIndex().aon['https://2e.aonprd.com/' + m[1] + '.aspx?ID=' + m[2]] || [] });
  }
  if (type === 'creature-ability' && name) {
    // Index gives the creature that embeds it; the ability text comes live from find-creature { id } (abilities_base).
    const cid = wgIndex().creatureAbilities[name]; if (!cid) return send(200, { data: [] });
    try { const c = (await edge('find-creature', { id: cid })).data; const a = c && (c.abilities_base || []).find(x => String(x.name).toLowerCase() === name);
      return send(200, { data: a ? [{ name: a.name, description: a.description, actions: a.actions, requirements: a.requirements, trigger: a.trigger, creature_id: c.id, creature: c.name, id: a.name.replace(/ /g, '~'), type: 'creature-ability' }] : [] }); }
    catch (e) { return send(502, { error: e.message }); }
  }
  if (!(type === 'condition' || STATIC_TYPES.has(type)) || !name) return send(400, { error: 'need type=condition|' + [...STATIC_TYPES].join('|') + '&name=' });
  try {
    if (type === 'condition') { const base = name.replace(/\s+\d+$/, ''); return send(200, { data: loadConds().filter(c => c.name.toLowerCase() === base) }); }
    const q = name.replace(/\s+[+-]?\d+$/, '').replace(/ saving throw$| save$/, '');
    let hits = loadStatic().filter(e => e.type === type && (e.id.toLowerCase() === q || e.name === q || e.abbr === q || (type === 'save' && q.startsWith(e.abbr)) || (type === 'skill' && e.key === 'SKILL_LORE_*' && / lore$/.test(q))));
    if (type === 'skill' && hits.length) { const acts = await loadSkillActs(); hits = hits.map(e => { const v = e.key === 'SKILL_LORE_*' ? 'lore' : e.name; return { ...e, name: e.key === 'SKILL_LORE_*' ? name : e.name, actions: acts.filter(a => [].concat(a.skill || []).some(s => String(s).toLowerCase().replace(/_/g, ' ') === v)).map(a => ({ id: a.id, name: a.name })) }; }); }
    if ((type === 'weapon-group' || type === 'armor-group') && hits.length) { const gc = wgIndex().groupCounts; hits = hits.map(e => ({ ...e, itemCount: gc[e.name] || 0 })); }
    send(200, { data: hits });
  } catch (e) { send(502, { error: 'wg lookup failed', detail: e.message }); }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/pf2/')) {
    if (req.method !== 'GET') { res.writeHead(405); return res.end('read-only proxy'); }
    return proxy(u, res, IMAGE_ROUTE.test(u.pathname), false);
  }
  if (u.pathname === '/api/wg-lookup') {
    if (req.method !== 'GET') { res.writeHead(405); return res.end('read-only'); }
    return wgLookup(u, res);
  }
  if (u.pathname.startsWith('/api/wg/')) {
    if (req.method !== 'GET') { res.writeHead(405); return res.end('read-only proxy'); }
    return wgProxy(u, res);
  }
  let f = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(buf);
  });
}).listen(PORT, HOST, () => { console.log(`editor on http://${HOST}:${PORT}  /api/pf2 -> ${TARGET.origin}/api`); unlockArt(); });
