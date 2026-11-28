/* 句式健身房 · 页面脚本。纯本地，零网络。
   判分：规范化（小写、去标点、展开否定与常见缩写，规则表 EH_GYM.contractions 与 build.py::norm 同源）后与全部可接受答案比对；
   一致＝对；不一致或标了自判的题＝列出全部可接受答案，由本人自判。
   存储只用已有的键：作答 EH.state.notes['gym:<结构 id>'] = { t: ISO 时间, done: {题号: 1 对 / 0 错}, text: {题号: 作答} }；
   错题 EH.wrongAdd（id gym:<结构>:<题号>，题面在 data/gym.js 并进 EH_QUIZ）；一种结构第一次做对 → 加复习卡 gym:<结构>（进度页把当天新加的卡算作新知识点）。 */
(function () {
  'use strict';
  var G = window.EH_GYM;
  if (!document.getElementById('gy-root') || !window.EH || !G) return;
  var T = EH.T, S = EH.state, esc = EH.esc;
  S.notes = S.notes || {};
  var rules = G.contractions.map(function (r) { return [new RegExp(r[0], 'g'), r[1]]; });
  function norm(s) {
    s = String(s || '').toLowerCase().replace(/[’‘]/g, "'");
    rules.forEach(function (r) { s = s.replace(r[0], r[1]); });
    return s.replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var Q = {}, byS = {};
  G.structs.forEach(function (s) { byS[s.id] = s; s.drills.forEach(function (d, i) { d.n = i + 1; d.s_id = s.id; Q[d.id] = d; }); });
  function note(sid) { return S.notes['gym:' + sid] || (S.notes['gym:' + sid] = { t: '', done: {}, text: {} }); }
  function prog() {
    G.structs.forEach(function (s) {
      var n = S.notes['gym:' + s.id], ok = 0;
      if (n) for (var k in n.done) if (n.done[k]) ok++;
      var lab = ok + '/' + s.drills.length;
      document.querySelectorAll('[data-s="' + s.id + '"]').forEach(function (el) {
        el.innerHTML = el.classList.contains('gy-prog') ? '✅ ' + lab + ' ' + T('right', '做对') : lab;
      });
    });
  }
  function addCard(sid) {
    var c = G.cards['gym:' + sid]; if (!c) return false;
    return EH.addCard(JSON.parse(JSON.stringify(c)));
  }
  function finish(li, d, ok, given) {
    var n = note(d.s_id);
    n.done[d.n] = ok ? 1 : 0; n.text[d.n] = given; n.t = new Date().toISOString();
    li.classList.remove('ok', 'bad'); li.classList.add(ok ? 'ok' : 'bad');
    li.querySelector('.gy-st').innerHTML = ok ? '✅ ' + T('Right', '对了') : '❌ ' + T('Into the mistake book', '已进错题本');
    if (ok) {
      EH.wrongClear(d.id);
      if (addCard(d.s_id)) EH.toast(T('New point today: this structure is now a review card.', '今天的新知识点：这种结构已加入复习卡。'));
      EH.touch(); EH.save();
    } else EH.wrongAdd({ id: d.id, lesson: 'tool:gym', kind: 'rewrite', q: d.p, answer: d.a[0], given: given });
    prog();
  }
  function all(d) { return '<ul>' + d.a.map(function (a) { return '<li class="en">' + esc(a) + '</li>'; }).join('') + '</ul>'; }
  document.querySelectorAll('.gy-d').forEach(function (li) {
    var d = Q[li.dataset.q]; if (!d) return;
    var ta = li.querySelector('textarea'), fb = li.querySelector('.gy-fb'), n = S.notes['gym:' + d.s_id];
    if (n && n.text && n.text[d.n]) { ta.value = n.text[d.n]; if (d.n in n.done) li.classList.add(n.done[d.n] ? 'ok' : 'bad'); }
    li.querySelector('.gy-chk').onclick = function () {
      var g = ta.value.trim(); if (!g) { ta.focus(); return; }
      var hit = d.a.map(norm).indexOf(norm(g)) >= 0;
      fb.hidden = false;
      var ex = '<div class="ex">' + T(esc(d.x[0]), esc(d.x[1])) + '</div>';
      if (hit && !d.s) { fb.innerHTML = '✅ ' + T('Accepted answers:', '可接受的答案：') + all(d) + ex; return finish(li, d, true, g); }
      fb.innerHTML = (hit ? '' : '🤔 ' + T('Not one of the answers we listed. Compare:', '和我们列出的答案不一致，请对照：')) + (hit ? T('Model answers:', '参考答案：') : '') + all(d) + ex +
        '<p class="self">' + T('Then decide:', '对照后自判：') + ' <button class="me-ok">' + T('Mine works', '我答对了') + '</button> <button class="me-bad">' + T('Mine is wrong', '我答错了') + '</button></p>';
      fb.querySelector('.me-ok').onclick = function () { finish(li, d, true, g); fb.querySelector('.self').remove(); };
      fb.querySelector('.me-bad').onclick = function () { finish(li, d, false, g); fb.querySelector('.self').remove(); };
    };
  });
  function openHash() {
    var a = location.hash && document.getElementById(location.hash.slice(1));
    if (a && a.classList.contains('gy')) { a.querySelector('details').open = true; a.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openHash);
  prog(); openHash();
})();
