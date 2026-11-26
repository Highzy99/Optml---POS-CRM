// ---------- Protocol maths (pure functions, no DOM) ----------

const GOAL_TINT = {
  restore: '#c1ddf7', weight: '#ff8787', glow: '#ffc3d6', energy: '#ff7848',
  growth: '#92e8a6', edge: '#febffc', vitality: '#f0ea6a', sleep: '#d0b3ff', custom: '#cfd2d7'
};

const FREQS = [
  { v: '1',   label: 'Once weekly',      short: '1× week',   n: 1,   days: [0] },
  { v: '2',   label: 'Twice weekly',     short: '2× week',   n: 2,   days: [0, 3] },
  { v: '3',   label: '3× per week',      short: '3× week',   n: 3,   days: [0, 2, 4] },
  { v: '3.5', label: 'Every other day',  short: 'every 2nd day', n: 3.5, days: [0, 2, 4, 6] },
  { v: '5',   label: '5 days on, 2 off', short: '5× week',   n: 5,   days: [0, 1, 2, 3, 4] },
  { v: '7',   label: 'Daily',            short: 'daily',     n: 7,   days: [0, 1, 2, 3, 4, 5, 6] },
  { v: '14',  label: 'Twice daily',      short: '2× day',    n: 14,  days: [0, 1, 2, 3, 4, 5, 6], perDay: 2 }
];
const FREQ = Object.fromEntries(FREQS.map(f => [f.v, f]));

const WHENS = [
  ['am', 'Morning, fasted'],
  ['ampm', 'Morning and before bed'],
  ['pre', 'Pre-workout'],
  ['pm', 'Evening, before sleep'],
  ['weekly', 'Weekly injections'],
  ['any', 'Any time, kept consistent']
];
const WHEN_LABEL = Object.fromEntries(WHENS);

const SITES = ['SubQ · abdomen', 'SubQ · outer thigh', 'SubQ · near the injury', 'IM · deltoid', 'IM · outer thigh'];

const ORAL_IDS = ['slu', 'bpcarg', 'enclo'];

function num(s) {
  if (s === null || s === undefined) return null;
  const v = parseFloat(String(s).replace(/,/g, '').replace(/\s/g, ''));
  return isFinite(v) ? v : null;
}

function trimNum(v, dp) {
  return String(parseFloat(v.toFixed(dp)));
}

// Display an amount: mg below 0.1 shows as mcg; IU as whole numbers.
function fmtAmt(v, u) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  if (u === 'iu') return Math.round(v).toLocaleString('en-AU') + 'IU';
  if (v > 0 && v < 0.1) return trimNum(v * 1000, 1) + 'mcg';
  return trimNum(v, 3) + 'mg';
}

function drawText(units) {
  if (units === null || !isFinite(units)) return '—';
  const shown = fmtUnits(units);
  return shown + (shown === '1' ? ' unit · ' : ' units · ') + fmtMl(parseFloat(shown) / 100) + 'ml';
}

function parseWeekRange(label) {
  const s = String(label);
  let m = s.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  m = s.match(/(\d+)\s*\+/);
  if (m) return [parseInt(m[1], 10), Infinity];
  m = s.match(/^\s*(\d+)\s*$/);
  if (m) return [parseInt(m[1], 10), parseInt(m[1], 10)];
  return null;
}

// Which table row applies in a given week (1-based)?
function rowIndexForWeek(rows, wk) {
  let lastBefore = -1, anyParsed = false;
  for (let i = 0; i < rows.length; i++) {
    const r = parseWeekRange(rows[i][0]);
    if (!r) continue;
    anyParsed = true;
    if (wk >= r[0] && wk <= r[1]) return i;
    if (r[1] < wk) lastBefore = i;
  }
  if (!anyParsed) return 0;
  return Math.min(lastBefore + 1, rows.length - 1);
}

// ---------- Listed compound helpers ----------

function specOf(p, k) {
  const s = p.specs.find(x => x[0] === k);
  return s ? s[1] : '';
}

function isOral(p) { return ORAL_IDS.indexOf(p.id) > -1 || !!specOf(p, 'Form'); }

function vialStrength(p, idx) {
  const txt = p.sizes ? p.sizes[Math.min(idx, p.sizes.length - 1)] : (specOf(p, 'Vial') || '');
  const a = parseAmounts(txt);
  return a ? { v: a.vals[0], u: a.u } : null;
}

