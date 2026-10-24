// Wanderer's Guide hover/click previews for <a href="#wg" data-wg-type data-wg-id> links inside TinyMCE.
// Data source mirrors AMBA (src/server/services/wgGadgetShop.ts resolvePublicWgLink): WG edge functions
// find-item / find-spell / find-ability-block / find-creature, keyed by { id } or { name }.
// Primary path: read-only GET /api/wg/<type>?id=|name= on dev-server.js. If that route is missing (dev-server
// not restarted yet), falls back to the local WG gateway directly (AMBA's DEFAULT_WG_DOCKER_API_BASE, CORS *).
(function () {
  const WG_DIRECT = 'http://localhost:8000/functions/v1';
  // Live from WG DB via /api/wg-lookup?type=meta (ability_block types; static lookup types).
  const ABILITY = new Set(), LOOKUP = new Set(), CONDS = [];
  const metaReady = fetch('/api/wg-lookup?type=meta').then(r => r.ok ? r.json() : null).then(j => { if (j && j.data) { j.data.abilityTypes.forEach(t => ABILITY.add(t)); j.data.lookupTypes.forEach(t => LOOKUP.add(t)); (j.data.conditionNames || []).forEach(n => CONDS.push(n)); } }).catch(() => {});
  const fnFor = t => LOOKUP.has(t) ? 'wg-lookup' : ABILITY.has(t) ? 'find-ability-block' : t === 'inv-item' ? 'find-item' : 'find-' + t;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cache = new Map(); let proxyOk = null;
  const rowsOf = d => Array.isArray(d) ? d : d && typeof d === 'object' ? [d] : [];
  async function call(type, body) {
    await metaReady;
    const key = type + ':' + JSON.stringify(body);
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      // Static drawers (imprecise, Acrobatics) and ability-block senses (Darkvision) share the type name.
      // A numeric id is an ability block; drawer ids are words (IMPRECISE, SKILL_ACROBATICS).
      const abilityId = ABILITY.has(type) && body.id != null && /^\d+$/.test(String(body.id));
      if (LOOKUP.has(type) && !abilityId) { const r = await fetch('/api/wg-lookup?type=' + encodeURIComponent(type) + '&name=' + encodeURIComponent(body.name ?? body.id)); if (!r.ok) throw new Error('WG ' + r.status); return rowsOf((await r.json()).data); }
      if (proxyOk !== false) {
        try {
          const qs = 'id' in body ? 'id=' + encodeURIComponent(body.id) : 'name=' + encodeURIComponent(body.name);
          const r = await fetch('/api/wg/' + encodeURIComponent(type) + '?' + qs, { headers: { accept: 'application/json' } });
          if (r.ok) { proxyOk = true; const j = await r.json(); return rowsOf(j.data ?? j); }
          if (r.status !== 404) throw new Error('WG ' + r.status);
          proxyOk = false;
        } catch (e) { if (proxyOk) throw e; proxyOk = false; }
      }
      const fn = fnFor(type); if (!fn) return [];
      const r = await fetch(WG_DIRECT + '/' + fn, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' });
      if (!r.ok) throw new Error('WG ' + r.status);
      const j = await r.json(); return rowsOf(j.data);
    })();
    cache.set(key, p); p.catch(() => cache.delete(key));
    return p;
  }
  const fetchById = (type, id) => { const n = Number(id); return call(type, Number.isFinite(n) && String(n) === String(id) ? { id: n } : { name: String(id) }).then(r => r[0] || null); };
  const norm = s => String(s || '').toLowerCase().replace(/[\u2018\u2019`]/g, "'").replace(/\s+/g, ' ').trim();
  const aonId = u => { const m = /ID=(\d+)/i.exec(String(u || '')); return m ? m[1] : null; };
  // Name+type match (AMBA linkShopInventory: exact normalized name). AoN URL in WG meta_data.source.url breaks ties.
  // Exact AoN URL -> WG record via meta_data.source.url (live DB). Returns [{t,id,name}].
  async function byAon(url) { const k = 'aon:' + url; if (!cache.has(k)) cache.set(k, fetch('/api/wg-lookup?type=aon&url=' + encodeURIComponent(url)).then(r => r.ok ? r.json() : { data: [] }).then(j => j.data || []).catch(() => [])); return cache.get(k); }
  async function match(type, name, aonUrl) {
    await metaReady;
    if (!name || !fnFor(type)) return null;
    let rows; try { rows = await call(type, { name }); } catch { return null; }
    if (type === 'feat') rows = rows.filter(r => !r.type || r.type === 'feat');
    const a = aonId(aonUrl), byAon = a && rows.find(r => aonId(r.meta_data && r.meta_data.source && r.meta_data.source.url) === a && /aonprd/.test(r.meta_data.source.url) && sameKind(aonUrl, r.meta_data.source.url));
    const hit = byAon || (LOOKUP.has(type) && type !== 'condition' ? rows[0] : rows.find(r => norm(r.name) === norm(type === 'condition' ? name.replace(/\s+\d+$/, '') : name)));
    return hit && (LOOKUP.has(type) || Number.isFinite(Number(hit.id))) ? String(hit.id) : null;
  }
  const sameKind = (a, b) => String(a).split('?')[0].toLowerCase() === String(b).split('?')[0].toLowerCase();
  // ---- rendering (AMBA links.ts polishWgDescription + wgLinksToHtml) ----
  const GLYPH = { 'ONE-ACTION': '\u25C6', 'TWO-ACTIONS': '\u25C6\u25C6', 'THREE-ACTIONS': '\u25C6\u25C6\u25C6', REACTION: '\u293E', 'FREE-ACTION': '\u25C7' };
  const glyph = c => c && GLYPH[String(c).toUpperCase()] ? `<span class="wg-action aon-action">${GLYPH[String(c).toUpperCase()]}</span>` : '';
  // Same rule as Wanderer's Guide RichText: link condition names in prose, never inside an authored link.
  function linkConditions(html) {
    if (!CONDS.length) return html;
    const re = new RegExp('\\b(' + [...CONDS].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
    let depth = 0;
    return html.split(/(<[^>]+>)/).map(part => {
      if (part.startsWith('<')) { if (/^<a\b/i.test(part)) depth++; else if (/^<\/a>/i.test(part)) depth = Math.max(0, depth - 1); return part; }
      if (depth) return part;
      return part.replace(re, m => `<a href="#wg" data-wg-type="condition" data-wg-id="${esc(m)}">${m}</a>`);
    }).join('');
  }
  function polish(raw) {
    let t = esc(String(raw || '').replace(/[\u2217\uFF0A\u204E]/g, '*').replace(/\$\{convertToHardcodedLink\('([a-z-]+)',\s*'([^']+)'(?:,\s*'([^']+)')?\)\}/g, (_, type, name, disp) => '[' + (disp || name) + '](link_' + type + '_' + name.replace(/ /g, '~') + ')'));
    t = t.replace(/&lt;abbr\b[^&]*?cost=&quot;([A-Z-]+)&quot;[\s\S]*?&lt;\/abbr&gt;/gi, (_, c) => glyph(c));
    t = t.replace(/\[([^\]]+)\]\(link_([a-z0-9-]+)_([^)]+)\)/gi, (_, label, type, id) => fnFor(type) ? `<a href="#wg" data-wg-type="${type}" data-wg-id="${id.replace(/~/g, ' ')}">${label}</a>` : label);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    t = linkConditions(t);
    const paras = s => window.ambaWgMd && window.ambaWgMd.prose ? window.ambaWgMd.prose(s) : s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => p.startsWith('---') ? '<hr>' : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    return window.ambaWgMd ? window.ambaWgMd.render(t, paras) : paras(t);
  }
  const kindOf = t => ABILITY.has(t) ? 'feat' : t === 'spell' ? 'spell' : t === 'creature' ? 'stat' : 'item';
  const LABEL = { 'weapon-group': 'Weapon Group', 'armor-group': 'Armor Group', ac: 'Armor Class', proficiency: 'Proficiency', resistance: 'Resistance', weakness: 'Weakness' };
  const cap = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase());
  function staticCard(type, r) {
    const acts = (r.actions || []).map(a => `<a href="#wg" data-wg-type="action" data-wg-id="${esc(a.id)}">${esc(a.name)}</a>`).join(', ');
    return `<article class="aon-item-block"><header class="aon-item-block-banner"><h4>${esc(type === 'ac' ? 'Armor Class' : cap(r.name))}</h4><span class="aon-level-badge">${esc(LABEL[type] || cap(type))}</span></header><div class="aon-item-block-body"><p class="aon-item-block-source">Source: Wanderer's Guide (${esc(r.file || 'frontend')})</p>${/-group$/.test(type) ? `<p><strong>${type === 'weapon-group' ? 'Critical Specialization Effect' : 'Armor Specialization Effect'}</strong></p>` : ''}${polish(r.description)}${r.itemCount != null ? `<p><em>${esc(r.itemCount)} WG items in this group</em></p>` : ''}${type === 'skill' ? `<p><strong>Skill Actions</strong> ${acts || '<em>none</em>'}</p>` : ''}</div></article>`;
  }
  function cardHtml(type, r) {
    if (type === 'creature-ability') return `<article class="aon-feat-block"><header class="aon-feat-block-banner"><h4>${esc(r.name)}${glyph(r.actions)}</h4><span class="aon-level-badge">Monster Ability</span></header><div class="aon-feat-block-body"><p class="aon-feat-block-source">Source: Wanderer's Guide (embedded in creature ${esc(r.creature)}, WG #${esc(r.creature_id)})</p>${r.requirements ? `<p><strong>Requirements</strong> ${esc(r.requirements)}</p>` : ''}${polish(r.description)}</div></article>`;
    if (LOOKUP.has(type) && type !== 'condition' && !(r && r.meta_data)) return staticCard(type, r);
    const k = kindOf(type), cls = k === 'stat' ? 'aon-stat-block stat-block' : 'aon-' + k + '-block';
    const lvl = type === 'condition' ? 'Condition' : type === 'spell' ? (r.rank === 0 ? 'Cantrip' : 'Spell ' + (r.rank ?? '?')) : type === 'creature' ? 'Creature ' + (r.level ?? '?') : (ABILITY.has(type) ? (r.type ? r.type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Feat') : 'Item') + (r.level != null ? ' ' + r.level : '');
    const meta = [], leads = [];
    const LEAD_LABELS = new Set(['Prerequisites', 'Frequency', 'Trigger', 'Requirements', 'Cost', 'Defense', 'Duration']);
    const add = (l, v) => { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) { const html = `<strong>${l}</strong> ${esc(Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v)}`; (LEAD_LABELS.has(l) ? leads : meta).push(html); } };
    if (type === 'spell') { add('Traditions', r.traditions); add('Range', r.range); add('Area', r.area); add('Targets', r.targets); add('Defense', r.defense); add('Duration', r.duration); add('Trigger', r.trigger); add('Requirements', r.requirements); }
    else if (ABILITY.has(type)) { add('Prerequisites', Array.isArray(r.prerequisites) ? r.prerequisites.map(p => p && (p.name || p.text || p)).filter(x => typeof x === 'string') : r.prerequisites); add('Frequency', r.frequency); add('Trigger', r.trigger); add('Requirements', r.requirements); add('Cost', r.cost); }
    else if (type !== 'creature') { add('Price', priceText(r.price)); add('Usage', r.usage); add('Bulk', r.bulk); add('Hands', r.hands); }
    const rar = r.rarity && r.rarity !== 'COMMON' ? `<div class="aon-traits"><span class="aon-trait aon-trait--${esc(r.rarity.toLowerCase())}">${esc(r.rarity.toLowerCase())}</span></div>` : '';
    const src = r.meta_data && r.meta_data.source || {};
    const srcLine = `<p class="aon-${k === 'stat' ? 'stat' : k}-block-source">Source: Wanderer's Guide${src.book ? ' \u00b7 ' + esc(src.book) + (src.page ? ' pg. ' + esc(src.page) : '') : ''} (${type === 'condition' ? 'WG condition' : 'WG #' + esc(r.id)})</p>`;
    const heightened = r.heightened && Array.isArray(r.heightened.text) ? r.heightened.text.map(h => polish('**Heightened ' + (h.amount || '') + '** ' + (h.text || ''))).join('') : '';
    const body = r.description ? polish(r.description) + heightened + (r.special ? `<p><strong>Special</strong> ${esc(r.special)}</p>` : '') : '<p><em>No description on this record.</em></p>';
    const banner = k === 'stat' ? `<header class="aon-stat-block-banner"><h4 class="encounter-title">${esc(r.name)}</h4><span class="aon-level-badge">${esc(lvl)}</span></header>` : `<header class="aon-${k}-block-banner"><h4>${esc(r.name)}${glyph(r.cast || r.actions)}</h4><span class="aon-level-badge">${esc(lvl)}</span></header>`;
    const boxed = window.ambaWgMd && window.ambaWgMd.asTables();
    const leadHtml = leads.map(h => boxed ? `<p class="wg-title-block">${h}</p>` : `<p>${h}</p>`).join('');
    return `<article class="${cls}">${banner}<div class="aon-${k === 'stat' ? 'stat' : k}-block-body">${srcLine}${rar}${meta.length ? `<p class="aon-${k}-block-meta">${meta.join('; ')}</p>` : ''}${leadHtml}${body}</div></article>`;
  }
  function priceText(p) { if (!p) return ''; if (typeof p === 'string') return p; const parts = []; ['pp', 'gp', 'sp', 'cp'].forEach(c => { if (p[c]) parts.push(p[c] + ' ' + c); }); return parts.join(', '); }
  // ---- popover inside the TinyMCE iframe (data-mce-bogus="all": never serialized into content) ----
  // WG links use a dashed underline; AoN links stay solid (see aon-blocks.css).
  const STYLE = '.wg-pop{position:fixed;z-index:9999;max-width:440px;width:min(440px,90vw);max-height:calc(100vh - 16px);display:flex;flex-direction:column;box-shadow:0 8px 28px rgba(0,0,0,.28);border-radius:6px;background:#fff}.wg-pop>article{margin:0!important;min-height:0;overflow:auto}.wg-pop article>div{overflow-x:auto}.wg-pop-bar{display:flex;justify-content:space-between;align-items:center;flex:none;font:12px system-ui,sans-serif;padding:3px 8px;background:#2b2b2b;color:#eee;border-radius:6px 6px 0 0}.wg-pop-bar button{font:inherit;cursor:pointer}.wg-pop-msg{padding:10px;font:13px system-ui,sans-serif}a[data-wg-type][data-wg-id]{text-decoration:none;cursor:pointer;background-image:repeating-linear-gradient(to right,rgb(40 38 32 / .38) 0 2px,transparent 2px 3.5px);background-size:auto 1px;background-position:0 100%;background-repeat:repeat-x;padding-bottom:1px}';
  function attach(editor) {
    // Same model as the store script: one hover card, click pins another card offset on top, Escape closes only the top card.
    const pinned = []; let hover = null, z = 9999, timer = 0, escAt = 0;
    const doc = () => editor.getDoc();
    const top = () => pinned[pinned.length - 1] || hover;
    function close(entry) {
      if (!entry) return;
      const i = pinned.indexOf(entry); if (i >= 0) pinned.splice(i, 1);
      if (hover === entry) hover = null;
      entry.el.remove();
    }
    function place(entry) {
      const w = doc().defaultView, margin = 8;
      const vw = w.innerWidth, vh = w.innerHeight;
      entry.el.style.zIndex = String(entry.z);
      const width = Math.min(entry.el.offsetWidth || 440, vw - margin * 2);
      const height = Math.min(entry.el.offsetHeight || 120, vh - margin * 2);
      const maxX = Math.max(margin, vw - width - margin);
      const maxY = Math.max(margin, vh - height - margin);
      const others = [...pinned, hover].filter(e => e && e !== entry && e.el.isConnected).map(e => e.el.getBoundingClientRect());
      const link = entry.anchor.getBoundingClientRect();
      const gap = 18;
      const src = { left: link.left - gap, right: link.right + gap, top: link.top - gap, bottom: link.bottom + gap };
      const coversLink = (x, y) => x < src.right && x + width > src.left && y < src.bottom && y + height > src.top;
      const hit = (x, y) => coversLink(x, y) || others.some(o => x < o.right - 4 && x + width > o.left + 4 && y < o.bottom - 4 && y + height > o.top + 4);
      const overlap = (x, y) => others.reduce((sum, o) => {
        const iw = Math.min(x + width, o.right) - Math.max(x, o.left);
        const ih = Math.min(y + height, o.bottom) - Math.max(y, o.top);
        return sum + (iw > 0 && ih > 0 ? iw * ih : 0);
      }, 0);
      const saved = entry.spot;
      if (saved && saved.x <= maxX && saved.y <= maxY && !hit(saved.x, saved.y)) {
        entry.el.style.left = saved.x + 'px';
        entry.el.style.top = saved.y + 'px';
        return;
      }
      let spot = null;
      for (let i = 0; i < 30; i++) {
        const x = margin + Math.random() * (maxX - margin);
        const y = margin + Math.random() * (maxY - margin);
        if (!hit(x, y)) { spot = { x, y }; break; }
      }
      if (!spot) {
        let best = Infinity;
        for (let i = 0; i < 20; i++) {
          const x = margin + Math.random() * (maxX - margin);
          const y = margin + Math.random() * (maxY - margin);
          const area = overlap(x, y) + (coversLink(x, y) ? width * height : 0);
          if (area < best) { best = area; spot = { x, y }; if (!area) break; }
        }
      }
      entry.spot = spot;
      entry.el.style.left = spot.x + 'px';
      entry.el.style.top = spot.y + 'px';
    }
    async function open(a, pin) {
      if (pin && hover) close(hover);
      const d = doc(), el = d.createElement('div');
      const entry = { el, anchor: a, pinned: !!pin, z: ++z };
      el.className = 'wg-pop'; el.setAttribute('data-mce-bogus', 'all'); el.contentEditable = 'false'; el.tabIndex = -1;
      // TinyMCE treats a contenteditable=false island as one object: a click selects the whole card and never hits the link.
      el.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        if (e.target.closest && e.target.closest('button')) { close(entry); return; }
        const inner = linkOf(e.target); if (!inner) return;
        clearTimeout(timer); open(inner, true);
      }, true);
      el.innerHTML = '<div class="wg-pop-msg">Loading Wanderer\'s Guide\u2026</div>';
      if (pin) pinned.push(entry); else hover = entry;
      d.body.appendChild(el); place(entry); if (pin) bar(entry);
      const type = a.getAttribute('data-wg-type') || '', id = a.getAttribute('data-wg-id') || '';
      let html;
      try { const r = await fetchById(type, id); entry.type = type; entry.record = r; html = r ? cardHtml(type, r) : `<div class="wg-pop-msg">No Wanderer's Guide record for ${esc(type)} ${esc(id)}.</div>`; }
      catch (e) { html = `<div class="wg-pop-msg">Wanderer's Guide unreachable (${esc(e.message)}).</div>`; }
      if (!el.isConnected) return;
      entry.view = () => html;
      const paint = () => {
        const barEl = el.querySelector('.wg-pop-bar');
        el.innerHTML = entry.view(); if (barEl) el.insertBefore(barEl, el.firstChild); place(entry);
      };
      paint();
    }
    document.addEventListener('amba-render-tables', () => {
      for (const entry of [...pinned, hover]) {
        if (!entry || !entry.view || !entry.el.isConnected) continue;
        if (entry.record) entry.view = () => cardHtml(entry.type, entry.record);
        const barEl = entry.el.querySelector('.wg-pop-bar');
        entry.el.innerHTML = entry.view(); if (barEl) entry.el.insertBefore(barEl, entry.el.firstChild); place(entry);
      }
    });
    function bar(entry) {
      const b = doc().createElement('div'); b.className = 'wg-pop-bar'; b.innerHTML = '<span>Wanderer\'s Guide</span><button type="button">Close</button>';
      b.querySelector('button').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); close(entry); });
      entry.el.insertBefore(b, entry.el.firstChild);
    }
    function onEsc(e) {
      const t = top(); if (e.key !== 'Escape' || !t) return;
      const now = Date.now(); if (now - escAt < 30) return; escAt = now;
      e.preventDefault(); e.stopPropagation(); close(t);
    }
    const linkOf = t => t && t.closest ? t.closest('a[data-wg-type][data-wg-id]') : null;
    editor.on('init', () => {
      const d = doc(), s = d.createElement('style'); s.setAttribute('data-mce-bogus', 'all'); s.textContent = STYLE + (window.ambaWgMd ? window.ambaWgMd.CSS : ''); d.head.appendChild(s);
      d.addEventListener('mouseover', e => {
        const a = linkOf(e.target);
        if (!a || a.closest('.wg-pop')) return; // links inside a card stack on click, same as the store
        if (hover && hover.anchor === a) return;
        clearTimeout(timer); timer = setTimeout(() => { if (hover) close(hover); open(a, false); }, 200);
      });
      d.addEventListener('mouseout', e => {
        if (!hover) { clearTimeout(timer); return; }
        const to = e.relatedTarget;
        if (to && (hover.el.contains(to) || linkOf(to) === hover.anchor)) return;
        clearTimeout(timer); timer = setTimeout(() => { if (hover) close(hover); }, 250);
      });
      d.addEventListener('click', e => {
        const a = linkOf(e.target); if (!a || a.closest('.wg-pop')) return;
        e.preventDefault(); e.stopPropagation();
        clearTimeout(timer); open(a, true);
      }, true);
      d.addEventListener('keydown', onEsc, true);
    });
    editor.on('keydown', onEsc);
    editor.on('GetContent BeforeSetContent remove', () => { if (hover) close(hover); });
  }
  window.ambaWg = { find: fetchById, match, byAon, cardHtml, attach, fnFor, ready: metaReady };
  if (window.tinymce) tinymce.on('AddEditor', ev => attach(ev.editor));
})();
