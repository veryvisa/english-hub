/* 华人错误雷达 · 页面脚本。纯本地：进度存 EH.state.radar = { r: {题 id: 1 对 / 0 错（最近一次）}, done: {难点 id: 第一次达到 80% 的日期} }。
   某条难点答过 ≥3/4 的题且正确率 ≥80%（第一次）→ 把它的「错句 → 改法」与本人答错过的找错/改写题加进复习卡。答错的题由 quiz.js 写进错题本。 */
(function () {
  'use strict';
  var R = window.EH_RADAR, Q = window.EH_QUIZ || {}, T = EH.T, E = EH.esc, S = EH.state;
  if (!R || !document.getElementById('rd-root')) return;
  var st = S.radar || (S.radar = {});
  st.r = st.r || {}; st.done = st.done || {};
  var root = document.body.dataset.root || '../';
  var byId = {}; R.pains.forEach(function (p) { byId[p.id] = p; });
  var NAMES = { P: ['Pronunciation', '语音'], G: ['Grammar', '语法'], V: ['Vocabulary', '词汇'] };

  function stat(p) {
    var n = 0, ok = 0;
    p.q.forEach(function (id) { if (id in st.r) { n++; ok += st.r[id]; } });
    return { n: n, ok: ok, total: p.q.length, rate: n ? ok / n : 0 };
  }
  function pct(x) { return Math.round(x * 100) + '%'; }

  function chart(kind) {
    var ps = R.pains.filter(function (p) { return p.kind === kind; }), N = ps.length, c = 160, rad = 112;
    var pt = function (i, v) { var a = -Math.PI / 2 + 2 * Math.PI * i / N; return [c + Math.cos(a) * rad * v, c + Math.sin(a) * rad * v]; };
    var poly = function (vals) { return vals.map(function (v, i) { var p = pt(i, v); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); };
    var s = '<svg viewBox="0 0 320 320" role="img" aria-label="' + NAMES[kind][0] + ' radar">';
    [0.25, 0.5, 0.75, 1].forEach(function (r) { s += '<polygon class="ring" points="' + poly(ps.map(function () { return r; })) + '"/>'; });
    ps.forEach(function (p, i) { var e = pt(i, 1); s += '<line class="ax" x1="' + c + '" y1="' + c + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '"/>'; });
    var vals = ps.map(function (p) { return stat(p).rate; });
    s += '<polygon class="area" points="' + poly(vals.map(function (v) { return Math.max(v, 0.02); })) + '"/>';
    ps.forEach(function (p, i) {
      var x = stat(p), l = pt(i, 1.16), tip = p.en + (x.n ? ' · ' + x.ok + '/' + x.n + ' (' + pct(x.rate) + ')' : ' · not tried yet');
      s += '<a href="#' + p.id + '"><title>' + E(tip) + '</title><text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 4).toFixed(1) + '" text-anchor="middle"' + (x.n ? '' : ' class="none"') + '>' + p.id + '</text></a>';
    });
    return '<div class="rd-chart" data-kind="' + kind + '"><b>' + T(NAMES[kind][0], NAMES[kind][1]) + '</b>' + s + '</svg></div>';
  }

  function unitLinks(p) {
    if (!p.units.length) return '<a href="' + root + 'pains.html#' + p.id + '">' + T('See the hard-spot list', '看难点清单') + '</a>';
    return p.units.slice(0, 3).map(function (u) { return '<a class="chip" href="' + root + 'u/' + u.id + '.html"><span class="en">' + E(u.en) + '</span> <span class="zh" lang="zh-Hans">' + E(u.zh) + '</span></a>'; }).join(' ');
  }
  function weak() {
    var tried = R.pains.filter(function (p) { return stat(p).n >= 3; }).sort(function (a, b) { return stat(a).rate - stat(b).rate || stat(b).n - stat(a).n; });
    var box = document.getElementById('rd-weak'), top = tried.slice(0, 3);
    if (!top.length) {
      box.innerHTML = '<li class="muted">' + T('Answer at least three questions on a hard spot and it can show up here. A good first round: G02, G13 and V01.', '某条难点答满三题就会进入排名。第一轮可以从 G02、G13、V01 开始。') + '</li>';
      return;
    }
    box.innerHTML = top.map(function (p) {
      var x = stat(p);
      return '<li><b>' + p.id + '</b> ' + T(E(p.en), E(p.zh)) + ' <span class="muted">' + x.ok + '/' + x.n + ' · ' + pct(x.rate) + '</span><br>📘 ' + T('Go and learn:', '去学这个单元：') + ' ' + unitLinks(p) +
        ' · <a href="#' + p.id + '">🎯 ' + T('practise again', '再练一遍') + '</a></li>';
    }).join('') + (top.length < 3 ? '<li class="muted">' + T('Try more hard spots to complete the ranking.', '多练几条难点，排名才完整。') + '</li>' : '');
  }
  function paint() {
    document.getElementById('rd-charts').innerHTML = R.kinds.map(chart).join('');
    weak();
    document.querySelectorAll('[data-stat]').forEach(function (el) {
      var p = byId[el.dataset.stat], x = stat(p);
      el.innerHTML = x.n ? x.n + '/' + x.total + ' ' + T('done', '已做') + ' · ' + pct(x.rate) + (st.done[p.id] ? ' ✓' : '') : T('not tried yet', '还没练');
    });
  }

  function cards(p) {
    var n = 0;
    n += EH.addCard({ id: 'radar:' + p.id, kind: 'fix', lesson: 'radar:' + p.id, front: '✗ ' + p.wrong, back: '✓ ' + p.right, extra: { zh: p.zh, unit: 'Hard spot ' + p.id + ' · ' + p.en } }) ? 1 : 0;
    p.q.forEach(function (id) {
      var q = Q[id];
      if (q && q.fix && S.wrong[id]) n += EH.addCard({ id: id, kind: 'fix', lesson: 'radar:' + p.id, front: '✗ ' + q.fix[0], back: '✓ ' + q.fix[1], extra: { zh: p.zh, unit: 'Hard spot ' + p.id + ' · ' + p.en } }) ? 1 : 0;
    });
    return n;
  }
  function record(res) {
    for (var k in res) st.r[k] = res[k] ? 1 : 0;
    var added = 0, hit = [];
    R.pains.forEach(function (p) {
      var x = stat(p);
      if (!st.done[p.id] && x.n >= Math.ceil(x.total * 0.75) && x.rate >= 0.8) { st.done[p.id] = EH.today(); added += cards(p); hit.push(p.id); }
    });
    EH.save(); paint();
    if (hit.length) EH.toast('🎉 ' + hit.join(', ') + ' ≥80% · ' + T(added + ' cards added to review.', '已加入 ' + added + ' 张复习卡。'));
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]'); if (!b) return;
    var p = byId[b.dataset.go], box = document.querySelector('[data-quiz="' + p.id + '"]');
    var ids = b.dataset.only ? p.q.filter(function (id) { return st.r[id] === 0 || (S.wrong[id] && !S.wrong[id].cleared); }) : p.q;
    if (!ids.length) { EH.toast(T('Nothing missed here yet.', '这一条还没有答错的题。')); return; }
    EHQuiz.render(box, ids.map(function (id) { return Q[id]; }).filter(Boolean), { retry: true, clearOnRight: true, onAnswer: record });
    box.scrollIntoView({ block: 'nearest' });
  });

  function missedPanel() { // 每次打开「这里答错的」都按当前错题本重画
    var mb = document.getElementById('rd-missed-box');
    var missed = Object.keys(S.wrong).filter(function (k) { return k.indexOf('radar:') === 0 && !S.wrong[k].cleared && Q[k]; });
    if (missed.length) EHQuiz.render(mb, missed.map(function (k) { return Q[k]; }), { showUnit: true, retry: true, clearOnRight: true, onAnswer: record });
    else mb.innerHTML = '<p class="muted">' + T('Nothing here yet.', '暂时没有。') + '</p>';
  }
  document.addEventListener('click', function (e) { var t = e.target.closest('[data-tab="rd-missed"]'); if (t) missedPanel(); });
  var sel = document.querySelector('.pn-select');
  if (sel) sel.addEventListener('change', function () { if (sel.value === 'rd-missed') missedPanel(); });
  window.addEventListener('hashchange', function () { if (location.hash === '#rd-missed') missedPanel(); });
  missedPanel();
  paint();
})();
