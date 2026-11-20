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
   - sosiri în valuri (opțional): aceeași medie pe oră, dar gălețile vin doar 40 s din fiecare 120 s, la debit triplu;
   - oră reală (opțional): momentele sosirilor și duratele schimbărilor vin dintr-un CSV, în ordinea din fișier;
   - două celule cu un operator comun (opțional): operatorul servește o singură poziție odată, după o regulă, cu timp de deplasare;
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
        buffer: p.buffer > 0 ? p.buffer : null, operators: p.operators === 2 ? 2 : 1,
        burst: p.burst || null, arrivalTimes: p.arrivalTimes || null, changeList: p.changeList || null, shared: !!p.shared
      },
      ai: 0, ci: 0, fullAt: [0, 0],
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
    if (p.changeList && p.changeList.length) { var dl = p.changeList[s.ci % p.changeList.length]; s.ci += 1; return dl; }
    if (s.rand) return Math.round((p.changeMin + s.rand() * (p.changeMax - p.changeMin)) * 10) / 10;
    return p.changeSec;
  }

  function step(s) {
    var p = s.p;
    s.n += 1;
    s.t = s.n * DT;

    // 1. Alimentare (cu buffer limitat, dacă e definit)
    s.feedStopped = false;
    if (p.arrivalTimes) {
      while (s.ai < p.arrivalTimes.length && p.arrivalTimes[s.ai] <= s.t + EPS) {
        s.ai += 1;
        if (p.buffer && s.queue >= p.buffer) { s.held += 1; s.feedStopped = true; } else { s.queue += 1; s.arrived += 1; }
      }
    }
    var rate = p.arrivalTimes ? 0 : p.feed;
    if (p.burst) rate = ((s.n - 1) % Math.round(p.burst.period / DT)) < Math.round(p.burst.on / DT) ? p.feed * p.burst.period / p.burst.on : 0;
    s.feedAcc += (rate / 60) * DT;
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
          s.fullAt[r.target] = s.t;
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
    while (!p.shared && s.ops.length < p.operators && s.opQueue.length) {
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
    base.burst = line.arrivals === 'valuri' ? { period: 120, on: 40 } : null;
    base.arrivalTimes = line.arrivalTimes || null;
    base.changeList = line.changeList || null;
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
    if (line.arrivals === 'valuri') opts.push({ id: 'regular', label: 'Sosiri regulate în loc de valuri', detail: 'aceeași medie pe oră, fără rafale', hyp: false, line: with_(line, { arrivals: 'regulat' }) });
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

  // „Ce măsurăm întâi?”: cât se mișcă rezultatul orei când fiecare dată incertă variază în intervalul declarat.
  function tornado(line) {
    var base = runLine(line).placed;
    var items = [
      { id: 'feed', label: 'Debitul real (±10%)', lo: with_(line, { feed: line.feed * 0.9 }), hi: with_(line, { feed: line.feed * 1.1 }) },
      { id: 'change', label: 'Durata schimbării (±30%)', lo: with_(line, { changeSec: Math.max(10, Math.round(line.changeSec * 0.7)) }), hi: with_(line, { changeSec: Math.round(line.changeSec * 1.3) }) },
      { id: 'arrivals', label: 'Sosiri regulate sau în valuri', lo: with_(line, { arrivals: 'regulat' }), hi: with_(line, { arrivals: 'valuri' }) },
      { id: 'operators', label: 'Operator disponibil: 1 sau 2', lo: with_(line, { operators: 1 }), hi: with_(line, { operators: 2 }) }
    ];
    if (line.buffer) items.push({ id: 'buffer', label: 'Buffer real (±50%)', lo: with_(line, { buffer: Math.max(1, Math.round(line.buffer * 0.5)) }), hi: with_(line, { buffer: Math.round(line.buffer * 1.5) }) });
    items.forEach(function (it) {
      var a = runLine(it.lo).placed, b = runLine(it.hi).placed;
      it.min = Math.min(a, b, base); it.max = Math.max(a, b, base); it.span = it.max - it.min;
    });
    items.sort(function (x, y) { return y.span - x.span; });
    return { base: base, items: items };
  }

  // „Testează-mi concluzia”: recomandarea pentru combinații de debit ±10% și schimbare ±30%.
  function robustness(line) {
    var feeds = [0.9, 1, 1.1], changes = [0.7, 1, 1.3], grid = [], same = 0, ref = interventions(line).best;
    feeds.forEach(function (f) {
      var row = [];
      changes.forEach(function (c) {
        var l = with_(line, { feed: line.feed * f, changeSec: Math.max(10, Math.round(line.changeSec * c)) });
        var b = interventions(l).best;
        row.push({ f: f, c: c, best: b ? b.id : null, label: b ? b.label : 'nicio intervenție', gain: b ? b.dPlaced : 0 });
        if ((b ? b.id : null) === (ref ? ref.id : null)) same++;
      });
      grid.push(row);
    });
    return { ref: ref ? ref.id : null, refLabel: ref ? ref.label : 'nicio intervenție', grid: grid, same: same, total: 9 };
  }

  // ---------- Ora reală din CSV ----------
  // Format: o linie pe eveniment, „sosire,<secunde de la începutul orei>” sau „schimbare,<durata în secunde>”.
  function parseCSV(text) {
    var arrivals = [], changes = [], errors = [];
    String(text || '').split(/\r?\n/).forEach(function (raw, i) {
      var ln = raw.trim();
      if (!ln || /^tip\s*[,;]/i.test(ln) || ln[0] === '#') return;
      var parts = ln.split(/[,;\t]/).map(function (x) { return x.trim(); });
      var kind = (parts[0] || '').toLowerCase(), v = parseFloat(String(parts[1] || '').replace(',', '.'));
      if (!(v >= 0) || !isFinite(v)) { errors.push('Linia ' + (i + 1) + ': valoarea nu este un număr.'); return; }
      if (kind === 'sosire') { if (v > HOUR) errors.push('Linia ' + (i + 1) + ': sosire după 3600 s, ignorată.'); else arrivals.push(v); }
      else if (kind === 'schimbare') { if (v < 5 || v > 3600) errors.push('Linia ' + (i + 1) + ': schimbare în afara intervalului 5–3600 s.'); else changes.push(v); }
      else errors.push('Linia ' + (i + 1) + ': tip necunoscut „' + parts[0] + '”. Folosește „sosire” sau „schimbare”.');
    });
    arrivals.sort(function (a, b) { return a - b; });
    return { arrivals: arrivals, changes: changes, errors: errors };
  }
  function sampleCSV(seed) {
    var r = rng(seed || 2026), lines = ['tip,valoare', '# ora fictivă: debit 7,4 găleți/min cu variație, oprire de 4 minute la minutul 20'], t = 0;
    while (t < HOUR) {
      t += 60 / 7.4 * (0.6 + r() * 0.8);
      if (t > 1200 && t < 1440) t = 1440 + r() * 5;
      if (t < HOUR) lines.push('sosire,' + t.toFixed(1));
    }
    for (var i = 0; i < 12; i++) lines.push('schimbare,' + Math.round(200 + r() * 260));
    return lines.join('\n');
  }

  // ---------- Două celule, un operator comun ----------
  // rule: 'fifo' (primul palet complet), 'block' (celula care se blochează prima), 'fixed' (alternează celulele)
  function twoCells(la, lb, rule, travel, offset) {
    var A = createSim(with_simShared(la)), B = createSim(with_simShared(lb));
    var sims = [A, B], op = { job: null, cell: 0, last: 1 }, offN = Math.round((offset || 0) / DT), end = Math.round(HOUR / DT);
    function gt(k) { return k === 0 ? A.t : B.t + offset; }
    function timeToBlock(sm) {
      if (sm.blocked) return 0;
      for (var i = 0; i < 2; i++) if (sm.pos[i].state === 'active') return (sm.p.perPallet - sm.pos[i].count) * sm.p.cycle;
      return 0;
    }
    for (var n = 0; n < end + offN; n++) {
      if (n < end) step(A);
      if (n >= offN) step(B);
      // operatorul termină deplasarea sau schimbarea
      if (op.job) {
        var j = op.job, sm = sims[j.cell], pos = sm.pos[j.idx];
        if (j.travel > 0) { j.travel -= DT; sm.opWait += DT; if (j.travel <= EPS) { var d = changeDuration(sm); pos.state = 'changing'; pos.remain = d; pos.dur = d; sm.ops.push(j.idx); } }
        else if (pos.state !== 'changing') op.job = null;
      }
      if (!op.job) {
        var cand = [];
        sims.forEach(function (sm, k) { if ((k === 0 ? n < end : n >= offN) && sm.opQueue.length) cand.push(k); });
        if (cand.length) {
          var pick = cand[0];
          if (cand.length > 1) {
            if (rule === 'block') pick = timeToBlock(A) <= timeToBlock(B) ? 0 : 1;
            else if (rule === 'fixed') pick = op.last === 0 ? 1 : 0;
            else pick = (A.fullAt[A.opQueue[0]] <= B.fullAt[B.opQueue[0]] + offset) ? 0 : 1;
          }
          var smk = sims[pick], idx = smk.opQueue.shift();
          op.job = { cell: pick, idx: idx, travel: pick !== op.cell ? (travel || 0) : 0 };
          op.cell = pick; op.last = pick;
          if (op.job.travel <= EPS) { var d2 = changeDuration(smk); smk.pos[idx].state = 'changing'; smk.pos[idx].remain = d2; smk.pos[idx].dur = d2; smk.ops.push(idx); op.job.travel = 0; }
        }
      }
    }
    return { A: A, B: B, placed: A.placed + B.placed, waitPos: A.waitPos + B.waitPos, opWait: A.opWait + B.opWait };
  }
  function with_simShared(line) { var p = simParams(line); p.shared = true; p.operators = 1; return p; }
  function bestOrganization(la, lb, travel) {
    var rules = [['fifo', 'Primul palet complet'], ['block', 'Celula care se blochează prima'], ['fixed', 'Traseu fix, alternativ']];
    var offsets = [0, 60, 120, 180, 240], out = [];
    rules.forEach(function (r) { offsets.forEach(function (o) { var res = twoCells(la, lb, r[0], travel, o); out.push({ rule: r[0], label: r[1], offset: o, placed: res.placed, waitPos: res.waitPos, opWait: res.opWait }); }); });
    out.sort(function (x, y) { return y.placed - x.placed || x.waitPos - y.waitPos; });
    var alone = runLine(la).placed + runLine(lb).placed;
    return { options: out, best: out[0], alone: alone, baseline: out.filter(function (o) { return o.rule === 'fifo' && o.offset === 0; })[0] };
  }

  // ---------- Zi cu două formate ----------
  // segments: [{ line, minutes }], changeover: minute fără producție între formate.
  function daySchedule(segments, changeover) {
    var total = 0, per = [], minutes = 0;
    segments.forEach(function (sg, i) {
      var r = run(simParams(sg.line), sg.minutes * 60);
      per.push({ format: sg.line.format, minutes: sg.minutes, placed: r.placed, pallets: r.pallets, waitPos: r.waitPos, queue: r.queue, kg: bucketKg(sg.line) });
      total += r.placed; minutes += sg.minutes;
    });
    minutes += changeover * Math.max(0, segments.length - 1);
    var tonnes = per.reduce(function (a, x) { return a + x.placed * (x.kg || 0) / 1000; }, 0);
    return { per: per, total: total, minutes: minutes, tonnes: tonnes, changeover: changeover };
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
    var SRC_REF = 'Studiul de caz Tech-Con / PURATOS: 7,4 găleți/min (13 kg), 8,6 găleți/min (5 kg), 44 și 100 găleți pe palet, rezultate de test.';
    var SRC_SIM = 'Calculat: simularea de 60 min cu pas 0,1 s (model.js), cu datele din „Linia ta”.';
    var ref = REF[line.format];
    if (!ref) out.push({ level: 'warn', tag: 'Ipoteză', rule: 'Format „Alt ambalaj”', src: 'Ipoteză a utilizatorului: capacitatea robotului = debitul introdus.', text: 'Necesită validare tehnică: nu există un reper testat pentru acest ambalaj. Simularea folosește debitul introdus ca ipoteză de capacitate.' });
    var missingPack = !ref && (!(line.weight > 0) || line.handle === 'necunoscut');
    if (missingPack) out.push({ level: 'warn', tag: 'Lipsește', rule: 'Date de ambalaj', src: 'Nevalidat: greutatea, mânerul sau materialul nu sunt completate.', text: 'Compatibilitatea nu poate fi evaluată încă: sarcina totală include gripperul, iar forma și mânerul trebuie validate.' });
    else if (line.handle === 'nu') out.push({ level: 'warn', tag: 'Reper PURATOS', rule: 'Găleată fără mâner', src: 'Studiul de caz: camera 2D identifică orientarea mânerului înainte de preluare.', text: 'Prinderea din cazul de referință folosește poziția mânerului. Un ambalaj fără mâner necesită validarea gripperului.' });
    if (ref && line.feed > ref.cap + EPS) out.push({ level: 'risk', tag: 'Reper PURATOS', rule: 'Alimentare ' + fmt(line.feed, 1) + ' > reper ' + fmt(ref.cap, 1) + ' găleți/min', src: SRC_REF + ' Regula: debit introdus > reper testat.', text: 'Debitul cerut depășește reperul testat. Este necesară validarea capacității.' });
    if (sim && sim.waitPos > 0.05) {
      var why = sim.opWait > 1 ? ' Din care paleți plini care au așteptat un operator liber: ' + fmtDur(sim.opWait) + '.' : '';
      out.push({ level: 'risk', tag: 'Rezultat simulat', rule: 'Ambele poziții indisponibile', src: SRC_SIM + ' Regula: robotul liber, fără nicio poziție activă sau liberă.', text: 'Schimbarea paleților limitează fluxul. Robotul a așteptat o poziție liberă ' + fmtDur(sim.waitPos) + ' în 60 de minute.' + why });
    }
    if (sim && sim.held > 0) out.push({ level: 'risk', tag: 'Rezultat simulat', rule: 'Buffer plin', src: SRC_SIM + ' Regula: găleți pe transportor = buffer declarat.', text: 'Transportorul s-a umplut, iar alimentarea a trebuit oprită ' + fmtDur(sim.feedStop) + '. ' + fmt(sim.held) + ' găleți au rămas în amonte.' });
    if (line.arrivals === 'valuri' && sim) out.push({ level: 'warn', tag: 'Ipoteză', rule: 'Sosiri în valuri', src: 'Ipoteză: găleți doar 40 s din fiecare 120 s, aceeași medie pe oră. ' + SRC_SIM, text: 'Media pe oră e aceeași, dar rafalele umplu transportorul. Coada maximă contează mai mult decât debitul mediu.' });
    if (line.changeMin != null && line.changeMax != null) out.push({ level: 'info', tag: 'Ipoteză', rule: 'Schimbare variabilă ' + fmt(line.changeMin) + '–' + fmt(line.changeMax) + ' s', src: 'Ipoteză: distribuție uniformă, sămânța 2026.', text: 'Rezultatul orei depinde de ordinea întârzierilor. Distribuția din rulările repetate arată cât de previzibil e fluxul.' });
    var risky = out.some(function (o) { return o.level === 'risk'; });
    if (ref && line.feed < ref.cap - EPS && !risky) out.push({ level: 'info', tag: 'Reper PURATOS', rule: 'Alimentare sub reperul testat', src: SRC_REF + ' Regula: debit introdus < reper testat.', text: 'Robotul are rezervă de capacitate. Valoarea investiției poate veni din ergonomie și repetabilitate, nu din viteză.' });
    if (!out.length) out.push({ level: 'ok', tag: 'Rezultat simulat', rule: 'Nicio regulă de risc declanșată', src: SRC_SIM, text: 'Parametrii sunt în limitele aplicației de referință. Următorul pas: evaluare tehnică la fața locului.' });
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
    maxChangeForTarget: maxChangeForTarget, variability: variability, interventions: interventions, tornado: tornado, robustness: robustness, parseCSV: parseCSV, sampleCSV: sampleCSV, twoCells: twoCells, bestOrganization: bestOrganization, daySchedule: daySchedule,
    ergonomics: ergonomics, evaluate: evaluate, commercial: commercial, funnel: funnel, deliveries: deliveries, fmt: fmt, fmtDur: fmtDur
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaletModel = api;
})(this);
