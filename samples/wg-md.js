// Shared WG/PF2 markdown table helper (ported from WanderersGuideUI src/utils/foundry-text.ts normalizeMarkdownTables +
// src/common/RichText.tsx "|\n\n|" fix, rendered like phase1-markdown.tsx ProseMarkdown: <div class="table-wrap"><table>).
// Styles mirror WanderersGuideUI src/pages/phase1/phase1.css `.ability-prose` table + bold-lead "title block" rules.
(function (w) {
  const isRow = l => /^\|.+\|\s*$/.test(l.trim());
  const isDelim = l => /^\|[\s\-:|]+\|\s*$/.test(l.trim());
  const cellsOf = l => { let s = l.trim(); if (s.startsWith('|')) s = s.slice(1); if (s.endsWith('|')) s = s.slice(0, -1); return s.split('|').map(c => c.trim()); };
  // Text -> [{table:[[...]] , header:bool} | {text}] blocks. Cell/inline content is passed through unchanged.
  function split(text) {
    const lines = String(text || '').replace(/\r/g, '').replace(/\|\n\n\|/g, '|\n|').split('\n');
    const out = []; let buf = [], rows = [];
    const flushText = () => { if (buf.length) { out.push({ text: buf.join('\n') }); buf = []; } };
    const flushRows = () => { if (!rows.length) return; const body = rows.filter((r, i) => !(i === 1 && isDelim(r))); out.push({ table: body.map(cellsOf) }); rows = []; };
    for (const raw of lines) {
      const t = raw.trim();
      if (isRow(t)) { flushText(); rows.push(t); continue; }
      if (rows.length && t === '') continue;
      flushRows(); buf.push(raw);
    }
    flushRows(); flushText();
    return out;
  }
  const TABLE_KEY = 'amba-render-tables';
  const asTables = () => { try { return localStorage.getItem(TABLE_KEY) !== '0'; } catch { return true; } };
  const setAsTables = v => { try { localStorage.setItem(TABLE_KEY, v ? '1' : '0'); } catch {} document.querySelectorAll('input[data-amba-render-tables]').forEach(i => { i.checked = !!v; }); document.dispatchEvent(new CustomEvent('amba-render-tables')); };
  function tableHtml(rows) {
    const width = Math.max(...rows.map(r => r.length));
    const pad = r => r.concat(Array(Math.max(0, width - r.length)).fill(''));
    const padded = rows.map(pad);
    const [head, ...body] = padded;
    if (!asTables()) {
      const items = padded.map(r => {
        const rest = r.slice(1).filter(Boolean).join('; ');
        const label = /<strong\b/i.test(r[0]) ? r[0] : `<strong>${r[0]}</strong>`;
        return `<li>${label}${rest ? ' ' + rest : ''}</li>`;
      });
      return `<ul class="wg-md-list">${items.join('')}</ul>`;
    }
    return `<div class="table-wrap wg-table-wrap"><table class="wg-md-table"><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  // Replace pipe-table blocks in already-inline-processed text; `para` renders the non-table text.
  function render(text, para) { return split(text).map(b => b.table ? tableHtml(b.table) : para(b.text)).join(''); }
  const CSS = '.table-wrap.wg-table-wrap{overflow-x:auto;margin:1rem 0;border:1px solid rgb(40 38 32 / .22);background:#f4f1ea}'
    + 'table.wg-md-table{width:100%;margin:0;border-collapse:collapse;font-size:.75rem;font-variant-numeric:tabular-nums;text-align:center;border:0}'
    + 'table.wg-md-table thead th{border:0;border-bottom:1px solid rgb(40 38 32 / .22);padding:.4rem .45rem;color:#1a365d;font-size:.65rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;background:none;text-align:center}'
    + 'table.wg-md-table thead th:first-child,table.wg-md-table tbody td:first-child{text-align:left;font-weight:600}'
    + 'table.wg-md-table tbody td{border:0;border-bottom:1px solid rgb(40 38 32 / .22);padding:.35rem .45rem;vertical-align:middle;white-space:nowrap;text-align:center}'
    + 'table.wg-md-table tbody tr:nth-child(even),table.wg-md-table tbody tr:hover{background:rgb(40 38 32 / .1)}'
    + 'ul.wg-md-list{margin:.35rem 0 .6rem;padding-left:1.25rem}ul.wg-md-list li{margin:.12rem 0}'
    + 'p.wg-title-block{margin:.35rem 0;border-left:2px solid color-mix(in srgb,#0e3470 65%,transparent);background:rgb(40 38 32 / .1);padding:.28rem .55rem .32rem}'
    + 'p.wg-title-block>strong:first-child{display:block;margin-bottom:.05rem;color:#1a365d;font-size:.68rem;font-weight:600;line-height:1.15;text-transform:uppercase}';
  // WGUI styles `p:has(> strong:first-child)` as a title block: the lead <strong> is an uppercase label
  // and the rest of the paragraph sits under it (Critical Success, Requirements, a lone "**Counteract**").
  const LEAD = /^<strong>[^<]{1,80}<\/strong>/;
  const para = html => asTables() && LEAD.test(html.trim()) ? `<p class="wg-title-block">${html.trim()}</p>` : null;
  // A bold lead on its own line starts a new block even when the source used a single newline.
  function prose(text) {
    const bits = [];
    for (const block of String(text || '').split(/\n{2,}/)) {
      let buf = [];
      const flush = () => {
        if (!buf.length) return;
        const html = buf.join('\n').trim();
        bits.push(html.startsWith('---') ? '<hr>' : para(html) || `<p>${html.replace(/\n/g, '<br>')}</p>`);
        buf = [];
      };
      for (const line of block.split('\n')) {
        if (LEAD.test(line.trim()) && buf.length) flush();
        if (line.trim()) buf.push(line);
      }
      flush();
    }
    return bits.join('');
  }
  w.ambaWgMd = { split, render, tableHtml, CSS, titleBlock: para, prose, asTables, setAsTables };
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('input[data-amba-render-tables]').forEach(i => { i.checked = asTables(); i.addEventListener('change', () => setAsTables(i.checked)); }));
})(window);
