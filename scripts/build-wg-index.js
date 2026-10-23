#!/usr/bin/env node
// Build-time WG index (read-only). Queries the WG Postgres ONCE and writes data/wg-index.json (gitignored).
// Contains ONLY data that no WG edge function (supabase/functions/find-*) can return by the filter the editor needs:
//   aon:           AoN URL -> [{t,id,name}]   (no find-* accepts a source url filter)
//   names:         lower(name) -> id for ancestry/background/class/archetype/class_archetype/versatile_heritage
//                  (their find-* accept only id/content_sources, no name)
//   groupCounts:   item meta_data.group -> item count (find-item has no group filter)
//   creatureAbilities: lower(ability name) -> creature id that embeds it (abilities_base; no edge filter)
// Runtime then fetches the actual records through the edge functions by id.
// Re-run:  node scripts/build-wg-index.js     (after a WG content import / backfill)
// Connection: WG_DB_URL (+ WG_PSQL) for a local psql client, else docker exec into WG_DB_CONTAINER
//             (default wanderers-guide-db-1) as WG_DB_USER/WG_DB_NAME (default postgres/postgres). Reads .env.local.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
try { for (const l of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } } catch {}
function sql(q) {
  const url = process.env.WG_DB_URL, base = ['-At', '-v', 'ON_ERROR_STOP=1'];
  const [bin, args] = url ? [process.env.WG_PSQL || 'psql', [url, ...base]] : ['docker', ['exec', '-i', process.env.WG_DB_CONTAINER || 'wanderers-guide-db-1', 'psql', '-U', process.env.WG_DB_USER || 'postgres', '-d', process.env.WG_DB_NAME || 'postgres', ...base]];
  const out = cp.execFileSync(bin, args, { input: 'BEGIN READ ONLY;\n' + q + ';\nROLLBACK;\n', encoding: 'utf8', timeout: 120000, maxBuffer: 1 << 28 });
  const body = out.split(/\r?\n/).filter(l => l !== 'BEGIN' && l !== 'ROLLBACK').join('\n').trim(); return body ? JSON.parse(body) : null;
}
const URL_TABLES = ['spell', 'trait', 'creature', 'item', 'ancestry', 'background', 'archetype', 'class', 'language'];
const aon = {};
const rows = sql(`select coalesce(json_agg(r), '[]') from (${URL_TABLES.map(t => `select '${t}' t, id, name, meta_data->'source'->>'url' u from ${t} where meta_data->'source'->>'url' like 'https://2e.aonprd.com/%'`).join(' union all ')} union all select type, id, name, meta_data->'source'->>'url' from ability_block where meta_data->'source'->>'url' like 'https://2e.aonprd.com/%') r`);
for (const r of rows) { const m = /^https?:\/\/2e\.aonprd\.com\/([A-Za-z]+)\.aspx\?ID=(\d+)/i.exec(r.u); if (m) (aon['https://2e.aonprd.com/' + m[1] + '.aspx?ID=' + m[2]] ||= []).push({ t: r.t, id: r.id, name: r.name }); }
const names = {};
for (const t of ['ancestry', 'background', 'class', 'archetype', 'class_archetype', 'versatile_heritage']) {
  names[t.replace(/_/g, '-')] = Object.fromEntries((sql(`select coalesce(json_agg(json_build_array(lower(name), id) order by id desc), '[]') from ${t} where coalesce(deprecated, false) = false`) || []).map(([n, id]) => [n, id]));
}
const groupCounts = Object.fromEntries(sql("select coalesce(json_agg(json_build_array(g, n)), '[]') from (select lower(meta_data->>'group') g, count(*) n from item where meta_data->>'group' is not null group by 1) x") || []);
const creatureAbilities = Object.fromEntries((sql("select coalesce(json_agg(json_build_array(n, cid)), '[]') from (select lower(a->>'name') n, min(c.id) cid from creature c, unnest(c.abilities_base) a where coalesce(c.deprecated,false)=false and a->>'name' is not null group by 1) x") || []));
const out = { builtAt: new Date().toISOString(), source: process.env.WG_DB_URL ? 'WG_DB_URL' : 'docker:' + (process.env.WG_DB_CONTAINER || 'wanderers-guide-db-1'), aon, names, groupCounts, creatureAbilities };
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'wg-index.json'), JSON.stringify(out));
console.log(`wg-index: ${Object.keys(aon).length} aon urls, ${Object.values(names).reduce((a, o) => a + Object.keys(o).length, 0)} names, ${Object.keys(groupCounts).length} groups, ${Object.keys(creatureAbilities).length} creature abilities -> data/wg-index.json`);
