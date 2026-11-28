/* 首页（接下来学、地图进度、备份）、复习页（SM-2）、错题本。「接下来学」同级内按 route（English File 主干路线序，build.py::route_rank）排。 */
(function () {
  'use strict';
  var T = EH.T, E = EH.esc, S = EH.state;

  /* ---------- 闭环规划（首页、today.html、周回顾、进度页共用；总纲 §十.2、§八、§十一） ----------
     路线固定在 B2：新内容按 B2 → C1 的路线序取，B1 只作复习底子不当新课；一周一个主题（本周第一个主题还有没读的文章就继续它）；
     新语法点每两天一个（昨天学了语法点，今天的新知识点就取词汇或语音）。 */
  var MODE_KEY = 'english-hub-mode', ORDER = ['B2', 'C1', 'B1'];
  function weekStart(d) { var p = d.split('-'), x = new Date(+p[0], +p[1] - 1, +p[2]); return EH.addDays(d, -((x.getDay() + 6) % 7)); }
  function mode() { var m = localStorage.getItem(MODE_KEY) || '40'; return (window.EH_TODAY && !EH_TODAY.modes[m]) ? '40' : m; }
  function setMode(m) { localStorage.setItem(MODE_KEY, m); }
  function isBase(c) { return !!(c && c.extra && c.extra.base); }
  function plan(M) {
    var t = EH.today(), y = EH.addDays(t, -1);
    var Ls = function (id) { return S.lessons[id] || { steps: {} }; };
    var isDone = function (u) { return !!Ls(u.id).done; };
    var on = function (u, d) { return Ls(u.id).steps.learn === d; };
    var fresh = function (u) { return !Ls(u.id).steps.learn; };
    var rank = function (u) { return ORDER.indexOf(u.level); };
    var byId = {}; M.units.forEach(function (u) { byId[u.id] = u; });
    var arts = M.units.filter(function (u) { return u.built && u.skill === 'read'; });
    var started = {}; arts.forEach(function (u) { if (S.lessons[u.id]) started[u.topic] = 1; });
    var day = S.days[t] || {};
    var wk = weekStart(t), weekTopic = null;
    for (var d = wk; d < t; d = EH.addDays(d, 1)) if (S.days[d] && S.days[d].topic) weekTopic = weekTopic || S.days[d].topic;
    var hasFresh = function (id) { return arts.some(function (u) { return u.topic === id && fresh(u); }); };
    var open = arts.filter(function (u) { return !isDone(u) && fresh(u); })
      .sort(function (a, b) { return (started[b.topic] || 0) - (started[a.topic] || 0) || rank(a) - rank(b) || a.route - b.route; });
    var topicId = day.topic || (weekTopic && hasFresh(weekTopic) ? weekTopic : (open[0] || {}).topic);
    var topic = M.topics.filter(function (x) { return x.id === topicId; })[0];
    var inTopic = arts.filter(function (u) { return u.topic === topicId; });
    var todays = inTopic.filter(function (u) { return on(u, t); }), fr = inTopic.filter(fresh);
    var main = todays[0] || fr[0], rest = fr.filter(function (u) { return u !== main; });
    var similar = todays[1] || rest[0], similar2 = todays[2] || rest.filter(function (u) { return u !== similar; })[0];
    var learnedToday = M.units.filter(function (u) { return u.skill !== 'read' && on(u, t); })[0];
    var want = M.units.some(function (u) { return u.skill === 'grammar' && on(u, y); }) ? 'other' : 'grammar';
    var fits = function (u) { return want === 'grammar' ? u.skill === 'grammar' : u.skill !== 'grammar'; };
    var cand = function (u) { return u && u.built && u.skill !== 'read' && u.level !== 'B1' && !isDone(u); };
    var tg = main ? main.targets.map(function (id) { return byId[id]; }).filter(cand) : [];
    var pool = M.units.filter(cand).sort(function (a, b) { return rank(a) - rank(b) || a.route - b.route; });
    var kp = learnedToday || tg.filter(fits)[0] || (want === 'grammar' ? tg[0] : null) || pool.filter(fits)[0] || pool[0];
    // 对比句组（60 分钟档）：今天的语法点自带的优先，其次学过的语法点里还没做过的，再按路线序
    var K = (window.EH_TODAYKP || {}).kp || {}, doneC = {};
    for (var dd in S.days) if (S.days[dd].contrast && dd !== t) doneC[S.days[dd].contrast] = 1;
    var hasC = function (u) { return u && K[u.id] && K[u.id].contrast.length; };
    var cu = day.contrast ? byId[day.contrast] : (hasC(kp) && !doneC[kp.id] ? kp : null);
    if (!cu) {
      var gs = M.units.filter(function (u) { return u.built && u.skill === 'grammar' && u.level !== 'B1' && hasC(u) && !doneC[u.id]; })
        .sort(function (a, b) { return (S.lessons[b.id] ? 1 : 0) - (S.lessons[a.id] ? 1 : 0) || rank(a) - rank(b) || a.route - b.route; });
      cu = gs[0] || null;
    }
    var m = mode(), cards = Object.keys(S.cards).length;
    var done = { review: (EH.due().length === 0 && cards > 0) || !!(day.fin || {}).review, main: !!todays[0], kp: !!learnedToday,
      contrast: !!day.contrast, similar: !!todays[1], similar2: !!todays[2], speak: !!(day.speak && day.speak.avg) };
    return { today: t, week: wk, day: day, mode: m, steps: window.EH_TODAY ? EH_TODAY.modes[m] : null, topicId: topicId, topic: topic,
      main: main, similar: similar, similar2: similar2, kp: kp, contrast: cu, done: done, skip: day.skip || {}, byId: byId, arts: arts, todays: todays };
  }
  /* 个人语料：读过的文章里每个词块见过几次（before＝只算这一天之前读的；skip＝不算这一篇） */
  function met(M, opt) {
    opt = opt || {}; var out = {};
    M.units.forEach(function (u) {
      if (!u.built || u.skill !== 'read' || u.id === opt.skip) return;
      var d = (S.lessons[u.id] || { steps: {} }).steps.learn;
      if (!d || (opt.before && d >= opt.before) || (opt.upto && d > opt.upto)) return;
      for (var w in u.w) out[w] = (out[w] || 0) + u.w[w];
    });
    return out;
  }
  /* 当天新见到的词块：今天读的文章里、今天之前从没见过的 */
  function newChunks(M, d) {
    var before = met(M, { before: d }), n = 0, seen = {};
    M.units.forEach(function (u) {
      if (!u.built || u.skill !== 'read' || (S.lessons[u.id] || { steps: {} }).steps.learn !== d) return;
      for (var w in u.w) if (!before[w] && !seen[w]) { seen[w] = 1; n++; }
    });
    var lw = 0; for (var k in (S.learn || {})) if (S.learn[k].d === d && S.learn[k].st === 'learned') lw++;
    return { fromTexts: n, fromCards: lw, total: n + lw };
  }
  window.EHPlan = { plan: plan, met: met, newChunks: newChunks, weekStart: weekStart, mode: mode, setMode: setMode, isBase: isBase };

  /* ---------- 首页与主题页 ---------- */
  if (window.EH_MAP) {
    var M = window.EH_MAP;
    var isDone = function (u) { return !!(S.lessons[u.id] || {}).done; };
    var link = function (u, extra) {
      return '<a class="big" href="u/' + u.id + '.html"><span class="en">' + E(u.en) + '</span> <span class="zh" lang="zh-Hans">' + E(u.zh) + '</span></a><span class="muted">' + u.level + (extra || '') + '</span>';
    };
    var paint = function () {
      document.querySelectorAll('section.lv').forEach(function (s) { s.classList.toggle('mine', s.dataset.level === 'B2'); });
      var P = plan(M), topic = P.topic, main = P.main, similar = P.similar, kp = P.kp, day = P.day;
      var none = '<span class="muted">' + T('nothing open yet', '暂时没有') + '</span>';
      document.getElementById('loop-topic').innerHTML = topic ? '· <a href="t/' + topic.id + '.html"><span class="en">' + E(topic.en) + '</span> <span class="zh" lang="zh-Hans">' + E(topic.zh) + '</span></a>' : '';
      document.getElementById('next-text').innerHTML = main ? link(main, ' · ' + main.words + ' words') : none;
      document.getElementById('next-unit').innerHTML = kp ? link(kp, ' · ' + kp.cards + ' ' + T('new items', '个新知识点')) : none;
      document.getElementById('next-similar').innerHTML = similar ? link(similar, ' · ' + similar.words + ' words') : none;
      document.getElementById('next-speak').innerHTML = topic && topic.speak ? '<a class="big" href="t/' + topic.id + '.html#speak">' + T('Record your answer', '去录音作答') + '</a>' : none;
      var mins = {}; (P.steps || []).forEach(function (s) { mins[s[0]] = s[1]; });
      document.querySelectorAll('#loop li[data-k]').forEach(function (li, i) {
        var k = li.dataset.k, d = P.done[k], sk = !d && P.skip[k];
        li.classList.toggle('done', d); li.classList.toggle('off', P.steps ? !(k in mins) : false);
        li.querySelector('.tick').textContent = d ? '✓' : sk ? '–' : (i + 1);
        if (P.steps) li.querySelector('.min').textContent = (k in mins) ? mins[k] + ' min' : '–';
      });
      document.querySelectorAll('.mtab').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === P.mode); });
      if (P.topicId && !day.topic && (P.done.main || P.done.kp)) { S.days[P.today] = day; day.topic = P.topicId; EH.save(); }
      var mt = met(M);
      document.getElementById('sum-met').textContent = Object.keys(mt).filter(function (w) { return mt[w] >= 10; }).length;
      document.getElementById('sum-speak').textContent = day.speak && day.speak.avg ? day.speak.avg : '–';
    };
    if (document.getElementById('next-unit')) {
      document.querySelectorAll('.mtab').forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode); paint(); }; });
      paint();
      /* 头号指标：新学的知识点（＝进入复习的卡，按加入日计），已稳固＝连续答对 ≥2 次 */
      var byDay = {}, total = 0, solid = 0, t = EH.today();
      for (var id in S.cards) { var c = S.cards[id]; if (isBase(c)) continue; total++; byDay[c.added] = (byDay[c.added] || 0) + 1; if (c.n >= 2) solid++; }
      document.getElementById('kp-today').textContent = byDay[t] || 0;
      document.getElementById('sum-new').textContent = byDay[t] || 0;
      document.getElementById('kp-total').textContent = total;
      document.getElementById('kp-solid').textContent = solid;
      var rw = 0;
      M.units.filter(function (u) { return u.skill === 'read' && (S.lessons[u.id] || { steps: {} }).steps.learn; }).forEach(function (u) { rw += u.words; });
      document.getElementById('read-words').textContent = rw;
      var bars = '', max = 1, days = [];
      for (var i = 13; i >= 0; i--) { var d = EH.addDays(t, -i); days.push(d); max = Math.max(max, byDay[d] || 0); }
      days.forEach(function (d) { bars += '<i title="' + d + ': ' + (byDay[d] || 0) + '" style="height:' + Math.round(4 + 30 * (byDay[d] || 0) / max) + 'px"' + (byDay[d] ? ' class="on"' : '') + '></i>'; });
      document.getElementById('kp-bars').innerHTML = bars;
      var quiet = total > 0 && !byDay[t] && !byDay[EH.addDays(t, -1)] && !byDay[EH.addDays(t, -2)];
      document.getElementById('kp-nudge').hidden = !quiet;
      document.getElementById('due-n').textContent = EH.due().length;
      document.getElementById('wrong-n').textContent = Object.keys(S.wrong).filter(function (k) { return !S.wrong[k].cleared; }).length;
      var nd = document.getElementById('nce-due');
      if (nd) { // 私用层：只读新概念站的到期卡数（同一浏览器的 file:// 存储）
        try {
          var n = JSON.parse(localStorage.getItem('nce-study-v1') || '{}'), cnt = 0;
          for (var k in (n.cards || {})) if (n.cards[k].due <= t) cnt++;
          nd.textContent = '新概念今天到期 ' + cnt + ' 张卡';
        } catch (e) {}
      }
      document.getElementById('exp').onclick = EH.exportJSON;
      document.getElementById('imp').onchange = function (e) {
        if (!e.target.files[0]) return;
        EH.importJSON(e.target.files[0], document.getElementById('imp-merge').checked ? 'merge' : 'replace', function (err) {
          if (err) EH.toast(E(err.message)); else location.reload();
        });
      };
    }
    document.querySelectorAll('li.u.built[data-u]').forEach(function (li) {
      var id = li.dataset.u, L = S.lessons[id] || { steps: {} };
      li.querySelector('.dots').innerHTML = EH.STEPS.map(function (s) { return '<b class="' + (L.steps[s[0]] ? 'on' : '') + '"></b>'; }).join('');
      if (L.done) li.classList.add('done');
    });
    var sv = document.getElementById('speak-save');
    if (sv) { // 主题页口语任务：四维度自评写进当天记录与历史
      var tid = document.querySelector('[data-speak]').dataset.speak;
      sv.onclick = function () {
        var sc = {}, sum = 0, n = 0;
        document.querySelectorAll('select[data-dim]').forEach(function (x) { if (x.value) { sc[x.dataset.dim] = +x.value; sum += +x.value; n++; } });
        if (n < 4) { EH.toast(T('Rate all four dimensions.', '四个维度都要评。')); return; }
        var avg = Math.round(sum / n * 10) / 10, used = document.querySelectorAll('.used:checked').length;
        var d = S.days[EH.today()] || (S.days[EH.today()] = {});
        d.topic = d.topic || tid; d.speak = { topic: tid, scores: sc, avg: avg, used: used };
        S.speaks.push({ d: EH.today(), topic: tid, avg: avg, used: used, scores: sc });
        EH.touch(); EH.save();
        document.getElementById('speak-avg').innerHTML = T('Saved. Average ', '已保存。平均 ') + avg + ' · ' + used + ' ' + T('chunks used', '个词块用上了');
      };
    }
    document.querySelectorAll('.note-box').forEach(function (tb) {
      var k = tb.dataset.note; tb.value = (S.notes[k] || {}).text || '';
      tb.oninput = function () { S.notes[k] = { text: tb.value, t: new Date().toISOString() }; EH.save(); };
    });
  }

  /* ---------- 复习 ---------- */
  var rv = document.getElementById('review');
  if (rv) {
    var queue = EH.due(), shown = 0;
    var show = function () {
      if (!queue.length) { rv.innerHTML = '<div id="card"><p class="bm">🎉 ' + T('Nothing due. Cards come back on their own schedule.', '今天没有到期的卡，它们会按自己的节奏回来。') + '</p><p>' + T('Reviewed this session: ', '本次复习：') + shown + '</p></div>'; return; }
      var c = queue[0], x = c.extra || {};
      rv.innerHTML = '<p class="muted">' + queue.length + ' ' + T('left', '张待复习') + '</p><div id="card"><div class="kind">' + E(x.unit || '') + '</div>' +
        '<div class="front en">' + E(c.front) + (x.hint ? '' : ' <button class="say" data-say="' + E(c.front.replace(/^✗ /, '')) + '">🔊</button>') + '</div>' + (x.hint ? '<div class="zh" lang="zh-Hans">' + E(x.hint) + '</div>' : '') +
        '<div id="back" hidden><div class="ipa">' + E(x.ipa || '') + '</div><div class="bm en">' + E(c.back) + '</div><div class="zh" lang="zh-Hans">' + E(x.zh || '') + '</div>' +
        '<div class="grades"><button class="g0" data-q="2">1 ' + T('Forgot', '忘了') + '</button><button data-q="3">2 ' + T('Hard', '难') + '</button><button data-q="4">3 ' + T('Good', '记得') + '</button><button class="g5" data-q="5">4 ' + T('Easy', '很熟') + '</button></div></div>' +
        '<button class="primary" id="flip">' + T('Show answer (space)', '看答案（空格）') + '</button></div>';
      document.getElementById('flip').onclick = flip;
      rv.querySelectorAll('.grades button').forEach(function (b) { b.onclick = function () { grade(+b.dataset.q); }; });
    };
    var flip = function () { var b = document.getElementById('back'); if (b) { b.hidden = false; document.getElementById('flip').hidden = true; } };
    var grade = function (q) { var c = queue.shift(); EH.grade(c.id, q); shown++; if (q < 3) queue.push(c); show(); };
    document.addEventListener('keydown', function (e) {
      var b = document.getElementById('back'); if (!b) return;
      if (e.key === ' ' && b.hidden) { e.preventDefault(); flip(); }
      else if (!b.hidden && '1234'.indexOf(e.key) >= 0 && e.key) grade([2, 3, 4, 5][+e.key - 1]);
    });
    show();
  }

  /* ---------- 错题本 ---------- */
  var wb = document.getElementById('wrong');
  if (wb) {
    var Q = window.EH_QUIZ || {};
    var list = Object.keys(S.wrong).filter(function (k) { return !S.wrong[k].cleared && Q[k]; })
      .sort(function (a, b) { return S.wrong[b].times - S.wrong[a].times; }).map(function (k) { return Q[k]; });
    if (!list.length) wb.innerHTML = '<p>' + T('Empty. Questions you miss in a unit land here until you get them right.', '空的。单元里答错的题会留在这里，答对一次就移出。') + '</p>';
    else EHQuiz.render(wb, list, { showUnit: true, clearOnRight: true, retry: true });
  }
})();
