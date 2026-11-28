/* today.html：一天的闭环在同一页里一步接一步走完（总纲 §十.2）。三档时长（data/today.js 的 modes，唯一源 bin/build.py::LOOP_MODES）。
   每步有计时与「跳过」；主文按本机读过的文章标出「没见过的词块」；第 3 步的例句只取自今天的主文与同主题文章。
   当天记录写在 EH.state.days[日期]：secs（各步用时）、skip（跳过的步）、fin（手动结束的步）、kp、contrast、speak、base（B1 底子卡数）。
   不新增顶层存储键，备份格式 v:1 不变。 */
(function () {
  'use strict';
  var box = document.getElementById('day');
  if (!box || !window.EH_TODAY || !window.EH_MAP) return;
  var T = EH.T, E = EH.esc, S = EH.state, D = window.EH_TODAY, DK = window.EH_TODAYKP || { kp: {}, base: [] }, M = window.EH_MAP, P;
  var t = EH.today();
  function day() { return S.days[t] || (S.days[t] = {}); }
  function bag(k) { var d = day(); return d[k] || (d[k] = {}); }
  function name(k) { return T(D.names[k].en, D.names[k].zh); }
  function uLink(u) { return '<a href="u/' + u.id + '.html"><span class="en">' + E(u.en) + '</span> <span class="zh" lang="zh-Hans">' + E(u.zh) + '</span></a>'; }
  function load(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = function () { cb(true); }; s.onerror = function () { cb(false); }; document.body.appendChild(s); }
  function mmss(n) { n = Math.round(n || 0); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); }
  function total() { return P.steps.reduce(function (a, s) { return a + s[1]; }, 0); }

  /* ---------- 计时：只在某一步展开、页面可见时走 ---------- */
  var cur = null, tick = 0;
  setInterval(function () {
    if (!cur || document.hidden) return;
    var secs = bag('secs'); secs[cur] = (secs[cur] || 0) + 1;
    var el = document.querySelector('.dstep[data-k="' + cur + '"] .clock'); if (el) el.textContent = mmss(secs[cur]);
    if (cur === 'review') nudge();
    if (++tick % 10 === 0) EH.save();
  }, 1000);
  window.addEventListener('pagehide', function () { EH.save(); });
  function nudge() { // 复习超过当天三分之一：提示去学新的
    var r = (day().secs || {}).review || 0, cap = total() * 60 * D.quota.review_share, n = document.getElementById('review-nudge');
    n.hidden = r <= cap;
    if (!n.hidden) n.innerHTML = T('Review has taken more than a third of today’s time. Leave the rest for tomorrow and go on to something new.', '复习已经超过今天时间的三分之一。剩下的留给明天，去学新的吧。') + ' <button class="small" data-act="next">' + T('Go to the next step', '去下一步') + '</button>';
  }

  /* ---------- 步骤框架 ---------- */
  function paint(keep) {
    P = EHPlan.plan(M);
    document.querySelectorAll('.mtab').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === P.mode); });
    var tp = P.topic;
    document.getElementById('day-topic').innerHTML = tp ? T('Topic this week: ', '本周主题：') + '<a href="t/' + tp.id + '.html"><span class="en">' + E(tp.en) + '</span> <span class="zh" lang="zh-Hans">' + E(tp.zh) + '</span></a> · ' + P.mode + ' min' : T('No topic is open yet.', '还没有开放的主题。');
    box.innerHTML = P.steps.map(function (s, i) {
      var k = s[0], d = P.done[k], sk = !d && P.skip[k];
      return '<li class="dstep' + (d ? ' done' : '') + (sk ? ' skipped' : '') + '" data-k="' + k + '"><div class="dh"><span class="tick">' + (d ? '✓' : sk ? '–' : i + 1) + '</span>' +
        '<b>' + name(k) + '</b> <span class="muted"><span class="clock">' + mmss((day().secs || {})[k]) + '</span> / ' + s[1] + ' min</span>' +
        '<span class="acts"><button class="small" data-act="open">' + T('Open', '展开') + '</button> <button class="small" data-act="skip">' + T('Skip', '跳过') + '</button></span></div><div class="db" hidden></div></li>';
    }).join('');
    summary();
    var first = P.steps.filter(function (s) { return !P.done[s[0]] && !P.skip[s[0]]; })[0];
    openStep(keep !== undefined ? keep : first ? first[0] : null);
  }
  function openStep(k) {
    document.querySelectorAll('.dstep .db').forEach(function (b) { b.hidden = true; b.innerHTML = ''; });
    document.querySelectorAll('.dstep').forEach(function (li) { li.classList.remove('cur'); });
    cur = k; EH.save();
    if (!k) return;
    var li = document.querySelector('.dstep[data-k="' + k + '"]'), db = li.querySelector('.db');
    li.classList.add('cur'); db.hidden = false;
    (R[k] || function () {})(db);
    if (k === 'review') nudge(); else document.getElementById('review-nudge').hidden = true;
  }
  function nextStep(from) {
    P = EHPlan.plan(M);
    var ks = P.steps.map(function (s) { return s[0]; }), i = ks.indexOf(from);
    var rest = ks.slice(i + 1).concat(ks.slice(0, i)).filter(function (k) { return !P.done[k] && !P.skip[k]; });
    paint(rest[0] || null);
  }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var k = b.closest('.dstep').dataset.k, a = b.dataset.act;
    if (a === 'open') openStep(cur === k ? null : k);
    else if (a === 'skip') { bag('skip')[k] = 1; EH.save(); nextStep(k); }
    else if (a === 'done') { bag('fin')[k] = 1; EH.save(); nextStep(k); }
  });
  document.getElementById('review-nudge').addEventListener('click', function (e) { if (e.target.closest('[data-act="next"]')) { bag('fin').review = 1; EH.save(); nextStep('review'); } });
  document.querySelectorAll('.mtab').forEach(function (b) { b.onclick = function () { EHPlan.setMode(b.dataset.mode); paint(); }; });
  function doneBtn(label) { return '<p class="dnext"><button class="primary" data-act="done">' + (label || T('Done, next step', '完成，下一步')) + '</button></p>'; }

  /* ---------- 各步 ---------- */
  var R = {};
  R.review = function (db) {
    var d = day();
    // B1 底子：到期卡少于 5 张时，每天补最多 5 张 B1 卡进复习池（不算新知识点）
    if (!d.base && EH.due().length < 5) {
      var n = 0;
      DK.base.forEach(function (c) { if (n < 5 && !S.cards[c.id]) { EH.addCard(JSON.parse(JSON.stringify(c))); n++; } });
      d.base = n || -1; EH.save();
    }
    var q = EH.due(), shown = 0;
    var show = function () {
      if (!q.length) {
        db.innerHTML = '<p>🎉 ' + T('Nothing left to review today.', '今天的复习做完了。') + ' ' + T('Reviewed: ', '本次复习：') + shown + '</p>' + doneBtn();
        return;
      }
      var c = q[0], x = c.extra || {};
      db.innerHTML = '<p class="muted">' + q.length + ' ' + T('due', '张到期') + (x.base ? ' · B1 ' + T('base', '底子') : '') + '</p><div class="rcard"><div class="kind">' + E(x.unit || '') + '</div>' +
        '<div class="front en">' + E(c.front) + '</div>' + (x.hint ? '<div class="zh" lang="zh-Hans">' + E(x.hint) + '</div>' : '') +
        '<div class="back" hidden><div class="ipa">' + E(x.ipa || '') + '</div><div class="bm en">' + E(c.back) + '</div><div class="zh" lang="zh-Hans">' + E(x.zh || '') + '</div>' +
        '<div class="grades"><button data-q="2">' + T('Forgot', '忘了') + '</button><button data-q="3">' + T('Hard', '难') + '</button><button data-q="4">' + T('Good', '记得') + '</button><button data-q="5">' + T('Easy', '很熟') + '</button></div></div>' +
        '<button class="primary flip">' + T('Show answer', '看答案') + '</button></div><p class="dnext"><button class="small" data-act="done">' + T('Stop reviewing for today', '今天先复习到这里') + '</button></p>';
      db.querySelector('.flip').onclick = function () { db.querySelector('.back').hidden = false; this.hidden = true; };
      db.querySelectorAll('.grades button').forEach(function (b) { b.onclick = function () { var c0 = q.shift(); EH.grade(c0.id, +b.dataset.q); shown++; if (+b.dataset.q < 3) q.push(c0); show(); }; });
    };
    show();
  };

  function textStep(u, db) {
    if (!u) { db.innerHTML = '<p class="muted">' + T('No more unread texts in this topic.', '这个主题没有没读过的文章了。') + '</p>' + doneBtn(); return; }
    db.innerHTML = '<p class="muted">' + T('Loading…', '加载中…') + '</p>';
    var go = function () {
      var A = (window.EH_DAYART || {})[u.id];
      if (!A) { db.innerHTML = '<p>' + uLink(u) + '</p>' + doneBtn(); return; }
      var mt = EHPlan.met(M, { skip: u.id }), nNew = 0, nSeen = 0, seen = {};
      var paras = A.paras.map(function (p, i) {
        var en = p.en.replace(/<span class="ck" data-w="([^"]*)">/g, function (_, w) {
          var raw = w.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), n = mt[raw] || 0;
          if (!seen[raw]) { seen[raw] = 1; if (n === 0) nNew++; else if (n < 10) nSeen++; }
          return '<span class="ck ' + (n === 0 ? 'new' : n < 10 ? 'seen' : 'known') + '" data-card="' + w + '" title="' + (n === 0 ? 'new to you' : 'met ' + n + '×') + '">';
        });
        return '<div class="dpara"><p class="en">' + en + ' <button class="say" data-say="' + E(en.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')) + '">🔊</button></p>' + (p.zh ? '<p class="zh tr" lang="zh-Hans">' + E(p.zh) + '</p>' : '') + '</div>';
      }).join('');
      db.innerHTML = '<h3>' + uLink(u) + ' <span class="muted">' + u.level + ' · ' + u.words + ' words</span></h3>' +
        '<p class="legend"><span class="ck new">' + T('new to you', '没见过') + '</span> <b>' + nNew + '</b> · <span class="ck seen">' + T('met before, under 10 times', '见过、不到 10 次') + '</span> <b>' + nSeen + '</b> · ' +
        '<label><input type="checkbox" class="hide-tr"> ' + T('Hide the translation', '隐藏译文') + '</label></p><div class="dtext">' + paras + '</div>' +
        '<p class="muted">' + T('Glosses, hard sentences and questions are on the full page: ', '注释、难句和题在完整页上：') + uLink(u) + '</p>' +
        '<p class="dnext"><button class="primary rd">' + T('I have read it: add its words to review', '读完了：把生词加入复习') + '</button></p>';
      db.querySelector('.hide-tr').onchange = function (e) { db.querySelector('.dtext').classList.toggle('hide-tr', e.target.checked); };
      db.querySelector('.rd').onclick = function () {
        load('data/u/' + u.id + '.js', function (ok) {
          EH.setStep(u.id, 'learn', true);
          var U = window.EH_UNIT, n = 0;
          if (ok && U && U.id === u.id) U.cards.forEach(function (c) { n += EH.addCard({ id: c.id, kind: c.kind, lesson: U.id, front: c.front, back: c.back_en, extra: { zh: c.back_zh, ipa: c.ipa || '', unit: U.en, hint: c.hint || '' } }) ? 1 : 0; });
          var d = day(); d.topic = d.topic || u.topic; EH.save();
          EH.toast(T(n + ' cards added to review.', '新加入 ' + n + ' 张复习卡。'));
          nextStep(curKey(u));
        });
      };
    };
    if ((window.EH_DAYART || {})[u.id]) go(); else load('data/day/' + u.id + '.js', go);
  }
  function curKey(u) { return u === P.main ? 'main' : u === P.similar ? 'similar' : 'similar2'; }
  R.main = function (db) { textStep(P.main, db); };
  R.similar = function (db) { textStep(P.similar, db); };
  R.similar2 = function (db) { textStep(P.similar2, db); };

  R.kp = function (db) {
    var u = P.kp;
    if (!u) { db.innerHTML = '<p class="muted">' + T('Every open point is done. New units open in batches.', '开放的知识点都学完了，新单元会分批开放。') + '</p>' + doneBtn(); return; }
    var K = DK.kp[u.id] || { core: { en: '' }, aim: { en: '' }, hits: {} };
    // 例句只取今天的主文与同主题文章（主文在前），同主题没有命中时才退到站内其他文章并注明
    var order = [];
    if (P.main) order.push(P.main);
    P.arts.forEach(function (a) { if (a.topic === P.topicId && order.indexOf(a) < 0) order.push(a); });
    var li = [], other = false;
    order.forEach(function (a) { (K.hits[a.id] || []).forEach(function (s) { if (li.length < 8) li.push([s, a]); }); });
    if (!li.length) { other = true; P.arts.forEach(function (a) { (K.hits[a.id] || []).forEach(function (s) { if (li.length < 4) li.push([s, a]); }); }); }
    var qz = Object.keys(window.EH_QUIZ || {}).map(function (k) { return EH_QUIZ[k]; }).filter(function (q) { return q.unit === u.id; }).slice(0, 6);
    db.innerHTML = '<h3>' + uLink(u) + ' <span class="muted">' + u.level + ' · CELPIP ' + (D.celpip[u.level] || '') + ' · ' + u.skill + '</span></h3>' +
      (K.aim.en ? '<p class="goal">' + T(K.aim.en, K.aim.zh) + '</p>' : '') + (K.core.en ? '<div class="core">' + T(K.core.en, K.core.zh) + '</div>' : '') +
      (li.length ? '<h4>' + (other ? T('In other texts on this site', '站内其他文章里的原句') : T('In what you are reading this week', '在本周读的文章里')) + '</h4><ul class="seen">' +
        li.map(function (x) { return '<li><span class="en">' + x[0] + '</span> <span class="src muted">' + E(x[1].en) + '</span></li>'; }).join('') + '</ul>' : '') +
      '<p class="muted">' + T('Full explanation, table and contrasts: ', '完整讲解、表格与对比：') + uLink(u) + '</p>' +
      (qz.length ? '<h4>' + T('Check yourself', '测一测') + ' <span class="score muted"></span></h4><div class="dquiz"></div>' : '') +
      '<p class="dnext"><button class="primary lk">' + T('Learned: add its cards to review', '学会了：把卡片加入复习') + '</button></p>';
    if (qz.length) EHQuiz.render(db.querySelector('.dquiz'), qz, {
      onAnswer: function (res, n) {
        var done = Object.keys(res).length, ok = Object.keys(res).filter(function (k) { return res[k]; }).length;
        db.querySelector('.score').textContent = ok + ' / ' + done + ' (' + n + ')';
        if (done === n && ok / n >= 0.8) EH.setStep(u.id, 'quiz', true);
      }
    });
    db.querySelector('.lk').onclick = function () {
      load('data/u/' + u.id + '.js', function (ok) {
        EH.setStep(u.id, 'learn', true);
        var U = window.EH_UNIT, n = 0;
        if (ok && U && U.id === u.id) U.cards.forEach(function (c) { n += EH.addCard({ id: c.id, kind: c.kind, lesson: U.id, front: c.front, back: c.back_en, extra: { zh: c.back_zh, ipa: c.ipa || '', unit: U.en, hint: c.hint || '' } }) ? 1 : 0; });
        var d = day(); d.kp = u.id; if (P.topicId) d.topic = d.topic || P.topicId; EH.save();
        EH.toast(T(n + ' cards added to review.', '新加入 ' + n + ' 张复习卡。'));
        nextStep('kp');
      });
    };
  };

  R.contrast = function (db) {
    var u = P.contrast, K = u && DK.kp[u.id];
    if (!K || !K.contrast.length) { db.innerHTML = '<p class="muted">' + T('No contrast set is open.', '暂时没有可做的对比句组。') + '</p>' + doneBtn(); return; }
    var g = K.contrast[0];
    db.innerHTML = '<h3>' + uLink(u) + '</h3><p class="muted">' + T('Read each sentence aloud and decide what it signals before you open the notes.', '先把每句读出来、自己判断它传达什么，再点开注解。') + '</p>' +
      '<ul class="cset">' + g.map(function (f) { return '<li><span class="en">' + f.en + '</span> <span class="zh" lang="zh-Hans">' + f.zh + '</span><div class="sig" hidden>' + T(f.s.en, f.s.zh) + '</div></li>'; }).join('') + '</ul>' +
      '<p><button class="small rv">💡 ' + T('Show what each one signals', '看每句传达了什么') + '</button></p>' + '<p class="dnext"><button class="primary cd">' + T('Done, next step', '完成，下一步') + '</button></p>';
    db.querySelector('.rv').onclick = function () { db.querySelectorAll('.sig').forEach(function (x) { x.hidden = false; }); };
    db.querySelector('.cd').onclick = function () { day().contrast = u.id; EH.save(); nextStep('contrast'); };
  };

  R.speak = function (db) {
    var tp = P.topic, sp = tp && D.speak[tp.id];
    if (!sp) { db.innerHTML = '<p class="muted">' + T('This topic has no speaking task yet.', '这个主题还没有口语任务。') + '</p>' + doneBtn(); return; }
    // 升级清单：主题里反复出现的词块，加上今天读的文章里你第一次见到的
    var mt = EHPlan.met(M, { before: t }), extra = [];
    P.todays.forEach(function (a) { for (var w in a.w) if (!mt[w] && extra.indexOf(w) < 0 && sp.chunks.indexOf(w) < 0) extra.push(w); });
    var chunks = sp.chunks.concat(extra.slice(0, 8));
    db.innerHTML = '<p class="muted">' + E(sp.task) + ' · ' + sp.secs + ' s</p><div class="prompt">' + T(E(sp.en), E(sp.zh)) + '</div>' +
      (sp.celpip ? '<p>🎧 <a href="' + sp.celpip + '">' + T('See sample answers at three levels: CELPIP 5–6, 7–8 and 9+', '看同类任务的三级示范：思培 5–6／7–8／9+') + '</a></p>' : '') +
      '<p class="muted">' + T('Prepare for 30 seconds, then record. The recording stays on this device.', '准备 30 秒后录音；录音只留在本机。') + '</p>' +
      '<p><button class="rec big-rec" data-max="' + sp.secs + '">● ' + T('Record', '录音') + ' ' + sp.secs + ' s</button></p>' +
      '<h4>' + T('Upgrade checklist: tick the chunks you used', '升级清单：勾出你用上的词块') + '</h4><p class="chips">' +
      chunks.map(function (w) { return '<label class="chip"><input type="checkbox" class="used"> <span class="en">' + E(w) + '</span></label>'; }).join('') + '</p>' +
      '<h4>' + T('Rate yourself on the four CELPIP dimensions', '按思培四个维度自评') + '</h4><p class="dims">' +
      [['content', 'Content and coherence', '内容与连贯'], ['vocab', 'Vocabulary', '词汇'], ['listen', 'Listenability', '可听度'], ['task', 'Task fulfilment', '任务完成']].map(function (x) {
        return '<label class="dim">' + T(x[1], x[2]) + ' <select data-dim="' + x[0] + '"><option value="">–</option><option value="5.5">5–6</option><option value="7.5">7–8</option><option value="9.5">9+</option></select></label>';
      }).join('') + ' <button class="primary sv">' + T('Save', '保存') + '</button></p>';
    db.querySelector('.sv').onclick = function () {
      var sc = {}, sum = 0, n = 0;
      db.querySelectorAll('select[data-dim]').forEach(function (x) { if (x.value) { sc[x.dataset.dim] = +x.value; sum += +x.value; n++; } });
      if (n < 4) { EH.toast(T('Rate all four dimensions.', '四个维度都要评。')); return; }
      var avg = Math.round(sum / n * 10) / 10, used = db.querySelectorAll('.used:checked').length, d = day();
      d.topic = d.topic || tp.id; d.speak = { topic: tp.id, scores: sc, avg: avg, used: used };
      S.speaks.push({ d: t, topic: tp.id, avg: avg, used: used, scores: sc, src: 'today' });
      EH.touch(); EH.save(); nextStep('speak');
    };
  };

  /* ---------- 当日小结 ---------- */
  function summary() {
    var nNew = 0; for (var id in S.cards) if (S.cards[id].added === t && !EHPlan.isBase(S.cards[id])) nNew++;
    var nc = EHPlan.newChunks(M, t), mt = EHPlan.met(M), ten = Object.keys(mt).filter(function (w) { return mt[w] >= 10; }).length;
    var secs = day().secs || {}, spent = 0; for (var k in secs) spent += secs[k];
    var q = D.quota.chunks, d = day();
    var allDone = P.steps.every(function (s) { return P.done[s[0]] || P.skip[s[0]]; });
    document.getElementById('day-end').innerHTML = '<span class="lbl">' + (allDone ? T('Done for today', '今天完成了') : T('Today so far', '今天到目前')) + '</span> ' +
      '<b id="end-new">' + nNew + '</b> ' + T('new points', '个新知识点') + ' · <b id="end-chunks">' + nc.total + '</b> ' + T('new words and chunks (aim ' + q[0] + '–' + q[1] + ')', '个新词与词块（目标 ' + q[0] + '–' + q[1] + '）') + ' · ' +
      '<b>' + ten + '</b> ' + T('chunks met 10+ times', '个词块见过 10 次以上') + ' · ' + T('speaking', '口语自评') + ' <b id="end-speak">' + (d.speak && d.speak.avg ? d.speak.avg : '–') + '</b> · ' +
      '<b>' + mmss(spent) + '</b> / ' + total() + ' min' +
      (nc.total < q[0] ? '<p class="muted">' + T('Under the daily aim for new words? Top up with ', '新词不到每天的目标？去 ') + '<a href="learn.html">' + T('New words', '新词学习') + '</a>' + T('.', ' 补几张卡。') + '</p>' : '');
  }
  paint();
})();
