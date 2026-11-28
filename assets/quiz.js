/* 题目渲染与即时判分。题型：mc 选择 / fill 填空 / rewrite 改写 / tr 翻译。客观题机判；改写与翻译先比参考答案，
   不一致时给参考答案让本人自判，错的进错题本。界面字一律走 EH.T（三语模式）。 */
(function () {
  'use strict';
  var E = EH.esc, T = EH.T;
  var TYPE = { mc: T('Choose', '选择'), fill: T('Fill in', '填空'), rewrite: T('Rewrite', '改写'), tr: T('Translate', '翻译') };
  function answers(q) { return String(q.answer).split(' / ').map(EH.norm).filter(Boolean); }
  function render(container, list, opts) {
    opts = opts || {};
    var results = {};
    container.innerHTML = '';
    list.forEach(function (q, i) {
      var el = document.createElement('div');
      el.className = 'q'; el.dataset.qid = q.id;
      var head = '<div class="q-h"><span class="tag">' + (TYPE[q.type] || q.type) + '</span> <b>' + (i + 1) + '.</b> ' +
        (opts.showUnit && q.unitTitle ? '<span class="muted">[' + E(q.unitTitle) + ']</span> ' : '') + '<span class="q-text en">' + q.q + '</span></div>';
      var body;
      if (q.type === 'mc') {
        body = '<div class="opts">' + q.options.map(function (o, k) { return '<button class="opt en" data-k="' + k + '">' + 'ABCDEF'[k] + '. ' + (q.optionsHtml ? q.optionsHtml[k] : E(o)) + '</button>'; }).join('') + '</div>';
      } else if (q.type === 'fill') {
        body = '<input class="ans" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="chk">' + T('Check', '核对') + '</button>';
      } else {
        body = '<textarea rows="2" class="ans"></textarea><button class="chk">' + T('Check', '核对') + '</button>';
      }
      el.innerHTML = head + body + '<div class="fb" hidden></div>';
      container.appendChild(el);
      var fb = el.querySelector('.fb');
      function finish(ok, given, msg) {
        results[q.id] = ok;
        el.classList.remove('ok', 'bad'); el.classList.add(ok ? 'ok' : 'bad');
        fb.hidden = false;
        fb.innerHTML = (ok ? '✅ ' + T('Right.', '对了。') : '❌ ' + T('Not quite.', '再想想。')) + (msg || '') + '<div class="ex">' + q.explain + '</div>';
        if (!ok) EH.wrongAdd({ id: q.id, lesson: q.unit, given: given });
        else if (opts.clearOnRight) EH.wrongClear(q.id);
        if (opts.onAnswer) opts.onAnswer(results, list.length);
      }
      var ref = ' ' + T('Answer:', '答案：') + ' <b class="en">' + E(String(q.answer)) + '</b>';
      if (q.type === 'mc') {
        el.querySelectorAll('.opt').forEach(function (b) {
          b.onclick = function () {
            if (q.id in results && !opts.retry) return;
            var k = +b.dataset.k;
            el.querySelectorAll('.opt').forEach(function (x) { x.classList.remove('pick', 'right'); });
            b.classList.add('pick'); el.querySelectorAll('.opt')[q.answer].classList.add('right');
            finish(k === q.answer, q.options[k], '');
          };
        });
      } else {
        var inp = el.querySelector('.ans');
        var check = function () {
          var g = inp.value.trim(); if (!g) { inp.focus(); return; }
          var same = answers(q).indexOf(EH.norm(g)) >= 0;
          if (q.type === 'fill' || same) return finish(same, g, same ? '' : ref);
          fb.hidden = false;
          fb.innerHTML = T('Model answer:', '参考答案：') + ' <i class="en">' + E(q.answer) + '</i><div class="ex">' + q.explain + '</div>' +
            '<div class="self">' + T('Compare, then decide:', '对照后自判：') + ' <button class="me-ok">' + T('Mine works', '我答对了') + '</button> <button class="me-bad">' + T('Mine is wrong', '我答错了') + '</button></div>';
          fb.querySelector('.me-ok').onclick = function () { finish(true, g, ref); };
          fb.querySelector('.me-bad').onclick = function () { finish(false, g, ref); };
        };
        el.querySelector('.chk').onclick = check;
        if (inp.tagName === 'INPUT') inp.onkeydown = function (e) { if (e.key === 'Enter') check(); };
      }
    });
    return results;
  }
  window.EHQuiz = { render: render };
})();
