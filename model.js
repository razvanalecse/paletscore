/* PaletScore — model de calcul unic, folosit de animație, indicatori, comparații și teste.
   Convenții (diferențele față de alte modele de 1–2 găleți sau câteva secunde vin de aici):
   - pas fix DT = 0,1 s, timpul = n × DT (fără drift);
   - t = 0: transportor gol, robot liber, poziția A activă, poziția B liberă;
   - prima găleată sosește la 60 / debit secunde (7,4 găleți/min → 8,1 s), nu la t = 0;
   - ciclul robotului (60 / capacitate) începe la preluarea găleții; găleata se numără „paletizată”
     la sfârșitul ciclului, dacă acesta s-a încheiat la t ≤ durata simulată;
   - alimentarea și robotul sunt procese separate, cu acumulatoare fracționare;
   - buffer limitat (opțional): când transportorul e plin, alimentarea se oprește și găleata e reținută în amonte;
   - operatori: unul (implicit) sau doi; un operator schimbă un singur palet odată;
   - timp de schimbare fix sau variabil între min și max (distribuție uniformă, sămânță fixă, reproductibil);
   - separatorii dintre straturi nu sunt modelați. */
(function (root) {
  'use strict';

  var DT = 0.1;
  var EPS = 1e-9;
  var BIN = 10; // secunde pe coloană în diagrama de timp
  var STEPS_PER_BIN = Math.round(BIN / DT);
  var HOUR = 3600;

  // Reperele aplicației PURATOS (rezultate de test, nu garanții).
  var REF = {
    '13': { kg: 13, perPallet: 44, cap: 7.4 },
    '5': { kg: 5, perPallet: 100, cap: 8.6 }
  };

  // Generator pseudo-aleator reproductibil (mulberry32).
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createSim(p) {
    var hasRange = p.changeMin != null && p.changeMax != null && p.changeMax > p.changeMin;
    return {
      p: {
        feed: p.feed, cap: p.cap, perPallet: p.perPallet, changeSec: p.changeSec, cycle: 60 / p.cap,
        changeMin: hasRange ? p.changeMin : null, changeMax: hasRange ? p.changeMax : null,
        buffer: p.buffer > 0 ? p.buffer : null, operators: p.operators === 2 ? 2 : 1
      },
      rand: hasRange ? rng(p.seed || 2026) : null,
      n: 0,
      t: 0,
      feedAcc: 0,
      queue: 0,
      arrived: 0,
      held: 0, // găleți reținute în amonte cât timp bufferul a fost plin
      feedStop: 0, // secunde cu alimentarea oprită
      placed: 0,
      pallets: 0,
      waitPos: 0, // robotul așteaptă o poziție liberă
      waitFeed: 0, // robotul așteaptă găleți
      opWait: 0, // palet plin care așteaptă un operator liber (secunde)
      changeTime: 0, // timp efectiv de schimbare (secunde)
      robot: { busy: false, remain: 0, target: null, carry: 0 },
      pos: [
        { id: 'A', state: 'active', count: 0, remain: 0, dur: 0 },
        { id: 'B', state: 'free', count: 0, remain: 0, dur: 0 }
      ],
      ops: [], // indicii pozițiilor în schimbare
      op: null, // prima poziție în schimbare (pentru afișare)
      opQueue: [], // poziții pline care așteaptă un operator
      blocked: false,
      feedStopped: false,
      firstBlock: null,
      bins: [], // per 10 s: w = robot lucrează, f = așteaptă găleți, p = așteaptă poziție, q = coadă, s = alimentare oprită
      seg: [[{ t: 0, s: 'active' }], [{ t: 0, s: 'free' }]],
      last: ['active', 'free']
    };
  }

  function activeIndex(s) {
    for (var i = 0; i < s.pos.length; i++) if (s.pos[i].state === 'active') return i;
    for (var j = 0; j < s.pos.length; j++) {
      if (s.pos[j].state === 'free') { s.pos[j].state = 'active'; return j; }
    }
    return null;
  }

  function changeDuration(s) {
    var p = s.p;
    if (s.rand) return Math.round((p.changeMin + s.rand() * (p.changeMax - p.changeMin)) * 10) / 10;
    return p.changeSec;
  }

  function step(s) {
    var p = s.p;
    s.n += 1;
    s.t = s.n * DT;

    // 1. Alimentare (cu buffer limitat, dacă e definit)
    s.feedAcc += (p.feed / 60) * DT;
    s.feedStopped = false;
    while (s.feedAcc >= 1 - EPS) {
      s.feedAcc -= 1;
      if (p.buffer && s.queue >= p.buffer) { s.held += 1; s.feedStopped = true; }
      else { s.queue += 1; s.arrived += 1; }
    }
    if (p.buffer && s.queue >= p.buffer) { s.feedStopped = true; s.feedStop += DT; }

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
        r.carry = r.remain;
        if (q.count >= p.perPallet) {
          q.state = 'full';
          s.pallets += 1;
          s.opQueue.push(r.target);
        }
      }
    }

    // 3. Operatorii
    for (var oi = s.ops.length - 1; oi >= 0; oi--) {
      var c = s.pos[s.ops[oi]];
      c.remain -= DT;
      s.changeTime += DT;
      if (c.remain <= EPS) { c.state = 'free'; c.count = 0; c.remain = 0; s.ops.splice(oi, 1); }
    }
    while (s.ops.length < p.operators && s.opQueue.length) {
      var i = s.opQueue.shift();
      var d = changeDuration(s);
      s.pos[i].state = 'changing';
      s.pos[i].remain = d;
      s.pos[i].dur = d;
      s.ops.push(i);
    }
    s.op = s.ops.length ? s.ops[0] : null;
    s.opWait += s.opQueue.length * DT;

    // 4. Robotul preia următoarea găleată
    s.blocked = false;
    if (!r.busy) {
      var target = activeIndex(s);
      if (target === null) {
        s.blocked = true;
        s.waitPos += DT;
        if (!s.firstBlock) {
          var ch = s.op;
          s.firstBlock = { t: s.t, changing: ch, changingRemain: ch !== null ? s.pos[ch].remain : null, queue: s.queue, waitingOperator: s.opQueue.length > 0 && ch === null };
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

    // 5. Jurnal pentru diagrama de timp
    var bi = Math.floor((s.n - 1) / STEPS_PER_BIN);
    var b = s.bins[bi] || (s.bins[bi] = { w: 0, f: 0, p: 0, q: 0, s: 0 });
    if (r.busy) b.w += DT; else if (s.blocked) b.p += DT; else b.f += DT;
    if (s.feedStopped) b.s += DT;
    b.q = s.queue;
    for (var k = 0; k < 2; k++) {
      if (s.pos[k].state !== s.last[k]) { s.last[k] = s.pos[k].state; s.seg[k].push({ t: s.t, s: s.last[k] }); }
    }
    return s;
  }

  function runUntil(s, seconds) {
    var end = Math.round(seconds / DT);
    while (s.n < end) step(s);
    return s;
  }
  function run(p, seconds) { return runUntil(createSim(p), seconds || HOUR); }

  function runToFirstBlock(s, limitSec) {
    var end = Math.round(limitSec / DT);
    while (s.n < end) {
      step(s);
      if (s.blocked) return true;
    }
    return false;
  }

  // Parametrii simulării pornind de la datele liniei.
  function simParams(line) {
    var ref = REF[line.format];
    var capMul = line.capMul || 1;
    var base = ref
      ? { feed: line.feed, cap: ref.cap * capMul, perPallet: ref.perPallet }
      : { feed: line.feed, cap: line.feed * capMul, perPallet: line.perPallet }; // alt ambalaj: capacitate = ipoteză
    base.changeSec = line.changeSec;
    base.changeMin = line.changeMin; base.changeMax = line.changeMax; base.seed = line.seed;
    base.buffer = line.buffer || null;
    base.operators = line.operators || 1;
    return base;
  }
  function with_(line, patch) { return Object.assign({}, line, patch); }
  function runLine(line) { return run(simParams(line), HOUR); }

  function bucketKg(line) { var ref = REF[line.format]; return ref ? ref.kg : line.weight; }

  // Curba: găleți paletizate în 60 min în funcție de timpul de schimbare.
  function sweep(line, values) {
    return values.map(function (c) {
      var r = runLine(with_(line, { changeSec: c, changeMin: null, changeMax: null }));
      return { c: c, placed: r.placed, waitPos: r.waitPos, queue: r.queue };
    });
  }

  // Cel mai mic timp de schimbare (rezoluție 1 s) la care robotul ajunge să aștepte o poziție liberă în 60 min.
  function criticalChange(line, lo, hi) {
    lo = lo || 10; hi = hi || 1800;
    function waits(c) { return runLine(with_(line, { changeSec: c, changeMin: null, changeMax: null })).waitPos > 0.05; }
    if (!waits(hi)) return null;
    if (waits(lo)) return lo;
    while (hi - lo > 1) { var mid = Math.floor((lo + hi) / 2); if (waits(mid)) hi = mid; else lo = mid; }
    return hi;
  }

  // Funcția inversă: cel mai lung timp de schimbare (rezoluție 1 s) cu care se ating „target” găleți în 60 min.
  // { c: secunde } | { c: null, max: maximul posibil } dacă obiectivul nu se atinge nici la 10 s.
  function maxChangeForTarget(line, target, lo, hi) {
    lo = lo || 10; hi = hi || 1800;
    function placed(c) { return runLine(with_(line, { changeSec: c, changeMin: null, changeMax: null })).placed; }
    var best = placed(lo);
    if (best < target) return { c: null, max: best };
    if (placed(hi) >= target) return { c: hi, capped: true, max: best };
    while (hi - lo > 1) { var mid = Math.floor((lo + hi) / 2); if (placed(mid) >= target) lo = mid; else hi = mid; }
    return { c: lo, max: best };
  }

  // Rulări repetate cu timp de schimbare variabil (sămânță fixă → rezultate reproductibile).
  function variability(line, min, max, runs, seed) {
    var out = [];
    for (var i = 0; i < runs; i++) {
      var r = runLine(with_(line, { changeMin: min, changeMax: max, seed: (seed || 2026) + i * 7919 }));
      out.push({ placed: r.placed, waitPos: r.waitPos, queue: r.queue, blocked: r.waitPos > 0.05 });
    }
    var sorted = out.map(function (o) { return o.placed; }).sort(function (a, b) { return a - b; });
    function q(f) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(f * (sorted.length - 1))))]; }
    return {
      runs: out, min: sorted[0], max: sorted[sorted.length - 1], median: q(0.5), p10: q(0.1), p90: q(0.9),
      blockedShare: out.filter(function (o) { return o.blocked; }).length / runs
    };
  }

  // „Unde merită să intervii?” — aceeași oră, câte o intervenție pe rând.
  function interventions(line) {
    var base = runLine(line);
    var opts = [
      { id: 'faster', label: 'Schimbare de palet cu 30% mai rapidă', detail: fmt(line.changeSec) + ' s → ' + fmt(Math.round(line.changeSec * 0.7)) + ' s', hyp: false, line: with_(line, { changeSec: Math.round(line.changeSec * 0.7), changeMin: line.changeMin ? line.changeMin * 0.7 : null, changeMax: line.changeMax ? line.changeMax * 0.7 : null }) },
      { id: 'operator', label: 'Al doilea operator la schimbare', detail: 'două schimbări pot rula în paralel', hyp: false, line: with_(line, { operators: 2 }) },
      { id: 'capacity', label: 'Robot cu 10% mai rapid', detail: 'ipoteză, nevalidată pentru UR20', hyp: true, line: with_(line, { capMul: (line.capMul || 1) * 1.1 }) }
    ];
    if (line.buffer) opts.push({ id: 'buffer', label: 'Buffer mai mare pe transportor', detail: fmt(line.buffer) + ' → ' + fmt(line.buffer + 10) + ' găleți', hyp: false, line: with_(line, { buffer: line.buffer + 10 }) });
    opts.forEach(function (o) {
      var r = runLine(o.line);
      o.res = r;
      o.dPlaced = r.placed - base.placed;
      o.dWait = r.waitPos - base.waitPos;
      o.dQueue = r.queue - base.queue;
      o.dHeld = r.held - base.held;
    });
    var best = null;
    opts.forEach(function (o) { if (o.dPlaced > 1 && (!best || o.dPlaced > best.dPlaced || (o.dPlaced === best.dPlaced && !o.hyp))) best = o; });
    return { base: base, options: opts, best: best };
  }

  // Masă cumulată teoretică manipulată manual (tone/zi).
  function ergonomics(line) {
    var p = simParams(line);
    var rate = Math.min(p.feed, p.cap);
    var kg = bucketKg(line);
    if (!(kg > 0)) return null;
    return { rate: rate, kg: kg, tonnes: (rate * kg * line.minutes * line.shifts) / 1000 };
  }

  // Concluzii pe reguli transparente. sim = rezultatul celor 60 de minute simulate.
  function evaluate(line, sim) {
    var out = [];
    var ref = REF[line.format];
    if (!ref) out.push({ level: 'warn', tag: 'Ipoteză', rule: 'Format „Alt ambalaj”', text: 'Necesită validare tehnică: nu există un reper testat pentru acest ambalaj. Simularea folosește debitul introdus ca ipoteză de capacitate.' });
    var missingPack = !ref && (!(line.weight > 0) || line.handle === 'necunoscut');
    if (missingPack) out.push({ level: 'warn', tag: 'Lipsește', rule: 'Date de ambalaj', text: 'Compatibilitatea nu poate fi evaluată încă: sarcina totală include gripperul, iar forma și mânerul trebuie validate.' });
    else if (line.handle === 'nu') out.push({ level: 'warn', tag: 'Reper PURATOS', rule: 'Găleată fără mâner', text: 'Prinderea din cazul de referință folosește poziția mânerului. Un ambalaj fără mâner necesită validarea gripperului.' });
    if (ref && line.feed > ref.cap + EPS) out.push({ level: 'risk', tag: 'Reper PURATOS', rule: 'Alimentare ' + fmt(line.feed, 1) + ' > reper ' + fmt(ref.cap, 1) + ' găleți/min', text: 'Debitul cerut depășește reperul testat. Este necesară validarea capacității.' });
    if (sim && sim.waitPos > 0.05) {
      var why = sim.opWait > 1 ? ' Din care paleți plini care au așteptat un operator liber: ' + fmtDur(sim.opWait) + '.' : '';
      out.push({ level: 'risk', tag: 'Rezultat simulat', rule: 'Ambele poziții indisponibile', text: 'Schimbarea paleților limitează fluxul. Robotul a așteptat o poziție liberă ' + fmtDur(sim.waitPos) + ' în 60 de minute.' + why });
    }
    if (sim && sim.held > 0) out.push({ level: 'risk', tag: 'Rezultat simulat', rule: 'Buffer plin', text: 'Transportorul s-a umplut, iar alimentarea a trebuit oprită ' + fmtDur(sim.feedStop) + '. ' + fmt(sim.held) + ' găleți au rămas în amonte.' });
    if (line.changeMin != null && line.changeMax != null) out.push({ level: 'info', tag: 'Ipoteză', rule: 'Schimbare variabilă ' + fmt(line.changeMin) + '–' + fmt(line.changeMax) + ' s', text: 'Rezultatul orei depinde de ordinea întârzierilor. Distribuția din rulările repetate arată cât de previzibil e fluxul.' });
    var risky = out.some(function (o) { return o.level === 'risk'; });
    if (ref && line.feed < ref.cap - EPS && !risky) out.push({ level: 'info', tag: 'Reper PURATOS', rule: 'Alimentare sub reperul testat', text: 'Robotul are rezervă de capacitate. Valoarea investiției poate veni din ergonomie și repetabilitate, nu din viteză.' });
    if (!out.length) out.push({ level: 'ok', tag: 'Rezultat simulat', rule: 'Nicio regulă de risc declanșată', text: 'Parametrii sunt în limitele aplicației de referință. Următorul pas: evaluare tehnică la fața locului.' });
    return out;
  }

  // Scenariul financiar. Câmpurile goale sunt null.
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
      if (c.tax < 100 && unit > 0) res.needed = Math.ceil((c.target / (1 - c.tax / 100) + c.other + c.promo) / unit - EPS);
    }
    return res;
  }

  // Pâlnia comercială: buget pe canale → cereri relevante → întâlniri tehnice → clienți → celule.
  // channels: [{ eur, cpr }] — cpr = cost estimat pe cerere relevantă (0/null = canalul nu aduce cereri directe).
  function funnel(channels, meetRate, winRate, cellsPerClient) {
    var total = 0, requests = 0;
    channels.forEach(function (ch) { total += ch.eur || 0; if (ch.cpr > 0) requests += (ch.eur || 0) / ch.cpr; });
    var meetings = requests * meetRate / 100;
    var clients = meetings * winRate / 100;
    var cells = clients * cellsPerClient;
    return { total: total, requests: requests, meetings: meetings, clients: clients, cells: cells,
      costPerRequest: requests > 0 ? total / requests : null, costPerClient: clients > 0 ? total / clients : null };
  }

  // Calendarul livrărilor: comenzi pe lună (12 valori), livrare la „lead” luni după comandă,
  // cel mult „capacity” celule instalate pe lună (FIFO). Se numără doar celulele livrate în anul analizat.
  function deliveries(orders, lead, capacity) {
    var ready = [], delivered = new Array(24).fill(0), backlog = [];
    for (var m = 0; m < 24; m++) {
      if (m < 12 && orders[m] > 0) ready.push({ month: m + lead, n: orders[m] });
      var cap = capacity, queue = ready.filter(function (o) { return o.month <= m && o.n > 0; });
      queue.forEach(function (o) { var take = Math.min(cap, o.n); o.n -= take; cap -= take; delivered[m] += take; });
      backlog.push(ready.reduce(function (a, o) { return a + (o.month <= m ? o.n : 0); }, 0));
    }
    var inYear = delivered.slice(0, 12).reduce(function (a, b) { return a + b; }, 0);
    var ordered = orders.reduce(function (a, b) { return a + (b || 0); }, 0);
    var lastOrder = -1;
    for (var k = 0; k < 12; k++) if (orders[k] > 0) lastOrder = k;
    return { delivered: delivered, inYear: inYear, ordered: ordered, carried: ordered - inYear, backlog: backlog, lastUsefulOrderMonth: 11 - lead };
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
    DT: DT, BIN: BIN, HOUR: HOUR, REF: REF, rng: rng, createSim: createSim, step: step, run: run, runUntil: runUntil, runLine: runLine,
    runToFirstBlock: runToFirstBlock, simParams: simParams, with_: with_, sweep: sweep, criticalChange: criticalChange,
    maxChangeForTarget: maxChangeForTarget, variability: variability, interventions: interventions,
    ergonomics: ergonomics, evaluate: evaluate, commercial: commercial, funnel: funnel, deliveries: deliveries, fmt: fmt, fmtDur: fmtDur
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaletModel = api;
})(this);
