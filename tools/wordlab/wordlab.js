/* 单词学习（列表＋弹窗新版样板）。规格：design/words-ux-v2-2026-11-26.md；r1 修订按 fcgbbs/design/reviews/english-hub-words-v2-2026-11-26.md。
   纯本地：进度进 EH.state.wl（随全站备份导出）；学习方式、列表视图、辅助语言、隐藏翻译、大字、快捷键开关、使用记录各占一个 localStorage 键，不上传。
   弹窗＝原生 <dialog>.showModal()（焦点圈、Esc、背景失活由浏览器给；桌面也保持模态，理由见设计文档 §r1-11）；
   五个标签各有自己的 tabpanel；出处、键盘说明、设置＝Popover API（打开时焦点进去，关上回到打开它的按钮）；切换动画＝View Transitions。 */
(function () {
  'use strict';
  var EH = window.EH, WL = window.EH_WL, root = document.getElementById('wl'), dlg = document.getElementById('wl-dlg');
  if (!EH || !WL || !root || !dlg) return;
  var esc = EH.esc, $ = function (id) { return document.getElementById(id); };
  var K = { variant: 'english-hub-wl-variant', usage: 'english-hub-wl-usage', view: 'english-hub-wl-view', aux: 'english-hub-wl-aux', hidetr: 'english-hub-wl-hidetr', big: 'english-hub-wl-big', keys: 'english-hub-wl-keys', khint: 'english-hub-wl-khint' };
  var VARIANTS = ['senses', 'examples', 'cards'], TABS = ['learn', 'meaning', 'listen', 'spell', 'use'];
  var IV = [0, 1, 3, 7, 14, 30];            // 第 n 格答对后隔几天再见（间隔复习的最小做法：五格）
  var REVIEW_CAP = 20;                      // 一次复习最多排多少；总欠账另外显示
  var ST = EH.state.wl || (EH.state.wl = { s: {}, own: {}, day: {} });
  ST.rv = ST.rv || {}; ST.done = ST.done || {};
  var BY = {}; WL.words.forEach(function (b) { BY[b.w] = b; });
  var scroller = $('wl-body'), body = $('wl-p-learn'), cur = null, tab = 'learn', opener = null, t0 = 0, sess = null;
  var NUM = ['①', '②', '③', '④', '⑤'];
  /* 辅助语言：学习语言＝英语；辅助语言可插拔。加一种＝这里一行＋数据里每个字段多一个键（如 ja）。 */
  var AUX = { 'zh-Hans': { key: 'zh', lang: 'zh-Hans' }, 'zh-Hant': { key: 'zt', lang: 'zh-Hant' } };

  /* ---------- 小工具 ---------- */
  function get(k, d) { try { var v = localStorage.getItem(K[k]); return v == null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(K[k]); else localStorage.setItem(K[k], v); } catch (e) {} }
  function auxName() { var a = get('aux', ''); return AUX[a] ? a : 'zh-Hans'; }
  function A(o) { return o ? (o[AUX[auxName()].key] || o.zh || '') : ''; }
  function T(en, zh) { return '<span class="enx">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span>'; }
  function TA(o, tr) { return '<span class="enx">' + esc(o.en) + '</span><span class="zh' + (tr ? ' wl-tr' : '') + '" lang="' + AUX[auxName()].lang + '">' + esc(A(o)) + '</span>'; }
  function lang() { return document.body.dataset.lang; }
  function today() { return EH.today(); }
  function variant() { return root.dataset.variant; }
  function live(html) { var l = $('wl-live'); l.innerHTML = ''; setTimeout(function () { l.innerHTML = html; }, 30); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function calm() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function swap(fn) { if (document.startViewTransition && !calm()) document.startViewTransition(fn); else fn(); }
  function load(w, cb) {
    if (WL.full[w]) return cb(WL.full[w]);
    var s = document.createElement('script'); s.src = document.body.dataset.root + 'data/wordlab/w/' + encodeURIComponent(w) + '.js';
    s.onload = function () { cb(WL.full[w]); };
    s.onerror = function () { EH.toast(T('Could not load this word. Check your connection and try again.', '这个词没载出来。检查网络后再试。')); };
    document.head.appendChild(s);
  }
  function senses(W, coreOnly) { var o = []; W.pos.forEach(function (P) { P.senses.forEach(function (S) { if (!coreOnly || S.core) o.push({ P: P, S: S }); }); }); return o; }
  function posName(p) { var n = WL.pos[p] || { en: p, zh: p }; return TA(n); }
  function posTag(x) { return x.S.ph ? '<span class="wl-phtag">' + T('phrase', '短语') + '</span>' : '<span class="wl-pos">' + esc(x.P.p) + '.</span>'; }

  /* ---------- 朗读：不自动播放；失败要看得见 ---------- */
  function voice() {
    var vs = speechSynthesis.getVoices();
    return vs.filter(function (v) { return /en[-_]GB/i.test(v.lang) && v.localService; })[0] || vs.filter(function (v) { return /^en/i.test(v.lang) && v.localService; })[0] || vs.filter(function (v) { return /^en/i.test(v.lang); })[0];
  }
  function sayFail(why) {
    var m = $('wl-amsg'), h = '⚠️ ' + T('The sound did not play' + (why ? ' (' + why + ')' : '') + '. Check that the volume is on, or read the sentence instead.', '声音没放出来' + (why ? '（' + why + '）' : '') + '。看看音量有没有开，或者改成看句子。');
    if (m) { m.innerHTML = h; m.hidden = false; } else EH.toast(h);
  }
  function say(text, rate) {
    var m = $('wl-amsg'); if (m) m.hidden = true;
    if (!text) return;
    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return sayFail(T('this browser cannot speak', '这个浏览器不会朗读'));
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text), ok = false, v = voice(); u.lang = 'en-GB'; u.rate = rate || 0.9; if (v) u.voice = v;
    u.onstart = function () { ok = true; };
    u.onerror = function (e) { if (e && e.error === 'interrupted' || e && e.error === 'canceled') return; ok = true; sayFail(e && e.error); };
    setTimeout(function () { if (!ok && !speechSynthesis.speaking) sayFail(speechSynthesis.getVoices().length ? '' : T('no English voice on this device', '设备上没有英语语音')); }, 2500);
    speechSynthesis.speak(u);
  }

  /* ---------- 进度：单位是「意思」，不是词 ---------- */
  function status(id) {
    var r = ST.s[id];
    if (!r || !r.box) return 'new';
    if (r.due <= today()) return 'due';
    return r.box >= 5 ? 'known' : 'going';
  }
  function step1(r, ok, t) {                 // 排期规则本身（纯函数）：闪卡自评键上写的格子变化也由它算
    var box = r ? r.box : 0, same = r && r.last === t && box;
    if (ok) { box = same ? box : Math.min(5, box + 1); return { box: box, due: EH.addDays(t, IV[box]) }; }
    if (ok === null) { box = Math.max(1, box); return { box: box, due: EH.addDays(t, 1) }; }
    box = Math.max(1, box - 1); return { box: box, due: t };   // 答错退一格、不清零；今天再见一次
  }
  function answer(id, mode, ok) {            // ok: true 对 / false 错 / null 模糊（不升不降，明天再见）
    var t = today(), r = ST.s[id] || (ST.s[id] = { box: 0, due: t, seen: 0, k: {} });
    var k = r.k[mode] || (r.k[mode] = [0, 0]);
    if (!r.box) ST.day[t] = (ST.day[t] || 0) + 1;
    if (sess && sess.review) ST.rv[t] = (ST.rv[t] || 0) + 1;
    r.seen++; k[1]++; if (ok) k[0]++;
    var n = step1(r, ok, t); r.box = n.box; r.due = n.due;
    r.last = t; EH.touch(); EH.save();
    use(function (u) { u.drills++; if (ok) u.ok++; if (sess && sess.review) u.revDone++; });
    paintList();
  }
  function dueList() {
    var t = today(), o = [];
    for (var id in ST.s) if (ST.s[id].box && ST.s[id].due <= t && BY[id.split('.')[0]]) o.push(id);
    o.sort(function (a, b) { return ST.s[a].due < ST.s[b].due ? -1 : ST.s[a].due > ST.s[b].due ? 1 : ST.s[a].box - ST.s[b].box; });
    return o;
  }
  function markDone(w, k) { var d = ST.done[w] || (ST.done[w] = {}); if (!d[k]) { d[k] = today(); EH.save(); } paintTicks(); }
  function paintTicks() { var d = cur && ST.done[cur.w] || {}; TABS.forEach(function (k) { $('wl-tab-' + k).querySelector('.wl-tick').hidden = !d[k]; }); }
  function nextTab(k) { var d = cur && ST.done[cur.w] || {}, i = TABS.indexOf(k); for (var j = 1; j <= 5; j++) { var x = TABS[(i + j) % 5]; if (!d[x] && x !== 'learn') return x; } return null; }

  /* ---------- 使用记录（只在本机；供一周后对比三种学习方式） ---------- */
  function usage() { try { return JSON.parse(localStorage.getItem(K.usage)) || {}; } catch (e) { return {}; } }
  function use(fn) {
    var U = usage(), v = variant(), u = U[v] || (U[v] = { opens: 0, words: {}, ms: 0, drills: 0, ok: 0, days: {}, revDue: 0, revDone: 0 });
    u.days[today()] = 1; fn(u);
    try { localStorage.setItem(K.usage, JSON.stringify(U)); } catch (e) {}
  }
  function dwell() { if (!t0) return; var ms = Math.min(Date.now() - t0, 10 * 60 * 1000); t0 = 0; use(function (u) { u.ms += ms; }); }   // 一次打开最多记 10 分钟
  function paintUsage() {
    var U = usage(), names = { senses: ['Meaning cards', '义项卡'], examples: ['Sentence first', '例句先行'], cards: ['Flashcards', '闪卡'] };
    var h = '<div class="wl-tw"><table class="wl-ut"><thead><tr><th scope="col" class="wl-one">' + T('Way of studying', '学习方式') + '</th><th scope="col" class="wl-one">' + T('Days used', '用了几天') + '</th><th scope="col" class="wl-one">' + T('Words opened', '学过的词') + '</th><th scope="col" class="wl-one">' + T('Minutes per word', '每词分钟') + '</th><th scope="col" class="wl-one">' + T('Answers right', '答对') + '</th><th scope="col" class="wl-one">' + T('Reviews finished', '复习完成') + '</th></tr></thead><tbody>';
    VARIANTS.forEach(function (v) {
      var u = U[v] || { opens: 0, words: {}, ms: 0, drills: 0, ok: 0, days: {}, revDue: 0, revDone: 0 }, nw = Object.keys(u.words).length;
      h += '<tr><th scope="row" class="wl-one">' + T(names[v][0], names[v][1]) + '</th><td>' + Object.keys(u.days).length + '</td><td>' + nw + '</td><td>' + (u.opens ? (u.ms / 60000 / u.opens).toFixed(1) : '–') + '</td><td>' +
        (u.drills ? u.ok + ' / ' + u.drills + ' (' + Math.round(100 * u.ok / u.drills) + '%)' : '–') + '</td><td>' + (u.revDue ? u.revDone + ' / ' + u.revDue + ' (' + Math.round(100 * Math.min(1, u.revDone / u.revDue)) + '%)' : '–') + '</td></tr>';
    });
    $('wl-usage-body').innerHTML = h + '</tbody></table></div>';
  }

  /* ---------- 设置：辅助语言、隐藏翻译、大字、快捷键 ---------- */
  var hantDone = new Map();
  function hantify(el) {                     // 界面字繁体：只换 lang=zh-Hans 的段（数据字段已按 zt 列直接出繁体，标 zh-Hant，不再换）
    if (auxName() !== 'zh-Hant' || !WL.hant) return;
    (el.matches && el.matches('[lang=zh-Hans]') ? [el] : []).concat([].slice.call(el.querySelectorAll ? el.querySelectorAll('[lang=zh-Hans]') : [])).forEach(function (z) {
      var w = document.createTreeWalker(z, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) { var s = n.nodeValue, t = s.replace(/[一-鿿]/g, function (c) { return WL.hant[c] || c; }); if (t !== s) { hantDone.set(n, s); n.nodeValue = t; } }
      z.setAttribute('lang', 'zh-Hant'); z.dataset.wlHans = '1';
    });
  }
  function unhantify() { hantDone.forEach(function (s, n) { n.nodeValue = s; }); hantDone.clear(); [].forEach.call(root.querySelectorAll('[data-wl-hans]'), function (z) { z.setAttribute('lang', 'zh-Hans'); delete z.dataset.wlHans; }); }
  new MutationObserver(function (ms) { if (auxName() !== 'zh-Hant') return; ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) hantify(n); else if (n.nodeType === 3 && n.parentElement) hantify(n.parentElement); }); }); })
    .observe(root, { childList: true, subtree: true });
  function setAux(a, quiet) {
    var was = auxName();
    if (a === 'en') { put('aux', 'en'); EH.setLang('en'); }
    else { put('aux', a); if (lang() === 'en') EH.setLang('both'); }
    root.dataset.aux = a === 'en' ? 'en' : a;
    if (was === 'zh-Hant' && a !== 'zh-Hant') unhantify();
    if (a === 'zh-Hant') hantify(root);
    var r = root.querySelector('[name=wl-aux][value="' + a + '"]'); if (r) r.checked = true;
    if (!quiet && dlg.open && cur && !sess) setTab(tab, true);
  }
  function syncAux() {                       // 页头 EN / EN+中 / 中文 切换后，辅助语言单选跟着对上
    var a = lang() === 'en' ? 'en' : auxName(), r = root.querySelector('[name=wl-aux][value="' + a + '"]'); if (r) r.checked = true;
    root.dataset.aux = a; $('wl-hidetr').disabled = a === 'en';
  }
  function setFlag(k, on) { put(k, on ? '1' : null); root.toggleAttribute('data-' + k, !!on); }
  function keysOn() { return get('keys', 'on') !== 'off'; }

  /* ---------- 列表 ---------- */
  function wordStatus(b) {
    var core = b.s.filter(function (s) { return s.core; }), st = core.map(function (s) { return status(s.id); });
    var n = function (k) { return st.filter(function (x) { return x === k; }).length; };
    var started = st.length - n('new');
    return { st: st, due: n('due'), known: n('known'), started: started, n: st.length, key: n('due') ? 'due' : !started ? 'new' : n('known') === st.length ? 'known' : 'going' };
  }
  function paintList() {
    var q = EH.norm($('wl-q').value), qz = $('wl-q').value.trim(), f = (root.querySelector('[name=wl-filter]:checked') || {}).value || 'all', shown = 0;
    Array.prototype.forEach.call($('wl-list').querySelectorAll('.wl-item'), function (li) {
      var b = BY[li.dataset.w], ws = wordStatus(b);
      li.dataset.st = ws.key;
      li.querySelector('.wl-pips').textContent = ws.st.map(function (x) { return x === 'new' ? '○' : x === 'known' ? '●' : '◐'; }).join('');
      li.querySelector('.wl-stt').innerHTML = ws.key === 'new' ? T('New · ' + ws.n + ' meanings', '新词 · ' + ws.n + ' 个意思')
        : ws.key === 'due' ? '<span aria-hidden="true">🔁 </span>' + T('Review ' + ws.due + ' today', '今天复习 ' + ws.due + ' 个意思')
          : ws.key === 'known' ? '<span aria-hidden="true">✓ </span>' + T('All ' + ws.n + ' meanings known', ws.n + ' 个意思都会了')
            : T(ws.started + ' of ' + ws.n + ' meanings started', '学了 ' + ws.started + ' / ' + ws.n + ' 个意思');
      var hay = b.w + ' ' + b.s.map(function (s) { return s.cue.en + ' ' + s.c + ' ' + s.d.en; }).join(' '), hz = b.s.map(function (s) { return s.cue.zh + s.d.zh + (s.cue.zt || '') + (s.d.zt || ''); }).join(' ');
      var ok = (f === 'all' || f === ws.key) && (!qz || EH.norm(hay).indexOf(q) >= 0 && q || hz.indexOf(qz) >= 0);
      li.hidden = !ok; if (ok) shown++;
    });
    $('wl-none').hidden = !!shown;
    $('wl-count').className = 'muted wl-one'; $('wl-count').innerHTML = T(shown + ' of ' + WL.words.length + ' words', '显示 ' + shown + ' / ' + WL.words.length + ' 个词');
    var d = dueList().length, nd = ST.day[today()] || 0, rd = ST.rv[today()] || 0;
    var more = d > REVIEW_CAP ? T(' (' + REVIEW_CAP + ' per round, ' + Math.ceil(d / REVIEW_CAP) + ' rounds)', '（一次 ' + REVIEW_CAP + ' 个，分 ' + Math.ceil(d / REVIEW_CAP) + ' 次做）') : '';
    $('wl-today-t').className = 'wl-one'; $('wl-today-t').innerHTML = d ? T('Today: ' + d + ' meanings to review', '今天：' + d + ' 个意思要复习') + more + (nd ? T(' · ' + nd + ' new ones met', ' · 新学了 ' + nd + ' 个') : '')
      : rd ? '<span aria-hidden="true">✓ </span>' + T('Today\'s reviews are all done (' + rd + ' answered).' + (nd ? ' ' + nd + ' new meanings met.' : ''), '今日复习已清完（做了 ' + rd + ' 个）。' + (nd ? '新学了 ' + nd + ' 个意思。' : ''))
        : nd ? T('Nothing to review today. ' + nd + ' new meanings met today.', '今天没有要复习的，新学了 ' + nd + ' 个意思。')
          : Object.keys(ST.s).length ? T('Nothing to review today. Learn a new word, or come back tomorrow.', '今天没有要复习的。学一个新词，或者明天再来。') : T('Nothing to review yet. Pick any word to start.', '还没有要复习的。随便点一个词开始。');
    $('wl-review').hidden = !d;
    paintFv();
  }
  function paintFv() {                       // 「筛选与视图」按钮上写现在的状态，收起时也知道在看什么
    var pick = function (n) { var r = root.querySelector('[name=' + n + ']:checked'); return r ? r.closest('label').querySelector('.wl-segt').innerHTML : ''; };
    $('wl-fvs').innerHTML = '· ' + [pick('wl-filter'), pick('wl-view'), pick('wl-variant')].join(' · ');
  }
  function sortList() {
    var k = $('wl-sort').value, ul = $('wl-list'), items = Array.prototype.slice.call(ul.querySelectorAll('.wl-item'));
    var rank = { due: 0, going: 1, new: 2, known: 3 }, lv = { A2: 0, B1: 1, B2: 2, C1: 3 };
    var grp = function (w) { var b = BY[w]; return [w].concat(b.vs.filter(function (x) { return BY[x]; })).sort()[0]; };
    items.sort(function (a, b) {
      var x = a.dataset.w, y = b.dataset.w;
      if (k === 'st') return rank[a.dataset.st] - rank[b.dataset.st] || (x < y ? -1 : 1);
      if (k === 'lv') return lv[a.dataset.lv] - lv[b.dataset.lv] || (x < y ? -1 : 1);
      if (k === 'vs') { var p = (BY[x].vs.some(function (v) { return BY[v]; }) ? 0 : 1) - (BY[y].vs.some(function (v) { return BY[v]; }) ? 0 : 1); return p || (grp(x) < grp(y) ? -1 : grp(x) > grp(y) ? 1 : x < y ? -1 : 1); }
      return x < y ? -1 : 1;
    });
    items.forEach(function (li) { ul.appendChild(li); });
  }
  function order() { return Array.prototype.filter.call($('wl-list').querySelectorAll('.wl-item'), function (li) { return !li.hidden; }).map(function (li) { return li.dataset.w; }); }

  /* ---------- 弹窗：开、关、换词、换标签 ---------- */
  function open(w, from, keepTab, wantTab) {
    load(w, function (W) {
      if (!W) return;
      if (!dlg.open) { opener = from || document.activeElement; dlg.showModal(); try { history.pushState({ wl: w }, '', '#w=' + w); } catch (e) {} khint(); }
      else { dwell(); try { history.replaceState({ wl: w }, '', '#w=' + w); } catch (e) {} }
      cur = W; sess = null; t0 = Date.now();
      use(function (u) { u.opens++; u.words[w] = 1; });
      $('wl-title').textContent = W.w; $('wl-ipa').textContent = W.ipa; $('wl-say').dataset.say = W.w; $('wl-say').setAttribute('aria-label', 'Play the word ' + W.w);
      $('wl-slow').setAttribute('aria-label', 'Play the word ' + W.w + ' slowly');
      dlg.querySelector('.wl-df').hidden = false; $('wl-tabs').hidden = false; $('wl-p-review').hidden = true; $('wl-p-review').innerHTML = '';
      paintTicks();
      setTab(wantTab || (keepTab ? tab : 'learn'), true);
      $('wl-title').focus();
    });
  }
  function close() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () {
    dwell(); window.speechSynthesis && speechSynthesis.cancel(); cur = null; sess = null;
    if (history.state && history.state.wl) { try { history.back(); } catch (e) {} }
    if (opener && document.contains(opener)) opener.focus();
    paintList(); paintUsage();
  });
  /* Esc 只关最上面一层：开着的 Popover 先关（浏览器给），词卡里正在输入时 Esc 不关整张卡 */
  dlg.addEventListener('cancel', function (ev) { if (document.querySelector('.wl-pop:popover-open')) ev.preventDefault(); });
  window.addEventListener('popstate', function () { if (dlg.open && !(history.state && history.state.wl)) dlg.close(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) dwell(); else if (dlg.open) t0 = Date.now(); });
  function step(d) { var o = order(), i = o.indexOf(cur.w); if (i < 0) o = WL.words.map(function (b) { return b.w; }), i = o.indexOf(cur.w); open(o[(i + d + o.length) % o.length], null, true); }
  function setTab(k, quiet) {
    if (tab === 'learn' && k !== 'learn' && cur && dlg.open && !quiet) markDone(cur.w, 'learn');
    tab = k;
    TABS.forEach(function (x) {
      var b = $('wl-tab-' + x), p = $('wl-p-' + x), on = x === k;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      p.hidden = !on; if (!on) p.innerHTML = '';          // 只有当前面板有内容：id 不重复
    });
    body = $('wl-p-' + k);
    var draw = function () { scroller.scrollTop = 0; scroller.className = 'wl-body wl-t-' + k; (k === 'learn' ? LEARN[variant()] : DRILL)(k); };
    if (quiet) draw(); else swap(draw);
  }
  function khint() {                         // 有实体键盘的设备第一次打开词卡：告诉它有快捷键、在哪关
    if (get('khint', '') || !keysOn() || !(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
    $('wl-khint').hidden = false;
  }

  /* ---------- 共用零件 ---------- */
  function srcTag(e, label) {
    var b = e.src === 'pd' ? WL.books[e.book] : null, lv = ['easier', 'medium', 'harder'], lz = ['较易', '中等', '较难'];
    var txt = b ? '📜 ' + esc(b[1].split(' ').pop()) + ' ' + b[2] + ' · ' + T('classic, ' + lv[e.lvl], '经典 · ' + lz[e.lvl]) : e.src === 'tatoeba' ? '🌍 Tatoeba' : '✍️ ' + T('Ours', '本站');
    return '<button type="button" class="wl-src" popovertarget="wl-spop" data-src="' + esc(JSON.stringify(e)) + '" aria-label="Source of ' + esc(label) + ': ' + (b ? 'classic book, ' + lv[e.lvl] : e.src === 'tatoeba' ? 'Tatoeba' : 'written for this site') + '">' + txt + '</button>';
  }
  function srcInfo(e) {
    var zs = e.zs === 'tatoeba' ? T('Chinese: Tatoeba #' + e.zid + ' by ' + esc(e.zby) + ' (converted to simplified script).', '中文译文：Tatoeba #' + e.zid + '，作者 ' + esc(e.zby) + '（转为简体）。') : T('Chinese translation: ours.', '中文译文：本站。');
    if (e.src === 'pd') { var b = WL.books[e.book]; return '<h2>📜 <i>' + esc(b[0]) + '</i></h2><p>' + esc(b[1]) + ', ' + b[2] + '</p><p>' + T('Public domain. Quoted word for word from the Project Gutenberg text #' + e.book + '. Older English: ' + ['easier', 'medium', 'harder'][e.lvl] + ' to read.', '公有领域作品。逐字引自 Project Gutenberg 第 ' + e.book + ' 号文本。旧式英语，读起来' + ['较易', '中等', '较难'][e.lvl] + '。') + '</p><p class="muted">' + zs + '</p>'; }
    if (e.src === 'tatoeba') return '<h2>🌍 Tatoeba</h2><p>' + T('Sentence #' + e.id + ' by ' + esc(e.by) + '. Licence CC BY 2.0 FR. Unchanged.', '第 ' + e.id + ' 句，作者 ' + esc(e.by) + '。许可 CC BY 2.0 FR。原句未改。') + '</p><p class="muted">' + zs + '</p>';
    return '<h2>✍️ ' + T('Written for this site', '本站自写') + '</h2><p>' + T('A sample sentence written for English Hub. It has not yet had a second review.', '为本站写的样板例句，还没有经过第二轮审校。') + '</p>';
  }
  function exLi(e, label) {
    return '<li class="wl-x"><button type="button" class="wl-ib wl-play" data-say="' + esc(e.en) + '" aria-label="Play ' + esc(label) + '">🔊</button><div class="wl-xb"><p class="en" lang="en">' + e.h + '</p>' +
      '<p class="zh wl-tr" lang="' + AUX[auxName()].lang + '">' + esc(A(e)) + '</p>' + srcTag(e, label) + '</div></li>';
  }
  function pip(id) { var s = status(id), sym = { new: '○', known: '●', due: '◐', going: '◐' }[s]; return '<span class="wl-pip wl-pip-' + s + '"><span aria-hidden="true">' + sym + ' </span>' + (s === 'new' ? T('new', '没学') : s === 'known' ? T('known', '会了') : s === 'due' ? T('review today', '今天复习') : T('learning', '学习中')) + '</span>'; }
  function regTag(S) { var r = WL.reg[S.reg]; return r ? '<span class="wl-reg">' + TA(r) + '</span>' : ''; }
  function cueLine(x) { return '<b class="wl-cueb">' + TA(x.S.cue) + '</b>' + (x.S.ph ? ' <b class="en wl-phx" lang="en">' + esc(x.S.ph) + '</b>' : ''); }
  function senseNo(S) { var n = 0, k = 0; cur && cur.pos.forEach(function (P) { P.senses.forEach(function (y) { n++; if (y.id === S.id) k = n; }); }); return k; }
  function senseCard(x, i) {
    var S = x.S, lbl = 'meaning ' + senseNo(S) + ' (“' + S.cue.en + '”, ' + (S.ph ? 'phrase' : (WL.pos[x.P.p] || { en: x.P.p }).en) + ')';
    return '<article class="wl-sense" id="s-' + esc(S.id) + '" data-id="' + esc(S.id) + '"><header class="wl-sh"><span class="wl-n" aria-hidden="true">' + (i == null ? '' : i + 1) + '</span>' +
      '<div class="wl-sd"><p class="wl-cueline">' + cueLine(x) + ' ' + posTag(x) + ' ' + regTag(S) + ' ' + pip(S.id) + '</p>' +
      '<p class="wl-def">' + TA(S.d, true) + '</p></div></header>' +
      (S.coll.length ? '<p class="wl-coll">' + S.coll.map(function (c) { return '<button type="button" class="wl-chip" data-say="' + esc(c.replace(/\b(sb|sth)\b/g, '').replace(/[()…]/g, '')) + '" lang="en" aria-label="Play the phrase ' + esc(c) + ', ' + esc(lbl) + '">' + esc(c) + '</button>'; }).join('') + '</p>' : '') +
      (S.note ? '<p class="wl-note"><span aria-hidden="true">💡 </span><span class="wl-one">' + TA(S.note) + '</span></p>' : '') +
      '<ul class="wl-xs">' + S.ex.map(function (e, j) { return exLi(e, 'example ' + (j + 1) + ' of ' + lbl); }).join('') + '</ul></article>';
  }
  function posCount(W) { return W.pos.filter(function (P) { return P.senses.some(function (S) { return !S.ph; }); }).length; }
  function senseMap(W, force) {                // 「意思 × 词性」：≥2 个词性才出表（宽屏是表，窄屏是按词性分组的列表）；短语义单列一栏
    var multi = posCount(W) >= 2;
    if (!multi && !force) return '';
    var cues = [], by = {}, ps = [];
    senses(W).forEach(function (x) { var p = x.S.ph ? 'ph' : x.P.p; if (ps.indexOf(p) < 0) ps.push(p); var k = x.S.cue.en + '|' + x.S.cue.zh; if (!by[k]) { by[k] = { cue: x.S.cue, core: false, c: {} }; cues.push(k); } by[k].c[p] = x.S; if (x.S.core) by[k].core = true; });
    ps.sort(function (a, b) { return (a === 'ph') - (b === 'ph'); });
    cues.sort(function (a, b) { return (by[b].core ? 1 : 0) - (by[a].core ? 1 : 0); });
    var link = function (S) { return '<a href="#s-' + esc(S.id) + '" class="wl-jump" data-jump="' + esc(S.id) + '">' + (S.ph ? '<b class="en" lang="en">' + esc(S.ph) + '</b> ' : '') + TA({ en: S.d.en.split(';')[0], zh: S.d.zh, zt: S.d.zt }, true) + '</a>'; };
    var h = '<div class="wl-mapw">';
    if (multi) {
      h += '<div class="wl-tw wl-mapt"><table class="wl-map"><caption class="wl-one">' + T('All the meanings of ' + esc(W.w) + ', by part of speech', esc(W.w) + ' 的全部意思，按词性排') + '</caption><thead><tr><th scope="col" class="wl-one">' + T('Idea', '线索') + '</th>' +
        ps.map(function (p) { return '<th scope="col">' + posName(p) + '</th>'; }).join('') + '</tr></thead><tbody>';
      cues.forEach(function (k) {
        h += '<tr' + (by[k].core ? '' : ' class="wl-rare"') + '><th scope="row">' + TA(by[k].cue) + '</th>' + ps.map(function (p) {
          var S = by[k].c[p]; return '<td>' + (S ? link(S) : '<span aria-hidden="true">–</span><span class="wl-sr">none</span>') + '</td>';
        }).join('') + '</tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '<div class="wl-mapl' + (multi ? '' : ' wl-solo') + '"><p class="wl-mcap wl-one">' + T('All the meanings of ' + esc(W.w), esc(W.w) + ' 的全部意思') + '</p>' + ps.map(function (p) {
      return '<h4 class="wl-mph">' + posName(p) + '</h4><ul class="wl-ml">' + senses(W).filter(function (x) { return (x.S.ph ? 'ph' : x.P.p) === p; }).map(function (x) { return '<li' + (x.S.core ? '' : ' class="wl-rare"') + '>' + link(x.S) + '</li>'; }).join('') + '</ul>';
    }).join('') + '</div>';
    return h + '</div>';
  }
  function hook(W) {
    var h = '<p class="wl-hook wl-one"><span aria-hidden="true">💡 </span>' + TA(W.hook) + '</p>';
    W.vs.forEach(function (v) { h += '<p class="wl-vs"><span aria-hidden="true">🆚 </span><b lang="en">' + esc(W.w) + '</b> / ' + (v.has ? '<button type="button" class="wl-chip" data-open="' + esc(v.w) + '" lang="en" aria-label="Open the word ' + esc(v.w) + '">' + esc(v.w) + ' ›</button>' : '<b lang="en">' + esc(v.w) + '</b>') + ' <span class="wl-one">' + TA(v) + '</span></p>'; });
    return h;
  }
  function tabName(k) { var b = $('wl-tab-' + k); return b ? b.querySelector('.wl-tl').innerHTML : k; }
  function goBar(k) {                         // 收尾的下一步：按推荐顺序指向还没做的那一步
    var n = nextTab(k);
    return '<p class="wl-go">' + (n ? '<button type="button" class="primary wl-btn" data-tab-go="' + n + '">' + T('Next step: ', '下一步：') + tabName(n) + '</button> ' : '') +
      '<button type="button" class="wl-btn" data-step="1">' + T('Next word', '下一个词') + ' ›</button></p>';
  }
  function order5() { return '<p class="wl-order muted wl-one">' + T('Suggested order: ① Learn → ② Meaning → ③ Listen → ④ Spell → ⑤ Use. Any step can be opened directly; ✓ marks the ones you have done.', '推荐顺序：① 学 → ② 认 → ③ 听 → ④ 拼 → ⑤ 用。哪一步都可以直接点；做过的标 ✓。') + '</p>'; }

  /* ---------- 「学」标签的三种学习方式 ---------- */
  var LEARN = {
    senses: function () {                      // A 义项卡：先给全貌（一句话＋意思表），再一义一卡；短语义另起一组
      var W = cur, h = order5() + hook(W) + senseMap(W), rare = [], phr = [];
      W.pos.forEach(function (P) {
        var core = P.senses.filter(function (S) { return S.core && !S.ph; });
        P.senses.forEach(function (S) { if (S.ph) phr.push({ P: P, S: S }); else if (!S.core) rare.push({ P: P, S: S }); });
        if (!core.length) return;
        h += '<h3 class="wl-ph">' + posName(P.p) + (P.ipa ? ' <span class="ipa">' + esc(P.ipa) + '</span>' : '') + '</h3>' + core.map(function (S, i) { return senseCard({ P: P, S: S }, i); }).join('');
      });
      if (phr.length) h += '<h3 class="wl-ph">' + posName('ph') + '</h3>' + phr.map(function (x, i) { return senseCard(x, i); }).join('');
      if (rare.length) h += '<details class="wl-more"><summary class="wl-one">' + T('Less common meanings (' + rare.length + ')', '不太常用的意思（' + rare.length + ' 个）') + '</summary>' + rare.map(function (x) { return senseCard(x, null); }).join('') + '</details>';
      body.innerHTML = h + '<p class="wl-go"><button type="button" class="primary wl-btn" data-tab-go="meaning">' + T('Test me on the meanings: ', '考考我这些意思：') + tabName('meaning') + '</button> <button type="button" class="wl-btn" data-step="1">' + T('Next word', '下一个词') + ' ›</button></p>';
    },
    examples: function () {                    // B 例句先行：先看句子自己判断，答完才开卡
      var W = cur, core = senses(W, true);
      sess = { q: shuffle(core).map(function (x) { return item('meaning', W, x, x.S.ex[0]); }), i: 0, ok: 0, done: function () {
        markDone(W.w, 'learn');
        body.innerHTML = '<p class="wl-done wl-one">' + T('That was every common meaning of ' + esc(W.w) + '. Here they are together.', esc(W.w) + ' 的常用意思都过了一遍。合在一起看：') + '</p>' + hook(W) + senseMap(W, true) + goBar('learn');
      } };
      ask();
    },
    cards: function () {                       // C 闪卡：一义一卡，先想再翻，自评
      var W = cur, core = senses(W, true), due = core.filter(function (x) { return status(x.S.id) === 'due'; });
      sess = { q: (due.length ? due : core).map(function (x) { return { type: 'card', W: W, x: x, e: x.S.ex[0] }; }), i: 0, ok: 0, done: function () {
        markDone(W.w, 'learn');
        body.innerHTML = '<p class="wl-done wl-one">' + T('Deck finished. The meanings you were unsure of will come back sooner.', '这一叠看完了。没把握的意思会更早回来。') + '</p>' + senseMap(W, true) + goBar('learn');
      } };
      ask();
    }
  };

  /* ---------- 题：认／听／拼／用，以及闪卡。一道题＝一个意思的一条例句 ---------- */
  function gap(e) { return e.h.replace(/<b>.*?<\/b>/, '<span class="wl-gap"><span class="wl-sr">blank</span><span aria-hidden="true">_____</span></span>'); }
  function item(type, W, x, e) { return { type: type, W: W, x: x, e: e }; }
  function options(W, x) {
    var all = senses(W, true).filter(function (y) { return y.S.id !== x.S.id; });
    return shuffle(shuffle(all).slice(0, 3).concat([x]));
  }
  function build(k) {
    var W = cur, q = [];
    senses(W, true).forEach(function (x) {
      var exs = x.S.ex.filter(function (e) { return k !== 'listen' && k !== 'tiles' || e.en.split(' ').length <= 16; });
      var e = exs[(ST.s[x.S.id] ? ST.s[x.S.id].seen : 0) % (exs.length || 1)] || x.S.ex[0];
      if (k === 'use') {
        var partner = W.vs.filter(function (v) { return v.has; })[0];
        var short = x.S.ex.filter(function (e) { var n = e.en.split(' ').length; return n >= 4 && n <= 9 && e.src !== 'pd'; })[0];
        if (partner) q.push({ type: 'pick', W: W, x: x, e: e, pair: [W.w, partner.w] });
        else if (short) q.push(item('tiles', W, x, short));
        else q.push(item('spell', W, x, e));
      } else q.push(item(k, W, x, e));
    });
    return shuffle(q).slice(0, 6);
  }
  function DRILL(k) {
    var W = cur;
    sess = { q: build(k), i: 0, ok: 0, done: function () {
      var n = sess.q.length; markDone(W.w, k);
      body.innerHTML = '<p class="wl-done wl-one">' + (sess.ok === n ? '<span aria-hidden="true">🎉 </span>' : '') + T(sess.ok + ' of ' + n + ' right.', '答对 ' + sess.ok + ' / ' + n + '。') + '</p>' +
        (k === 'use' ? ownBox(W) : '') + senseMap(W) +
        '<p class="wl-go"><button type="button" class="wl-btn" data-tab-go="' + k + '">↻ ' + T('Again', '再练一轮') + '</button></p>' + goBar(k);
    } };
    ask();
  }
  function ownBox(W) {
    var mine = (ST.own[W.w] || []).map(function (o) { return '<li lang="en">' + esc(o.t) + '</li>'; }).join('');
    return '<section class="wl-own"><h3>✍️ ' + T('Now your own sentence with ' + esc(W.w), '用 ' + esc(W.w) + ' 写一句你自己的话') + '</h3>' +
      '<p class="muted wl-one">' + T('About your own life, using one of the word partners above. It is saved only in this browser and nobody marks it.', '写你自己的事，用上一个搭配。只存在这个浏览器里，没有人打分。') + '</p>' +
      '<label class="wl-sr" for="wl-own-t">Your sentence</label><textarea id="wl-own-t" rows="2" lang="en" autocapitalize="sentences"></textarea>' +
      '<p><button type="button" class="wl-btn" id="wl-own-save">' + T('Keep it', '存下来') + '</button></p><ul class="wl-mine" id="wl-mine">' + mine + '</ul></section>';
  }
  function prog() {
    return '<p class="wl-prog"><span aria-hidden="true">' + sess.q.map(function (_, j) { return j < sess.i ? '●' : j === sess.i ? '◉' : '○'; }).join(' ') + '</span> ' +
      '<span class="wl-sr">' + T('Question ' + (sess.i + 1) + ' of ' + sess.q.length, '第 ' + (sess.i + 1) + ' 题，共 ' + sess.q.length + ' 题') + '</span><span class="muted" aria-hidden="true">' + (sess.i + 1) + ' / ' + sess.q.length + '</span></p>';
  }
  function actBar(it) {                        // 吸底的「下一题」：答之前是「跳过」，答完是「下一题」／「完成」——位置不变
    var last = sess.i + 1 >= sess.q.length;
    return '<div class="wl-act"><button type="button" class="wl-btn wl-wide' + (it && it.done ? ' primary' : '') + '" id="wl-nextq"><span class="wl-one">' + (it && it.done ? (last ? T('Finish', '完成') : T('Next question', '下一题')) : T('Skip this one', '跳过这题')) + '</span> ›</button></div>';
  }
  function ask() {
    if (!sess.q.length) { body.innerHTML = '<p class="wl-done wl-one">' + T('Nothing to practise here yet.', '这里暂时没有可练的。') + '</p>'; return; }
    if (sess.i >= sess.q.length) return sess.done();
    var it = sess.q[sess.i], W = it.W, S = it.x.S, e = it.e, h = prog(), head = sess.review ? '<p class="wl-rw" lang="en"><b>' + esc(W.w) + '</b> <span class="ipa">' + esc(W.ipa) + '</span></p>' : '';
    it.done = false;
    if (it.type === 'meaning' || it.type === 'listen') {
      it.opts = options(W, it.x);
      var hear = it.type === 'listen';
      h += head + '<div class="wl-q"><p class="wl-ask wl-one">' + (hear ? T('Listen. Which meaning of ' + esc(W.w) + ' do you hear?', '听一句。这里的 ' + esc(W.w) + ' 是哪个意思？') : T('Which meaning of ' + esc(W.w) + ' is this?', '这句里的 ' + esc(W.w) + ' 是哪个意思？')) + '</p>' +
        (hear ? '<p class="wl-bigp"><button type="button" class="primary wl-btn wl-bigplay" id="wl-again" data-say="' + esc(e.en) + '" aria-keyshortcuts="S"><span aria-hidden="true">▶</span> ' + T('Play the sentence', '播放句子') + '</button></p><p class="wl-amsg" id="wl-amsg" role="alert" hidden></p>' : '') +
        '<div class="wl-stim">' + (hear ? '' : '<button type="button" class="wl-ib wl-play" id="wl-again" data-say="' + esc(e.en) + '" aria-label="Play the sentence" aria-keyshortcuts="S">🔊</button>') +
        '<p class="en wl-big' + (hear ? ' wl-veil' : '') + '" id="wl-sent" lang="en">' + e.h + '</p></div>' +
        (hear ? '<p><button type="button" class="wl-link wl-one" id="wl-show">' + T('I can\'t listen right now: show the sentence', '现在不方便听：显示句子') + '</button></p>' : '') +
        '<div class="wl-opts wl-pre" role="group" aria-label="Meanings to choose from">' + it.opts.map(function (o, j) {
          return '<button type="button" class="wl-opt" data-opt="' + j + '" aria-keyshortcuts="' + (j + 1) + '"><span class="wl-k" aria-hidden="true">' + (j + 1) + '</span><span class="wl-ot"><b>' + TA(o.S.cue) + '</b> ' + posTag(o) + '<span class="wl-od">' + TA(o.S.d) + '</span></span></button>';
        }).join('') + '</div><div class="wl-fb" id="wl-fb"></div></div>';
      body.innerHTML = h + actBar(it);
    } else if (it.type === 'spell') {
      h += head + '<div class="wl-q"><p class="wl-ask wl-one">' + T('Type the missing word.', '把空里的词拼出来。') + ' <span class="muted">' + T(esc(S.cue.en) + ': ' + esc(S.d.en), esc(A(S.cue)) + '：' + esc(A(S.d))) + '</span></p>' +
        '<div class="wl-stim"><p class="en wl-big" lang="en">' + gap(e) + '</p></div><p class="zh wl-tr" lang="' + AUX[auxName()].lang + '">' + esc(A(e)) + '</p>' +
        '<form class="wl-form" id="wl-form"><label class="wl-sr" for="wl-in">The missing word</label><input id="wl-in" lang="en" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="done">' +
        '<button type="submit" class="primary wl-btn">' + T('Check', '确认') + '</button> <button type="button" class="wl-btn" id="wl-hint">' + T('First letter', '提示首字母') + '</button></form><div class="wl-fb" id="wl-fb"></div></div>';
      body.innerHTML = h + actBar(it); $('wl-in').focus();
    } else if (it.type === 'pick') {
      h += head + '<div class="wl-q"><p class="wl-ask wl-one">' + T('Which word goes in the blank?', '空里该填哪个词？') + '</p><div class="wl-stim"><p class="en wl-big" lang="en">' + gap(e) + '</p></div><p class="zh wl-tr" lang="' + AUX[auxName()].lang + '">' + esc(A(e)) + '</p>' +
        '<div class="wl-opts wl-two" role="group" aria-label="Two words to choose from">' + it.pair.map(function (w, j) { return '<button type="button" class="wl-opt" data-pick="' + esc(w) + '" aria-keyshortcuts="' + (j + 1) + '" lang="en"><span class="wl-k" aria-hidden="true">' + (j + 1) + '</span><span class="wl-ot"><b>' + esc(w) + '</b></span></button>'; }).join('') + '</div><div class="wl-fb" id="wl-fb"></div></div>';
      body.innerHTML = h + actBar(it);
    } else if (it.type === 'tiles') {
      it.words = e.en.split(' '); it.built = [];
      it.pool = shuffle(it.words.map(function (w, j) { return j; }));
      h += head + '<div class="wl-q"><p class="wl-ask wl-one">' + T('Build the sentence. Tap the words in order.', '把这句话拼出来：按顺序点词。') + '</p><p class="zh wl-big" lang="' + AUX[auxName()].lang + '">' + esc(A(e)) + '</p>' +
        '<p class="wl-built en" id="wl-built" lang="en" aria-live="polite"></p><div class="wl-tiles" id="wl-tiles" role="group" aria-label="Words to choose from"></div>' +
        '<p><button type="button" class="wl-btn" id="wl-undo">⌫ ' + T('Undo', '撤一步') + '</button> <button type="button" class="wl-btn" id="wl-giveup">' + T('Show me', '看答案') + '</button></p><div class="wl-fb" id="wl-fb"></div></div>';
      body.innerHTML = h + actBar(it); tiles(it);
    } else if (it.type === 'card') {
      h += '<div class="wl-card" data-side="front"><div class="wl-front"><p class="wl-cw" lang="en">' + esc(W.w) + ' ' + posTag(it.x) + '</p>' +
        '<div class="wl-stim"><button type="button" class="wl-ib wl-play" id="wl-again" data-say="' + esc(e.en) + '" aria-label="Play the sentence" aria-keyshortcuts="S">🔊</button><p class="en wl-big" lang="en">' + e.h + '</p></div>' +
        '<p class="wl-ask wl-one">' + T('What does ' + esc(W.w) + ' mean here? Say it to yourself, then flip.', '这句里的 ' + esc(W.w) + ' 是什么意思？心里先说出来，再翻面。') + '</p>' +
        '<p><button type="button" class="primary wl-btn wl-wide" id="wl-flip">' + T('Flip the card', '翻面') + '</button></p></div><div class="wl-back" id="wl-back" hidden></div></div>';
      body.innerHTML = h;
    }
    scroller.scrollTop = 0;
  }
  function tiles(it) {
    $('wl-built').innerHTML = it.built.map(function (j) { return esc(it.words[j]); }).join(' ') || '<span class="muted">…</span>';
    $('wl-tiles').innerHTML = it.pool.map(function (j) { return '<button type="button" class="wl-tile" data-tile="' + j + '"' + (it.built.indexOf(j) >= 0 ? ' disabled' : '') + ' lang="en">' + esc(it.words[j]) + '</button>'; }).join('');
  }
  /* 紧凑反馈：对错＋正确意思一句＋「看完整卡」可选；读屏播报，焦点不动（留在你刚点的那个键上） */
  function feedback(it, ok, extra, shown) {
    var S = it.x.S; it.done = true;
    if (shown === undefined) shown = !!ok;
    if (shown) sess.ok++;
    answer(S.id, it.type === 'listen' ? 'l' : it.type === 'spell' ? 's' : it.type === 'meaning' ? 'm' : it.type === 'card' ? 'c' : 'u', ok);
    var one = '<p class="wl-ans">' + cueLine(it.x) + ' ' + posTag(it.x) + ' <span class="wl-ansd">' + TA(S.d, true) + '</span></p>';
    $('wl-fb').innerHTML = '<p class="wl-verdict ' + (shown ? 'ok' : 'no') + '"><span aria-hidden="true">' + (shown ? '✓' : '→') + '</span> <span class="wl-one">' + (shown ? T('Right.' + (ok === null ? ' You used the hint, so it comes back tomorrow.' : ''), '对。' + (ok === null ? '用了提示，明天再见一次。' : '')) : T('Not this time. It is:', '这次不是。应该是：')) + '</span></p>' + one + (extra || '') +
      '<details class="wl-full"><summary class="wl-one">' + T('See the whole card for this meaning', '看这个意思的完整卡') + '</summary>' + senseCard(it.x, null) + '</details>';
    var o = body.querySelector('.wl-opts'); if (o) o.classList.remove('wl-pre');
    var a = body.querySelector('.wl-act'); if (a) a.outerHTML = actBar(it);
    live((shown ? 'Right. ' : 'Not this time. The answer is: ') + esc(S.cue.en) + ', ' + esc(S.d.en) + '.');
    var s = $('wl-sent'); if (s) s.classList.remove('wl-veil');
    $('wl-fb').scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
  }
  function nextQ() { sess.i++; swap(ask); setTimeout(function () { var f = body.querySelector('.wl-opt, #wl-in, #wl-flip, .wl-tile, .wl-bigplay, #wl-close2, .wl-go button'); if (f && document.activeElement && !body.contains(document.activeElement)) f.focus({ preventScroll: true }); }, calm() ? 0 : 60); }

  /* 闪卡自评三档，与间隔复习的格子对齐：每个键上直接写这一档会把这个意思放到第几格、哪天再见 */
  function rateText(id, ok) {
    var t = today(), r = ST.s[id], n = step1(r, ok, t), from = r && r.box ? r.box : 0;
    var when = n.due === t ? T('again today', '今天再见') : n.due === EH.addDays(t, 1) ? T('tomorrow', '明天再见') : T('in ' + IV[n.box] + ' days', IV[n.box] + ' 天后再见');
    return '<span class="wl-box" data-box="' + n.box + '" data-due="' + n.due + '">' + T((from ? 'box ' + from + ' → ' : 'into box ') + n.box + ', ' + when, (from ? '第 ' + from + ' 格 → ' : '进第 ') + '第 ' + n.box + ' 格，' + when) + '</span>';
  }

  /* ---------- 今日复习：跨词，按格数换题型（低格先认，高格听、拼、用） ---------- */
  function review(from) {
    var all = dueList(), ids = all.slice(0, REVIEW_CAP), need = {}, n = 0;
    if (!ids.length) return;
    ids.forEach(function (id) { need[id.split('.')[0]] = 1; });
    var ws = Object.keys(need), go = function () {
      if (++n < ws.length) return;
      var q = [];
      ids.forEach(function (id) {
        var W = WL.full[id.split('.')[0]], x = senses(W).filter(function (y) { return y.S.id === id; })[0]; if (!x) return;
        var r = ST.s[id], e = x.S.ex[r.seen % x.S.ex.length], short = e.en.split(' ').length <= 16;
        q.push(item(r.box <= 1 ? 'meaning' : r.box === 2 && short ? 'listen' : r.box === 3 ? 'spell' : r.box >= 4 && short ? 'listen' : 'meaning', W, x, e));
      });
      if (!dlg.open) opener = from || document.activeElement;
      cur = q[0].W; t0 = Date.now();
      use(function (u) { u.revDue += q.length; });
      sess = { review: true, q: q, i: 0, ok: 0, done: function () {
        var left = dueList().length;
        body.innerHTML = '<p class="wl-done wl-one"><span aria-hidden="true">🎉 </span>' + T('Round done: ' + sess.ok + ' of ' + q.length + ' right. The ones you missed come back today; the rest move further out.', '这一轮做完：答对 ' + sess.ok + ' / ' + q.length + '。答错的今天还会再来，其余的往后排。') + '</p>' +
          '<p class="wl-left wl-one">' + (left ? T(left + ' meanings are still due today.', '今天还有 ' + left + ' 个意思到期。') : '<span aria-hidden="true">✓ </span>' + T('Today\'s reviews are all done.', '今日复习已清完。')) + '</p>' +
          '<p class="wl-go">' + (left ? '<button type="button" class="primary wl-btn" id="wl-more-review">🔁 ' + T('Next round', '再来一轮') + '</button> ' : '') + '<button type="button" class="' + (left ? '' : 'primary ') + 'wl-btn" id="wl-close2">' + T('Back to the list', '回到列表') + '</button></p>';
        ($('wl-more-review') || $('wl-close2')).focus();
      } };
      $('wl-title').textContent = 'Review'; $('wl-ipa').textContent = ''; $('wl-say').dataset.say = ''; $('wl-say').setAttribute('aria-label', 'Play the word');
      dlg.querySelector('.wl-df').hidden = true; $('wl-tabs').hidden = true;
      TABS.forEach(function (k) { $('wl-p-' + k).hidden = true; $('wl-p-' + k).innerHTML = ''; });
      body = $('wl-p-review'); body.hidden = false; scroller.className = 'wl-body wl-t-review';
      if (!dlg.open) { dlg.showModal(); try { history.pushState({ wl: 'review' }, '', '#review'); } catch (e) {} }
      ask(); $('wl-title').focus();
    };
    ws.forEach(function (w) { load(w, go); });
  }

  /* ---------- 事件 ---------- */
  root.addEventListener('click', function (ev) {
    var t = ev.target, b;
    if ((b = t.closest('[data-open]'))) return open(b.dataset.open, dlg.open ? null : b);
    if ((b = t.closest('.wl-src'))) { $('wl-spop').innerHTML = srcInfo(JSON.parse(b.dataset.src)); return; }   // 先填内容，浏览器随后自己打开 popover
    if ((b = t.closest('#wl-again'))) return say(b.dataset.say);
    if ((b = t.closest('[data-say]')) && !b.classList.contains('say')) { if (b.dataset.say) say(b.dataset.say); return; }
    if (t.closest('#wl-slow')) return say(cur ? cur.w : '', 0.55);
    if (t.closest('#wl-close') || t.closest('#wl-close2')) return close();
    if (t.closest('#wl-more-review')) return review();
    if (t.closest('#wl-prev')) return step(-1);
    if (t.closest('#wl-next') || t.closest('[data-step]')) return step(1);
    if ((b = t.closest('[data-tab]'))) return setTab(b.dataset.tab);
    if ((b = t.closest('[data-tab-go]'))) { setTab(b.dataset.tabGo); return $('wl-tab-' + b.dataset.tabGo).focus(); }
    if ((b = t.closest('.wl-jump'))) { ev.preventDefault(); var el = document.getElementById('s-' + b.dataset.jump); if (el) { var d = el.closest('details'); if (d) d.open = true; el.scrollIntoView({ block: 'start', behavior: calm() ? 'auto' : 'smooth' }); el.classList.add('wl-flash'); setTimeout(function () { el.classList.remove('wl-flash'); }, 1200); } return; }
    if (t.closest('.wl-veil')) return t.closest('.wl-veil').classList.remove('wl-veil');
    if ((b = t.closest('.wl-tr')) && root.hasAttribute('data-hidetr')) { b.classList.toggle('wl-open'); return; }
    if (t.closest('#wl-review')) return review(t.closest('#wl-review'));
    if (t.closest('#wl-fvb')) { var p = $('wl-fv'), on = p.hidden; p.hidden = !on; $('wl-fvb').setAttribute('aria-expanded', on ? 'true' : 'false'); return; }
    if (t.closest('#wl-khint-ok')) { put('khint', '1'); $('wl-khint').hidden = true; return $('wl-title').focus(); }
    if (t.closest('#wl-khint-off')) { put('khint', '1'); put('keys', 'off'); $('wl-keyon').checked = false; $('wl-khint').hidden = true; EH.toast(T('Single-key shortcuts are off. Turn them back on in Settings.', '单键快捷键已关。要用时在「设置」里打开。')); return $('wl-title').focus(); }
    if (t.closest('#wl-usage-x')) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ usage: usage(), progress: ST }, null, 1)], { type: 'application/json' })); a.download = 'english-hub-word-study-' + today() + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); return; }
    if (t.closest('#wl-usage-r')) { if (confirm('Clear the usage record? Your learning progress is kept.')) { localStorage.removeItem(K.usage); paintUsage(); } return; }
    if (!sess) return;
    var it = sess.q[sess.i];
    if (t.closest('#wl-nextq')) return nextQ();
    if (t.closest('#wl-show')) { $('wl-sent').classList.remove('wl-veil'); return; }
    if (!it || it.done) return;
    if ((b = t.closest('[data-opt]'))) {
      var pick = it.opts[+b.dataset.opt], ok = pick.S.id === it.x.S.id;
      Array.prototype.forEach.call(body.querySelectorAll('.wl-opt'), function (o) {
        o.setAttribute('aria-disabled', 'true'); var y = it.opts[+o.dataset.opt];
        if (y.S.id === it.x.S.id) { o.classList.add('right'); o.insertAdjacentHTML('beforeend', '<span class="wl-mark"><span aria-hidden="true">✓</span><span class="wl-sr"> (right answer)</span></span>'); }
        else if (o === b) { o.classList.add('wrong'); o.insertAdjacentHTML('beforeend', '<span class="wl-mark"><span aria-hidden="true">✗</span><span class="wl-sr"> (your choice)</span></span>'); }
      });
      return feedback(it, ok, '<p class="zh wl-tr" lang="' + AUX[auxName()].lang + '">' + esc(A(it.e)) + '</p>');
    }
    if ((b = t.closest('[data-pick]'))) {
      var good = b.dataset.pick === it.W.w;
      Array.prototype.forEach.call(body.querySelectorAll('.wl-opt'), function (o) { o.setAttribute('aria-disabled', 'true'); if (o.dataset.pick === it.W.w) { o.classList.add('right'); o.insertAdjacentHTML('beforeend', '<span class="wl-mark"><span aria-hidden="true">✓</span><span class="wl-sr"> (right answer)</span></span>'); } else if (o === b) { o.classList.add('wrong'); o.insertAdjacentHTML('beforeend', '<span class="wl-mark"><span aria-hidden="true">✗</span><span class="wl-sr"> (your choice)</span></span>'); } });
      var v = it.W.vs.filter(function (x) { return x.has; })[0];
      return feedback(it, good, '<p class="en wl-big" lang="en">' + it.e.h + '</p><p class="wl-note"><span aria-hidden="true">🆚 </span><span class="wl-one">' + TA(v) + '</span></p>');
    }
    if (t.closest('#wl-hint')) { var inp = $('wl-in'); inp.value = it.e.form.charAt(0); inp.focus(); it.hinted = true; return; }
    if ((b = t.closest('[data-tile]'))) {
      it.built.push(+b.dataset.tile); tiles(it);
      if (it.built.length === it.words.length) { var mine = it.built.map(function (j) { return it.words[j]; }).join(' '); feedback(it, mine === it.e.en, '<p class="en wl-big" lang="en">' + it.e.h + '</p>'); $('wl-nextq').focus({ preventScroll: true }); }
      else { var nx = $('wl-tiles').querySelector('button:not([disabled])'); if (nx) nx.focus(); }
      return;
    }
    if (t.closest('#wl-undo')) { it.built.pop(); return tiles(it); }
    if (t.closest('#wl-giveup')) return feedback(it, false, '<p class="en wl-big" lang="en">' + it.e.h + '</p>');
    if (t.closest('#wl-flip')) {
      var S = it.x.S, bk = $('wl-back'), card = body.querySelector('.wl-card');
      bk.innerHTML = '<p class="zh wl-tr" lang="' + AUX[auxName()].lang + '">' + esc(A(it.e)) + '</p>' + senseCard(it.x, null) +
        '<div class="wl-rate" role="group" aria-label="How well did you know it?"><p class="wl-ask wl-one">' + T('How well did you know it? Each button says where this meaning goes next.', '刚才想对了吗？每个键上写着这个意思接下来去第几格、哪天再见。') + '</p>' +
        '<button type="button" class="wl-opt" data-rate="0" aria-keyshortcuts="1"><span class="wl-k" aria-hidden="true">1</span><span class="wl-ot"><b><span aria-hidden="true">😕 </span>' + T('No', '没想起来') + '</b><span class="wl-od">' + rateText(S.id, false) + '</span></span></button>' +
        '<button type="button" class="wl-opt" data-rate="1" aria-keyshortcuts="2"><span class="wl-k" aria-hidden="true">2</span><span class="wl-ot"><b><span aria-hidden="true">🤔 </span>' + T('Not sure', '有点模糊') + '</b><span class="wl-od">' + rateText(S.id, null) + '</span></span></button>' +
        '<button type="button" class="wl-opt" data-rate="2" aria-keyshortcuts="3"><span class="wl-k" aria-hidden="true">3</span><span class="wl-ot"><b><span aria-hidden="true">🙂 </span>' + T('Yes', '想对了') + '</b><span class="wl-od">' + rateText(S.id, true) + '</span></span></button></div>';
      bk.hidden = false; card.dataset.side = 'back'; $('wl-flip').hidden = true; live('Card flipped. The meaning is shown.');
      bk.querySelector('[data-rate]').focus({ preventScroll: true }); bk.scrollIntoView({ block: 'nearest' });
      return;
    }
    if ((b = t.closest('[data-rate]'))) {
      var r = +b.dataset.rate; it.done = true; if (r === 2) sess.ok++;
      answer(it.x.S.id, 'c', r === 2 ? true : r === 1 ? null : false);
      if (r === 0 && !it.again) sess.q.push({ type: 'card', W: it.W, x: it.x, e: it.x.S.ex[1] || it.e, again: true });
      return nextQ();
    }
  });
  root.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'wl-form') return;
    ev.preventDefault();
    var it = sess && sess.q[sess.i]; if (!it) return;
    if (it.done) return nextQ();                 // 答完后在输入框里再按 Enter＝下一题（焦点一直在框里）
    var v = EH.norm($('wl-in').value); if (!v) return;
    var ok = v === EH.norm(it.e.form);
    $('wl-in').readOnly = true; $('wl-in').classList.add(ok ? 'right' : 'wrong');
    feedback(it, ok && !it.hinted ? true : ok ? null : false, '<p class="en wl-big" lang="en">' + it.e.h + '</p>', ok);
  });
  root.addEventListener('click', function (ev) {
    if (!ev.target.closest('#wl-own-save') || !cur) return;
    var ta = $('wl-own-t'), v = ta.value.trim(); if (!v) return ta.focus();
    (ST.own[cur.w] || (ST.own[cur.w] = [])).push({ t: v, d: today() }); EH.save(); ta.value = '';
    $('wl-mine').insertAdjacentHTML('beforeend', '<li lang="en">' + esc(v) + '</li>'); EH.toast(T('Saved in this browser.', '已存在这个浏览器里。'));
  });
  $('wl-tabs').addEventListener('keydown', function (ev) {          // 标签页的方向键（WAI-ARIA tabs 模式：左右移动并激活）
    var i = TABS.indexOf(tab);
    if (ev.key === 'ArrowRight') i = (i + 1) % 5; else if (ev.key === 'ArrowLeft') i = (i + 4) % 5; else if (ev.key === 'Home') i = 0; else if (ev.key === 'End') i = 4; else return;
    ev.preventDefault(); setTab(TABS[i]); $('wl-tab-' + TABS[i]).focus();
  });
  function typing(el) { return el && (el.matches('input:not([type=radio]):not([type=checkbox]),textarea,select') || el.isContentEditable); }
  dlg.addEventListener('keydown', function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target) || document.querySelector('.wl-pop:popover-open')) return;
    var k = ev.key.toLowerCase(), it = sess && sess.q[sess.i];
    if (k === 'enter' && it && it.done && !ev.target.closest('.wl-full, .wl-go, #wl-nextq, .wl-df, .wl-dh, .wl-khint')) { ev.preventDefault(); return nextQ(); }
    if (!keysOn()) return;                        // WCAG 2.1.4：单键快捷键可以关
    if (k === 'n' && !dlg.querySelector('.wl-df').hidden) return step(1);
    if (k === 'p' && !dlg.querySelector('.wl-df').hidden) return step(-1);
    if (k === 's') { var a = $('wl-again'); if (a) say(a.dataset.say); return; }
    if (/^[1-4]$/.test(k)) { var o = body.querySelectorAll('.wl-opt:not([aria-disabled=true])')[+k - 1]; if (o && it && !it.done) o.click(); }
  });
  /* Popover：打开时焦点进去，关上回到打开它的按钮（Esc 由浏览器给，只关最上面一层） */
  var popFrom = {};
  root.addEventListener('click', function (ev) { var b = ev.target.closest('[popovertarget]'); if (b && b.getAttribute('popovertargetaction') !== 'hide') popFrom[b.getAttribute('popovertarget')] = b; }, true);
  [].forEach.call(root.querySelectorAll('.wl-pop'), function (p) {
    p.addEventListener('toggle', function (ev) {
      if (ev.newState === 'open') { var f = p.querySelector('h2[tabindex], input:checked, button, a[href], input') || p; if (!f.hasAttribute('tabindex') && f === p) p.tabIndex = -1; f.focus(); if (p.id === 'wl-set') paintUsage(); }
      else { var b = popFrom[p.id]; if (b && document.contains(b) && (!document.activeElement || document.activeElement === document.body || p.contains(document.activeElement))) b.focus(); }
    });
  });
  $('wl-q').addEventListener('input', paintList);
  $('wl-filter').addEventListener('change', paintList);
  $('wl-sort').addEventListener('change', function () { sortList(); });
  $('wl-variant').addEventListener('change', function (ev) {
    var v = ev.target.value; if (VARIANTS.indexOf(v) < 0) return;
    swap(function () { root.dataset.variant = v; });
    put('variant', v); use(function () {}); paintUsage(); paintFv();
  });
  $('wl-view').addEventListener('change', function (ev) { var v = ev.target.value === 'grid' ? 'grid' : 'list'; swap(function () { root.dataset.view = v; }); put('view', v); paintFv(); });
  $('wl-aux').addEventListener('change', function (ev) { setAux(ev.target.value); syncAux(); });
  $('wl-hidetr').addEventListener('change', function (ev) { setFlag('hidetr', ev.target.checked); });
  $('wl-bigt').addEventListener('change', function (ev) { setFlag('big', ev.target.checked); });
  $('wl-keyon').addEventListener('change', function (ev) { put('keys', ev.target.checked ? null : 'off'); });
  $('wl-usage').addEventListener('toggle', paintUsage);
  document.addEventListener('click', function (ev) { if (ev.target.closest('[data-set-lang]')) setTimeout(syncAux, 0); });

  /* ---------- 开场 ---------- */
  var v0 = get('variant', 'senses'), hv = /[#&]v=(\w+)/.exec(location.hash); if (hv) v0 = hv[1];
  if (VARIANTS.indexOf(v0) < 0) v0 = 'senses';
  root.dataset.variant = v0; root.querySelector('[name=wl-variant][value=' + v0 + ']').checked = true;
  var vw = get('view', 'list') === 'grid' ? 'grid' : 'list'; root.dataset.view = vw; root.querySelector('[name=wl-view][value=' + vw + ']').checked = true;
  if (get('hidetr', '')) { root.setAttribute('data-hidetr', ''); $('wl-hidetr').checked = true; }
  if (get('big', '')) { root.setAttribute('data-big', ''); $('wl-bigt').checked = true; }
  $('wl-keyon').checked = keysOn();
  if (get('aux', '') && get('aux', '') !== 'en') setAux(get('aux', ''), true);
  syncAux();
  if (window.matchMedia && matchMedia('(min-width: 900px)').matches) { $('wl-fv').hidden = false; $('wl-fvb').setAttribute('aria-expanded', 'true'); }   // 宽屏直接摊开；手机收进按钮
  paintList(); sortList(); paintUsage();
  var hw = /[#&]w=([a-z-]+)/.exec(location.hash), hm = /[#&]m=(\w+)/.exec(location.hash);
  if (hw && BY[hw[1]]) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} open(hw[1], root.querySelector('[data-open="' + hw[1] + '"]'), false, hm && /^(learn|meaning|listen|spell|use)$/.test(hm[1]) ? hm[1] : null); }
  window.EH_WLAB = { open: open, setTab: setTab, review: review, status: status, answer: answer, usage: usage, step1: step1, setAux: setAux };
})();
