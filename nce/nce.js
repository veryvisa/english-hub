/* 新概念配套课页：新词加入生词本（与新词学习模块同一 lw:<词id> 卡片前缀，复习页通用）、新词小测与练习（错题进错题本）、
   三步进度（学词 / 小测 / 听写复述）、目录页显示每课进度。纯本地，无网络请求。 */
(function () {
  'use strict';
  var T = EH.T, D = window.NCE_L;
  var STEPS = [['words', 'Words', '学词'], ['check', 'Checks', '小测'], ['dict', 'Dictation and retelling', '听写复述']];
  function key(id) { return 'nce:' + id; }
  function rec(id) { var L = EH.lesson(key(id)); L.steps = L.steps || {}; return L; }

  // 目录页：每课进度
  document.querySelectorAll('tr[data-nce]').forEach(function (tr) {
    var L = EH.state.lessons[key(tr.dataset.nce)], n = L && L.steps ? STEPS.filter(function (s) { return L.steps[s[0]]; }).length : 0;
    tr.querySelector('.nce-st').innerHTML = n === 3 ? '✅' : n ? n + '/3' : '';
  });
  if (!D) return;

  function addWord(w) {
    var card = window.EHCard && EHCard.byId[w.id];
    var ok = EH.addCard({ id: 'lw:' + w.id, kind: 'word', lesson: 'learn', front: w.w, back: w.ex[0] ? w.ex[0].en : (w.coll.join('; ') || w.en || ''),
      extra: { zh: w.zh, ipa: w.ipa, unit: 'New words · ' + D.title, hint: '' } });
    var b = document.querySelector('.nce-add[data-wid="' + w.id + '"]');
    if (b) { b.disabled = true; b.innerHTML = '✓ ' + T('In word book', '已在生词本'); }
    return ok && !card ? true : ok;
  }
  var byId = {}; D.words.forEach(function (w) { byId[w.id] = w; if (EH.state.cards['lw:' + w.id]) { var b = document.querySelector('.nce-add[data-wid="' + w.id + '"]'); if (b) { b.disabled = true; b.innerHTML = '✓ ' + T('In word book', '已在生词本'); } } });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('.nce-add'); if (!b) return;
    addWord(byId[b.dataset.wid]); EH.touch(); EH.save(); EH.toast(T('Added to your word book.', '已加入生词本。'));
  });
  var all = document.getElementById('nce-add-all');
  if (all) all.onclick = function () {
    var n = 0; D.words.forEach(function (w) { n += addWord(w) ? 1 : 0; });
    rec(D.id).steps.words = true; EH.touch(); EH.save(); steps();
    EH.toast(T(n + ' words added to your word book.', '新加入生词本 ' + n + ' 个词。'));
  };

  function steps() {
    var box = document.getElementById('nce-steps'); if (!box) return;
    var L = rec(D.id);
    box.innerHTML = STEPS.map(function (s) { return '<button class="step' + (L.steps[s[0]] ? ' on' : '') + '" data-step="' + s[0] + '">' + (L.steps[s[0]] ? '✓ ' : '') + T(s[1], s[2]) + '</button>'; }).join('<span class="arr">›</span>');
    box.querySelectorAll('.step').forEach(function (b) {
      b.onclick = function () { var L = rec(D.id); L.steps[b.dataset.step] = !L.steps[b.dataset.step]; if (STEPS.every(function (s) { return L.steps[s[0]]; })) L.done = L.done || new Date().toISOString().slice(0, 10); EH.save(); steps(); };
    });
  }
  steps();

  var HAN = /[\u3400-\u9fff]/;
  function quiz(boxId, scoreId, all, step) {
    var box = document.getElementById(boxId); if (!box || !all.length || !window.EHQuiz) return;
    // 选项是中文的题只在中文与双语模式出（选项按钮里没法分语言）
    var list = document.body.dataset.lang === 'en' ? all.filter(function (q) { return !(q.options || []).some(function (o) { return HAN.test(o); }); }) : all;
    EHQuiz.render(box, list, {
      onAnswer: function (res, total) {
        var done = Object.keys(res).length, ok = Object.keys(res).filter(function (k) { return res[k]; }).length;
        document.getElementById(scoreId).innerHTML = ok + ' / ' + done + ' ' + T('right so far', '题答对') + ' (' + total + ')';
        if (done === total && ok / total >= 0.8) { rec(D.id).steps[step] = true; EH.save(); steps(); }
      }
    });
  }
  function quizzes() { quiz('wquiz-box', 'wscore', D.wq, 'check'); quiz('quiz-box', 'score', D.quiz, 'check'); }
  quizzes();
  var lang = document.body.dataset.lang;
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-set-lang]')) return;
    setTimeout(function () { var l = document.body.dataset.lang; if ((l === 'en') !== (lang === 'en')) quizzes(); lang = l; }, 0);
  });
})();
