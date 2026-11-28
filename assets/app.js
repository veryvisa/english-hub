/* English Hub · 公共层（改自 nce-study/site/assets/app.js，备份格式互通：存储、间隔复习（SM-2）、错题本、备份导入导出、朗读。纯本地，无网络请求。 */
(function () {
  'use strict';
  var KEY = 'english-hub-v1';
  var STEPS = [['learn', 'Learn', '学'], ['quiz', 'Check', '测'], ['use', 'Use it', '用']];

  function blank() {
    return { v: 1, lessons: {}, cards: {}, wrong: {}, notes: {}, log: {}, days: {}, speaks: [], learn: {}, created: today() };
  }
  function today(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(s, n) {
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return today(d);
  }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return fill(s); } catch (e) {}
    return blank();
  }
  function fill(s) { var b = blank(); for (var k in b) if (!(k in s)) s[k] = b[k]; return s; }
  var state = load();
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function touch() { var t = today(); state.log[t] = (state.log[t] || 0) + 1; }

  /* ---------- 课进度 ---------- */
  function lessonKey(b, n) { return 'b' + b + '-' + String(n).padStart(3, '0'); }
  function lesson(id) { return state.lessons[id] || (state.lessons[id] = { steps: {}, best: null, started: today() }); }
  function setStep(id, step, on) {
    var L = lesson(id); if (on) L.steps[step] = today(); else delete L.steps[step];
    if (STEPS.every(function (s) { return L.steps[s[0]]; })) L.done = L.done || today(); else delete L.done;
    touch(); save();
  }
  function stepCount(id) { var L = state.lessons[id]; if (!L) return 0; return STEPS.filter(function (s) { return L.steps[s[0]]; }).length; }

  /* ---------- SM-2 ---------- */
  // card: {id, kind:'word'|'grammar'|'sentence', front, back, extra, lesson, ef, n, iv, due, reps, lapses}
  function addCard(c) {
    if (state.cards[c.id]) { var o = state.cards[c.id]; o.front = c.front; o.back = c.back; o.extra = c.extra; return false; }
    c.ef = 2.5; c.n = 0; c.iv = 0; c.due = today(); c.reps = 0; c.lapses = 0; c.added = today();
    state.cards[c.id] = c; return true;
  }
  function grade(id, q) { // q: 0..5（0/2=忘了，3=难，4=好，5=容易）
    var c = state.cards[id]; if (!c) return;
    c.reps++;
    if (q < 3) { c.n = 0; c.iv = 1; c.lapses++; }
    else {
      c.n++;
      c.iv = c.n === 1 ? 1 : c.n === 2 ? 6 : Math.round(c.iv * c.ef);
      if (q === 5 && c.n <= 2) c.iv += 1;
    }
    c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    c.due = addDays(today(), c.iv); c.last = today();
    touch(); save();
  }
  function due() {
    var t = today(), out = [];
    for (var k in state.cards) if (state.cards[k].due <= t && !state.cards[k].suspended) out.push(state.cards[k]);
    out.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : a.n - b.n; });
    return out;
  }

  /* ---------- 错题本 ---------- */
  function wrongAdd(item) { // item: {id, lesson, q, answer, kind, given}
    var w = state.wrong[item.id] || (state.wrong[item.id] = { times: 0, first: today() });
    for (var k in item) w[k] = item[k];
    w.times++; w.last = today(); w.cleared = false; touch(); save();
  }
  function wrongClear(id) { if (state.wrong[id]) { state.wrong[id].cleared = today(); save(); } }

  /* ---------- 备份 ---------- */
  function exportJSON() {
    var blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'english-hub-backup-' + today() + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importJSON(file, mode, cb) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var s = JSON.parse(r.result);
        if (!s || s.v !== 1 || typeof s.lessons !== 'object') throw new Error('Not an English Hub backup file');
        if (mode === 'merge') {
          ['lessons', 'cards', 'wrong', 'notes', 'log', 'learn'].forEach(function (k) {
            for (var id in (s[k] || {})) {
              var mine = state[k][id], theirs = s[k][id];
              if (!mine) state[k][id] = theirs;
              else if (k === 'cards') { if ((theirs.reps || 0) > (mine.reps || 0)) state[k][id] = theirs; }
              else if (k === 'lessons') { for (var st in theirs.steps) mine.steps[st] = mine.steps[st] || theirs.steps[st]; if (theirs.done && !mine.done) mine.done = theirs.done; }
              else if (k === 'log') state.log[id] = Math.max(mine, theirs);
              else if (k === 'notes') { if ((theirs.t || '') > (mine.t || '')) state.notes[id] = theirs; }
            }
          });
        } else state = fill(s);
        save(); cb(null);
      } catch (e) { cb(e); }
    };
    r.readAsText(file);
  }

  /* ---------- 朗读（系统离线语音，不联网） ---------- */
  function speak(text, rate) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.onend = function () { if (speak.onend) speak.onend(); }; u.rate = rate || 0.9;
    var v = speechSynthesis.getVoices().filter(function (v) { return /en[-_]GB/i.test(v.lang) && v.localService; })[0]
      || speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang) && v.localService; })[0];
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  function streak() {
    var n = 0, d = today();
    if (!state.log[d]) d = addDays(d, -1);
    while (state.log[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); }


  /* ---------- 三语模式、界面字、朗读按钮、角标 ---------- */
  function T(en, zh) { return '<span class="enx">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span>'; }
  /* 读屏名称跟语言走：带 data-al="English||中文" 的元素，aria-label 按当前模式换（英文模式零汉字；对照模式的界面话只出中文）。
     页面脚本可以监听 eh-lang 事件，改自己生成的属性与下拉文字。 */
  function syncLabels(l) {
    document.querySelectorAll('[data-al]').forEach(function (el) { var p = el.getAttribute('data-al').split('||'); el.setAttribute('aria-label', l === 'en' || p.length < 2 ? p[0] : p[1]); });
  }
  function setLang(l) {
    document.body.dataset.lang = l; try { localStorage.setItem('english-hub-lang', l); } catch (e) {}
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.classList.toggle('on', b.dataset.setLang === l); b.setAttribute('aria-pressed', b.dataset.setLang === l ? 'true' : 'false'); });
    syncLabels(l);
    try { document.dispatchEvent(new CustomEvent('eh-lang', { detail: l })); } catch (e) {}
  }
  /* 页头「写」：本机定了起点就指向当前那一周的写作台（route.js 记在 EH.state.route.cur）；当前页的入口标 aria-current */
  function navInit() {
    var r = state.route, w = document.querySelector('.nav-links a[data-nav=write]'), root = document.body.dataset.root || '';
    if (w && r && r.cur && /^t-[a-z0-9-]+$/.test(r.cur)) w.setAttribute('href', root + 'route/w/' + r.cur + '.html#write');
    var here = location.pathname.replace(/\/index\.html$/, '/');
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var u = a.href.split('#')[0].replace(/\/index\.html$/, '/');
      if (!/#/.test(a.getAttribute('href')) && u.slice(-here.length) === here && here.length > 1) a.setAttribute('aria-current', 'page');
    });
  }
  function toast(html) { var t = document.getElementById('toast'); if (!t) return; t.innerHTML = html; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2200); }
  var recorder = null;
  function record(btn) { // 本机录音回放：不上传、不保存
    if (recorder) { recorder.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast(T('Recording is not available in this browser.', '这个浏览器不支持录音。')); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
      var chunks = []; recorder = new MediaRecorder(st); btn.classList.add('on');
      recorder.ondataavailable = function (e) { chunks.push(e.data); };
      recorder.onstop = function () {
        st.getTracks().forEach(function (t) { t.stop(); }); btn.classList.remove('on'); recorder = null;
        new Audio(URL.createObjectURL(new Blob(chunks))).play();
      };
      recorder.start(); setTimeout(function () { if (recorder) recorder.stop(); }, 1000 * (+btn.dataset.max || 8));
    }).catch(function () { toast(T('Microphone not allowed.', '没有麦克风权限。')); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set-lang]'); if (b) return setLang(b.dataset.setLang);
    var s = e.target.closest('.say'); if (s && s.dataset.say) { e.stopPropagation(); return speak(s.dataset.say, 0.9); }
    var r = e.target.closest('.rec'); if (r) return record(r);
  });
  document.addEventListener('DOMContentLoaded', function () {
    setLang(document.body.dataset.lang || 'both'); navInit();
    var n = document.getElementById('n-due'), d = due().length; if (n && d) n.textContent = d;
  });
  window.EH = { T: T, setLang: setLang, syncLabels: syncLabels, toast: toast,
    KEY: KEY, STEPS: STEPS, get state() { return state; }, save: save, today: today, addDays: addDays,
    lessonKey: lessonKey, lesson: lesson, setStep: setStep, stepCount: stepCount,
    addCard: addCard, grade: grade, due: due, wrongAdd: wrongAdd, wrongClear: wrongClear,
    exportJSON: exportJSON, importJSON: importJSON, speak: speak, streak: streak, esc: esc, norm: norm, touch: touch
  };
})();
