/* 窄听页：单篇播放、整个主题连着放。音频取不到时提示去文章页用设备语音听。 */
(function () {
  'use strict';
  var au = document.getElementById('lt-audio'), now = document.getElementById('lt-now'), T = EH.T, q = [], at = -1, t0 = 0;
  var S = EH.state.listen || (EH.state.listen = { secs: 0, days: {}, texts: {} });
  function paint() {
    document.querySelectorAll('.lt-play').forEach(function (b) { var on = b === q[at] && !au.paused; b.textContent = on ? '⏸' : '▶'; b.parentNode.classList.toggle('cur', b === q[at]); });
  }
  function count() { if (t0) { var s = (performance.now() - t0) / 1000; t0 = 0; S.secs += s; var d = EH.today(); S.days[d] = (S.days[d] || 0) + s; EH.save(); } }
  function go(i) {
    count(); at = i; var b = q[at];
    if (!b) { q = []; at = -1; return paint(); }
    now.hidden = true;
    au.src = location.protocol === 'file:' ? '../build/media/' + b.dataset.local : b.dataset.nSrc;
    var p = au.play(); if (p && p.catch) p.catch(function () {}); paint();
  }
  au.onplay = function () { t0 = performance.now(); paint(); };
  au.onpause = function () { count(); paint(); };
  au.onended = function () { go(at + 1); };
  au.onerror = function () {
    if (at < 0) return;
    now.hidden = false; now.innerHTML = '⚠️ ' + T('This recording cannot be reached right now. Open the text: its player reads it with your device voice.', '这条录音现在取不到。打开文章页，播放器会用你的设备语音朗读。'); q = []; at = -1; paint();
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.lt-play'), all = e.target.closest('.lt-all');
    if (b) { if (b === q[at]) { if (au.paused) au.play(); else au.pause(); return; } q = [b]; go(0); }
    if (all) { q = [].slice.call(all.closest('.lt').querySelectorAll('.lt-list .lt-play')); go(0); }
  });
})();
