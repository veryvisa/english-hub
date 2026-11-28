/* Shadowing studio (tools/studio). Pure local page: recordings live in memory as blob: URLs and are dropped on reload;
   nothing is uploaded or written to disk. Saved: self-ratings (S.speaks with src 'studio', S.days[date].speak — same fields
   as the topic page) and which sentences you practised (S.notes['studio:<text id>'].done). */
(function () {
  'use strict';
  var D = window.EH_STUDIO_DATA, T = EH.T, E = EH.esc, S = EH.state;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var au = $('#st-audio'), art = null, mine = {}, cur = -1, run = 0;

  /* ---------- recording (memory only) ---------- */
  var rec = null;
  function startRec(maxSec, onStart, onDone) {
    if (rec) { rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { EH.toast(T('Recording is not available in this browser.', '这个浏览器不支持录音。')); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
      var parts = [], r = new MediaRecorder(st), timer; rec = r;
      r.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
      r.onstop = function () {
        clearTimeout(timer); st.getTracks().forEach(function (t) { t.stop(); }); rec = null;
        onDone(parts.length ? URL.createObjectURL(new Blob(parts, { type: r.mimeType || 'audio/webm' })) : null);
      };
      r.start(); onStart && onStart();
      timer = setTimeout(function () { if (r.state !== 'inactive') r.stop(); }, 1000 * maxSec);
    }).catch(function () { EH.toast(T('Microphone not allowed.', '没有麦克风权限。')); onDone(null); });
  }
  function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
  var player = null;
  function playUrl(url, cb) {
    if (player) { player.pause(); player = null; }
    if (!url) { cb && cb(); return; }
    player = new Audio(url); player.onended = function () { player = null; cb && cb(); };
    player.play().catch(function () { player = null; cb && cb(); });
  }

  /* ---------- reference: recorded narration if the text has it, otherwise the browser voice ---------- */
  function rate() { return +$('#st-rate').value || 1; }
  function track() { // slow track when asked for ≤0.8× and it exists
    var A = art && art.audio; if (!A) return null;
    var k = rate() <= 0.8 && A.slow ? 'slow' : 'n', t = A[k];
    return { k: k, t: t, rate: rate() / (t.speed || 1), url: location.protocol === 'file:' ? '../../build/media/' + A.repo + '/' + t.file : (document.getElementById('st-art').dataset.baseSrc || '') + t.url.replace(/^eh-audio-/, '') };
  }
  function playRef(i, cb) {
    var tk = track(), my = ++run, done = function () { if (my === run) { run++; cb && cb(); } };
    if (player) { player.pause(); player = null; }
    if (tk) {
      if (au.dataset.src !== tk.url) { au.src = tk.url; au.dataset.src = tk.url; au.preload = 'auto'; }
      var seg = tk.t.segs[i];
      var go = function () {
        au.playbackRate = tk.rate; au.currentTime = Math.max(0, seg[0] - 0.03);
        au.play().catch(function () { done(); });
        (function watch() { if (my !== run) return; if (au.currentTime >= seg[1] + 0.04 || au.ended) { au.pause(); done(); } else requestAnimationFrame(watch); })();
      };
      if (au.readyState >= 1) go(); else { au.addEventListener('loadedmetadata', go, { once: true }); au.load(); }
      return;
    }
    var text = art.s[i], words = text.split(/\s+/).length;
    EH.speak.onend = function () { EH.speak.onend = null; done(); };
    EH.speak(text, 0.9 * rate());
    setTimeout(function () { if (my === run) { EH.speak.onend = null; done(); } }, 1000 * (2 + words * 0.75 / rate())); // some browsers never fire onend
  }
  function stopAll() { run++; if (!au.paused) au.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); EH.speak.onend = null; if (player) { player.pause(); player = null; } stopRec(); mark(-1); }
  function gap(i) { return 800 + 1000 * art.s[i].split(/\s+/).length * 0.45 / rate(); } // time left for you to shadow

  /* ---------- shadowing ---------- */
  function note() { var k = 'studio:' + art.id; return S.notes[k] || (S.notes[k] = { text: '', t: '', done: [] }); }
  function practised(i) {
    var n = note(); n.done = n.done || []; if (n.done.indexOf(i) < 0) n.done.push(i);
    n.t = new Date().toISOString(); EH.touch(); EH.save(); paintProg();
  }
  function paintProg() {
    var n = (S.notes['studio:' + art.id] || {}).done || [];
    $('#st-prog').innerHTML = T('Practised', '练过') + ' ' + n.length + ' / ' + art.s.length;
    $$('.st-s').forEach(function (li, i) { li.classList.toggle('done', n.indexOf(i) >= 0); });
  }
  function mark(i) { cur = i; $$('.st-s').forEach(function (li, j) { li.classList.toggle('cur', j === i); }); if (i >= 0) { var li = $$('.st-s')[i]; if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' }); } }
  function loopRef(i) { mark(i); playRef(i, function () { if ($('#st-loop').checked && cur === i) { var my = run; setTimeout(function () { if (my === run && cur === i) loopRef(i); }, gap(i)); } }); }
  function openArt(id) {
    stopAll();
    Object.keys(mine).forEach(function (k) { URL.revokeObjectURL(mine[k]); }); mine = {};
    art = D.arts.filter(function (a) { return a.id === id; })[0] || D.arts[0];
    $('#st-art').value = art.id; au.removeAttribute('src'); delete au.dataset.src;
    $('#st-src').innerHTML = art.audio ? '🎧 ' + T('Model: recorded narration', '示范：成品朗读') : '🗣 ' + T('Model: your browser’s built-in voice', '示范：浏览器自带语音');
    var lastP = -1;
    $('#st-list').innerHTML = art.s.map(function (s, i) {
      var p = art.p[i], next = art.p[i + 1], zh = next !== p && art.zh_paras[p] ? '<span class="zh" lang="zh-Hans">' + E(art.zh_paras[p]) + '</span>' : '';
      var head = p !== lastP ? ' data-para="' + p + '"' : ''; lastP = p;
      return '<li class="st-s" data-i="' + i + '"' + head + '><span class="no">' + (i + 1) + '</span><span class="txt en">' + E(s) + '</span>' + zh +
        '<button class="ref">🔊 ' + T('Listen', '听') + '</button><button class="me">● ' + T('Record', '录') + '</button>' +
        '<button class="cmp" disabled>⇄ ' + T('Model, then me', '示范＋我') + '</button><button class="pm" disabled>▶ ' + T('Me', '我') + '</button></li>';
    }).join('');
    paintProg();
  }
  function initShadow() {
    var by = {}; D.arts.forEach(function (a) { (by[a.topic] = by[a.topic] || []).push(a); });
    $('#st-art').innerHTML = Object.keys(by).map(function (t) {
      var tp = D.topics[t] || { en: t };
      return '<optgroup label="' + E(tp.en) + '">' + by[t].map(function (a) { return '<option value="' + E(a.id) + '">' + E(a.en) + ' · ' + a.level + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    $('#st-art').onchange = function () { openArt(this.value); history.replaceState(null, '', '#a=' + this.value); };
    $('#st-blind').onchange = function () { $('#st-list').classList.toggle('blind', this.checked); };
    $('#st-zh').onchange = function () { $('#st-list').classList.toggle('show-zh', this.checked); };
    $('#st-stop').onclick = stopAll;
    $('#st-all').onclick = function () {
      stopAll(); var i = Math.max(0, cur);
      (function step() { if (i >= art.s.length) { mark(-1); return; } mark(i); playRef(i, function () { var my = run; setTimeout(function () { if (my === run) { i++; step(); } }, gap(i)); }); })();
    };
    $('#st-list').addEventListener('click', function (e) {
      var li = e.target.closest('.st-s'); if (!li) return;
      var i = +li.dataset.i, b = e.target.closest('button');
      if (!b) { if ($('#st-list').classList.contains('blind')) li.classList.toggle('peek'); return; }
      if (b.classList.contains('ref')) { stopAll(); loopRef(i); }
      else if (b.classList.contains('me')) {
        if (rec) { stopRec(); return; }
        stopAll(); mark(i);
        startRec(Math.max(4, Math.ceil(art.s[i].split(/\s+/).length * 0.9 / rate()) + 3), function () { b.classList.add('on'); b.innerHTML = '■ ' + T('Stop', '停'); }, function (url) {
          b.classList.remove('on'); b.innerHTML = '● ' + T('Again', '重录');
          if (!url) return;
          if (mine[i]) URL.revokeObjectURL(mine[i]);
          mine[i] = url; $('.cmp', li).disabled = false; $('.pm', li).disabled = false; practised(i);
        });
      }
      else if (b.classList.contains('cmp')) { stopAll(); mark(i); playRef(i, function () { setTimeout(function () { playUrl(mine[i]); }, 350); }); }
      else if (b.classList.contains('pm')) { stopAll(); mark(i); playUrl(mine[i]); }
    });
  }

  /* ---------- speaking tasks ---------- */
  var DIMS = D.dims;
  function dimSel() {
    return DIMS.map(function (d) { return '<label class="dim">' + T(E(d.en), E(d.zh)) + ' <select data-dim="' + d.k + '"><option value="">–</option><option value="5.5">5–6</option><option value="7.5">7–8</option><option value="9.5">9+</option></select></label>'; }).join(' ');
  }
  function lastFor(p) { var x = S.speaks.filter(function (s) { return s.src === 'studio' && s.prompt === p.id; }); return x[x.length - 1]; }
  function initSpeak() {
    var types = []; D.prompts.forEach(function (p) { if (types.indexOf(p.task) < 0) types.push(p.task); });
    types.sort();
    $('#sp-filter').innerHTML += types.map(function (t) { return '<option value="' + E(t) + '">' + E(t) + '</option>'; }).join('');
    $('#sp-list').innerHTML = D.prompts.map(function (p, i) {
      var l = lastFor(p);
      return '<article class="sp-card" id="sp-' + i + '" data-i="' + i + '" data-topic="' + E(p.topic) + '" data-task="' + E(p.task) + '"><header><b>' + E(p.task) + '</b> <span class="muted">' +
        T(E(p.topic_en), E(p.zh_topic || p.topic_en)) + ' · ' + T('prepare', '准备') + ' ' + p.prep + ' s · ' + T('speak', '作答') + ' ' + p.secs + ' s</span><span class="last muted">' +
        (l ? T('last', '上次') + ' ' + l.d + ': ' + l.avg : '') + '</span></header><div class="prompt">' + T(E(p.en), E(p.zh)) + '</div>' +
        '<p><button class="primary sp-go">⏱ ' + T('Start', '开始') + '</button>' + (p.celpip ? ' <a href="' + p.celpip + '">🎧 ' + T('Sample answers at three levels', '三级示范') + '</a>' : '') + '</p><div class="sp-run" hidden></div></article>';
    }).join('');
    $('#sp-filter').onchange = function () { var v = this.value; $$('.sp-card').forEach(function (c) { c.hidden = !!v && c.dataset.task !== v; }); count(); };
    count();
    $('#sp-list').addEventListener('click', function (e) { var b = e.target.closest('.sp-go'); if (b) runTask(b.closest('.sp-card')); });
  }
  function count() { $('#sp-count').innerHTML = $$('.sp-card').filter(function (c) { return !c.hidden; }).length + ' ' + T('tasks', '道题'); }
  var live = null;
  function runTask(card) {
    if (live) live.cancel();
    var p = D.prompts[+card.dataset.i], box = $('.sp-run', card), url = null, timer = null, stopped = false;
    box.hidden = false;
    box.innerHTML = '<div class="sp-clock" aria-live="polite"></div><p class="sp-ctl"><button class="sp-skip">⏭ ' + T('Start speaking now', '现在就开始说') + '</button> <button class="sp-end" hidden>■ ' + T('Stop recording', '停止录音') + '</button></p>' +
      '<div class="sp-after" hidden><p><button class="sp-play">▶ ' + T('Play my answer', '回放我的回答') + '</button> <button class="sp-again">↺ ' + T('Try again', '再来一次') + '</button></p>' +
      '<h4>' + T('Upgrade checklist: tick the target chunks you actually used', '升级清单：勾出你真用上的目标词块') + '</h4>' +
      (p.chunks.length ? '<p class="chips">' + p.chunks.map(function (w) { return '<label class="chip"><input type="checkbox" class="used"> <span class="en">' + E(w) + '</span></label>'; }).join('') + '</p>'
        : '<p class="muted">' + T('This topic has no texts yet, so there is no chunk list; count the stronger phrases you used yourself.', '这个主题还没有文章，没有词块清单；自己数一数用上了几个更好的说法。') + ' <input type="number" class="used-n" min="0" max="20" value="0" style="width:4em"></p>') +
      '<h4>' + T('Rate yourself on the four CELPIP dimensions', '按思培四个维度自评') + '</h4><p class="dims">' + dimSel() + ' <button class="primary sp-save">' + T('Save', '保存') + '</button></p><p class="sp-msg muted"></p></div>';
    var clock = $('.sp-clock', box), skip = $('.sp-skip', box), end = $('.sp-end', box), after = $('.sp-after', box);
    function tick(left, label, next) { clock.innerHTML = label(left); if (left <= 0) { next(); return; } timer = setTimeout(function () { tick(left - 1, label, next); }, 1000); }
    function speakNow() {
      clearTimeout(timer); skip.hidden = true;
      startRec(p.secs, function () {
        end.hidden = false;
        tick(p.secs, function (n) { return '● ' + T('Recording: ' + n + ' s left', '录音中：还剩 ' + n + ' 秒'); }, function () {});
      }, function (u) {
        clearTimeout(timer); end.hidden = true; if (stopped) return;
        if (url) URL.revokeObjectURL(url); url = u;
        clock.innerHTML = u ? T('Done. Play it back, then tick and rate.', '完成。回放一遍，再勾词块、自评。') : T('No recording. You can still rate yourself.', '没有录到声音，也可以直接自评。');
        after.hidden = false; $('.sp-play', box).disabled = !u;
      });
    }
    skip.onclick = speakNow; end.onclick = stopRec;
    $('.sp-play', box).onclick = function () { playUrl(url); };
    $('.sp-again', box).onclick = function () { runTask(card); };
    $('.sp-save', box).onclick = function () {
      var sc = {}, sum = 0, n = 0;
      $$('select[data-dim]', box).forEach(function (x) { if (x.value) { sc[x.dataset.dim] = +x.value; sum += +x.value; n++; } });
      if (n < 4) { EH.toast(T('Rate all four dimensions.', '四个维度都要评。')); return; }
      var used = p.chunks.length ? $$('.used:checked', box).length : Math.max(0, Math.min(20, +($('.used-n', box) || {}).value || 0));
      var avg = Math.round(sum / n * 10) / 10, t = EH.today(), d = S.days[t] || (S.days[t] = {});
      d.topic = d.topic || p.topic; d.speak = { topic: p.topic, scores: sc, avg: avg, used: used };
      S.speaks.push({ d: t, topic: p.topic, avg: avg, used: used, scores: sc, src: 'studio', task: p.n, prompt: p.id });
      EH.touch(); EH.save();
      $('.sp-msg', box).innerHTML = T('Saved. Average ', '已保存。平均 ') + avg + ' · ' + used + ' ' + T('chunks used', '个词块用上了');
      $('.last', card).innerHTML = T('last', '上次') + ' ' + t + ': ' + avg; paintCurve();
    };
    live = { cancel: function () { stopped = true; clearTimeout(timer); stopRec(); if (url) URL.revokeObjectURL(url); box.hidden = true; box.innerHTML = ''; live = null; } };
    tick(p.prep, function (n) { return T('Prepare: ' + n + ' s', '准备：' + n + ' 秒'); }, speakNow);
  }

  /* ---------- curve ---------- */
  var COL = ['#0f6b62', '#b06a1a', '#5b5bd6', '#b3261e'];
  function paintCurve() {
    var sp = S.speaks.filter(function (s) { return s && s.scores; }).slice(-40), box = $('#st-curve');
    if (!sp.length) {
      box.innerHTML = '<p class="muted">' + T('No ratings yet. Do a speaking task and save your rating; the four lines start here.', '还没有自评。做一道口语题并保存自评，四条线就从这里开始。') + '</p>';
      $('#st-used').innerHTML = ''; $('#st-table').innerHTML = ''; return;
    }
    var W = 640, H = 220, L = 44, R = 12, Tp = 12, B = 28, n = sp.length;
    var X = function (j) { return n === 1 ? (L + W - R) / 2 : L + j * (W - L - R) / (n - 1); }, Y = function (v) { return Tp + (10 - v) / 5 * (H - Tp - B); };
    var g = [5.5, 7.5, 9.5].map(function (v) { return '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="4" y="' + (Y(v) + 4) + '">' + (v === 5.5 ? '5–6' : v === 7.5 ? '7–8' : '9+') + '</text>'; }).join('');
    var dates = [0, n - 1].filter(function (j, k, a) { return a.indexOf(j) === k; }).map(function (j) { return '<text x="' + X(j) + '" y="' + (H - 8) + '" text-anchor="' + (j ? 'end' : 'start') + '">' + E(sp[j].d) + '</text>'; }).join('');
    var lines = DIMS.map(function (d, k) {
      var pts = sp.map(function (s, j) { var v = s.scores[d.k]; return v ? [X(j), Y(v) + (k - 1.5) * 1.6, v, s.d] : null; }).filter(Boolean);
      return '<g data-dim="' + d.k + '"><polyline class="ln" stroke="' + COL[k] + '" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>' +
        pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="' + COL[k] + '"><title>' + E(d.en) + ' ' + p[3] + ': ' + p[2] + '</title></circle>'; }).join('') + '</g>';
    }).join('');
    box.innerHTML = '<p class="st-leg">' + DIMS.map(function (d, k) { return '<span><i style="background:' + COL[k] + '"></i>' + T(E(d.en), E(d.zh)) + '</span>'; }).join('') + '</p>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Four CELPIP dimensions over time">' + g + dates + lines + '</svg>';
    var mx = Math.max(4, Math.max.apply(null, sp.map(function (s) { return s.used || 0; }))), h2 = 120, bw = Math.min(28, (W - L - R) / n - 4);
    $('#st-used').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + h2 + '" role="img" aria-label="Chunks used per session"><line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + (h2 - B) + '" y2="' + (h2 - B) + '"/>' +
      '<text x="4" y="' + (Tp + 4) + '">' + mx + '</text><text x="4" y="' + (h2 - B) + '">0</text>' +
      sp.map(function (s, j) { var v = s.used || 0, bh = v / mx * (h2 - Tp - B), x = X(j) - bw / 2; return '<rect class="bar" x="' + x.toFixed(1) + '" y="' + (h2 - B - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '"><title>' + s.d + ': ' + v + '</title></rect>' + (v ? '<text x="' + X(j).toFixed(1) + '" y="' + (h2 - B - bh - 3).toFixed(1) + '" text-anchor="middle">' + v + '</text>' : ''); }).join('') + '</svg>';
    var src = { studio: T('studio', '录音室'), today: T('today', '今日学习'), celpip: 'CELPIP' };
    $('#st-table').innerHTML = '<details><summary>' + T('Table view', '表格') + '</summary><table class="dist"><tr><th>' + T('date', '日期') + '</th><th>' + T('where', '在哪') + '</th>' +
      DIMS.map(function (d) { return '<th>' + T(E(d.en), E(d.zh)) + '</th>'; }).join('') + '<th>' + T('average', '平均') + '</th><th>' + T('chunks', '词块') + '</th></tr>' +
      sp.slice().reverse().map(function (s) { return '<tr><td>' + E(s.d) + '</td><td>' + (src[s.src] || T('topic page', '主题页')) + '</td>' + DIMS.map(function (d) { return '<td>' + (s.scores[d.k] || '–') + '</td>'; }).join('') + '<td>' + s.avg + '</td><td>' + (s.used || 0) + '</td></tr>'; }).join('') + '</table></details>';
  }

  /* ---------- start ---------- */
  function tab(id) { var b = $('[data-tab="' + id + '"]'); if (b) b.click(); }
  function route() {
    var raw = location.hash, h = decodeURIComponent(raw.slice(1)), m, keep = function () { if (location.hash !== raw) history.replaceState(null, '', raw); };
    if ((m = h.match(/^a=(.+)$/))) { tab('st-p-shadow'); keep(); if (!art || art.id !== m[1]) openArt(m[1]); }
    else if ((m = h.match(/^speak=(.+)$/))) {
      tab('st-p-speak'); keep(); var c = $$('.sp-card').filter(function (c) { return c.dataset.topic === m[1]; })[0];
      if (c) { c.scrollIntoView({ block: 'start' }); c.classList.add('cur'); }
    }
  }
  initShadow(); initSpeak(); openArt((location.hash.match(/^#a=(.+)$/) || [])[1] || D.arts[0].id); paintCurve();
  setTimeout(route, 0); window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', function () { stopAll(); Object.keys(mine).forEach(function (k) { URL.revokeObjectURL(mine[k]); }); });
  window.EHStudio = { get state() { return { art: art && art.id, cur: cur, mine: Object.keys(mine).length, recording: !!rec }; }, open: openArt };
})();
