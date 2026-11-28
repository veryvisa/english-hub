/* TED 课页：步骤条（学/测/用）、测验计分、词块挖空卡入复习、笔记自动保存、准备倒计时后自动录音、思培四维度自评。纯本地。 */
(function () {
  'use strict';
  var D = window.EH_TED, T = EH.T, S = EH.state;
  if (!D) return;
  function addCards() {
    var n = 0;
    D.cards.forEach(function (c) {
      n += EH.addCard({ id: c.id, kind: c.kind, lesson: D.id, front: c.front, back: c.back_en, extra: { zh: c.back_zh, unit: 'TED: ' + D.title, hint: c.hint } }) ? 1 : 0;
    });
    EH.save(); return n;
  }
  function steps() {
    var box = document.getElementById('steps'), L = EH.lesson(D.id);
    box.innerHTML = EH.STEPS.map(function (s) {
      return '<button class="step' + (L.steps[s[0]] ? ' on' : '') + '" data-step="' + s[0] + '">' + (L.steps[s[0]] ? '✓ ' : '') + T(s[1], s[2]) + '</button>';
    }).join('<span class="arr">›</span>');
    box.querySelectorAll('.step').forEach(function (b) {
      b.onclick = function () {
        var on = !EH.lesson(D.id).steps[b.dataset.step];
        EH.setStep(D.id, b.dataset.step, on);
        if (on && b.dataset.step === 'learn') addCards();
        steps();
      };
    });
  }
  steps();
  document.getElementById('ted-cards').onclick = function () {
    var n = addCards(); EH.setStep(D.id, 'learn', true); steps();
    EH.toast(T(n + ' new cards added.', '新加入 ' + n + ' 张卡。'));
  };
  EHQuiz.render(document.getElementById('quiz-box'), D.quiz, {
    onAnswer: function (res, total) {
      var done = Object.keys(res).length, ok = Object.keys(res).filter(function (k) { return res[k]; }).length;
      document.getElementById('score').innerHTML = ok + ' / ' + done + ' ' + T('right so far', '题答对') + ' (' + total + ')';
      if (done === total) {
        var L = EH.lesson(D.id), pct = Math.round(ok / total * 100);
        L.best = Math.max(L.best || 0, pct);
        if (pct >= 80) EH.setStep(D.id, 'quiz', true); else EH.save();
        steps();
      }
    }
  });
  document.querySelectorAll('.ted-note').forEach(function (t) {
    var k = t.dataset.note; t.value = (S.notes[k] || {}).text || '';
    t.oninput = function () { S.notes[k] = { text: t.value, t: new Date().toISOString() }; EH.save(); };
  });
  /* 准备倒计时 → 自动开始录音（录音器在 app.js：点 .rec 即录，到时自停并回放） */
  document.querySelectorAll('.ted-go').forEach(function (b) {
    b.onclick = function () {
      var box = b.parentNode, clock = box.querySelector('.ted-clock'), rec = box.querySelector('.rec'), left = +b.dataset.prep;
      b.disabled = true;
      var tick = function () {
        if (left > 0) { clock.textContent = T('Prepare: ', '准备：') + left + ' s'; left--; setTimeout(tick, 1000); return; }
        clock.innerHTML = '● ' + T('Recording… speak now (' + rec.dataset.max + ' s)', '录音中……开始说（' + rec.dataset.max + ' 秒）');
        rec.click();
        setTimeout(function () { clock.textContent = T('Done. Listen back, then rate yourself below.', '完成。回放一遍，再在下面自评。'); b.disabled = false; }, 1000 * rec.dataset.max + 300);
      };
      tick();
    };
  });
  document.getElementById('ted-save').onclick = function () {
    var sc = {}, sum = 0, n = 0;
    document.querySelectorAll('select[data-dim]').forEach(function (x) { if (x.value) { sc[x.dataset.dim] = +x.value; sum += +x.value; n++; } });
    if (n < 4) { EH.toast(T('Rate all four dimensions.', '四个维度都要评。')); return; }
    var avg = Math.round(sum / n * 10) / 10;
    S.days = S.days || {}; S.speaks = S.speaks || [];
    var d = S.days[EH.today()] || (S.days[EH.today()] = {});
    d.speak = { topic: D.id, scores: sc, avg: avg, used: 0 };
    S.speaks.push({ d: EH.today(), topic: D.id, avg: avg, used: 0, scores: sc });
    EH.setStep(D.id, 'use', true); steps();
    document.getElementById('ted-avg').innerHTML = T('Saved. Average ', '已保存。平均 ') + avg;
  };
})();
