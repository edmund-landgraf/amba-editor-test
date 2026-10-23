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
  function tableHtml(rows) {
    const width = Math.max(...rows.map(r => r.length));
    const pad = r => r.concat(Array(Math.max(0, width - r.length)).fill(''));
    const [head, ...body] = rows.map(pad);
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
    + 'p.wg-title-block{margin:1rem 0;border-left:2px solid color-mix(in srgb,#0e3470 65%,transparent);background:rgb(40 38 32 / .1);padding:.7rem .9rem .75rem}'
    + 'p.wg-title-block>strong:first-child{display:block;margin-bottom:.25rem;color:#1a365d;font-size:.7rem;font-weight:600;line-height:1.2;text-transform:uppercase}';
  // WGUI styles `p:has(> strong:first-child)` as a title block; mark short bold-only leads the same way (e.g. "**Counteract**" above its table).
  const para = html => /^<strong>[^<]{1,45}<\/strong>\s*$/.test(html.trim()) ? `<p class="wg-title-block">${html.trim()}</p>` : null;
  w.ambaWgMd = { split, render, tableHtml, CSS, titleBlock: para };
})(window);
