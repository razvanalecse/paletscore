// PaletScore — roluri și asistent.
// Muncitorul vede o aplicație simplă de telefon (cronometru, probleme, asistent);
// administratorul (directori, șef de tură) vede toată aplicația plus panoul de administrare.
// Fără server: conturile, măsurătorile și problemele stau în localStorage, pe acest dispozitiv.
(function () {
  'use strict';
  var M = window.PaletModel;
  var VERSION = '2.1';
  var KEY = 'paletscore.roles.v1', SKEY = 'paletscore.session.v1';
  var FUNCS_ADMIN = ['Director de producție', 'Director financiar', 'Responsabil SSM', 'Șef de tură'];
  var FUNCS_WORKER = ['Operator paletizare', 'Operator linie', 'Stivuitorist'];
  var VIEW_FOR = { 'Director de producție': 'prod', 'Director financiar': 'fin', 'Responsabil SSM': 'ssm', 'Șef de tură': 'prod' };
  var PROBLEMS = [
    { id: 'robot', icon: 'robot', label: 'Robotul s-a oprit', hint: 'nu mai ia găleți', risk: true },
    { id: 'transportor', icon: 'conveyor', label: 'Transportor plin', hint: 'gălețile se adună' },
    { id: 'paleti', icon: 'pallet', label: 'Lipsă paleți goi', hint: 'nu am cu ce schimba' },
    { id: 'ambalaj', icon: 'package', label: 'Ambalaj defect', hint: 'capac, mâner, etichetă' },
    { id: 'ssm', icon: 'alert', label: 'Accident sau pericol', hint: 'siguranța oamenilor', risk: true },
    { id: 'altceva', icon: 'dots', label: 'Altceva', hint: 'scrie pe scurt' }
  ];
  var MODEL = 'claude-opus-5-5';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.39.0/+esm';
  var AV_COLORS = ['#2b62b3', '#18794a', '#c2560a', '#6d4fb3', '#0f7c86', '#8a5a00', '#b0365e'];

  var ICONS = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9.5 13h.01M14.5 13h.01M2 13v3M22 13v3"/>',
    conveyor: '<rect x="2" y="15" width="20" height="5" rx="2.5"/><rect x="5" y="7" width="5" height="5"/><rect x="14" y="7" width="5" height="5"/>',
    pallet: '<rect x="4" y="4" width="16" height="8" rx="1"/><path d="M2 15h20M2 20h20M5 15v5M12 15v5M19 15v5"/>',
    package: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    dots: '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-7M2 20h20"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 010 7M18 14.5c2.4.6 4 2.4 4 5.5"/>',
    spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>'
  };
  function ico(name, cls) { return '<svg class="ps-ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function dur(sec) { sec = Math.round(sec); return sec < 60 ? sec + ' s' : Math.floor(sec / 60) + ' min ' + (sec % 60) + ' s'; }
  function median(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function when(ts) { var d = new Date(ts); return (isToday(ts) ? 'azi' : d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })) + ', ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }); }
  function hm(ts) { return new Date(ts).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }); }
  function isToday(ts) { return new Date(ts).toDateString() === new Date().toDateString(); }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function firstName(n) { return String(n).trim().split(/\s+/)[0]; }
  function initials(n) { var p = String(n).trim().split(/\s+/); return ((p[0] || '')[0] || '').toUpperCase() + ((p[1] || '')[0] || '').toUpperCase(); }
  function avatar(u, sm) {
    var h = 0, s = u ? u.name : '?'; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return '<span class="ps-avatar' + (sm ? ' sm' : '') + '" style="background:' + AV_COLORS[h % AV_COLORS.length] + '" aria-hidden="true">' + esc(initials(s)) + '</span>';
  }
  function on(root, sel, fn) { [].forEach.call(root.querySelectorAll(sel), function (el) { el.addEventListener('click', function (e) { fn(el, e); }); }); }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {} }

  // ---------- Date ----------
  var db = load();
  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.users) return Object.assign({ measurements: [], reports: [], ai: {} }, d); } catch (e) {}
    return { users: [], measurements: [], reports: [], ai: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Nu am putut salva pe acest dispozitiv.'); } }
  function userById(id) { return db.users.filter(function (u) { return u.id === id; })[0] || null; }
  function admins() { return db.users.filter(function (u) { return u.role === 'admin'; }); }
  function nameOf(id) { var u = userById(id); return u ? u.name : 'cont șters'; }

  // Parolele și PIN-urile se păstrează doar ca hash (SHA-256 cu id-ul ca sare).
  function hash(secret, salt) {
    var text = salt + ':' + secret;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    }
    var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Promise.resolve('f' + (h >>> 0).toString(16));
  }

  var session = null;
  function setSession(u) { session = u; try { u ? sessionStorage.setItem(SKEY, u.id) : sessionStorage.removeItem(SKEY); } catch (e) {} }
  function restore() { try { var id = sessionStorage.getItem(SKEY); var u = id && userById(id); return u && u.active !== false ? u : null; } catch (e) { return null; } }

  function toast(msg) {
    var t = $('psToast'); if (t) t.remove();
    t = document.createElement('div'); t.id = 'psToast'; t.className = 'ps-toast'; t.setAttribute('role', 'status');
    t.innerHTML = ico('check') + '<span>' + esc(msg) + '</span>';
    document.body.appendChild(t); clearTimeout(toast.tm); toast.tm = setTimeout(function () { t.remove(); }, 3000);
  }

  // Fereastră modală în locul lui prompt/confirm. opts: title, icon, html, ok, danger, field {label, type, inputmode, placeholder}, onOk(value) -> mesaj de eroare sau nimic.
  function modal(opts) {
    var prev = document.activeElement, bg = document.createElement('div');
    bg.className = 'ps-modal-bg';
    bg.innerHTML = '<div class="ps-modal" role="dialog" aria-modal="true" aria-labelledby="psMT"><h3 id="psMT">' + (opts.icon ? ico(opts.icon, 'lg') : '') + esc(opts.title) + '</h3>' +
      (opts.html ? '<div class="ps-muted">' + opts.html + '</div>' : '') +
      (opts.field ? '<label class="ps-field">' + esc(opts.field.label) + '<input id="psMI" type="' + (opts.field.type || 'text') + '" inputmode="' + (opts.field.inputmode || 'text') + '" placeholder="' + esc(opts.field.placeholder || '') + '" autocomplete="off"></label>' : '') +
      '<p class="ps-err" id="psME" aria-live="polite"></p>' +
      '<div class="acts"><button type="button" class="ps-btn" data-x>Renunț</button><button type="button" class="ps-btn ' + (opts.danger ? 'danger solid' : 'primary') + '" data-ok>' + esc(opts.ok || 'Confirmă') + '</button></div></div>';
    document.body.appendChild(bg);
    function close() { bg.remove(); document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); }
    function ok() {
      var v = opts.field ? $('psMI').value : true;
      Promise.resolve(opts.onOk ? opts.onOk(v) : null).then(function (err) { if (err) $('psME').textContent = err; else close(); });
    }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'Enter' && opts.field) ok(); }
    document.addEventListener('keydown', key);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    bg.querySelector('[data-x]').addEventListener('click', close);
    bg.querySelector('[data-ok]').addEventListener('click', ok);
    (opts.field ? $('psMI') : bg.querySelector('[data-ok]')).focus();
  }

  var LOGO = '<svg width="28" height="28" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="5" fill="var(--accent)"/><g fill="#111214"><circle cx="8" cy="8" r="2.6"/><circle cx="13" cy="8" r="2.6"/><circle cx="18" cy="8" r="2.6"/><circle cx="8" cy="13" r="2.6"/><circle cx="13" cy="13" r="2.6"/><circle cx="18" cy="13" r="2.6"/><circle cx="8" cy="18" r="2.6"/><circle cx="13" cy="18" r="2.6"/></g></svg>';

  // ---------- Autentificare ----------
  var auth = document.createElement('div');
  auth.className = 'ps-auth'; auth.id = 'psAuth';
  document.body.insertBefore(auth, document.body.firstChild);
  auth.innerHTML = '<aside class="ps-auth-side" aria-hidden="true"><div class="ps-brand">' + LOGO + 'PaletScore<small>OPS</small></div>' +
    '<h2>Paletizare<br><em>fără așteptări.</em></h2><p>Platforma care leagă linia de paletizare de conducere: oamenii măsoară și raportează, conducerea decide pe date.</p>' +
    '<ul class="ps-feats">' +
    '<li>' + ico('timer') + '<div><b>Cronometrare pe linie</b><span>Trei apăsări din telefon, fără hârtie.</span></div></li>' +
    '<li>' + ico('alert') + '<div><b>Probleme raportate pe loc</b><span>Conducerea vede imediat ce se întâmplă.</span></div></li>' +
    '<li>' + ico('chart') + '<div><b>Simulare și recomandări</b><span>Unde merită să intervii, pe aceeași oră.</span></div></li>' +
    '<li>' + ico('spark') + '<div><b>Asistent pentru fiecare rol</b><span>Răspunsuri simple pe linie, cifre pentru conducere.</span></div></li></ul>' +
    '<div class="foot"><span>PaletScore OPS v' + VERSION + '</span><span>Date stocate pe acest dispozitiv</span></div><div class="ps-hazard"></div></aside>' +
    '<main class="ps-auth-main"><div class="ps-auth-box" id="psAuthBox"></div></main>';

  function showAuth() {
    document.body.classList.add('ps-locked'); document.body.classList.remove('ps-worker', 'ps-admin');
    auth.hidden = false;
    var w = $('psWorker'); if (w) w.remove();
    clearInterval(watch.timer);
    closeChat(); fab.hidden = true;
    authRole();
  }
  function demoAccess(role, button) {
    if (demoAccess.busy) return;
    demoAccess.busy = true;
    button.disabled = true;
    var definitions = [
      { id: 'ps-public-demo-admin', name: 'Director Demo', role: 'admin', func: 'Director de producție', password: 'DemoPalet2026' },
      { id: 'ps-public-demo-worker', name: 'Operator Demo', role: 'worker', func: 'Operator paletizare', password: '2468' }
    ];
    Promise.all(definitions.map(function (definition) {
      var existing = userById(definition.id);
      if (existing) return Promise.resolve(existing);
      return hash(definition.password, definition.id).then(function (secret) {
        var user = { id: definition.id, name: definition.name, role: definition.role, func: definition.func, active: true, created: Date.now(), secret: secret, demo: true };
        db.users.push(user); return user;
      });
    })).then(function (users) {
      save();
      var selected = users.filter(function (user) { return user.role === role; })[0];
      if (selected.active === false) { button.disabled = false; toast('Contul demo este dezactivat pe acest browser.'); return; }
      login(selected);
    }).catch(function () { button.disabled = false; toast('Accesul demo nu a putut porni. Încearcă din nou.'); })
      .then(function () { demoAccess.busy = false; });
  }
  function box(html) {
    $('psAuthBox').innerHTML = '<div class="ps-brand mob">' + LOGO + 'PaletScore<small>OPS</small></div>' + html +
      '<section class="ps-demo-access" aria-labelledby="psDemoTitle"><h2 id="psDemoTitle">Testează fără configurare</h2>' +
      '<p>Conturi publice de demonstrație. Apasă pe un rol pentru acces direct.</p>' +
      '<div class="ps-demo-person"><strong>Administrator</strong><span>Nume: <b>Director Demo</b><br>Parolă: <code>DemoPalet2026</code></span>' +
      '<button class="ps-btn primary block" type="button" data-demo-role="admin">Intră ca administrator demo</button></div>' +
      '<div class="ps-demo-person"><strong>Muncitor</strong><span>Nume: <b>Operator Demo</b><br>Cod PIN: <code>2468</code></span>' +
      '<button class="ps-btn block" type="button" data-demo-role="worker">Intră ca muncitor demo</button></div>' +
      '<small>Datele demo rămân în acest browser. Poți trece de la un rol la altul folosind Ieșire.</small>' +
      (!admins().length ? '<button class="ps-link" type="button" id="psOwnAccount">Creează un cont propriu</button>' : '') + '</section>';
    on($('psAuthBox'), '[data-demo-role]', function (button) { demoAccess(button.dataset.demoRole, button); });
    var own = $('psOwnAccount'); if (own) own.addEventListener('click', authSetup);
  }
  function funcOptions(list, sel) { return list.map(function (f) { return '<option' + (f === sel ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join(''); }

  function authSetup() {
    box('<p class="ps-eyebrow">Configurare inițială</p><h1>Creează contul de administrator</h1><p class="sub">Din contul acesta adaugi apoi echipa și vezi ce se întâmplă pe linie.</p>' +
      '<form class="ps-list" id="psSetup" autocomplete="off" style="gap:14px">' +
      '<label class="ps-field">Nume complet<input id="psSName" required maxlength="40" placeholder="ex. Andrei Ionescu"></label>' +
      '<label class="ps-field">Funcția<select id="psSFunc">' + funcOptions(FUNCS_ADMIN) + '</select></label>' +
      '<label class="ps-field">Parolă <span class="hint">cel puțin 6 caractere</span><input id="psSPass" type="password" required minlength="6" autocomplete="new-password"></label>' +
      '<label class="ps-field">Confirmă parola<input id="psSPass2" type="password" required minlength="6" autocomplete="new-password"></label>' +
      '<p class="ps-err" id="psSErr" aria-live="polite"></p>' +
      '<button class="ps-btn primary block" type="submit">Creează contul ' + ico('chev') + '</button></form>' +
      '<p class="ps-secure">' + ico('lock') + 'Parola se păstrează doar criptată (hash), pe acest dispozitiv.</p>');
    $('psSetup').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('psSName').value.trim(), p = $('psSPass').value, p2 = $('psSPass2').value;
      if (!name) return ($('psSErr').textContent = 'Scrie numele.');
      if (p.length < 6) return ($('psSErr').textContent = 'Parola trebuie să aibă cel puțin 6 caractere.');
      if (p !== p2) return ($('psSErr').textContent = 'Parolele nu coincid.');
      var u = { id: uid(), name: name, role: 'admin', func: $('psSFunc').value, active: true, created: Date.now() };
      hash(p, u.id).then(function (h) { u.secret = h; db.users.push(u); save(); login(u); });
    });
  }

  function authRole() {
    box('<p class="ps-eyebrow">Bine ai venit</p><h1>Cum intri azi?</h1><div class="ps-list">' +
      '<button type="button" class="ps-card-btn" data-r="worker"><span class="ps-icon-tile">' + ico('timer', 'lg') + '</span><span class="txt">Muncitor<small>Cronometrez schimbul, anunț o problemă</small></span>' + ico('chev', 'chev') + '</button>' +
      '<button type="button" class="ps-card-btn" data-r="admin"><span class="ps-icon-tile blue">' + ico('shield', 'lg') + '</span><span class="txt">Administrator<small>Directori, responsabil SSM, șef de tură</small></span>' + ico('chev', 'chev') + '</button>' +
      '</div><p class="ps-secure">' + ico('lock') + 'Intrarea se face cu PIN (muncitori) sau parolă (administratori).</p>');
    on(auth, '[data-r]', function (b) { authNames(b.dataset.r); });
  }

  function authNames(role) {
    var list = db.users.filter(function (u) { return u.role === role && u.active !== false; });
    box('<button class="ps-back" type="button" id="psBack">' + ico('back') + 'Înapoi</button><p class="ps-eyebrow">' + (role === 'worker' ? 'Muncitor' : 'Administrator') + '</p><h1>Cine ești?</h1>' +
      (list.length ? '<div class="ps-list">' + list.map(function (u) {
        return '<button type="button" class="ps-card-btn" data-id="' + u.id + '">' + avatar(u) + '<span class="txt">' + esc(u.name) + '<small>' + esc(u.func || '') + '</small></span>' + ico('chev', 'chev') + '</button>';
      }).join('') + '</div>' : '<div class="ps-empty-mini">Niciun muncitor adăugat încă.<br>Roagă administratorul să te adauge din „Administrare → Echipa”.</div>'));
    $('psBack').addEventListener('click', authRole);
    on(auth, '[data-id]', function (b) { var u = userById(b.dataset.id); role === 'worker' ? authPin(u) : authPass(u); });
  }

  function authPin(u) {
    var pin = '';
    box('<button class="ps-back" type="button" id="psBack">' + ico('back') + 'Înapoi</button><div class="ps-who">' + avatar(u) + '<div><h1>Salut, ' + esc(firstName(u.name)) + '!</h1><p class="ps-muted">Introdu PIN-ul de 4 cifre</p></div></div>' +
      '<div class="ps-dots" id="psDots" aria-live="polite" aria-label="cifre introduse: 0 din 4"><i></i><i></i><i></i><i></i></div><p class="ps-err" id="psPErr" aria-live="polite" style="text-align:center"></p>' +
      '<div class="ps-keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (k) { return '<button type="button" class="ps-key" data-k="' + k + '">' + k + '</button>'; }).join('') +
      '<button type="button" class="ps-key fn" data-k="c">Șterge</button><button type="button" class="ps-key" data-k="0">0</button><button type="button" class="ps-key fn" data-k="b" aria-label="Șterge ultima cifră">⌫</button></div>' +
      '<p class="ps-secure">Ai uitat PIN-ul? Cere-i administratorului unul nou.</p>');
    $('psBack').addEventListener('click', function () { authNames('worker'); });
    function paint() { [].forEach.call($('psDots').children, function (d, i) { d.classList.toggle('on', i < pin.length); }); $('psDots').setAttribute('aria-label', 'cifre introduse: ' + pin.length + ' din 4'); }
    function press(k) {
      if (k === 'c') pin = ''; else if (k === 'b') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
      $('psPErr').textContent = ''; paint();
      if (pin.length === 4) {
        hash(pin, u.id).then(function (h) {
          if (h === u.secret) return login(u);
          pin = ''; paint(); $('psPErr').textContent = 'PIN greșit. Încearcă din nou.'; buzz();
          var d = $('psDots'); d.classList.remove('ps-shake'); void d.offsetWidth; d.classList.add('ps-shake');
        });
      }
    }
    on(auth, '[data-k]', function (b) { press(b.dataset.k); });
    auth.onkeydown = function (e) { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('b'); };
  }

  function authPass(u) {
    box('<button class="ps-back" type="button" id="psBack">' + ico('back') + 'Înapoi</button><div class="ps-who">' + avatar(u) + '<div><h1>' + esc(u.name) + '</h1><p class="ps-muted">' + esc(u.func || 'Administrator') + '</p></div></div>' +
      '<form class="ps-list" id="psLogin" style="gap:14px"><label class="ps-field">Parola<input id="psPass" type="password" required autocomplete="current-password"></label><p class="ps-err" id="psLErr" aria-live="polite"></p><button class="ps-btn primary block" type="submit">Intră ' + ico('chev') + '</button></form>' +
      '<p class="ps-secure">' + ico('lock') + 'Ai uitat parola? Alt administrator îți poate seta una nouă.</p>');
    $('psBack').addEventListener('click', function () { authNames('admin'); });
    $('psPass').focus();
    $('psLogin').addEventListener('submit', function (e) {
      e.preventDefault();
      hash($('psPass').value, u.id).then(function (h) { if (h === u.secret) login(u); else { $('psLErr').textContent = 'Parolă greșită.'; $('psPass').select(); } });
    });
  }

  function login(u) {
    auth.onkeydown = null; auth.hidden = true; $('psAuthBox').innerHTML = '';
    setSession(u); chat.history = []; chatReset();
    document.body.classList.remove('ps-locked');
    fab.hidden = false;
    if (u.role === 'worker') { document.body.classList.add('ps-worker'); renderWorker(); }
    else { document.body.classList.add('ps-admin'); enterAdmin(); }
    window.scrollTo(0, 0);
  }
  function logout() { setSession(null); showAuth(); }

  // ---------- Muncitor ----------
  var watch = { phase: 0, t0: 0, t1: 0, timer: null };
  var wScreen = 'cron';
  var STEP_TXT = [
    ['Paletul e plin', 'Apasă când robotul a pus ultima găleată'],
    ['Încep schimbarea', 'Apasă când începi să scoți paletul'],
    ['Gata, poziția e liberă', 'Apasă după ce ai pus paletul gol']
  ];

  function renderWorker() {
    var u = session, el = document.createElement('div');
    el.id = 'psWorker'; el.className = 'ps-wapp';
    el.innerHTML =
      '<header class="ps-appbar"><div class="in"><span class="ps-brand">' + LOGO + 'PaletScore</span><span class="me">' + avatar(u, true) + '<button class="ps-btn small" type="button" id="psOut" aria-label="Ieșire">' + ico('logout') + 'Ieșire</button></span></div></header>' +
      '<main class="ps-wmain">' +
      '<div class="ps-hello"><h1>Salut, ' + esc(firstName(u.name)) + '!</h1><p>' + esc(u.func || 'Muncitor') + ' · ' + new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) + '</p></div>' +
      // Cronometru
      '<section class="ps-panel" id="psScr-cron">' +
      '<div class="ps-surface"><div class="ps-stepper" id="psStepper"></div>' +
      '<div class="ps-timer"><div class="l" id="psTimerL">Gata de măsurat</div><div class="v" id="psClock">00:00</div></div>' +
      '<button type="button" class="ps-go" id="psGo"><b id="psGoB"></b><span id="psGoS"></span></button>' +
      '<button type="button" class="ps-link" id="psCancel" hidden>Anulează măsurătoarea</button></div>' +
      '<div class="ps-surface"><h2>Azi</h2><div class="ps-mini-stats" id="psToday"></div><ul class="ps-last" id="psLast"></ul></div></section>' +
      // Probleme
      '<section class="ps-panel" id="psScr-prob" hidden>' +
      '<div class="ps-surface"><h2>Ce s-a întâmplat?</h2><div class="ps-tiles">' + PROBLEMS.map(function (p) { return '<button type="button" class="ps-tile' + (p.risk ? ' risk' : '') + '" data-p="' + p.id + '"><span class="ic">' + ico(p.icon) + '</span><span>' + esc(p.label) + '<small>' + esc(p.hint) + '</small></span></button>'; }).join('') + '</div></div>' +
      '<div class="ps-banner">' + ico('alert') + '<span>La accident sau pericol: oprește-te, nu intra în zona robotului și anunță imediat șeful de tură. La urgență medicală, <b>112</b>.</span></div>' +
      '<div class="ps-surface"><h2>Anunțate azi</h2><ul class="ps-last" id="psMine"></ul></div></section>' +
      '</main>' +
      '<nav class="ps-tabbar" aria-label="Meniu"><div class="in">' +
      '<button type="button" data-scr="cron">' + ico('timer', 'lg') + 'Cronometru</button>' +
      '<button type="button" data-scr="prob">' + ico('alert', 'lg') + 'Probleme<span class="ps-badge" id="psProbBadge" hidden></span></button>' +
      '<button type="button" data-scr="chat">' + ico('chat', 'lg') + 'Asistent</button></div></nav>';
    document.body.insertBefore(el, auth.nextSibling);
    $('psOut').addEventListener('click', logout);
    on(el, '[data-scr]', function (b) { if (b.dataset.scr === 'chat') return openChat(); wScreen = b.dataset.scr; wNav(); });
    $('psGo').addEventListener('click', wStep);
    $('psCancel').addEventListener('click', function () { watch.phase = 0; wPaint(); });
    on(el, '[data-p]', function (b) { openReport(b.dataset.p); });
    clearInterval(watch.timer); watch.timer = setInterval(wTick, 250);
    wNav(); wPaint(); renderMine();
  }
  function wNav() {
    ['cron', 'prob'].forEach(function (s) { $('psScr-' + s).hidden = s !== wScreen; });
    [].forEach.call(document.querySelectorAll('.ps-tabbar [data-scr]'), function (b) { if (b.dataset.scr === wScreen) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }
  function wStep() {
    buzz();
    if (watch.phase === 0) { watch.t0 = Date.now(); watch.phase = 1; }
    else if (watch.phase === 1) { watch.t1 = Date.now(); watch.phase = 2; }
    else {
      var t2 = Date.now();
      db.measurements.push({ id: uid(), userId: session.id, ts: t2, wait: (watch.t1 - watch.t0) / 1000, op: (t2 - watch.t1) / 1000 });
      save(); watch.phase = 0; toast('Măsurătoare salvată. Mulțumim!');
    }
    wPaint();
  }
  function wTick() { if (!$('psClock') || watch.phase === 0) return; $('psClock').textContent = mmss((Date.now() - (watch.phase === 1 ? watch.t0 : watch.t1)) / 1000); }
  function wPaint() {
    var ph = watch.phase;
    $('psStepper').innerHTML = ['Palet plin', 'Schimbare', 'Poziție liberă'].map(function (l, i) { return '<div class="' + (i < ph ? 'done' : i === ph ? 'now' : '') + '"><i></i>' + (i < ph ? '✓ ' : (i + 1) + '. ') + l + '</div>'; }).join('');
    $('psGoB').textContent = STEP_TXT[ph][0]; $('psGoS').textContent = STEP_TXT[ph][1];
    $('psGo').classList.toggle('phase2', ph === 2);
    $('psTimerL').textContent = ['Gata de măsurat', 'Paletul plin așteaptă de', 'Schimbarea durează de'][ph];
    $('psCancel').hidden = ph === 0;
    if (ph === 0) $('psClock').textContent = '00:00';
    var mine = db.measurements.filter(function (m) { return m.userId === session.id && isToday(m.ts); });
    var med = median(mine.map(function (m) { return m.wait + m.op; }));
    var best = mine.length ? Math.min.apply(null, mine.map(function (m) { return m.wait + m.op; })) : null;
    $('psToday').innerHTML = '<div><span class="v">' + mine.length + '</span><span class="l">schimburi</span></div>' +
      '<div><span class="v">' + (med == null ? '—' : mmss(med)) + '</span><span class="l">durata obișnuită</span></div>' +
      '<div><span class="v">' + (best == null ? '—' : mmss(best)) + '</span><span class="l">cel mai rapid</span></div>';
    $('psLast').innerHTML = mine.length ? mine.slice(-5).reverse().map(function (m) {
      return '<li><span><span class="t">' + mmss(m.wait + m.op) + '</span> <span class="d">· așteptare ' + mmss(m.wait) + ' · operație ' + mmss(m.op) + '</span></span><span class="d">' + hm(m.ts) + '</span></li>';
    }).join('') : '<li><span class="d">Nicio măsurătoare azi. Apasă butonul galben când paletul e plin.</span></li>';
  }
  function openReport(pid) {
    var p = PROBLEMS.filter(function (x) { return x.id === pid; })[0];
    modal({
      title: p.label, icon: p.icon, ok: 'Trimite',
      html: 'Administratorul primește anunțul imediat. Poți adăuga un detaliu (nu e obligatoriu).',
      field: { label: 'Detalii', placeholder: 'ex. poziția din stânga, de 5 minute' },
      onOk: function (note) {
        db.reports.push({ id: uid(), userId: session.id, ts: Date.now(), type: p.id, label: p.label, note: String(note).trim().slice(0, 300), status: 'nou' });
        save(); renderMine(); buzz(); toast('Trimis la administrator.');
      }
    });
  }
  var STATUS = { nou: 'Trimis', vazut: 'Văzut', rezolvat: 'Rezolvat' };
  function renderMine() {
    var mine = db.reports.filter(function (r) { return r.userId === session.id && isToday(r.ts); }).reverse();
    $('psMine').innerHTML = mine.length ? mine.map(function (r) {
      return '<li><span><b>' + esc(r.label) + '</b> <span class="d">· ' + hm(r.ts) + '</span></span><span class="ps-pill ' + r.status + '">' + STATUS[r.status] + '</span></li>';
    }).join('') : '<li><span class="d">Nimic anunțat azi.</span></li>';
    var open = mine.filter(function (r) { return r.status !== 'rezolvat'; }).length;
    $('psProbBadge').hidden = !open; $('psProbBadge').textContent = open;
  }
  // Statusul se poate schimba din alt tab (administratorul pe același dispozitiv).
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    db = load();
    if (session && session.role === 'worker' && $('psMine')) { renderMine(); wPaint(); }
    if (session && session.role === 'admin' && $('psAdmin')) renderAdmin();
  });

  // ---------- Administrator ----------
  var aTab = 'team';
  function enterAdmin() {
    var top = document.querySelector('header.top');
    var bar = $('psUserbar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'psUserbar'; bar.className = 'ps-userbar'; top.appendChild(bar); }
    bar.innerHTML = avatar(session, true) + '<span class="who">' + esc(session.name) + '<span>' + esc(session.func || 'Administrator') + '</span></span><button class="ps-btn small ghost" type="button" id="psOut" aria-label="Ieșire">' + ico('logout') + '</button>';
    $('psOut').addEventListener('click', logout);
    var nav = top.querySelector('nav');
    if (nav && !$('psNavAdmin')) { var a = document.createElement('a'); a.href = '#psAdmin'; a.id = 'psNavAdmin'; a.textContent = 'Administrare'; nav.insertBefore(a, nav.firstChild); }
    if (!$('psAdmin')) {
      var sec = document.createElement('section');
      sec.className = 'ps-admin'; sec.id = 'psAdmin';
      top.parentNode.insertBefore(sec, top.nextSibling);
    }
    // Fiecare director vede din prima secțiunea „trei decidenți” pe rolul lui.
    var v = VIEW_FOR[session.func], vb = v && document.querySelector('#viewTabs [data-view="' + v + '"]');
    if (vb) vb.click();
    renderAdmin();
  }

  function measStats(list) {
    if (!list.length) return null;
    var w = list.map(function (m) { return m.wait; }), o = list.map(function (m) { return m.op; }), t = list.map(function (m) { return m.wait + m.op; });
    return { n: list.length, wait: median(w), op: median(o), total: median(t), lo: Math.min.apply(null, t), hi: Math.max.apply(null, t) };
  }
  function empty(icon, title, text) { return '<div class="ps-empty"><span class="ic">' + ico(icon, 'lg') + '</span><b>' + esc(title) + '</b><span>' + esc(text) + '</span></div>'; }

  function renderAdmin() {
    var workers = db.users.filter(function (u) { return u.role === 'worker' && u.active !== false; }).length;
    var today = db.measurements.filter(function (m) { return isToday(m.ts); }).length;
    var s = measStats(db.measurements);
    var open = db.reports.filter(function (r) { return r.status !== 'rezolvat'; }).length;
    var tabs = [['team', 'users', 'Echipa', db.users.length], ['meas', 'timer', 'Măsurători', db.measurements.length], ['rep', 'alert', 'Probleme', open], ['ai', 'spark', 'Asistent AI', null]];
    $('psAdmin').innerHTML =
      '<div class="ps-ahead"><div><h2>Panou de administrare</h2><p>Echipa, măsurătorile de pe linie și problemele anunțate. Măsurătorile intră cu un clic în simularea de mai jos.</p></div><span class="date">' + new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</span></div>' +
      '<div class="ps-kpis">' +
      '<div class="ps-kpi"><span class="ic">' + ico('users') + '</span><span><span class="v">' + workers + '</span><span class="l">muncitori activi</span></span></div>' +
      '<div class="ps-kpi"><span class="ic">' + ico('timer') + '</span><span><span class="v">' + today + '</span><span class="l">schimbări măsurate azi</span></span></div>' +
      '<div class="ps-kpi"><span class="ic">' + ico('chart') + '</span><span><span class="v">' + (s ? mmss(s.total) : '—') + '</span><span class="l">durata tipică a schimbului</span></span></div>' +
      '<div class="ps-kpi' + (open ? ' alert' : '') + '"><span class="ic">' + ico('alert') + '</span><span><span class="v">' + open + '</span><span class="l">probleme deschise</span></span></div></div>' +
      '<div class="ps-atabs" role="tablist">' + tabs.map(function (t) {
        var cnt = t[3] == null ? '' : t[0] === 'rep' && t[3] ? '<span class="ps-badge">' + t[3] + '</span>' : '<span class="cnt">' + t[3] + '</span>';
        return '<button type="button" role="tab" aria-selected="' + (t[0] === aTab) + '" data-at="' + t[0] + '">' + ico(t[1]) + t[2] + cnt + '</button>';
      }).join('') + '</div>' +
      '<div id="psAPanel" role="tabpanel"></div>';
    on($('psAdmin'), '[data-at]', function (b) { aTab = b.dataset.at; renderAdmin(); });
    ({ team: aTeam, meas: aMeas, rep: aRep, ai: aAI })[aTab]();
  }

  function aTeam() {
    var rows = db.users.map(function (u) {
      var n = db.measurements.filter(function (m) { return m.userId === u.id; }).length;
      return '<tr><td><span class="person">' + avatar(u, true) + '<span>' + esc(u.name) + (u.id === session.id ? ' <span class="ps-muted">(tu)</span>' : '') + '<small>' + esc(u.func || '') + '</small></span></span></td>' +
        '<td><span class="ps-pill ' + (u.role === 'admin' ? 'info' : 'off') + '" style="' + (u.role === 'worker' ? 'color:var(--muted);background:var(--surface)' : '') + '">' + (u.role === 'admin' ? 'Administrator' : 'Muncitor') + '</span></td>' +
        '<td class="n">' + (u.role === 'worker' ? n : '—') + '</td><td>' + (u.active === false ? '<span class="ps-pill off">Inactiv</span>' : '<span class="ps-pill on">Activ</span>') + '</td>' +
        '<td><div class="acts"><button class="ps-btn small" data-reset="' + u.id + '">' + ico('key') + (u.role === 'worker' ? 'PIN nou' : 'Parolă nouă') + '</button>' +
        (u.id === session.id ? '' : '<button class="ps-btn small" data-toggle="' + u.id + '">' + ico(u.active === false ? 'check' : 'ban') + (u.active === false ? 'Activează' : 'Dezactivează') + '</button><button class="ps-btn small danger" data-del="' + u.id + '" aria-label="Șterge ' + esc(u.name) + '">' + ico('trash') + '</button>') + '</div></td></tr>';
    }).join('');
    $('psAPanel').innerHTML =
      '<div class="ps-card"><div class="ps-card-head"><h3>Adaugă o persoană</h3><span class="ps-muted" style="font-size:14px">Muncitorii intră cu PIN de 4 cifre, administratorii cu parolă.</span></div><div class="ps-card-body">' +
      '<form class="ps-form-row" id="psAdd" autocomplete="off">' +
      '<label class="ps-field">Nume complet<input id="psAName" required maxlength="40" placeholder="ex. Maria Popa"></label>' +
      '<label class="ps-field">Rol<select id="psARole"><option value="worker">Muncitor</option><option value="admin">Administrator</option></select></label>' +
      '<label class="ps-field">Funcție<select id="psAFunc">' + funcOptions(FUNCS_WORKER) + '</select></label>' +
      '<label class="ps-field"><span id="psASecL">PIN (4 cifre)</span><input id="psASec" required inputmode="numeric" maxlength="4" autocomplete="off"></label>' +
      '<button class="ps-btn primary" type="submit">' + ico('plus') + 'Adaugă</button></form><p class="ps-err" id="psAErr"></p></div></div>' +
      '<div class="ps-card" style="margin-top:16px"><div class="ps-card-head"><h3>Echipa</h3><span class="ps-muted" style="font-size:14px">' + db.users.length + ' persoane</span></div>' +
      '<div class="ps-tw"><table class="ps-atable"><thead><tr><th>Persoană</th><th>Rol</th><th>Măsurători</th><th>Stare</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    $('psARole').addEventListener('change', function () {
      var adm = this.value === 'admin', s = $('psASec');
      $('psAFunc').innerHTML = funcOptions(adm ? FUNCS_ADMIN : FUNCS_WORKER);
      $('psASecL').textContent = adm ? 'Parolă (min. 6)' : 'PIN (4 cifre)';
      s.value = ''; s.type = adm ? 'password' : 'text'; s.inputMode = adm ? 'text' : 'numeric';
      if (adm) s.removeAttribute('maxlength'); else s.maxLength = 4;
    });
    $('psAdd').addEventListener('submit', function (e) {
      e.preventDefault();
      var role = $('psARole').value, name = $('psAName').value.trim(), sec = $('psASec').value;
      if (!name) return ($('psAErr').textContent = 'Scrie numele.');
      if (role === 'worker' && !/^[0-9]{4}$/.test(sec)) return ($('psAErr').textContent = 'PIN-ul are exact 4 cifre.');
      if (role === 'admin' && sec.length < 6) return ($('psAErr').textContent = 'Parola are cel puțin 6 caractere.');
      if (db.users.some(function (u) { return u.role === role && norm(u.name) === norm(name); })) return ($('psAErr').textContent = 'Există deja cineva cu acest nume.');
      var u = { id: uid(), name: name, role: role, func: $('psAFunc').value, active: true, created: Date.now() };
      hash(sec, u.id).then(function (h) { u.secret = h; db.users.push(u); save(); toast(name + ' a fost adăugat.'); renderAdmin(); });
    });
    on($('psAPanel'), '[data-reset]', function (b) {
      var u = userById(b.dataset.reset), w = u.role === 'worker';
      modal({
        title: w ? 'PIN nou' : 'Parolă nouă', icon: 'key', ok: 'Salvează',
        html: 'Pentru <b>' + esc(u.name) + '</b>. Comunică-l direct persoanei, nu îl scrie pe linie.',
        field: w ? { label: 'PIN (4 cifre)', inputmode: 'numeric', placeholder: '••••' } : { label: 'Parolă (min. 6 caractere)', type: 'password' },
        onOk: function (v) {
          if (w ? !/^[0-9]{4}$/.test(v) : v.length < 6) return w ? 'PIN-ul trebuie să aibă exact 4 cifre.' : 'Parola trebuie să aibă cel puțin 6 caractere.';
          return hash(v, u.id).then(function (h) { u.secret = h; save(); toast('Schimbat pentru ' + u.name + '.'); });
        }
      });
    });
    on($('psAPanel'), '[data-toggle]', function (b) { var u = userById(b.dataset.toggle); u.active = u.active === false; save(); toast(u.name + (u.active ? ' poate intra din nou.' : ' nu mai poate intra.')); renderAdmin(); });
    on($('psAPanel'), '[data-del]', function (b) {
      var u = userById(b.dataset.del);
      if (u.role === 'admin' && admins().length < 2) return toast('Trebuie să rămână cel puțin un administrator.');
      modal({
        title: 'Ștergi contul?', icon: 'trash', ok: 'Șterge', danger: true,
        html: 'Contul lui <b>' + esc(u.name) + '</b> se șterge definitiv. Măsurătorile și problemele lui rămân în istoric.',
        onOk: function () { db.users = db.users.filter(function (x) { return x.id !== u.id; }); save(); renderAdmin(); }
      });
    });
  }

  function aMeas() {
    var list = db.measurements.slice().reverse(), s = measStats(db.measurements);
    if (!s) { $('psAPanel').innerHTML = '<div class="ps-card">' + empty('timer', 'Încă nicio măsurătoare', 'Muncitorii cronometrează din telefon, cu butonul galben din aplicația lor.') + '</div>'; return; }
    var share = s.wait / Math.max(1, s.wait + s.op);
    $('psAPanel').innerHTML =
      '<div class="ps-card"><div class="ps-card-head"><h3>Ce arată măsurătorile</h3><div class="ps-row"><button class="ps-btn small primary" type="button" id="psUse">' + ico('chart') + 'Folosește în simulare</button><button class="ps-btn small" type="button" id="psCsv">' + ico('download') + 'CSV</button><button class="ps-btn small danger" type="button" id="psClr">' + ico('trash') + 'Șterge tot</button></div></div>' +
      '<div class="ps-card-body"><div class="ps-kpis">' +
      '<div class="ps-kpi"><span><span class="v">' + s.n + '</span><span class="l">schimbări cronometrate</span></span></div>' +
      '<div class="ps-kpi"><span><span class="v" style="color:var(--warn)">' + mmss(s.wait) + '</span><span class="l">până începe operatorul</span></span></div>' +
      '<div class="ps-kpi"><span><span class="v">' + mmss(s.op) + '</span><span class="l">operația propriu-zisă</span></span></div>' +
      '<div class="ps-kpi"><span><span class="v">' + mmss(s.total) + '</span><span class="l">total · între ' + mmss(s.lo) + ' și ' + mmss(s.hi) + '</span></span></div></div>' +
      '<div class="ps-split" aria-hidden="true"><i style="width:' + (share * 100) + '%;background:var(--warn)"></i><i style="width:' + ((1 - share) * 100) + '%;background:var(--ink)"></i></div>' +
      '<div class="ps-legend"><span><i style="background:var(--warn)"></i>așteptarea operatorului ' + Math.round(share * 100) + '%</span><span><i style="background:var(--ink)"></i>operația ' + Math.round((1 - share) * 100) + '%</span><span>valori mediane</span></div>' +
      '<div class="ps-insight">' + ico('bulb') + '<span>' + (s.wait > s.op ? '<b>Organizarea contează mai mult decât viteza.</b> Se pierde mai mult timp până vine operatorul decât în schimbarea propriu-zisă.' : '<b>Merită lucrat la operație.</b> Schimbarea propriu-zisă durează mai mult decât așteptarea operatorului.') + '</span></div></div></div>' +
      '<div class="ps-card" style="margin-top:16px"><div class="ps-card-head"><h3>Toate măsurătorile</h3></div><div class="ps-tw"><table class="ps-atable"><thead><tr><th>Când</th><th>Muncitor</th><th>Până începe</th><th>Operația</th><th>Total</th><th></th></tr></thead><tbody>' +
      list.map(function (m) { var u = userById(m.userId); return '<tr><td class="n">' + when(m.ts) + '</td><td><span class="person">' + avatar(u || { name: '?' }, true) + esc(nameOf(m.userId)) + '</span></td><td class="n">' + mmss(m.wait) + '</td><td class="n">' + mmss(m.op) + '</td><td class="n"><b>' + mmss(m.wait + m.op) + '</b></td><td><div class="acts"><button class="ps-btn small ghost" data-mdel="' + m.id + '" aria-label="Șterge măsurătoarea">' + ico('trash') + '</button></div></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    $('psUse').addEventListener('click', function () {
      var c = Math.max(10, Math.min(1800, Math.round(s.total)));
      var ch = $('change'); ch.value = String(c); ch.dispatchEvent(new Event('input', { bubbles: true }));
      var lo = $('vmin'), hi = $('vmax'); if (lo && hi) { lo.value = String(Math.max(10, Math.round(s.lo))); hi.value = String(Math.max(Math.round(s.lo) + 1, Math.round(s.hi))); }
      toast('Schimbarea paletului în simulare: ' + c + ' s.');
      $('sim').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('psCsv').addEventListener('click', function () {
      var csv = 'data,muncitor,pana_incepe_s,operatie_s,total_s\n' + db.measurements.map(function (m) { return new Date(m.ts).toISOString() + ',"' + nameOf(m.userId).replace(/"/g, '""') + '",' + Math.round(m.wait) + ',' + Math.round(m.op) + ',' + Math.round(m.wait + m.op); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'masuratori_paletscore.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    $('psClr').addEventListener('click', function () {
      modal({ title: 'Ștergi toate măsurătorile?', icon: 'trash', ok: 'Șterge ' + s.n, danger: true, html: 'Se șterg definitiv toate cele <b>' + s.n + '</b> măsurători. Descarcă înainte CSV-ul dacă vrei să le păstrezi.', onOk: function () { db.measurements = []; save(); renderAdmin(); } });
    });
    on($('psAPanel'), '[data-mdel]', function (b) { db.measurements = db.measurements.filter(function (m) { return m.id !== b.dataset.mdel; }); save(); renderAdmin(); });
  }

  var repFilter = 'open';
  function aRep() {
    var list = db.reports.filter(function (r) { return repFilter === 'all' || r.status !== 'rezolvat'; }).slice().reverse();
    var body = list.length ? '<div class="ps-tw"><table class="ps-atable"><thead><tr><th>Problema</th><th>Muncitor</th><th>Detalii</th><th>Când</th><th>Stare</th><th></th></tr></thead><tbody>' +
      list.map(function (r) {
        var p = PROBLEMS.filter(function (x) { return x.id === r.type; })[0] || PROBLEMS[5], u = userById(r.userId);
        return '<tr><td><span class="person" style="color:' + (p.risk ? 'var(--risk)' : 'var(--ink)') + '">' + ico(p.icon) + esc(r.label) + '</span></td><td><span class="person">' + avatar(u || { name: '?' }, true) + esc(nameOf(r.userId)) + '</span></td><td>' + (esc(r.note) || '<span class="ps-muted">—</span>') + '</td><td class="n">' + when(r.ts) + '</td>' +
          '<td><span class="ps-pill ' + (p.risk && r.status === 'nou' ? 'risk' : r.status) + '">' + { nou: 'Nou', vazut: 'Văzut', rezolvat: 'Rezolvat' }[r.status] + '</span></td>' +
          '<td><div class="acts">' + (r.status === 'nou' ? '<button class="ps-btn small" data-st="vazut" data-id="' + r.id + '">' + ico('eye') + 'Văzut</button>' : '') + (r.status !== 'rezolvat' ? '<button class="ps-btn small" data-st="rezolvat" data-id="' + r.id + '">' + ico('check') + 'Rezolvat</button>' : '<span class="ps-muted" style="font-size:13px">' + esc(r.by || '') + '</span>') + '</div></td></tr>';
      }).join('') + '</tbody></table></div>'
      : empty('check', repFilter === 'open' ? 'Nicio problemă deschisă' : 'Nicio problemă anunțată', repFilter === 'open' ? 'Linia merge fără incidente raportate.' : 'Problemele anunțate de muncitori apar aici.');
    $('psAPanel').innerHTML = '<div class="ps-card"><div class="ps-card-head"><h3>Probleme anunțate</h3><div class="ps-seg2" role="group" aria-label="Filtru"><button type="button" data-f="open" aria-pressed="' + (repFilter === 'open') + '">Deschise</button><button type="button" data-f="all" aria-pressed="' + (repFilter === 'all') + '">Toate</button></div></div>' + body + '</div>';
    on($('psAPanel'), '[data-f]', function (b) { repFilter = b.dataset.f; aRep(); });
    on($('psAPanel'), '[data-st]', function (b) {
      var r = db.reports.filter(function (x) { return x.id === b.dataset.id; })[0]; r.status = b.dataset.st; r.by = session.name; save(); renderAdmin();
    });
  }

  function aAI() {
    var hasKey = !!db.ai.key;
    $('psAPanel').innerHTML = '<div class="ps-card"><div class="ps-card-head"><h3>Asistent AI</h3></div><div class="ps-card-body" style="max-width:760px">' +
      '<div class="ps-ai-status"><span class="ps-dot' + (hasKey ? ' on' : '') + '"></span><span><b>' + (hasKey ? 'Conectat la Claude' : 'Mod local') + '</b><br><span class="ps-muted" style="font-size:14px">' + (hasKey ? 'Răspunde liber, cu datele aplicației în context (' + MODEL + ').' : 'Răspunde din reguli și din simulare. Funcționează fără internet și fără cheie.') + '</span></span></div>' +
      '<form class="ps-form-row" id="psAIF" autocomplete="off"><label class="ps-field" style="grid-column:1/-1">Cheie API Anthropic <span class="hint">opțional, pentru întrebări libere</span><input id="psKey" type="password" placeholder="' + (hasKey ? 'salvată — scrie alta ca să o înlocuiești' : 'sk-ant-…') + '" autocomplete="off"></label>' +
      '<button class="ps-btn primary" type="submit">' + ico('key') + 'Salvează cheia</button>' + (hasKey ? '<button class="ps-btn danger" type="button" id="psKeyDel">' + ico('trash') + 'Șterge cheia</button>' : '') + '</form>' +
      '<div class="ps-banner">' + ico('lock') + '<span>Cheia rămâne în acest browser și e folosită direct din pagină: oricine folosește dispozitivul o poate folosi. Potrivit pentru test; în producție apelurile se fac printr-un server.</span></div></div></div>';
    $('psAIF').addEventListener('submit', function (e) { e.preventDefault(); var k = $('psKey').value.trim(); if (!k) return; db.ai.key = k; save(); toast('Asistentul folosește acum Claude.'); renderAdmin(); });
    if (hasKey) $('psKeyDel').addEventListener('click', function () { delete db.ai.key; save(); toast('Cheia a fost ștearsă.'); renderAdmin(); });
  }

  // ---------- Context pentru asistent ----------
  function readLineFromPage() {
    var fb = document.querySelector('#fmtSeg [aria-pressed="true"]'), ob = document.querySelector('#opSeg [aria-pressed="true"]');
    var num = function (id) { var el = $(id); if (!el) return null; var v = parseFloat(String(el.value).replace(',', '.')); return isFinite(v) ? v : null; };
    var line = {
      format: fb ? fb.dataset.fmt : '13', feed: num('feed') || 7.4, changeSec: num('change') || 90, buffer: num('buffer') || null,
      operators: ob ? parseInt(ob.dataset.op, 10) : 1, perPallet: num('perpallet'), weight: num('weight'), arrivals: $('arrivals') ? $('arrivals').value : 'regulat'
    };
    if (line.format === 'alt' && !line.perPallet) line.perPallet = 60;
    return line;
  }
  function lineFacts() {
    try {
      var line = readLineFromPage(), r = M.runLine(line), p = M.simParams(line);
      var s = M.createSim(p), blocked = M.runToFirstBlock(s, M.HOUR);
      var iv = M.interventions(line), crit = M.criticalChange(line);
      var fill = p.perPallet / Math.min(p.feed, p.cap) * 60;
      return { line: line, placed: Math.round(r.placed), waitPos: r.waitPos, queue: r.queue, firstBlock: blocked ? s.t : null, best: iv.best, crit: crit, fill: fill, kg: M.REF[line.format] ? M.REF[line.format].kg : line.weight };
    } catch (e) { return null; }
  }
  function reportsSummary() {
    var open = db.reports.filter(function (r) { return r.status !== 'rezolvat'; });
    var by = {}; open.forEach(function (r) { by[r.label] = (by[r.label] || 0) + 1; });
    return { open: open, by: by };
  }

  // ---------- Asistentul (chatbot) ----------
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'ps-fab'; fab.id = 'psFab'; fab.hidden = true;
  fab.innerHTML = ico('spark') + 'Asistent';
  document.body.appendChild(fab);
  var panel = document.createElement('div');
  panel.className = 'ps-chat'; panel.id = 'psChat'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Asistent PaletScore');
  panel.innerHTML = '<div class="ps-chat-head"><span class="bot-av">' + ico('spark') + '</span><div class="ttl"><b>Asistent PaletScore</b><small><i></i><span id="psChatMode"></span></small></div><button type="button" id="psChatNew" aria-label="Conversație nouă" title="Conversație nouă">' + ico('plus') + '</button><button type="button" id="psChatX" aria-label="Închide">' + ico('close') + '</button></div>' +
    '<div class="ps-msgs" id="psMsgs" aria-live="polite"></div><div class="ps-sugg" id="psSugg"></div>' +
    '<form id="psChatF"><input id="psChatIn" autocomplete="off" placeholder="Scrie întrebarea…" aria-label="Întrebarea ta" maxlength="500"><button type="submit" aria-label="Trimite">' + ico('send') + '</button></form>';
  document.body.appendChild(panel);
  var chat = { history: [], busy: false };

  fab.addEventListener('click', function () { panel.hidden ? openChat() : closeChat(); });
  $('psChatX').addEventListener('click', closeChat);
  $('psChatNew').addEventListener('click', function () { chat.history = []; chatReset(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden && !document.querySelector('.ps-modal-bg')) closeChat(); });
  $('psChatF').addEventListener('submit', function (e) { e.preventDefault(); var t = $('psChatIn').value.trim(); if (t) { $('psChatIn').value = ''; ask(t); } });

  function openChat() { panel.hidden = false; $('psChatMode').textContent = db.ai.key ? 'Claude · date din aplicație' : 'Online · date din aplicație'; if (!$('psMsgs').children.length) chatReset(); $('psChatIn').focus(); }
  function closeChat() { panel.hidden = true; }
  function suggestions() {
    return session && session.role === 'admin'
      ? ['Cum stă linia?', 'Unde merită să intervin?', 'Ce arată măsurătorile?', 'Ce probleme sunt deschise?', 'Cine din echipă a măsurat?']
      : ['Cum cronometrez?', 'Robotul s-a oprit', 'Cât timp am pentru schimb?', 'Cum anunț o problemă?', 'Siguranța la paleți'];
  }
  function chatReset() {
    $('psMsgs').innerHTML = '';
    $('psSugg').innerHTML = suggestions().map(function (s) { return '<button type="button">' + esc(s) + '</button>'; }).join('');
    [].forEach.call($('psSugg').children, function (b) { b.addEventListener('click', function () { ask(b.textContent); }); });
    if (!session) return;
    addMsg('bot', session.role === 'admin'
      ? 'Bună, ' + firstName(session.name) + '! Te pot ajuta cu starea liniei, intervenții, măsurătorile echipei și problemele raportate. Întreabă liber sau alege o sugestie de mai jos.'
      : 'Salut, ' + firstName(session.name) + '! Întreabă-mă orice despre schimbul paletului sau ce faci când ceva nu merge.');
  }
  function addMsg(who, text, src) {
    var d = document.createElement('div'); d.className = 'ps-msg ' + who;
    var inner = who === 'wait' ? '<span class="ps-typing" aria-label="Asistentul scrie"><i></i><i></i><i></i></span>' : esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + (src ? '<span class="src">' + esc(src) + '</span>' : '');
    d.innerHTML = (who === 'me' ? '' : '<span class="av">' + ico('spark') + '</span>') + '<div class="b">' + inner + '</div>';
    if (who === 'wait') d.className = 'ps-msg bot';
    $('psMsgs').appendChild(d); $('psMsgs').scrollTop = $('psMsgs').scrollHeight; return d;
  }

  function ask(text) {
    if (chat.busy) return;
    addMsg('me', text);
    chat.history.push({ role: 'user', content: text });
    chat.busy = true;
    var w = addMsg('wait');
    if (!db.ai.key) {
      // O pauză scurtă face răspunsul local mai ușor de urmărit.
      setTimeout(function () { w.remove(); var a = localAnswer(text); addMsg('bot', a); chat.history.push({ role: 'assistant', content: a }); chat.busy = false; }, 450);
      return;
    }
    askClaude().then(function (ans) { w.remove(); addMsg('bot', ans, 'Claude'); chat.history.push({ role: 'assistant', content: ans }); })
      .catch(function (err) {
        w.remove();
        var a = localAnswer(text);
        addMsg('bot', a, 'răspuns local · Claude indisponibil (' + (err && err.status ? 'eroare ' + err.status : 'fără conexiune') + ')');
        chat.history.push({ role: 'assistant', content: a });
      })
      .then(function () { chat.busy = false; });
  }

  // Răspunsuri locale: reguli pe cuvinte cheie + calcule din modelul de simulare.
  function has(t, words) { return words.some(function (w) { return t.indexOf(w) >= 0; }); }
  function localAnswer(q) {
    var t = norm(q), admin = session && session.role === 'admin', f = lineFacts();
    if (has(t, ['salut', 'buna', 'neata', 'hello']) && t.length < 20) return 'Salut! Cu ce te ajut?';
    if (has(t, ['multum', 'mersi'])) return 'Cu plăcere!';
    if (has(t, ['accident', 'ranit', 'lovit', 'pericol', 'urgent', 'foc', 'incendiu']))
      return 'Siguranța oamenilor e pe primul loc. Oprește-te, nu intra în zona robotului și anunță imediat șeful de tură. La urgență medicală sună la 112.' + (admin ? '' : ' După ce ești în siguranță, apasă „Accident sau pericol” în meniul Probleme, ca să rămână notat.');
    if (has(t, ['oprit', 'blocat', 'blocaj', 'nu merge', 'nu mai merge', 'robotul sta', 'eroare robot'])) {
      if (admin && f) return f.firstBlock != null ? 'Cu datele actuale robotul se blochează prima dată la minutul **' + mmss(f.firstBlock) + '**: a doua poziție se umple înainte să fie eliberată prima. Schimbarea paletului trebuie să dureze sub ' + (f.crit ? dur(f.crit) : '—') + ' ca să nu apară așteptări.' : 'Cu datele actuale robotul nu se blochează în ora simulată.';
      return 'Dacă robotul s-a oprit:\n1. Nu intra în zona lui și nu atinge nimic din celulă.\n2. Uită-te dacă ambele poziții au palet plin: atunci schimbă paletul ca de obicei.\n3. Dacă nu e asta, apasă „Robotul s-a oprit” în meniul Probleme și cheamă șeful de tură.';
    }
    if (has(t, ['cronometr', 'masor', 'masurat', 'butoan', 'cum folosesc', 'pasii', 'pasi'])) {
      if (admin) return measAnswer();
      return 'E simplu, apeși de 3 ori același buton galben:\n1. **Paletul e plin** – când robotul a pus ultima găleată.\n2. **Încep schimbarea** – când începi efectiv să scoți paletul.\n3. **Gata, poziția e liberă** – când ai pus paletul gol.\nTimpul se salvează singur. Dacă ai greșit, apasă „Anulează măsurătoarea”.';
    }
    if (has(t, ['cat timp', 'cate minute', 'cat de repede', 'grab', 'prag', 'limita', 'timp am'])) {
      if (!f) return 'Nu pot calcula acum. Încearcă din nou.';
      var base = 'O poziție se umple în aproximativ **' + dur(f.fill) + '** (' + f.line.feed.toString().replace('.', ',') + ' găleți/min). ';
      return base + (f.crit ? 'Ca robotul să nu aștepte, schimbarea paletului (cu tot cu așteptarea) trebuie să ia mai puțin de **' + dur(f.crit) + '**.' : 'Cu ritmul actual, schimbarea nu oprește robotul.') + (admin ? '' : ' Nu te grăbi peste ce e sigur: e mai bine să anunți dacă nu reușești.');
    }
    if (has(t, ['anunt', 'raportez', 'semnalez', 'cum spun'])) return admin ? repAnswer() : 'Apasă „Probleme” jos, alege ce s-a întâmplat și apoi „Trimite”. Poți scrie și un detaliu. Tot acolo vezi dacă administratorul a văzut sau a rezolvat.';
    if (has(t, ['problem', 'incident', 'deschis', 'raport'])) return admin ? repAnswer() : 'Ca să anunți ceva, apasă „Probleme” în meniul de jos.';
    if (has(t, ['siguran', 'ssm', 'greu', 'greutat', 'spate', 'ergonom', 'ridic', 'protect'])) {
      var kg = f && f.kg ? f.kg : 13;
      return 'Robotul ridică gălețile (' + kg + ' kg fiecare) — tu schimbi doar paletul. Folosește transpaletul, nu trage paletul plin cu mâna, poartă echipamentul de protecție și nu intra în zona robotului cât timp lucrează.' + (admin && f ? ' Robotul preia acum ~' + Math.round(f.placed * kg / 1000 * 10) / 10 + ' t pe oră care altfel ar fi ridicate manual.' : '');
    }
    if (has(t, ['palet gol', 'lipsa palet', 'paleti goi', 'nu am palet'])) return 'Dacă nu ai paleți goi, apasă „Lipsă paleți goi” în meniul Probleme cât mai devreme: robotul mai lucrează pe cealaltă poziție cam ' + (f ? dur(f.fill) : 'câteva minute') + '.';
    if (has(t, ['transportor', 'se aduna', 'coada', 'buffer'])) return admin && f ? 'La sfârșitul orei simulate sunt ' + Math.round(f.queue) + ' găleți pe transportor.' + (f.line.buffer ? ' Bufferul e de ' + f.line.buffer + ' găleți.' : ' Bufferul e nelimitat în simulare.') : 'Dacă gălețile se adună pe transportor, apasă „Transportor plin” în meniul Probleme. Nu împinge găleți cu mâna în zona robotului.';
    if (admin) {
      if (has(t, ['stare', 'cum sta', 'cum merge', 'linia', 'cate galeti', 'rezultat', 'productie', 'ora'])) {
        if (!f) return 'Datele din „Linia ta” nu sunt valide; corectează-le și întreabă din nou.';
        return 'Linia ta, o oră simulată: **' + f.placed + ' găleți** paletizate. Robotul așteaptă o poziție liberă ' + dur(f.waitPos) + (f.firstBlock != null ? ', primul blocaj la minutul ' + mmss(f.firstBlock) : ', fără blocaje') + '. Schimbarea paletului e setată la ' + dur(f.line.changeSec) + ', cu ' + f.line.operators + ' operator' + (f.line.operators > 1 ? 'i' : '') + '.';
      }
      if (has(t, ['interven', 'recomand', 'ce sa schimb', 'ce schimb', 'imbunat', 'merita'])) {
        if (!f) return 'Nu pot calcula acum.';
        return f.best ? 'Cea mai mare diferență pe aceeași oră: **' + f.best.label + '** (' + f.best.detail + '), +' + Math.round(f.best.dPlaced) + ' găleți/oră.' + (f.best.hyp ? ' Atenție: e o ipoteză, nevalidată pentru UR20.' : '') + ' Detaliile sunt în „Unde merită să intervii?”.' : 'Nicio intervenție simulată nu aduce mai mult de o găleată pe oră: linia nu e limitată de schimbul paletului.';
      }
      if (has(t, ['echip', 'muncitor', 'cine', 'oameni', 'operator'])) {
        var ws = db.users.filter(function (u) { return u.role === 'worker'; });
        if (!ws.length) return 'Nu ai încă muncitori. Adaugă-i din Administrare → Echipa.';
        return ws.map(function (u) { var n = db.measurements.filter(function (m) { return m.userId === u.id; }).length; return '• ' + u.name + (u.active === false ? ' (inactiv)' : '') + ': ' + n + (n === 1 ? ' măsurătoare' : ' măsurători'); }).join('\n');
      }
      if (has(t, ['bani', 'profit', 'pret', 'cost', 'financ', 'buget'])) {
        var pr = parseFloat(($('cPrice') || {}).value), co = parseFloat(($('cCost') || {}).value);
        return (isFinite(pr) && isFinite(co) ? 'Marja directă pe celulă: ' + (pr - co).toLocaleString('ro-RO') + ' EUR (preț ' + pr.toLocaleString('ro-RO') + ', cost ' + co.toLocaleString('ro-RO') + '). ' : '') + 'Pâlnia, livrările și profitul anului sunt în secțiunea „Plan comercial”.';
      }
    }
    return admin
      ? 'Nu am un răspuns sigur la asta. Pot să-ți spun: cum stă linia, unde merită să intervii, ce arată măsurătorile, ce probleme sunt deschise, cine din echipă a măsurat. Pentru întrebări libere, conectează asistentul la Claude din Administrare → Asistent AI.'
      : 'Nu sunt sigur că am înțeles. Te pot ajuta cu: cum cronometrezi, ce faci când robotul s-a oprit, cât timp ai pentru schimb, cum anunți o problemă, siguranța. Pentru altceva, întreabă șeful de tură.';
  }
  function measAnswer() {
    var s = measStats(db.measurements);
    if (!s) return 'Încă nu există măsurători. Muncitorii cronometrează din aplicația lor, cu butonul galben.';
    return s.n + (s.n === 1 ? ' schimbare cronometrată' : ' schimbări cronometrate') + '. Mediana: **' + dur(s.wait) + '** până începe operatorul + **' + dur(s.op) + '** operația = ' + dur(s.total) + ' (între ' + Math.round(s.lo) + ' și ' + Math.round(s.hi) + ' s). ' +
      (s.wait > s.op ? 'Cel mai mult se pierde până vine omul: organizarea contează mai mult decât viteza.' : 'Operația propriu-zisă cântărește mai mult decât așteptarea.') + ' Poți trimite mediana în simulare din Administrare → Măsurători.';
  }
  function repAnswer() {
    var r = reportsSummary();
    if (!r.open.length) return 'Nicio problemă deschisă.';
    var last = r.open[r.open.length - 1];
    return (r.open.length === 1 ? 'O problemă deschisă: ' : r.open.length + ' probleme deschise: ') + Object.keys(r.by).map(function (k) { return k + ' (' + r.by[k] + ')'; }).join(', ') + '. Ultima: „' + last.label + '” de la ' + nameOf(last.userId) + ', ' + when(last.ts) + (last.note ? ': ' + last.note : '') + '.';
  }

  // Claude, prin SDK-ul oficial încărcat din CDN (doar dacă administratorul a pus o cheie).
  var sdk = null;
  function getClient() {
    if (!sdk) sdk = import(SDK_URL).then(function (m) { return m.default || m.Anthropic; });
    return sdk.then(function (Anthropic) { return new Anthropic({ apiKey: db.ai.key, dangerouslyAllowBrowser: true }); });
  }
  function systemPrompt() {
    var admin = session.role === 'admin', f = lineFacts(), s = measStats(db.measurements), r = reportsSummary();
    var ctx = {
      utilizator: { nume: session.name, rol: admin ? 'administrator' : 'muncitor', functie: session.func },
      linia: f ? { format: f.line.format === 'alt' ? 'alt ambalaj' : f.line.format + ' kg', debit_galeti_min: f.line.feed, schimbare_palet_s: f.line.changeSec, operatori: f.line.operators, buffer: f.line.buffer || 'nelimitat',
        galeti_pe_ora: f.placed, robot_asteapta_pozitie_s: Math.round(f.waitPos), primul_blocaj: f.firstBlock != null ? mmss(f.firstBlock) : 'niciunul', schimbare_maxima_fara_asteptare_s: f.crit, o_pozitie_se_umple_in_s: Math.round(f.fill),
        interventia_recomandata: f.best ? f.best.label + ' (+' + Math.round(f.best.dPlaced) + ' găleți/oră)' : 'niciuna' } : 'date invalide',
      masuratori: s ? { numar: s.n, mediana_pana_incepe_s: Math.round(s.wait), mediana_operatie_s: Math.round(s.op), mediana_total_s: Math.round(s.total) } : 'niciuna'
    };
    if (admin) { ctx.probleme_deschise = r.open.slice(-10).map(function (x) { return { problema: x.label, muncitor: nameOf(x.userId), cand: when(x.ts), detalii: x.note }; }); ctx.echipa = db.users.filter(function (u) { return u.role === 'worker'; }).map(function (u) { return u.name; }); }
    return 'Ești asistentul aplicației PaletScore, folosită într-o fabrică alimentară care paletizează găleți cu o celulă robotizată UR20 cu două poziții. Răspunzi mereu în română.\n' +
      (admin
        ? 'Vorbești cu un administrator (' + (session.func || 'conducere') + '). Răspunde concis și concret, cu cifrele din context. Spune clar când ceva e ipoteză sau simulare, nu măsurătoare. Nu inventa date care nu sunt în context.\n'
        : 'Vorbești cu un muncitor de pe linie, probabil de pe telefon. Folosește propoziții scurte, cuvinte simple, cel mult 4-5 rânduri, pași numerotați când explici ceva. Aplicația lui are un meniu jos: Cronometru (un buton galben apăsat de 3 ori: Paletul e plin → Încep schimbarea → Gata, poziția e liberă), Probleme (Robotul s-a oprit, Transportor plin, Lipsă paleți goi, Ambalaj defect, Accident sau pericol, Altceva) și Asistent. Nu-i da instrucțiuni tehnice de reparare a robotului; trimite-l la șeful de tură.\n') +
      'Siguranța e pe primul loc: la accident sau pericol, spune să se oprească, să nu intre în zona robotului, să anunțe șeful de tură și la urgență medicală 112. Nu înlocuiești procedurile fabricii.\n\nDatele actuale din aplicație (JSON):\n' + JSON.stringify(ctx);
  }
  function askClaude() {
    return getClient().then(function (client) {
      return client.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt(),
        messages: chat.history.slice(-12),
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default'
      });
    }).then(function (res) {
      if (res.stop_reason === 'refusal') return 'Nu pot răspunde la asta. Încearcă altă întrebare sau întreabă șeful de tură.';
      var txt = (res.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim();
      return txt || 'Nu am primit un răspuns. Încearcă din nou.';
    });
  }

  // ---------- Pornire ----------
  var u = restore();
  if (u) login(u); else showAuth();
})();
