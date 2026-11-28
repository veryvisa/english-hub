/* 查词：按需用 <script> 加载 data/dict/dNNN.js 分片（ECDICT＋CMUdict，裁剪见 bin/lexicon.py）。不发任何网络上传，不用 fetch。
   EHDict.lookup(word, cb) → cb(null) 或 {head, form, how, e}：head＝词条（原形），form＝用户点的形式，how＝变化说明，e＝词条数据。 */
(function () {
  'use strict';
  var IDX = window.EH_DICT_INDEX || [], shards = {}, waiting = {};
  var me = document.currentScript && document.currentScript.getAttribute('src') || 'assets/dict.js';
  var base = me.replace(/assets\/dict\.js.*$/, '');
  window.EH_DICT_LOAD = function (i, obj) { shards[i] = obj; var w = waiting[i] || []; delete waiting[i]; w.forEach(function (f) { f(); }); };
  function shardOf(w) {
    var lo = 0, hi = IDX.length - 1, ans = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (IDX[m] <= w) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans;
  }
  function load(i, cb) {
    if (shards[i]) return cb();
    if (waiting[i]) { waiting[i].push(cb); return; }
    waiting[i] = [cb];
    var s = document.createElement('script');
    s.src = base + 'data/dict/d' + String(i).padStart(3, '0') + '.js';
    s.onerror = function () { shards[i] = shards[i] || {}; var w = waiting[i] || []; delete waiting[i]; w.forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }
  function raw(w, cb) { var i = shardOf(w); if (i < 0) return cb(null); load(i, function () { cb(shards[i][w] || null); }); }
  var RULES = [ // [后缀, 换成, 说明]
    ["'s", '', 'possessive'], ["s'", 's', 'possessive'], ['ies', 'y', 'plural / -s'], ['ied', 'y', 'past'], ['ier', 'y', 'comparative'], ['iest', 'y', 'superlative'],
    ['ing', '', '-ing'], ['ing', 'e', '-ing'], ['ed', '', 'past'], ['ed', 'e', 'past'], ['d', '', 'past'], ['es', '', 'plural / -s'], ['s', '', 'plural / -s'],
    ['er', '', 'comparative'], ['est', '', 'superlative'], ['ly', '', 'adverb'], ['ily', 'y', 'adverb']];
  function cands(w) {
    var out = [[w, '']];
    RULES.forEach(function (r) {
      if (w.length > r[0].length + 2 && w.slice(-r[0].length) === r[0]) {
        var st = w.slice(0, -r[0].length);
        out.push([st + r[1], r[2]]);
        if (/(ing|ed|er|est)$/.test(r[0]) && !r[1] && st.length > 2 && st[st.length - 1] === st[st.length - 2]) out.push([st.slice(0, -1), r[2]]);
      }
    });
    return out;
  }
  function norm(w) { return String(w || '').toLowerCase().replace(/[’‘]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, ''); }
  var FORM = { p: 'past', d: 'past participle', i: '-ing', '3': 'he/she/it', r: 'comparative', t: 'superlative', s: 'plural' };
  function lookup(word, cb) {
    var w = norm(word); if (!w) return cb(null);
    var list = cands(w), k = 0;
    (function next() {
      if (k >= list.length) return cb(null);
      var c = list[k++];
      raw(c[0], function (e) {
        if (!e) return next();
        if (e.l && !e.zh) { // 屈折形式指针 → 原形
          return raw(e.l, function (le) { if (!le) return next(); cb({ head: e.l, form: w, how: howForm(le, w) || c[1], e: le }); });
        }
        cb({ head: c[0], form: w, how: c[0] === w ? '' : c[1], e: e });
      });
    })();
  }
  function howForm(e, w) {
    var x = forms(e); for (var k in x) if (x[k] === w) return FORM[k] || ''; return '';
  }
  function forms(e) { // "p:went/d:gone/i:going/3:goes" → {p:'went',…}
    var o = {}; String(e && e.x || '').split('/').forEach(function (p) { var kv = p.split(':'); if (kv.length === 2 && FORM[kv[0]]) o[kv[0]] = kv[1]; });
    return o;
  }
  window.EHDict = { lookup: lookup, forms: forms, FORM: FORM, norm: norm, ready: function () { return IDX.length > 0; } };
})();
