// Scrapes UT Austin dining hall menus from FoodPro and writes docs/menu.json
// in the exact format Vikram's Dining Coach reads (same as its data.json).
// Node 20+, no dependencies.  Usage: node scripts/scrape.mjs [outFile]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = process.env.FOODPRO_BASE || 'https://hf-foodpro.austin.utexas.edu/foodpro/';
const OUT = process.argv[2] || 'docs/menu.json';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; DiningCoachMenuBot/1.0; personal meal planner)',
  'Accept': 'application/json, text/javascript, */*',
  'Referer': BASE,
};

async function get(path, kind) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(new URL(path, BASE), { headers: HEADERS, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return kind === 'json' ? await res.json() : await res.text();
    } catch (e) {
      lastErr = e;
      console.warn(`Attempt ${attempt} failed: ${e.message}`);
      await new Promise(r => setTimeout(r, attempt * 5000));
    }
  }
  throw lastErr;
}

export function transform(j, hoursJs) {
  // The hours endpoint returns JavaScript that defines `diningHours`.
  const H = new Function(hoursJs + '; return diningHours;')();
  const sem = Object.keys(H)[0];
  const R = j.data_object.recipes_data;
  const used = new Set();
  const days = {};
  for (const [d, v] of Object.entries(j.days)) {
    days[d] = {};
    for (const l of v.locations) {
      const meals = {};
      for (const m of l.meals) {
        let st = '';
        const items = [];
        for (const r of m.recipes) {
          if (!r.number) { st = r.name.replace(/^-+|-+$/g, '').trim(); continue; } // station header row
          items.push([st, r.number]);
          used.add(r.number);
        }
        if (items.length) meals[m.mealName] = items;
      }
      days[d][l.locationName] = meals;
    }
  }
  const num = (r, n) => {
    const x = r.nutrients && r.nutrients.find(z => z.name === n);
    return x ? Math.round(parseFloat(x.value) * 10) / 10 : null;
  };
  const rec = {};
  for (const n of used) {
    const r = R[n];
    if (!r) continue;
    rec[n] = [r.name, (r.portionSize || '') + ' ' + (r.portionUnit || ''), (r.legends || []).join(' '),
      num(r, 'Cals'), num(r, 'Prot'), num(r, 'Carb'), num(r, 'Fat-T'), num(r, 'Fiber'), num(r, 'Sugar'), num(r, 'Sod')];
  }
  return { updated: j.last_cached, semester: sem, hours: H[sem]['Dining Halls'], days, rec };
}

export function validate(d) {
  const problems = [];
  for (const k of ['updated', 'semester', 'hours', 'days', 'rec']) if (!(k in d)) problems.push(`missing ${k}`);
  const dayKeys = Object.keys(d.days || {});
  if (dayKeys.length < 5) problems.push(`only ${dayKeys.length} days`);
  for (const [day, locs] of Object.entries(d.days || {}))
    for (const hall of ['J2 Dining', 'Kins Dining'])
      if (!(hall in locs)) problems.push(`${day}: no ${hall}`);
  if (Object.keys(d.rec || {}).length <= 300) problems.push(`only ${Object.keys(d.rec || {}).length} recipes`);
  return problems;
}

async function main() {
  const [j, ht] = await Promise.all([
    get('data_all_endpoint.php?menu=1', 'json'),
    get('data_all_endpoint.php?hours=1', 'text'),
  ]);
  const d = transform(j, ht);
  const problems = validate(d);
  if (problems.length) {
    console.error('Validation failed, not writing menu:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(d));
  const dk = Object.keys(d.days);
  console.log(`OK ${d.updated} | ${dk[0]} -> ${dk[dk.length - 1]} | ${Object.keys(d.rec).length} recipes -> ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