function listedWater(p, bac) {
  if (bacEligible(p.specs)) return bac || BAC_BASE;
  const m = specOf(p, 'Reconstitution').match(/([\d.]+)ml/);
  return m ? parseFloat(m[1]) : null;
}

function concText(vial, water) {
  if (!vial || !water) return '';
  const perMl = vial.v / water;
  const per10 = perMl / 10;
  return fmtAmt(perMl, vial.u) + ' per ml · 10 units = ' + fmtAmt(per10, vial.u);
}

function freqForCount(n) {
  const best = FREQS.reduce((a, f) => Math.abs(f.n - n) < Math.abs(a.n - n) ? f : a, FREQS[0]);
  return best.v;
}

// Best-effort conversion of a listed table into weekly-dose steps (used to prefill
// "my own titration" and to estimate how long a vial lasts).
function listedSteps(p, idx) {
  const t = p.tables[Math.min(idx, p.tables.length - 1)];
  const sch = SCHEDULE_MAP[p.id] || ['am', '', [0, 1, 2, 3, 4, 5, 6]];
  const baseN = sch[0] === 'ampm' ? 14 : sch[2].length;
  const weeklyCol = t.headers.findIndex(h => /weekly dose/i.test(h));
  const steps = [];
  t.rows.forEach(r => {
    let n = baseN, weekly = null, unit = 'mg';
    const joined = r.join(' | ');
    let m = joined.match(/×\s*(\d+)\s*injections/i);
    if (m) n = parseInt(m[1], 10);
    m = joined.match(/×\s*(\d+)\s*\/\s*week/i);
    if (m) n = parseInt(m[1], 10);
    m = joined.match(/×\s*(\d+)\s*\/\s*day/i);
    if (m) n = parseInt(m[1], 10) * 7;
    if (weeklyCol > -1 && !/×\s*\d+\s*injections/i.test(joined)) {
      const a = parseAmounts(r[weeklyCol]);
      if (a) { weekly = a.vals[0]; unit = a.u; }
    }
    if (weeklyCol > -1 && weekly === null) {
      const a = parseAmounts(r[weeklyCol]);
      if (a) { weekly = a.vals[0]; unit = a.u; }
    }
    if (weekly === null) {
      const d = rowDose(r);
      if (d) { weekly = d.vals[0] * n; unit = d.u; }
    }
    const wr = parseWeekRange(r[0]);
    const weeks = wr && isFinite(wr[1]) ? String(wr[1] - wr[0] + 1) : '';
    steps.push({ weeks, weekly: weekly === null ? '' : trimNum(weekly, 4), freq: freqForCount(n), unit, label: r[0] });
  });
  return steps;
}

// ---------- Custom ladder ----------

function computeLadder(m) {
  const unit = m.unit === 'iu' ? 'iu' : 'mg';
  const vial = num(m.vial), water = num(m.water);
  const perMl = vial > 0 && water > 0 ? vial / water : null;
  let wk = 1, open = false, total = 0, allDefined = true; const run = [];
  const rows = (m.steps || []).map((s, i) => {
    const f = FREQ[s.freq] || FREQ['1'];
    const weekly = num(s.weekly);
    const n = parseInt(s.weeks, 10);
    const per = weekly > 0 ? weekly / f.n : null;
    const units = per !== null && perMl ? per / perMl * 100 : null;
    let label, start = null, end = null;
    if (open) label = 'Then';
    else {
      start = wk;
      if (n > 0) { end = wk + n - 1; label = start === end ? 'Week ' + start : 'Weeks ' + start + '–' + end; wk += n; }
      else { label = 'Week ' + start + '+'; open = true; }
    }
    if (n > 0 && weekly > 0) { total += n * weekly; for (let k = 0; k < n; k++) run.push(weekly); } else allDefined = false;
    let warn = '';
    if (units !== null && units > 100) warn = 'More than one full 1ml syringe. Split it into two draws or use less bac water.';
    else if (units !== null && units > 0 && units < 2) warn = 'A very small draw is hard to measure. Add more bac water so each dose is bigger.';
    return {
      i, label, start, end, freq: f, weekly, per, units,
      weeklyText: weekly > 0 ? fmtAmt(weekly, unit) + ' / week' : '—',
      perText: per !== null ? fmtAmt(per, unit) : '—',
      draw: drawText(units), warn,
      vialWeeks: weekly > 0 && vial > 0 ? vial / weekly : null
    };
  });
  const firstW = rows.find(r => r.vialWeeks);
  const lastW = [...rows].reverse().find(r => r.vialWeeks);
  return {
    unit, vial, water, perMl, rows,
    conc: perMl ? fmtAmt(perMl, unit) + ' per ml · 10 units = ' + fmtAmt(perMl / 10, unit) : '',
    vialsNeeded: allDefined && vial > 0 && rows.length ? vialsForRun(run, vial) : null,
    totalWeeks: allDefined ? wk - 1 : null,
    vialStart: firstW ? firstW.vialWeeks : null,
    vialTop: lastW ? lastW.vialWeeks : null
  };
}

