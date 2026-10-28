// PF2 lookup: Monsters / Items / Spells / Feats via read-only GET /api/pf2/{monsters,equipment,spells,feats}.
// Creatures -> aon-stat-block, items -> aon-item-block (AMBA treasureService.ts markup), spells -> aon-spell-block (same pattern).
// Formatting ported from AMBA src/server/services/aon/encounterService.ts (buildStatBlockHtml)
// and aonStatBlockHtml.ts (structuredStatBlockHtml).
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // AoN markup tokens (<%UMR%37%%>telepathy<%END>) -> plain text.
  const deTok = s => String(s).replace(/<%[^>]*>/g, '');
  const txt = v => (v === null || v === undefined || /^(\s*|\{\s*\}|\[\s*\])$/.test(String(v))) ? null : (deTok(String(v)).trim() || null);
  // Weaknesses/Resistances may arrive as JSON ({"holy": 5}) -> 'holy 5, physical 5 (except silver)'.
  const resist = v => { const t = txt(v); if (!t || !/^[\[{]/.test(t)) return t; try { const o = JSON.parse(t); const one = (k, x) => x && typeof x === 'object' ? [x.type || x.name || k, x.value ?? x.amount ?? '', x.exceptions || x.exception ? '(except ' + [].concat(x.exceptions || x.exception).join(', ') + ')' : x.note || ''].filter(y => y !== '' && y != null).join(' ') : (k + ' ' + (x ?? '')).trim(); return (Array.isArray(o) ? o.map(x => one('', x)) : Object.entries(o).map(([k, x]) => one(k, x))).join(', ') || null; } catch { return t; } };
  const signed = v => { v = txt(v); if (v === null) return null; const n = Number(v); return Number.isFinite(n) ? (n >= 0 ? '+' + n : String(n)) : v; };
  const line = (l, v) => v ? `<div class="aon-stat-line"><strong>${esc(l)}</strong> ${esc(v)}</div>` : '';
  const variant = n => /^elite\s+|\(\s*elite\s*\)/i.test(n) ? ' aon-stat-block--elite' : /^weak\s+|\(\s*weak\s*\)/i.test(n) ? ' aon-stat-block--weak' : '';
  function sourceLabel(url) { try { const h = new URL(url).hostname; return h.includes('aonprd') ? 'AoN \u2197' : h.includes('demiplane') ? 'Demiplane \u2197' : 'Source \u2197'; } catch { return 'Source \u2197'; } }
  const AON = 'https://2e.aonprd.com';
  // Prefer WG: use a Wanderer's Guide link only when the record itself carries a WG id (AMBA scheme:
  // <a href="#wg" data-wg-type data-wg-id>, src/shared/wgShop/links.ts). No ids are invented; otherwise AoN.
  const WG_KEY = 'amba-prefer-wg', WG_TYPE = { MonsterId: 'creature', EquipmentId: 'item', SpellId: 'spell', FeatId: 'feat' };
  const preferWg = () => { try { return localStorage.getItem(WG_KEY) === '1'; } catch { return false; } };
  const setPreferWg = v => { try { localStorage.setItem(WG_KEY, v ? '1' : '0'); } catch {} document.querySelectorAll('input[data-amba-prefer-wg]').forEach(i => { i.checked = !!v; }); };
  const wgOf = m => { const id = txt(m.WgId ?? m.WanderersGuideId ?? m.WgItemId ?? m.WgSpellId ?? m.WgFeatId ?? m.WgCreatureId); if (!id) return null; const k = Object.keys(WG_TYPE).find(k => m[k] !== undefined); return k ? { type: WG_TYPE[k], id } : null; };
  const srcLink = (m, label) => { const wg = label && preferWg() && wgOf(m); /* card source line always keeps AoN/Demiplane; WG only for inline-link mode */ if (wg) return `<a href="#wg" data-wg-type="${esc(wg.type)}" data-wg-id="${esc(wg.id)}">${esc(label || 'WG \u2197')}</a>`; return txt(m.AonUrl) ? `<a href="${esc(m.AonUrl)}" target="_blank" rel="noreferrer">${esc(label || sourceLabel(m.AonUrl))}</a>` : ''; };
  const chip = t => { const r = /^(uncommon|rare|unique)$/i.exec(t); return `<span class="aon-trait${r ? ' aon-trait--' + r[1].toLowerCase() : ''}">${esc(t)}</span>`; };
  // Minimal markdown -> HTML for AoN RawMD: **bold**, [text](url) -> AoN links, paragraphs.
  function md(s) {
    let o = esc(s);
    o = o.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => { u = u.replace(/&amp;/g, '&'); const abs = /^https?:/i.test(u) ? u : AON + (u.startsWith('/') ? '' : '/') + u; return `<a href="${esc(abs)}" target="_blank" rel="noreferrer">${t}</a>`; });
    return o.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\s*\n\s*/g, ' ').trim();
  }
  // Body sections of an AoN RawMD (after the first '---'): description, variants, heightened.
  const pipeTable = (p, fmt) => { const W = window.ambaWgMd; if (!W || !/^\s*\|.*\|\s*$/m.test(p)) return null; return W.split(p).map(b => b.table ? W.tableHtml(b.table.map(r => r.map(fmt))) : b.text.trim() ? `<p class="aon-item-text">${fmt(b.text)}</p>` : '').join(''); };
  function mdSections(raw) {
    if (!txt(raw)) return [];
    const parts = String(raw).replace(/\r/g, '').replace(/\|\n\s*\n\|/g, '|\n|').split(/^\s*---\s*$/m).slice(1);
    return parts.flatMap(p => p.split(/\n\s*\n/)).map(s => s.trim()).filter(s => s && s !== '&nbsp;');
  }
  const KNOWN = /^(Perception|Languages|Skills|Str|Items|AC|HP|Speed|Immunities|Resistances|Weaknesses)$/i;
  // Monster RawMD lines like "**Melee** ..." / "**Goblin Scuttle** ..." not covered by structured fields.
  const SKIP = /^(Perception|Languages|Skills|Str|Dex|Con|Int|Wis|Cha|Items|AC|Fort|Ref|Will|HP|Speed|Immunities|Resistances|Weaknesses|Source|Senses)$/i;
  // RawMD entries ("**Label** text", continuation lines, "- **Trigger** ..." bullets, "**Damage**" merged into its attack).
  function monsterExtra(m) {
    if (!txt(m.RawMD)) return '';
    const out = [];
    for (let para of String(m.RawMD).replace(/\r/g, '').split(/\n\s*\n|\n(?=\*\*)/)) {
      para = para.trim(); if (!para || /^#|^---$/.test(para)) continue;
      const lab = /^\*\*([^*]+)\*\*\s*([\s\S]*)$/.exec(para);
      if (lab && lab[1].trim() === 'Damage' && out.length && out[out.length - 1]) { out[out.length - 1][1] = out[out.length - 1][1].replace(/,\s*$/, '') + ', <strong>Damage</strong> ' + md(lab[2]); continue; }
      if (!lab) {
        const bullets = para.split(/\n(?=-\s)/).map(s => s.trim()).filter(Boolean);
        if (bullets.length && bullets.every(b => /^-\s+\*\*[^*]+\*\*/.test(b))) { for (const b of bullets) { const bl = /^-\s+\*\*([^*]+)\*\*\s*([\s\S]*)$/.exec(b); if (bl) out.push([bl[1].trim(), md(bl[2]), true]); } continue; }
        if (/^-\s/.test(para) && out.length && out[out.length - 1]) out[out.length - 1][1] = out[out.length - 1][1].replace(/[\s;,]+$/, '') + '; ' + md(para.replace(/^-\s*/, ''));
        continue;
      }
      const k = lab[1].trim(); if (SKIP.test(k) || k.startsWith('[')) { out.push(null); continue; }
      out.push([k, md(lab[2])]);
    }
    return out.filter(Boolean).filter(([k]) => !(k === 'Melee' && txt(m.Melee)) && !(k === 'Ranged' && txt(m.Ranged))).map(([k, v, nest]) => `<div class="aon-stat-line${nest ? ' aon-stat-line--nested' : ''}"><strong>${esc(k)}</strong> ${v}</div>`).join('\n');
  }
  // PF2 layout: "AC 19; Fort +14, Ref +11, Will +8" then "HP 65; Immunities ...; Weaknesses ...; Resistances ...".
  function defLine(m) {
    const ac = txt(m.AC), saves = [['Fort', signed(m.Fortitude)], ['Ref', signed(m.Reflex)], ['Will', signed(m.Will)]].filter(x => x[1]);
    const parts = [ac ? `<strong>AC</strong> ${esc(ac)}` : '', saves.map(([l, v]) => `<strong>${l}</strong> ${esc(v)}`).join(', ')].filter(Boolean);
    return parts.length ? `<div class="aon-stat-line">${parts.join('; ')}</div>` : '';
  }
  function hpLine(m) {
    const parts = [['HP', txt(m.HP)], ['Immunities', txt(m.Immunities)], ['Weaknesses', resist(m.Weaknesses)], ['Resistances', resist(m.Resistances)]].filter(x => x[1]).map(([l, v]) => `<strong>${l}</strong> ${esc(v)}`);
    return parts.length ? `<div class="aon-stat-line">${parts.join('; ')}</div>` : '';
  }
  // Skills field can lack modifiers ("Athletics, Intimidation"); prefer RawMD's "**Skills** Athletics +14, ..." when it has numbers.
  function skillsLine(m) {
    const r = /\*\*Skills\*\*\s*([\s\S]*?)(?=\n\s*\n|\n\*\*|$)/.exec(String(m.RawMD || '').replace(/\r/g, ''));
    if (r && /[+-]\d/.test(r[1])) return `<div class="aon-stat-line"><strong>Skills</strong> ${md(r[1])}</div>`;
    return line('Skills', txt(m.Skills));
  }
  // Paizo-style cutout: transparent art floats right after the trait row; text wraps its alpha shape.
  // Prefer WG: turn inline AoN reference links (traits, actions, spells, items, creatures) into WG links by name.
  // Lookups go through ambaWg.match (cached per type+name). AoN link kept when there is no WG match.
  const AON_KIND = [[/Spells\.aspx/i, ['spell']], [/Skills\.aspx/i, ['skill']], [/WeaponGroups\.aspx/i, ['weapon-group']], [/MonsterAbilities\.aspx/i, ['creature-ability']], [/MonsterFamilies\.aspx/i, ['ancestry', 'trait']], [/ArmorGroups\.aspx/i, ['armor-group']], [/(Equipment|Weapons|Armor|Shields)\.aspx/i, ['item']], [/Monsters\.aspx/i, ['creature']], [/Traits\.aspx/i, ['trait']], [/Actions\.aspx/i, ['action', 'feat']], [/Feats\.aspx/i, ['feat', 'action']], [/Conditions\.aspx/i, ['condition']], [/Rules\.aspx/i, ['condition', 'skill', 'save', 'attribute', 'perception', 'ac', 'speed', 'sense', 'resistance', 'weakness']]];
  // Generic trait parameter split: "<base> <param>" where param is a die (d8), a distance (10 feet / 10 ft. / 10'),
  // a B/P/S damage letter list (versatile S, versatile P or S) or a damage-type word. Variants use WG's spelling.
  const TRAIT_PARAM = /^(.*?\S)\s+((?:\d*d\d+)|(?:\d+\s*(?:feet|foot|ft\.?|'))|(?:[BPS](?:\s*(?:or|\/|,)\s*[BPS])*)|(?:acid|cold|electricity|fire|force|sonic|vitality|void|spirit|mental|poison|bludgeoning|piercing|slashing))$/i;
  function traitVariant(name) {
    const m = TRAIT_PARAM.exec(String(name).replace(/\s+/g, ' ').trim()); if (!m) return null;
    const base = m[1], p = m[2], dist = /^(\d+)\s*(?:feet|foot|ft\.?|')$/i.exec(p);
    const param = dist ? dist[1] + ' ft.' : /^\d*d\d+$/i.test(p) ? p.toLowerCase() : /^[bps](\W|$)/i.test(p) ? p.toUpperCase().replace(/\s*OR\s*/g, ' or ') : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    return { base, param, variants: [...new Set([base + ' ' + param, base + ' ' + p])] };
  }
  // Stat-block prose often has no AoN anchors (Demiplane text, "Reflex save", "Strides", "agile").
  // Link a term only when Wanderer's Guide has that exact record.
  const STRUCT_LABEL = /^(Perception|Languages|Skills|Str|Dex|Con|Int|Wis|Cha|Items|AC|Fort|Ref|Will|HP|Speed|Immunities|Resistances|Weaknesses|Melee|Ranged|Abilities|Damage|Effect|Trigger|Requirements|Frequency|Critical Success|Success|Failure|Critical Failure|Area|Target|Defense|Duration|Range|Cast|Traditions|Price|Usage|Bulk|Hands|Activate|Special|Craft Requirements|Source|Heightened(?:\s*\([^)]*\))?)$/i;
  const STOP = new Set('a an the to of or and on in by up at for with from that this they them their you your its it is be as if not do so than then into onto over under when while during against also have has had must each all any using trying based area target check save spell feet foot action move does doesn creature creatures someone anyone'.split(' '));
  const actionStems = word => {
    const out = [word];
    if (word.length >= 6 && /ing$/i.test(word)) out.push(word.slice(0, -3));
    if (word.length >= 5 && /ies$/i.test(word)) out.push(word.slice(0, -3) + 'y');
    if (word.length >= 5 && /es$/i.test(word)) out.push(word.slice(0, -2));
    if (word.length >= 5 && /s$/i.test(word) && !/ss$/i.test(word)) out.push(word.slice(0, -1));
    return [...new Set(out)];
  };
  let wgPend = 0; const wgWait = [], wgMemo = new Map();
  const wgLimit = fn => new Promise((ok, no) => { const start = () => { wgPend++; fn().then(ok, no).finally(() => { wgPend--; const n = wgWait.shift(); if (n) n(); }); }; if (wgPend < 3) start(); else wgWait.push(start); });
  const memoMatch = async (t, cand) => { const k = t + '\0' + String(cand).toLowerCase(); if (wgMemo.has(k)) return wgMemo.get(k); const id = await wgLimit(() => window.ambaWg.match(t, cand, null)).catch(() => null); wgMemo.set(k, id); return id; };
  async function wgHit(types, name, inflect) {
    const stems = inflect && types.includes('action') ? actionStems(name) : [name];
    const pv = types.includes('trait') ? traitVariant(name) : null;
    if (pv) for (const cand of pv.variants) { const id = await memoMatch('trait', cand); if (id) return { t: 'trait', id }; }
    for (const t of types) for (const cand of (t === 'action' ? stems : [t === 'trait' && pv ? pv.base : name])) {
      const id = await memoMatch(t, cand); if (id) return { t, id };
    }
    // Drawer lookup owns type "sense" (precise/imprecise/vague). Darkvision and the like are ability blocks.
    if (types.includes('sense')) {
      const k = 'sense-ability\0' + name.toLowerCase();
      if (wgMemo.has(k)) { const id = wgMemo.get(k); if (id) return { t: 'sense', id }; }
      else {
        try {
          const r = await wgLimit(() => fetch('/api/wg/sense?name=' + encodeURIComponent(name), { headers: { accept: 'application/json' } }));
          const rows = r.ok ? [].concat((await r.json()).data || []) : [];
          const hit = rows.find(row => String(row.name || '').toLowerCase() === name.toLowerCase());
          const id = hit && hit.id != null ? String(hit.id) : null;
          wgMemo.set(k, id);
          if (id) return { t: 'sense', id };
        } catch { wgMemo.set(k, null); }
      }
    }
    return null;
  }
  const plainNodes = el => {
    const out = [], w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((w.nextNode())) { n = w.currentNode; const p = n.parentElement; if (!p || !n.nodeValue || !n.nodeValue.trim()) continue; if (p.closest('a, .aon-stat-block-source, .aon-item-block-meta, .aon-spell-block-meta, .aon-feat-block-meta, .aon-stat-block-banner, .aon-spell-block-banner, .aon-item-block-banner, .aon-feat-block-banner, .aon-level-badge')) continue; if (p.tagName === 'STRONG' && STRUCT_LABEL.test(p.textContent.trim())) continue; out.push(n); }
    return out;
  };
  function commaNames(text, types) {
    const out = []; let i = 0;
    for (const part of text.split(',')) {
      const lead = /^\s*/.exec(part)[0].length, name = part.slice(lead).replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (name && /[a-z]/i.test(name)) out.push({ start: i + lead, end: i + lead + name.length, name, types });
      i += part.length + 1;
    }
    return out;
  }
  function skillRanges(text) {
    const out = []; let m; const re = /([A-Za-z][A-Za-z']*(?:\s+[A-Za-z][A-Za-z']*)*)\s+[+-]\d+/g;
    while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[1].trimEnd().length, name: m[1].trim(), types: ['skill'] });
    return out;
  }
  function senseWordRanges(text) {
    const out = []; let m; const re = /\b([A-Za-z][A-Za-z-]{2,})\b/g;
    while ((m = re.exec(text))) { if (STOP.has(m[1].toLowerCase()) || /^(feet|foot)$/i.test(m[1])) continue; out.push({ start: m.index, end: m.index + m[1].length, name: m[1], types: ['sense'] }); }
    return out;
  }
  function weaponRanges(text) {
    const out = []; let m; const re = /([a-z][a-z' -]*[a-z])\s+[+-]\d+/g;
    while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[1].trimEnd().length, name: m[1].trim(), types: ['item'] });
    return out;
  }
  function parenTraitRanges(text) {
    const out = []; let m; const re = /\(([^)]+)\)/g;
    while ((m = re.exec(text))) {
      let p = 0;
      for (const bit of m[1].split(',')) {
        const lead = /^\s*/.exec(bit)[0].length, name = bit.slice(lead).trim();
        if (name) out.push({ start: m.index + 1 + p + lead, end: m.index + 1 + p + lead + name.length, name, types: ['trait'] });
        p += bit.length + 1;
      }
    }
    return out;
  }
  function tokenRanges(text) {
    const out = []; let m; const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}|[a-z][a-z-]{3,})\b/g;
    while ((m = re.exec(text))) {
      const name = m[1]; if (STOP.has(name.toLowerCase())) continue;
      const after = text.slice(m.index + name.length, m.index + name.length + 14);
      const types = /^\s+sav(?:e|ing)\b/i.test(after) ? ['save'] : /^\s+check\b/i.test(after) ? ['skill'] : /^[A-Z]/.test(name) ? ['action', 'creature-ability', 'skill', 'save'] : ['condition'];
      out.push({ start: m.index, end: m.index + name.length, name, types, inflect: /^[A-Z]/.test(name) && !/\s/.test(name) });
    }
    return out;
  }
  async function applyRanges(node, ranges, stats) {
    const hits = await Promise.all(ranges.map(async r => ({ ...r, hit: await wgHit(r.types, r.name, r.inflect) })));
    const ok = []; let last = -1;
    for (const r of hits.filter(r => r.hit).sort((a, b) => a.start - b.start || b.end - a.end)) { if (r.start < last) continue; ok.push(r); last = r.end; }
    if (!ok.length) return;
    const text = node.nodeValue, doc = node.ownerDocument, frag = doc.createDocumentFragment(); let i = 0;
    for (const r of ok) {
      if (r.start > i) frag.appendChild(doc.createTextNode(text.slice(i, r.start)));
      const a = doc.createElement('a'); a.setAttribute('href', '#wg'); a.setAttribute('data-wg-type', r.hit.t); a.setAttribute('data-wg-id', r.hit.id); a.textContent = text.slice(r.start, r.end);
      frag.appendChild(a); stats.links++; stats.wg++; i = r.end;
    }
    if (i < text.length) frag.appendChild(doc.createTextNode(text.slice(i)));
    node.parentNode.replaceChild(frag, node);
  }
  async function linkPlain(root, stats) {
    for (const chip of [...root.querySelectorAll('.aon-trait')]) {
      if (chip.querySelector('a')) continue;
      const name = chip.textContent.trim(); if (!name) continue;
      const hit = await wgHit(['trait', 'ancestry'], name, false);
      if (!hit) continue;
      const a = chip.ownerDocument.createElement('a'); a.setAttribute('href', '#wg'); a.setAttribute('data-wg-type', hit.t); a.setAttribute('data-wg-id', hit.id); a.textContent = name;
      chip.textContent = ''; chip.appendChild(a); stats.links++; stats.wg++;
    }
    for (const line of [...root.querySelectorAll('.aon-stat-line')]) {
      const label = (line.querySelector('strong') && line.querySelector('strong').textContent || '').trim();
      for (const node of plainNodes(line)) {
        const text = node.nodeValue;
        const ranges = /^items$/i.test(label) ? commaNames(text, ['item']) : /^languages$/i.test(label) ? commaNames(text, ['language']) : /^traditions$/i.test(label) ? commaNames(text, ['trait']) : /^skills$/i.test(label) ? skillRanges(text) : /^perception$/i.test(label) ? senseWordRanges(text) : /^(melee|ranged)$/i.test(label) ? [...weaponRanges(text), ...parenTraitRanges(text)] : [];
        if (ranges.length) await applyRanges(node, ranges, stats);
      }
    }
    for (const node of plainNodes(root)) { const ranges = tokenRanges(node.nodeValue); if (ranges.length) await applyRanges(node, ranges, stats); }
  }
  async function wgify(html) {
    const stats = { links: 0, wg: 0, aon: 0, misses: [] };
    if (!preferWg() || !window.ambaWg) return { html, stats };
    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html'), root = doc.getElementById('r');
    const links = [...root.querySelectorAll('a[href*="aonprd.com"]')].filter(a => !a.closest('.aon-stat-block-source, .aon-item-block-meta, .aon-spell-block-meta, .aon-feat-block-meta'));
    await Promise.all(links.map(async a => {
      stats.links++; const href = a.getAttribute('href'), name = a.textContent.replace(/\s+/g, ' ').trim(), kinds = (AON_KIND.find(([re]) => re.test(href)) || [null, []])[1];
      let hit = null;
      /* 0) parameterized traits (versatile S, deadly d8, reach 10 feet, thrown 20 ft., volley 30 feet, two-hand d12...):
            WG stores each variant as its own url-less trait ('Versatile S', 'Deadly d8', 'Reach 10 ft.') beside the base
            trait (which carries the AoN url) when there is one. Try the exact variant in WG's spelling first. */
      const pv = kinds.includes('trait') ? traitVariant(name) : null;
      if (pv) for (const cand of pv.variants) { const id = await window.ambaWg.match('trait', cand, null).catch(() => null); if (id) { hit = { t: 'trait', id }; break; } }
      /* 1) live exact AoN URL match against WG meta_data.source.url; prefer a row whose type fits the page kind */
      const byUrl = hit ? [] : window.ambaWg.byAon ? await window.ambaWg.byAon(href) : [];
      if (byUrl.length) { const r = byUrl.find(x => kinds.includes(x.t)) || byUrl[0]; hit = { t: r.t, id: String(r.id) }; }
      /* 2) name match by page kind (traits: the base name without its parameter) */
      if (!hit) for (const t of kinds) { if (!window.ambaWg.fnFor(t)) continue; const id = await window.ambaWg.match(t, t === 'trait' ? (pv ? pv.base : name) : name, t === 'trait' ? null : href).catch(() => null); if (id) { hit = { t, id }; break; } }
      if (!hit) { stats.aon++; stats.misses.push(name); return; }
      stats.wg++; a.setAttribute('href', '#wg'); a.removeAttribute('target'); a.removeAttribute('rel'); a.setAttribute('data-wg-type', hit.t); a.setAttribute('data-wg-id', hit.id);
    }));
    await linkPlain(root, stats);
    return { html: root.innerHTML, stats };
  }
  window.ambaPf2Wgify = wgify;
  // Transparency check: corners transparent, or >5% of pixels with alpha < 250 => cutout.
  function artIsTransparent(url) {
    return new Promise(res => { const im = new Image(); im.onload = () => { try { const W = Math.min(256, im.naturalWidth), H = Math.max(1, Math.round(im.naturalHeight * W / im.naturalWidth)); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data; const a = (px, py) => d[(py * W + px) * 4 + 3]; if ([a(0, 0), a(W - 1, 0), a(0, H - 1), a(W - 1, H - 1)].some(v => v < 250)) return res(true); let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) n++; res(n / (W * H) > 0.05); } catch (e) { res(false); } }; im.onerror = () => res(false); im.src = url; });
  }
  window.ambaPf2ArtIsTransparent = artIsTransparent;
  function withCutout(body, url, name, boxed) {
    const img = boxed ? `<img class="aon-stat-block-cutout aon-art--boxed" src="${esc(url)}" alt="${esc(name)}" onerror="this.remove()">` : `<img class="aon-stat-block-cutout aon-art--cutout" src="${esc(url)}" alt="${esc(name)}" style="shape-outside: url('${esc(url)}');" onerror="this.remove()">`;
    return img + body; // directly under the header, before Source line and traits
  }
  function structured(m) {
    const traits = [m.Rarity, m.Alignment, m.Size, m.Family].map(txt).filter(Boolean);
    const ab = [['Str', m.StrMod], ['Dex', m.DexMod], ['Con', m.ConMod], ['Int', m.IntMod], ['Wis', m.WisMod], ['Cha', m.ChaMod]].map(([l, v]) => [l, signed(v)]).filter(x => x[1]);
    const per = signed(m.Perception), sen = txt(m.Senses);
    return [
      traits.length ? `<div class="aon-traits">${traits.map(chip).join(' ')}</div>` : '',
      line('Perception', per && sen ? `${per}; ${sen}` : per || sen),
      line('Languages', txt(m.Languages)), skillsLine(m), line('Items', txt(m.Items)),
      ab.length ? `<div class="aon-stat-row">${ab.map(([l, v]) => `<span class="aon-stat-line"><strong>${l}</strong> ${esc(v)}</span>`).join(' ')}</div>` : '',
      defLine(m), hpLine(m), line('Speed', txt(m.Speed)), line('Melee', txt(m.Melee)), line('Ranged', txt(m.Ranged)), line('Abilities', txt(m.Abilities)), monsterExtra(m)
    ].filter(Boolean).join('\n');
  }
  // Bare AoN action words -> the same glyph spans as item/feat cards; " - Effect" separators -> "; Effect".
  const ACT_RE = /(^|>|\(|;\s|,\s)(\s*)(Single Action|One Action|Two Actions|Three Actions|Reaction|Free Action)(?=[\s,;.)<]|$)/g;
  function actGlyphs(html) {
    return String(html).replace(ACT_RE, (_, pre, sp, a) => `${pre}${sp}<span class="aon-action" title="${a}">${ACT[a.toLowerCase()]}</span>`)
      .replace(/\s+[-\u2013\u2014]\s+(<strong>(?:Effect|Trigger|Requirements|Frequency|Critical Success|Success|Failure|Critical Failure)<\/strong>)/g, '; $1');
  }
  // Twin of buildStatBlockHtml in AdventureMakerByAct src/server/services/aon/encounterService.ts.
  function statBlockHtml(m, opts) {
    const art = !!(opts && opts.art);
    const full = art && Number(m.MonsterId) > 0 ? '/api/pf2/monsters/' + Number(m.MonsterId) + '/image' : null;
    const link = srcLink(m);
    const src = txt(m.SourceBook) ? `<p class="aon-stat-block-source">Source: ${esc(m.SourceBook)}${txt(m.SourcePage) ? ' pg. ' + esc(m.SourcePage) : ''}${link ? ' &middot; ' + link : ''}</p>` : link ? `<p class="aon-stat-block-source">Source: unknown &middot; ${link}</p>` : `<p class="aon-stat-block-source">Source: unknown</p>`;
    return `<article class="aon-stat-block stat-block${variant(m.Name)}"><header class="aon-stat-block-banner"><h4 class="encounter-title">${esc(m.Name)}</h4><span class="aon-level-badge">Creature ${esc(m.Level)}</span></header><div class="aon-stat-block-body">${full ? withCutout(src + structured(m), full, m.Name, opts && opts.boxed) : src + structured(m)}</div></article>`;
  }
  const traitsHtml = list => { const seen = new Set(); const t = list.flat().map(txt).filter(Boolean).flatMap(s => s.split(/\s*,\s*/)).filter(Boolean).filter(x => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); return t.length ? `<div class="aon-traits">${t.map(chip).join(' ')}</div>` : ''; };
  const srcText = m => { const J = rawJson(m); const raw = [].concat(J.primary_source_raw || J.source_raw || [])[0]; const book = txt(m.SourceBook) || txt([].concat(J.primary_source || J.source || [])[0]) || (raw ? txt(String(raw).replace(/\s*pg\.?\s*\d+.*$/i, '')) : null); const pg = txt(m.SourcePage) || (raw && (/pg\.?\s*(\d+)/i.exec(raw) || [])[1]) || null; return book ? book + (pg ? ' pg. ' + pg : '') : null; };
  const metaP = (cls, m, extra) => { const link = srcLink(m); const st = srcText(m); const bits = [st ? 'Source: ' + esc(st) : null, ...extra.map(txt).filter(Boolean).filter(x => !(st && st.includes(x))).map(esc), link || null].filter(Boolean); return bits.length ? `<p class="${cls}">${bits.join(' &middot; ')}</p>` : ''; };
  // ---- Items: parse AoN item markup (RawMD / RawJson.markdown / RawHtml) into safe HTML ----
  const ACT = { 'single action': '\u25C6', 'one action': '\u25C6', 'two actions': '\u25C6\u25C6', 'three actions': '\u25C6\u25C6\u25C6', 'reaction': '\u21BA', 'free action': '\u25C7' };
  // Inline item markdown -> safe HTML: action glyphs, links, bold, _italic_; any other tag is dropped.
  function imd(s) {
    s = deTok(s ?? '');
    s = String(s ?? '').replace(/<actions\s+string="([^"]*)"\s*\/?>/gi, (_, a) => ACT[a.toLowerCase()] ? '\u0001' + a + '\u0002' : '')
      .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ')
      .replace(/(^|\*\*Activate\*\*\s*)(Single Action|One Action|Two Actions|Three Actions|Reaction|Free Action)\b/i, (_, p, a) => p + '\u0001' + a + '\u0002');
    let o = md(s);
    o = o.replace(/(^|[\s(\[>,;])_\s*([^_<>]+?)\s*_(?=[\s.,;:)\]<]|$)/g, '$1<em>$2</em>');
    o = o.replace(/\u0001([^\u0002]*)\u0002/g, (_, a) => `<span class="aon-action" title="${esc(a)}">${ACT[a.toLowerCase()]}</span>`);
    return o.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
  }
  function normItemMd(s) {
    s = String(s).replace(/\r/g, '')
      .replace(/^(#{1,2})[ \t]*\n\s*([^\n]+?)\s*\n[ \t]*((?:Item|Weapon|Armor|Shield)\s+\d+\+?)[ \t]*$/gm, (_, h, n, r) => `<title level="${h.length}" right="${r}">${n}</title>`);
    if (!/\n/.test(s.trim())) // flattened RawHtml: restore block breaks
      s = s.replace(/\s+---\s+/g, '\n\n---\n\n').replace(/\s*(<title\b[^>]*>|<\/title>|<ul>|<\/ul>|<traits>|<\/traits>|<\/?column\b[^>]*>)\s*/gi, '\n\n$1\n\n')
        .replace(/\s+(\*\*(?:Activate|Craft Requirements|Requirements|Trigger)\*\*)/g, '\n\n$1');
    return s;
  }
  function parseItemMd(src) {
    const s = normItemMd(src), segs = [], re = /<title\b([^>]*)>([\s\S]*?)<\/title>/gi; let last = 0, cur = null, mm;
    while ((mm = re.exec(s))) {
      if (cur) cur.content = s.slice(last, mm.index);
      cur = { level: +((/level="(\d+)"/.exec(mm[1]) || [])[1] || 1), right: (/right="([^"]*)"/.exec(mm[1]) || [])[1] || null, name: mm[2].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').trim() };
      segs.push(cur); last = re.lastIndex;
    }
    if (cur) cur.content = s.slice(last); else segs.push({ level: 1, right: null, name: '', content: s });
    return segs.map(g => {
      const traits = [...((/<traits>([\s\S]*?)<\/traits>/i.exec(g.content) || [])[1] || '').matchAll(/label="([^"]*)"/g)].map(x => x[1]);
      const c = g.content.replace(/<traits>[\s\S]*?<\/traits>/gi, ''), i = c.search(/^\s*---\s*$/m);
      return i < 0 ? { ...g, traits, head: g.right || g.level === 1 ? c : '', body: g.right || g.level === 1 ? '' : c } : { ...g, traits, head: c.slice(0, i), body: c.slice(i).replace(/^\s*---\s*/, '') };
    });
  }
  function headFields(h) {
    const p = h.replace(/<(?!actions\b)[^>]*>/gi, ' ').split(/\*\*([^*]+)\*\*/), out = [];
    for (let i = 1; i < p.length; i += 2) { const k = p[i].trim(), v = (p[i + 1] || '').trim(); if (v && v !== '-' || k === 'Speed Penalty' && v) out.push([k, v]); }
    return out;
  }
  function itemBody(b) {
    const out = []; let skip = false;
    b = b.replace(/<document\b[^>]*\/?>/gi, '').replace(/<\/?column\b[^>]*>/gi, '\n\n').replace(/<\/?row\b[^>]*>/gi, ' ')
      .replace(/<ul>([\s\S]*?)<\/ul>/gi, (_, l) => '\n\n\u0005' + [...l.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(x => x[1].replace(/\n/g, ' ')).join('\u0006') + '\n\n');
    for (let p of b.replace(/\|\n\s*\n\|/g, '|\n|').split(/\n\s*\n/)) {
      p = p.trim(); if (!p || p === '&nbsp;') continue;
      const tb = pipeTable(p, imd); if (tb) { out.push(tb); continue; }
      if (p.startsWith('\u0005')) { out.push(`<ul class="aon-item-list">${p.slice(1).split('\u0006').map(li => `<li>${imd(li)}</li>`).join('')}</ul>`); continue; }
      if (/^[-*]\s/.test(p)) { out.push(`<ul class="aon-item-list">${p.split(/\n(?=[-*]\s)/).map(li => `<li>${imd(li.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`); continue; }
      const h = /^#{1,6}\s+([\s\S]*)$/.exec(p) || /^<title\b[^>]*>([\s\S]*?)<\/title>$/i.exec(p);
      if (h) skip = /Specialization Effects/i.test(h[1]);
      if (skip) continue;
      if (h) { out.push(`<p class="aon-item-heading"><strong>${imd(h[1])}</strong></p>`); continue; }
      const k = /^\*\*(Activate|Craft Requirements)\*\*/.exec(p);
      out.push(`<p class="${k ? (k[1] === 'Activate' ? 'aon-item-activate' : 'aon-item-craft') : 'aon-item-text'}">${imd(p)}</p>`);
    }
    return out.join('\n');
  }
  const HEAD_SKIP = /^(Source|Activate)$/;
  const fieldLines = f => f.filter(([k]) => !HEAD_SKIP.test(k)).map(([k, v]) => `<div class="aon-stat-line"><strong>${esc(k)}</strong> ${imd(v)}</div>`).join('\n');
  const normName = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function itemHtml(m) {
    const J = rawJson(m), src = txt(J.markdown) || txt(m.RawMD) || txt(m.RawHtml);
    let price = txt(m.PriceText) || (m.PriceCp != null ? (m.PriceCp >= 100 ? m.PriceCp / 100 + ' gp' : m.PriceCp + ' cp') : null);
    let badge = 'Item ' + (m.Level ?? ''), body;
    if (src) {
      const segs = parseItemMd(src), main = segs.find(g => g.level === 1) || segs[0], vars = segs.filter(g => g.level >= 2 && g.right);
      const f = headFields(main.head), has = k => f.some(([x]) => x === k);
      const word = (/^([A-Za-z]+)\s/.exec(main.right || '') || /right="([A-Za-z]+)\s/.exec(txt(J.markdown) || '') || [])[1] || 'Item';
      const isChild = !!(J.item_parent_id || /^\w+-\d+-\d+$/.test(m.AonKey || ''));
      badge = isChild || !main.right ? `${word} ${m.Level ?? ''}` : main.right;
      if (!price && has('Price')) price = f.find(([x]) => x === 'Price')[1];
      const act = f.filter(([k]) => k === 'Activate').map(([, v]) => `<p class="aon-item-activate"><strong>Activate</strong> ${imd(v)}</p>`).join('');
      const sel = isChild ? (vars.find(v => normName(v.name) === normName(m.Name)) || vars.find(v => v.right === `${word} ${m.Level}`)) : null;
      const varHtml = vars.map(v => {
        const vf = headFields(v.head), vb = itemBody(v.body), vt = v.traits.length ? traitsHtml(v.traits) : '';
        const meta = [v.right, ...vf.filter(([k]) => k === 'Price').map(([, x]) => 'Price ' + x)].filter(Boolean).map(esc).join(' &middot; ');
        return `<div class="aon-item-variant${v === sel ? ' aon-item-variant--selected' : ''}"><div class="aon-item-variant-head"><strong>${esc(v.name)}</strong>${meta ? ' <span class="aon-item-variant-meta">' + meta + '</span>' : ''}</div>${vt}${fieldLines(vf.filter(([k]) => k !== 'Price'))}${vb}</div>`;
      }).join('\n');
      body = [
        metaP('aon-item-block-meta', m, []),
        traitsHtml([m.Rarity && m.Rarity !== 'common' ? m.Rarity : null, ...(main.traits.length ? main.traits : [m.Traits])]),
        !has('Price') && price ? line('Price', price) : '',
        fieldLines(f),
        !has('Category') && txt(m.ItemCategory) ? line('Category', [txt(m.ItemCategory), txt(m.ItemSubcategory)].filter(Boolean).join(' / ')) : '',
        act, itemBody(main.body),
        varHtml ? `<div class="aon-item-variants">${varHtml}</div>` : ''
      ].filter(Boolean).join('\n');
    } else {
      body = [
        metaP('aon-item-block-meta', m, []),
        traitsHtml([m.Rarity && m.Rarity !== 'common' ? m.Rarity : null, m.Traits]),
        line('Price', price), line('Category', [txt(m.ItemCategory), txt(m.ItemSubcategory)].filter(Boolean).join(' / ')),
        line('Bulk', txt(m.BulkText)), line('Hands', txt(m.Hands)),
        line('Damage', [txt(m.Damage) || txt(m.DamageDie), txt(m.DamageType)].filter(Boolean).join(' ')),
        line('Weapon', [txt(m.WeaponCategory), txt(m.WeaponGroup), txt(m.WeaponType)].filter(Boolean).join(', ')),
        line('Armor', [txt(m.ArmorCategory), txt(m.ArmorGroupText)].filter(Boolean).join(', ')), line('AC', txt(m.AC)),
        line('Hardness', txt(m.HardnessText) || txt(m.Hardness)), line('HP', txt(m.HPText) || txt(m.HP)),
        line('Base', txt(m.BaseItemText)), line('Spell', txt(m.SpellText)), line('Stages', txt(m.StageText)),
        txt(m.Summary) ? `<p class="aon-item-summary">${esc(m.Summary)}</p>` : txt(m.RawText) ? `<p class="aon-item-summary">${esc(m.RawText)}</p>` : ''
      ].filter(Boolean).join('\n');
    }
    return `<article class="aon-item-block"><header class="aon-item-block-banner"><h4>${esc(m.Name)}</h4><span class="aon-level-badge">${esc(badge)}</span></header><div class="aon-item-block-body">${body}</div></article>`;
  }
  const spellBadge = m => { const t = (txt(m.SpellType) || 'Spell').toLowerCase(); return (t.includes('cantrip') ? 'Cantrip' : t.includes('focus') ? 'Focus' : t.includes('ritual') ? 'Ritual' : 'Spell') + ' ' + (m.Rank ?? ''); };
  const rawJson = m => { try { return typeof m.RawJson === 'string' ? JSON.parse(m.RawJson) : (m.RawJson || {}); } catch { return {}; } };
  const humanSecs = v => { const n = Number(v); if (!Number.isFinite(n) || String(v ?? '').trim() === '') return txt(v); if (n <= 0) return null; const u = [[86400, 'day'], [3600, 'hour'], [60, 'minute'], [6, 'round']]; for (const [s, l] of u) if (n >= s && n % s === 0) { const k = n / s; return k + ' ' + l + (k === 1 ? '' : 's'); } return n + ' seconds'; };
  const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];
  const splitList = v => (Array.isArray(v) ? v : String(v ?? '').split(/\s*,\s*/)).map(txt).filter(Boolean);
  function spellChunk(s) {
    const table = pipeTable(s, md); if (table) return table;
    const lines = s.split(/\n/).map(x => x.trim()).filter(Boolean);
    const outcome = lines.length && lines.every(l => /^[-*]\s+\*\*[^*]{1,80}\*\*/.test(l) || /^\*\*[^*]{1,80}\*\*/.test(l));
    const one = html => { const boxed = window.ambaWgMd && window.ambaWgMd.titleBlock && window.ambaWgMd.titleBlock(html); return boxed || `<p class="${/^\s*<strong>\s*Heightened/i.test(html) ? 'aon-spell-heightened' : 'aon-spell-text'}">${html}</p>`; };
    if (outcome) return lines.map(l => one(md(l.replace(/^[-*]\s+/, '')))).join('');
    return one(md(s));
  }
  function spellHtml(m) {
    const J = rawJson(m), tradAll = splitList(J.tradition && J.tradition.length ? J.tradition : m.Traditions);
    const trads = tradAll.filter(t => TRADITIONS.includes(t.toLowerCase())), lists = tradAll.filter(t => !TRADITIONS.includes(t.toLowerCase()));
    const traitList = [...new Set([...(J.trait && J.trait.length ? splitList(J.trait) : splitList(m.Traits)), ...lists])];
    const duration = txt(J.duration_raw) || humanSecs(m.Duration), area = txt(J.area_raw) || (txt(m.Area) && /^\d+$/.test(txt(m.Area)) ? txt(m.Area) + '-foot' : txt(m.Area));
    const smd = txt(m.RawMD) || (txt(J.markdown) ? String(J.markdown).replace(/<title[\s\S]*?<\/title>/i, '').replace(/<traits>[\s\S]*?<\/traits>/i, '').replace(/<[^>]+>/g, '') : null);
    const head = String(smd || '').split(/^\s*---\s*$/m)[0], grab = k => { const x = new RegExp('\\*\\*' + k + '\\*\\*\\s*([^\\n]*?)(?=\\s*\\*\\*|\\n|$)').exec(head); return x ? txt(x[1].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[;.]\s*$/, '')) : null; };
    const reqs = txt(J.requirement) || grab('Requirements');
    const body = [
      metaP('aon-spell-block-meta', m, []),
      traitsHtml([m.Rarity && m.Rarity !== 'common' ? m.Rarity : null, ...traitList]),
      trads.length ? `<div class="aon-stat-line aon-spell-traditions"><strong>Traditions</strong> ${esc(trads.join(', '))}</div>` : '',
      line('Cast', [txt(m.Actions), txt(m.Components) ? '(' + txt(m.Components) + ')' : null].filter(Boolean).join(' ')),
      line('Requirements', reqs), line('Trigger', txt(m.TriggerText) || txt(J.trigger) || grab('Trigger')), line('Range', txt(m.RangeText) || grab('Range')),
      line('Area', area),
      line('Targets', txt(m.Target) || grab('Targets')), line('Defense', txt(m.Defense) || grab('Defense')), line('Duration', duration || grab('Duration')),
      ...(mdSections(smd).length ? mdSections(smd).map(spellChunk) : [
        txt(m.Summary) ? `<p class="aon-spell-summary">${esc(m.Summary)}</p>` : '',
        txt(m.Heighten) ? `<p class="aon-spell-heightened"><strong>Heightened (${esc(m.Heighten)})</strong> See source for heightened effects.</p>` : ''])
    ].filter(Boolean).join('\n');
    return `<article class="aon-spell-block"><header class="aon-spell-block-banner"><h4>${esc(m.Name)}</h4><span class="aon-level-badge">${esc(spellBadge(m))}</span></header><div class="aon-spell-block-body">${body}</div></article>`;
  }

  // ---- Feats: same AoN markup parser as items; card class aon-feat-block (green) ----
  function featHtml(m) {
    const J = rawJson(m), src = txt(J.markdown) || txt(m.RawMD) || txt(m.RawHtml);
    const act = txt(J.actions) || (/<actions\s+string="([^"]+)"/i.exec(src || '') || [])[1];
    const actHtml = act && ACT[act.toLowerCase()] ? ` <span class="aon-action" title="${esc(act)}">${ACT[act.toLowerCase()]}</span>` : '';
    let badge = 'Feat ' + (m.Level ?? ''), body;
    if (src) {
      const segs = parseItemMd(src), main = segs.find(g => g.level === 1) || segs[0];
      if (main.right) badge = main.right;
      const f = headFields(main.head);
      const desc = itemBody(main.body).replace(/<p class="aon-item-text">(<strong>Special<\/strong>)/g, '<p class="aon-feat-special">$1').replace(/class="aon-item-text"/g, 'class="aon-feat-text"');
      body = [metaP('aon-feat-block-meta', m, [txt(m.SourcePage) ? 'pg. ' + m.SourcePage : null]),
        traitsHtml([m.Rarity && m.Rarity !== 'common' ? m.Rarity : null, ...(main.traits.length ? main.traits : [m.Traits])]),
        fieldLines(f), desc].filter(Boolean).join('\n');
    } else {
      body = [metaP('aon-feat-block-meta', m, []), traitsHtml([m.Rarity && m.Rarity !== 'common' ? m.Rarity : null, m.Traits]),
        txt(m.Summary) ? `<p class="aon-feat-text">${esc(m.Summary)}</p>` : ''].filter(Boolean).join('\n');
    }
    return `<article class="aon-feat-block"><header class="aon-feat-block-banner"><h4>${esc(m.Name)}${actHtml}</h4><span class="aon-level-badge">${esc(badge)}</span></header><div class="aon-feat-block-body">${body}</div></article>`;
  }
  const TYPES = {
    monsters: { label: 'Monster', path: 'monsters', id: 'MonsterId', html: statBlockHtml, desc: m => `Creature ${m.Level}` },
    equipment: { label: 'Item', path: 'equipment', id: 'EquipmentId', html: itemHtml, desc: m => `Item ${m.Level ?? '?'}${txt(m.PriceText) ? ', ' + m.PriceText : ''}` },
    spells: { label: 'Spell', path: 'spells', id: 'SpellId', html: spellHtml, desc: m => spellBadge(m) },
    feats: { label: 'Feat', path: 'feats', id: 'FeatId', html: featHtml, desc: m => `${txt(m.FeatType) && m.FeatType !== 'Feat' ? m.FeatType + ' ' : 'Feat '}${m.Level ?? '?'}${txt(m.Traits) ? ' [' + m.Traits + ']' : ''}` }
  };
  function linkHtml(m) {
    return srcLink(m, m.Name) || esc(m.Name);
  }
  // Full record (RawMD etc.); falls back to the list row on any failure.
  async function detail(type, row) {
    const id = row[TYPES[type].id]; if (id === undefined || id === null || id === '') return row;
    try { const r = await fetch('/api/pf2/' + TYPES[type].path + '/' + encodeURIComponent(id), { headers: { accept: 'application/json' } }); if (!r.ok) return row; const d = await r.json(); return d && typeof d === 'object' && !Array.isArray(d) ? { ...row, ...d } : row; } catch { return row; }
  }
  const PAGE = 25;
  // Best match within a page: exact name, then starts-with, then word-start, then contains; ties by level then name.
  function rank(rows, q) {
    const ql = q.toLowerCase(), sc = n => { n = String(n || '').toLowerCase(); return n === ql ? 0 : n.startsWith(ql) ? 1 : new RegExp('\\b' + ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(n) ? 2 : n.includes(ql) ? 3 : 4; };
    return rows.map((m, i) => [sc(m.Name), Number(m.Level ?? m.Rank ?? 0), String(m.Name || ''), i, m]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]) || a[3] - b[3]).map(x => x[4]);
  }
  async function search(type, name, offset) {
    const r = await fetch('/api/pf2/' + TYPES[type].path + '?name=' + encodeURIComponent(name) + '&limit=' + PAGE + '&offset=' + (offset || 0), { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('PF2 API ' + r.status + ' (is dev-server.js / pf2 server running?)');
    const j = await r.json(); const rows = Array.isArray(j) ? j : (j.rows || []);
    const total = Number.isFinite(Number(j.total)) ? Number(j.total) : (offset || 0) + rows.length + (rows.length === PAGE ? 1 : 0);
    return { rows: rank(rows, name), total, offset: offset || 0 };
  }
  function pick(editor, type, q, res, insert) {
    const T = TYPES[type], { rows, total, offset } = res, last = offset + rows.length;
    if (!rows.length) { editor.notificationManager.open({ text: 'No PF2 ' + T.label.toLowerCase() + 's match "' + q + '"' + (offset ? ' on this page.' : '.'), type: 'info', timeout: 4000 }); return; }
    const go = async (api, off) => { api.block('Loading\u2026'); try { const r = await search(type, q, off); api.close(); pick(editor, type, q, r, insert); } catch (e) { api.unblock(); editor.notificationManager.open({ text: e.message, type: 'error', timeout: 5000 }); } };
    editor.windowManager.open({
      title: `PF2 ${T.label}s "${q}": ${offset + 1}\u2013${last} of ${total}`,
      body: { type: 'panel', items: [
        { type: 'htmlpanel', html: `<p style="margin:0 0 6px">Showing <b>${offset + 1}\u2013${last}</b> of <b>${total}</b> (best match first on this page)</p>` },
        { type: 'listbox', name: 'idx', label: T.label, items: rows.map((m, i) => ({ text: `${m.Name} - ${T.desc(m)}${m.SourceBook ? ' (' + m.SourceBook + ')' : ''}${m.ContentType && m.ContentType !== 'canon' ? ' [' + m.ContentType + ']' : ''}`, value: String(i) })) },
        { type: 'listbox', name: 'mode', label: 'Insert as', items: [{ text: 'Card / stat block', value: 'block' }, { text: 'Inline link', value: 'link' }] }
      ] },
      initialData: { idx: '0', mode: 'block' },
      buttons: [
        { type: 'custom', name: 'prev', text: '\u2039 Prev', align: 'start', disabled: offset <= 0 },
        { type: 'custom', name: 'next', text: 'Next \u203a', align: 'start', disabled: last >= total },
        { type: 'cancel', text: 'Cancel' }, { type: 'submit', text: 'Insert', primary: true }],
      onAction(api, det) { if (det.name === 'prev') go(api, Math.max(0, offset - PAGE)); else if (det.name === 'next') go(api, offset + PAGE); },
      async onSubmit(api) {
        const d = api.getData(), row = rows[+d.idx];
        if (preferWg() && window.ambaWg && !wgOf(row)) { api.block('Matching Wanderer\u2019s Guide\u2026'); const wid = await window.ambaWg.match(WG_TYPE[T.id], row.Name, row.AonUrl); if (wid) row.WgId = wid; }
        if (d.mode === 'link') { api.close(); return editor.insertContent(linkHtml(row)); }
        api.block('Loading full record\u2026'); const m = await detail(type, row); if (row.WgId && !m.WgId) m.WgId = row.WgId; api.close();
        const withArt = type === 'monsters' && await artOn();
        const boxed = withArt && Number(m.MonsterId) > 0 ? !(await artIsTransparent('/api/pf2/monsters/' + Number(m.MonsterId) + '/image')) : false;
        let out = actGlyphs(T.html(m, { art: withArt, boxed }));
        if (preferWg()) out = (await wgify(out)).html;
        insert(editor, out);
        if (withArt) { const ok = await fetch('/api/pf2/monsters/' + Number(m.MonsterId) + '/image/thumb').then(r => r.ok).catch(() => false); if (!ok) editor.notificationManager.open({ text: m.Name + ' has no art in the pf2 database, so the card has no picture.', type: 'warning', timeout: 5000 }); }
      }
    });
  }
  window.ambaPf2Lookup = function (editor, insert, presetType) {
    const spec = (data, msg) => ({
      title: 'PF2 Lookup' + (presetType ? ': ' + TYPES[presetType].label + 's' : ''),
      body: { type: 'panel', items: [
        { type: 'listbox', name: 'type', label: 'Type', items: [{ text: 'Monsters', value: 'monsters' }, { text: 'Items', value: 'equipment' }, { text: 'Spells', value: 'spells' }, { text: 'Feats', value: 'feats' }] },
        { type: 'input', name: 'q', label: 'Name contains' },
        { type: 'checkbox', name: 'wg', label: 'Prefer WG links' },
        { type: 'checkbox', name: 'tables', label: 'Render as tables' },
        ...(msg ? [{ type: 'htmlpanel', html: `<p class="amba-pf2-nomatch" role="status" style="margin:6px 0 0;color:#a33">${msg}</p>` }] : [])
      ] },
      initialData: data,
      onChange(api, det) { const d = api.getData(); if (det.name === 'wg') setPreferWg(d.wg); if (det.name === 'tables' && window.ambaWgMd) window.ambaWgMd.setAsTables(d.tables); },
      buttons: [{ type: 'cancel', text: 'Cancel' }, { type: 'submit', text: 'Search', primary: true }],
      async onSubmit(api) {
        const d = api.getData(), q = d.q.trim(); setPreferWg(d.wg); if (window.ambaWgMd) window.ambaWgMd.setAsTables(d.tables); if (!q) return api.focus('q');
        window.ambaPf2LastType = d.type;
        api.block('Searching\u2026');
        try {
          const res = await search(d.type, q, 0);
          // 0 results: keep the dialog open with type + name intact, inline message, focus back in the name box.
          if (!res.rows.length) { api.unblock(); api.redial(spec({ type: d.type, q: d.q, wg: d.wg, tables: d.tables }, 'No matches for \u201c' + esc(q) + '\u201d in ' + TYPES[d.type].label.toLowerCase() + 's.')); return setTimeout(() => api.focus('q'), 0); }
          api.close(); pick(editor, d.type, q, res, insert);
        } catch (e) { api.unblock(); editor.notificationManager.open({ text: e.message, type: 'error', timeout: 5000 }); }
      }
    });
    const dlg = editor.windowManager.open(spec({ type: presetType || window.ambaPf2LastType || 'monsters', q: '', wg: preferWg(), tables: !window.ambaWgMd || window.ambaWgMd.asTables() }));
    setTimeout(() => dlg.focus('q'), 0);
  };
  let artKnown = null;
  function paintArt(unlocked) {
    artKnown = !!unlocked;
    document.dispatchEvent(new CustomEvent('amba-art', { detail: artKnown }));
    document.querySelectorAll('[data-amba-art-status]').forEach(el => {
      el.textContent = artKnown ? 'Art unlocked' : 'Art locked';
      el.classList.toggle('ok', artKnown);
      el.classList.toggle('bad', !artKnown);
      el.title = artKnown ? 'Monster art is unlocked for this browser session.' : 'Monster art is locked. Use PF2 pass to unlock it for this browser session.';
    });
  }
  async function refreshArt() {
    try { paintArt(!!(await fetch('/api/pf2/art-status', { headers: { accept: 'application/json' }, credentials: 'same-origin' }).then(r => r.json())).unlocked); }
    catch { paintArt(false); }
    return artKnown;
  }
  async function artOn() {
    if (artKnown != null) return artKnown;
    return refreshArt();
  }
  window.ambaPf2ArtRefresh = refreshArt;
  window.ambaPf2Pass = function (editor) {
    editor.windowManager.open({
      title: 'PF2 pass',
      body: { type: 'panel', items: [{ type: 'input', name: 'pass', label: 'Art password', placeholder: 'Checked only against the art password' }] },
      initialData: { pass: '' },
      buttons: [{ type: 'cancel', text: 'Cancel' }, { type: 'submit', text: 'Confirm', primary: true }],
      async onSubmit(api) {
        const pass = api.getData().pass;
        api.block('Checking\u2026');
        try {
          const r = await fetch('/api/pf2/art-pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ password: pass }) });
          const j = await r.json().catch(() => ({}));
          api.unblock();
          if (!r.ok) return editor.notificationManager.open({ text: j.error || ('Pass was not accepted (HTTP ' + r.status + '). Restart dev-server.js if this server is still the old one.'), type: r.status === 429 ? 'warning' : 'error', timeout: 6000 });
          paintArt(true); api.close();
          editor.notificationManager.open({ text: 'Art pass accepted. Monster cards will include art for this browser session.', type: 'success', timeout: 5000 });
        } catch (e) { api.unblock(); editor.notificationManager.open({ text: e.message, type: 'error', timeout: 5000 }); }
      }
    });
  };
  window.ambaPf2PreferWg = preferWg; window.ambaPf2SetPreferWg = setPreferWg;
  document.addEventListener('DOMContentLoaded', () => { document.querySelectorAll('input[data-amba-prefer-wg]').forEach(i => { i.checked = preferWg(); i.addEventListener('change', () => setPreferWg(i.checked)); }); refreshArt(); });
  // Empty editable templates using the same markup/classes as the lookup cards.
  const L = (l, v) => `<div class="aon-stat-line"><strong>${l}</strong> ${v}</div>`;
  const D = '\u2014', TR = '<div class="aon-traits"><span class="aon-trait">[rarity]</span> <span class="aon-trait">[size]</span> <span class="aon-trait">[trait]</span></div>';
  window.ambaPf2Templates = {
    monster: () => `<article class="aon-stat-block stat-block"><header class="aon-stat-block-banner"><h4 class="encounter-title">Creature Name</h4><span class="aon-level-badge">Creature N</span></header><div class="aon-stat-block-body"><p class="aon-stat-block-source">Source: [book] pg. [page]</p>${TR}${L('Perception', '+[n]; [senses]')}${L('Languages', D)}${L('Skills', D)}<div class="aon-stat-row">${['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'].map(a => `<span class="aon-stat-line"><strong>${a}</strong> +0</span>`).join(' ')}</div>${L('Items', D)}<div class="aon-stat-line"><strong>AC</strong> [n]; <strong>Fort</strong> +[n], <strong>Ref</strong> +[n], <strong>Will</strong> +[n]</div><div class="aon-stat-line"><strong>HP</strong> [n]; <strong>Immunities</strong> ${D}; <strong>Weaknesses</strong> ${D}; <strong>Resistances</strong> ${D}</div>${L('[Automatic Ability]', '[effect]')}${L('Speed', '[n] feet')}${L('Melee', '<span class="aon-action" title="One Action">\u25C6</span> [weapon] +[n] ([traits]), <strong>Damage</strong> [dice] [type]')}${L('Ranged', '<span class="aon-action" title="One Action">\u25C6</span> [weapon] +[n] ([range]), <strong>Damage</strong> [dice] [type]')}${L('[Tradition] [Prepared/Spontaneous] Spells', 'DC [n], attack +[n]; <strong>[rank]</strong> [spells]')}${L('[Offensive Ability] <span class="aon-action" title="One Action">\u25C6</span>', '[effect]')}</div></article>`,
    item: () => `<article class="aon-item-block"><header class="aon-item-block-banner"><h4>Item Name</h4><span class="aon-level-badge">Item N</span></header><div class="aon-item-block-body"><p class="aon-item-block-meta">Source: [book] pg. [page]</p><div class="aon-traits"><span class="aon-trait">[trait]</span></div>${L('Price', '[n] gp')}${L('Usage', '[usage]; <strong>Bulk</strong> [n]')}<p>[Description]</p>${L('Activate <span class="aon-action" title="One Action">\u25C6</span>', '[components]; <strong>Effect</strong> [effect]')}</div></article>`,
    spell: () => `<article class="aon-spell-block"><header class="aon-spell-block-banner"><h4>Spell Name</h4><span class="aon-level-badge">Spell N</span></header><div class="aon-spell-block-body"><p class="aon-spell-block-meta">Source: [book] pg. [page]</p><div class="aon-traits"><span class="aon-trait">[trait]</span></div>${L('Traditions', '[traditions]')}${L('Cast', '<span class="aon-action" title="Two Actions">\u25C6\u25C6</span>')}${L('Range', D + '; <strong>Targets</strong> ' + D)}${L('Defense', D + '; <strong>Duration</strong> ' + D)}<p>[Description]</p>${L('Heightened (+1)', '[effect]')}</div></article>`,
    feat: () => `<article class="aon-feat-block"><header class="aon-feat-block-banner"><h4>Feat Name <span class="aon-action" title="One Action">\u25C6</span></h4><span class="aon-level-badge">Feat N</span></header><div class="aon-feat-block-body"><p class="aon-feat-block-meta">Source: [book] pg. [page]</p><div class="aon-traits"><span class="aon-trait">[trait]</span></div>${L('Prerequisites', D)}${L('Trigger', D)}${L('Requirements', D)}<p>[Description]</p>${L('Special', D)}</div></article>`
  };
  window.ambaPf2ActGlyphs = actGlyphs;
  window.ambaPf2StatBlockHtml = statBlockHtml;
  window.ambaPf2ItemHtml = itemHtml;
  window.ambaPf2SpellHtml = spellHtml;
  window.ambaPf2FeatHtml = featHtml;
  window.ambaPf2Detail = detail;
  window.ambaPf2Search = search;
})();
