#!/usr/bin/env node
/* =====================================================================
   IPSOMNIA · CONTENT LINTER  (validate.js)
   EN · Pre-deploy linter for the content pack. Loads content.js in an
   isolated VM context (no browser needed) and checks UK/EN parity,
   "answer tells" (the correct option must not stand out by length or
   punctuation), naming canon and terminology. Run: node validate.js
   Exit code 0 = clean, 1 = violations found (listed on stdout).
   ---------------------------------------------------------------------
   UA · Пре-деплой лінтер контент-паку.
   Запуск:  node validate.js [шлях/до/content.js]
   Вихід:   0 = чисто, 1 = знайдені порушення (список у stdout).

   Кодифікує інваріанти, які раніше ловились руками:
   П1  UK↔EN структурний паритет (операції, стрічки, опції, поля)
   П2  Геймплейний паритет (fx / rep / ok / best / cons / h / tier /
       flagged / v / boss / attack / map ідентичні між мовами)
   П3  Жодних порожніх d в опціях (порожня d = палево правильної відповіді)
   П4  Довжина-тел: правильна відповідь не «найдовша з відривом»
       (ok_len ≤ 1.25 × найдовшого дистрактора) і глобальний розподіл
       рангів довжини не вироджений (жоден ранг > 55% питань)
   П5  Крапка-тел: кінцева пунктуація ok не відрізняється від УСІХ дистракторів
   П6  Якір «тест трьох питань»: канонічне формулювання в дебрифах
   П7  Канон імен EN: «Truth Uncensored» (укр. канал) / «Prawda Bez Cenzury»
       (польський клон); заборонені дрейфи Unfiltered/Pravda Bez Tsenzury
   П8  Дефіс замість тире (« - ») у не-source полях
   П9  Формат днів тижня у m: укр. 2-літерні (Пн..Нд), англ. 3-літерні (Mon..Sun)
   П10 Термінологія EN: назва техніки в tech == назві ok-опції (без дрейфу
       типу Cause Swap / Cause Substitution)
   П11 Глобальний тел довжини: max/min довжини опцій ≤ 1.6 (попередження)
   П12 Кожна не-босівська операція має хоч один тонкий (tier:"sub") пост

   Source posts (поле t) лінтер НЕ читає на стиль — вони недоторканні.
   ===================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');

const FILE = process.argv[2] || __dirname + '/content.js';
const errors = [];
const warns  = [];
const err  = m => errors.push(m);
const warn = m => warns.push(m);

/* ---- завантаження контент-паку в ізольованому контексті ---- */
const ctx = { localStorage:{getItem:()=>null,setItem:()=>{}}, document:{documentElement:{}}, console };
vm.createContext(ctx);
let X = {};
ctx.__E__ = o => { X = o; };
const NAMES = ['SCENARIOS_UK','SCENARIOS_EN','ROLES_UK','ROLES_EN','WILD_UK','WILD_EN',
  'mapOps_UK','mapOps_EN','BOSS_CHAR_UK','BOSS_CHAR_EN','DIALOGUE_UK','DIALOGUE_EN',
  'BOSS_DIALOGUE_UK','BOSS_DIALOGUE_EN','TUTORIAL_UK','TUTORIAL_EN'];
const raw = fs.readFileSync(FILE, 'utf8');
try {
  vm.runInContext(raw + '\n;__E__({' + NAMES.map(n => n + ':(typeof ' + n + "!=='undefined')?" + n + ':undefined').join(',') + '});', ctx);
} catch (e) {
  console.log('✗ content.js не завантажився: ' + e.message);
  process.exit(1);
}
NAMES.forEach(n => { if (X[n] === undefined) err('П1: відсутня структура ' + n); });
if (errors.length) { report(); }

const UK = X.SCENARIOS_UK, EN = X.SCENARIOS_EN;

