/* 课文榨干：本机文本／字幕（SRT、VTT）＋本机音频 → 逐句精读、生词（NGSL/NAWL 频段＋本站词块）、复述、摘要、听写、跟读。
   纯本地：FileReader 读文件，音频用 objectURL 播放，存档只进 localStorage（键 english-hub-squeeze），不联网。 */
(function () {
  'use strict';
  var T = EH.T, E = EH.esc, $ = function (s) { return document.querySelector(s); };
  var KEY = 'english-hub-squeeze', BANDS = window.EH_BANDS || {}, SITE = window.EH_SITEWORDS || [];
  var BAND_NAME = { 1: ['Band 1', '1 级'], 2: ['Band 2', '2 级'], 3: ['Band 3', '3 级'], 4: ['AWL', '学术词'], 0: ['Off-list', '表外'] };
  var store = {}; try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  var doc = null, audio = $('#sq-audio'), stopAt = null, tab = 'read';
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { EH.toast(T('Storage is full: notes were not saved.', '存储已满：笔记没存上。')); } }
  function rate() { return +$('#sq-rate').value; }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36); }

  /* ---------- 读入 ---------- */
  function secs(t) { var p = t.trim().replace(',', '.').split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
  function parseCues(txt) {
    var out = [];
    txt.replace(/\r/g, '').split(/\n\s*\n/).forEach(function (b) {
      var m = b.match(/(\d[\d:.,]+)\s*-->\s*(\d[\d:.,]+)[^\n]*\n([\s\S]+)/);
      if (m) out.push({ a: secs(m[1]), b: secs(m[2]), t: m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() });
    });
    return out.filter(function (c) { return c.t; });
  }
  function splitSentences(p) { return p.replace(/\s+/g, ' ').trim().split(/(?<=[.!?]["”’)]?)\s+(?=["“(]?[A-Z0-9])/).filter(Boolean); }
  function load(text, title) {
    text = text.replace(/\r/g, '');
    var cues = /-->/.test(text) ? parseCues(text) : [];
    var paras = [], sents = [];
    if (cues.length) {
      cues.forEach(function (c, i) { sents.push({ t: c.t, a: c.a, b: c.b, p: Math.floor(i / 6) }); });
      for (var i = 0; i * 6 < cues.length; i++) paras.push(i);
    } else {
      text.split(/\n\s*\n|\n(?=\s*[A-Z])/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (p, pi) {
        paras.push(pi); splitSentences(p).forEach(function (s) { sents.push({ t: s, p: pi }); });
      });
    }
    var body = sents.map(function (s) { return s.t; }).join(' ');
    doc = { id: hash(body), title: title || (sents[0] ? sents[0].t.slice(0, 40) : ''), sents: sents, nparas: paras.length, words: (body.match(/[A-Za-z’']+/g) || []).length, timed: !!cues.length };
    store.last = { text: text, title: doc.title }; store.docs = store.docs || {}; store.docs[doc.id] = store.docs[doc.id] || { notes: {}, dict: {}, retell: '', summary: '' };
    save();
    $('#sq-info').textContent = doc.sents.length + ' sentences · ' + doc.words + ' words' + (doc.timed ? ' · timed' : '');
    $('#sq-tabs').hidden = false; show(tab);
  }
  function D() { return store.docs[doc.id]; }
  function readFiles(files) {
    [].forEach.call(files, function (f) {
      if (/^(audio|video)\//.test(f.type) || /\.(mp3|m4a|wav|ogg|aac|mp4)$/i.test(f.name)) {
        audio.src = URL.createObjectURL(f); audio.hidden = false; $('#sq-drop').classList.add('has');
        EH.toast(T('Audio loaded: ', '已载入音频：') + E(f.name));
      } else {
        var r = new FileReader();
        r.onload = function () { $('#sq-text').value = r.result; $('#sq-title').value = f.name.replace(/\.\w+$/, ''); load(r.result, $('#sq-title').value); };
        r.readAsText(f);
      }
    });
  }
  $('#sq-file').onchange = function (e) { readFiles(e.target.files); };
  var drop = $('#sq-drop');
  ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
  drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); readFiles(e.dataTransfer.files); });
  $('#sq-go').onclick = function () { var t = $('#sq-text').value.trim(); if (!t) { $('#sq-text').focus(); return; } load(t, $('#sq-title').value.trim()); };
  document.querySelectorAll('#sq-tabs [data-tab]').forEach(function (b) { b.onclick = function () { show(b.dataset.tab); }; });

  /* ---------- 播放：有时间轴＋音频就播原声片段，否则设备朗读 ---------- */
  audio.addEventListener('timeupdate', function () { if (stopAt !== null && audio.currentTime >= stopAt) { audio.pause(); stopAt = null; } });
  function play(i) {
    var s = doc.sents[i];
    if (doc.timed && audio.src) { audio.playbackRate = rate(); audio.currentTime = s.a; stopAt = s.b; audio.play(); }
    else EH.speak(s.t, rate());
  }
  function playBtn(i) { return '<button class="play small" data-play="' + i + '" aria-label="Play">▶</button>'; }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-play]'); if (b) { e.stopPropagation(); play(+b.dataset.play); } });

  /* ---------- 词：分词、还原、分频段 ---------- */
  function band(w) {
    w = w.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
    if (w in BANDS) return [w, BANDS[w]];
    var tries = [w.replace(/ies$/, 'y'), w.replace(/ied$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/ed$/, ''), w.replace(/d$/, ''),
      w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/(.)\1ing$/, '$1'), w.replace(/(.)\1ed$/, '$1'), w.replace(/ly$/, ''), w.replace(/ily$/, 'y'), w.replace(/er$/, ''), w.replace(/est$/, '')];
    for (var i = 0; i < tries.length; i++) if (tries[i] !== w && tries[i] in BANDS) return [tries[i], BANDS[tries[i]]];
    return [w, 0];
  }
  function siteHits() {
    var body = doc.sents.map(function (s) { return s.t; }).join(' '), out = [];
    SITE.forEach(function (x) {
      var toks = x[0].toLowerCase().replace(/\.\.\./g, ' ').split(/\s+/).filter(Boolean);
      if (!toks.length) return;
      var rx = new RegExp('\\b' + toks.map(function (t, k) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (k === toks.length - 1 ? '\\w*' : '\\w*'); }).join('\\W+(?:\\w+\\W+){0,2}?') + '\\b', 'i');
      if (rx.test(body)) out.push(x);
    });
    return out;
  }
  function analyse() {
    var seen = {}, tokens = 0, inList = 0;
    doc.sents.forEach(function (s, si) {
      (s.t.match(/[A-Za-z][A-Za-z’'-]*/g) || []).forEach(function (raw, k) {
        tokens++;
        var b = band(raw), lem = b[0];
        if (b[1] >= 1 && b[1] <= 4) inList++;
        if (b[1] === 0 && /^[A-Z]/.test(raw) && k > 0) return; // 句中大写：多半是人名地名
        var o = seen[lem] || (seen[lem] = { w: lem, band: b[1], n: 0, s: si, forms: {} });
        o.n++; o.forms[raw] = 1;
      });
    });
    return { list: Object.keys(seen).map(function (k) { return seen[k]; }), tokens: tokens, cover: tokens ? Math.round(inList / tokens * 1000) / 10 : 0 };
  }
  function cloze(sent, forms) {
    var out = sent;
    Object.keys(forms).forEach(function (f) { out = out.replace(new RegExp('\\b' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'), '_____'); });
    return out;
  }

  /* ---------- 六个面板 ---------- */
  var PANELS = {
    read: function () {
      return '<p class="tools"><label><input type="checkbox" id="sq-hide"> ' + T('Hide the text (listen first)', '隐藏原文（先听）') + '</label> ' +
        (doc.timed && !audio.src ? '<span class="muted">' + T('Timed transcript loaded: drop the matching audio to hear the real voice.', '已载入带时间轴的字幕：拖入对应音频就能听原声。') + '</span>' : '') + '</p>' +
        '<div id="sq-read">' + doc.sents.map(function (s, i) {
          var n = D().notes[i] || '';
          return (i && s.p !== doc.sents[i - 1].p ? '<hr class="sq-p">' : '') + '<div class="sent' + (n ? ' has-note' : '') + '" data-i="' + i + '">' + playBtn(i) +
            '<div class="body"><span class="en">' + E(s.t) + '</span><textarea class="sq-note" rows="2" placeholder="note" hidden>' + E(n) + '</textarea></div></div>';
        }).join('') + '</div>';
    },
    words: function () {
      var a = analyse(), known = {};
      var site = siteHits();
      var rows = a.list.filter(function (o) { return o.band !== 1 && o.band !== 2; }).sort(function (x, y) { return (x.band === 0 ? -1 : 0) - (y.band === 0 ? -1 : 0) || y.band - x.band || y.n - x.n; });
      var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 }; a.list.forEach(function (o) { counts[o.band]++; });
      var bars = [1, 2, 3, 4, 0].map(function (b) { return '<span class="chip">' + T(BAND_NAME[b][0], BAND_NAME[b][1]) + ' ' + counts[b] + '</span>'; }).join('');
      return '<p>' + T('Lexical coverage by NGSL and AWL: ', 'NGSL＋学术词表覆盖率：') + '<b>' + a.cover + '%</b> ' + T('of ' + a.tokens + ' running words.', '（共 ' + a.tokens + ' 个词次）') +
        ' <span class="muted">' + T('Reading without help needs about 98% of the words to be known; the gap is mostly in the off-list words below.', '无辅助读懂约要认识 98% 的词；差距主要在下面的表外词。') + '</span></p>' +
        '<p class="chips">' + bars + '</p>' +
        (site.length ? '<h3>' + T('Chunks taught on this site that appear here', '这里出现的本站已教词块') + '</h3><p class="chips">' + site.map(function (x) { return '<a class="chip" href="../u/' + E(x[1]) + '.html"><span class="en">' + E(x[0]) + '</span></a>'; }).join('') + '</p>' : '') +
        '<h3>' + T('Candidates for new words (off-list first)', '生词候选（表外词在前）') + '</h3><p class="muted">' + T('Tick the ones you want, add a short meaning in your own words, then add them to review. The card front is the sentence from your text with the word blanked out.', '勾出要学的，用自己的话写个简短释义，再加入复习。卡片正面是你这篇里挖掉该词的那句话。') + '</p>' +
        '<div class="tw"><table class="vt" id="sq-wt"><tr><th></th><th>' + T('Word', '词') + '</th><th>' + T('Band', '频段') + '</th><th>×</th><th>' + T('In context', '语境') + '</th><th>' + T('My meaning', '我的释义') + '</th></tr>' +
        rows.map(function (o, k) {
          return '<tr data-k="' + k + '"><td><input type="checkbox" class="sq-pick"' + (o.band === 0 ? ' checked' : '') + '></td><td><b class="en">' + E(o.w) + '</b></td><td>' + T(BAND_NAME[o.band][0], BAND_NAME[o.band][1]) + '</td><td>' + o.n +
            '</td><td class="en">' + E(doc.sents[o.s].t) + '</td><td><input class="sq-mean" size="12"></td></tr>';
        }).join('') + '</table></div><p><button class="primary" id="sq-add">＋ ' + T('Add ticked words to review', '把勾选的词加入复习') + '</button></p>';
    },
    retell: function () {
      var a = analyse(), key = {};
      a.list.forEach(function (o) { if (o.band === 0 || o.band >= 3) key[o.w] = o; });
      var groups = {};
      doc.sents.forEach(function (s, i) { (groups[s.p] = groups[s.p] || []).push(i); });
      var outline = Object.keys(groups).map(function (p, n) {
        var ws = [];
        groups[p].forEach(function (i) { (doc.sents[i].t.match(/[A-Za-z][A-Za-z’'-]*/g) || []).forEach(function (w) { var l = band(w)[0]; if (key[l] && ws.indexOf(l) < 0 && ws.length < 5) ws.push(l); }); });
        if (!ws.length) ws = (doc.sents[groups[p][0]].t.match(/[A-Za-z]{5,}/g) || []).slice(0, 3);
        return '<li><b>' + (n + 1) + '.</b> <span class="en">' + ws.map(E).join(' · ') + '</span> ' + playBtn(groups[p][0]) + '</li>';
      }).join('');
      return '<p class="muted">' + T('Close the text. Using only these key words, retell each part aloud, then record a full retelling (90 seconds). Then write it.', '合上原文，只看这些关键词，分段口头复述；再录一遍完整复述（90 秒）；最后写下来。') + '</p>' +
        '<ol class="k-guide">' + outline + '</ol><p><button class="rec big-rec" data-max="90">● ' + T('Record a retelling (90 s)', '录一遍复述（90 秒）') + '</button></p>' +
        '<textarea id="sq-retell" rows="8">' + E(D().retell) + '</textarea><p class="muted" id="sq-retell-n"></p>';
    },
    summary: function () {
      var target = Math.max(50, Math.min(150, Math.round(doc.words / 4)));
      var frame = [['The text is about …', '这篇讲的是……'], ['The main point is that …', '核心观点是……'], ['This is supported by … / For example, …', '支撑它的是……／比如……'], ['However, … / On the other hand, …', '不过……／另一方面……'], ['In short, …', '总之……']];
      return '<p class="muted">' + T('Write a summary of about ' + target + ' words (a quarter of the original, as in New Concept English Book 4). Use the frame, your own words, and no sentence copied from the text.', '写一篇约 ' + target + ' 词的摘要（原文的四分之一，同新概念第四册的做法）。按框架写，用自己的话，不照抄原句。') + '</p>' +
        '<ul class="k-guide">' + frame.map(function (f) { return '<li>' + T('<i>' + f[0] + '</i>', f[1]) + '</li>'; }).join('') + '</ul>' +
        '<textarea id="sq-sum" rows="8" data-target="' + target + '">' + E(D().summary) + '</textarea><p id="sq-sum-n" class="muted"></p>';
    },
    dict: function () {
      return '<p class="muted">' + T('Play a sentence (the real audio if you dropped it, otherwise the device voice), type what you hear, press Enter. Missing words are underlined, wrong ones struck through.', '播放一句（拖入了音频就是原声，否则用设备语音），听写，回车。漏掉的词加下划线，写错的划掉。') + '</p>' +
        doc.sents.map(function (s, i) {
          var r = D().dict[i];
          return '<div class="q" data-i="' + i + '">' + playBtn(i) + ' <b>' + (i + 1) + '</b> <input class="sq-d ans" autocomplete="off" spellcheck="false" value="' + E(r ? r.g : '') + '"><div class="fb">' + (r ? r.h : '') + '</div></div>';
        }).join('');
    },
    shadow: function () {
      return '<p class="muted">' + T('Play a line, then speak along with it. Record yourself and compare. Start at 0.75 speed; move up when you keep pace.', '播一句，跟着说。录下来对比。从 0.75 倍速开始，跟得上再加速。') +
        (audio.src && !doc.timed ? ' ' + T('Your audio has no time stamps: use the A-B loop below.', '你的音频没有时间轴：用下面的 A-B 循环。') + ' <button id="sq-a">A</button> <button id="sq-b">B</button> <button id="sq-ab">' + T('Clear loop', '取消循环') + '</button> <span id="sq-abt" class="muted"></span>' : '') + '</p>' +
        doc.sents.map(function (s, i) {
          var sec = Math.max(4, Math.round(s.t.split(/\s+/).length / 2.3) + 2);
          return '<div class="sent">' + playBtn(i) + ' <button class="rec small" data-max="' + sec + '">●</button><div class="body en">' + E(s.t) + '</div></div>';
        }).join('');
    }
  };
  function diff(ref, got) {
    var a = EH.norm(ref).split(' '), b = EH.norm(got).split(' '), n = a.length, m = b.length, L = [];
    for (var i = 0; i <= n; i++) { L.push([]); for (var j = 0; j <= m; j++) L[i].push(0); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = [], ok = 0; i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push(E(a[i])); ok++; i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { out.push('<u class="bad">' + E(a[i]) + '</u>'); i++; }
      else { out.push('<s>' + E(b[j]) + '</s>'); j++; }
    }
    for (; i < n; i++) out.push('<u class="bad">' + E(a[i]) + '</u>');
    for (; j < m; j++) out.push('<s>' + E(b[j]) + '</s>');
    return { h: (ok === n && m === n ? '✅ ' : '') + ok + '/' + n + ' · <span class="en">' + out.join(' ') + '</span>', ok: ok, n: n };
  }
  function count(t) { return (t.match(/[A-Za-z’'-]+/g) || []).length; }
  function show(t) {
    tab = t;
    document.querySelectorAll('#sq-tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    var o = $('#sq-out'); o.innerHTML = PANELS[t]();
    if (t === 'read') {
      $('#sq-hide').onchange = function (e) { $('#sq-read').classList.toggle('sq-hidden', e.target.checked); };
      o.querySelectorAll('.sent').forEach(function (el) {
        var ta = el.querySelector('.sq-note'), i = +el.dataset.i;
        el.querySelector('.body').onclick = function (e) { if (e.target === ta) return; ta.hidden = !ta.hidden; el.classList.toggle('open', !ta.hidden); if (!ta.hidden) ta.focus(); };
        ta.oninput = function () { D().notes[i] = ta.value; el.classList.toggle('has-note', !!ta.value.trim()); save(); };
      });
    } else if (t === 'words') {
      var rows = [].slice.call(o.querySelectorAll('#sq-wt tr[data-k]'));
      $('#sq-add').onclick = function () {
        var a = analyse(), list = a.list.filter(function (x) { return x.band !== 1 && x.band !== 2; }).sort(function (x, y) { return (x.band === 0 ? -1 : 0) - (y.band === 0 ? -1 : 0) || y.band - x.band || y.n - x.n; }), n = 0;
        rows.forEach(function (r) {
          if (!r.querySelector('.sq-pick').checked) return;
          var w = list[+r.dataset.k], s = doc.sents[w.s].t;
          n += EH.addCard({ id: 'sq:' + doc.id + ':' + w.w, kind: 'word', lesson: 'squeeze', front: cloze(s, w.forms), back: w.w + ' — ' + s,
            extra: { zh: r.querySelector('.sq-mean').value.trim(), unit: doc.title, hint: r.querySelector('.sq-mean').value.trim() } }) ? 1 : 0;
        });
        EH.touch(); EH.save(); EH.toast(T(n + ' new cards added.', '新加入 ' + n + ' 张卡。'));
      };
    } else if (t === 'retell') {
      var rt = $('#sq-retell'), rn = function () { $('#sq-retell-n').textContent = count(rt.value) + ' words'; };
      rt.oninput = function () { D().retell = rt.value; save(); rn(); }; rn();
    } else if (t === 'summary') {
      var sm = $('#sq-sum'), src = doc.sents.map(function (s) { return s.t; }).join(' ');
      var grams = function (x) { var w = EH.norm(x).split(' '), g = {}; for (var i = 0; i + 8 <= w.length; i++) g[w.slice(i, i + 8).join(' ')] = 1; return g; };
      var G = grams(src);
      var upd = function () {
        var n = count(sm.value), tg = +sm.dataset.target, copied = Object.keys(grams(sm.value)).filter(function (g) { return G[g]; });
        $('#sq-sum-n').innerHTML = n + ' / ' + tg + ' ' + T('words', '词') + (n > tg * 1.2 ? ' · ' + T('too long', '太长了') : '') +
          (copied.length ? ' · <b class="bad">' + T('8+ words copied from the text: ', '有 8 词以上照抄原文：') + '</b><i class="en">' + E(copied[0]) + '</i>' : '');
      };
      sm.oninput = function () { D().summary = sm.value; save(); upd(); }; upd();
    } else if (t === 'dict') {
      o.querySelectorAll('.sq-d').forEach(function (inp) {
        var box = inp.closest('.q'), i = +box.dataset.i;
        inp.onkeydown = function (e) {
          if (e.key !== 'Enter' || !inp.value.trim()) return;
          var r = diff(doc.sents[i].t, inp.value);
          D().dict[i] = { g: inp.value, h: r.h, ok: r.ok, n: r.n }; save();
          box.querySelector('.fb').innerHTML = r.h; box.classList.toggle('ok', r.ok === r.n); box.classList.toggle('bad', r.ok < r.n);
          var nx = o.querySelector('.q[data-i="' + (i + 1) + '"] .sq-d'); if (nx) { nx.focus(); play(i + 1); }
        };
      });
    } else if (t === 'shadow' && $('#sq-a')) {
      var A = null;
      $('#sq-a').onclick = function () { A = audio.currentTime; $('#sq-abt').textContent = 'A ' + A.toFixed(1) + ' s'; };
      $('#sq-b').onclick = function () { if (A === null) return; var B = audio.currentTime; $('#sq-abt').textContent = 'A ' + A.toFixed(1) + ' – B ' + B.toFixed(1) + ' s';
        audio.ontimeupdate = function () { if (audio.currentTime >= B) audio.currentTime = A; }; audio.currentTime = A; audio.playbackRate = rate(); audio.play(); };
      $('#sq-ab').onclick = function () { audio.ontimeupdate = null; A = null; $('#sq-abt').textContent = ''; };
    }
  }
  if (store.last && store.last.text) { $('#sq-text').value = store.last.text; $('#sq-title').value = store.last.title || ''; load(store.last.text, store.last.title); }
  window.EHSqueeze = { load: load, band: band, analyse: analyse, diff: diff, get doc() { return doc; } };
})();
