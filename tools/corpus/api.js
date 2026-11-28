/* 个人语料 · 接口 window.EHCorpus。纯本地：只读 EH.state 与 data/corpus.js，只写 EH.state.notes.corpus（不新增顶层存储键，备份仍是 v:1）。
   用法：页面先载 assets/app.js、data/corpus.js，再载本文件。
   见面次数＝学过（勾了「学」）的本站文章里的命中数（与首页 EHPlan.met 同一份数据）＋自己加入的文本里的命中数。
   掌握＝见面 ≥ min_seen 次 且 该词块的复习卡连续通过 ≥ min_pass 次（SM-2 的 n；答错归零）。 */
(function () {
  'use strict';
  var C = window.EH_CORPUS;
  if (!C || !window.EH) return;
  var S = EH.state, NOTE = 'corpus', MIN = C.min_seen, PASS = C.min_pass;
  function key(w) { return String(w == null ? '' : w).replace(/[*_]/g, '').replace(/’/g, "'").toLowerCase().replace(/\s+/g, ' ').trim(); }
  var byKey = {}, artIx = {}, per = C.arts.map(function () { return {}; }), total = [];
  C.chunks.forEach(function (c, i) {
    byKey[key(c.w)] = i; total.push(c.h.length);
    c.h.forEach(function (h) { per[h[0]][i] = (per[h[0]][i] || 0) + 1; });
  });
  C.arts.forEach(function (a, i) { artIx[a.id] = i; });

  /* ---------- 存储：notes.corpus = { text:'', t, hist:{日期:[掌握,见过≥10,见过≥1]}, own:{id:{title,d,words,w:{词块:次数},s:{词块:[原句]}}}, checks:[{d,n,ok,out:[词块]}] } ---------- */
  function box() { var n = S.notes[NOTE]; return n && typeof n === 'object' ? n : null; }
  function wbox() {
    var n = box() || (S.notes[NOTE] = { text: '', t: '' });
    if (!n.hist || typeof n.hist !== 'object') n.hist = {};
    if (!n.own || typeof n.own !== 'object') n.own = {};
    if (!Array.isArray(n.checks)) n.checks = [];
    return n;
  }
  function commit() { wbox().t = new Date().toISOString(); EH.save(); }
  function ownTexts() { var b = box(); return (b && b.own) || {}; }

  /* ---------- 见面次数 ---------- */
  function learnedOn(id) { var L = S.lessons[id]; return (L && L.steps && L.steps.learn) || ''; }
  function readArts(opt) {
    opt = opt || {}; var out = [];
    C.arts.forEach(function (a, i) {
      var d = learnedOn(a.id);
      if (!d || a.id === opt.skip || (opt.before && d >= opt.before) || (opt.upto && d > opt.upto)) return;
      out.push(i);
    });
    return out;
  }
  /* → 按词块序号排的次数数组。opt: skip（不算这篇）、before / upto（按学的日期截）、site（只算本站文章） */
  function counts(opt) {
    opt = opt || {}; var n = C.chunks.map(function () { return 0; });
    readArts(opt).forEach(function (ai) { for (var ci in per[ai]) n[ci] += per[ai][ci]; });
    if (!opt.site) {
      var own = ownTexts();
      for (var id in own) {
        var o = own[id];
        if ((opt.before && o.d >= opt.before) || (opt.upto && o.d > opt.upto)) continue;
        for (var w in (o.w || {})) if (w in byKey) n[byKey[w]] += o.w[w];
      }
    }
    return n;
  }
  function seen(chunk, opt) { var i = byKey[key(chunk)]; return i === undefined ? 0 : counts(opt)[i]; }
  function unseenIn(articleId) {
    var ai = artIx[articleId]; if (ai === undefined) return [];
    var n = counts({ skip: articleId });
    return Object.keys(per[ai]).filter(function (ci) { return !n[ci]; }).map(function (ci) { return C.chunks[ci].w; });
  }

  /* ---------- 复习状态：一个词块可能有几张卡（单元词卡 <单元>#w:<词>、新词卡 lw:<id>、词条卡 wp:<词>、本页加的 corpus:<词>），取连续通过数最高的 ---------- */
  function cardIndex() {
    var ix = {}, lw = {};
    C.chunks.forEach(function (c, i) { if (c.lw) lw['lw:' + c.lw] = i; });
    for (var id in S.cards) {
      var m = /#w:(.+)$/.exec(id), i;
      if (m) i = byKey[key(m[1])];
      else if (id in lw) i = lw[id];
      else if (id.indexOf('wp:') === 0) i = byKey[key(id.slice(3))];
      else if (id.indexOf('corpus:') === 0) i = byKey[key(id.slice(7))];
      else continue;
      if (i !== undefined) (ix[i] = ix[i] || []).push(S.cards[id]);
    }
    return ix;
  }
  function cardState(cards) {
    if (!cards || !cards.length) return { has: false, n: 0, ids: [] };
    var best = cards[0];
    cards.forEach(function (c) { if ((c.n || 0) > (best.n || 0)) best = c; });
    return { has: true, n: best.n || 0, due: best.due, reps: best.reps || 0, lapses: best.lapses || 0, ids: cards.map(function (c) { return c.id; }) };
  }
  function group(n, card) {
    if (!n) return 'unmet';
    if (n >= MIN) return card.n >= PASS ? 'mastered' : 'review';
    return n >= MIN - 4 ? 'near' : n >= 2 ? 'building' : 'once';
  }
  /* 每个词块一行：{ i, w, zh, n, site, own, total, card, group } */
  function snapshot(opt) {
    var n = counts(opt), ns = counts({ site: true, skip: opt && opt.skip, before: opt && opt.before, upto: opt && opt.upto }), ix = cardIndex();
    return C.chunks.map(function (c, i) {
      var card = cardState(ix[i]);
      return { i: i, w: c.w, zh: c.zh, n: n[i], site: ns[i], own: n[i] - ns[i], total: total[i], card: card, group: group(n[i], card) };
    });
  }
  function mastered() { return snapshot().filter(function (r) { return r.group === 'mastered'; }).map(function (r) { return r.w; }); }
  function status(chunk) { var i = byKey[key(chunk)]; return i === undefined ? null : snapshot()[i]; }

  /* 原句：{ read:[{art, sents:[{t,a,n}]}], unread:[{art,n}], own:[{id,title,n,sents:[t]}] } */
  function where(chunk) {
    var i = byKey[key(chunk)], out = { read: [], unread: [], own: [] };
    if (i === undefined) return out;
    var by = {};
    C.chunks[i].h.forEach(function (h) { (by[h[0]] = by[h[0]] || []).push({ t: C.sents[h[1]], a: h[2], n: h[3] }); });
    Object.keys(by).forEach(function (ai) {
      var a = C.arts[ai];
      if (learnedOn(a.id)) out.read.push({ art: a, sents: by[ai] }); else out.unread.push({ art: a, n: by[ai].length });
    });
    var own = ownTexts(), k = key(chunk);
    for (var id in own) if (own[id].w && own[id].w[k]) out.own.push({ id: id, title: own[id].title, n: own[id].w[k], sents: (own[id].s || {})[k] || [] });
    return out;
  }

  /* ---------- 再读哪篇：没读过的文章按「能补上几次见面」排；快到 10 次的词块加倍 ---------- */
  function suggest(limit) {
    var n = counts(), out = [];
    C.arts.forEach(function (a, ai) {
      if (learnedOn(a.id)) return;
      var gain = 0, score = 0, list = [];
      for (var ci in per[ai]) {
        var have = n[ci]; if (!have || have >= MIN) continue;
        var add = Math.min(per[ai][ci], MIN - have);
        gain += add; score += add * (have >= MIN - 4 ? 2 : 1);
        list.push({ w: C.chunks[ci].w, have: have, add: add });
      }
      if (gain) { list.sort(function (x, y) { return y.have - x.have || y.add - x.add; }); out.push({ art: a, gain: gain, score: score, chunks: list }); }
    });
    out.sort(function (x, y) { return y.score - x.score || y.gain - x.gain; });
    return out.slice(0, limit || 5);
  }

  /* ---------- 自己的文本：只在本机统计。同一段文本贴两次只算一次（id＝内容哈希） ---------- */
  var RX = {};
  function rx(i) {
    if (!RX[i]) {
      try { RX[i] = new RegExp(C.chunks[i].rx, 'i'); }
      catch (e) { RX[i] = new RegExp(C.chunks[i].rx.replace('(?<![\\w-])', '\\b'), 'i'); } // 不支持后行断言的旧浏览器
    }
    return RX[i];
  }
  function plain(text) { // 字幕文件：去掉时间轴、序号、标签
    return String(text || '').replace(/\r/g, '').split('\n').filter(function (l) { return !/-->/.test(l) && !/^\s*\d+\s*$/.test(l) && !/^WEBVTT/.test(l); })
      .join('\n').replace(/<[^>]+>/g, '');
  }
  function sentences(text) {
    var out = [];
    plain(text).split(/\n+/).forEach(function (p) {
      p = p.replace(/\s+/g, ' ').trim();
      if (p) p.split(/(?<=[.!?])\s+(?=[A-Z“"])/).forEach(function (s) { if (s.trim()) out.push(s.trim()); });
    });
    return out;
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'o' + (h >>> 0).toString(36); }
  /* → { id, words, sents, w:{词块:次数}, s:{词块:[原句]} }；每个词块每句至多算一次（与构建时的口径一致） */
  function analyse(text) {
    var ss = sentences(text), body = ss.join(' '), w = {}, s = {};
    C.chunks.forEach(function (c, i) {
      var r = rx(i); if (!r.test(body)) return;
      var k = key(c.w);
      ss.forEach(function (t) { if (r.test(t)) { w[k] = (w[k] || 0) + 1; if ((s[k] = s[k] || []).length < 2) s[k].push(t.slice(0, 320)); } });
      if (!w[k]) delete s[k];
    });
    return { id: hash(EH.norm(body)), words: (body.match(/[A-Za-z][A-Za-z’'-]*/g) || []).length, sents: ss.length, w: w, s: s };
  }
  function addText(text, title) {
    var a = analyse(text); if (!a.sents) return null;
    var before = counts(), b = wbox(), dup = !!b.own[a.id];
    a.fresh = Object.keys(a.w).filter(function (k) { return !before[byKey[k]]; });
    if (!dup) b.own[a.id] = { title: String(title || '').slice(0, 80) || text.replace(/\s+/g, ' ').trim().slice(0, 40), d: EH.today(), words: a.words, w: a.w, s: a.s };
    a.dup = dup; a.title = b.own[a.id].title;
    commit(); record();
    return a;
  }
  function removeText(id) { var b = box(); if (b && b.own && b.own[id]) { delete b.own[id]; commit(); record(); } }

  /* ---------- 词汇量曲线：每天记一次（当天再打开就更新当天那个点） ---------- */
  function record() {
    var snap = snapshot(), m = 0, ten = 0, any = 0;
    snap.forEach(function (r) { if (r.n) any++; if (r.n >= MIN) ten++; if (r.group === 'mastered') m++; });
    var b = box();
    if (!any && !(b && b.hist && Object.keys(b.hist).length)) return null; // 还没读过任何东西：不写存储
    var t = EH.today(), old = b && b.hist && b.hist[t];
    if (!old || old[0] !== m || old[1] !== ten || old[2] !== any) { wbox().hist[t] = [m, ten, any]; commit(); }
    return [m, ten, any];
  }
  function history() {
    var h = (box() || {}).hist || {};
    return Object.keys(h).sort().map(function (d) { return { d: d, mastered: h[d][0], met10: h[d][1], met: h[d][2] }; });
  }

  /* ---------- 七天抽测：从已掌握里抽 check_n 个挖空；没过的降级（复习卡按「忘了」打分 → 连续通过数归零） ---------- */
  function lastCheck() { var c = ((box() || {}).checks || []); return c.length ? c[c.length - 1] : null; }
  function daysBetween(a, b) { var p = a.split('-'), q = b.split('-'); return Math.round((new Date(+q[0], +q[1] - 1, +q[2]) - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5); }
  function checkDue() {
    var L = lastCheck(), n = mastered().length;
    if (!n) return { due: false, n: 0, last: L };
    if (L) { var gone = daysBetween(L.d, EH.today()); return { due: gone >= C.check_days, n: n, last: L, inDays: Math.max(0, C.check_days - gone) }; }
    var h = history().filter(function (x) { return x.mastered > 0; })[0]; // 没测过：从第一次有掌握数那天起算 7 天
    var since = h ? daysBetween(h.d, EH.today()) : 0;
    return { due: since >= C.check_days, n: n, last: null, inDays: Math.max(0, C.check_days - since) };
  }
  function drawCheck(limit, rnd) {
    rnd = rnd || Math.random;
    var pool = mastered().slice(), items = [];
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
    pool.slice(0, limit || C.check_n).forEach(function (w) {
      var wh = where(w), cands = [];
      wh.read.forEach(function (r) { r.sents.forEach(function (s) { cands.push(s); }); });
      if (!cands.length) wh.own.forEach(function (o) { o.sents.forEach(function (t) { var m = rx(byKey[key(w)]).exec(t); if (m) cands.push({ t: t, a: m.index, n: m[0].length }); }); });
      if (!cands.length) C.chunks[byKey[key(w)]].h.slice(0, 3).forEach(function (h) { cands.push({ t: C.sents[h[1]], a: h[2], n: h[3] }); });
      if (!cands.length) return;
      var s = cands[Math.floor(rnd() * cands.length)];
      items.push({ w: w, zh: C.chunks[byKey[key(w)]].zh, before: s.t.slice(0, s.a), answer: s.t.substr(s.a, s.n), after: s.t.slice(s.a + s.n) });
    });
    return items;
  }
  function judge(item, given) {
    var g = EH.norm(given); if (!g) return false;
    if (g === EH.norm(item.answer) || g === EH.norm(item.w)) return true;
    var m = rx(byKey[key(item.w)]).exec(String(given).trim());
    return !!m && m.index === 0 && m[0].length === String(given).trim().length;
  }
  function demote(chunk) {
    var st = status(chunk); if (!st) return 0;
    var n = 0;
    st.card.ids.forEach(function (id) { if ((S.cards[id].n || 0) >= 1) { EH.grade(id, 2); n++; } });
    return n;
  }
  /* results: [{w, ok}] → 记一次抽测；没过的降级 */
  function finishCheck(results) {
    var out = results.filter(function (r) { return !r.ok; }).map(function (r) { return r.w; });
    out.forEach(demote);
    wbox().checks.push({ d: EH.today(), n: results.length, ok: results.length - out.length, out: out });
    commit(); record();
    return { n: results.length, ok: results.length - out.length, out: out };
  }
  /* 把一个还没有复习卡的词块放进复习：正面是读过的句子挖空 */
  function addCard(chunk) {
    var i = byKey[key(chunk)]; if (i === undefined) return false;
    var c = C.chunks[i], wh = where(chunk), s = null;
    if (wh.read.length) s = wh.read[0].sents[0]; else if (c.h.length) s = { t: C.sents[c.h[0][1]], a: c.h[0][2], n: c.h[0][3] };
    var front = s ? s.t.slice(0, s.a) + '_____' + s.t.slice(s.a + s.n) : c.w;
    var ok = EH.addCard({ id: c.lw ? 'lw:' + c.lw : 'corpus:' + key(c.w), kind: 'word', lesson: 'corpus', front: front, back: c.w + (s ? ' — ' + s.t : ''),
      extra: { zh: c.zh, ipa: c.ipa || '', unit: 'My corpus · ' + c.ue, hint: s ? c.zh : '' } });
    EH.touch(); EH.save();
    return ok;
  }

  window.EHCorpus = {
    seen: seen, unseenIn: unseenIn, mastered: mastered,
    counts: counts, snapshot: snapshot, status: status, where: where, suggest: suggest,
    analyse: analyse, addText: addText, removeText: removeText, texts: ownTexts,
    record: record, history: history,
    checkDue: checkDue, drawCheck: drawCheck, judge: judge, finishCheck: finishCheck, demote: demote, addCard: addCard,
    key: key, MIN_SEEN: MIN, MIN_PASS: PASS
  };
  record();
})();
