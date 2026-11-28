/* 个人语料页：总数、词汇量曲线、再读哪篇、按熟悉程度分组的词块（可搜）、自己的文本、七天抽测。纯本地，逻辑都在 api.js（window.EHCorpus）。 */
(function () {
  'use strict';
  var K = window.EHCorpus, C = window.EH_CORPUS;
  if (!K) return;
  var T = EH.T, E = EH.esc, $ = function (s) { return document.getElementById(s); };
  var MIN = K.MIN_SEEN, PASS = K.MIN_PASS, SHOW = 40;
  var GROUPS = [
    ['near', '🎯', 'Nearly ten meetings', '快到 10 次', 'Met ' + (MIN - 4) + ' to ' + (MIN - 1) + ' times. One or two more texts will do it.', '见过 ' + (MIN - 4) + ' 到 ' + (MIN - 1) + ' 次，再读一两篇就够了。', true],
    ['review', '🔁', 'Met often, review not passed yet', '见得多，但复习还没过', 'Ten meetings or more, but the review card has not passed ' + PASS + ' times in a row. Recognising a chunk is not the same as recalling it.', '见面已满 10 次，但复习卡还没连续通过 ' + PASS + ' 次。认得出不等于想得起来。', true],
    ['once', '🌱', 'Met only once', '只见过一次', 'One meeting is the easiest to lose. The texts listed under each chunk bring it back.', '只见过一次的最容易丢；每个词块下面列的文章能让它再出现。', false],
    ['building', '🧱', 'Building up', '正在积累', 'Met 2 to ' + (MIN - 5) + ' times.', '见过 2 到 ' + (MIN - 5) + ' 次。', false],
    ['mastered', '✅', 'Mastered', '已掌握', 'Ten meetings or more and ' + PASS + ' passes in a row.', '见面满 10 次，且复习连续通过 ' + PASS + ' 次。', false]
  ];
  var open = {}, more = {}, query = '';
  function artLink(a, extra) {
    return '<a href="../u/' + E(a.id) + '.html"><span class="en">' + E(a.en) + '</span> <span class="zh" lang="zh-Hans">' + E(a.zh) + '</span></a>' + (extra || '');
  }
  function marked(s) { return E(s.t.slice(0, s.a)) + '<mark>' + E(s.t.substr(s.a, s.n)) + '</mark>' + E(s.t.slice(s.a + s.n)); }
  function cardBadge(r) {
    if (!r.card.has) return '<span class="cp-st">' + T('no review card', '还没有复习卡') + '</span>';
    if (r.card.n >= PASS) return '<span class="cp-st ok">' + T('review passed ×' + r.card.n, '复习连续通过 ' + r.card.n + ' 次') + '</span>';
    return '<span class="cp-st no">' + T('review ' + r.card.n + '/' + PASS, '复习 ' + r.card.n + '/' + PASS) + '</span>';
  }
  function row(r) {
    var pct = Math.min(100, Math.round(r.n / MIN * 100));
    return '<details class="cp-row" data-w="' + E(r.w) + '"' + (open[r.w] ? ' open' : '') + '><summary><b class="en">' + E(r.w) + '</b> <span class="zh" lang="zh-Hans">' + E(r.zh) + '</span> ' +
      '<span class="cp-n">×' + r.n + '</span> <span class="cp-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span> ' + cardBadge(r) + '</summary>' +
      '<div class="cp-body">' + (open[r.w] ? body(r) : '') + '</div></details>';
  }
  function body(r) {
    var w = K.where(r.w), c = C.chunks[r.i], h = '';
    if (w.read.length) {
      h += '<ul class="seen">' + w.read.map(function (x) {
        return x.sents.map(function (s) { return '<li><span class="en">' + marked(s) + '</span> ' + artLink(x.art) + '</li>'; }).join('');
      }).join('') + '</ul>';
    }
    w.own.forEach(function (o) {
      h += '<p class="muted">' + T('In your own text ', '在你自己的文本 ') + '<b class="en">' + E(o.title) + '</b> ×' + o.n + '</p><ul class="seen">' + o.sents.map(function (t) { return '<li><span class="en">' + E(t) + '</span></li>'; }).join('') + '</ul>';
    });
    if (!r.n) h += '<p class="muted">' + T('You have not met this one in a text yet.', '你还没在文章里遇到过它。') + '</p>';
    if (w.unread.length) {
      h += '<p>' + T('Waiting in texts you have not read: ', '在你还没读的文章里等着：') + w.unread.map(function (u) { return artLink(u.art, ' <span class="muted">×' + u.n + '</span>'); }).join(' · ') + '</p>';
    } else if (r.n && r.n < MIN) {
      h += '<p class="muted">' + T('You have read every text on this site that uses it (' + r.total + ' meetings in all). Paste in your own reading below to keep counting.', '本站用到它的文章你都读过了（一共 ' + r.total + ' 次见面）。把你自己读的英文贴到下面，接着数。') + '</p>';
    }
    h += '<p><a href="../u/' + E(c.u) + '.html">' + T('Where it is taught: ', '讲它的单元：') + '<span class="en">' + E(c.ue) + '</span></a>';
    if (!r.card.has) h += ' <button class="small" data-add="' + E(r.w) + '">＋ ' + T('Put it into review', '放进复习') + '</button>';
    else if (r.card.due) h += ' <span class="muted">' + T('next review ', '下次复习 ') + E(r.card.due) + '</span>';
    return h + '</p>';
  }
  function paintGroups(snap) {
    var q = K.key(query), html = '';
    if (q) {
      var hit = snap.filter(function (r) { return K.key(r.w).indexOf(q) >= 0; }).sort(function (a, b) { return b.n - a.n; });
      $('cp-q-n').innerHTML = hit.length + ' ' + T('found', '个');
      $('cp-groups').innerHTML = hit.length ? hit.slice(0, 80).map(row).join('') : '<p class="muted">' + T('No chunk on this site matches.', '本站词块表里没有匹配的。') + '</p>';
      return;
    }
    $('cp-q-n').textContent = '';
    GROUPS.forEach(function (g) {
      var list = snap.filter(function (r) { return r.group === g[0]; });
      list.sort(g[0] === 'review' ? function (a, b) { return (a.card.has ? 1 : 0) - (b.card.has ? 1 : 0) || b.n - a.n; } : function (a, b) { return b.n - a.n || (a.w < b.w ? -1 : 1); });
      var shown = more[g[0]] ? list : list.slice(0, SHOW);
      html += '<details class="cp-g" id="g-' + g[0] + '"' + (g[6] || more[g[0]] || open['g:' + g[0]] ? ' open' : '') + '><summary><b>' + g[1] + ' ' + T(g[2], g[3]) + '</b> <span class="cp-n" id="n-' + g[0] + '">' + list.length + '</span></summary>' +
        '<p class="muted">' + T(g[4], g[5]) + '</p>' + (list.length ? shown.map(row).join('') : '<p class="muted">' + T('Nothing here yet.', '这一组还是空的。') + '</p>') +
        (list.length > shown.length ? '<p class="cp-more"><button class="small" data-more="' + g[0] + '">' + T('Show all ' + list.length, '显示全部 ' + list.length + ' 个') + '</button></p>' : '') + '</details>';
    });
    $('cp-groups').innerHTML = html;
  }
  function paintKpi(snap) {
    var by = {}, met = 0, ten = 0;
    snap.forEach(function (r) { by[r.group] = (by[r.group] || 0) + 1; if (r.n) met++; if (r.n >= MIN) ten++; });
    var nread = C.arts.filter(function (a) { return (EH.state.lessons[a.id] || { steps: {} }).steps.learn; }).length, nown = Object.keys(K.texts()).length;
    var cell = function (id, n, en, zh) { return '<div><b id="' + id + '">' + n + '</b>' + T(en, zh) + '</div>'; };
    $('cp-kpi').innerHTML = cell('cp-mastered', by.mastered || 0, 'mastered', '已掌握') + cell('cp-ten', ten, 'met ' + MIN + '+ times', '见过 ' + MIN + ' 次以上') +
      cell('cp-met', met, 'chunks met', '见过的词块') + cell('cp-texts', nread + nown, 'texts in your corpus (' + nread + ' here, ' + nown + ' your own)', '语料里的文章（本站 ' + nread + ' 篇，自己的 ' + nown + ' 篇）');
    if (!met) $('cp-kpi').insertAdjacentHTML('beforeend', '<div>' + T('Your corpus is empty. Finish a text in <a href="../today.html">today\'s session</a> and tick Learn, or paste your own text below.', '语料还是空的。到<a href="../today.html">今日学习</a>读完一篇并勾上「学」，或者在下面贴入自己的文本。') + '</div>');
  }
  function paintCurve() {
    var H = K.history().slice(-60), box = $('cp-curve');
    if (!H.length) { box.innerHTML = '<p class="muted">' + T('The curve starts on the first day you have a text in your corpus.', '语料里有了第一篇文章，曲线就从那天开始。') + '</p>'; return; }
    var W = 640, Hh = 180, L = 34, R = 10, Tp = 10, B = 24, max = 1;
    H.forEach(function (p) { max = Math.max(max, p.met10, p.mastered); });
    var x = function (i) { return H.length === 1 ? L + (W - L - R) / 2 : L + (W - L - R) * i / (H.length - 1); }, y = function (v) { return Tp + (Hh - Tp - B) * (1 - v / max); };
    var line = function (k) { return H.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p[k]).toFixed(1); }).join(' '); };
    var last = H[H.length - 1];
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Mastered chunks by day"><line class="ax" x1="' + L + '" y1="' + y(0) + '" x2="' + (W - R) + '" y2="' + y(0) + '"/><line class="ax" x1="' + L + '" y1="' + Tp + '" x2="' + L + '" y2="' + y(0) + '"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(max) + 4) + '" text-anchor="end">' + max + '</text><text x="' + (L - 6) + '" y="' + (y(0) + 4) + '" text-anchor="end">0</text>' +
      '<text x="' + L + '" y="' + (Hh - 6) + '">' + E(H[0].d) + '</text>' + (H.length > 1 ? '<text x="' + (W - R) + '" y="' + (Hh - 6) + '" text-anchor="end">' + E(last.d) + '</text>' : '') +
      '<polyline class="l2" points="' + line('met10') + '"/><polyline class="l1" points="' + line('mastered') + '"/>' +
      H.map(function (p, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.mastered).toFixed(1) + '" r="' + (H.length > 30 ? 1.5 : 3) + '"><title>' + E(p.d) + ': ' + p.mastered + ' / ' + p.met10 + '</title></circle>'; }).join('') + '</svg>' +
      '<p class="muted">' + E(last.d) + ' · ' + T('mastered ', '已掌握 ') + '<b id="cp-h-m">' + last.mastered + '</b> · ' + T('met ' + MIN + '+ ', '见过 ' + MIN + ' 次以上 ') + last.met10 + ' · ' + T('met at least once ', '至少见过一次 ') + last.met + ' · ' + H.length + ' ' + T('days recorded', '天有记录') + '</p>';
  }
  function paintNext() {
    var sg = K.suggest(5), box = $('cp-next');
    if (!sg.length) {
      var unread = C.arts.filter(function (a) { return !(EH.state.lessons[a.id] || { steps: {} }).steps.learn; }).length;
      box.innerHTML = '<p class="muted">' + (unread === C.arts.length ? T('Read your first text and suggestions appear here.', '读完第一篇，这里就会给出建议。') :
        unread ? T('None of the unread texts repeats a chunk you have started on. Any new text opens new chunks.', '没读的文章里没有你已经见过的词块；读任何一篇都会开出新词块。') :
          T('You have read every text here. Paste in your own reading below to keep the count growing.', '本站文章你都读过了。把自己读的英文贴到下面，让次数接着涨。')) + '</p>';
      return;
    }
    box.innerHTML = sg.map(function (s) {
      return '<div class="cp-sug"><b>' + artLink(s.art) + '</b> <span class="muted">' + E(s.art.level) + ' · ' + s.art.words + ' words</span> <span class="gain">+' + s.gain + '</span> ' + T('meetings across ' + s.chunks.length + ' chunks', '次见面，覆盖 ' + s.chunks.length + ' 个词块') +
        '<p class="chips">' + s.chunks.slice(0, 8).map(function (c) { return '<span class="chip en">' + E(c.w) + ' ' + c.have + '→' + (c.have + c.add) + '</span>'; }).join('') + '</p></div>';
    }).join('');
  }
  function paintOwn() {
    var own = K.texts(), ids = Object.keys(own).sort(function (a, b) { return own[a].d < own[b].d ? 1 : -1; });
    $('cp-own-list').innerHTML = ids.length ? '<h3>' + T('Your texts', '你的文本') + '</h3>' + ids.map(function (id) {
      var o = own[id], n = 0, k = 0; for (var w in o.w) { n += o.w[w]; k++; }
      return '<div class="cp-own"><b class="en">' + E(o.title) + '</b> <span class="muted">' + E(o.d) + ' · ' + o.words + ' words · ' + k + ' ' + T('chunks', '个词块') + ' · ' + n + ' ' + T('meetings', '次见面') + '</span> <button class="small" data-del="' + E(id) + '">' + T('Remove', '移除') + '</button></div>';
    }).join('') : '';
    var sq = null; try { sq = (JSON.parse(localStorage.getItem('english-hub-squeeze')) || {}).last; } catch (e) {}
    $('cp-from-sq').hidden = !(sq && sq.text);
    $('cp-from-sq').onclick = function () { $('cp-text').value = sq.text; $('cp-title').value = sq.title || ''; };
  }

  /* ---------- 七天抽测 ---------- */
  var run = null;
  function paintCheck() {
    var d = K.checkDue(), box = $('cp-check'), note = $('cp-check-note');
    note.innerHTML = d.due ? '<p class="cp-sug">⏰ ' + T('Your seven-day check is due: ' + Math.min(d.n, C.check_n) + ' chunks. ', '七天抽测到期了：' + Math.min(d.n, C.check_n) + ' 个词块。') + '<a href="#check">' + T('Take it now', '现在做') + '</a></p>' : '';
    if (run) return;
    var last = d.last ? '<p class="muted">' + T('Last check ', '上次抽测 ') + E(d.last.d) + ': ' + d.last.ok + '/' + d.last.n + (d.last.out.length ? ' · ' + T('sent back to review: ', '退回复习：') + '<span class="en">' + d.last.out.map(E).join(', ') + '</span>' : '') + '</p>' : '';
    if (!d.n) { box.innerHTML = last + '<p class="muted">' + T('The check starts once you have mastered chunks to draw from.', '有了已掌握的词块，抽测才开始。') + '</p>'; return; }
    box.innerHTML = last + '<p>' + (d.due ? T('Due today. ', '今天到期。') : T('Next check in ' + d.inDays + ' days. ', d.inDays + ' 天后做下一次。')) +
      '<button class="' + (d.due ? 'primary' : 'small') + '" id="cp-ck-go">' + T('Start the check (' + Math.min(d.n, C.check_n) + ' chunks)', '开始抽测（' + Math.min(d.n, C.check_n) + ' 个词块）') + '</button></p>';
    $('cp-ck-go').onclick = startCheck;
  }
  function startCheck() {
    var items = K.drawCheck();
    if (!items.length) return;
    run = { items: items, res: {} };
    $('cp-check').innerHTML = '<p class="muted">' + T('Type the missing chunk and press Enter. No peeking at the lists above.', '填上缺的词块，回车。别看上面的列表。') + '</p>' + items.map(function (it, i) {
      return '<div class="q" data-i="' + i + '"><b>' + (i + 1) + '</b> <span class="en">' + E(it.before) + '<input class="cp-a" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Missing chunk ' + (i + 1) + '">' + E(it.after) + '</span>' +
        ' <span class="zh" lang="zh-Hans">' + E(it.zh) + '</span> <button class="small cp-ok">' + T('Check', '核对') + '</button><div class="fb"></div></div>';
    }).join('') + '<p><button class="primary" id="cp-ck-end">' + T('Finish the check', '结束抽测') + '</button> <span class="muted" id="cp-ck-n"></span></p><div id="cp-ck-res"></div>';
    var answer = function (q) {
      var i = +q.dataset.i, it = run.items[i], inp = q.querySelector('.cp-a');
      if (i in run.res || !inp.value.trim()) return;
      var ok = K.judge(it, inp.value); run.res[i] = ok; inp.disabled = true;
      q.classList.add(ok ? 'ok' : 'bad');
      q.querySelector('.fb').innerHTML = (ok ? '✅ ' : '❌ ') + '<b class="en">' + E(it.answer) + '</b>';
      $('cp-ck-n').textContent = Object.keys(run.res).length + ' / ' + run.items.length;
      var nx = document.querySelector('#cp-check .q[data-i="' + (i + 1) + '"] .cp-a'); if (nx) nx.focus();
    };
    document.querySelectorAll('#cp-check .q').forEach(function (q) {
      q.querySelector('.cp-ok').onclick = function () { answer(q); };
      q.querySelector('.cp-a').onkeydown = function (e) { if (e.key === 'Enter') answer(q); };
    });
    $('cp-ck-end').onclick = function () {
      var res = run.items.map(function (it, i) { return { w: it.w, ok: run.res[i] === true }; }); // 没答的算没过
      var r = K.finishCheck(res); run = null;
      paint();
      $('cp-check').insertAdjacentHTML('afterbegin', '<p class="cp-sug" id="cp-ck-done">' + T('Check done: ' + r.ok + ' of ' + r.n + ' recalled.', '抽测完成：' + r.n + ' 个里想起了 ' + r.ok + ' 个。') + (r.out.length ? ' ' + T('Back in review from tomorrow: ', '明天起回到复习：') + '<span class="en">' + r.out.map(E).join(', ') + '</span>' : '') + '</p>');
    };
  }

  function paint() {
    var snap = K.snapshot();
    paintKpi(snap); paintCurve(); paintNext(); paintGroups(snap); paintOwn(); paintCheck();
  }
  /* ---------- 事件 ---------- */
  $('cp-groups').addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.classList.contains('cp-g')) { open['g:' + d.id.slice(2)] = d.open; return; }
    if (!d.classList.contains('cp-row')) return;
    open[d.dataset.w] = d.open;
    var b = d.querySelector('.cp-body');
    if (d.open && !b.innerHTML) b.innerHTML = body(K.status(d.dataset.w));
  }, true);
  $('cp-groups').addEventListener('click', function (e) {
    var a = e.target.closest('[data-add]'), m = e.target.closest('[data-more]');
    if (a) { K.addCard(a.dataset.add); EH.toast(T('Added. It is due for review today.', '已加入，今天就到期复习。')); paint(); }
    if (m) { more[m.dataset.more] = 1; paint(); }
  });
  $('cp-q').oninput = function () { query = this.value; paintGroups(K.snapshot()); };
  function addOwn() {
    var t = $('cp-text').value;
    if (!t.trim()) { $('cp-text').focus(); return; }
    var r = K.addText(t, $('cp-title').value.trim());
    if (!r) { EH.toast(T('No English sentences found in that text.', '这段文字里没找到英文句子。')); return; }
    var ks = Object.keys(r.w).sort(function (a, b) { return r.w[b] - r.w[a]; }), n = 0; ks.forEach(function (k) { n += r.w[k]; });
    $('cp-own-out').innerHTML = '<div class="cp-sug" id="cp-own-res"><b class="en">' + E(r.title) + '</b> · ' + r.words + ' words · ' + r.sents + ' sentences<br>' +
      (r.dup ? T('This text is already in your corpus, so nothing was counted twice.', '这段文本已经在你的语料里，没有重复计数。') :
        ks.length ? T('<b>' + ks.length + '</b> chunks from this site appear in it, <b>' + n + '</b> meetings in all; <b>' + r.fresh.length + '</b> of them you had not met before.', '里面出现了本站的 <b>' + ks.length + '</b> 个词块，共 <b>' + n + '</b> 次见面；其中 <b>' + r.fresh.length + '</b> 个是你以前没见过的。') :
          T('None of the chunks taught on this site appear in it. It is still listed, and it will count when new chunks are added.', '里面没有出现本站教过的词块。文本仍然列在下面。')) +
      (ks.length && !r.dup ? '<p class="chips">' + ks.slice(0, 40).map(function (k) { return '<span class="chip en">' + E(k) + ' ×' + r.w[k] + '</span>'; }).join('') + '</p>' : '') + '</div>';
    if (!r.dup) { $('cp-text').value = ''; $('cp-title').value = ''; }
    paint();
  }
  $('cp-add').onclick = addOwn;
  $('cp-own-list').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { K.removeText(b.dataset.del); paint(); } });
  function readFile(f) {
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { $('cp-text').value = r.result; $('cp-title').value = f.name.replace(/\.\w+$/, ''); };
    r.readAsText(f);
  }
  $('cp-file').onchange = function (e) { readFile(e.target.files[0]); };
  var drop = $('cp-drop');
  ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
  drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); readFile(e.dataTransfer.files[0]); });
  /* 送去「课文榨干」：把这段文本写进它的「上次打开」（它自己的存储键），那边打开就是这一篇 */
  $('cp-to-sq').onclick = function () {
    var t = $('cp-text').value.trim(); if (!t) return;
    try { var s = JSON.parse(localStorage.getItem('english-hub-squeeze')) || {}; s.last = { text: t, title: $('cp-title').value.trim() }; localStorage.setItem('english-hub-squeeze', JSON.stringify(s)); } catch (e) {}
  };
  paint();
})();
