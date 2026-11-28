/* progress.html（进度）与 week.html（本周回顾）。只读本机存储 EH.state，零网络。
   新知识点＝进入复习的卡（B1 底子卡不算），已掌握＝连续答对 ≥2 次；词块掌握＝在读过的文章里见过 ≥10 次且它的复习卡至少答对过一次。 */
(function () {
  'use strict';
  if (!window.EH_MAP) return;
  var T = EH.T, E = EH.esc, S = EH.state, M = window.EH_MAP, G = window.EH_PROG || { books: [], lid: {}, dims: [], celpip: {} }, t = EH.today();
  var units = {}; M.units.forEach(function (u) { units[u.id] = u; });
  var arts = M.units.filter(function (u) { return u.built && u.skill === 'read'; });
  var L = function (id) { return S.lessons[id] || { steps: {} }; };
  var read = function (u) { return !!L(u.id).steps.learn; };
  var kpCards = function () { var o = []; for (var k in S.cards) if (!EHPlan.isBase(S.cards[k])) o.push(S.cards[k]); return o; };
  function bars(vals, labels, cls) { // 单序列柱：每根 title 即悬停提示
    var max = Math.max.apply(null, [1].concat(vals));
    return '<div class="bars ' + (cls || '') + '" role="img" aria-label="' + E(labels[0] + ' – ' + labels[labels.length - 1]) + '">' + vals.map(function (v, i) {
      return '<i title="' + E(labels[i]) + ': ' + v + '" style="height:' + Math.round(4 + 60 * v / max) + 'px"' + (v ? ' class="on"' : '') + '></i>';
    }).join('') + '</div>';
  }
  function chunkPass(w) { // 这个词块的复习卡有没有答对过（单元词卡 #w:词 或新词卡 lw:id）
    var lid = G.lid[w.toLowerCase()];
    if (lid && S.cards['lw:' + lid] && S.cards['lw:' + lid].n >= 1) return true;
    for (var k in S.cards) if (S.cards[k].n >= 1 && k.slice(-(w.length + 3)) === '#w:' + w) return true;
    return false;
  }

  /* ---------- 进度页 ---------- */
  var pg = document.getElementById('progress');
  if (pg) {
    var cs = kpCards(), byDay = {}, solid = 0;
    cs.forEach(function (c) { byDay[c.added] = (byDay[c.added] || 0) + 1; if (c.n >= 2) solid++; });
    var days = [], vals = [], cum = [], run = 0;
    var first = Object.keys(byDay).sort()[0];
    for (var i = 29; i >= 0; i--) days.push(EH.addDays(t, -i));
    if (first) for (var k in byDay) if (k < days[0]) run += byDay[k];
    days.forEach(function (d) { var v = byDay[d] || 0; vals.push(v); run += v; cum.push(run); });
    var quiet = cs.length > 0 && !byDay[t] && !byDay[EH.addDays(t, -1)] && !byDay[EH.addDays(t, -2)];
    var H = [];
    H.push('<div class="metric phero"><span class="lbl">' + T('New knowledge points learned', '累计新学的知识点') + '</span> <b id="p-total">' + cs.length + '</b> · ' +
      '<b id="p-solid">' + solid + '</b> ' + T('mastered (right twice in a row)', '已掌握（连续答对两次）') + ' · <b id="p-today">' + (byDay[t] || 0) + '</b> ' + T('today', '今天') +
      '<h3>' + T('New points per day, last 30 days', '近 30 天每天新增') + '</h3>' + bars(vals, days) +
      '<p class="muted">' + T('Running total: ', '累计：') + cum[0] + ' → ' + cum[cum.length - 1] + '</p>' +
      (quiet ? '<p class="nudge">' + T('Nothing new for three days. Review keeps what you have; one new point or one new text today moves you forward.', '已经三天没有新增了。复习只能保住已有的；今天学一个新点或读一篇新文章，才是在往前走。') + '</p>' : '') + '</div>');
    // 词块见面次数分布
    var mt = EHPlan.met(M), all = {};
    arts.forEach(function (u) { for (var w in u.w) all[w] = 1; });
    var B = [['0', 0, 0], ['1–2', 1, 2], ['3–5', 3, 5], ['6–9', 6, 9], ['10+', 10, 1e9]], cnt = B.map(function () { return 0; }), mast = 0;
    Object.keys(all).forEach(function (w) { var n = mt[w] || 0; B.forEach(function (b, j) { if (n >= b[1] && n <= b[2]) cnt[j]++; }); if (n >= 10 && chunkPass(w)) mast++; });
    H.push('<h2 id="chunks">' + T('Chunks met in context', '在语境里见过的词块') + '</h2><p class="muted">' + T('Times you have met each of the site’s chunks in the texts you have read.', '站内每个词块在你读过的文章里出现过几次。') + '</p>' +
      '<table class="dist"><tr><th>' + T('times met', '见过次数') + '</th>' + B.map(function (b) { return '<th>' + b[0] + '</th>'; }).join('') + '</tr><tr><td>' + T('chunks', '词块数') + '</td>' + cnt.map(function (n) { return '<td>' + n + '</td>'; }).join('') + '</tr></table>' +
      '<p><b id="p-mastered">' + mast + '</b> ' + T('chunks mastered: met 10+ times and answered right in review', '个词块已掌握：见过 10 次以上、复习也答对过') + '</p>');
    // 阅读与主题
    var rw = 0, nr = 0; arts.forEach(function (u) { if (read(u)) { rw += u.words; nr++; } });
    var tps = M.topics.map(function (tp) {
      var a = arts.filter(function (u) { return u.topic === tp.id; }), r = a.filter(read).length;
      return { tp: tp, n: a.length, r: r };
    }).filter(function (x) { return x.n; }).sort(function (a, b) { return (b.r > 0) - (a.r > 0) || b.r / b.n - a.r / a.n; });
    H.push('<h2 id="reading">' + T('Reading', '阅读') + '</h2><p><b id="p-words">' + rw + '</b> ' + T('words read in', '词，共') + ' <b>' + nr + '</b> ' + T('texts', '篇') + '</p>' +
      '<h3>' + T('Topics', '各主题完成度') + '</h3><ul class="tprog">' + tps.map(function (x) {
        return '<li><a href="t/' + x.tp.id + '.html"><span class="en">' + E(x.tp.en) + '</span> <span class="zh" lang="zh-Hans">' + E(x.tp.zh) + '</span></a> <span class="meter"><i style="width:' + Math.round(100 * x.r / x.n) + '%"></i></span> <span class="muted">' + x.r + '/' + x.n + '</span></li>';
      }).join('') + '</ul>');
    // 口语四维度：四个小图，各一条线
    var sp = S.speaks.slice(-30);
    if (sp.length) {
      var dims = G.dims.map(function (d) { return [d.k, d.en, d.zh]; });
      var line = function (key) {
        var W = 240, Hh = 80, pts = sp.map(function (s, j) { var v = (s.scores || {})[key] || s.avg; return [sp.length === 1 ? W / 2 : 8 + j * (W - 16) / (sp.length - 1), Hh - 8 - (v - 5) / 5 * (Hh - 16), v, s.d]; });
        return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" class="spark" role="img" aria-label="' + key + '">' +
          [5.5, 7.5, 9.5].map(function (v) { var y = Hh - 8 - (v - 5) / 5 * (Hh - 16); return '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="2" y="' + (y - 2) + '" class="ax">' + (v === 5.5 ? '5–6' : v === 7.5 ? '7–8' : '9+') + '</text>'; }).join('') +
          '<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" class="ln"/>' +
          pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" class="pt"><title>' + p[3] + ': ' + p[2] + '</title></circle>'; }).join('') + '</svg>';
      };
      H.push('<h2 id="speaking">' + T('Speaking self-ratings', '口语四维度自评') + '</h2><div class="smalls">' + dims.map(function (d) { return '<figure><figcaption>' + T(d[1], d[2]) + '</figcaption>' + line(d[0]) + '</figure>'; }).join('') + '</div>' +
        '<details><summary>' + T('Table view', '表格') + '</summary><table class="dist"><tr><th>' + T('date', '日期') + '</th>' + dims.map(function (d) { return '<th>' + T(d[1], d[2]) + '</th>'; }).join('') + '<th>' + T('average', '平均') + '</th></tr>' +
        sp.map(function (s) { return '<tr><td>' + s.d + '</td>' + dims.map(function (d) { return '<td>' + ((s.scores || {})[d[0]] || '–') + '</td>'; }).join('') + '<td>' + s.avg + '</td></tr>'; }).join('') + '</table></details>');
    } else H.push('<h2 id="speaking">' + T('Speaking self-ratings', '口语四维度自评') + '</h2><p class="muted">' + T('No ratings yet. The speaking step of today’s session saves one.', '还没有自评。今日学习的口语那一步会存一次。') + '</p>');
    // 级别双标
    var lv = ['B1', 'B2', 'C1'].map(function (l) {
      var us = M.units.filter(function (u) { return u.built && u.skill !== 'read' && u.level === l; }), d = us.filter(function (u) { return L(u.id).steps.learn; }).length;
      return '<li><b>' + l + '</b> · CELPIP ' + (G.celpip[l] || '') + ': ' + d + '/' + us.length + ' ' + T('points learned', '个知识点已学') + (l === 'B1' ? ' <span class="muted">' + T('(review base)', '（复习底子）') + '</span>' : '') + '</li>';
    }).join('');
    H.push('<h2 id="levels">' + T('By level', '按级别') + '</h2><ul>' + lv + '</ul><p class="muted">' + T('CEFR and CELPIP / CLB bands correspond only roughly.', 'CEFR 与思培／CLB 分级只是大致对应。') + '</p>');
    // 教材单元完成度（有 crosswalk 才显示）
    if (G.books.length) {
      H.push('<h2 id="books">' + T('Coursebook units covered', '教材单元完成度') + '</h2><p class="muted">' + T('A unit counts when every site point and topic text linked to it is done.', '一个教材单元挂的本站知识点和主题文章都学完，才算完成。') + '</p>');
      G.books.forEach(function (b) {
        var done = 0, rows = b.rows.map(function (r) {
          var ids = r.ids.concat(r.arts), n = ids.filter(function (i) { return L(i).steps.learn; }).length, ok = ids.length && n === ids.length;
          if (ok) done++;
          return '<tr' + (ok ? ' class="ok"' : '') + '><td>' + E(r.unit) + '</td><td class="en">' + E(r.name) + '</td><td>' + n + '/' + ids.length + (ok ? ' ✓' : '') + '</td></tr>';
        }).join('');
        H.push('<details><summary><b>' + E(b.title) + '</b> ' + done + '/' + b.rows.length + '</summary><table class="dist">' + rows + '</table></details>');
      });
    }
    H.push('<p><a href="celpip/progress.html">🎙 ' + T('CELPIP listening and mock-test records', '思培听力与模考记录') + '</a> · <a href="week.html">📅 ' + T('This week', '本周回顾') + '</a></p>');
    pg.innerHTML = H.join('');
  }

  /* ---------- 本周回顾 ---------- */
  var wk = document.getElementById('week');
  if (wk) {
    var mon = (location.hash.match(/w=(\d{4}-\d\d-\d\d)/) || [])[1];
    mon = EHPlan.weekStart(mon || t);
    var sun = EH.addDays(mon, 6), inW = function (d) { return d && d >= mon && d <= sun; };
    var cards = kpCards().filter(function (c) { return inW(c.added); });
    var byU = {}; cards.forEach(function (c) { (byU[c.lesson] = byU[c.lesson] || []).push(c); });
    var learned = M.units.filter(function (u) { return u.built && inW(L(u.id).steps.learn); });
    var know = learned.filter(function (u) { return u.skill === 'vocab' || u.skill === 'read'; }), skills = learned.filter(function (u) { return u.skill === 'grammar' || u.skill === 'pron'; });
    var tps = [], wd = 0, wr = 0, secs = 0, strip = '';
    for (var d = mon; d <= sun; d = EH.addDays(d, 1)) {
      var x = S.days[d] || {}, s = 0; for (var k2 in (x.secs || {})) s += x.secs[k2];
      secs += s; if (x.topic && tps.indexOf(x.topic) < 0) tps.push(x.topic);
      strip += '<li' + (s || x.topic ? ' class="on"' : '') + (d === t ? ' id="w-today"' : '') + '><b>' + d.slice(5) + '</b><span>' + Math.round(s / 60) + ' min</span></li>';
    }
    arts.forEach(function (u) { if (inW(L(u.id).steps.learn)) { wd += u.words; wr++; } });
    var before = EHPlan.met(M, { before: mon }), seen = {}, nNew = 0;
    arts.forEach(function (u) { if (inW(L(u.id).steps.learn)) for (var w in u.w) if (!before[w] && !seen[w]) { seen[w] = 1; nNew++; } });
    var sp = S.speaks.filter(function (s) { return inW(s.d); }), prevMon = EH.addDays(mon, -7);
    var spPrev = S.speaks.filter(function (s) { return s.d >= prevMon && s.d < mon; });
    var avg = function (a) { return a.length ? Math.round(a.reduce(function (x, s) { return x + s.avg; }, 0) / a.length * 10) / 10 : '–'; };
    var tname = function (id) { var x = M.topics.filter(function (z) { return z.id === id; })[0]; return x ? '<a href="t/' + x.id + '.html"><span class="en">' + E(x.en) + '</span> <span class="zh" lang="zh-Hans">' + E(x.zh) + '</span></a>' : E(id); };
    var ul = function (list) { return list.length ? '<ul>' + list.map(function (u) { return '<li><a href="u/' + u.id + '.html"><span class="en">' + E(u.en) + '</span> <span class="zh" lang="zh-Hans">' + E(u.zh) + '</span></a> <span class="muted">' + u.level + ' · ' + ((byU[u.id] || []).length) + ' ' + T('cards', '张卡') + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">' + T('None yet this week.', '本周还没有。') + '</p>'; };
    var H2 = [];
    H2.push('<p class="wnav"><a href="#w=' + prevMon + '" data-w>‹ ' + T('previous week', '上一周') + '</a> <b>' + mon + ' – ' + sun + '</b>' + (sun < t ? ' <a href="#w=' + EH.addDays(mon, 7) + '" data-w>' + T('next week', '下一周') + ' ›</a>' : '') + '</p>');
    H2.push('<div class="metric phero"><span class="lbl">' + T('This week', '本周') + '</span> <b id="w-new">' + cards.length + '</b> ' + T('new knowledge points', '个新知识点') + ' · <b id="w-chunks">' + nNew + '</b> ' + T('chunks met for the first time', '个第一次见到的词块') +
      ' · <b>' + wr + '</b> ' + T('texts', '篇文章') + ' (' + wd + ' words) · <b>' + Math.round(secs / 60) + '</b> min · ' + T('speaking', '口语自评') + ' <b>' + avg(sp) + '</b> <span class="muted">(' + T('last week', '上周') + ' ' + avg(spPrev) + ')</span>' +
      '<ol class="wstrip">' + strip + '</ol></div>');
    H2.push('<p>' + T('Topic: ', '主题：') + (tps.length ? tps.map(tname).join(' · ') : '<span class="muted">' + T('not started', '还没开始') + '</span>') + '</p>');
    H2.push('<h2 id="w-knowledge">' + T('New knowledge: words, chunks and texts', '新知识：词、词块与文章') + '</h2>' + ul(know));
    H2.push('<h2 id="w-skills">' + T('New skills: grammar choices and sounds', '新技能：语法选择与发音') + '</h2>' + ul(skills) +
      (sp.length ? '<p>' + T('Speaking tasks done: ', '做过的口语任务：') + sp.length + '</p>' : ''));
    H2.push('<h2 id="w-pass">' + T('One pass through everything new this week', '把本周新学的全过一遍') + '</h2><p class="muted">' + cards.length + ' ' + T('cards. Your answers update their review schedule.', '张卡。打分会更新它们的复习时间。') + '</p><div id="w-run"></div>' +
      (cards.length ? '<p><button class="primary" id="w-start">' + T('Start', '开始') + '</button></p>' : ''));
    H2.push('<h2 id="w-wrap">' + T('Wrap-up on the week’s topic', '本周主题综合输出') + '</h2><div class="prompt">' + T('Speak for two minutes on this week’s topic, then write 180 to 220 words from your own experience. Use at least eight chunks you met for the first time this week.', '就本周主题先说两分钟，再结合自己的经历写 180–220 词，至少用上八个本周第一次见到的词块。') + '</div>' +
      '<p class="chips">' + Object.keys(seen).slice(0, 24).map(function (w) { return '<span class="chip en">' + E(w) + '</span>'; }).join('') + '</p>' +
      '<textarea rows="8" class="note-box" data-note="week:' + mon + '"></textarea>' +
      '<p>🎯 <a href="celpip/index.html">' + T('Then check yourself with a CELPIP speaking task and listening part on the same topic', '然后用同主题的思培口语题和听力题检验一下') + '</a></p>');
    wk.innerHTML = H2.join('');
    var nb = wk.querySelector('.note-box'), nk = nb.dataset.note;
    nb.value = (S.notes[nk] || {}).text || '';
    nb.oninput = function () { S.notes[nk] = { text: nb.value, t: new Date().toISOString() }; if (nb.value.trim().length > 40) { (S.days[t] = S.days[t] || {}).weekly = mon; } EH.save(); };
    wk.querySelectorAll('[data-w]').forEach(function (a) { a.onclick = function () { setTimeout(function () { location.reload(); }, 0); }; });
    var st = document.getElementById('w-start');
    if (st) st.onclick = function () {
      var q = cards.slice(), n = 0, run = document.getElementById('w-run'); st.hidden = true;
      var show = function () {
        if (!q.length) { run.innerHTML = '<p>🎉 ' + T('All done: ', '过完了：') + n + '</p>'; return; }
        var c = q[0], x = c.extra || {};
        run.innerHTML = '<div class="rcard"><div class="kind">' + E(x.unit || '') + ' · ' + q.length + '</div><div class="front en">' + E(c.front) + '</div><div class="back" hidden><div class="bm en">' + E(c.back) + '</div><div class="zh" lang="zh-Hans">' + E(x.zh || '') + '</div>' +
          '<div class="grades"><button data-q="2">' + T('Forgot', '忘了') + '</button><button data-q="3">' + T('Hard', '难') + '</button><button data-q="4">' + T('Good', '记得') + '</button><button data-q="5">' + T('Easy', '很熟') + '</button></div></div><button class="primary flip">' + T('Show answer', '看答案') + '</button></div>';
        run.querySelector('.flip').onclick = function () { run.querySelector('.back').hidden = false; this.hidden = true; };
        run.querySelectorAll('.grades button').forEach(function (b) { b.onclick = function () { EH.grade(q.shift().id, +b.dataset.q); n++; show(); }; });
      };
      show();
    };
  }
})();