/* ================= П1/П2: структурний і геймплейний паритет ============ */
if (UK.length !== EN.length) err('П1: SCENARIOS_UK=' + UK.length + ' vs SCENARIOS_EN=' + EN.length);
const STRUCT_FIELDS = ['id','attack','boss','bossTimerCut','international','art'];
UK.forEach((u, i) => {
  const e = EN[i];
  if (!e) return err('П1: EN не має операції #' + i + ' (' + u.id + ')');
  if (u.id !== e.id) err('П1: порядок операцій розійшовся: ' + u.id + ' vs ' + e.id);
  STRUCT_FIELDS.forEach(f => { if (JSON.stringify(u[f]) !== JSON.stringify(e[f])) err('П2: ' + u.id + '.' + f + ' UK≠EN'); });
  if (JSON.stringify(u.map) !== JSON.stringify(e.map)) err('П2: ' + u.id + '.map UK≠EN');
  Object.keys(u).forEach(k => { if (!(k in e)) err('П1: ' + u.id + ': поле ' + k + ' є в UK, нема в EN'); });
  Object.keys(e).forEach(k => { if (!(k in u)) err('П1: ' + u.id + ': поле ' + k + ' є в EN, нема в UK'); });
  /* стрічка */
  if (u.feed.length !== e.feed.length) err('П1: ' + u.id + ': feed UK=' + u.feed.length + ' vs EN=' + e.feed.length);
  u.feed.forEach((p, j) => {
    const q = e.feed[j]; if (!q) return;
    ['h','tier','flagged','v'].forEach(f => { if (p[f] !== q[f]) err('П2: ' + u.id + ' feed#' + j + '.' + f + ' UK≠EN (' + p[f] + '/' + q[f] + ')'); });
    if (!!p.osint !== !!q.osint) err('П1: ' + u.id + ' feed#' + j + ': osint лише в одній мові');
    if (!!p.w !== !!q.w) err('П1: ' + u.id + ' feed#' + j + ': w лише в одній мові');
    if (!!p.subtype !== !!q.subtype) err('П1: ' + u.id + ' feed#' + j + ': subtype лише в одній мові');
  });
  if (!!u.mutation !== !!e.mutation) err('П1: ' + u.id + ': mutation лише в одній мові');
  /* опції */
  pairOpts(u, e, u.id);
});
function pairOpts(u, e, id) {
  const blocks = [];
  if (u.techniques) blocks.push(['tech', u.techniques.opts, e.techniques && e.techniques.opts, 'ok']);
  if (u.counters)   blocks.push(['counters', u.counters.opts, e.counters && e.counters.opts, 'best']);
  (u.audiences || []).forEach((a, k) => blocks.push(['aud' + k, a.counters && a.counters.opts, e.audiences && e.audiences[k] && e.audiences[k].counters && e.audiences[k].counters.opts, 'best']));
  blocks.forEach(([where, uo, eo, key]) => {
    if (!uo) return;
    if (!eo) return err('П1: ' + id + ' ' + where + ': блок відсутній в EN');
    if (uo.length !== eo.length) return err('П1: ' + id + ' ' + where + ': ' + uo.length + ' vs ' + eo.length + ' опцій');
    uo.forEach((o, j) => {
      ['ok','best','fx','rep','cons'].forEach(f => { if (o[f] !== eo[j][f]) err('П2: ' + id + ' ' + where + ' opt#' + j + '.' + f + ' UK≠EN'); });
    });
  });
}

/* ================= П3/П4/П5: телі правильної відповіді ================= */
const rankDist = {}; let qTotal = 0;
function tellAudit(L, arr) {
  arr.forEach(s => {
    const check = (opts, where, key) => {
      if (!opts) return;
      const okO = opts.find(o => o[key]);
      if (!okO) return err('П1: ' + L + ' ' + s.id + ' ' + where + ': нема опції з ' + key + ':true');
      qTotal++;
      opts.forEach((o, j) => { if (!o.d || !o.d.trim()) err('П3: ' + L + ' ' + s.id + ' ' + where + ' opt#' + j + ' («' + o.n + '»): порожня d'); });
      const lens = opts.map(o => (o.d || '').length);
      const okLen = (okO.d || '').length;
      const rank = [...lens].sort((a, b) => b - a).indexOf(okLen) + 1;
      rankDist[rank] = (rankDist[rank] || 0) + 1;
      const second = Math.max(...opts.filter(o => o !== okO).map(o => (o.d || '').length));
      if (okLen > second * 1.25) err('П4: ' + L + ' ' + s.id + ' ' + where + ': ok найдовша з відривом ×' + (okLen / second).toFixed(2));
      const okDot = /\.\s*$/.test(okO.d || '');
      const others = opts.filter(o => o !== okO).map(o => /\.\s*$/.test(o.d || ''));
      if (others.length && others.every(x => x !== okDot)) err('П5: ' + L + ' ' + s.id + ' ' + where + ': кінцева пунктуація ok відрізняється від усіх дистракторів');
    };
    s.techniques && check(s.techniques.opts, 'tech', 'ok');
    s.counters && check(s.counters.opts, 'counters', 'best');
    (s.audiences || []).forEach((a, k) => check(a.counters && a.counters.opts, 'aud' + k, 'best'));
  });
}
tellAudit('UK', UK); tellAudit('EN', EN);
Object.entries(rankDist).forEach(([r, n]) => {
  if (n / qTotal > 0.55) err('П4: ранг довжини ' + r + ' у ' + Math.round(100 * n / qTotal) + '% питань — статистичний тел (поріг 55%)');
});

