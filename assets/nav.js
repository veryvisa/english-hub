/* 全站导航组件（design/learning-ux-2026-11-24.md §六）。纯本地、无请求。四件：
   1 先选再看：[data-pnav] 里一组 .pn-panel，一次只显示一个；标签页（宽屏）与下拉（手机）二选一由 CSS 定；#锚点落在某个面板里时自动切到那个面板。
   2 页内筛选：.pn-q 输入框过滤当前面板里的 [data-fi]；[data-fi-group] 里一条都不剩时整组隐藏；计数写进 .pn-count。
   3 吸附目录：<main data-toc> 时把当前可见的 h2[id] 排成一条吸附目录（手机折成「目录」按钮），滚动时高亮当前节。
   4 回到顶部。
   另：中文「点开看」模式（body[data-zh=fold]）下点一段中文即显示。 */
(function () {
  'use strict';
  var T = (window.EH && EH.T) || function (en, zh) { return '<span class="enx">' + en + '</span><span class="zh" lang="zh-Hans">' + zh + '</span>'; };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  var tocRefresh = function () {};

  /* ---------- 1＋2 面板与筛选 ---------- */
  $$('[data-pnav]').forEach(function (box) {
    var panels = $$('.pn-panel', box), tabs = $$('.pn-tablist [data-tab]', box), sel = $('.pn-select', box), q = $('.pn-q', box), count = $('.pn-count', box);
    var key = 'eh-pnav:' + location.pathname.split('/').pop();
    function filter() {
      var p = panels.filter(function (x) { return !x.hidden; })[0]; if (!p || !q) return;
      var v = q.value.trim().toLowerCase(), items = $$('[data-fi]', p), n = 0;
      items.forEach(function (it) { var ok = !v || it.textContent.toLowerCase().indexOf(v) >= 0; it.hidden = !ok; if (ok) n++; });
      $$('[data-fi-group]', p).forEach(function (g) {
        var head = $('.ncard-h', g), hit = v && head && head.textContent.toLowerCase().indexOf(v) >= 0, kids = $$('[data-fi]', g);
        if (hit) { kids.forEach(function (k) { if (k.hidden) { k.hidden = false; n++; } }); }
        g.hidden = !!v && !hit && kids.every(function (k) { return k.hidden; });
      });
      if (count) count.textContent = v ? n + ' / ' + items.length : items.length ? String(items.length) : '';
    }
    function show(id, quiet) {
      if (!panels.some(function (p) { return p.id === id; })) return false;
      panels.forEach(function (p) { p.hidden = p.id !== id; });
      tabs.forEach(function (t) { var on = t.dataset.tab === id; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); if (on && t.scrollIntoView && !quiet) t.scrollIntoView({ block: 'nearest', inline: 'center' }); });
      if (sel) sel.value = id;
      try { sessionStorage.setItem(key, id); } catch (e) {}
      filter(); tocRefresh();
      return true;
    }
    function fromHash() {
      var h = decodeURIComponent(location.hash.slice(1)); if (!h) return false;
      var el = document.getElementById(h); if (!el || !box.contains(el)) return false;
      var p = el.closest('.pn-panel'); if (!p) return false;
      show(p.id, true);
      if (el !== p) setTimeout(function () { el.scrollIntoView({ block: 'start' }); el.classList.add('pn-hit'); }, 30);
      return true;
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); if (history.replaceState) history.replaceState(null, '', '#' + t.dataset.tab); }); });
    if (sel) sel.addEventListener('change', function () { show(sel.value); if (history.replaceState) history.replaceState(null, '', '#' + sel.value); });
    if (q) q.addEventListener('input', filter);
    var last = null; try { last = sessionStorage.getItem(key); } catch (e) {}
    if (!fromHash()) show(last && panels.some(function (p) { return p.id === last; }) ? last : panels[0].id, true);
    window.addEventListener('hashchange', fromHash);
  });

  /* 没有面板的页：独立筛选框 .pn-q[data-scope="#选择器"] */
  $$('.pn-q[data-scope]').forEach(function (q) {
    var scope = $(q.dataset.scope), count = q.parentNode.querySelector('.pn-count'); if (!scope) return;
    q.addEventListener('input', function () {
      var v = q.value.trim().toLowerCase(), items = $$('[data-fi]', scope), n = 0;
      items.forEach(function (it) { var ok = !v || it.textContent.toLowerCase().indexOf(v) >= 0; it.hidden = !ok; if (ok) n++; });
      if (count) count.textContent = v ? n + ' / ' + items.length : '';
    });
  });

  /* ---------- 3 吸附目录 ---------- */
  var main = $('main[data-toc]');
  if (main) {
    var bar = document.createElement('nav'); bar.className = 'toc-bar'; bar.setAttribute('aria-label', 'On this page');
    var anchor = $('.toc-here', main) || $('h1', main);
    if (anchor) anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    var heads = [], io = null;
    tocRefresh = function () {
      heads = $$('h2[id]', main).filter(function (h) { return h.offsetParent !== null; });
      if (heads.length < 3) { bar.hidden = true; return; }
      bar.hidden = false;
      bar.innerHTML = '<button class="toc-btn" aria-expanded="false">☰ ' + T('On this page', '本页目录') + ' <span class="toc-cur"></span></button><div class="toc-list">' +
        heads.map(function (h) { var c = h.cloneNode(true); $$('.muted,.badge,button', c).forEach(function (x) { x.remove(); }); return '<a href="#' + h.id + '">' + c.innerHTML + '</a>'; }).join('') + '</div>';
      var btn = $('.toc-btn', bar);
      btn.onclick = function () { var o = bar.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); };
      $$('a', bar).forEach(function (a) { a.onclick = function () { bar.classList.remove('open'); }; });
      if (io) io.disconnect();
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            $$('a', bar).forEach(function (a) { var on = a.getAttribute('href') === '#' + e.target.id; a.classList.toggle('on', on); if (on) { $('.toc-cur', bar).innerHTML = '· ' + a.innerHTML; if (a.offsetParent && a.parentNode.scrollTo) a.parentNode.scrollTo({ left: a.offsetLeft - 60, behavior: 'smooth' }); } });
          });
        }, { rootMargin: '-15% 0px -70% 0px' });
        heads.forEach(function (h) { io.observe(h); });
      }
    };
    tocRefresh();
  }

  /* ---------- 4 回到顶部 ---------- */
  var top = document.createElement('button');
  top.id = 'to-top'; top.hidden = true; top.setAttribute('aria-label', 'Back to top'); top.textContent = '↑';
  document.body.appendChild(top);
  top.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); };
  var tick = false;
  window.addEventListener('scroll', function () {
    if (tick) return; tick = true;
    requestAnimationFrame(function () { top.hidden = window.scrollY < 700; tick = false; });
  }, { passive: true });

  /* ---------- 任何页面点 [data-card] 开词卡：没载词卡脚本的页按需加载（学习数据、词典索引、词典、词卡） ---------- */
  var loading = false;
  document.addEventListener('click', function (ev) {
    var c = ev.target.closest('[data-card]'); if (!c || window.EHCard || loading) return;
    loading = true;
    var root = document.body.dataset.root || '', list = ['data/learn.js', 'data/dict/index.js', 'assets/dict.js', 'assets/wordcard.js'].filter(function (f) {
      return !(f === 'data/learn.js' && window.EH_LEARN) && !(f === 'assets/dict.js' && window.EHDict) && !(f === 'data/dict/index.js' && window.EH_DICT_INDEX);
    });
    (function next() {
      if (!list.length) { loading = false; if (window.EHCard) EHCard.pop(c.dataset.card); return; }
      var s = document.createElement('script'); s.src = root + list.shift(); s.onload = next; s.onerror = function () { loading = false; };
      document.head.appendChild(s);
    })();
  });

  /* ---------- 中文「点开看」 ---------- */
  var ZK = 'english-hub-zh';
  function setFold(on) { if (on) document.body.dataset.zh = 'fold'; else delete document.body.dataset.zh; try { localStorage.setItem(ZK, on ? 'fold' : 'show'); } catch (e) {} paintFold(); }
  function paintFold() { $$('[data-zh-fold]').forEach(function (b) { var on = document.body.dataset.zh === 'fold'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-zh-fold]');
    if (b) { setFold(document.body.dataset.zh !== 'fold'); return; }
    if (document.body.dataset.zh === 'fold' && document.body.dataset.lang === 'both') {
      var z = ev.target.closest('.zh');
      if (z && !z.closest('button,a,label,summary,th,.chip,.nav,.pn-bar,.toc-bar')) z.classList.toggle('zh-open');
    }
  });
  paintFold();
})();
