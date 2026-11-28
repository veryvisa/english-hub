/* 新词学习页：选一组 → 每词四步（认词 → 听读 → 小测 → 进生词本／间隔复习）。进度存 EH.state.learn（与复习、错题同一个本地存储、同一个备份文件）。 */
(function () {
  'use strict';
  var E = EH.esc, T = EH.T, S = EH.state, L = window.EH_LEARN, Q = window.EH_QUIZ || {};
  var CFG_KEY = 'english-hub-learn';
  var cfg = (function () { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; } })();
  cfg.goal = cfg.goal || 10; cfg.tab = cfg.tab || 'level';
  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
  S.learn = S.learn || {};
  var BY = EHCard.byId;
  var SKZH = { vocab: '词汇', read: '文章', grammar: '语法', pron: '语音' };

  function setIds(key) {
    var p = key.split(':'), kind = p.shift(), id = p.join(':');
    var s = L.sets[kind] && L.sets[kind][id];
    return s ? (s.ids || s) : [];
  }
  function setName(key) {
    var p = key.split(':'), kind = p.shift(), id = p.join(':');
    if (kind === 'level') return T('Level ' + id, id + ' 级');
    if (kind === 'unit') { var u = L.units[id] || {}; return T(E(u.en || id), E(u.zh || '')); }
    if (kind === 'topic') { var t = L.topics[id] || {}; return T(E(t.en || id), E(t.zh || '')); }
    if (kind === 'book') { var b = L.sets.book[id]; return 'English File 5e ' + E(b.level) + ' ' + E(b.unit) + ' <span class="en">“' + E(b.name) + '”</span>'; }
    return E(key);
  }
  function learnedToday() { var t = EH.today(), n = 0; for (var k in S.learn) if (S.learn[k].d === t) n++; return n; }
  function prog(ids) { var n = 0; ids.forEach(function (i) { if (S.learn[i]) n++; }); return n; }
  function bar(n, of) { var pc = of ? Math.round(100 * n / of) : 0; return '<span class="pbar"><i style="width:' + pc + '%"></i></span> <span class="muted">' + n + '/' + of + '</span>'; }

  function stats() {
    var tot = Object.keys(S.learn).length, due = EH.due().length, wrong = Object.keys(S.wrong).filter(function (k) { return !S.wrong[k].cleared && k.indexOf('lw:') === 0; }).length;
    var opts = [5, 10, 15, 20, 30].map(function (n) { return '<option' + (n === cfg.goal ? ' selected' : '') + '>' + n + '</option>'; }).join('');
    document.getElementById('learn-stats').innerHTML =
      '<div><b>' + T('Today', '今天') + '</b> ' + bar(learnedToday(), cfg.goal) + ' <label>' + T('New words a day', '每天新词') + ' <select id="goal">' + opts + '</select></label></div>' +
      '<div><b>' + T('All new words', '全部新词') + '</b> ' + bar(tot, L.words.length) + '</div>' +
      '<div><a href="review.html">' + T('Due for review', '到期复习') + ' <b>' + due + '</b></a> · <a href="wrong.html">' + T('New-word mistakes', '新词错题') + ' <b>' + wrong + '</b></a></div>';
    document.getElementById('goal').onchange = function (e) { cfg.goal = +e.target.value; saveCfg(); stats(); };
  }

  function item(key, label, sub) {
    var ids = setIds(key), n = prog(ids);
    return '<li class="lset' + (n === ids.length ? ' done' : '') + '"><button class="small primary" data-start="' + E(key) + '">' + (n ? T('Continue', '继续') : T('Start', '开始')) + '</button> ' +
      '<span class="lname">' + label + '</span> ' + (sub || '') + ' ' + bar(n, ids.length) + '</li>';
  }
  function pick() {
    document.querySelectorAll('#ltabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === cfg.tab); });
    var box = document.getElementById('lpick'), out = [];
    if (cfg.tab === 'level') {
      ['B1', 'B2', 'C1'].forEach(function (lv) { if (L.sets.level[lv]) out.push(item('level:' + lv, T('Level ' + lv, lv + ' 级'), '')); });
      box.innerHTML = '<p class="muted">' + T('Start at B2 and move to C1: the order follows the learning map.', '从 B2 学到 C1：顺序与学习地图一致。') + '</p><ul class="lsets">' + out.join('') + '</ul>';
    } else if (cfg.tab === 'book') {
      var cur = '';
      Object.keys(L.sets.book).forEach(function (k) {
        var b = L.sets.book[k];
        if (b.level !== cur) { cur = b.level; out.push('<li class="lhead">English File 5e ' + E(cur) + '</li>'); }
        out.push(item('book:' + k, '<b>' + E(b.unit) + '</b> <span class="en">' + E(b.name) + '</span>', ''));
      });
      box.innerHTML = '<p class="muted">' + T('Studied a lesson in your coursebook? Pick the same lesson here for its new-word set. Lesson numbers and titles come from Oxford’s contents page; no coursebook text is used.', '在教材里学完一课，在这里选同一课学它的新词组。课次与课题取自牛津官方目录；不含教材正文。') + '</p><ul class="lsets">' + out.join('') + '</ul>';
    } else if (cfg.tab === 'topic') {
      Object.keys(L.sets.topic).sort(function (a, b) { return L.sets.topic[b].length - L.sets.topic[a].length; }).forEach(function (k) { out.push(item('topic:' + k, setName('topic:' + k), '')); });
      box.innerHTML = '<ul class="lsets">' + out.join('') + '</ul>';
    } else if (cfg.tab === 'unit') {
      Object.keys(L.sets.unit).forEach(function (k) { var u = L.units[k] || {}; out.push(item('unit:' + k, setName('unit:' + k), '<span class="chip">' + E(u.level || '') + ' ' + T(E(u.skill || ''), SKZH[u.skill] || '') + '</span>')); });
      box.innerHTML = '<ul class="lsets">' + out.join('') + '</ul>';
    } else mine(box);
    box.querySelectorAll('[data-start]').forEach(function (b) { b.onclick = function () { start(b.dataset.start); }; });
  }

  function mine(box) {
    var cs = Object.keys(S.cards).filter(function (k) { return /^l[wd]:/.test(k); }).map(function (k) { return S.cards[k]; })
      .sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    if (!cs.length) { box.innerHTML = '<p class="muted">' + T('Empty. Words you finish or add from a card land here and in your review queue.', '空的。学完或在卡片上加入的词会进这里，也进复习队列。') + '</p>'; return; }
    var t = EH.today();
    box.innerHTML = '<p class="muted">' + cs.length + ' ' + T('words. Review them on the review page; due ones are marked.', '个词。去复习页复习；到期的有标记。') + ' <a href="review.html">' + T('Review now', '去复习') + '</a></p>' +
      '<div class="tw"><table class="vt"><tr><th>' + T('Word', '词') + '</th><th>' + T('Meaning', '释义') + '</th><th>' + T('Next review', '下次复习') + '</th><th>' + T('Reviews', '复习次数') + '</th></tr>' +
      cs.map(function (c) {
        var id = c.id.slice(3), x = c.extra || {};
        return '<tr><td><button class="chip ' + (c.id.charAt(1) === 'w' ? 'wc-go" data-wid="' + E(id) : 'wc-look" data-look="' + E(id)) + '">' + E(c.front) + '</button></td><td class="zh" lang="zh-Hans">' + E(x.zh || '') + '</td><td>' + (c.due <= t ? '⏰ ' : '') + E(c.due) + '</td><td>' + (c.reps || 0) + '</td></tr>';
      }).join('') + '</table></div>';
  }

  /* ---------- 学习一组 ---------- */
  var sess = null;
  function start(key) {
    cfg.set = key; saveCfg();
    var ids = setIds(key).filter(function (i) { return !S.learn[i]; });
    var left = Math.max(cfg.goal - learnedToday(), 0);
    sess = { key: key, queue: ids.slice(0, left || 5), extra: !left, done: [], i: 0 };
    if (history.replaceState) history.replaceState(null, '', '#set=' + key);
    if (!ids.length) { sessBox('<p>🎉 ' + T('You have learned every word in this set.', '这一组的词都学完了。') + '</p>' + reviewNudge()); return; }
    step(0);
    document.getElementById('lsession').scrollIntoView({ behavior: 'smooth' });
  }
  function reviewNudge() { var d = EH.due().length; return d ? '<p><a class="primary-link" href="review.html">' + T(d + ' cards are due. Review them now.', '有 ' + d + ' 张卡到期，去复习。') + '</a></p>' : ''; }
  function sessBox(inner) {
    var b = L.sets.book && sess && sess.key.indexOf('book:') === 0 ? L.sets.book[sess.key.slice(5)] : null;
    var app = b ? '<p class="appref">📘 <span class="enx">In your coursebook: English File 5e · ' + E(b.level) + ' · ' + E(b.unit) + ' “' + E(b.name) + '”. Use the texts and recordings with your coursebook.</span><span class="zh" lang="zh-Hans">教材定位：English File 5e · ' + E(b.level) + ' · ' + E(b.unit) + '《' + E(b.name) + '》。课文与录音请配合教材学习。</span></p>' : '';
    document.getElementById('lsession').innerHTML = '<div class="lsess"><div class="lsess-h"><b>' + (sess ? setName(sess.key) : '') + '</b>' +
      (sess && sess.queue.length ? ' <span class="muted">' + T('Word', '第') + ' ' + Math.min(sess.i + 1, sess.queue.length) + '/' + sess.queue.length + (sess.extra ? ' · ' + T('extra beyond today’s goal', '超出今日目标的加练') : '') + '</span>' : '') +
      ' <button class="small" id="sess-x">' + T('Close', '收起') + '</button></div>' + app + inner + '</div>';
    document.getElementById('sess-x').onclick = function () { document.getElementById('lsession').innerHTML = ''; sess = null; pick(); stats(); };
  }
  var STEPS = [['Meet', '认词'], ['Listen and say', '听读'], ['Check', '小测'], ['Keep', '进生词本']];
  function stepBar(k) { return '<div class="lsteps">' + STEPS.map(function (s, i) { return '<span class="' + (i < k ? 'ok' : i === k ? 'cur' : '') + '">' + (i + 1) + ' ' + T(s[0], s[1]) + '</span>'; }).join('<span class="arr">›</span>') + '</div>'; }

  function step(k) {
    if (sess.i >= sess.queue.length) return finish();
    var id = sess.queue[sess.i], w = BY[id];
    if (k === 0) {
      sessBox(stepBar(0) + '<div id="lcard"></div><div class="lnav"><button class="primary" id="nx">' + T('Next: listen and say', '下一步：听读') + '</button> <button id="known">' + T('I already know it', '已经会了，跳过') + '</button></div>');
      EHCard.render(document.getElementById('lcard'), id);
      document.getElementById('nx').onclick = function () { step(1); };
      document.getElementById('known').onclick = function () { S.learn[id] = { d: EH.today(), st: 'known', set: sess.key }; EH.touch(); EH.save(); next(); };
    } else if (k === 1) {
      var ex = w.ex[0] ? w.ex[0].en : (w.coll[0] || w.w);
      sessBox(stepBar(1) + '<div class="lsay"><div class="big en">' + E(w.w) + '</div><div class="ipa">' + E(w.ipa) + '</div>' +
        '<p><button data-wsay="' + E(w.w) + '" data-lang="en-GB">🔊 UK</button> <button data-wsay="' + E(w.w) + '" data-lang="en-US">🔊 US</button> <button data-wsay="' + E(w.w) + '" data-lang="en-GB" data-rate="0.55">🐢 ' + T('slow', '慢速') + '</button></p>' +
        '<p class="en">' + E(ex) + ' <button data-wsay="' + E(ex) + '" data-lang="en-GB" data-rate="0.85">🔊</button></p>' +
        '<p>' + T('Say the word, then the sentence, out loud. Record yourself and compare:', '先读词，再读整句，出声。录下来对比：') + ' <button class="rec" data-max="8">🎙 ' + T('Record 8 s', '录 8 秒') + '</button></p></div>' +
        '<div class="lnav"><button class="primary" id="nx">' + T('I said it: quick check', '读过了：小测') + '</button> <button id="bk">' + T('Back to the card', '回到卡片') + '</button></div>');
      EHCard.say(w.w, 'en-GB', 0.9);
      document.getElementById('nx').onclick = function () { step(2); };
      document.getElementById('bk').onclick = function () { step(0); };
    } else if (k === 2) {
      var qs = (w.q || []).map(function (x) { return Q[x]; }).filter(Boolean);
      sessBox(stepBar(2) + '<div id="lq"></div><div class="lnav"><button class="primary" id="nx" disabled>' + T('Answer all to go on', '答完才能继续') + '</button></div>');
      var res = null;
      if (!qs.length) { document.getElementById('nx').disabled = false; document.getElementById('nx').innerHTML = T('Next', '继续'); }
      EHQuiz.render(document.getElementById('lq'), qs, { onAnswer: function (r, total) {
        res = r; var n = Object.keys(r).length;
        if (n >= total) { var b = document.getElementById('nx'); b.disabled = false; b.innerHTML = T('Keep it: add to my word book', '收下：加入生词本'); }
      } });
      document.getElementById('nx').onclick = function () {
        var ok = 0, all = 0; for (var q in (res || {})) { all++; if (res[q]) ok++; }
        keep(id, ok, all);
      };
    }
  }
  function keep(id, ok, all) {
    var w = BY[id];
    EHCard.add({ site: w, d: null, cid: 'lw:' + id, head: w.w });
    S.learn[id] = { d: EH.today(), st: 'learned', ok: ok, of: all, set: sess.key };
    EH.touch(); EH.save();
    sess.done.push(id);
    sessBox(stepBar(3) + '<p>✅ <b class="en">' + E(w.w) + '</b> ' + T('is in your word book and review queue.', '已进生词本和复习队列。') + ' ' + (all ? ok + '/' + all + ' ' + T('right', '题答对') + (ok < all ? ' · ' + T('the ones you missed are in the mistake book', '答错的已进错题本') : '') : '') + '</p>' +
      '<div class="lnav"><button class="primary" id="nx">' + (sess.i + 1 < sess.queue.length ? T('Next word', '下一个词') : T('Finish', '完成')) + '</button></div>');
    document.getElementById('nx').onclick = next;
  }
  function next() { sess.i++; stats(); step(0); }
  function finish() {
    var ws = sess.done.map(function (i) { return '<button class="chip wc-go" data-wid="' + i + '">' + E(BY[i].w) + '</button>'; }).join(' ');
    sessBox('<p>🎉 ' + T('Done for now: ', '这一轮完成：') + sess.done.length + ' ' + T('words learned.', '个新词。') + '</p><p>' + ws + '</p>' + reviewNudge() +
      '<div class="lnav"><button class="primary" id="more">' + T('5 more from this set', '这一组再学 5 个') + '</button></div>');
    var key = sess.key;
    document.getElementById('more').onclick = function () {
      var ids = setIds(key).filter(function (i) { return !S.learn[i]; });
      sess = { key: key, queue: ids.slice(0, 5), extra: true, done: [], i: 0 };
      if (!ids.length) sessBox('<p>🎉 ' + T('You have learned every word in this set.', '这一组的词都学完了。') + '</p>'); else step(0);
    };
    stats(); pick();
  }

  /* ---------- 查词 ---------- */
  function look() { var v = document.getElementById('lk-in').value.trim(); if (v) EHCard.render(document.getElementById('lk-out'), v); }
  document.getElementById('lk-go').onclick = look;
  document.getElementById('lk-in').onkeydown = function (e) { if (e.key === 'Enter') look(); };
  document.getElementById('ltabs').onclick = function (e) { var b = e.target.closest('[data-tab]'); if (b) { cfg.tab = b.dataset.tab; saveCfg(); pick(); } };

  stats(); pick();
  var hm = location.hash.match(/^#(set|w)=(.+)$/);
  if (hm && hm[1] === 'set' && setIds(decodeURIComponent(hm[2])).length) {
    var k = decodeURIComponent(hm[2]), kind = k.split(':')[0]; cfg.tab = kind === 'level' ? 'level' : kind; pick(); start(k);
  } else if (hm && hm[1] === 'w') EHCard.pop(decodeURIComponent(hm[2]));
  window.EHLearn = { start: start, setIds: setIds };
})();
