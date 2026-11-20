/* PaletScore — model de calcul unic, folosit de animație, indicatori, comparație și teste.
   Convenții:
   - pas fix DT = 0,1 s, timpul = n × DT (fără drift);
   - t = 0: transportor gol, robot liber, poziția A goală (devine activă), poziția B goală;
   - o găleată se numără „paletizată” la sfârșitul ciclului robotului, dacă ciclul s-a încheiat la t ≤ durata simulată;
   - alimentarea și robotul sunt procese separate, cu acumulatoare fracționare;
   - un singur operator, schimbări de palet una câte una; separatorii dintre straturi nu sunt modelați. */
(function (root) {
  'use strict';

  var DT = 0.1;
  var EPS = 1e-9;

  // Reperele aplicației PURATOS (rezultate de test, nu garanții).
  var REF = {
    '13': { kg: 13, perPallet: 44, cap: 7.4, perLayer: 11, cols: 4, rows: 3 },
    '5': { kg: 5, perPallet: 100, cap: 8.6, perLayer: 25, cols: 5, rows: 5 }
  };

  function createSim(p) {
    return {
      p: { feed: p.feed, cap: p.cap, perPallet: p.perPallet, changeSec: p.changeSec, cycle: 60 / p.cap },
      n: 0,
      t: 0,
      feedAcc: 0,
      queue: 0,
      arrived: 0,
      placed: 0,
      pallets: 0,
      waitPos: 0, // robotul așteaptă o poziție liberă
      waitFeed: 0, // robotul așteaptă găleți
      robot: { busy: false, remain: 0, target: null, carry: 0 },
      pos: [
        { id: 'A', state: 'active', count: 0, remain: 0 },
        { id: 'B', state: 'free', count: 0, remain: 0 }
      ],
      op: null, // indexul poziției în schimbare
      opQueue: [], // poziții pline care așteaptă operatorul
      blocked: false,
      firstBlock: null
    };
  }

  function activeIndex(s) {
    for (var i = 0; i < s.pos.length; i++) if (s.pos[i].state === 'active') return i;
    for (var j = 0; j < s.pos.length; j++) {
      if (s.pos[j].state === 'free') { s.pos[j].state = 'active'; return j; }
    }
    return null;
  }

  function step(s) {
    var p = s.p;
    s.n += 1;
    s.t = s.n * DT;

    // 1. Alimentare
    s.feedAcc += (p.feed / 60) * DT;
    while (s.feedAcc >= 1 - EPS) { s.feedAcc -= 1; s.queue += 1; s.arrived += 1; }

    // 2. Robotul termină ciclul în curs
    var r = s.robot;
    r.carry = 0;
    if (r.busy) {
      r.remain -= DT;
      if (r.remain <= EPS) {
        var q = s.pos[r.target];
        q.count += 1;
        s.placed += 1;
        r.busy = false;
        r.carry = r.remain; // ≤ 0, timp deja consumat din ciclul următor
        if (q.count >= p.perPallet) {
          q.state = 'full';
          s.pallets += 1;
          s.opQueue.push(r.target);
        }
      }
    }

    // 3. Operatorul
    if (s.op !== null) {
      var c = s.pos[s.op];
      c.remain -= DT;
      if (c.remain <= EPS) { c.state = 'free'; c.count = 0; c.remain = 0; s.op = null; }
    }
    if (s.op === null && s.opQueue.length) {
      var i = s.opQueue.shift();
      s.pos[i].state = 'changing';
      s.pos[i].remain = p.changeSec;
      s.op = i;
    }

    // 4. Robotul preia următoarea găleată
    s.blocked = false;
    if (!r.busy) {
      var target = activeIndex(s);
      if (target === null) {
        s.blocked = true;
        s.waitPos += DT;
        if (!s.firstBlock) {
          var ch = s.op !== null ? s.op : null;
          s.firstBlock = {
            t: s.t,
            changing: ch,
            changingRemain: ch !== null ? s.pos[ch].remain : null,
            queue: s.queue
          };
        }
      } else if (s.queue < 1) {
        s.waitFeed += DT;
      } else {
        s.queue -= 1;
        r.busy = true;
        r.target = target;
        r.remain = p.cycle + r.carry;
      }
    }
    return s;
  }

  function runUntil(s, seconds) {
    var end = Math.round(seconds / DT);
    while (s.n < end) step(s);
    return s;
  }

  function run(p, seconds) { return runUntil(createSim(p), seconds); }

  // Avansează până la primul blocaj (ambele poziții indisponibile) sau până la limită.
  function runToFirstBlock(s, limitSec) {
    var end = Math.round(limitSec / DT);
    while (s.n < end) {
      step(s);
      if (s.blocked) return true;
    }
    return false;
  }

  function cloneSim(s) { return JSON.parse(JSON.stringify(s)); }

  // Parametrii simulării pornind de la datele liniei.
  function simParams(line) {
    var ref = REF[line.format];
    if (ref) return { feed: line.feed, cap: ref.cap, perPallet: ref.perPallet, changeSec: line.changeSec };
    // Alt ambalaj: capacitatea nu e cunoscută; ipoteză = debitul introdus.
    return { feed: line.feed, cap: line.feed, perPallet: line.perPallet, changeSec: line.changeSec };
  }

  function bucketKg(line) {
    var ref = REF[line.format];
    if (ref) return ref.kg;
    return line.weight;
  }

  // Masă cumulată teoretică manipulată manual (tone/zi).
  function ergonomics(line) {
    var p = simParams(line);
    var rate = Math.min(p.feed, p.cap);
    var kg = bucketKg(line);
    if (!(kg > 0)) return null;
    var tonnes = (rate * kg * line.minutes * line.shifts) / 1000;
    return { rate: rate, kg: kg, tonnes: tonnes };
  }

  // Concluzii pe reguli transparente. sim = rezultatul celor 60 de minute simulate.
  function evaluate(line, sim) {
    var out = [];
    var ref = REF[line.format];
    if (!ref) {
      out.push({ level: 'warn', tag: 'Ipoteză', rule: 'Format „Alt ambalaj”', text: 'Necesită validare tehnică: nu există un reper testat pentru acest ambalaj. Simularea folosește debitul introdus ca ipoteză de capacitate.' });
    }
    var missingPack = !ref && (!(line.weight > 0) || line.handle === 'necunoscut');
    if (missingPack) {
      out.push({ level: 'warn', tag: 'Ipoteză', rule: 'Date de ambalaj lipsă', text: 'Compatibilitatea nu poate fi evaluată încă: sarcina totală include gripperul, iar forma și mânerul trebuie validate.' });
    } else if (line.handle === 'nu') {
      out.push({ level: 'warn', tag: 'Reper testat', rule: 'Găleată fără mâner', text: 'Prinderea din cazul de referință folosește poziția mânerului. Un ambalaj fără mâner necesită validarea gripperului.' });
    }
    if (ref && line.feed > ref.cap + EPS) {
      out.push({ level: 'risk', tag: 'Reper testat', rule: 'Alimentare ' + fmt(line.feed, 1) + ' > reper ' + fmt(ref.cap, 1) + ' găleți/min', text: 'Debitul cerut depășește reperul testat. Este necesară validarea capacității.' });
    }
    if (sim && sim.waitPos > 0.05) {
      out.push({ level: 'risk', tag: 'Rezultat simulat', rule: 'Ambele poziții indisponibile în simulare', text: 'Schimbarea paleților poate limita fluxul. Robotul a așteptat o poziție liberă ' + fmtDur(sim.waitPos) + ' în 60 de minute simulate.' });
    }
    var risky = out.some(function (o) { return o.level === 'risk'; });
    if (ref && line.feed < ref.cap - EPS && !risky) {
      out.push({ level: 'info', tag: 'Reper testat', rule: 'Alimentare sub reperul testat', text: 'Robotul are rezervă de capacitate. Valoarea investiției poate veni din ergonomie și repetabilitate, nu din viteză.' });
    }
    if (!out.length) {
      out.push({ level: 'ok', tag: 'Rezultat simulat', rule: 'Nicio regulă de risc declanșată', text: 'Parametrii sunt în limitele aplicației de referință. Următorul pas: evaluare tehnică la fața locului.' });
    }
    return out;
  }

  // Scenariul comercial. Câmpurile goale sunt null.
  function commercial(c) {
    var unit = c.price - c.cost;
    var contribution = c.cells * unit;
    var afterPromo = contribution - c.promo;
    var missing = [];
    if (c.other === null || c.other === undefined) missing.push('alte costuri anuale');
    if (c.tax === null || c.tax === undefined) missing.push('cota de impozit pe profit');
    var res = { unit: unit, contribution: contribution, afterPromo: afterPromo, missing: missing, net: null, needed: null };
    if (!missing.length) {
      var pre = afterPromo - c.other;
      res.preTax = pre;
      res.net = pre > 0 ? pre * (1 - c.tax / 100) : pre;
      if (c.tax < 100 && unit > 0) {
        res.needed = Math.ceil((c.target / (1 - c.tax / 100) + c.other + c.promo) / unit - EPS);
      }
    }
    return res;
  }

  function fmt(x, d) {
    return Number(x).toLocaleString('ro-RO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function fmtDur(sec) {
    sec = Math.round(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ' min ' + (s < 10 ? '0' : '') + s + ' s';
  }

  var api = {
    DT: DT, REF: REF, createSim: createSim, step: step, run: run, runUntil: runUntil,
    runToFirstBlock: runToFirstBlock, cloneSim: cloneSim, simParams: simParams,
    ergonomics: ergonomics, evaluate: evaluate, commercial: commercial, fmt: fmt, fmtDur: fmtDur
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaletModel = api;
})(this);
