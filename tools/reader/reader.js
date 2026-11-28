/* 点词阅读器：纯本地。文件用 FileReader 读；文字只存本机 localStorage（english-hub-reader），点「清空」即删。不发任何网络请求。 */
(function () {
  'use strict';
  var E = EH.esc, T = EH.T, KEY = 'english-hub-reader';
  var BANDS = window.EH_BANDS || {};
  var $ = function (id) { return document.getElementById(id); };
  var prefs = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  prefs.size = prefs.size || 18; prefs.lh = prefs.lh || '1.85'; prefs.lv = prefs.lv == null ? 'B2' : prefs.lv;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { EH.toast(T('Too long to keep on this device; it still works until you leave.', '太长，不能保存在本机；离开前照常可用。')); } }

  /* ---------- 解析 ---------- */
  function strip(raw, name) {
    var t = String(raw).replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
    if (/\.(srt|vtt)$/i.test(name || '') || /^WEBVTT/.test(t) || /\d\d:\d\d:\d\d[,.]\d{3}\s*-->/.test(t)) {
      var cues = t.split(/\n\s*\n/).map(function (b) {
        return b.split('\n').filter(function (l) { return !/^\d+$/.test(l.trim()) && l.indexOf('-->') < 0 && !/^(WEBVTT|NOTE|STYLE|Kind:|Language:)/.test(l.trim()); })
          .map(function (l) { return l.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim(); }).filter(Boolean).join(' ');
      }).filter(Boolean);
      var text = cues.join(' ').replace(/\s+/g, ' '), sents = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [text], paras = [];
      for (var i = 0; i < sents.length; i += 4) paras.push(sents.slice(i, i + 4).join('').trim());
      return paras.join('\n\n');
    }
    if (/\.md$/i.test(name || '')) t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1');
    return t;
  }
  var SPK = /^\s*([A-Z][A-Za-z.'’ -]{0,22}|[A-Z]\d?)\s*:\s+(.+)$/;
  function blocks(text) { // → [{k:'h'|'p'|'d', t, who}]
    var out = [];
    text.split(/\n\s*\n/).forEach(function (para) {
      var lines = para.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return;
      var spk = lines.filter(function (l) { return SPK.test(l); }).length;
      if (spk >= 2 && spk >= lines.length / 2) {
        lines.forEach(function (l) { var m = l.match(SPK); if (m) out.push({ k: 'd', who: m[1], t: m[2] }); else if (out.length && out[out.length - 1].k === 'd') out[out.length - 1].t += ' ' + l; else out.push({ k: 'p', t: l }); });
        return;
      }
      if (lines.length === 1 && /^#{1,4}\s/.test(lines[0])) { out.push({ k: 'h', t: lines[0].replace(/^#+\s*/, '') }); return; }
      if (lines.length === 1 && lines[0].length < 70 && !/[.!?,;:"”]$/.test(lines[0]) && /^[A-Z0-9]/.test(lines[0])) { out.push({ k: 'h', t: lines[0] }); return; }
      out.push({ k: 'p', t: lines.join(' ').replace(/\s+/g, ' ') });
    });
    return out;
  }

  /* ---------- 级别 ---------- */
  var LV = { B1: 2, B2: 3, C1: 4 }; // 高于该档才标：band 是 1–3（NGSL 千词段）、4（NAWL）；不在表里的看词典 r（1–5）
  var caps = {};
  function bandOf(w) { var b = BANDS[w]; if (b) return b === 4 ? 4 : b; return 0; }
  function above(w, cut) { var b = bandOf(w); if (b) return b > cut; return null; } // null＝表外，要查词典
  var dictLv = {};
  function mark() {
    var cut = LV[prefs.lv], words = $('rd-out').querySelectorAll('.lw'), unknown = {};
    words.forEach(function (s) {
      s.classList.remove('hi');
      if (!cut) return;
      var w = s.textContent.toLowerCase().replace(/[’]/g, "'");
      if (caps[w] || w.length < 3) return;
      var a = above(w, cut);
      if (a === true) s.classList.add('hi');
      else if (a === null) { if (dictLv[w] != null) { if (dictLv[w] > cut) s.classList.add('hi'); } else unknown[w] = 1; }
    });
    var ks = Object.keys(unknown);
    if (!ks.length) return count();
    var left = ks.length;
    ks.forEach(function (w) {
      EHDict.lookup(w, function (d) {
        dictLv[w] = d && d.e ? (bandOf(d.head) || d.e.r || 0) : 0; // 屈折形式按原形的词段
        if (--left === 0) mark();
      });
    });
  }
  function count() {
    var n = $('rd-out').querySelectorAll('.lw').length, set = {};
    $('rd-out').querySelectorAll('.lw.hi').forEach(function (s) { set[s.textContent.toLowerCase()] = 1; });
    $('rd-count').innerHTML = n + ' ' + T('words', '词') + (prefs.lv ? ' · ' + Object.keys(set).length + ' ' + T('marked above ' + prefs.lv, '个高于 ' + prefs.lv) : '');
  }

  /* ---------- 排版 ---------- */
  function render(text) {
    var bs = blocks(text);
    if (!bs.length) { EH.toast(T('Nothing to lay out.', '没有可排版的文字。')); return; }
    var all = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [], low = {};
    caps = {};
    all.forEach(function (w) { if (/^[a-z]/.test(w)) low[w.toLowerCase()] = 1; });
    all.forEach(function (w) { var l = w.toLowerCase(); if (/^[A-Z]/.test(w) && !low[l]) caps[l] = 1; }); // 只以大写出现的词＝专名，不标
    var html = bs.map(function (b) {
      var t = EHCard.clickable(E(b.t));
      if (b.k === 'h') return '<h2 class="rd-h">' + t + '</h2>';
      if (b.k === 'd') return '<div class="rd-d"><span class="rd-who">' + E(b.who) + '</span><p>' + t + '</p></div>';
      return '<p>' + t + '</p>';
    }).join('');
    $('rd-out').innerHTML = html; $('rd-out').hidden = false; $('rd-bar').hidden = false; $('rd-in').hidden = true; $('rd-words').hidden = true;
    style(); mark();
  }
  function style() {
    var o = $('rd-out'); o.style.fontSize = prefs.size + 'px'; o.style.lineHeight = prefs.lh;
    document.body.dataset.theme = prefs.theme || '';
    $('rd-lh').value = prefs.lh; $('rd-theme').value = prefs.theme || ''; $('rd-lv').value = prefs.lv || '';
  }

  /* ---------- 生词表 ---------- */
  function wordList() {
    var seen = {}, order = [];
    $('rd-out').querySelectorAll('.lw.hi').forEach(function (s) {
      var w = s.textContent.toLowerCase();
      if (!seen[w]) { seen[w] = { n: 0, sent: s.closest('p') ? s.closest('p').textContent : '' }; order.push(w); }
      seen[w].n++;
    });
    var box = $('rd-words'); box.hidden = false;
    if (!order.length) { box.innerHTML = '<p class="muted">' + T('No words above the chosen level. Pick a lower level to see more.', '没有高于所选级别的词；选低一档可看到更多。') + '</p>'; return; }
    box.innerHTML = '<h2>' + T('Word list for this text', '本篇生词表') + ' <span class="muted">' + order.length + '</span></h2>' +
      '<p><button class="primary" id="rd-addall">＋ ' + T('Add all to my word book', '全部加入生词本') + '</button> <button id="rd-csv">⬇ CSV</button></p>' +
      '<div class="tw"><table class="vt" id="rd-wt"><tr><th>' + T('Word', '词') + '</th><th>' + T('Pronunciation', '音标') + '</th><th>' + T('Meaning', '释义') + '</th><th>' + T('Times', '次数') + '</th></tr></table></div>';
    var rows = {}, info = {};
    order.forEach(function (w) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><button class="chip wc-look" data-look="' + E(w) + '">' + E(w) + '</button></td><td class="ipa">…</td><td></td><td>' + seen[w].n + '</td>';
      $('rd-wt').appendChild(tr); rows[w] = tr;
      EHDict.lookup(w, function (d) {
        info[w] = d;
        if (!d) { tr.children[1].textContent = '–'; return; }
        var e = d.e;
        tr.children[0].innerHTML = '<button class="chip wc-look" data-look="' + E(w) + '">' + E(w) + '</button>' + (d.head !== w ? ' <span class="muted">→ ' + E(d.head) + '</span>' : '');
        tr.children[1].textContent = e.uk ? '/' + e.uk + '/' : e.us ? '/' + e.us + '/' : '';
        tr.children[2].innerHTML = '<span class="zh" lang="zh-Hans">' + E(String(e.zh || '').split('\n')[0]) + '</span><span class="enx">' + E(String(e.en || '').split(';')[0]) + '</span>';
      });
    });
    $('rd-addall').onclick = function () {
      var n = 0;
      order.forEach(function (w) { var d = info[w]; if (d) n += EHCard.add({ site: null, d: d, cid: 'ld:' + d.head, head: d.head }) ? 1 : 0; });
      EH.toast(T(n + ' words added to your word book and review.', '已加入 ' + n + ' 个词到生词本与复习。'));
    };
    $('rd-csv').onclick = function () {
      var lines = ['word,base,ipa,meaning,times'].concat(order.map(function (w) {
        var d = info[w], e = d ? d.e : {};
        return [w, d ? d.head : '', e.uk || e.us || '', String(e.zh || '').split('\n')[0], seen[w].n].map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(',');
      }));
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv' })); a.download = 'word-list-' + EH.today() + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    box.scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------- 输入与控件 ---------- */
  function take(text, name) { var t = strip(text, name); prefs.text = t; save(); $('rd-text').value = t; render(t); }
  function readFile(f) {
    if (!f) return;
    if (f.size > 3e6) { EH.toast(T('That file is over 3 MB.', '文件超过 3 MB。')); return; }
    var r = new FileReader(); r.onload = function () { take(r.result, f.name); }; r.readAsText(f);
  }
  $('rd-file').onchange = function (e) { readFile(e.target.files[0]); };
  var drop = $('rd-drop');
  ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { readFile(e.dataTransfer.files[0]); });
  $('rd-go').onclick = function () { var v = $('rd-text').value.trim(); if (v) take(v, ''); };
  $('rd-clear').onclick = function () { delete prefs.text; save(); $('rd-text').value = ''; EH.toast(T('Cleared from this device.', '已从本机删除。')); };
  $('rd-edit').onclick = function () { $('rd-in').hidden = false; $('rd-out').hidden = true; $('rd-bar').hidden = true; $('rd-words').hidden = true; $('rd-text').focus(); };
  $('rd-sm').onclick = function () { prefs.size = Math.max(14, prefs.size - 1); save(); style(); };
  $('rd-lg').onclick = function () { prefs.size = Math.min(28, prefs.size + 1); save(); style(); };
  $('rd-lh').onchange = function (e) { prefs.lh = e.target.value; save(); style(); };
  $('rd-theme').onchange = function (e) { prefs.theme = e.target.value; save(); style(); };
  $('rd-lv').onchange = function (e) { prefs.lv = e.target.value; save(); mark(); };
  $('rd-list').onclick = wordList;
  if (prefs.text) { $('rd-text').value = prefs.text; render(prefs.text); } else style();
  window.EHReader = { take: take, blocks: blocks, strip: strip };
})();
