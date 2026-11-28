/* 说法升级梯 · 页面脚本。纯本地：练习存进已有的 notes 键：EH.state.notes['ladder:<梯子 id>'] = { text: 自己的改写, t: ISO 时间, ok: 1 达到 / 0 还没有 }
   （不新增顶层存储键；备份「合并导入」按 t 合并 notes）。
   筛选：搜索框、功能键、主题下拉（?topic=<主题 id> 进来时自动选中）；地址带 #<梯子 id> 时展开那一架。加入复习：EH.addCard（语境句挖空）。 */
(function () {
  'use strict';
  var root = document.getElementById('ld-root');
  if (!root || !window.EH || !window.EH_LADDER_CARDS) return;
  var T = EH.T, S = EH.state;
  S.notes = S.notes || {};
  var q = document.getElementById('ld-q'), sel = document.getElementById('ld-topic'), count = document.getElementById('ld-count');
  var note = document.getElementById('ld-topic-note'), items = Array.prototype.slice.call(document.querySelectorAll('article.ld'));
  var func = '', names = (window.EH_LADDER || {}).names || {};
  var m = /[?&]topic=([\w-]+)/.exec(location.search);
  if (m && sel.querySelector('option[value="' + m[1] + '"]')) sel.value = m[1];

  function apply() {
    var v = q.value.trim().toLowerCase(), t = sel.value, n = 0;
    items.forEach(function (a) {
      var ok = (!func || a.dataset.func === func) && (!t || (',' + a.dataset.topics + ',').indexOf(',' + t + ',') >= 0) && (!v || a.dataset.q.indexOf(v) >= 0);
      a.hidden = !ok; if (ok) n++;
    });
    count.innerHTML = n + ' ' + T('ladders', '架');
    if (t && names[t]) {
      note.hidden = false;
      note.innerHTML = T('Ladders for the plain words used most in the “' + EH.esc(names[t].en) + '” texts, plus the ones written for this topic.',
        '「' + EH.esc(names[t].zh) + '」主题文章里最常用的大白话，加上为这个主题写的梯子。');
    } else note.hidden = true;
    var shown = items.filter(function (a) { return !a.hidden; });
    if (v && shown.length <= 3) shown.forEach(function (a) { a.querySelector('details').open = true; });
  }
  q.oninput = apply; sel.onchange = apply;
  document.querySelectorAll('.ld-f').forEach(function (b) {
    b.onclick = function () {
      func = b.dataset.f;
      document.querySelectorAll('.ld-f').forEach(function (x) { x.classList.toggle('on', x === b); });
      apply();
    };
  });
  function openHash() {
    var h = location.hash.slice(1).replace(/-\d+$/, ''), a = h && document.getElementById(h);
    if (a && a.classList.contains('ld')) { a.hidden = false; a.querySelector('details').open = true; a.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openHash);

  /* 加入复习卡 */
  document.querySelectorAll('.ld-add').forEach(function (b) {
    var id = b.dataset.card;
    if (S.cards[id]) b.classList.add('done');
    b.onclick = function (e) {
      e.preventDefault();
      var c = JSON.parse(JSON.stringify(EH_LADDER_CARDS[id]));
      var added = EH.addCard(c); EH.save();
      b.classList.add('done');
      EH.toast(added ? T('Added to your review cards.', '已加入复习卡。') : T('Already in your review cards.', '复习卡里已经有了。'));
    };
  });

  /* 升级练习：写 → 看参考 → 自判 */
  document.querySelectorAll('.ld-prac').forEach(function (p) {
    var id = p.dataset.prac, key = 'ladder:' + id, ref = p.querySelector('.ld-ref'), stEl = p.querySelector('.ld-st'), ta = p.querySelector('textarea');
    var paint = function () {
      var n = S.notes[key];
      stEl.innerHTML = n && 'ok' in n ? (n.ok ? '✅ ' + T('done', '已达到') : '🔁 ' + T('try again later', '回头再练')) + ' · ' + String(n.t).slice(0, 10) : '';
    };
    if (S.notes[key] && S.notes[key].text) ta.value = S.notes[key].text;
    p.querySelector('.ld-show').onclick = function () { ref.hidden = false; this.hidden = true; };
    p.querySelectorAll('[data-self]').forEach(function (b) {
      b.onclick = function () { S.notes[key] = { text: ta.value, t: new Date().toISOString(), ok: +b.dataset.self }; EH.save(); paint(); };
    });
    paint();
  });
  apply(); openHash();
})();
