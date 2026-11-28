/* 单元页：步骤条、测验计分、卡片入队、听辨、整篇朗读、笔记自动保存。 */
(function () {
  'use strict';
  var U = window.EH_UNIT, T = EH.T, S = EH.state;
  function addCards() {
    var n = 0;
    U.cards.forEach(function (c) {
      n += EH.addCard({ id: c.id, kind: c.kind, lesson: U.id, front: c.front, back: c.back_en, extra: { zh: c.back_zh, ipa: c.ipa || '', unit: U.en, hint: c.hint || '' } }) ? 1 : 0;
    });
    EH.save(); return n;
  }
  function steps() {
    var box = document.getElementById('steps'), L = EH.lesson(U.id);
    box.innerHTML = EH.STEPS.map(function (s) {
      return '<button class="step' + (L.steps[s[0]] ? ' on' : '') + '" data-step="' + s[0] + '">' + (L.steps[s[0]] ? '✓ ' : '') + T(s[1], s[2]) + '</button>';
    }).join('<span class="arr">›</span>') + ' <button class="small" id="add-cards">＋ ' + T(U.cards.length + ' cards to review', U.cards.length + ' 张卡加入复习') + '</button>';
    box.querySelectorAll('.step').forEach(function (b) {
      b.onclick = function () {
        var on = !EH.lesson(U.id).steps[b.dataset.step];
        EH.setStep(U.id, b.dataset.step, on);
        if (on && b.dataset.step === 'learn') addCards();
        steps();
      };
    });
    document.getElementById('add-cards').onclick = function () { var n = addCards(); EH.toast(T(n + ' new cards added.', '新加入 ' + n + ' 张卡。')); };
  }
  steps();

  EHQuiz.render(document.getElementById('quiz-box'), U.quiz, {
    onAnswer: function (res, total) {
      var done = Object.keys(res).length, ok = Object.keys(res).filter(function (k) { return res[k]; }).length;
      document.getElementById('score').innerHTML = ok + ' / ' + done + ' ' + T('right so far', '题答对') + ' (' + total + ')';
      if (done === total) {
        var L = EH.lesson(U.id), pct = Math.round(ok / total * 100);
        L.best = Math.max(L.best || 0, pct);
        if (pct >= 80) { EH.setStep(U.id, 'quiz', true); addCards(); } else EH.save();
        steps();
      }
    }
  });

  /* 听辨：设备语音读一组里的一个词 */
  var pb = document.getElementById('pairs');
  if (pb && U.pairs.length) {
    var right = 0, seen = 0;
    U.pairs.forEach(function (p) {
      var pick = Math.random() < 0.5 ? 0 : 1, row = document.createElement('div');
      row.className = 'pair';
      row.innerHTML = '<button class="say">🔊</button> <button class="opt en">' + EH.esc(p[0]) + '</button> <button class="opt en">' + EH.esc(p[1]) + '</button> <span class="res"></span>';
      row.querySelector('.say').onclick = function (e) { e.stopPropagation(); EH.speak(p[pick], 0.85); };
      row.querySelectorAll('.opt').forEach(function (b, k) {
        b.onclick = function () {
          if (row.dataset.done) return; row.dataset.done = 1; seen++;
          row.querySelectorAll('.opt')[pick].classList.add('right');
          if (k === pick) right++; else b.classList.add('pick');
          row.querySelector('.res').textContent = (k === pick ? '✅' : '❌') + ' ' + right + '/' + seen;
        };
      });
      pb.appendChild(row);
    });
  }

  /* 整篇朗读（逐段）与隐藏译文 */
  var ra = document.getElementById('read-all');
  if (ra) {
    var ps = [].slice.call(document.querySelectorAll('#text .tp')), cur = -1;
    var next = function () {
      if (cur >= 0) ps[cur].classList.remove('cur');
      cur++; if (cur >= ps.length) { cur = -1; EH.speak.onend = null; return; }
      ps[cur].classList.add('cur'); EH.speak(ps[cur].querySelector('.say').dataset.say, 0.9);
    };
    ra.onclick = function () { cur = -1; EH.speak.onend = next; next(); };
    document.getElementById('stop-all').onclick = function () { EH.speak.onend = null; speechSynthesis.cancel(); if (cur >= 0) ps[cur].classList.remove('cur'); cur = -1; };
    document.getElementById('hide-tr').onchange = function (e) { document.getElementById('text').classList.toggle('hide-tr', e.target.checked); };
  }

  /* 语法页「先看对比」：注解先收着，自己判断后再点开 */
  document.querySelectorAll('.ct-btn').forEach(function (b) {
    b.onclick = function () {
      var g = b.parentNode.previousElementSibling, o = g.classList.toggle('open');
      b.setAttribute('aria-expanded', o ? 'true' : 'false');
      b.innerHTML = (o ? '🙈 ' + T('Hide the notes', '收起注解') : '💡 ' + T('Show what each one signals', '看每句传达了什么'));
    };
  });

  /* 词汇页「先看语境句猜义」：自己想完再揭 */
  document.querySelectorAll('.gs-b').forEach(function (b) {
    b.onclick = function () {
      var a = b.nextElementSibling, on = a.hidden;
      a.hidden = !on; b.setAttribute('aria-expanded', on ? 'true' : 'false');
      b.innerHTML = on ? '🙈 ' + T('Hide it again', '再遮回去') : '💡 ' + T('What does it mean here?', '看它在这里是什么意思');
    };
  });

  /* 词汇页「搭配图汇总」：点搭配词听整个短语；遮住回想（弹窗里那张由 wordcard.js 管） */
  document.addEventListener('click', function (ev) {
    var i = ev.target.closest('.cmg .cm-i');
    if (i) { i.classList.add('seen'); return EH.speak(i.dataset.say, 0.9); }
    var r = ev.target.closest('.cmg .cm-recall');
    if (r) {
      var m = r.closest('.cmg').querySelector('.cmap'), on = m.classList.toggle('recall');
      r.setAttribute('aria-pressed', on ? 'true' : 'false');
      m.querySelectorAll('.cm-i').forEach(function (x) { x.classList.remove('seen'); });
    }
  });

  /* 输出题笔记 */
  document.querySelectorAll('.note-box').forEach(function (t) {
    var k = t.dataset.note; t.value = (S.notes[k] || {}).text || '';
    t.oninput = function () {
      S.notes[k] = { text: t.value, t: new Date().toISOString() };
      if (t.value.trim().length > 40) EH.setStep(U.id, 'use', true); else EH.save();
    };
    t.onblur = steps;
  });
})();
