/* English Hub · 思培听说区（tools/celpip）。纯本地：进度写进 EH.state（同一份备份）。
   口语自评 → S.speaks（src:'celpip'）与 S.days[今天].speak；听力自测 → S.celpip.lq 与 S.days[今天].listen；
   听写 → S.celpip.dict；模考 → S.celpip.mocks。旧 celpip-ls 的 localStorage（celpip.lq、celpip.mock）可一次性导入。 */
(function () {
  'use strict';
  var EH = window.EH, D = window.EH_CELPIP || {}, T = EH.T, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var S = EH.state;
  function C() { var c = S.celpip || (S.celpip = {}); ['lq', 'dict'].forEach(function (k) { c[k] = c[k] || {}; }); ['speak', 'mocks'].forEach(function (k) { c[k] = c[k] || []; }); c.v = 1; return c; }
  function day() { S.days = S.days || {}; return S.days[EH.today()] || (S.days[EH.today()] = {}); }
  function topicName(id) { var t = (D.topics || {})[id]; return t ? T(EH.esc(t.en), EH.esc(t.zh)) : EH.esc(id || ''); }
  function topicLink(id, up) { var t = (D.topics || {})[id]; return t && t.arts ? '<a href="' + (up || '../') + 't/' + id + '.html">' + topicName(id) + '</a>' : topicName(id); }
  function weekAgo(n) { return EH.addDays(EH.today(), -(n || 7)); }

  /* ---------- 口语任务页：题目导航、三栏/分页、计时录音、升级高亮、自评 ---------- */
  var chips = $$('.pn-chip');
  function show(i) {
    $$('.cp-p').forEach(function (p) { p.hidden = +p.dataset.i !== i; });
    chips.forEach(function (c) { c.classList.toggle('on', +c.dataset.i === i); });
    try { history.replaceState(null, '', '#p' + i); } catch (e) {}
  }
  if (chips.length) {
    chips.forEach(function (c) { c.onclick = function () { show(+c.dataset.i); }; });
    var m = /^#p(\d+)$/.exec(location.hash); show(m && +m[1] < chips.length ? +m[1] : 0);
    document.addEventListener('keydown', function (e) {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
      var cur = chips.findIndex(function (c) { return c.classList.contains('on'); });
      if (e.key === 'ArrowRight' && cur < chips.length - 1) show(cur + 1);
      if (e.key === 'ArrowLeft' && cur > 0) show(cur - 1);
    });
  }
  $$('.cp-tabs .btab').forEach(function (b) {
    b.onclick = function () { var box = b.closest('.cp-p').querySelector('.cp-cols'); box.dataset.show = b.dataset.show; $$('.btab', b.parentNode).forEach(function (x) { x.classList.toggle('on', x === b); }); };
  });
  document.addEventListener('click', function (e) {
    var mk = e.target.closest('mark[data-up]'); if (!mk) return;
    var li = document.getElementById('up-' + mk.dataset.up); if (!li) return;
    $$('.cp-up.hit').forEach(function (x) { x.classList.remove('hit'); });
    li.classList.add('hit'); li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $$('.cp-go').forEach(function (b) {
    b.onclick = function () {
      var p = b.closest('.cp-p'), clock = $('.cp-clock', p), rec = $('.rec', p), left = +b.dataset.prep;
      b.disabled = true;
      (function tick() {
        if (left > 0) { clock.innerHTML = T('Prepare: ' + left + ' s', '准备：' + left + ' 秒'); left--; setTimeout(tick, 1000); return; }
        clock.innerHTML = '● ' + T('Recording… speak now (' + rec.dataset.max + ' s)', '录音中……开始说（' + rec.dataset.max + ' 秒）');
        rec.click();
        setTimeout(function () { clock.innerHTML = T('Done. Listen back, compare with the samples, then rate yourself.', '完成。回放一遍，对照示范，再自评。'); b.disabled = false; }, 1000 * rec.dataset.max + 300);
      })();
    };
  });
  $$('.cp-rate').forEach(function (box) {
    $('.cp-save', box).onclick = function () {
      var sc = {}, sum = 0, n = 0;
      $$('select[data-cdim]', box).forEach(function (x) { if (x.value) { sc[x.dataset.cdim] = +x.value; sum += +x.value; n++; } });
      if (n < 4) { EH.toast(T('Rate all four dimensions.', '四个维度都要评。')); return; }
      var avg = Math.round(sum / n * 10) / 10, key = box.dataset.key, pr = (D.prompts || []).filter(function (p) { return p.id === key; })[0] || {};
      var rec = { d: EH.today(), topic: pr.topic || '', avg: avg, used: 0, scores: sc, src: 'celpip', task: pr.n, prompt: key };
      var dd = day(); dd.topic = dd.topic || pr.topic; dd.speak = rec;
      S.speaks = S.speaks || []; S.speaks.push(rec); C().speak.push(rec);
      EH.touch(); EH.save();
      $('.cp-avg', box).innerHTML = T('Saved. Average ', '已保存。平均 ') + avg;
    };
  });

  /* ---------- 听力：选择题核对、嵌入视频（点了才加载）、依据回放 ---------- */
  function lqCount() {
    $$('.lq-score').forEach(function (el) {
      var lq = C().lq, items = $$('.lqi'), done = items.filter(function (li) { return li.dataset.q in lq; }), ok = done.filter(function (li) { return lq[li.dataset.q] === 1; });
      el.innerHTML = done.length ? T('On this page: ' + ok.length + ' of ' + done.length + ' answered correctly (' + items.length + ' questions).', '本页已答 ' + done.length + ' 题，答对 ' + ok.length + ' 题（共 ' + items.length + ' 题）。') : '';
    });
  }
  $$('.lqi').forEach(function (li) {
    $('.lq-check', li).onclick = function () {
      var sel = $('input:checked', li); if (!sel) { EH.toast(T('Choose an answer first.', '先选一个答案。')); return; }
      var ok = +sel.value === +li.dataset.a, res = $('.lq-res', li), id = li.dataset.q, c = C();
      res.hidden = false; $('.lq-verdict', res).innerHTML = ok ? '✓ ' + T('Right', '答对了') : '✗ ' + T('Not quite', '不对');
      li.classList.toggle('ok', ok); li.classList.toggle('bad', !ok);
      var dd = day(); dd.listen = dd.listen || { right: 0, total: 0, ids: {} };
      if (!dd.listen.ids[id]) { dd.listen.ids[id] = 1; dd.listen.total++; if (ok) dd.listen.right++; }
      c.lq[id] = ok ? 1 : 0;
      EH.touch(); EH.save(); lqCount();
    };
  });
  lqCount();
  function loadYT(box, t) {
    var src = box.dataset.src; if (t != null) src = src.replace(/start=\d+/, 'start=' + Math.max(0, t - 2));
    var f = $('iframe', box);
    if (!f) { box.innerHTML = ''; f = document.createElement('iframe'); f.width = '100%'; f.height = '315'; f.allow = 'autoplay; encrypted-media'; f.setAttribute('allowfullscreen', ''); f.title = 'CELPIP listening clip'; box.appendChild(f); }
    f.src = src;
  }
  $$('.yt-go').forEach(function (b) { b.onclick = function () { loadYT(b.closest('.yt')); }; });
  $$('.lq-jump').forEach(function (b) { b.onclick = function () { var box = $('.yt', b.closest('.clip')); if (box) { loadYT(box, +b.dataset.t); box.scrollIntoView({ block: 'center' }); } }; });

  /* ---------- 讲座：分段朗读、参考笔记 ---------- */
  var lp = $('#lec-play');
  if (lp) {
    var stop = false;
    lp.onclick = function () {
      var parts = lp.dataset.text.split(' || '), i = 0, rate = +$('#lec-rate').value; stop = false;
      (function next() {
        if (stop || i >= parts.length) { EH.speak.onend = null; return; }
        EH.speak.onend = function () { setTimeout(next, 1200); };
        EH.speak(parts[i++], rate);
      })();
    };
    $('#lec-stop').onclick = function () { stop = true; EH.speak.onend = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); };
    $('#lec-model').onclick = function () { $$('.cp-model').forEach(function (x) { x.hidden = !x.hidden; }); };
  }
  $$('.cp-note').forEach(function (tb) {
    var k = tb.dataset.note; tb.value = ((S.notes || {})[k] || {}).text || '';
    tb.oninput = function () { S.notes[k] = { text: tb.value, t: new Date().toISOString() }; EH.save(); };
  });

  /* ---------- 听写阶梯 ---------- */
  function words(s) { return EH.norm(s).split(' ').filter(Boolean); }
  function diff(want, got) { // 逐词最长公共子序列：标出漏掉的词
    var a = words(want), b = words(got), n = a.length, m = b.length, L = [], i, j;
    for (i = 0; i <= n; i++) { L[i] = []; for (j = 0; j <= m; j++) L[i][j] = i && j ? (a[i - 1] === b[j - 1] ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1])) : 0; }
    var out = [], hit = {}; i = n; j = m;
    while (i && j) { if (a[i - 1] === b[j - 1]) { hit[i - 1] = 1; i--; j--; } else if (L[i - 1][j] >= L[i][j - 1]) i--; else j--; }
    for (i = 0; i < n; i++) out.push(hit[i] ? EH.esc(a[i]) : '<del>' + EH.esc(a[i]) + '</del>');
    return { pct: n ? Math.round(100 * L[n][m] / n) : 0, html: out.join(' ') };
  }
  function rungPass() {
    $$('.dc-rung').forEach(function (r) {
      var its = $$('.dc-i', r), ok = its.filter(function (li) { return (C().dict[li.dataset.id] || 0) >= 90; }).length;
      $('.dc-pass', r).innerHTML = ok + '/' + its.length + (ok === its.length ? ' ✓' : '');
    });
  }
  $$('.dc-i').forEach(function (li) {
    $('.dc-play', li).onclick = function () { EH.speak(li.dataset.text, +li.dataset.rate); };
    $('.dc-slow', li).onclick = function () { EH.speak(li.dataset.text, Math.max(0.6, li.dataset.rate - 0.25)); };
    $('.dc-check', li).onclick = function () {
      var r = diff(li.dataset.text, $('.dc-in', li).value), res = $('.dc-res', li), c = C();
      res.hidden = false; res.innerHTML = '<b>' + r.pct + '%</b> <span class="en">' + r.html + '</span>';
      c.dict[li.dataset.id] = Math.max(c.dict[li.dataset.id] || 0, r.pct); EH.touch(); EH.save(); rungPass();
    };
  });
  if ($('.dc-rung')) rungPass();

  /* ---------- 本周检验：本周学的主题与知识点 → 同主题的口语题与听力题 ---------- */
  function thisWeek() {
    var from = weekAgo(7), cnt = {}, kp = {}, M = window.EH_MAP || { units: [] }, by = {};
    M.units.forEach(function (u) { by[u.id] = u; });
    Object.keys(S.days || {}).forEach(function (d) { if (d > from && S.days[d].topic) cnt[S.days[d].topic] = (cnt[S.days[d].topic] || 0) + 3; });
    Object.keys(S.lessons || {}).forEach(function (id) {
      var L = S.lessons[id], last = Object.keys(L.steps || {}).map(function (k) { return L.steps[k]; }).sort().pop() || L.started;
      if (!(last > from)) return;
      var u = by[id]; if (!u) return;
      if (u.skill === 'read' && u.topic) cnt[u.topic] = (cnt[u.topic] || 0) + 1; else kp[id] = 1;
    });
    var tops = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    return { topics: tops, kps: kp };
  }
  function weekPanel(box) {
    var w = thisWeek(), main = w.topics[0], up = '../';
    var ps = (D.prompts || []).filter(function (p) { return p.topic === main; });
    var byKp = (D.prompts || []).map(function (p) { return [p, p.kps.filter(function (k) { return w.kps[k]; }).length]; }).filter(function (x) { return x[1]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4).map(function (x) { return x[0]; });
    var ds = (D.drills || []).filter(function (x) { return x.topic === main; });
    var plink = function (p) { var t = (D.tasks || [])[p.n - 1] || {}; return '<li><a href="speaking-' + p.n + '.html#p' + p.i + '">' + T('Task ', '任务 ') + p.n + ' · ' + T(EH.esc(t.en || ''), EH.esc(t.zh || '')) + ' · ' + T('prompt ', '第 ') + (p.i + 1) + T('', ' 题') + '</a> <span class="en muted">' + EH.esc(p.q) + '</span></li>'; };
    var h = '';
    if (!main) {
      h = '<p>' + T('Nothing studied this week yet. Read a topic text first; this panel then picks the same-topic CELPIP tasks for you. Or start with a common one:', '这周还没有学习记录。先读一篇主题文章，这里就会替你挑同主题的思培题。也可以先从一个常见主题开始：') + ' ' + topicLink('t-work-talk', up) + '.</p>';
      ps = (D.prompts || []).filter(function (p) { return p.topic === 't-work-talk'; }); ds = (D.drills || []).filter(function (x) { return x.topic === 't-work-talk'; });
    } else h = '<p>' + T('This week you studied', '这周你学的是') + ' <b>' + topicLink(main, up) + '</b>' + (w.topics.length > 1 ? T(' (also ', '（还有 ') + w.topics.slice(1, 3).map(function (t) { return topicLink(t, up); }).join(', ') + T(')', '）') : '') + '. ' + T('Close the week with these:', '用下面这些收口：') + '</p>';
    h += '<div class="two"><div><h3>🎙 ' + T('Speaking on the same topic', '同主题口语') + '</h3><ul>' + ps.slice(0, 4).map(plink).join('') + '</ul>' +
      (byKp.length ? '<h3>' + T('Prompts whose samples use the points you learned', '示范用到你本周所学知识点的题') + '</h3><ul>' + byKp.map(plink).join('') + '</ul>' : '') + '</div>' +
      '<div><h3>🎧 ' + T('Listening on the same topic', '同主题听力') + '</h3><ul>' + ds.slice(0, 5).map(function (x) { var p = (D.parts || [])[x.part - 1] || {}; return '<li><a href="listening-' + x.part + '.html#d' + x.i + '">' + T('Part ', '第 ') + x.part + T('', ' 部分') + ' · ' + T(EH.esc(p.en || ''), EH.esc(p.zh || '')) + ' · ' + T('drill ', '练习 ') + (x.i + 1) + '</a></li>'; }).join('') +
      (D.lecture && D.lecture.topic === main ? '<li><a href="lecture.html">' + T('Lecture notes training', '讲座笔记训练') + '</a></li>' : '') + '</ul></div></div>';
    h += '<p class="muted">' + T('Your self-ratings and answers here go into the same record as the rest of the site.', '这里的自评与答题和全站其他记录在同一份里。') + '</p>';
    box.innerHTML = h;
  }
  var wb = $('#cp-week'); if (wb) weekPanel(wb);

  /* ---------- 进度页：逐周表、模考、旧站导入 ---------- */
  function weekKey(d) { var p = d.split('-'), x = new Date(+p[0], +p[1] - 1, +p[2]); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return EH.today(x); }
  function weeksTable(box) {
    var W = {}, add = function (d, k, v) { if (!d) return; var w = weekKey(d.slice(0, 10)); W[w] = W[w] || { kp: 0, sp: [], lr: 0, lt: 0, mk: [] }; if (k === 'sp' || k === 'mk') W[w][k].push(v); else W[w][k] += v; };
    Object.keys(S.lessons || {}).forEach(function (id) { var L = S.lessons[id]; if (L.done || (L.steps || {}).learn) add(L.done || L.steps.learn, 'kp', 1); });
    (S.speaks || []).forEach(function (s) { if (s.src === 'celpip') add(s.d, 'sp', s.avg); });
    Object.keys(S.days || {}).forEach(function (d) { var l = S.days[d].listen; if (l) { add(d, 'lr', l.right); add(d, 'lt', l.total); } });
    C().mocks.forEach(function (m) { add(m.d, 'mk', m); });
    var ks = Object.keys(W).sort().reverse().slice(0, 12);
    if (!ks.length) { box.innerHTML = '<p class="muted">' + T('No records yet.', '还没有记录。') + '</p>'; return; }
    var avg = function (a) { return a.length ? (Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length * 10) / 10) : '–'; };
    box.innerHTML = '<table class="vt"><tr><th>' + T('Week of', '周（起）') + '</th><th>' + T('Points learned', '学会的知识点') + '</th><th>' + T('Speaking self-rating', '口语自评') + '</th><th>' + T('Listening right', '听力答对') + '</th><th>' + T('Mock tests', '模考') + '</th></tr>' +
      ks.map(function (k) { var w = W[k]; return '<tr><td>' + k + '</td><td>' + w.kp + '</td><td>' + avg(w.sp) + '</td><td>' + (w.lt ? w.lr + '/' + w.lt : '–') + '</td><td>' + w.mk.map(function (m) { return (m.l ? 'L' + m.l : '') + (m.s ? ' S' + m.s : '') + (m.of ? ' ' + m.total + '/' + m.of : ''); }).join(', ') + '</td></tr>'; }).join('') + '</table>';
  }
  function mocksList(box) {
    var M = C().mocks.slice().reverse();
    box.innerHTML = M.length ? '<table class="vt"><tr><th>' + T('Date', '日期') + '</th><th>' + T('Kind', '类型') + '</th><th>' + T('Listening', '听力') + '</th><th>' + T('Speaking', '口语') + '</th></tr>' + M.map(function (m) { return '<tr><td>' + EH.esc(m.d) + '</td><td>' + EH.esc(m.kind) + '</td><td>' + (m.l || '–') + '</td><td>' + (m.s || (m.of ? m.total + '/' + m.of : '–')) + '</td></tr>'; }).join('') + '</table>' : '<p class="muted">' + T('No mock tests recorded yet.', '还没有模考记录。') + '</p>';
  }
  function oldData() {
    var o = {}; try { o.lq = JSON.parse(localStorage.getItem('celpip.lq') || '{}'); o.mock = JSON.parse(localStorage.getItem('celpip.mock') || '[]'); } catch (e) { o.lq = {}; o.mock = []; }
    return o;
  }
  function importPanel(box) {
    var o = oldData(), nq = Object.keys(o.lq).length, nm = o.mock.length, c = C();
    if (!nq && !nm) { box.innerHTML = '<p class="muted">' + T('No records from the old site in this browser.', '这个浏览器里没有旧站记录。') + '</p>'; return; }
    box.innerHTML = '<p>' + T('Found ' + nq + ' listening answers and ' + nm + ' speaking mocks from the old CELPIP L/S site.', '找到旧思培听说站的 ' + nq + ' 条听力答题和 ' + nm + ' 次口语模考。') + (c.imported ? ' ' + T('Imported on ' + c.imported + '.', '已于 ' + c.imported + ' 导入。') : '') + ' <button id="cp-imp">' + T('Import them', '导入') + '</button></p>';
    $('#cp-imp').onclick = function () {
      for (var k in o.lq) if (!(k in c.lq)) c.lq[k] = o.lq[k];
      var have = {}; c.mocks.forEach(function (m) { have[m.d + m.kind] = 1; });
      o.mock.forEach(function (m) {
        var tot = 0, nt = 0; for (var n in (m.s || {})) { nt++; (m.s[n] || []).forEach(function (x) { tot += +x || 0; }); }
        var r = { d: String(m.d || '').slice(0, 10), kind: 'old-site speaking mock', total: tot, of: nt * 8 };
        if (!have[r.d + r.kind]) c.mocks.push(r);
      });
      c.imported = EH.today(); EH.save(); EH.toast(T('Imported.', '已导入。')); importPanel(box); render();
    };
  }
  function render() { var b; if ((b = $('#cp-weeks'))) weeksTable(b); if ((b = $('#cp-mocks'))) mocksList(b); }
  var ms = $('#mk-save');
  if (ms) {
    $('#mk-d').value = EH.today();
    ms.onclick = function () {
      var l = +$('#mk-l').value || 0, s = +$('#mk-s').value || 0;
      if (!l && !s) { EH.toast(T('Enter at least one level.', '至少填一个级别。')); return; }
      C().mocks.push({ d: $('#mk-d').value || EH.today(), kind: $('#mk-k').value, l: l, s: s }); EH.touch(); EH.save(); render();
    };
    importPanel($('#cp-import')); render();
  }
  window.EH_CELPIP_PROGRESS = function () { // 给进度页（daily-progress 单）的挂接口：逐周数据，与本页表格同一口径
    var o = {}; var box = document.createElement('div'); weeksTable(box); o.html = box.innerHTML; o.mocks = C().mocks.slice(); o.speaks = (S.speaks || []).filter(function (s) { return s.src === 'celpip'; }); return o;
  };
})();