function rowForWeekCustom(ladder, wk) {
  const rows = ladder.rows;
  for (const r of rows) {
    if (r.start === null) continue;
    if (wk >= r.start && (r.end === null || wk <= r.end)) return r;
  }
  return rows.length ? rows[rows.length - 1] : null;
}

// ---------- How long a protocol runs and how many vials it takes ----------

// Once mixed, a vial is used within about 4 weeks (the storage rule shown across the site),
// so whatever is still in a vial 4 weeks after mixing is not counted on.
const MIXED_WEEKS = 4;

function parseDuration(txt) {
  const s = String(txt || '');
  let m = s.match(/(\d+)\s*[–-]\s*(\d+)\s*weeks?/i);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10), open: false };
  m = s.match(/(\d+)\s*\+\s*weeks?/i);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[1], 10), open: true };
  m = s.match(/(\d+)\s*weeks?/i);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[1], 10), open: false };
  return null;
}

// Vials to cover a list of weekly amounts. A dose can finish one vial and start the next.
function vialsForRun(weekly, vialAmt) {
  let vials = 0, left = 0, age = 0;
  weekly.forEach(amount => {
    if (left > 1e-9 && age >= MIXED_WEEKS) left = 0;
    let need = amount;
    while (need > 1e-9) {
      if (left <= 1e-9) { vials++; left = vialAmt; age = 0; }
      const use = Math.min(left, need); left -= use; need -= use;
    }
    age++;
  });
  return vials;
}

// Capsules a week from a cell such as "1 capsule twice daily". Null when it depends on training days.
function capsPerWeek(cell) {
  const s = String(cell || '');
  const m = s.match(/(\d+)\s*capsules?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (/twice daily/i.test(s)) return n * 14;
  const on = s.match(/(\d)\s*days on/i);
  if (on) return n * parseInt(on[1], 10);
  return /daily/i.test(s) ? n * 7 : null;
}

// it: a plan item (listed, own titration or custom). Returns the duration and, where the doses
// are known for every week of it, how many vials (or bottles of capsules) the protocol takes.
function protocolSupply(it) {
  const dur = parseDuration(it.duration);
  const word = it.oral ? 'bottle' : 'vial';
  const out = { dur, durText: it.duration || '', count: null, word, text: '', forText: '', line: it.duration || '', shelf: false };
  if (!dur) return out;
  const countFor = n => {
    const a = [];
    for (let wk = 1; wk <= n; wk++) {
      const w = it.oral ? (it.capsAt ? it.capsAt(wk) : null) : (it.weeklyAt ? it.weeklyAt(wk) : null);
      if (!(w > 0)) return null;
      a.push(w);
    }
    const total = a.reduce((x, y) => x + y, 0);
    if (it.oral) return it.bottle > 0 ? [Math.max(1, Math.ceil(total / it.bottle - 1e-9)), false] : null;
    if (!(it.vialAmt > 0)) return null;
    const v = vialsForRun(a, it.vialAmt);
    return [v, v > Math.ceil(total / it.vialAmt - 1e-9)];
  };
  const lo = countFor(dur.min), hi = dur.max === dur.min ? lo : countFor(dur.max);
  if (!lo || !hi) return out;
  out.count = [lo[0], hi[0]];
  out.shelf = lo[1] || hi[1];
  out.text = (lo[0] === hi[0] ? lo[0] : lo[0] + '–' + hi[0]) + ' ' + word + (hi[0] === 1 ? '' : 's');
  out.forText = dur.open ? 'for the first ' + dur.min + ' weeks' : '';
  out.line = out.durText + ' · ' + out.text + (out.forText ? ' ' + out.forText : '');
  return out;
}

function weeksText(w) {
  if (w === null || !isFinite(w)) return '';
  if (w < 1) return 'under a week';
  const r = Math.round(w * 2) / 2;
  return (r % 1 === 0 ? r : r.toFixed(1)) + (r === 1 ? ' week' : ' weeks');
}

// ---------- Share-link encoding ----------

function encodePlan(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodePlan(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}
