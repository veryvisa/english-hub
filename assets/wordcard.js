/* 新词学习卡（2026-11-24 改版，规格 design/learning-ux-2026-11-24.md §三–§四）。一个词一张卡，本站词条优先、词典补全。
   EHCard.render(box, wordOrId, opts) · EHCard.pop(word)：弹窗并记下走过的路 · EHCard.clickable(html)：把文本里的英文词包成可点的 span。
   卡片四层：① 顶部（词、音标、读音、级别、词性、收藏）② 一眼看懂（语境义、英文释义、💡 记忆点、✍️ 例句、🧩 搭配图）
            ③ 🕸 从这个词走出去（易错／词族／构词／词根／易混／反义近义／同主题／文章／语法点，一次看一支）④ 更多（级别与常用度、语体刻度、词典全释、词形）。
   例句三栏的数据由 bin/examples.py 并进词条（eh-word-examples-1124）：site.loc＝课文定位 {no, form, en, zh}，site.ex / site.own＝本站例句，site.tat＝Tatoeba 例句（逐句署名）。 */
(function () {
  'use strict';
  var E = EH.esc, T = EH.T, L = window.EH_LEARN || { words: [], units: {}, topics: {}, pains: {}, apprefs: {}, affixes: {}, roots: {} };
  var BYID = {}, BYKEY = {}, BYTOK = {};
  L.words.forEach(function (w) {
    BYID[w.id] = w; BYKEY[w.w.toLowerCase()] = w;
    w.w.toLowerCase().split(/[^a-z'-]+/).forEach(function (t) { if (t.length > 2) (BYTOK[t] = BYTOK[t] || []).push(w.id); });
  });
  var AFF = L.affixes || {};
  var WRT = L.wroots || {};   // 词根表（content/wordnet/roots.tsv → bin/wordnet.py）
  L.words.forEach(function (w) { if (w.aff) for (var k in w.aff) if (!AFF[k]) { AFF[k] = w.aff[k]; AFF[k].ids = []; } }); // 新概念词条自带词缀释义
  var DICT_AFF = window.EH_DICT_AFF || {}; // 整部词典的构词拆解用到的缀（bin/lexicon.py build，data/dict/index.js），站内没有才补上
  for (var dk in DICT_AFF) if (!AFF[dk]) { AFF[dk] = DICT_AFF[dk]; AFF[dk].ids = []; }
  var LV = { 1: 'A1–A2', 2: 'B1', 3: 'B2', 4: 'C1', 5: 'C2' };
  var FREQ = { 1: ['Everyday word', '日常高频'], 2: ['Very common', '很常用'], 3: ['Common', '常用'], 4: ['Less common', '不太常用'], 5: ['Rare', '少见'] };
  var POS = { n: ['noun', '名词'], v: ['verb', '动词'], adj: ['adjective', '形容词'], adv: ['adverb', '副词'], prep: ['preposition', '介词'], conj: ['conjunction', '连词'], '': ['other', '其他'] };
  var FORMZH = { past: '过去式', 'past participle': '过去分词', '-ing': '现在分词', 'he/she/it': '三单', comparative: '比较级', superlative: '最高级', plural: '复数', possessive: '所有格', adverb: '副词形式', 'plural / -s': '复数／三单' };
  var ROOT = document.body.dataset.root || '';

  function voice(lang) {
    var vs = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
    return vs.filter(function (v) { return v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase(); })[0] || vs.filter(function (v) { return /^en/i.test(v.lang); })[0];
  }
  function say(text, lang, rate) {
    if (!('speechSynthesis' in window)) { EH.toast(T('This browser has no speech voices.', '这个浏览器没有朗读语音。')); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = lang || 'en-GB'; u.rate = rate || 0.9;
    var v = voice(u.lang); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function sayBtns(text) {
    var t = E(text);
    return '<button data-wsay="' + t + '" data-lang="en-GB" aria-label="Listen, British">🔊 UK</button><button data-wsay="' + t + '" data-lang="en-US" aria-label="Listen, American">🔊 US</button>' +
      '<button data-wsay="' + t + '" data-lang="en-GB" data-rate="0.55" aria-label="Listen slowly">🐢</button>';
  }
  function sayOne(text) { return '<button class="say" data-say="' + E(text) + '" aria-label="Listen: ' + E(String(text).split(' ').slice(0, 8).join(' ')) + '">🔊</button>'; }
  function clickable(htmlText) { // 只包文本节点里的词，不碰标签
    return String(htmlText).split(/(<[^>]+>)/).map(function (p) {
      return p.charAt(0) === '<' ? p : p.replace(/[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g, function (m) { return '<span class="lw">' + m + '</span>'; });
    }).join('');
  }
  function chipW(id, cur) { var w = BYID[id]; return w ? '<button class="chip wc-go' + (cur ? ' cur' : '') + '" data-wid="' + E(w.id) + '">' + E(w.w) + '</button>' : ''; }
  function chipD(w) { return '<button class="chip wc-look" data-look="' + E(w) + '">' + E(w) + '</button>'; }
  function zhLines(z) { return String(z || '').split('\n').map(function (l) { return '<div>' + E(l) + '</div>'; }).join(''); }
  function inBook(id) { return !!EH.state.cards['lw:' + id]; }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hitRx(key) { // 例句里把目标词加粗：主词＋常见屈折
    key = String(key || '').toLowerCase().replace(/[^a-z' -]/g, '').trim(); if (key.length < 3) return null;
    var stem = key.replace(/(e|y)$/, '');
    return new RegExp('\\b(' + esc(key) + '|' + esc(stem) + ')(s|es|ies|d|ed|ied|ing|ly)?\\b', 'i');
  }
  function bold(en, rx) { var h = E(en); return rx && !/<mark>/.test(en) ? h.replace(rx, function (m) { return '<b class="hit">' + m + '</b>'; }) : h; }
  function firstDef(en) { // ECDICT 英文释义："n. the act of …; n. …" → 第一条，去掉词性记号
    var s = String(en || '').split(/;\s*(?=[a-z]{1,4}\.? )/)[0].replace(/^[a-z]{1,4}\.?\s+/, '').trim();
    return s.length > 3 ? s : '';
  }
  function zhFirst(z) { return String(z || '').split('\n')[0].replace(/^[a-z]+\.\s*/, ''); }
  function posOf(e) { var m = String(e && e.zh || '').match(/^\s*([a-z]+)\./); var k = m ? m[1] : ''; return { vt: 'v', vi: 'v', v: 'v', n: 'n', a: 'adj', adj: 'adj', ad: 'adv', adv: 'adv', prep: 'prep', conj: 'conj' }[k] || ''; }
  function sec(cls, emoji, en, zh, inner, extra) { return '<section class="wc-s ' + cls + '"><h3 class="wc-h">' + emoji + ' ' + T(en, zh) + (extra || '') + '</h3>' + inner + '</section>'; }

  /* ---------- 图示：搭配图、词族树、构词块、刻度 ---------- */
  function collMap(site, head) {
    var coll = (site && site.coll || []).slice(), single = !site || site.single;
    var rx = single ? hitRx(head) : null, L_ = [], R_ = [], flat = [];
    coll.forEach(function (c) {
      var m = rx && rx.exec(c);
      if (!m) { flat.push(c); return; }
      var a = c.slice(0, m.index).trim(), b = c.slice(m.index + m[0].length).trim();
      if (a) L_.push({ t: a, full: c }); if (b) R_.push({ t: b, full: c });
      if (!a && !b) flat.push(c);
    });
    var item = function (x) { return '<button class="cm-i" data-say="' + E(x.full) + '" title="' + E(x.full) + '"><span>' + E(x.t) + '</span></button>'; };
    var out = '';
    if (L_.length || R_.length) {
      out += '<div class="cmap" role="group" aria-label="Collocation map"><div class="cm-l">' + L_.map(item).join('') + '</div><div class="cm-hub en">' + E(head) + '</div><div class="cm-r">' + R_.map(item).join('') + '</div></div>' +
        '<p class="cm-tools"><button class="small cm-recall" aria-pressed="false">🙈 ' + T('Cover and recall', '遮住回想') + '</button> <span class="muted">' + T('Tap a partner word to hear the whole phrase.', '点搭配词听整个短语。') + '</span></p>';
    }
    if (flat.length) out += '<ul class="cm-flat">' + flat.map(function (c) { return '<li class="en">' + clickable(E(c)) + ' ' + sayOne(c) + '</li>'; }).join('') + '</ul>';
    return out;
  }
  function famTree(root, items, cur) { // items＝[{w,p,zh,r,id}]；按词性分枝
    var by = {}, order = ['n', 'v', 'adj', 'adv', 'prep', 'conj', ''];
    items.forEach(function (x) { (by[x.p || ''] = by[x.p || ''] || []).push(x); });
    var br = order.filter(function (p) { return by[p]; }).map(function (p) {
      return '<li><span class="ft-pos">' + T(POS[p][0], POS[p][1]) + '</span><span class="ft-ws">' + by[p].map(function (x) {
        var c = x.id ? '<button class="chip wc-go' + (x.w === cur ? ' cur' : '') + '" data-wid="' + E(x.id) + '">' + E(x.w) + ' ★</button>' : '<button class="chip wc-look' + (x.w === cur ? ' cur' : '') + '" data-look="' + E(x.w) + '">' + E(x.w) + '</button>';
        return '<span class="ft-w">' + c + (x.zh ? '<span class="zh" lang="zh-Hans">' + E(x.zh) + '</span>' : '') + '</span>';
      }).join('') + '</span></li>';
    }).join('');
    return '<div class="ftree"><div class="ft-root en">' + E(root) + '</div><ul class="ft-br">' + br + '</ul></div>';
  }
  function morphBlocks(mf) {
    return '<div class="mf">' + mf.map(function (m) {
      var a = m.a && AFF[m.a];
      var lab = m.k === 'pre' ? m.t + '-' : m.k === 'suf' ? '-' + m.t : m.t;
      return '<div class="mf-p mf-' + m.k + '"><b class="en">' + E(lab) + '</b>' + (a ? '<small>' + T(E(a.en), E(a.zh)) + '</small>' : m.k === 'root' ? '<small><button class="wc-look linkish" data-look="' + E(m.t) + '">' + T('root word', '词根词') + ' ↗</button></small>' : '') + '</div>';
    }).join('<span class="mf-plus">+</span>') + '</div>';
  }
  function meter(n, of, cls) { var s = ''; for (var i = 1; i <= of; i++) s += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return '<span class="meter ' + (cls || '') + '" aria-hidden="true">' + s + '</span>'; }
  function regScale(reg) { // -1 口语 · 0 中性 · 1 正式 · 2 学术
    var pos = { '-1': 12, '0': 50, '1': 80, '2': 94 }[String(reg)];
    var name = { '-1': ['informal, spoken', '口语、非正式'], '1': ['formal', '正式'], '2': ['academic', '学术'] }[String(reg)];
    return '<div class="rscale"><div class="rs-track"><i style="left:' + pos + '%"></i></div><div class="rs-ends"><span>' + T('chatty', '口语') + '</span><span>' + T('neutral', '中性') + '</span><span>' + T('formal', '正式') + '</span></div>' +
      '<div class="rs-name">' + T('This word: ' + name[0], '这个词：' + name[1]) + '</div></div>';
  }

  /* ---------- 整张卡 ---------- */
  function build(site, d) { // site＝本站词条或 null；d＝EHDict.lookup 的结果或 null
    var e = d && d.e || {}, head = site ? site.w : (d ? d.head : ''), H = [];
    var chunk = !!(site && !site.single), kw = chunk && d ? d.head : '';
    var key = chunk ? (site.k || kw) : head, rx = hitRx(chunk ? key : head);
    var lvTxt = site ? site.lv : (e.r ? LV[e.r] : ''), posTxt = site && site.pos ? site.pos : '';
    var cid = site ? 'lw:' + site.id : 'ld:' + head, has = !!EH.state.cards[cid];
    var ipa = [];
    if (site && site.ipa && chunk) ipa.push(E(site.ipa));
    if (!chunk && e.uk) ipa.push('<span><small>UK</small> /' + E(e.uk) + '/</span>');
    if (!chunk && (e.us || site && site.us)) ipa.push('<span><small>US</small> /' + E(e.us || String(site.us).replace(/^\/|\/$/g, '')) + '/</span>');
    if (!ipa.length && site && site.ipa) ipa.push(E(site.ipa));
    /* ① 顶部 */
    H.push('<header class="wc-head"><div class="wc-top"><h2 class="en">' + E(head) + '</h2><span class="wc-badges">' +
      (lvTxt ? '<span class="lvb lv-' + E(lvTxt.replace(/[^A-C0-9]/g, '').slice(0, 2)) + '" title="' + (site ? 'Level taught on this site' : 'Estimated from word frequency') + '">' + (site ? '' : '≈ ') + E(lvTxt) + '</span>' : '') +
      (posTxt ? '<span class="posb en">' + E(posTxt) + '</span>' : (posOf(e) ? '<span class="posb">' + T(POS[posOf(e)][0], POS[posOf(e)][1]) + '</span>' : '')) + '</span></div>' +
      '<div class="ipa">' + ipa.join(' ') + '</div>' +
      '<div class="wc-say">' + sayBtns(head) + '<button class="wc-add star" data-cid="' + E(cid) + '"' + (has ? ' disabled' : '') + ' aria-label="Add to my word book">' + (has ? '★' : '☆') + '</button></div></header>');
    /* ② 一眼看懂：语境义 ＋ 英文释义 ＋ 记忆点 */
    var zhMain = site ? site.zh : zhFirst(e.zh), ownDef = site && site.en ? String(site.en).replace(/^[a-z]{1,4}\.\s+/, '') : '', dictDef = firstDef(e.en), tip = '';
    // 本站词条的语境义可能不是词典第一义：词典英文释义只在英文模式下兜底显示并标明出处；本站自写的英文释义（site.en）三种模式都显示
    var def = ownDef || (site ? '' : dictDef);
    if (site && site.tip) tip = T(E(site.tip.en || ''), E(site.tip.zh || ''));
    else if (site && site.mf && site.mf.length) tip = '<span class="en">' + site.mf.map(function (m) { return E(m.k === 'pre' ? m.t + '-' : m.k === 'suf' ? '-' + m.t : m.t); }).join(' + ') + '</span>' +
      site.mf.filter(function (m) { return m.a && AFF[m.a]; }).map(function (m) { var a = AFF[m.a]; return ' <span class="tip-a">' + E((m.k === 'pre' ? a.a + '-' : '-' + a.a)) + ' = ' + T(E(a.en), E(a.zh)) + '</span>'; }).join('');
    if (chunk && kw) tip = (tip ? tip + ' · ' : '') + T('Key word: ', '主词：') + chipD(kw);
    if (!chunk && d && d.form && d.form !== d.head) tip = (tip ? tip + ' · ' : '') + '<b class="en">' + E(d.form) + '</b> → <b class="en">' + E(d.head) + '</b>' + (d.how ? ' (' + T(E(d.how), FORMZH[d.how] || E(d.how)) + ')' : '');
    H.push('<section class="wc-s wc-zh wc-gist">' +
      (zhMain ? '<div class="wc-mean zh" lang="zh-Hans">' + E(zhMain) + '</div>' : '') +
      (def ? '<div class="wc-def enx">' + E(def) + '</div>' : (site && dictDef ? '<div class="wc-def enx-only">' + E(dictDef) + ' <span class="tag">dictionary, first sense</span></div>' : '')) +
      (!zhMain && !def ? '<span class="muted">' + T('Not in the dictionary.', '词典里没有这个词。') + '</span>' : '') +
      (tip ? '<div class="wc-tip">💡 ' + tip + '</div>' : '') + '</section>');
    /* ✍️ 例句：课文里的用法（定位）／本站例句／更多例句 */
    var exG = [], nEx = 0;
    var li = function (en, zh, src, plain) { // en 可以是已带 <b>/<mark> 的 html；plain＝朗读用的纯文本
      nEx++; var isHtml = /<(mark|b)\b/.test(en);
      return '<li><span class="en">' + clickable(isHtml ? en : bold(en, rx)) + '</span> ' + sayOne(plain || en.replace(/<[^>]+>/g, '')) + (zh ? '<div class="zh" lang="zh-Hans">' + E(zh) + '</div>' : '') + (src || '') + '</li>';
    };
    if (site) { // 数据由 bin/examples.py 并进词条：loc＝课文定位 {no, form, en, zh}，ex/own＝本站例句（h＝已加粗的 html），tat＝Tatoeba 例句（逐句署名）
      if (site.loc) {
        var mu = /^nce:b(\d)-L0*(\d+)/.exec(site.u || ''), lc = site.loc; nEx++;
        exG.push(['📘', 'How the lesson text uses it', '课文里的用法（定位）', ['<li class="ex-loc"><span class="tag">📍 ' + (mu ? 'NCE ' + mu[1] + ' · L' + mu[2] + ' · ' : '') + T('sentence ' + E(lc.no), '第 ' + E(lc.no) + ' 句') + '</span>' +
          (lc.form ? ' ' + T('appears as', '课文里的词形') + ' <b class="en">' + E(lc.form) + '</b>' : '') + (lc.en ? '<div>' + T(E(lc.en), E(lc.zh || '')) + '</div>' : '') +
          '<div class="src">' + T('Find it in your coursebook (count the sentences of the text, not the title).', '在你的教材里找到这一句（按课文正文数，不含标题）。') + '</div></li>']]);
      }
      var own = (site.ex || []).concat(site.own || []).map(function (x) { return li(x.h || x.en, x.zh, '', x.en); }).concat((site.hits || []).map(function (x) { return li(x.en, '', ' <a class="src" href="' + ROOT + 'u/' + x.u + '.html">' + E(x.t) + ' ↗</a>'); }));
      if (own.length) exG.push(['✍️', 'From this site', '本站例句', own]);
      var more = (site.tat || []).map(function (x) { return li(x.h || x.en, x.zh || '', '<div class="src">Tatoeba #' + E(x.i) + ' · ' + E(x.a) + (x.zi ? ' · ' + T('Chinese', '中文') + ' #' + E(x.zi) + ' · ' + E(x.za) : '') + ' · <a href="' + ROOT + 'credits.html#tatoeba">CC BY 2.0 FR</a></div>', x.en); });
      if (more.length) exG.push(['🌍', 'More examples (Tatoeba)', '更多例句（Tatoeba）', more]);
    }
    var shown = 0, exH = exG.map(function (g) {
      return '<div class="ex-g"><div class="ex-gh">' + g[0] + ' ' + T(g[1], g[2]) + '</div><ul>' + g[3].map(function (x) { shown++; return shown > 2 ? x.replace('<li', '<li data-more') : x; }).join('') + '</ul></div>';
    }).join('');
    H.push(sec('wc-ex', '✍️', 'Examples', '例句', exH ? '<div class="ex-wrap">' + exH + '</div>' + (nEx > 2 ? '<button class="small ex-more" aria-expanded="false">＋ ' + T((nEx - 2) + ' more', '再看 ' + (nEx - 2) + ' 句') + '</button>' : '') : '<p class="muted">' + T('None yet.', '暂无。') + '</p>'));
    /* 🧩 搭配图 */
    var cm = collMap(site, chunk ? head : head), chunks = [];
    var tok = (site && site.single ? site.w : head).toLowerCase();
    (BYTOK[tok] || []).forEach(function (id) { if (!site || id !== site.id) chunks.push(id); });
    if (cm || chunks.length) H.push(sec('wc-coll', '🧩', 'Words it goes with', '常见搭配', cm + (chunks.length ? '<div class="cm-chunks"><span class="lbl">' + T('Chunks on this site', '本站含它的词块') + '</span> ' + chunks.slice(0, 8).map(function (i) { return chipW(i); }).join('') + '</div>' : '')));
    else H.push('<section class="wc-s wc-coll" hidden></section>');
    /* ③ 🕸 从这个词走出去 */
    var tabs = [];
    var tr = [];
    if (site) {
      (site.traps || []).forEach(function (t) { tr.push('<li><div class="bad en">✗ ' + E(t.bad) + '</div><div class="good en">✓ ' + E(t.good) + ' ' + sayOne(t.good) + '</div><div class="why">' + T(E(t.en), E(t.zh)) + '</div></li>'); });
      if (!tr.length) (site.pains || []).forEach(function (p) { var P = L.pains[p]; if (P) tr.push('<li><div><a href="' + ROOT + 'pains.html#' + p + '">' + p + '</a> ' + T(E(P.en), E(P.zh)) + '</div><div class="bad en">✗ ' + E(P.wrong) + '</div><div class="good en">✓ ' + E(P.right) + '</div></li>'); });
    }
    tabs.push(['traps', '⚠️', 'Slips', '易错', tr.length, tr.length ? '<ul class="wc-traplist">' + tr.join('') + '</ul>' : '']);
    var fx = EHDict.forms(e), fl = [];
    for (var k in fx) fl.push(T(EHDict.FORM[k], FORMZH[EHDict.FORM[k]] || EHDict.FORM[k]) + ' <b class="en">' + E(fx[k]) + '</b>');
    var mf = (site && site.mf) || (!site && e.mf) || [];
    var fam = site && site.fam ? site.fam.slice() : (!site && e.fam && e.fam.length ? e.fam.slice() : null), rootW = key;
    mf.forEach(function (m) { if (m.k === 'root') rootW = m.t; });
    var famH = '';
    if (fam && fam.length) {
      var self = { w: key, p: (site && site.self) ? site.self.p : posOf(e), zh: '', id: (site && site.single) ? site.id : '' };
      var famItems = fam.map(function (x) { return { w: x.w, p: x.p, zh: x.zh, id: x.id || ((BYKEY[x.w] && BYKEY[x.w].single) ? BYKEY[x.w].id : '') }; });
      famH = famTree(rootW, [self].concat(famItems), key) + '<p class="muted">★ ' + T('has its own card here. Family worked out from the dictionary and checked by meaning; still, check before relying on it.', '＝本站有词卡。词族由词典推出、按释义核过，仍请当参考。') + '</p>';
    } else if (e.fm && e.fm.length) famH = '<div class="chips" data-famlazy="' + E(e.fm.join(',')) + '" data-cur="' + E(key) + '">' + e.fm.map(chipD).join(' ') + '</div><p class="muted">' + T('Worked out automatically; check before relying on it.', '自动推断，供参考。') + '</p>';
    tabs.push(['fam', '🔁', 'Family', '词族', (fam && fam.length) || (e.fm || []).length, famH]);
    var mfH = '';
    if (mf.length) {
      mfH = morphBlocks(mf) + mf.filter(function (m) { return m.a && AFF[m.a] && AFF[m.a].ids.length > 1; }).map(function (m) {
        var a = AFF[m.a], ids = a.ids.filter(function (i) { return !site || i !== site.id; });
        return '<div class="mf-more"><span class="lbl">' + T('Also built with ', '同样带 ') + '<b class="en">' + E(m.k === 'pre' ? a.a + '-' : '-' + a.a) + '</b></span> ' + ids.slice(0, 8).map(function (i) { return chipW(i); }).join('') +
          (ids.length > 8 ? ' <a href="' + ROOT + 'net.html#' + E(m.a) + '">' + T('all ' + ids.length, '全部 ' + ids.length + ' 个') + ' →</a>' : '') + '</div>';
      }).join('');
    }
    tabs.push(['build', '🧱', 'Word-building', '构词', mf.length ? mf.length - 1 : 0, mfH]);
    var rt = site && site.rt || [], rtH = '';
    rt.forEach(function (x) {
      var R = WRT[x.r]; if (!R) return;
      var ws = (R.words || []).filter(function (y) { return y.w !== key; });
      rtH += '<div class="rtg"><div class="rt-h"><b class="en">' + E(R.a) + '</b> <span class="rt-m">' + T(E(R.en), E(R.zh)) + '</span>' +
        (R.vars && R.vars.length ? ' <span class="tag en">' + E(R.vars.join(', ')) + '</span>' : '') + '</div>' +
        (x.br ? '<p class="rt-br"><span class="lbl">' + T('This word', '这个词') + '</span>' + T(E(x.br.en), E(x.br.zh)) + '</p>' : '') +
        '<div class="chips rt-ws">' + ws.slice(0, 10).map(function (y) {
          return '<span class="rt-w">' + (y.id ? '<button class="chip wc-go" data-wid="' + E(y.id) + '">' + E(y.w) + ' ★</button>'
            : '<button class="chip wc-look" data-look="' + E(y.w) + '">' + E(y.w) + '</button>') + (y.zh ? '<span class="zh" lang="zh-Hans">' + E(y.zh) + '</span>' : '') + '</span>';
        }).join('') + '</div>' + (ws.length > 10 ? '<p><a href="' + ROOT + 'net.html#rt-' + E(R.a) + '">' + T('all ' + ws.length + ' words with this root', '这个词根的全部 ' + ws.length + ' 个词') + ' →</a></p>' : '') + '</div>';
    });
    if (rtH) rtH += '<p class="muted">★ ' + T('has its own card here. Roots are the Latin or Greek piece the word was built from; a few meanings have drifted, so the line above says how.', '＝本站有词卡。词根是这个词当初用的拉丁或希腊部件；有些词的意思已经走远了，上面那行写的就是怎么走的。') + '</p>';
    tabs.push(['root', '🌱', 'Root', '词根', rt.length, rtH]);
    var conf = site ? (site.conf || []).filter(function (i) { return BYID[i]; }) : [], confH = '';
    if (conf.length) {
      var row = function (w, cur) { return '<tr' + (cur ? ' class="cur"' : '') + '><td>' + (cur ? '<b class="en">' + E(w.w) + '</b>' : chipW(w.id)) + '<div class="zh" lang="zh-Hans">' + E(w.zh) + '</div></td><td class="en">' + E((w.coll || [])[0] || '–') + '</td><td class="en">' + E(w.ex && w.ex[0] ? w.ex[0].en : '–') + '</td></tr>'; };
      confH = '<p class="muted">' + T('Close in Chinese, different in English. Compare what each one goes with.', '中文意思相近、英文要分清：比一比各自的搭配。') + '</p><div class="tw"><table class="vt cft"><tr><th>' + T('Word', '词') + '</th><th>' + T('Goes with', '典型搭配') + '</th><th>' + T('Example', '例句') + '</th></tr>' +
        row(site, true) + conf.map(function (i) { return row(BYID[i]); }).join('') + '</table></div>';
    }
    tabs.push(['conf', '🆚', 'Look-alikes', '易混', conf.length, confH]);
    var ant = site && site.ant || [], syn = site && site.syn || [], oppH = '';
    var oppList = function (xs) {
      return '<ul class="opp-l">' + xs.map(function (x) {
        return '<li>' + (x.id ? '<button class="chip wc-go" data-wid="' + E(x.id) + '">' + E(x.w) + ' ★</button>'
          : '<button class="chip wc-look" data-look="' + E(x.w) + '">' + E(x.w) + '</button>') +
          (x.zh ? ' <span class="zh" lang="zh-Hans">' + E(x.zh) + '</span>' : '') +
          (x.n ? '<div class="opp-n">' + T(E(x.n.en), E(x.n.zh)) + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
    };
    if (ant.length) oppH += '<div class="opp-g"><span class="lbl">↔ ' + T('Opposite', '反义') + '</span>' + oppList(ant) + '</div>';
    if (syn.length) oppH += '<div class="opp-g"><span class="lbl">≈ ' + T('Close in meaning — and how it differs', '近义 —— 差别在哪') + '</span>' + oppList(syn) + '</div>';
    tabs.push(['opp', '↔', 'Opposite & close', '反义近义', ant.length + syn.length, oppH]);
    var rel = site ? (site.rel || []) : [], tp = site && site.topics && site.topics[0];
    tabs.push(['topic', '🗂', 'Same topic', '同主题', rel.length, rel.length ? '<div class="chips">' + rel.map(function (i) { return chipW(i); }).join('') + '</div>' +
      (tp && L.topics[tp] ? '<p><a href="' + ROOT + 'learn.html#set=topic:' + E(tp) + '">🧠 ' + T('Learn the whole set: ' + E(L.topics[tp].en), '逐张学整组：' + E(L.topics[tp].zh)) + '</a></p>' : '') : '']);
    var arts = {}, artH = '';
    if (site) (site.hits || []).forEach(function (x) { arts[x.u] = x.t; });
    if (site) { var ul = [site.u].concat(site.also || []).filter(function (u) { return u && u.indexOf('nce:'); }); artH = ul.map(function (u) { var U = L.units[u]; return U ? '<li><a href="' + ROOT + 'u/' + u + '.html">' + T(E(U.en), E(U.zh)) + '</a> <span class="tag">' + T('taught here', '在这里教') + '</span></li>' : ''; }).join('') +
      Object.keys(arts).filter(function (u) { return ul.indexOf(u) < 0; }).map(function (u) { return '<li><a href="' + ROOT + 'u/' + u + '.html">' + E(arts[u]) + '</a></li>'; }).join(''); }
    tabs.push(['texts', '📖', 'Texts', '文章', site ? (site.n_seen || Object.keys(arts).length || (artH ? 1 : 0)) : 0, artH ? '<ul class="wc-arts">' + artH + '</ul>' : '']);
    var gp = site ? (site.gp || []).filter(function (u) { return L.units[u]; }) : [];
    tabs.push(['gram', '📐', 'Grammar', '语法点', gp.length, gp.length ? '<p class="muted">' + T('Grammar points whose example sentences use this word.', '例句里用到这个词的语法点。') + '</p><ul class="wc-arts">' + gp.map(function (u) { return '<li><a href="' + ROOT + 'u/' + u + '.html">' + T(E(L.units[u].en), E(L.units[u].zh)) + '</a></li>'; }).join('') + '</ul>' : '']);
    var live = tabs.filter(function (t) { return t[5]; });
    H.push('<section class="wc-s wc-rel wc-net"' + (live.length ? '' : ' hidden') + '><h3 class="wc-h">🕸 ' + T('Go further from this word', '从这个词走出去') + '</h3><div class="net-tabs" role="tablist">' +
      live.map(function (t, i) { return '<button role="tab" class="net-tab' + (i ? '' : ' on') + '" data-net="' + t[0] + '" aria-selected="' + (i ? 'false' : 'true') + '">' + t[1] + ' ' + T(t[2], t[3]) + (t[4] ? ' <span class="n">' + t[4] + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      live.map(function (t, i) { return '<div class="net-p wc-' + (t[0] === 'fam' ? 'famp' : t[0]) + '" data-netp="' + t[0] + '"' + (i ? ' hidden' : '') + '>' + t[5] + '</div>'; }).join('') + '</section>');
    if (!tr.length) H.push('<div class="wc-traps" hidden></div>');
    /* ④ 更多：级别与常用度、语体、词典全释、词形 */
    var lv = [];
    if (e.r) lv.push('<div class="mrow"><span class="lbl">' + T('How common', '常用度') + '</span> ' + meter(6 - e.r, 5) + ' <span class="inl">' + T(FREQ[e.r][0], FREQ[e.r][1]) + '</span> <span class="chip">≈ CEFR ' + LV[e.r] + '</span></div>');
    if (site && site.reg !== undefined) lv.push('<div class="mrow"><span class="lbl">' + T('Register', '语体') + '</span>' + regScale(site.reg) + '</div>');
    var chips = [];
    if (e.b) chips.push('<span class="chip">' + E(e.b) + '</span>');
    if (site) chips.push('<span class="chip">' + T('Taught at ', '本站 ') + E(site.lv) + '</span>');
    if (e.t) chips.push('<span class="chip">' + E(e.t) + '</span>');
    var moreH = '<div class="wc-level">' + lv.join('') + '<div class="mrow">' + chips.join(' ') + '</div><p class="muted">' + T('CEFR is estimated from word frequency (NGSL bands, then corpus rank).', 'CEFR 由词频估算（先看 NGSL 词段，再看语料排名）。') + '</p></div>';
    moreH += '<div class="wc-forms"><span class="lbl">' + T('Word forms', '词形变化') + '</span> ' + (fl.join(' · ') || '–') + '</div>';
    var pos = [];
    if (site && site.pos) pos.push('<span class="en">' + E(site.pos) + '</span>');
    if (e.l && e.zh && d && d.head !== e.l) pos.push(T('Base form: ', '原形：') + chipD(e.l));
    moreH += '<div class="wc-pos"><span class="lbl">' + (chunk ? T('Dictionary, key word ', '词典释义（主词）') + '<span class="en">' + E(kw) + '</span>' : T('Dictionary', '词典释义')) + '</span> ' + pos.join(' · ') +
      (e.zh ? '<div class="zh" lang="zh-Hans">' + zhLines(e.zh) + '</div>' : '') + (e.en ? '<div class="wc-en enx">' + E(e.en) + '</div>' : '') + (!e.zh && !e.en ? '<span class="muted">–</span>' : '') + '</div>';
    H.push('<details class="wc-s wc-more"><summary>📊 ' + T('More: level, register, full dictionary entry', '更多：级别、语体、词典全释') + '</summary>' + moreH + '</details>');
    /* 📘 教材出处与去哪儿学 */
    if (site) {
      var U = L.units[site.u] || {}, links = site.u && U.en && site.u.indexOf('nce:') ? ['<a href="' + ROOT + 'u/' + site.u + '.html">' + T(E(U.en), E(U.zh || '')) + '</a>'] : [];
      var ar = (L.apprefs[site.u] || []).slice(0, 2).map(function (r) { return '<span class="chip">EF ' + E(r.code === 'EF-A' ? 'Advanced' : 'Upper-Int') + ' ' + E(r.unit) + (r.ok ? '' : ' ≈') + '</span>'; }).join(' ');
      if (site.book) ar += ' <span class="chip">' + E(site.book) + '</span>';
      if (links.length || ar) H.push('<section class="wc-s wc-links"><span class="lbl">📘 ' + T('In your coursebook · learn it in context', '教材出处 · 去哪儿学') + '</span> ' + ar + ' ' + links.join(' · ') + '</section>');
      else H.push('<section class="wc-s wc-links" hidden></section>');
    }
    H.push('<footer class="wc-act"><button class="primary wc-add" data-cid="' + E(cid) + '"' + (has ? ' disabled' : '') + '>' + (has ? '✓ ' + T('In my word book', '已在生词本') : '＋ ' + T('Add to my word book', '加入生词本')) + '</button></footer>');
    return { html: '<article class="wcard">' + H.join('') + '</article>', site: site, d: d, cid: cid, head: head };
  }

  function famLazy(box) { // 词典词（非本站词条）的词族：查出每个成员的词性后画成树
    var el = box.querySelector('[data-famlazy]'); if (!el) return;
    var ws = el.dataset.famlazy.split(','), cur = el.dataset.cur, got = [], left = ws.length;
    ws.forEach(function (w) {
      EHDict.lookup(w, function (d) {
        if (d && d.head === w) got.push({ w: w, p: posOf(d.e), zh: zhFirst(d.e.zh).split(/[,，;；]/).slice(0, 2).join('，').slice(0, 14), id: BYKEY[w] && BYKEY[w].single ? BYKEY[w].id : '' });
        if (--left === 0 && got.length && el.parentNode) el.outerHTML = famTree(cur, got, cur);
      });
    });
  }

  function addToBook(info) {
    var s = info.site, e = info.d && info.d.e || {};
    var ipa = s && s.ipa ? s.ipa : (e.uk ? '/' + e.uk + '/' : e.us ? '/' + e.us + '/' : '');
    var back = s ? (s.ex && s.ex[0] ? s.ex[0].en : (s.coll || []).join('; ')) : (e.en || '');
    var ok = EH.addCard({ id: info.cid, kind: 'word', lesson: 'learn', front: info.head, back: back, extra: { zh: s ? s.zh : String(e.zh || '').split('\n')[0], ipa: ipa, unit: s ? 'New words · ' + ((L.units[s.u] || {}).en || s.book || '') : 'New words · lookup', hint: '' } });
    EH.touch(); EH.save(); return ok;
  }

  function render(box, q, opts) {
    opts = opts || {};
    var site = BYID[q] || BYKEY[String(q).toLowerCase()] || null;
    var key = site ? (site.single ? site.w : site.k) : q;
    box.innerHTML = '<p class="muted">…</p>';
    var done = function (d) {
      var info = build(site, d);
      if (!site && !d) { box.innerHTML = '<p class="muted">' + T('Not found: ', '没查到：') + '<b class="en">' + E(q) + '</b></p>'; if (opts.cb) opts.cb(null); return; }
      box.innerHTML = info.html; box._info = info; famLazy(box);
      if (opts.cb) opts.cb(info);
    };
    if (window.EHDict && key) EHDict.lookup(key, done);
    else done(null);
  }

  /* ---------- 弹窗与「走过的路」 ---------- */
  var TRAIL = [];
  function ensurePop() {
    var p = document.getElementById('wc-pop');
    if (!p) {
      p = document.createElement('div'); p.id = 'wc-pop'; p.hidden = true;
      p.innerHTML = '<div class="wc-box"><button class="wc-x" id="wc-x">✕</button><div id="wc-body"></div></div>';
      document.body.appendChild(p);
    }
    if (!document.getElementById('wc-trail')) {
      var box = p.querySelector('.wc-box'), bar = document.createElement('div');
      bar.className = 'wc-bar'; bar.innerHTML = '<div id="wc-trail" class="wc-trail" aria-label="Words you came through"></div>';
      var x = p.querySelector('.wc-x'); x.setAttribute('aria-label', 'Close'); bar.appendChild(x);
      box.insertBefore(bar, box.firstChild);
      p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-label', 'Word card');
    }
    return p;
  }
  function label(q) { var s = BYID[q] || BYKEY[String(q).toLowerCase()]; return s ? s.w : String(q); }
  function paintTrail() {
    var t = document.getElementById('wc-trail'); if (!t) return;
    var n = TRAIL.length;
    t.innerHTML = (n > 1 ? '<button class="small wc-back" aria-label="Back to the previous word">←</button>' : '') +
      TRAIL.slice(-4).map(function (q, i, a) { var idx = n - a.length + i; return i === a.length - 1 ? '<b class="en">' + E(label(q)) + '</b>' : '<button class="linkish wc-jump en" data-i="' + idx + '">' + E(label(q)) + '</button>'; }).join('<span class="sep">›</span>');
  }
  function pop(word, keep) {
    var p = ensurePop();
    if (p.hidden) TRAIL = [];
    if (!keep) { if (TRAIL[TRAIL.length - 1] !== word) TRAIL.push(word); }
    p.hidden = false; document.documentElement.classList.add('wc-open');
    var body = document.getElementById('wc-body');
    render(body, word, { cb: function () { p.querySelector('.wc-box').scrollTop = 0; } });
    paintTrail();
  }
  function close() { var p = document.getElementById('wc-pop'); if (p) p.hidden = true; TRAIL = []; document.documentElement.classList.remove('wc-open'); }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var b = t.closest('[data-wsay]'); if (b) { say(b.dataset.wsay, b.dataset.lang, +(b.dataset.rate || 0.9)); return; }
    var cmi = t.closest('#wc-pop .cm-i'); if (cmi) { cmi.classList.add('seen'); say(cmi.dataset.say, 'en-GB', 0.9); return; }
    var rc = t.closest('#wc-pop .cm-recall'); if (rc) { var m = rc.closest('.wc-coll').querySelector('.cmap'); var on = m.classList.toggle('recall'); rc.setAttribute('aria-pressed', on ? 'true' : 'false'); m.querySelectorAll('.cm-i').forEach(function (x) { x.classList.remove('seen'); }); return; }
    var nt = t.closest('.net-tab'); if (nt) { var s = nt.closest('.wc-net'); s.querySelectorAll('.net-tab').forEach(function (x) { var on = x === nt; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); }); s.querySelectorAll('.net-p').forEach(function (x) { x.hidden = x.dataset.netp !== nt.dataset.net; }); return; }
    var em = t.closest('.ex-more'); if (em) { var w = em.closest('.wc-ex'); var o = w.classList.toggle('all'); em.setAttribute('aria-expanded', o ? 'true' : 'false'); em.hidden = true; return; }
    var bk = t.closest('.wc-back'); if (bk) { TRAIL.pop(); pop(TRAIL[TRAIL.length - 1], true); return; }
    var jp = t.closest('.wc-jump'); if (jp) { TRAIL = TRAIL.slice(0, +jp.dataset.i + 1); pop(TRAIL[TRAIL.length - 1], true); return; }
    var g = t.closest('.wc-go'); if (g) { pop(g.dataset.wid); return; }
    var lk = t.closest('.wc-look'); if (lk) { pop(lk.dataset.look); return; }
    var lw = t.closest('.lw'); if (lw) { pop(lw.textContent); return; }
    var dc = t.closest('[data-card]'); if (dc) { pop(dc.dataset.card); return; }
    var a = t.closest('.wc-add'); if (a) {
      var card = a.closest('.wcard'), box = card.parentNode;
      if (box._info) { addToBook(box._info); card.querySelectorAll('.wc-add').forEach(function (x) { x.disabled = true; x.innerHTML = x.classList.contains('star') ? '★' : '✓ ' + T('In my word book', '已在生词本'); }); EH.toast(T('Added to your word book.', '已加入生词本。')); }
      return;
    }
    if (t.id === 'wc-x' || t.id === 'wc-pop') close();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
  ensurePop();
  window.EHCard = { render: render, pop: pop, say: say, clickable: clickable, add: addToBook, byId: BYID, inBook: inBook, LV: LV };
})();
