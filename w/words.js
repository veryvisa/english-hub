/* 词条页：先自测（语境句挖空）→ 看答案 → 把这张挖空卡加入复习。纯本地，进度进 EH.state.cards（与其他复习卡同一份备份）。 */
(function () {
  var W = window.EH_WORD, box = document.getElementById('wp-cloze');
  if (!W || !box || !window.EH) return;
  var T = function (en, zh) { return '<span class="enx">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span>'; };
  var ans = box.querySelector('.wp-ans'), show = document.getElementById('wp-show'), add = document.getElementById('wp-add'), st = document.getElementById('wp-state');
  function paint() {
    var has = !!EH.state.cards[W.id];
    add.disabled = has;
    st.innerHTML = has ? T('In your review deck.', '已在复习卡里。') : '';
  }
  show.onclick = function () { ans.hidden = !ans.hidden; };
  add.onclick = function () {
    EH.addCard({ id: W.id, kind: 'word', lesson: 'w:' + W.band, front: W.front, back: W.back, extra: { zh: W.zh, ipa: W.ipa, unit: 'Word pages', hint: '' } });
    EH.save(); ans.hidden = false; paint();
    if (EH.toast) EH.toast(T('Card added to review.', '已加入复习。'));
  };
  paint();
})();
