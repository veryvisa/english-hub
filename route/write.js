/* English Hub · 写作体检（离线规则，纯本机，无任何网络请求）。设计：design/site-arch-b1c1-2026-11-26.md §六。
   analyze(text, cfg) 只描述「这段话里有什么」，不打分、不判级；range() 是给进度曲线与水平入口用的粗量，
   阈值在 tests/test_route.py 里拿思培三级示范答案（同题 5–6 / 7–8 / 9+ 各 71 篇）标定过，判不了的区间明说判不了。
   cfg: {targets:{chunks:[{w,rx}], patterns:[{id,name:{en,zh},rx:[...]}]}, ladders:{base:[up,…]}, min, max}
   同一份文件在浏览器（window.EH_WRITE）与 node（module.exports，标定用）里都能跑。 */
(function (root) {
  'use strict';
  var CONN = {
    add: ['also', 'moreover', 'furthermore', 'in addition', 'besides', "what's more", 'what is more', 'on top of that'],
    contrast: ['however', 'but', 'yet', 'on the other hand', 'whereas', 'in contrast', 'nevertheless', 'nonetheless', 'still', 'instead'],
    cause: ['because', 'as a result', 'therefore', 'thus', 'consequently', 'due to', 'owing to', "that's why", 'that is why', 'which means', 'so that'],
    concede: ['although', 'though', 'even though', 'even if', 'despite', 'in spite of', 'admittedly', 'granted', 'much as', 'while it is true', 'that said', 'having said that'],
    cond: ['if', 'unless', 'provided that', 'as long as', 'in case', 'otherwise', 'whether'],
    example: ['for example', 'for instance', 'such as', 'in particular', 'namely', 'to illustrate'],
    order: ['first', 'firstly', 'first of all', 'second', 'secondly', 'finally', 'after that', 'in the end', 'to begin with', 'last'],
    sum: ['in short', 'overall', 'in conclusion', 'to sum up', 'all in all', 'on the whole']
  };
  var CONN_NAME = { add: ['adding', '补充'], contrast: ['contrast', '转折'], cause: ['cause and result', '因果'], concede: ['concession', '让步'], cond: ['condition', '条件'], example: ['example', '举例'], order: ['order', '顺序'], sum: ['summing up', '总结'] };
  var PP = '(?:\\w+ed|known|given|made|done|seen|taken|told|sent|paid|built|held|written|shown|found|kept|left|lost|sold|set|put|said|thought|brought|bought|caught|taught|chosen|driven|spoken|stolen|broken|forgotten|hidden|grown|drawn|thrown|worn|born)';
  var STRUCT = [
    ['relative', ['relative clause', '定语从句'], /[a-z,] (?:who|whose|whom|which)\b|\b(?:the|a|an|any|every|some) \w+ that (?:I|you|we|they|he|she|it|is|are|was|were|has|have|had|can|could|will|would|\w+s|\w+ed)\b/i],
    ['concession', ['concession', '让步'], /\b(?:although|even though|even if|despite|in spite of|whereas|much as|admittedly)\b|\bthough\b|^while\b|\b(?:however|whatever|whoever|wherever) \w+/i],
    ['condition', ['condition', '条件'], /\b(?:if|unless|provided(?: that)?|as long as|supposing)\b|^(?:had|were|should) (?:I|we|you|he|she|it|they)\b/i],
    ['reason', ['reason or result clause', '原因与结果从句'], /\b(?:because|so that|which means|as a result|due to|owing to)\b|^since\b|, since\b|\bso \w+ that\b/i],
    ['participle', ['participle clause', '分词结构'], /^(?:having|being|not \w+ing|\w{3,}ing|\w{3,}ed|given|faced|compared) [^,]{2,70},\s|,\s(?:\w{3,}ing|leaving|making|causing|meaning) [a-z]/i],
    ['passive', ['passive', '被动'], new RegExp('\\b(?:am|is|are|was|were|be|been|being|get|gets|got)\\s+(?:\\w+ly\\s+|not\\s+|also\\s+|often\\s+)?' + PP + '\\b', 'i')],
    ['thatclause', ['reporting or noun clause', '转述与名词性从句'], /\b(?:think|thought|believe|argue|claim|suggest|say|said|know|knew|show|mean|feel|felt|find|found|hope|reali[sz]e|agree|explain|notice|doubt|assume|admit|wonder|ask|decide)\w* (?:that|whether|if|what|how|why)\b|\b(?:the fact|idea|claim|belief|reason|point|risk|chance) (?:that|why)\b|^what \w+ [^,.]{2,50}\b(?:is|was)\b/i],
    ['emphasis', ['cleft or inversion', '强调与倒装'], /^it (?:is|was|'s) [^.]{2,50}\b(?:that|who)\b|^what [^.?]{2,60}\b(?:is|was)\b(?! it)|^(?:never|rarely|seldom|not only|hardly|no sooner|little|only (?:then|when|after|by|once)|under no|at no)\b[^.]* (?:have|has|had|do|does|did|is|are|was|were|will|would|can|could|should)\b/i],
    ['infinitive', ['purpose or -ing subject', '目的与动名词主语'], /\b(?:in order to|so as to)\b|^to \w+ [^,]{2,60},\s|^\w{3,}ing [^,.]{2,50}\b(?:is|was|can|will|takes|makes|helps)\b/i]
  ];
  var HEDGE = /\b(?:may|might|could|tend(?:s|ed)? to|seem(?:s|ed)?|appear(?:s|ed)?|likely|unlikely|perhaps|probably|possibly|arguably|presumably|to some extent|to a (?:certain|large) extent|in most cases|generally|usually|often|sometimes|rather|fairly|somewhat|I would say|I'd say|it depends)\b/gi;
  var ABSOL = /\b(?:always|never|everyone|everybody|nobody|no one|all people|every \w+|totally|completely|absolutely|definitely|certainly|impossible|must be|without (?:a|any) doubt|undoubtedly|no doubt)\b/gi;
  var VAGUE = ['very', 'really', 'good', 'bad', 'nice', 'big', 'thing', 'things', 'a lot', 'lots of', 'important', 'get', 'got', 'many', 'think', 'say', 'said', 'problem', 'make', 'do', 'want', 'like', 'help', 'need', 'use', 'show', 'give', 'change', 'start', 'so', 'happy', 'sad', 'hard', 'easy'];
  // 华人常见错：只收「几乎不会误报」的形状。每条 [id, 正则, 英文说明, 中文说明]
  var TRAPS = [
    ['although-but', /\b(?:al)?though\b[^.?!;]*,\s*but\b/i, 'although … but: use one of them, not both.', 'although 和 but 只留一个。'],
    ['because-so', /\bbecause\b[^.?!;]*,\s*so\b/i, 'because … so: use one of them, not both.', 'because 和 so 只留一个。'],
    ['very-verb', /\bvery (?:like|enjoy|love|want|hope|agree|appreciate|miss|need)\b/i, 'very + verb: say "really like" or "like … very much".', 'very 不能直接修饰动词：really like，或 like … very much。'],
    ['double-comp', /\bmore (?:better|worse|easier|cheaper|bigger|faster|harder|safer|higher|lower|older|younger)\b/i, 'Double comparative: "better", not "more better".', '比较级重复了：better，不是 more better。'],
    ['verb-prep', /\b(?:discuss(?:ed|es|ing)? about|contact(?:ed|s|ing)? with|marr(?:y|ied) with|emphasi[sz]e(?:d|s)? on|mention(?:ed|s)? about|enter(?:ed|s)? into the (?:room|building|office)|reach(?:ed|es)? to|answer(?:ed|s)? to (?:the|my|your|his|her) (?:question|email)|approach(?:ed|es)? to (?:me|him|her|us|them))\b/i, 'This verb takes its object directly: discuss the plan, contact them, mention it.', '这个动词直接跟宾语，不加介词：discuss the plan、contact them、mention it。'],
    ['opinion-think', /\bin my opinion,? I (?:think|believe|feel)\b/i, '"In my opinion, I think" says it twice: keep one.', 'In my opinion 和 I think 说了两遍，留一个。'],
    ['according-me', /\baccording to (?:me|my opinion|my view)\b/i, '"According to" is for other people\'s views: say "In my view".', 'according to 用来引别人的看法；说自己的用 In my view。'],
    ['there-have', /\bthere (?:have|has) (?:a|an|many|some|lots|a lot|no|\d)/i, 'there is / there are, not "there have".', '「有」用 there is / there are，不是 there have。'],
    ['suggest-to', /\b(?:suggest(?:ed|s)?|recommend(?:ed|s)?) (?:me|you|him|her|us|them) to\b/i, 'suggest (that) you do it / recommend doing it, not "suggest you to".', 'suggest (that) you do / recommend doing，不说 suggest you to do。'],
    ['uncountable', /\b(?:an? (?:information|advice|equipment|furniture|homework|knowledge|research|evidence|feedback|luggage|news|progress|software|traffic)|informations|advices|equipments|furnitures|homeworks|knowledges|evidences|feedbacks|luggages|softwares|staffs)\b/i, 'Uncountable noun: no "a", no plural (a piece of advice, some information).', '不可数名词：不加 a、不加复数（a piece of advice、some information）。'],
    ['agreement', /\b(?:he|she|it) don't\b|\b(?:I|we|they|you|people) doesn't\b|^(?:he|she|it) (?:have|are)\b|^(?:we|they) (?:has|is|was)\b/i, 'Subject and verb do not agree (he doesn\'t, they have, people are).', '主谓不一致（he doesn\'t、they have、people are）。'],
    ['perfect-past-time', /\b(?:have|has) (?:\w+ed|been|gone|seen|done|made|taken|bought|met|got) [^.?!;]*\b(?:yesterday|last (?:week|month|year|night)|\w+ (?:years|days|weeks|months) ago)\b|\b(?:yesterday|last (?:week|month|year|night)),? (?:I|we|he|she|they) (?:have|has) \w+/i, 'A finished time (yesterday, last year, two days ago) takes the past simple, not have + -ed.', '有明确的过去时间（yesterday、last year、two days ago）用一般过去时，不用现在完成时。'],
    ['despite-of', /\bdespite of\b|\bin spite(?! of)\b/i, 'despite + noun, or in spite of + noun.', 'despite 后面不加 of；in spite 后面要加 of。'],
    ['can-able', /\b(?:can|could|will|may|might) able to\b|\bam agree\b|\bare agree\b|\bis agree\b/i, 'can / be able to, not both; "I agree", not "I am agree".', 'can 和 be able to 只用一个；I agree，不是 I am agree。'],
    ['forward-to', /\blook(?:ing)? forward to (?:hear|see|meet|receive|work|talk|get)\b/i, 'look forward to + -ing: looking forward to hearing from you.', 'look forward to 后面跟 -ing：looking forward to hearing from you。'],
    ['explain-me', /\bexplain(?:ed|s)? (?:me|you|him|her|us|them)\b/i, 'explain it to me, not "explain me".', 'explain it to me，不是 explain me。'],
    ['cliche', /\bwith the (?:rapid )?development of\b|\bevery coin has two sides\b|\bas we all know\b|\bnowadays,? more and more\b/i, 'A stock opening phrase: start with your actual point instead.', '套话开头：直接从你要说的那一点写起。']
  ];
  var ABBR = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|a\.m|p\.m|No|Inc|Ltd)\./g;

  function sentences(text) {
    var t = String(text || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(ABBR, function (m) { return m.replace(/\./g, '∙'); });
    var out = [], re = /[^.!?\n]+(?:[.!?]+["')\]]*|\n+|$)/g, m;
    while ((m = re.exec(t))) { var s = m[0].replace(/∙/g, '.').trim(); if (s && /[A-Za-z]/.test(s)) out.push(s); if (m.index === re.lastIndex) re.lastIndex++; }
    return out;
  }
  function words(s) { return (String(s).match(/[A-Za-z][A-Za-z'’-]*/g) || []); }
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function count(text, phrase) {
    var re = new RegExp('(?:^|[^A-Za-z])' + esc(phrase).replace(/ /g, '\\s+') + '(?![A-Za-z])', 'gi');
    return (text.match(re) || []).length;
  }
  function rxSafe(src, flags) { try { return new RegExp(src, flags || 'i'); } catch (e) { return null; } }

  function analyze(text, cfg) {
    cfg = cfg || {};
    var S = sentences(text), all = words(text), n = all.length, low = ' ' + all.join(' ').toLowerCase() + ' ';
    var lens = S.map(function (s) { return words(s).length; });
    var mean = S.length ? n / S.length : 0;
    var sd = S.length > 1 ? Math.sqrt(lens.reduce(function (a, l) { return a + (l - mean) * (l - mean); }, 0) / S.length) : 0;
    // 连续短句、超长句
    var run = 0, shortRun = 0, tooLong = [];
    lens.forEach(function (l, i) { if (l <= 8) { run++; if (run >= 3) shortRun = Math.max(shortRun, run); } else run = 0; if (l > 40) tooLong.push(i); });
    // 衔接
    var conn = {}, connTotal = 0, plain = text.replace(/\s+/g, ' ');
    Object.keys(CONN).forEach(function (g) {
      CONN[g].forEach(function (p) {
        // 顺序词只在句首算（first month、the last time 里的不算）
        var c = g === 'order' ? (plain.match(new RegExp('(?:^|[.!?:;]\\s+)' + esc(p) + '(?=[,\\s])', 'gi')) || []).length : count(plain, p);
        if (c) { (conn[g] = conn[g] || {})[p] = c; connTotal += c; }
      });
    });
    var so = (plain.match(/(?:^|[.,;!?]\s+)so\b(?! (?:much|many|far|that))/gi) || []).length;
    if (so) { (conn.cause = conn.cause || {}).so = so; connTotal += so; }
    if ((plain.match(/(?:^|[.!?]\s+)While\b/g) || []).length) (conn.concede = conn.concede || {})['while'] = 1;
    var basic = ['but', 'so', 'because', 'also', 'if', 'first', 'second', 'finally', 'still'], onlyBasic = true;
    Object.keys(conn).forEach(function (g) { Object.keys(conn[g]).forEach(function (p) { if (basic.indexOf(p) < 0) onlyBasic = false; }); });
    // 句子形状
    var struct = {};
    S.forEach(function (s, i) { STRUCT.forEach(function (d) { if (d[2].test(s)) (struct[d[0]] = struct[d[0]] || []).push(i); }); });
    // 句首
    var open = {}, people = 0;
    S.forEach(function (s) { var w = (words(s)[0] || '').toLowerCase(); open[w] = (open[w] || 0) + 1; if (/^(?:people|many people|some people|most people|everyone)\b/i.test(s)) people++; });
    var topOpen = Object.keys(open).sort(function (a, b) { return open[b] - open[a]; })[0] || '';
    // 用词
    var hedges = (text.match(HEDGE) || []).map(function (x) { return x.toLowerCase(); });
    var absol = (text.match(ABSOL) || []).map(function (x) { return x.toLowerCase(); });
    var vague = {};
    VAGUE.forEach(function (v) { var c = count(low, v); if (c >= (v === 'very' || v === 'really' || v === 'thing' || v === 'things' || v === 'a lot' || v === 'lots of' || v === 'good' || v === 'bad' || v === 'nice' ? 2 : 3)) vague[v] = c; });
    var uniq = {}, long = 0;
    all.forEach(function (w) { var k = w.toLowerCase(); uniq[k] = 1; if (w.length >= 8) long++; });
    var traps = [];
    TRAPS.forEach(function (t) { S.forEach(function (s, i) { var m = s.match(t[1]); if (m) traps.push({ id: t[0], i: i, hit: m[0], en: t[2], zh: t[3] }); }); });
    var mm = (low.match(/ more and more /g) || []).length; if (mm >= 2) traps.push({ id: 'more-and-more', i: -1, hit: 'more and more ×' + mm, en: '"more and more" ' + mm + ' times: try "increasingly" or "a growing number of".', zh: 'more and more 用了 ' + mm + ' 次：换成 increasingly 或 a growing number of。' });
    // 本周目标
    var tg = cfg.targets || {}, chunks = [], pats = [];
    (tg.chunks || []).forEach(function (c) { var r = rxSafe(c.rx, 'i'); chunks.push({ w: c.w, used: !!(r && r.test(plain)) }); });
    (tg.patterns || []).forEach(function (p) { var used = (p.rx || []).some(function (x) { var r = rxSafe(x, 'i'); return r && S.some(function (s) { return r.test(s); }); }); pats.push({ id: p.id, name: p.name, used: used }); });
    var m = { words: n, sentences: S.length, mean: +mean.toFixed(1), sd: +sd.toFixed(1), shortRun: shortRun, tooLong: tooLong.length, connGroups: Object.keys(conn).length, connTotal: connTotal, onlyBasic: onlyBasic && connTotal > 0,
      structTypes: Object.keys(struct).length, hedges: hedges.length, absolutes: absol.length, longShare: n ? +(long / n).toFixed(3) : 0, ttr: n ? +(Object.keys(uniq).length / n).toFixed(2) : 0,
      topOpen: topOpen, topOpenN: open[topOpen] || 0, people: people, traps: traps.length, chunksUsed: chunks.filter(function (c) { return c.used; }).length, patsUsed: pats.filter(function (p) { return p.used; }).length };
    m.range = range(m);
    return { m: m, S: S, lens: lens, conn: conn, struct: struct, hedges: hedges, absol: absol, vague: vague, traps: traps, chunks: chunks, pats: pats };
  }

  /* 句式与衔接的「面」有多宽：0–10 的粗量，只用来画自己的前后对比曲线和给水平入口分三档；不是分数，更不是考试级别。 */
  function range(m) {
    if (m.words < 25) return null;                                    // 太短，判不了
    var v = Math.min(m.structTypes, 6) * 0.9 + Math.min(m.connGroups, 5) * 0.5 + Math.max(0, Math.min(3, (m.mean - 9) / 3)) * 0.6 + Math.min(1, m.hedges) * 0.4 + Math.max(0, Math.min(2, (m.longShare - 0.08) / 0.04)) * 0.5;
    return +Math.min(10, v).toFixed(1);
  }
  var BANDS = { lo: 2.2, hi: 4.2 };                                    // 标定（tests/test_route.py，71 题 × 三档）：5–6 级示范 77% 落在 lo 以下，9+ 级示范 75% 落在 hi 以上，判反（低判高或高判低）3/142；7–8 级三档都有，中间带判不稳
  function band(r) { return r == null ? null : r < BANDS.lo ? 1 : r >= BANDS.hi ? 3 : 2; }

  /* 把分析结果排成「做到了 / 可以再改 / 下一稿只改这一处」。每条 {k:'good'|'fix', id, en, zh, w:优先级} */
  function advise(A, cfg) {
    cfg = cfg || {};
    var m = A.m, good = [], fix = [], L = cfg.ladders || {};
    function G(id, en, zh) { good.push({ id: id, en: en, zh: zh }); }
    function F(id, w, en, zh) { fix.push({ id: id, w: w, en: en, zh: zh }); }
    if (cfg.min && m.words < cfg.min) F('short', 9, m.words + ' words: the task asks for at least ' + cfg.min + '. Add one reason or one example.', '现在 ' + m.words + ' 词，任务要求至少 ' + cfg.min + ' 词：补一个理由或一个例子。');
    if (cfg.max && m.words > cfg.max * 1.25) F('long', 3, m.words + ' words: the task asks for about ' + cfg.max + '. Cut the sentence that repeats another.', '现在 ' + m.words + ' 词，任务要求约 ' + cfg.max + ' 词：删掉意思重复的那一句。');
    A.traps.forEach(function (t) { F('trap:' + t.id, 8, '“' + t.hit + '”: ' + t.en, '「' + t.hit + '」：' + t.zh); });
    A.pats.forEach(function (p) { if (p.used) G('pat:' + p.id, 'You used this week\'s pattern: ' + p.name.en + '.', '用上了本周句式：' + p.name.zh + '。'); else F('pat:' + p.id, 7, 'This week\'s pattern is not in the text yet: ' + p.name.en + '. Rewrite one sentence with it.', '本周句式还没用上：' + p.name.zh + '。挑一句改写成它。'); });
    if (A.chunks.length) {
      var u = A.chunks.filter(function (c) { return c.used; }).map(function (c) { return c.w; }), need = cfg.needChunks || 3;
      if (u.length >= need) G('chunks', 'Words and chunks from this week used: ' + u.join(', ') + '.', '用上了本周的词与词块：' + u.join('、') + '。');
      else F('chunks', 6, 'Only ' + u.length + ' of this week\'s words and chunks used (aim for ' + need + '). Try: ' + A.chunks.filter(function (c) { return !c.used; }).slice(0, 4).map(function (c) { return c.w; }).join(', ') + '.', '本周的词与词块只用上 ' + u.length + ' 个（目标 ' + need + ' 个）。试试：' + A.chunks.filter(function (c) { return !c.used; }).slice(0, 4).map(function (c) { return c.w; }).join('、') + '。');
    }
    if (m.shortRun >= 3) F('short-run', 6, m.shortRun + ' short sentences in a row. Join two of them with a reason or a contrast (because, although, which).', '连续 ' + m.shortRun + ' 句短句。把其中两句用原因或转折接起来（because、although、which）。');
    if (m.tooLong) F('too-long', 5, m.tooLong + ' sentence(s) over 40 words. Split at the second idea.', '有 ' + m.tooLong + ' 句超过 40 词：在第二个意思那里断开。');
    if (m.sentences >= 4 && m.sd < 3) F('same-length', 3, 'Every sentence is about the same length (around ' + Math.round(m.mean) + ' words). Follow a long one with a short one.', '每句都差不多长（约 ' + Math.round(m.mean) + ' 词）。长句后面跟一句短的。');
    else if (m.sentences >= 4 && m.sd >= 5) G('varied', 'Sentence length varies (from ' + Math.min.apply(null, A.lens) + ' to ' + Math.max.apply(null, A.lens) + ' words).', '句子有长有短（' + Math.min.apply(null, A.lens) + ' 到 ' + Math.max.apply(null, A.lens) + ' 词）。');
    var gs = Object.keys(A.conn);
    if (m.sentences >= 3 && !m.connTotal) F('no-link', 6, 'No linking words at all. Show how the sentences relate: a reason, a contrast, an example.', '一个衔接词都没有。把句子之间的关系写出来：原因、转折、举例。');
    else if (m.onlyBasic && m.sentences >= 4) F('basic-link', 4, 'Linking is only ' + gs.map(function (g) { return Object.keys(A.conn[g]).join('/'); }).join(', ') + '. Swap one for however, as a result, although or for instance.', '衔接只有 ' + gs.map(function (g) { return Object.keys(A.conn[g]).join('/'); }).join('、') + '。换一个成 however、as a result、although 或 for instance。');
    else if (gs.length >= 3) G('links', 'Linking covers ' + gs.length + ' kinds: ' + gs.map(function (g) { return CONN_NAME[g][0]; }).join(', ') + '.', '衔接覆盖 ' + gs.length + ' 类：' + gs.map(function (g) { return CONN_NAME[g][1]; }).join('、') + '。');
    var st = Object.keys(A.struct);
    if (st.length >= 3) G('shapes', st.length + ' sentence shapes: ' + st.map(function (k) { return name(k)[0]; }).join(', ') + '.', '句子形状 ' + st.length + ' 种：' + st.map(function (k) { return name(k)[1]; }).join('、') + '。');
    else if (m.sentences >= 4) F('shapes', 5, (st.length ? 'Only ' + st.length + ' sentence shape(s) beyond the simple sentence' : 'Every sentence is a simple sentence') + '. Add one clause with although, which or if.', (st.length ? '简单句之外只有 ' + st.length + ' 种句子形状' : '全是简单句') + '。用 although、which 或 if 加一个从句。');
    if (m.topOpenN >= 3 && m.topOpenN / m.sentences >= 0.5) F('opener', 4, m.topOpenN + ' of ' + m.sentences + ' sentences start with “' + cap(m.topOpen) + '”. Start one with the time, the reason or the condition.', m.sentences + ' 句里有 ' + m.topOpenN + ' 句以「' + cap(m.topOpen) + '」开头。挑一句改成从时间、原因或条件说起。');
    if (m.people >= 2) F('people', 3, m.people + ' sentences start with “people”. Say who: tenants, new drivers, parents of teenagers.', '有 ' + m.people + ' 句以 people 开头。说具体是谁：租客、新手司机、青少年的家长。');
    if (m.absolutes >= 2 && !m.hedges) F('absolute', 5, 'Strong claims without limits (' + uniq(A.absol).join(', ') + '). Limit one: often, in most cases, tends to.', '说得太满（' + uniq(A.absol).join('、') + '），没有任何限定。给其中一处加上限定：often、in most cases、tends to。');
    else if (m.hedges) G('hedge', 'You limit your claims (' + uniq(A.hedges).slice(0, 4).join(', ') + ').', '说话留了余地（' + uniq(A.hedges).slice(0, 4).join('、') + '）。');
    Object.keys(A.vague).slice(0, 3).forEach(function (v) {
      var up = L[v] || L[v.replace(/s$/, '')];
      F('vague:' + v, up ? 4 : 2, '“' + v + '” ×' + A.vague[v] + (up ? '. More exact: ' + up.join(', ') + '.' : '. Say exactly what you mean once.'), '「' + v + '」用了 ' + A.vague[v] + ' 次' + (up ? '。更准的说法：' + up.join('、') + '。' : '。至少有一处换成具体的说法。'));
    });
    fix.sort(function (a, b) { return b.w - a.w; });
    return { good: good, fix: fix, next: fix[0] || null };
  }
  function name(k) { for (var i = 0; i < STRUCT.length; i++) if (STRUCT[i][0] === k) return STRUCT[i][1]; return [k, k]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  /* 给外部 AI 的批改提示词：只指出问题、不代写。由读者自己复制到他选的 AI 里用，本站不发任何请求。 */
  function prompt(text, cfg) {
    cfg = cfg || {};
    var tg = cfg.targets || {};
    return ['You are a writing coach for an adult Chinese speaker of English at about ' + (cfg.level || 'B2') + ' level.',
      'Task they were given: ' + (cfg.task || '(free writing)'),
      (tg.patterns && tg.patterns.length ? 'Sentence pattern they are practising this week: ' + tg.patterns.map(function (p) { return p.name.en; }).join('; ') + '.' : ''),
      (tg.chunks && tg.chunks.length ? 'Words and chunks they are practising: ' + tg.chunks.map(function (c) { return c.w; }).join(', ') + '.' : ''),
      'Rules for your feedback:',
      '1. Do NOT rewrite the whole text and do NOT give a model answer.',
      '2. Quote at most five sentences that most need work. For each: say what kind of problem it is (grammar, word choice, collocation, logic, register), explain why in one sentence, and give a hint for fixing it, not the fixed sentence.',
      '3. Point out one place where the logic jumps or the claim is too strong, if any.',
      '4. Name two things the writer did well, quoting their words.',
      '5. Finish with ONE thing to change in the next draft.',
      '6. Reply in simple English, with a short Chinese gloss after each point.',
      '', 'The text:', '"""', String(text).trim(), '"""'].filter(function (x) { return x !== ''; }).join('\n');
  }

  var API = { analyze: analyze, advise: advise, range: range, band: band, BANDS: BANDS, prompt: prompt, sentences: sentences, TRAPS: TRAPS.map(function (t) { return t[0]; }), STRUCT: STRUCT.map(function (s) { return [s[0], s[1]]; }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.EH_WRITE = API;
})(typeof window !== 'undefined' ? window : this);