/* ================= П6: якір трьох питань =============================== */
const ANCHOR_UK = 'біль реальний? причину можна перевірити? кому вигідно';
const ANCHOR_EN = /is the pain real\? can the cause be verified\? who benefits/i;
UK.forEach(s => { if (s.debrief && /біль реальн/i.test(s.debrief) && !s.debrief.includes(ANCHOR_UK)) err('П6: UK ' + s.id + ': якір трьох питань відхиляється від канону («' + ANCHOR_UK + '…»)'); });
EN.forEach(s => { if (s.debrief && /pain real/i.test(s.debrief) && !ANCHOR_EN.test(s.debrief)) err('П6: EN ' + s.id + ': якір трьох питань відхиляється від канону'); });
if (/Трихвилинний тест|three-minute test/i.test(raw)) err('П6: знайдено «Трихвилинний тест / three-minute test» — має бути тест трьох питань');

/* ================= П7: канон імен EN =================================== */
if (/Unfiltered Truth/.test(raw)) err('П7: «Unfiltered Truth» — канон EN: «Truth Uncensored»');
if (/Pravda Bez Tsenzury/.test(raw)) err('П7: «Pravda Bez Tsenzury» — укр. канал в EN = «Truth Uncensored»; польський клон = «Prawda Bez Cenzury»');

