/* 文章页播放器：逐句高亮、单句循环、变速、慢读版、听写判分、跟读录音对比。有朗读文件就放文件，取不到就用设备语音逐句读并标明。
   录音只在内存里，不上传、不保存。听的时长与听写成绩记在本机进度 EH.state.listen。 */
(function () {
  'use strict';
  var D = window.EH_LISTEN, box = document.getElementById('ls'), text = document.getElementById('text');
  if (!D || !box || !text) return;
  var T = EH.T, $ = function (i) { return document.getElementById(i); };
  var au = $('ls-audio'), spans = [].slice.call(text.querySelectorAll('.ls')), N = D.s.length;
  var cur = -1, playing = false, loop = false, single = null, stopAt = -1, rate = 1, trk = 'n', dead = !D.n, mode = 'read', token = 0, raf = 0, lastT = 0;
  var S = EH.state.listen || (EH.state.listen = { secs: 0, days: {}, texts: {} });
  var rec = S.texts[D.id] || (S.texts[D.id] = { dict: {} });

  /* ---------- 播放 ---------- */
  function src() {
    var f = D[trk] ? D[trk].file : '';
    return location.protocol === 'file:' ? '../../build/media/' + D.repo + '/' + f : au.getAttribute('data-' + (trk === 'slow' ? 's' : 'n') + '-src');
  }
  function segs() { return (D[trk] || D.n).segs; }
  function voice() {
    $('ls-voice').innerHTML = dead ? '🤖 ' + T('Machine reading by your device voice', '机器朗读（你的设备语音）') : '🎧 ' + T('AI voice, British English', 'AI 合成音，英式');
    $('ls-voice').dataset.kind = dead ? 'device' : 'file';
    $('ls-slowbox').hidden = dead || !D.slow;
  }
  function ready(cb) {
    if (au.dataset.trk === trk && au.readyState >= 1) return cb();
    var my = token, done = false, timer;
    function ok() { if (done) return; done = true; clearTimeout(timer); off(); if (my === token) cb(); }
    function bad() { if (done) return; done = true; clearTimeout(timer); off(); dead = true; voice(); if (my === token) cb(); }
    function off() { au.removeEventListener('loadedmetadata', ok); au.removeEventListener('error', bad); }
    au.addEventListener('loadedmetadata', ok); au.addEventListener('error', bad);
    au.dataset.trk = trk; au.src = src(); au.preload = 'auto'; au.load();
    timer = setTimeout(bad, 8000);
  }
  function mark(i) {
    if (cur >= 0 && spans[cur]) spans[cur].classList.remove('cur');
    cur = i;
    if (i >= 0 && spans[i]) {
      spans[i].classList.add('cur');
      var r = spans[i].getBoundingClientRect();
      if (mode === 'read' && (r.top < 60 || r.bottom > innerHeight - 40)) spans[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    $('ls-pos').textContent = (i + 1) + ' / ' + N;
  }
  function btn() { $('ls-play').innerHTML = playing ? '⏸ ' + T('Pause', '暂停') : '▶ ' + T('Play', '播放'); }
  function halt() {
    token++; playing = false; cancelAnimationFrame(raf); au.pause(); EH.speak.onend = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    EH.save(); btn();
  }
  function count(sec) { if (sec > 0 && sec < 60) { S.secs += sec; var d = EH.today(); S.days[d] = (S.days[d] || 0) + sec; } }
  /* play(i, {one:只放这一句, to:放到第几句为止, end:回调}) */
  function play(i, o) {
    o = o || {}; halt();
    if (i < 0 || i >= N) i = 0;
    single = !!o.one; stopAt = o.to == null ? -1 : o.to; playing = true; btn(); mark(i);
    var my = token;
    if (dead) return say(i, my, o);
    ready(function () {
      if (my !== token) return;
      if (dead) return say(i, my, o);
      au.playbackRate = rate; au.currentTime = Math.max(0, segs()[i][0] - 0.03);
      var p = au.play();
      if (p && p.catch) p.catch(function (e) { if (my === token && e.name !== 'AbortError') { if (e.name === 'NotAllowedError') return halt(); dead = true; voice(); say(cur, my, o); } });
      lastT = performance.now(); raf = requestAnimationFrame(function tick(now) {
        if (my !== token) return;
        if (!au.paused) count((now - lastT) / 1000);
        lastT = now;
        var g = segs(), t = au.currentTime, e = g[cur][1] + 0.04, last = cur === N - 1;
        if (t >= e || au.ended) {
          if (loop && mode !== 'dict') { au.currentTime = Math.max(0, g[cur][0] - 0.03); if (au.ended || au.paused) au.play(); }
          else if (single || cur === stopAt || last) { if (last && !single) rec.plays = (rec.plays || 0) + 1; halt(); if (o.end) o.end(); return; }
          else if (t >= g[cur + 1][0] - 0.03) mark(cur + 1);
        }
        raf = requestAnimationFrame(tick);
      });
    });
  }
  function say(i, my, o) {
    mark(i);
    EH.speak.onend = function () {
      if (my !== token) return;
      count(D.s[i].split(' ').length / 2.4 / rate);
      if (loop && mode !== 'dict') return say(i, my, o);
      if (single || i === stopAt || i === N - 1) { halt(); if (o.end) o.end(); return; }
      say(i + 1, my, o);
    };
    EH.speak(D.s[i], 0.9 * rate);
  }
  $('ls-play').onclick = function () { if (playing) return halt(); play(cur < 0 || cur === N - 1 ? 0 : cur); };
  $('ls-prev').onclick = function () { play(Math.max(0, cur - 1), { one: mode !== 'read' }); };
  $('ls-next').onclick = function () { play(Math.min(N - 1, cur + 1), { one: mode !== 'read' }); };
  $('ls-loop').onclick = function () { loop = !loop; $('ls-loop').classList.toggle('on', loop); $('ls-loop').setAttribute('aria-pressed', loop); };
  $('ls-rate').onchange = function (e) { rate = +e.target.value; au.playbackRate = rate; };
  $('ls-slow').onchange = function (e) { var on = playing, i = Math.max(0, cur); halt(); trk = e.target.checked ? 'slow' : 'n'; if (on) play(i); };
  /* 页面上原有的「整篇朗读」「停」与段前小喇叭都走同一个播放器 */
  if ($('read-all')) { $('read-all').onclick = function () { play(0); }; $('stop-all').onclick = halt; }
  text.addEventListener('click', function (e) {
    var sb = e.target.closest('.tp > .say');
    if (sb) { e.stopPropagation(); var q = sb.parentNode.querySelectorAll('.ls'); if (q.length) play(+q[0].dataset.ls, { to: +q[q.length - 1].dataset.ls }); return; }
    var s = e.target.closest('.ls');
    if (s && mode === 'read' && !e.target.closest('a,button,[data-card]') && !String(getSelection())) play(+s.dataset.ls);
  }, true);

  /* ---------- 听写判分 ---------- */
  function words(s) { return EH.norm(s).split(' ').filter(Boolean); }
  function align(given, ref) { // 词级编辑距离＋回溯：acc 与 nce-study quiz.js::wordAcc 同一算法
    var g = words(given), r = words(ref), dp = [], i, j;
    for (i = 0; i <= g.length; i++) { dp[i] = [i]; for (j = 1; j <= r.length; j++) dp[i][j] = i === 0 ? j : 0; }
    for (i = 1; i <= g.length; i++) for (j = 1; j <= r.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (g[i - 1] === r[j - 1] ? 0 : 1));
    var hit = r.map(function () { return false; }); i = g.length; j = r.length;
    while (i > 0 && j > 0) {
      if (g[i - 1] === r[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { hit[j - 1] = true; i--; j--; }
      else if (dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j--; }
      else if (dp[i][j] === dp[i - 1][j] + 1) i--; else j--;
    }
    return { acc: Math.max(0, 1 - dp[g.length][r.length] / Math.max(1, r.length)), hit: hit, words: r };
  }
  function marked(ref, hit) { // 原句逐词标：听对的正常，漏的、错的标出来
    var k = 0;
    return ref.split(/\s+/).map(function (w) {
      var n = words(w).length, ok = true;
      for (var x = 0; x < n; x++) ok = hit[k++] && ok;
      return n && !ok ? '<mark class="miss">' + EH.esc(w) + '</mark>' : EH.esc(w);
    }).join(' ');
  }
  var DL = D.s.map(function (s, i) { return i; }).filter(function (i) { return words(D.s[i]).length >= 3; }), di = 0;
  function tally() {
    var ks = Object.keys(rec.dict), ok = ks.filter(function (k) { return rec.dict[k] >= 0.9; }).length;
    return ok + ' / ' + DL.length;
  }
  function dict() {
    var i = DL[di], P = $('ls-panel');
    P.innerHTML = '<p class="muted">' + T('Sentence ' + (di + 1) + ' of ' + DL.length + '. Play it, then type what you hear. Punctuation and capitals do not count.', '第 ' + (di + 1) + ' 句，共 ' + DL.length + ' 句。听完把听到的打出来，标点和大小写不算。')
      + ' ✅ <b id="ls-ok">' + tally() + '</b></p><div class="ls-row"><button id="ls-dplay" class="ls-main">🔊 ' + T('Play', '播放') + '</button><button id="ls-dslow">🐢 ' + T('Slower', '放慢') + '</button></div>'
      + '<textarea id="ls-in" rows="2" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Type what you hear"></textarea>'
      + '<div class="ls-row"><button id="ls-chk">' + T('Check', '判分') + '</button><button id="ls-dn">' + T('Next sentence', '下一句') + '</button></div><div id="ls-fb" hidden></div>';
    $('ls-dplay').onclick = function () { rate = +$('ls-rate').value; play(i, { one: true }); };
    $('ls-dslow').onclick = function () { rate = 0.75; play(i, { one: true, end: function () { rate = +$('ls-rate').value; } }); };
    $('ls-chk').onclick = function () {
      var a = align($('ls-in').value, D.s[i]), fb = $('ls-fb');
      rec.dict[i] = Math.max(rec.dict[i] || 0, Math.round(a.acc * 100) / 100); EH.touch(); EH.save();
      $('ls-ok').textContent = tally(); fb.hidden = false; fb.dataset.acc = a.acc.toFixed(2);
      fb.innerHTML = (a.acc >= 0.9 ? '✅ ' : '❌ ') + '<b>' + Math.round(a.acc * 100) + '%</b> <span class="en">' + marked(D.s[i], a.hit) + '</span>';
    };
    $('ls-dn').onclick = function () { halt(); di = (di + 1) % DL.length; dict(); $('ls-dplay').click(); };
    $('ls-in').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('ls-chk').click(); } };
  }

  /* ---------- 跟读：听 → 录 → 对比 ---------- */
  var si = 0, mine = null, mr = null, mineAu = null;
  function dropMine() { if (mine) URL.revokeObjectURL(mine); mine = null; if (mineAu) mineAu.pause(); mineAu = null; }
  function shadow() {
    var P = $('ls-panel'); dropMine();
    P.innerHTML = '<p class="muted">' + T('Sentence ' + (si + 1) + ' of ' + N + '. Listen, record yourself, then hear the two back to back. Your recording stays in this tab and is gone when you leave.', '第 ' + (si + 1) + ' 句，共 ' + N + ' 句。先听，再录自己，然后两段连着听。录音只在这个页面里，离开就没了。')
      + '</p><p class="en ls-line"><span id="ls-line">' + EH.esc(D.s[si]) + '</span></p><div class="ls-row"><button id="ls-sp" class="ls-main">🔊 ' + T('Model', '原音') + '</button><button id="ls-sr">● ' + T('Record', '录音') + '</button>'
      + '<button id="ls-sm" disabled>▶ ' + T('Me', '我的') + '</button><button id="ls-sc" disabled>⇄ ' + T('Model, then me', '原音接我的') + '</button><button id="ls-sn">' + T('Next sentence', '下一句') + '</button>'
      + '<label><input type="checkbox" id="ls-blind"> ' + T('Hide the words', '盲跟（隐藏文字）') + '</label></div>';
    function playMine() { if (!mine) return; mineAu = new Audio(mine); mineAu.play(); }
    $('ls-blind').onchange = function (e) { $('ls-line').classList.toggle('blind', e.target.checked); };
    $('ls-sp').onclick = function () { play(si, { one: true }); };
    $('ls-sm').onclick = function () { halt(); playMine(); };
    $('ls-sc').onclick = function () { play(si, { one: true, end: playMine }); };
    $('ls-sn').onclick = function () { halt(); si = (si + 1) % N; shadow(); mark(si); };
    $('ls-sr').onclick = function () {
      if (mr) { mr.stop(); return; }
      halt();
      if (!navigator.mediaDevices || !window.MediaRecorder) return EH.toast(T('Recording is not available in this browser.', '这个浏览器不支持录音。'));
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
        var ch = []; mr = new MediaRecorder(st); $('ls-sr').classList.add('on'); $('ls-sr').innerHTML = '■ ' + T('Stop', '停');
        mr.ondataavailable = function (e) { ch.push(e.data); };
        mr.onstop = function () {
          st.getTracks().forEach(function (t) { t.stop(); }); mr = null; dropMine();
          mine = URL.createObjectURL(new Blob(ch));
          if (!$('ls-sr')) return dropMine();
          $('ls-sr').classList.remove('on'); $('ls-sr').innerHTML = '● ' + T('Record again', '重录'); $('ls-sm').disabled = $('ls-sc').disabled = false;
          rec.shadow = (rec.shadow || 0) + 1; EH.touch(); EH.save();
        };
        mr.start(); setTimeout(function () { if (mr) mr.stop(); }, 30000);
      }).catch(function () { EH.toast(T('Microphone not allowed.', '没有麦克风权限。')); });
    };
  }

  /* ---------- 三种练法 ---------- */
  function setMode(m) {
    halt(); if (mr) mr.stop(); mode = m;
    box.querySelectorAll('[data-ls-mode]').forEach(function (b) { b.classList.toggle('on', b.dataset.lsMode === m); });
    text.classList.toggle('ls-hidden', m === 'dict');
    var P = $('ls-panel'); P.hidden = m === 'read';
    if (m === 'dict') dict(); else if (m === 'shadow') { si = Math.max(0, cur); shadow(); mark(si); } else { P.innerHTML = ''; dropMine(); }
  }
  box.querySelectorAll('[data-ls-mode]').forEach(function (b) { b.onclick = function () { setMode(b.dataset.lsMode); }; });
  addEventListener('pagehide', function () { halt(); });
  voice(); mark(-1);
  window.EHListen = { align: align, get state() { return { cur: cur, playing: playing, dead: dead, trk: trk, t: au.currentTime }; } };
})();
