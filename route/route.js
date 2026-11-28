/* English Hub · 学习路线（首页样板、水平入口、周计划）。规格：design/site-arch-b1c1-2026-11-26.md；评审修订 eh-site-arch-r1-1126。
   纯本地：进度进 EH.state.route（随全站备份导出），不发任何网络请求（文章朗读的音频只在读者点「听」以后才取）。
   route = { station:'s1|s2|s3', as:'s1|s2|s3'（按哪一站的要求做借来的周）, cur:<当前周>, placed:{date,dims,rec,detail}, week:{id,start},
             done:{<周>:{<任务>:日期}}, drafts:{<周>:[{d,text,m}]}, samples:[{d,wid,station,self,text,m}], time:'20|40|60' } */
(function () {
  'use strict';
  var EH = window.EH, R = window.EH_ROUTE, W = window.EH_WRITE, T = EH.T, esc = EH.esc;
  var root = document.getElementById('rt'); if (!root || !R) return;
  var page = root.dataset.page;
  var ST = EH.state.route || (EH.state.route = { done: {}, drafts: {} });
  ST.done = ST.done || {}; ST.drafts = ST.drafts || {}; ST.samples = ST.samples || [];
  function $(id) { return document.getElementById(id); }
  function $$(sel, r) { return Array.prototype.slice.call((r || root).querySelectorAll(sel)); }
  function save() { EH.save(); }
  function lang() { return document.body.dataset.lang || 'both'; }
  function station(id) { for (var i = 0; i < R.stations.length; i++) if (R.stations[i].id === id) return R.stations[i]; return null; }
  function say(html) { var l = $('rt-live'); if (l) { l.innerHTML = ''; setTimeout(function () { l.innerHTML = html; }, 30); } }
  function one(en, zh) { return '<span class="rt-one">' + T(en, zh) + '</span>'; }
  function cn(n) { return '一二三'.charAt(n - 1); }
  /* 这一站有主题周就用它的；还没写的站（站一、站三）先借站二的 */
  function weeksOf(sid) { var s = station(sid); return s && s.weeks.length ? s.weeks : station('s2').weeks; }
  /* eh-route-chunks-1127：是否「借周」要按这一周本身的站判，不能按某站有没有任何自己的周判——
     站三有了自己的 8 个周之后，全站级的判断会把「站三学生打开一篇站二的周」误判成不借（本周原本就是站二的，谁打开都借） */
  function curWeek() {
    var ws = weeksOf(ST.station || 's2');
    if (ST.week && R.weeks[ST.week.id] && ws.indexOf(ST.week.id) >= 0) return ST.week.id;
    for (var i = 0; i < ws.length; i++) if (!weekDone(ws[i])) return ws[i];
    return ws[0];
  }
  function coreOf(wid) { return R.weeks[wid].tasks.filter(function (t) { return t.core; }); }
  function weekDone(wid) { var d = ST.done[wid] || {}; return coreOf(wid).every(function (t) { return d[t.id]; }); }
  function dow() { return (new Date().getDay() + 6) % 7; }                        // 周一＝0
  function daysBetween(a, b) { var p = a.split('-'), q = b.split('-'); return Math.round((new Date(+q[0], +q[1] - 1, +q[2]) - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5); }
  function adaptOf(t, sid) { var a = R.adapt[t.kind]; return a && a[sid] ? a[sid] : null; }
  function setCur(wid) { if (ST.cur !== wid) { ST.cur = wid; save(); } }

  /* ---------- 首页 ---------- */
  function home() {
    var body = $('rt-today-body'), s = station(ST.station);
    $$('.rt-st').forEach(function (li) {
      var on = s && li.dataset.station === s.id;
      li.classList.toggle('on', !!on); li.querySelector('.rt-here').hidden = !on;
      if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (s) {
      var wid = curWeek(), w = R.weeks[wid], d = dow(), done = ST.done[wid] || {}, time = ST.time || '40', bor = w.station !== s.id;
      setCur(wid);
      var day = w.tasks.filter(function (t) { return t.day === d && (time !== '20' || t.core); });
      if (!day.length) day = coreOf(wid).filter(function (t) { return !done[t.id]; }).slice(0, 2);
      $('rt-today-h').innerHTML = T('Today', '今天');
      body.innerHTML =
        '<p class="rt-where"><span class="rt-k">' + one('Station ' + s.n, '站' + cn(s.n)) + '</span> <b>' + T(esc(s.name.en), esc(s.name.zh)) + '</b> <span class="rt-lv">' + esc(s.lv[0]) + ' → ' + esc(s.lv[1]) + '</span> · ' +
        T('this week', '本周') + ' <b>' + T(esc(w.en), esc(w.zh)) + '</b></p>' +
        (bor ? '<p class="rt-note" role="note"><b class="rt-one">' + T('Note:', '注意：') + '</b> ' + T('topic weeks for this station are still being written, so this is a station-two week. Each task says how to do it at your station.', '这一站的主题周还在写，先借站二的周；每一项都写了按本站怎么做。') + '</p>' : '') +
        '<ul class="rt-tasks rt-now">' + day.map(function (t) {
          var a = bor ? adaptOf(t, s.id) : null;
          return '<li class="rt-task' + (done[t.id] ? ' done' : '') + '"><a class="rt-tl" href="' + esc(t.href.replace(/^#/, 'w/' + wid + '.html#')) + '"><span class="rt-tt"><span aria-hidden="true">' + t.emo + '</span> ' + T(esc(t.en), esc(t.zh)) + '</span>' +
            (a ? '<span class="rt-ad on"><span class="rt-k rt-one">' + T('At station ' + s.n, '站' + cn(s.n) + '的做法') + '</span> ' + T(esc(a.en), esc(a.zh)) + '</span>' : '') +
            '<span class="rt-tm"><span class="rt-min">' + t.min + ' min</span>' + (done[t.id] ? ' <span class="rt-corem">✓ ' + one('done', '做完了') + '</span>' : '') + '</span></a></li>';
        }).join('') + '</ul>' +
        '<p class="rt-cta"><a class="rt-btn primary" href="w/' + wid + '.html">📅 ' + one('Open the week plan', '打开本周计划') + '</a> <a class="rt-btn" href="placement.html">' + one('Check my starting point again', '重新找起点') + '</a></p>';
    }
    // 证据：只数本机真做过的；本周新增与零的时候从哪开始
    var wl = (EH.state.wl && EH.state.wl.s) || {}, known = 0, k, today = EH.today();
    for (k in wl) if (wl[k] && wl[k].box >= 2) known++;
    var nd = 0, nd7 = 0, first = null, last = null;
    for (k in ST.drafts) (ST.drafts[k] || []).forEach(function (x) { nd++; if (daysBetween(x.d, today) < 7) nd7++; if (x.m && x.m.range != null) { if (!first || x.d < first.d) first = x; if (!last || x.d >= last.d) last = x; } });
    var fin = Object.keys(ST.done).filter(function (wid) { return R.weeks[wid] && weekDone(wid); });
    var fin7 = fin.filter(function (wid) { var d = ST.done[wid], m = null; for (var t in d) if (!m || d[t] > m) m = d[t]; return m && daysBetween(m, today) < 7; }).length;
    var ev = { senses: [known, null], drafts: [nd, nd7], range: [first && last && first !== last ? first.m.structTypes + ' → ' + last.m.structTypes : 0, null], weeks: [fin.length, fin7] };
    $$('#rt-ev li').forEach(function (li) {
      var v = ev[li.dataset.ev], n = v[0];
      li.querySelector('[data-n]').textContent = n ? n : '0';
      li.querySelector('[data-d]').innerHTML = n && v[1] != null ? T('this week +' + v[1], '本周 +' + v[1]) : '';
      li.querySelector('[data-z]').hidden = !!n;
    });
  }
  function pick(sid, quiet) {
    ST.station = sid; ST.week = null; save();
    if (page === 'home') { home(); if (!quiet) { var h = $('rt-today-h'); h.tabIndex = -1; $('rt-today').scrollIntoView({ block: 'start' }); h.focus(); say(T('Starting station set. Today’s tasks are at the top.', '起点定好了，今天的任务在页面顶部。')); } }
  }

  /* ---------- 水平入口（自适应：答对变难、答错变易；词义 + 句式合计 ≤12 题） ---------- */
  var P = window.EH_PLACE, pl;
  function plReset() { pl = { step: 'sense', i: null, n: 0, used: {}, level: { sense: 2, gram: 'B2' }, ans: { sense: [], gram: [] }, write: null, skipped: {} }; }
  function nextItem(part) {
    var items = P[part], want = pl.level[part], order;
    if (part === 'sense') order = [want, want === 3 ? 2 : want + 1, want === 1 ? 2 : want - 1, 1, 2, 3];
    else order = want === 'C1' ? ['C1', 'B2'] : ['B2', 'C1'];
    for (var o = 0; o < order.length; o++)
      for (var i = 0; i < items.length; i++) if (!pl.used[part + i] && (part === 'sense' ? items[i].tier : items[i].lv) === order[o]) return i;
    return null;
  }
  function steps(cur) {
    var seen = true;
    $$('#rt-steps li', document).forEach(function (li) {
      var on = li.dataset.step === cur;
      if (on) seen = false;
      if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      li.classList.toggle('past', seen && !on);
      li.querySelector('.rt-st-s').innerHTML = on ? ' ' + one('(now)', '（当前）') : seen ? ' ' + one('(done)', '（已完成）') : '';
    });
  }
  function plRender(focus) {
    var box = $('rt-pl'); steps(pl.step);
    if (pl.step === 'sense' || pl.step === 'gram') {
      if (pl.i == null) pl.i = nextItem(pl.step);
      var q = P[pl.step][pl.i], n = P.ask[pl.step], isS = pl.step === 'sense';
      var ask = isS ? T('Which meaning does <b lang="en">' + esc(q.w) + '</b> have in this sentence?', '这句里的 <b lang="en">' + esc(q.w) + '</b> 是哪个意思？') : T('Which one fits the gap?', '空里放哪一个对？');
      var sent = isS ? q.h : esc(q.q).replace(/_{3,}/, '<span class="rt-gap">_____</span>');
      var opts = q.o.map(function (o, j) {
        // 选项只出一种释义：英文模式英文，对照与中文模式中文（手机上四个选项一屏看全）
        var lab = isS ? '<span class="rt-oc rt-one">' + T(esc(o.d.en), esc(o.d.zh)) + '</span> <span class="rt-op" lang="en">' + esc(o.p) + '.</span>' : '<span class="rt-oc" lang="en">' + esc(o) + '</span>';
        return '<label class="rt-opt"><input type="radio" name="rt-o" value="' + j + '"><span class="rt-on" aria-hidden="true">' + (j + 1) + '</span><span class="rt-ol">' + lab + '<span class="rt-mark"></span></span></label>';
      }).join('');
      box.innerHTML = '<section class="rt-q" aria-labelledby="rt-q-h"><h2 id="rt-q-h" tabindex="-1">' + one(isS ? 'Part 1: meanings' : 'Part 2: sentences', isS ? '第一段：词义' : '第二段：句式') + ' <span class="rt-qn">' + (pl.n + 1) + ' / ' + n + '</span></h2>' +
        '<p class="rt-sent en" lang="en" id="rt-sent">' + sent + '</p>' +
        '<fieldset class="rt-of" id="rt-of" aria-describedby="rt-sent"><legend class="rt-ask">' + ask + '</legend><div class="rt-opts">' + opts + '</div></fieldset><div class="rt-fb" id="rt-fb"></div>' +
        '<p class="rt-cta rt-skipline"><button type="button" class="rt-btn rt-txt" id="rt-skip">' + one('Skip the rest of this part', '这一段剩下的跳过') + '</button></p></section>';
      say(T('Question ' + (pl.n + 1) + ' of ' + n + ', ' + q.o.length + ' choices.', '第 ' + (pl.n + 1) + ' 题，共 ' + n + ' 题，' + q.o.length + ' 个选项。'));
    } else if (pl.step === 'write') {
      box.innerHTML = '<section class="rt-q" aria-labelledby="rt-q-h"><h2 id="rt-q-h" tabindex="-1">' + one('Part 3 (optional): a short piece of writing', '第三段（可选）：短写') + '</h2>' +
        '<p class="rt-note" role="note"><b class="rt-one">' + T('For reference only.', '仅供参考，判不稳。') + '</b> ' + T('This part does not change your starting station: the measure has not been calibrated on real learners yet.', '这一段不改变你的起点：这把尺子还没用真实学习者的稿子标定过。') + '</p>' +
        '<p class="rt-prompt" id="rt-wprompt">' + T(esc(P.write.en), esc(P.write.zh)) + '</p>' +
        '<label class="rt-wl" for="rt-text">' + one('Your text', '你的文字') + ' <span id="rt-wc" class="muted"></span></label>' +
        '<textarea id="rt-text" rows="8" lang="en" spellcheck="false" autocapitalize="sentences" aria-describedby="rt-wprompt"></textarea><span class="rt-sr" id="rt-wc-live" role="status" aria-live="polite"></span>' +
        '<p class="muted">' + T('Write as you normally would. Do not look anything up: the point is to see what comes out on its own.', '照平时的样子写，不要查词：要看的是你自己写得出什么。') + '</p>' +
        '<p class="rt-cta"><button type="button" class="rt-btn primary" id="rt-wdone">' + one('See my result', '看结果') + '</button> <button type="button" class="rt-btn rt-txt" id="rt-skip">' + one('No writing: show my result', '不写了，直接看结果') + '</button></p></section>';
      wc(P.write.min, P.write.max);
    } else plResult();
    if (focus) { var h = $('rt-q-h'); if (h) h.focus(); }
  }
  /* 词数：可见的数随打随变；读屏只在「还差／够了／超了」换档时播报一次 */
  function wc(min, max) {
    var t = $('rt-text'), c = $('rt-wc'), live = $('rt-wc-live'); if (!t || !c) return;
    var n = (t.value.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length, st = !n ? '' : n < min ? 'short' : n > max ? 'long' : 'ok';
    var msg = !n ? '' : st === 'short' ? T(n + ' words, ' + (min - n) + ' to go', n + ' 词，还差 ' + (min - n) + ' 词') : st === 'long' ? T(n + ' words, ' + (n - max) + ' over the ' + min + '–' + max + ' target', n + ' 词，超出 ' + min + '–' + max + ' 词的目标 ' + (n - max) + ' 词') : T(n + ' words: within the ' + min + '–' + max + ' target', n + ' 词：已在 ' + min + '–' + max + ' 词的目标里');
    c.innerHTML = msg; c.dataset.st = st;
    if (live && wc.last !== st) { wc.last = st; live.innerHTML = st ? msg : ''; }
  }
  var lastArrow = 0;
  function plAnswer(j) {
    var q = P[pl.step][pl.i], isS = pl.step === 'sense', right = isS ? q.o.map(function (o) { return o.id; }).indexOf(q.a) : q.a, ok = j === right;
    pl.ans[pl.step].push({ i: pl.i, lv: isS ? q.tier : q.lv, ok: ok ? 1 : 0 });
    pl.used[pl.step + pl.i] = 1; pl.n++;
    if (isS) pl.level.sense = ok ? Math.min(3, q.tier + 1) : Math.max(1, q.tier - 1); else pl.level.gram = ok ? 'C1' : 'B2';
    $$('.rt-opt input', document).forEach(function (inp, k) {
      inp.disabled = true; var lab = inp.closest('.rt-opt'), m = lab.querySelector('.rt-mark');
      if (k === right) { lab.classList.add('right'); m.innerHTML = ' ✓ ' + one('right answer', '正确答案'); }
      else if (k === j) { lab.classList.add('wrong'); m.innerHTML = ' ✗ ' + one('your choice', '你选的'); }
    });
    var last = pl.n >= P.ask[pl.step] || nextItem(pl.step) == null;
    $('rt-fb').innerHTML = '<p class="rt-res ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ ' + T('Right.', '对。') : '✗ ' + T('Not this one. The right answer is marked.', '不是这个，正确答案已标出。')) + '</p>' +
      (isS ? '<p class="zh rt-zh" lang="zh-Hans">' + esc(q.zh) + '</p>' : '<p class="rt-why">' + T(esc(q.why.en).replace(/_([^_]+)_/g, '<i>$1</i>'), esc(q.why.zh)) + '</p>') +
      '<p class="rt-cta"><button type="button" class="rt-btn primary" id="rt-next">' + (last ? one('Next part', '下一段') : one('Next', '下一题')) + ' ›</button></p>';
    say(ok ? T('Right.', '对。') : T('Not this one.', '不是这个。'));
    $('rt-next').focus();
  }
  function plNext(skip) {
    if (skip) pl.skipped[pl.step] = 1;
    if (skip || pl.n >= (P.ask[pl.step] || 0) || nextItem(pl.step) == null) { pl.step = pl.step === 'sense' ? 'gram' : pl.step === 'gram' ? 'write' : 'result'; pl.n = 0; pl.i = null; }
    else pl.i = null;
    plRender(true);
  }
  /* 分站口径（设计值，没有学习者数据；页面「结果怎么算的」里写明）。返回 1/2/3 或 null（做得太少，判不了）。
     词义：每题记「出题档 ±0.5」（对＋、错－），平均后四舍五入到 1–3；做不到 4 题不判。
     句式：C1 做了 ≥2 题且对 ≥75%、B2 没错到八成以下 → 站三；B2 ≥60%（或 C1 ≥50%）→ 站二；否则站一；做不到 3 题不判。
     起点只由这两项定：两项都有时取「高的那项，但不高过低的那项一站以上」；短写只作参考，不进起点。 */
  function placeScore() {
    var d = {}, det = {}, a = pl.ans.sense, t = [[0, 0], [0, 0], [0, 0]];
    a.forEach(function (x) { t[x.lv - 1][1]++; t[x.lv - 1][0] += x.ok; });
    det.sense = t;
    var ab = a.reduce(function (s, x) { return s + x.lv + (x.ok ? 0.5 : -0.5); }, 0) / (a.length || 1);
    d.sense = a.length < 4 ? null : Math.max(1, Math.min(3, Math.round(ab)));
    var b2 = [0, 0], c1 = [0, 0], acc = function (x) { return x[1] ? x[0] / x[1] : 0; };
    pl.ans.gram.forEach(function (x) { var y = x.lv === 'C1' ? c1 : b2; y[1]++; y[0] += x.ok; });
    det.gram = [b2, c1];
    d.gram = b2[1] + c1[1] < 3 ? null : (c1[1] >= 2 && acc(c1) >= 0.75 && (!b2[1] || acc(b2) >= 0.8)) ? 3 : (acc(b2) >= 0.6 || (c1[1] && acc(c1) >= 0.5)) ? 2 : 1;
    d.write = pl.write && pl.write.range != null ? W.band(pl.write.range) : null;
    det.write = pl.write;
    var v = [d.sense, d.gram].filter(function (x) { return x != null; }).sort();
    var rec = !v.length ? null : v.length === 1 ? v[0] : Math.min(v[1], v[0] + 1);
    return { dims: d, det: det, rec: rec };
  }
  function plResult() {
    var r = placeScore(), box = $('rt-pl'), nm = function (n) { var s = R.stations[n - 1]; return T('Station ' + n + ': ' + esc(s.name.en), '站' + cn(n) + '：' + esc(s.name.zh)) + ' <span class="rt-lv">' + s.lv[0] + ' → ' + s.lv[1] + '</span>'; };
    var none = '<span class="muted">' + T('Not enough done to say.', '做得太少，判不了。') + '</span>', t = r.det.sense, g = r.det.gram, w = r.det.write;
    var rows = [
      ['🔤', T('Meanings', '词义深度'), r.dims.sense, T('First meaning ' + t[0][0] + '/' + t[0][1] + ' · second meaning ' + t[1][0] + '/' + t[1][1] + ' · less common ' + t[2][0] + '/' + t[2][1], '第一个意思 ' + t[0][0] + '/' + t[0][1] + ' · 第二个意思 ' + t[1][0] + '/' + t[1][1] + ' · 不太常用的 ' + t[2][0] + '/' + t[2][1]), '../tools/wordlab.html', T('Word study', '单词学习')],
      ['🧩', T('Sentence patterns', '句式'), r.dims.gram, T('B2 questions ' + g[0][0] + '/' + g[0][1] + ' · C1 questions ' + g[1][0] + '/' + g[1][1], 'B2 题 ' + g[0][0] + '/' + g[0][1] + ' · C1 题 ' + g[1][0] + '/' + g[1][1]), '../index.html#map', T('The map of patterns', '句式地图')]];
    var weak = null; rows.forEach(function (x) { if (x[2] != null && (weak == null || x[2] < weak[2])) weak = x; });
    var html = '<section class="rt-q rt-result" aria-labelledby="rt-q-h"><h2 id="rt-q-h" tabindex="-1">' + one('Your starting point', '你的起点') + '</h2>';
    if (r.rec) {
      html += '<p class="rt-rec">📍 ' + nm(r.rec) + '</p><p>' + T(esc(R.stations[r.rec - 1].write.en) + ' is the writing step at this station.', '这一站的写作台阶：' + esc(R.stations[r.rec - 1].write.zh) + '。') + '</p>';
    } else {
      html += '<div class="rt-empty"><p class="rt-rec">' + T('No suggestion yet', '还没有起点建议') + '</p><p>' + T('You skipped too much for a suggestion. Start again, or choose a station yourself.', '跳过的太多，给不出建议。可以重新开始，也可以自己选一站。') + '</p>' +
        '<p class="rt-cta"><button type="button" class="rt-btn primary" id="rt-again">' + one('Start again', '重新开始') + '</button> <a class="rt-btn" href="index.html#route">' + one('Choose a station myself', '直接选站') + '</a></p></div>';
    }
    html += '<ul class="rt-dims">' + rows.map(function (x) {
      return '<li><span class="rt-di" aria-hidden="true">' + x[0] + '</span><div><b>' + x[1] + '</b> ' + (x[2] != null ? '<span class="rt-dv">' + nm(x[2]) + '</span>' : none) + '<span class="rt-dd">' + x[3] + '</span></div></li>';
    }).join('') +
      '<li class="rt-dref"><span class="rt-di" aria-hidden="true">✍️</span><div><b>' + T('Writing', '短写') + '</b> <span class="rt-k rt-one">' + T('For reference only: not used for your station', '仅供参考，判不稳，不计入起点') + '</span>' +
      '<span class="rt-dd">' + (w ? (w.range == null ? T('Under 25 words: too short to describe.', '不到 25 词：太短，描述不了。') : T(w.words + ' words · ' + w.structTypes + ' sentence shapes · ' + w.connGroups + ' kinds of linking · ' + w.mean + ' words a sentence', w.words + ' 词 · 句子形状 ' + w.structTypes + ' 种 · 衔接 ' + w.connGroups + ' 类 · 平均每句 ' + w.mean + ' 词')) : T('Skipped.', '跳过了。')) + '</span>' +
      (r.dims.write ? '<span class="rt-dd">' + T('The shapes look like station ' + r.dims.write + ' writing, which the check cannot judge reliably.', '形状像站' + cn(r.dims.write) + '的写作；这把尺子判不稳。') + '</span>' : '') + '</div></li></ul>';
    if (weak && r.rec && weak[2] < r.rec) html += '<p class="rt-note" role="note"><b class="rt-one">' + T('Note:', '注意：') + '</b> ' + T('one of the two is a station behind the other. Add ten minutes a week here: ', '两项里有一项比另一项低一站。每周在这里多花十分钟：') + '<a href="' + weak[4] + '">' + weak[5] + '</a></p>';
    html += '<fieldset class="rt-time" id="rt-choose"><legend class="rt-one">' + T('Start at', '从哪一站开始') + '</legend>' + R.stations.map(function (s) {
      return '<label class="rt-seg"><input type="radio" name="rt-st" value="' + s.id + '"' + (r.rec === s.n ? ' checked' : '') + '><span class="rt-one">' + T(s.n + ' ' + esc(s.name.en), '站' + cn(s.n) + ' ' + esc(s.name.zh)) + '</span></label>';
    }).join('') + '</fieldset><p class="rt-cta"><button type="button" class="rt-btn primary" id="rt-go">' + one('Start my first week', '开始第一周') + ' ›</button>' + (r.rec ? ' <button type="button" class="rt-btn" id="rt-again">' + one('Do it again', '重做一遍') + '</button>' : '') + '</p>' +
      '<p class="muted">' + T('A suggestion for where to start, not a test score. You can change station at any time on the route page.', '这是起点建议，不是考试成绩。随时可以在路线页换一站。') + '</p></section>';
    box.innerHTML = html;
    ST.placed = { date: EH.today(), dims: r.dims, rec: r.rec, detail: { sense: t, gram: g, write: w && { words: w.words, range: w.range, structTypes: w.structTypes, connGroups: w.connGroups } } };
    if (r.rec && !ST.station) ST.station = 's' + r.rec;
    save(); say(r.rec ? T('Your result is ready.', '结果出来了。') : T('No suggestion yet. You can start again or choose a station.', '还没有起点建议：可以重新开始，或者自己选一站。'));
  }
  function placement() {
    if (!P) return;
    plReset(); plRender(false);
    var box = $('rt-pl');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'rt-next') return plNext(false);
      if (b.id === 'rt-skip') { if (pl.step === 'write') pl.write = null; return plNext(true); }
      if (b.id === 'rt-wdone') { var A = W.analyze($('rt-text').value); pl.write = A.m; pl.step = 'result'; return plRender(true); }
      if (b.id === 'rt-again') { plReset(); return plRender(true); }
      if (b.id === 'rt-go') { var c = document.querySelector('input[name=rt-st]:checked'); if (!c) return; ST.station = c.value; ST.week = null; save(); location.href = 'w/' + curWeek() + '.html'; }
    });
    // 原生单选：点一下（鼠标、触屏）即作答；方向键只是挪选择，按 Enter 或空格才作答（不会挪一下就交卷）
    box.addEventListener('keydown', function (e) {
      if (e.target.name !== 'rt-o') return;
      if (/^Arrow/.test(e.key)) lastArrow = Date.now();
      else if ((e.key === 'Enter' || e.key === ' ') && !e.target.disabled) { e.preventDefault(); var c = box.querySelector('input[name=rt-o]:checked') || e.target; plAnswer(+c.value); }
    });
    box.addEventListener('change', function (e) { if (e.target.name === 'rt-o' && Date.now() - lastArrow > 150) plAnswer(+e.target.value); });
    box.addEventListener('input', function (e) { if (e.target.id === 'rt-text') wc(P.write.min, P.write.max); });
    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      var n = +e.key; if (n >= 1 && n <= 4) { var b = document.querySelectorAll('.rt-opt input:not(:disabled)')[n - 1]; if (b) { e.preventDefault(); b.checked = true; plAnswer(+b.value); } }
    });
  }

  /* ---------- 周计划 ---------- */
  var PRIORITY = ['write', 'pattern', 'words', 'read', 'speak', 'listen', 'lead', 'shadow', 'new', 'review'];   // 「补做最重要的一件」按这个序挑
  function week() {
    var wid = root.dataset.week, w = R.weeks[wid], done = ST.done[wid] || (ST.done[wid] = {});
    if (ST.station && weeksOf(ST.station).indexOf(wid) >= 0) setCur(wid);
    function asSt() { return ST.as || (ST.station && ST.station !== w.station ? ST.station : w.station); }
    function wlen() { var s = station(asSt()); return s && s.wlen && s.wlen.length && asSt() !== w.station ? s.wlen : [w.write.min, w.write.max]; }
    function behind() {
      var box = $('rt-behind');
      if (!ST.week || ST.week.id !== wid || !ST.week.start) { box.hidden = true; return; }
      var since = daysBetween(ST.week.start, EH.today()), td = dow();
      var from = since >= td ? 0 : td - since, to = since >= 7 ? 6 : td - 1, late = [];
      for (var d = from; d <= to; d++) if (w.tasks.some(function (t) { return t.day === d && t.core && !done[t.id]; })) late.push(d);
      if (!late.length) { box.hidden = true; return; }
      box.hidden = false; box.setAttribute('role', 'region'); box.setAttribute('aria-labelledby', 'rt-behind-h');
      box.innerHTML = '<h2 id="rt-behind-h" class="rt-one">' + T(late.length + ' day' + (late.length > 1 ? 's' : '') + ' behind', '落后 ' + late.length + ' 天') + '</h2>' +
        '<p>' + T('No need to catch up on everything: missed tasks do not pile up, and progress counts only the core tasks you finish. Pick one:', '不用全补：漏掉的不会堆成清单，进度只按做完的核心任务算。选一个：') + '</p>' +
        '<p class="rt-cta"><button type="button" class="rt-btn primary" data-act="today">' + one('Just today’s core task', '只做今天核心') + '</button><button type="button" class="rt-btn" data-act="one">' + one('Catch up on the most important one', '补做最重要的一件') + '</button></p>';
    }
    function paint() {
      var time = ST.time || '40', all = 0, got = 0, core = 0, cgot = 0, td = dow(), as = asSt();
      root.dataset.as = as;
      $('rt-as-note').hidden = as === w.station;
      $$('input[name=rt-as]').forEach(function (r) { r.checked = r.value === as; });
      var L = wlen(); $('rt-len').textContent = L[0] + '–' + L[1];
      $('rt-len-sr').innerHTML = T('Length: ' + L[0] + ' to ' + L[1] + ' words.', '长度：' + L[0] + ' 到 ' + L[1] + ' 词。');
      $$('.rt-day').forEach(function (day) {
        var opt = 0, mins = 0, isToday = +day.dataset.day === td;
        day.classList.toggle('today', isToday);
        var tag = day.querySelector('.rt-dtoday') || day.querySelector('h3').insertBefore(Object.assign(document.createElement('span'), { className: 'rt-dtoday' }), day.querySelector('h3').children[1] || null);
        tag.innerHTML = isToday ? one('Today', '今天') : '';
        $$('.rt-task', day).forEach(function (li) {
          var isCore = li.classList.contains('rt-core'), show = isCore || time === '60' || (time === '40' && opt++ < 1);
          li.hidden = !show; var id = li.dataset.task, on = !!done[id];
          li.classList.toggle('done', on); li.querySelector('input').checked = on;
          if (show) { all++; got += on ? 1 : 0; mins += +li.dataset.min; }
          if (isCore) { core++; cgot += on ? 1 : 0; }
        });
        var m = day.querySelector('.rt-dm') || day.querySelector('h3').appendChild(Object.assign(document.createElement('span'), { className: 'rt-dm' }));
        m.textContent = mins + ' min';
      });
      $('rt-prog').innerHTML = '★ ' + T('Core ' + cgot + ' / ' + core, '核心 ' + cgot + ' / ' + core) + ' · ' + T('all ' + got + ' / ' + all, '全部 ' + got + ' / ' + all);
      $('rt-time-note').innerHTML = time === '20' ? T('20 minutes: only the core task of each day is shown.', '20 分钟档：每天只显示核心任务。') : time === '40' ? T('40 minutes: the core task and one more.', '40 分钟档：核心任务再加一项。') : T('60 minutes: everything.', '60 分钟档：全部任务。');
      var r = root.querySelector('input[name=rt-time][value="' + time + '"]'); if (r) r.checked = true;
      behind();
      wc(L[0], L[1]);
    }
    function startWeek() { if (!ST.week || ST.week.id !== wid) ST.week = { id: wid, start: EH.today() }; if (!ST.station) ST.station = root.dataset.station; setCur(wid); }
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.done) { if (t.checked) done[t.dataset.done] = EH.today(); else delete done[t.dataset.done]; startWeek(); save(); paint(); }
      else if (t.name === 'rt-time') { ST.time = t.value; save(); paint(); }
      else if (t.name === 'rt-as') { ST.as = t.value; save(); paint(); say(t.value === w.station ? T('Showing this week as written.', '按这一周原本的要求显示。') : T('Each task now says how to do it at station ' + t.value.slice(1) + '.', '每一项都换成了站' + cn(+t.value.slice(1)) + '的做法。')); }
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'today') {
        ST.time = '20'; save(); paint();
        var day = root.querySelector('.rt-day[data-day="' + dow() + '"]') || root.querySelector('.rt-day'), h = day.querySelector('h3');
        h.tabIndex = -1; day.scrollIntoView({ block: 'start' }); h.focus(); say(T('Only today’s core task is shown.', '现在只显示今天的核心任务。'));
      } else {
        var cand = w.tasks.filter(function (t) { return t.core && !done[t.id] && t.day < dow(); });
        if (!cand.length) cand = w.tasks.filter(function (t) { return t.core && !done[t.id]; });
        cand.sort(function (a, b) { return PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || a.day - b.day; });
        if (!cand.length) return;
        var li = root.querySelector('.rt-task[data-task="' + cand[0].id + '"]');
        $$('.rt-task.pick').forEach(function (x) { x.classList.remove('pick'); });
        li.hidden = false; li.classList.add('pick'); li.scrollIntoView({ block: 'center' }); li.querySelector('a').focus();
        say(T('The one to catch up on is marked.', '要补的那一件已标出。'));
      }
    });
    $('rt-other-go').addEventListener('click', function () { location.href = $('rt-other').value; });
    paint();
    $$('a[data-q]').forEach(function (a) { a.href = a.getAttribute('href') + a.dataset.q; });
    function names() { var l = lang(); Array.prototype.forEach.call($('rt-other').options, function (o) { o.textContent = l === 'en' ? o.dataset.en : l === 'zh' ? o.dataset.zh : o.dataset.en + ' · ' + o.dataset.zh; }); }
    names(); document.addEventListener('eh-lang', names);
    // 写作台
    var ta = $('rt-text'), cfg = function () { var L = wlen(), s = station(asSt()); return { targets: { chunks: w.chunks, patterns: w.pats }, ladders: R.ladders, min: L[0], max: L[1], needChunks: 3, task: w.write.task, level: s.lv.join(' to ') }; };
    var KEY = 'english-hub-route-draft:' + wid;
    try { ta.value = localStorage.getItem(KEY) || ''; } catch (e) {}
    ta.addEventListener('input', function () { var L = wlen(); wc(L[0], L[1]); try { localStorage.setItem(KEY, ta.value); } catch (e) {} });
    drafts(); samples();
    function report() {
      var C = cfg(), A = W.analyze(ta.value, C), a = W.advise(A, C), m = A.m, box = $('rt-report');
      if (m.words < 25) { box.innerHTML = '<p class="rt-res no" id="rt-rep-h" tabindex="-1">' + T('Write at least 25 words first: there is too little here to describe.', '先写到 25 词以上：现在太短，没法描述。') + '</p>'; $('rt-rep-h').focus(); return null; }
      var li = function (x) { return '<li>' + T(esc(x.en), esc(x.zh)) + '</li>'; };
      box.innerHTML = '<h3>' + T('What the shape check found', '形状体检的结果') + ' <span class="rt-k rt-one">' + T('not a mark', '不是打分') + '</span></h3>' +
        (a.next ? '<div class="rt-nextfix"><h4 id="rt-rep-h" tabindex="-1">🎯 ' + T('For the next draft, change just this', '下一稿只改这一处') + '</h4><p>' + T(esc(a.next.en), esc(a.next.zh)) + '</p></div>' : '<div class="rt-nextfix"><h4 id="rt-rep-h" tabindex="-1">🎯 ' + T('Nothing the check can see needs changing', '体检看得见的地方没有要改的') + '</h4><p>' + T('Now compare with the three versions below, or ask a reader.', '接下来对照下面三种写法，或请一位读者看看。') + '</p></div>') +
        '<p class="rt-nums">' + T(m.words + ' words · ' + m.sentences + ' sentences · ' + m.mean + ' words a sentence · ' + m.structTypes + ' sentence shapes · ' + m.connGroups + ' kinds of linking', m.words + ' 词 · ' + m.sentences + ' 句 · 平均每句 ' + m.mean + ' 词 · 句子形状 ' + m.structTypes + ' 种 · 衔接 ' + m.connGroups + ' 类') + '</p>' +
        (a.good.length ? '<h4>✓ ' + T('In the text already', '已经做到的') + '</h4><ul class="rt-good">' + a.good.map(li).join('') + '</ul>' : '') +
        (a.fix.length > 1 ? '<details class="rt-d"><summary class="rt-one">' + T('Other things to look at later (' + (a.fix.length - 1) + ')', '其余可以以后再看的（' + (a.fix.length - 1) + ' 处）') + '</summary><ul class="rt-fix">' + a.fix.slice(1).map(li).join('') + '</ul></details>' : '');
      // 焦点落到结论上；读屏播报结论本身（不念折叠里的其余几处）
      $('rt-rep-h').focus();
      say(T('Shape check done. ', '形状体检完成。') + (a.next ? T('For the next draft: ', '下一稿只改：') + T(esc(a.next.en), esc(a.next.zh)) : T('Nothing the check can see needs changing.', '体检看得见的地方没有要改的。')));
      return A;
    }
    function drafts() {
      var D = ST.drafts[wid] || [], box = $('rt-drafts');
      if (!D.length) { box.innerHTML = ''; return; }
      // 每稿一张卡，字段带名字（不靠列位置猜）；两列并排，最早一稿与最近一稿相邻对照；「打开」在每张卡上
      var f = function (en, zh, v) { return '<div><dt class="rt-one">' + T(en, zh) + '</dt><dd>' + v + '</dd></div>'; };
      var card = function (x, i) {
        return '<li class="rt-dc' + (i === 0 ? ' first' : '') + (i === D.length - 1 && i ? ' latest' : '') + '"><h4>' + T('Draft ' + (i + 1), '第 ' + (i + 1) + ' 稿') + ' <span class="muted">' + x.d + '</span>' +
          (i === 0 && D.length > 1 ? ' <span class="rt-k rt-one">' + T('first', '最早') + '</span>' : i === D.length - 1 && i ? ' <span class="rt-k rt-one">' + T('latest', '最近') + '</span>' : '') + '</h4><dl>' +
          f('Words', '词数', x.m.words) + f('Sentence shapes', '句子形状', x.m.structTypes) + f('Kinds of linking', '衔接类', x.m.connGroups) + f('Words a sentence', '每句词数', x.m.mean) + f('This week’s words', '本周的词', x.m.chunksUsed) +
          '</dl><button type="button" class="rt-btn" data-load="' + i + '">' + one('Open', '打开') + '</button></li>';
      };
      var order = D.length > 2 ? [0, D.length - 1].concat(D.map(function (_, i) { return i; }).slice(1, -1)) : D.map(function (_, i) { return i; });
      box.innerHTML = '<h3>🗂 ' + T('Your drafts on this question', '这道题你留下的稿子') + '</h3><ul class="rt-dcs" role="list">' + order.map(function (i) { return card(D[i], i); }).join('') + '</ul>' +
        (D.length < 2 ? '<p class="muted">' + T('Come back in a few weeks and write on the same question again: the two cards side by side are the evidence.', '过几周回来，同一道题再写一遍：两张卡并排，就是证据。') + '</p>' : '');
    }
    function samples() { $('rt-ns').textContent = ST.samples.length ? '(' + ST.samples.length + ')' : ''; $('rt-dl-sample').hidden = !ST.samples.length; }
    $('rt-check').addEventListener('click', report);
    $('rt-save').addEventListener('click', function () {
      var A = report(); if (!A) return;
      (ST.drafts[wid] = ST.drafts[wid] || []).push({ d: EH.today(), text: ta.value, m: A.m });
      done.d5a = EH.today(); startWeek();
      save(); drafts(); paint(); EH.toast(T('Draft kept in this browser.', '这一稿已留在这个浏览器里。'));
    });
    $('rt-drafts').addEventListener('click', function (e) { var b = e.target.closest('[data-load]'); if (b) { ta.value = ST.drafts[wid][+b.dataset.load].text; var L = wlen(); wc(L[0], L[1]); ta.focus(); } });
    $('rt-keep-sample').addEventListener('click', function () {
      var A = W.analyze(ta.value, cfg());
      if (A.m.words < 25) { EH.toast(T('Write at least 25 words first.', '先写到 25 词以上。')); return; }
      ST.samples.push({ d: EH.today(), wid: wid, station: asSt(), placed: ST.placed ? ST.placed.rec : null, self: $('rt-self').value, text: ta.value, m: A.m });
      save(); samples(); EH.toast(T('Kept as a calibration sample in this browser.', '已作为标定样本存在这个浏览器里。'));
    });
    $('rt-dl-sample').addEventListener('click', function () {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ kind: 'english-hub-writing-samples', v: 1, samples: ST.samples }, null, 1)], { type: 'application/json' }));
      a.download = 'english-hub-writing-samples-' + EH.today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
    });
    $('rt-prompt').addEventListener('click', function () {
      var p = W.prompt(ta.value, cfg()), ok = function () { EH.toast(T('Copied. Paste it into the AI you use.', '已复制。贴到你自己用的 AI 里。')); };
      var show = function () { var box = $('rt-ai'); box.hidden = false; box.innerHTML = '<label class="rt-wl" for="rt-pt">' + one('Copy this text', '请复制这段文字') + '</label><textarea id="rt-pt" rows="8" readonly lang="en"></textarea>'; $('rt-pt').value = p; $('rt-pt').select(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p).then(ok, show); else show();
    });
    // 浏览器自带的本机模型（有才出现；没有就没有这个键）。只在读者点了以后运行，文字不出本机。
    var LM = window.LanguageModel;
    if (LM && typeof LM.create === 'function') {
      var lb = $('rt-local'); lb.hidden = false;
      lb.addEventListener('click', function () {
        var box = $('rt-ai'); box.hidden = false; box.innerHTML = '<p class="muted">' + T('Asking the model on this device…', '正在问本机模型……') + '</p>';
        Promise.resolve().then(function () { return LM.create(); }).then(function (s) { return s.prompt(W.prompt(ta.value, cfg())); }).then(function (txt) {
          box.innerHTML = '<h3>' + T('From the AI built into this browser', '浏览器自带 AI 的意见') + '</h3><p class="muted">' + T('A second opinion, not a judgement. It can be wrong.', '只是第二意见，不是判定，可能出错。') + '</p><pre class="rt-pre"></pre>'; box.querySelector('pre').textContent = txt;
        }).catch(function () { box.innerHTML = '<p class="rt-res no">' + T('The built-in model is not ready in this browser. Use the copy button instead.', '这个浏览器的自带模型现在用不了，请改用「复制批改提示词」。') + '</p>'; });
      });
    }
    listen();
  }

  /* ---------- 周四：先听懂（不看文字听 → 答题 → 说要点 → 再看原文） ---------- */
  function listen() {
    var sec = $('listen'); if (!sec) return;
    var play = $('rt-lplay'), slow = $('rt-lslow'), au = $('rt-laudio'), pos = $('rt-lpos'), playing = false;
    var text = sec.querySelector('#rt-ltext p.en').textContent;
    function stop() { playing = false; try { au.pause(); } catch (e) {} if (window.speechSynthesis) speechSynthesis.cancel(); play.innerHTML = '▶ ' + one('Listen', '听'); }
    play.addEventListener('click', function () {
      if (playing) return stop();
      var src = play.getAttribute(slow.getAttribute('aria-pressed') === 'true' ? 'data-s-src' : 'data-n-src') || play.getAttribute('data-n-src');
      playing = true; play.innerHTML = '⏸ ' + one('Pause', '暂停');
      if (src) { if (au.getAttribute('src') !== src) au.src = src; au.play().catch(function () { stop(); pos.innerHTML = T('The recording could not be played here.', '这里放不了录音。'); }); au.onended = stop; }
      else if (window.speechSynthesis) { var u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = slow.getAttribute('aria-pressed') === 'true' ? 0.75 : 0.95; u.onend = stop; speechSynthesis.speak(u); pos.innerHTML = T('Read by your browser’s voice.', '用浏览器自带的声音朗读。'); }
      else { stop(); pos.innerHTML = T('No audio in this browser: open the text instead.', '这个浏览器放不了声音，请直接看原文。'); }
    });
    slow.addEventListener('click', function () { var on = slow.getAttribute('aria-pressed') !== 'true'; slow.setAttribute('aria-pressed', on ? 'true' : 'false'); if (playing) stop(); });
    $('rt-lcheck').addEventListener('click', function () {
      var qs = $$('.rt-lq', sec), right = 0, answered = 0;
      qs.forEach(function (f, k) {
        var a = +f.dataset.a, c = f.querySelector('input:checked');
        $$('.rt-lo', f).forEach(function (lab, j) {
          var m = lab.querySelector('.rt-mark'); lab.classList.remove('right', 'wrong'); m.innerHTML = '';
          if (c && j === a) { lab.classList.add('right'); m.innerHTML = ' ✓ ' + one('right answer', '正确答案'); }
          else if (c && j === +c.value) { lab.classList.add('wrong'); m.innerHTML = ' ✗ ' + one('your choice', '你选的'); }
        });
        if (c) { answered++; if (+c.value === a) right++; $('lfb-' + k).hidden = false; }
      });
      var res = $('rt-lres');
      res.className = 'rt-res'; res.innerHTML = answered < qs.length ? T('Answer all ' + qs.length + ' first.', '先把 ' + qs.length + ' 道都答完。') : T(right + ' of ' + qs.length + ' right. Now say the main points, then open the text.', '答对 ' + right + ' / ' + qs.length + '。接下来说出要点，再打开原文。');
      if (answered === qs.length) { var d = ST.done[root.dataset.week] || (ST.done[root.dataset.week] = {}); d.d3a = EH.today(); if (!ST.week || ST.week.id !== root.dataset.week) ST.week = { id: root.dataset.week, start: EH.today() }; save(); var cb = root.querySelector('input[data-done=d3a]'); if (cb) { cb.checked = true; cb.closest('.rt-task').classList.add('done'); } }
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]'); if (b) return pick(b.dataset.pick);
    var d = e.target.closest('#rt-direct');
    if (d) {   // 「直接选一站」：落到三站卡片区，焦点到标题，卡片闪一下，说明怎么选
      e.preventDefault(); var h = $('route'); h.tabIndex = -1; h.scrollIntoView({ block: 'start' }); h.focus();
      $$('.rt-st').forEach(function (li) { li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); });
      say(T('Choose one of the three stations below: each has a “Start at this station” button.', '在下面三站里选一站：每站都有「从这一站开始」。'));
    }
  });
  window.EH_RT = { placeScore: placeScore, state: ST, curWeek: curWeek, pl: function () { return pl; } };
  if (page === 'home') home(); else if (page === 'placement') placement(); else if (page === 'week') week();
})();