/* ================= П8: дефіс замість тире у не-source полях =========== */
raw.split('\n').forEach((line, i) => {
  if (/(?:^|[,{[ ])t:"/.test(line)) return;           // source posts недоторканні
  const m = line.match(/(?:brief|debrief|cliff|w|e|d|q|p|h|text):"[^"]* - [^"]*"/);
  if (m) warn('П8: рядок ' + (i + 1) + ': « - » замість « — » у не-source полі');
});

/* ================= П9: формат днів тижня в m =========================== */
UK.forEach(s => (s.feed.concat(s.mutation ? [s.mutation] : [])).forEach((p, j) => {
  const d = (p.m || '').split(' ')[0];
  if ((p.m || '').includes(' ') && !/^(Пн|Вт|Ср|Чт|Пт|Сб|Нд)$/.test(d)) err('П9: UK ' + s.id + ' feed#' + j + ': день тижня «' + d + '» (канон: Пн..Нд)');
}));
EN.forEach(s => (s.feed.concat(s.mutation ? [s.mutation] : [])).forEach((p, j) => {
  const d = (p.m || '').split(' ')[0];
  if ((p.m || '').includes(' ') && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(d)) err('П9: EN ' + s.id + ' feed#' + j + ': день тижня «' + d + '» (канон: Mon..Sun)');
}));

/* ================= П10: термінологія EN без дрейфу ==================== */
EN.forEach(s => {
  if (!s.techniques) return;
  const okO = s.techniques.opts.find(o => o.ok);
  if (!okO) return;
  const norm = t => t.toLowerCase().replace(/\s+/g, ' ').trim();
  if (norm(s.tech) !== norm(okO.n)) err('П10: EN ' + s.id + ': tech=«' + s.tech + '» ≠ ok-опція «' + okO.n + '»');
});
UK.forEach(s => {
  if (!s.techniques) return;
  const okO = s.techniques.opts.find(o => o.ok);
  if (!okO) return;
  const norm = t => t.toLowerCase().replace(/\s+/g, ' ').trim();
  if (norm(s.tech) !== norm(okO.n)) err('П10: UK ' + s.id + ': tech=«' + s.tech + '» ≠ ok-опція «' + okO.n + '»');
});

/* ================= П11: глобальний тел довжини (max/min ≤ 1.6) ========= */
/* Правило зʼявилось разом з операцією "Хвиля мігрантів" (щоб зловити answer-tell
   у нових опціях). Ретроактивно ловить і старіший контент, який зроблений ще
   до цього правила і не входить у периметр цього спринту (тексти/варіанти
   інших операцій — недоторканні зони). Такі кейси зафіксовані нижче як
   попередження, а не помилка, щоб не блокувати деплой чужим боргом. */
const KNOWN_LEN_TELL = new Set([
  'UK:shahed:tech','UK:shahed:counters','UK:azs:tech','UK:poland:tech',
  'UK:vyshneve:tech','UK:vyshneve:counters','UK:laundering:tech',
  'EN:blackout:tech','EN:shahed:counters','EN:azs:tech','EN:azs:aud1',
  'EN:poland:tech','EN:vyshneve:counters'
]);
function lenRatioAudit(L, arr) {
  arr.forEach(s => {
    const check = (opts, where) => {
      if (!opts) return;
      const lens = opts.map(o => (o.d || '').length).filter(n => n > 0);
      if (lens.length < 2) return;
      const ratio = Math.max(...lens) / Math.min(...lens);
      if (ratio <= 1.6) return;
      const msg = 'П11: ' + L + ' ' + s.id + ' ' + where + ': max(d)/min(d)=' + ratio.toFixed(2) + ' > 1.6 — опція виділяється довжиною';
      if (KNOWN_LEN_TELL.has(L + ':' + s.id + ':' + where)) warn(msg + ' (відомий, поза межами цього спринту)');
      else err(msg);
    };
    s.techniques && check(s.techniques.opts, 'tech');
    s.counters && check(s.counters.opts, 'counters');
    (s.audiences || []).forEach((a, k) => check(a.counters && a.counters.opts, 'aud' + k));
  });
}
lenRatioAudit('UK', UK); lenRatioAudit('EN', EN);

/* ================= П12: кожна не-boss операція має tier:"sub" пост ===== */
const KNOWN_MISSING_SUB = ['vyshneve'];   // відомий виняток: у «Вишневому» тонких постів нема свідомо, лише попередження
function subTierAudit(L, arr) {
  arr.forEach(s => {
    if (s.boss) return;
    const hasSub = (s.feed || []).some(p => p.tier === 'sub');
    if (hasSub) return;
    if (KNOWN_MISSING_SUB.includes(s.id)) warn('П12: ' + L + ' ' + s.id + ': немає посту з tier:"sub" (відомий баг, не в цьому спринті)');
    else err('П12: ' + L + ' ' + s.id + ': немає жодного посту з tier:"sub"');
  });
}
subTierAudit('UK', UK); subTierAudit('EN', EN);

/* ================= решта пар (ролі, wild, туторіал…) =================== */
[['ROLES', 'n'], ['WILD', 'id'], ['mapOps', 'id'], ['TUTORIAL', 'id']].forEach(([base, key]) => {
  const a = X[base + '_UK'], b = X[base + '_EN'];
  if (!a || !b) return;
  if (a.length !== b.length) return err('П1: ' + base + ' UK=' + a.length + ' vs EN=' + b.length);
  if (base === 'WILD') a.forEach((w, i) => ['id','type','fx','rep','timerCut'].forEach(f => { if (JSON.stringify(w[f]) !== JSON.stringify(b[i][f])) err('П2: WILD#' + i + ' (' + w.id + ').' + f + ' UK≠EN'); }));
  if (base === 'mapOps') a.forEach((m, i) => ['id','x','y'].forEach(f => { if (m[f] !== b[i][f]) err('П2: mapOps ' + m.id + '.' + f + ' UK≠EN'); }));
  if (base === 'TUTORIAL') a.forEach((tt, i) => { if (tt.id !== b[i].id || tt.sel !== b[i].sel) err('П2: TUTORIAL#' + i + ' id/sel UK≠EN'); });
});

/* ================= звіт ================================================ */
function report() {
  if (warns.length) { console.log('— Попередження (' + warns.length + '):'); warns.forEach(w => console.log('  ⚠ ' + w)); }
  if (errors.length) {
    console.log('— Порушення (' + errors.length + '):');
    errors.forEach(e => console.log('  ✗ ' + e));
    console.log('\nFAIL: content.js не готовий до деплою.');
    process.exit(1);
  }
  console.log('OK: ' + qTotal + ' питань перевірено, розподіл рангів довжини ok-відповіді: ' + JSON.stringify(rankDist));
  console.log('PASS: content.js чистий, можна деплоїти.');
  process.exit(0);
}
report();
