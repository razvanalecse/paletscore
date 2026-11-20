// Teste numerice ale modelului. Rulare: node test.js
// Convenție: t = 0 cu transportor gol; se numără ciclurile încheiate la t ≤ 3600 s.
// Toleranță de discretizare: ±2 găleți, ±15 s pentru timpi.
const M = require('./model.js');
let fails = 0;
function check(name, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) fails++;
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + name + ': ' + (+actual.toFixed(2)) + ' (așteptat ' + expected + ' ± ' + tol + ')');
}
const H = 3600;

// 1. Flux stabil
let s = M.run(M.simParams({ format: '13', feed: 7.4, changeSec: 90 }), H);
check('Flux stabil — paletizate', s.placed, 443, 2);
check('Flux stabil — coadă', s.queue, 0, 1);
check('Flux stabil — așteptare poziție (s)', s.waitPos, 0, 0.01);

// 2. Schimbare lentă: umplere ≈ 44 × 60/7,4 ≈ 357 s < 420 s → așteptare ≈ 63 s / palet
s = M.createSim(M.simParams({ format: '13', feed: 7.4, changeSec: 420 }));
const blocked = M.runToFirstBlock(s, H);
check('Schimbare lentă — primul blocaj apare', blocked ? 1 : 0, 1, 0);
check('Schimbare lentă — momentul primului blocaj (s)', s.firstBlock.t, 2 * 44 * 60 / 7.4 + 60 / 7.4, 15);
s = M.run(M.simParams({ format: '13', feed: 7.4, changeSec: 420 }), H);
const perPallet = s.waitPos / Math.max(1, s.pallets - 1);
check('Schimbare lentă — așteptare medie pe palet (s)', perPallet, 63, 15);
console.log('     coadă la 60 min: ' + s.queue + ', paletizate: ' + s.placed);

// 3. Peste reper
s = M.run(M.simParams({ format: '5', feed: 11, changeSec: 90 }), H);
check('Peste reper — paletizate', s.placed, 516, 2);
check('Peste reper — coadă', s.queue, 144, 2);
const ev = M.evaluate({ format: '5', feed: 11, changeSec: 90, handle: 'da' }, s);
check('Peste reper — mesaj validare capacitate', ev.some(e => /validarea capacității/.test(e.text)) ? 1 : 0, 1, 0);

// 4. Comparație: reducerea timpului de schimbare nu ajută când limita e robotul
const a = M.run(M.simParams({ format: '5', feed: 11, changeSec: 90 }), H);
const b = M.run(M.simParams({ format: '5', feed: 11, changeSec: 30 }), H);
check('Peste reper — 90 s vs 30 s, diferență paletizate', b.placed - a.placed, 0, 1);

// 5. Comercial
let c = M.commercial({ price: 130000, cost: 110000, promo: 30000, cells: 20, other: 0, tax: 16, target: 300000 });
check('Comercial — contribuție', c.contribution, 400000, 0);
check('Comercial — după promovare', c.afterPromo, 370000, 0);
check('Comercial — profit net', c.net, 310800, 0.01);
check('Comercial — celule necesare', c.needed, 20, 0);
c = M.commercial({ price: 130000, cost: 110000, promo: 30000, cells: 20, other: 0, tax: null, target: 300000 });
check('Comercial — fără impozit → profit nedeterminat', c.net === null ? 1 : 0, 1, 0);

// 6. Ergonomie
const e = M.ergonomics({ format: '13', feed: 7.4, changeSec: 90, minutes: 420, shifts: 2 });
check('Ergonomie — tone/zi', e.tonnes, 80.808, 0.01);

// 7. Pragul critic (schimbare lentă): umplerea unui palet de 13 kg ≈ 357 s
const crit = M.criticalChange({ format: '13', feed: 7.4 });
check('Prag critic 13 kg, 7,4/min (s)', crit, 357, 15);
const crit2 = M.criticalChange({ format: '5', feed: 8.6 });
check('Prag critic 5 kg, 8,6/min (s)', crit2, 698, 15);

// 8. Jurnalul de timp acoperă ora și însumează timpul
s = M.run(M.simParams({ format: '13', feed: 7.4, changeSec: 420 }), H);
check('Jurnal — 360 coloane de 10 s', s.bins.length, 360, 0);
const tot = s.bins.reduce((a, b) => a + b.w + b.f + b.p, 0);
check('Jurnal — timp total (s)', tot, 3600, 0.5);
const pw = s.bins.reduce((a, b) => a + b.p, 0);
check('Jurnal — așteptare poziție = KPI (s)', pw, s.waitPos, 0.5);

console.log(fails ? '\n' + fails + ' teste au eșuat' : '\nToate testele au trecut');
process.exit(fails ? 1 : 0);
