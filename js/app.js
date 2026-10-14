/* 고교 선택 가이드 — 화면 */
(function () {
  'use strict';
  var GG = window.GG, L = window.GGL;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var ic = function (n, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var isApp = function () { return window.matchMedia('(max-width: 899px)').matches; };
  var MAX_CAND = 3;
  var ORIGIN_URL = 'https://hwangbujang-hub.github.io/HWANGBUJANG/hschoolsystem.html';

  // ── 저장 (기기 안에만) ──
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('gg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('gg.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var S = {
    lens: store.get('lens', null),
    year: store.get('year', 2027),
    theme: store.get('theme', 'system'),
    cands: store.get('cands', []).filter(function (id) { return L.SCHOOL[id]; }),
    memo: store.get('memo', ''),
    recent: store.get('recent', []).filter(function (id) { return L.SCHOOL[id]; }),
    ov: {},
    student: '' // 학생 이름: 저장하지 않는다
  };
  if (!L.TRACK[S.lens]) S.lens = null;
  if (S.year !== 2026 && S.year !== 2027) S.year = 2027;
  function save() { store.set('lens', S.lens); store.set('year', S.year); store.set('cands', S.cands); store.set('memo', S.memo); store.set('recent', S.recent); }

  var track = function () { return S.lens ? L.TRACK[S.lens] : null; };
  var schoolView = function (id) { var s = L.SCHOOL[id]; return s ? L.view(s, S.year, S.ov) : null; };
  var fullName = function (s) { return s.name + '등학교'; };
  var regionOf = function (kor) { return GG.LEGACY[kor] || kor; };
  var inYear = function (s) { return S.year === 2027 || !s.new27; };

  // ── 라우터: #/  #/r/지역  #/s/id  #/search  #/c(?ids=&t=&y=)  #/help  #/about ──
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h, q = {};
    if (qi >= 0) h.slice(qi + 1).split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    var parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    return { name: parts[0] || 'home', arg: parts[1] || null, q: q };
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  // 공유 링크의 계열·연도를 받아들인다
  function applyQuery(q) {
    var changed = false;
    if (q.t && L.TRACK[q.t] && q.t !== S.lens) { S.lens = q.t; changed = true; }
    if (q.y && (+q.y === 2026 || +q.y === 2027) && +q.y !== S.year) { S.year = +q.y; S.ov = {}; changed = true; }
    if (changed) save();
  }
  function shareUrl(hash) { return location.href.split('#')[0] + hash; }

  // ── 상단바·탭바 상태 ──
  function syncChrome(route) {
    var t = track();
    $('#lensName').textContent = t ? t.name : '고르기';
    $('#lensBtn').classList.toggle('empty', !t);
    $('#lensBtn').setAttribute('aria-label', t ? '희망 계열: ' + t.name + ' (바꾸기)' : '희망 계열 고르기');
    var n = S.cands.length;
    $('#candN').textContent = n; $('#candN2').textContent = n;
    $('#candLink').classList.toggle('has', n > 0);
    $('#candLink').setAttribute('aria-label', '후보 학교 ' + n + '곳 비교');
    var tab = route.name === 'search' ? 'search' : route.name === 'c' ? 'cand' : 'explore';
    $$('.tabbar a').forEach(function (a) { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  // ── 토스트 ──
  var toastTimer;
  function toast(html, ms) {
    var t = $('#toast'); t.innerHTML = html; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2400);
  }

  // ── 시트 (dialog 하나를 메뉴·패널로 재사용) ──
  var dlg = $('#sheet');
  function openSheet(html, opts) {
    opts = opts || {};
    dlg.className = 'sheet-dlg' + (opts.panel ? ' panel' : '');
    dlg.innerHTML = html;
    dlg.style.top = dlg.style.left = dlg.style.right = '';
    if (!dlg.open) dlg.showModal();
    if (opts.anchor && !opts.panel && !isApp()) {
      var r = opts.anchor.getBoundingClientRect();
      dlg.style.top = Math.min(r.bottom + 8, window.innerHeight - dlg.offsetHeight - 12) + 'px';
      dlg.style.left = Math.max(12, Math.min(r.right - dlg.offsetWidth, window.innerWidth - dlg.offsetWidth - 12)) + 'px';
    }
    var f = dlg.querySelector('[autofocus], [aria-pressed="true"], button, a');
    if (f) f.focus();
  }
  function closeSheet() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeSheet(); });

  // ── 계열 고르기 ──
  var LENS_GROUPS = [['인문·사회', ['lang', 'human', 'soc', 'intl', 'admin', 'edu']], ['상경', ['econ', 'biz']], ['자연·공학·의약', ['eng', 'cs', 'nat', 'med', 'pharm', 'nurse']], ['예체능', ['art', 'pe']]];
  function openLens() {
    var h = '<div class="sh"><h2 class="sh-title" id="sheetTitle">어떤 공부를 하고 싶나요?</h2><p class="sh-sub">고르면 지도 색, 학교 순위, 과목 형광펜이 함께 바뀝니다.</p><div class="lens-list">';
    LENS_GROUPS.forEach(function (g) {
      h += '<div class="sh-group">' + g[0] + '</div>';
      g[1].forEach(function (id) {
        var t = L.TRACK[id]; if (!t) return;
        var on = S.lens === id;
        h += '<button type="button" class="it" data-act="lens" data-id="' + id + '" aria-pressed="' + on + '"><b><em>' + esc(t.name) + '</em></b><span>' + esc(t.core.slice(0, 3).join(' · ')) + '</span>' + (on ? ic('check') : '') + '</button>';
      });
    });
    h += '</div>' + (S.lens ? '<button type="button" class="lens-clear" data-act="lens" data-id="">계열 없이 보기</button>' : '') + '</div>';
    openSheet(h, { panel: true });
  }
  function setLens(id) {
    S.lens = id || null; save(); closeSheet();
    render({ sweep: true });
    toast(S.lens ? '<span><b>' + esc(L.TRACK[S.lens].name) + '</b> 계열 기준으로 바꿨어요</span>' : '계열 없이 봅니다');
  }

  // ── ⋯ 메뉴: 입학연도, 테마, 읽는 법, 설치, 만든 사람 ──
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  function applyTheme() {
    var v = S.theme;
    if (v === 'light' || v === 'dark') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('gg.theme', v); } catch (e) {}
  }
  function seg(act, cur, opts) {
    return '<div class="seg" role="group">' + opts.map(function (o) { return '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function openMore(anchor) {
    var h = '<div class="sh" style="min-width:320px"><h2 class="sh-title" id="sheetTitle">설정</h2>' +
      '<div class="sh-group">입학연도 기준</div>' + seg('year', S.year, [[2027, '2027 입학 (현 중3)'], [2026, '2026 입학 (현 고1)']]) +
      '<div class="sh-group">화면</div>' + seg('theme', S.theme, [['system', '시스템'], ['light', '밝게'], ['dark', '어둡게']]) +
      '<div class="menu-list" style="margin-top:14px">' +
      '<a class="menu-item" href="#/help" data-act="close">' + ic('file-text') + '편제표 읽는 법</a>' +
      (installEvt ? '<button type="button" class="menu-item" data-act="install">' + ic('download') + '앱으로 설치하기</button>' : '') +
      '<a class="menu-item" href="#/about" data-act="close">' + ic('info') + '만든 사람 · 자료 출처</a>' +
      '</div></div>';
    openSheet(h, { anchor: anchor });
  }
  function setYear(y) {
    if (S.year === y) return;
    S.year = y; S.ov = {}; save();
    var r = parseHash();
    if (r.name === 's') { var s = L.SCHOOL[r.arg]; if (s && !inYear(s)) { go('#/r/' + encodeURIComponent(s.region)); } }
    openMore($('#moreBtn'));
    render();
    toast((y === 2027 ? '2027학년도 입학생(현 중3)' : '2026학년도 입학생(현 고1)') + ' 편제로 봅니다');
  }

  // ── 홈: 지도 ──
  function isDark() { var t = document.documentElement.dataset.theme; return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function regionStats() {
    var all = GG.NORTH.concat(GG.SOUTH), t = track();
    var strength = t ? L.regionStrength(t, S.year) : {};
    return all.map(function (kor) {
      var list = L.schoolsFor(S.year).filter(function (s) { return s.region === kor; });
      var st = strength[kor] || { n: 0, strong: 0 };
      return { kor: kor, code: GG.KOR2CODE[kor], total: list.length, n: st.n, strong: st.strong, share: st.n ? st.strong / st.n : 0 };
    });
  }
  var level = function (share) { return share === 0 ? 0 : share < .1 ? 1 : share < .2 ? 2 : share < .35 ? 3 : 4; };
  function renderHome() {
    var t = track(), stats = regionStats();
    var side;
    if (t) {
      var rows = stats.slice().sort(function (a, b) { return b.share - a.share || b.strong - a.strong || a.kor.localeCompare(b.kor, 'ko'); });
      var max = rows[0].share || 1;
      side = '<h1 class="h1"><span class="hl">' + esc(t.name) + '</span> 계열에 강한 학교가 많은 지역</h1>' +
        '<p class="lead">색이 진할수록 그 지역 고등학교 가운데 <b>' + esc(t.name) + ' 적합도가 경기 상위 25%</b>인 학교 비율이 높습니다. 지역을 누르면 학교 순위가 열립니다.</p>' +
        '<div class="legend" aria-hidden="true">적음 <i style="background:var(--seq-0)"></i><i style="background:var(--seq-1)"></i><i style="background:var(--seq-2)"></i><i style="background:var(--seq-3)"></i><i style="background:var(--seq-4)"></i> 많음</div>' +
        '<div class="rlist">' + rows.map(function (r) {
          return '<a class="rrow" href="#/r/' + encodeURIComponent(r.kor) + '"><b>' + esc(r.kor) + '</b><span class="bar"><i style="width:' + Math.round(r.share / max * 100) + '%"></i></span><span class="v">' + r.strong + ' / ' + r.n + '</span></a>';
        }).join('') + '</div>';
    } else {
      var az = stats.slice().sort(function (a, b) { return a.kor.localeCompare(b.kor, 'ko'); });
      side = '<h1 class="h1">어느 지역 고등학교를 볼까요?</h1>' +
        '<p class="lead">지역을 누르면 학교 목록이 열립니다. <button type="button" class="textlink" data-act="openLens">희망 계열</button>을 고르면 그 계열에 강한 학교가 많은 지역이 진하게 칠해집니다.</p>' +
        '<div class="legend" aria-hidden="true"><i class="sw" style="background:var(--north);margin-left:0"></i>경기북부<i class="sw" style="background:var(--south)"></i>경기남부</div>' +
        '<div class="rlist">' + az.map(function (r) {
          return '<a class="rrow plain" href="#/r/' + encodeURIComponent(r.kor) + '"><b>' + esc(r.kor) + '</b><span class="v">' + r.total + '개교</span></a>';
        }).join('') + '</div>';
    }
    var rec = S.recent.filter(function (id) { return inYear(L.SCHOOL[id]); }).slice(0, 4);
    if (rec.length) side += '<p class="recent">최근 본 학교' + rec.map(function (id) { return '<a href="#/s/' + id + '">' + esc(L.SCHOOL[id].name) + '</a>'; }).join('') + '</p>';
    var cap = t ? esc(t.name) + ' 계열에 강한 학교 비율로 칠한 경기도 지도' : '경기도 25개 지역 지도';
    $('#main').innerHTML = '<div class="page"><div class="home"><figure class="map-wrap" id="map" aria-label="' + cap + '"></figure><div class="home-side">' + side + '</div></div></div>';
    drawMap(stats);
  }
  function drawMap(stats) {
    var box = $('#map'); box.innerHTML = GG.MAP_SVG;
    var svg = box.querySelector('svg'); svg.removeAttribute('id');
    svg.querySelectorAll('filter').forEach(function (f) { f.remove(); });
    svg.querySelectorAll('[filter]').forEach(function (el) { el.removeAttribute('filter'); });
    var t = track(), dark = isDark(), tip = $('#tip');
    stats.forEach(function (r) {
      var el = svg.querySelector('#' + r.code); if (!el) return;
      var lv = level(r.share);
      el.style.fill = t ? 'var(--seq-' + lv + ')' : (L.NORTH.has(r.kor) ? 'var(--north)' : 'var(--south)');
      el.setAttribute('data-kor', r.kor); el.setAttribute('tabindex', '0'); el.setAttribute('role', 'link');
      var desc = r.kor + ' ' + r.total + '개교' + (t ? ', ' + t.name + ' 상위 25% ' + r.strong + '곳' : '');
      el.setAttribute('aria-label', desc);
      var lb = svg.querySelector('#label-' + r.code);
      if (lb) lb.classList.toggle('on-dark', !!t && (dark ? lv >= 4 : lv >= 3));
      el.addEventListener('mousemove', function (e) {
        tip.innerHTML = '<b>' + esc(r.kor) + '</b> ' + r.total + '개교' + (t ? '<br>' + esc(t.name) + ' 상위 25% <b>' + r.strong + '</b>곳 / 분석 ' + r.n + '곳' : '');
        tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.hidden = false;
      });
      el.addEventListener('mouseleave', function () { tip.hidden = true; });
      el.addEventListener('click', function () { tip.hidden = true; go('#/r/' + encodeURIComponent(r.kor)); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('#/r/' + encodeURIComponent(r.kor)); } });
    });
  }

  // ── 지역 학교 목록 (= 원본 "지역 내 학교비교") ──
  function yearNote(raw, v) {
    if (S.year !== 2027) return '';
    if (raw.new27) return '2027 신설';
    if (v._st === 'fallback') return '2027 미공개';
    return '';
  }
  function regionRows(region) {
    var t = track(), list = L.schoolsFor(S.year).filter(function (s) { return s.region === region; });
    var heart = function (id) { return S.cands.indexOf(id) >= 0 ? '<svg class="heart" aria-label="후보"><use href="#i-heart"/></svg>' : ''; };
    var out = [];
    if (t) {
      L.regionRanking(region, t, S.year, S.ov).forEach(function (row) {
        var st = L.standing(row.r.score, t.id, S.year), raw = L.SCHOOL[row.s.id], yn = yearNote(raw, row.s);
        out.push({ id: row.s.id, name: row.s.name, html: '<span class="rk">' + row.rank + '</span><span class="nm"><span>' + esc(row.s.name) + heart(row.s.id) + '</span>' + (yn ? '<small>' + yn + '</small>' : '') + '</span><span class="bar' + (st.top <= 25 ? ' on' : '') + '"><i style="width:' + Math.round(st.frac * 100) + '%"></i></span><span class="v">상위 ' + st.top + '%</span>' });
      });
      var rest = list.map(function (s) { return L.view(s, S.year, S.ov); }).filter(function (v) { return !L.analyzed(v); });
      if (rest.length) out.push({ sep: '편제표가 아직 없는 학교 (PDF만)' });
      rest.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).forEach(function (v) {
        out.push({ id: v.id, name: v.name, cls: 'plain listonly', html: '<span class="nm"><span>' + esc(v.name) + heart(v.id) + '</span></span><span class="v">PDF</span>' });
      });
    } else {
      list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).forEach(function (raw) {
        var v = L.view(raw, S.year, S.ov), yn = yearNote(raw, v);
        out.push({ id: v.id, name: v.name, cls: 'plain' + (L.analyzed(v) ? '' : ' listonly'), html: '<span class="nm"><span>' + esc(v.name) + heart(v.id) + '</span><small>' + esc((v.type || '').split('(')[0]) + (yn ? ' · ' + yn : '') + '</small></span><span class="v">' + (L.analyzed(v) ? '' : 'PDF') + '</span>' });
      });
    }
    return out;
  }
  function schoolListHTML(region, currentId) {
    var t = track(), rows = regionRows(region), n = L.schoolsFor(S.year).filter(function (s) { return s.region === region; }).length;
    return '<aside class="slist" aria-label="' + esc(region) + ' 학교 목록">' +
      '<div class="slist-h"><a class="crumb" href="#/">' + ic('chevron-left', 'sm') + '지도</a>' + (currentId ? '<h2 class="h2">' + esc(regionOf(region)) + '</h2>' : '<h1 class="h2">' + esc(regionOf(region)) + '</h1>') +
      '<p class="sub">' + n + '개교 · ' + (t ? esc(t.name) + ' 적합도 순 (막대 = 경기 안 위치)' : '가나다순') + '</p>' +
      (rows.length > 8 ? '<input class="slist-filter" type="search" placeholder="이 지역 학교 찾기" aria-label="이 지역 학교 이름으로 찾기" data-act="filter">' : '') + '</div>' +
      '<div class="slist-body">' + rows.map(function (r) {
        if (r.sep) return '<div class="slist-sep">' + r.sep + '</div>';
        return '<a class="srow ' + (r.cls || '') + '" href="#/s/' + r.id + '" data-name="' + esc(r.name) + '"' + (r.id === currentId ? ' aria-current="page"' : '') + '>' + r.html + '</a>';
      }).join('') + '</div></aside>';
  }

  // ── 학교 ──
  function semLabel(g, s) { return s === 0 ? g + '학년' : g + '학년 ' + s + '학기'; }
  function subjHTML(x, t, ns, k) {
    var lv = t ? L.matchLevel(t, x) : 0, nw = ns.has(L.norm(x)) ? '<span class="new-mark">신설</span>' : '';
    if (lv === 2) return '<span class="x"><span class="hl" style="--d:' + k.i++ + '">' + esc(x) + '</span>' + nw + '</span>';
    if (lv === 1) return '<span class="x"><span class="rel">' + esc(x) + '</span>' + nw + '</span>';
    return '<span class="x' + (t ? ' dim' : '') + '">' + esc(x) + nw + '</span>';
  }
  function curriculumHTML(v, t) {
    var ns = L.addSet(v), k = { i: 0 }, grades = [];
    v.groups.forEach(function (g) { if (grades.indexOf(g.g) < 0) grades.push(g.g); });
    grades.sort();
    var groupHTML = function (g) {
      var fixed = /지정/.test(g.pick);
      return '<div class="grp"><span class="pk' + (fixed ? ' fixed' : '') + '">' + esc(g.pick) + '</span>' + g.subj.map(function (x) { return subjHTML(x, t, ns, k); }).join('') + '</div>';
    };
    var h = '<div class="cmap">';
    grades.forEach(function (gr) {
      var gs = v.groups.filter(function (g) { return g.g === gr; });
      var n = gs.reduce(function (a, g) { return a + g.subj.length; }, 0);
      h += '<div class="gr">' + gr + '학년<small>선택군 ' + gs.length + ' · ' + n + '과목</small></div>';
      var sems = []; gs.forEach(function (g) { if (sems.indexOf(g.s) < 0) sems.push(g.s); });
      if (sems.length === 1 && sems[0] === 0) { h += '<div class="cell full">' + gs.map(groupHTML).join('') + '</div>'; return; }
      [1, 2].forEach(function (s) {
        var list = gs.filter(function (g) { return g.s === s || (s === 1 && g.s === 0); });
        h += '<div class="cell"><div class="semh">' + semLabel(gr, s) + '</div>' + (list.length ? list.map(groupHTML).join('') : '<span class="dim">—</span>') + '</div>';
      });
    });
    return h + '</div>';
  }
  function coverageHTML(v, t) {
    var cov = L.coverage(v, t), prev = L.yearData(S.year).corePrev[t.id];
    var byG = {}; cov.offered.forEach(function (o) { (byG[o.grade] = byG[o.grade] || []).push(o.name); });
    var miss = cov.missing.filter(function (c) { return prev[c] >= .1; }), rare = cov.missing.length - miss.length;
    var title = t.core.length <= 20 ? esc(t.name) + ' 핵심 과목 ' + t.core.length + '개 중 <span class="count-big">' + cov.offered.length + '</span>개 교내 개설' : esc(t.name) + ' 핵심 과목 <span class="count-big">' + cov.offered.length + '</span>개 교내 개설';
    var h = '<section class="sec"><div class="sec-h"><h2 class="h3">' + title + '</h2></div><dl class="cov">';
    Object.keys(byG).sort().forEach(function (g) { h += '<dt>' + g + '학년부터</dt><dd>' + byG[g].map(function (n) { return '<span class="hl">' + esc(n) + '</span>'; }).join('<span class="sep" aria-hidden="true">·</span>') + '</dd>'; });
    if (!cov.offered.length) h += '<dt>개설</dt><dd class="miss">이 학교 선택 과목에는 핵심 과목이 없습니다.</dd>';
    if (miss.length) h += '<dt>없음</dt><dd class="miss">' + miss.slice(0, 10).map(esc).join('<span class="sep">·</span>') + (miss.length > 10 ? ' 외 ' + (miss.length - 10) + '개' : '') + '<small>온라인·공동교육과정으로 들을 수 있는지, 또는 학교지정 과목인지 교육과정 PDF로 확인하세요.</small></dd>';
    if (rare) h += '<dt></dt><dd class="miss"><small>그 밖의 핵심 과목 ' + rare + '개는 경기 대부분 학교가 선택 과목으로 두지 않는 과목입니다 (전문 교과·학교지정 등).</small></dd>';
    return h + '</dl></section>';
  }
  function profileHTML(v, title) {
    var rows = GG.TRACKS.map(function (t) { var sc = L.scoreSchool(v, L.TRACK[t.id]); return { t: t, sc: sc.score, st: L.standing(sc.score, t.id, S.year) }; }).sort(function (a, b) { return a.st.rank - b.st.rank; });
    return '<section class="sec"><div class="sec-h"><h2 class="h3">' + title + '</h2><span class="muted" style="font-size:var(--t-sm)">경기 ' + rows[0].st.n + '개교 안에서의 위치 · 누르면 그 계열로 봅니다</span></div><div class="prof">' +
      rows.map(function (r) {
        var on = S.lens === r.t.id;
        return '<button type="button" class="prow" data-act="lens-quick" data-id="' + r.t.id + '" aria-pressed="' + on + '" title="원본 점수 ' + r.sc + '점 (핵심 2점 · 연관 1점 · 가산점)"><span>' + esc(r.t.name) + '</span><span class="bar' + (on ? ' on' : '') + '"><i style="width:' + Math.round(r.st.frac * 100) + '%"></i></span><span class="v">상위 ' + r.st.top + '%</span></button>';
      }).join('') + '</div></section>';
  }
  // 2026 → 2027 달라진 점 (원본 changeCard 내용)
  function changesHTML(v) {
    var y = L.y27(v);
    if (v._st === 'fallback') return { s: '2027 편제표 미공개', body: '<p>이 학교는 교육청 사이트에 2027학년도 입학생 편제표가 아직 없어 2026 편제로 표시합니다.</p>' };
    if (v._y !== 2027) return null;
    if (v.new27) return { s: '2027 신설 학교', body: '<p>2026 편제가 없어 비교 대상이 없습니다. 위 내용은 2027학년도 입학생 편제표입니다.</p>' };
    if (y.nodiff) return { s: '대조 생략', body: '<p>비교할 2026 편제표 PDF가 없어 변경 대조는 생략했습니다.</p>' };
    if (v._st === 'same') return { s: '2026과 같음', body: '<p>2027학년도 입학생 편제표를 대조한 결과 선택 과목 구성이 2026과 같습니다.</p>' };
    var add = y.add || [], del = y.del || [], mv = y.mv || [], pc = y.pc || [], o15 = y.old15 || [];
    var gl = function (a) { return a.map(function (g) { return g + '학년'; }).join('·'); };
    var h = '<p>' + (v._st === 'check' ? '학과별·특수 편제라 선택 구조는 <b>2026 기준</b>으로 두고, 2027 편제표에서 달라진 과목만 대조했습니다.' : '2026학년도 입학생 편제표와 2027학년도 입학생 편제표를 대조한 결과입니다. 과목 지도에 <span class="new-mark" style="margin:0">신설</span> 과목을 표시했습니다.') + '</p><dl class="chg">';
    if (add.length) h += '<dt>신설</dt><dd>' + add.map(esc).join(' · ') + '</dd>';
    if (del.length) h += '<dt>폐지</dt><dd class="del">' + del.map(esc).join(' · ') + '</dd>';
    if (mv.length) h += '<dt>학년 이동</dt><dd>' + mv.map(function (m) { return esc(m[0]) + ' (' + gl(m[1]) + ' → ' + gl(m[2]) + ')'; }).join(' · ') + '</dd>';
    if (o15.length) h += '<dt>명칭 전환</dt><dd>' + o15.map(esc).join(' · ') + '<br><span class="muted">2015 개정 과목명으로 적힌 항목입니다. 대부분 2022 개정 과목명으로 바뀐 경우라 PDF로 확인하세요.</span></dd>';
    if (pc.length) h += '<dt>선택 수</dt><dd>' + pc.map(function (p) { return p[0] + '학년' + (p[1] ? ' ' + p[1] + '학기' : '') + ' · ' + p[4].map(esc).join(', ') + ' 등 <b>' + esc(p[2]) + ' → ' + esc(p[3]) + '</b>'; }).join('<br>') + '</dd>';
    h += '</dl>';
    if (!(add.length + del.length + mv.length + pc.length + o15.length)) h = '<p>선택 과목 구성의 변화가 확인되지 않았습니다.</p>';
    return { s: L.chgCount(y) + '건', body: h };
  }
  function detailsHTML(v, t) {
    var items = [];
    var tags = (v.tags || []).length ? '<p class="tags">' + v.tags.map(esc).join(' · ') + '</p>' : '';
    items.push(['학교 특색', esc((v.tags || [])[0] || ''), '<p>' + (v.note || '—') + '</p>' + tags + (v.caution ? '<p class="note-line" style="margin-top:10px">' + v.caution + '</p>' : '')]);
    var c = changesHTML(v); if (c) items.push(['2026 → 2027 달라진 점', c.s, c.body]);
    var rare = L.rareSubjects(v, S.year);
    items.push(['희소 개설 과목', rare.length ? esc(rare[0]) + (rare.length > 1 ? ' 외 ' + (rare.length - 1) : '') : '없음', rare.length ? '<p>편제표가 입력된 경기 학교 가운데 3곳 이하에서만 여는 과목입니다.</p><p>' + rare.map(function (x) { return '<b>' + esc(x) + '</b>'; }).join(' · ') + '</p>' : '<p>희소 과목 없이 표준 편제로 운영합니다.</p>']);
    var dz = GG.DESIG[v.id] || [];
    if (dz.length) items.push(['지정·운영 사업', esc(dz.slice(0, 2).join(', ')) + (dz.length > 2 ? ' 외 ' + (dz.length - 2) : ''), '<dl class="desig">' + dz.map(function (x) { var tip = (GG.DESIG_TIP[v.id] || {})[x]; return '<dt>' + esc(x) + '</dt><dd>' + (tip ? esc(tip) : '') + '</dd>'; }).join('') + '</dl>']);
    if (t) { var r = L.scoreSchool(v, t).reasons; if (r.length) items.push(['가산 요인 · ' + t.name, esc(r[0]), '<p>' + r.map(esc).join('<br>') + '</p><p class="muted">적합도 = 핵심 과목 2점 + 연관 과목 1점 + 특성화 가산점 (원본 기준)</p>']); }
    return '<section class="sec more">' + items.map(function (it) {
      return '<details><summary>' + it[0] + ' <span class="s">' + it[1] + '</span>' + ic('chevron-down') + '</summary><div class="body">' + it[2] + '</div></details>';
    }).join('') + '</section>';
  }
  function schoolHTML(v) {
    var t = track(), raw = L.SCHOOL[v.id], ys = L.yearStatus(v), inC = S.cands.indexOf(v.id) >= 0;
    var h = '<div class="shead"><a class="crumb" href="#/r/' + encodeURIComponent(v.region) + '">' + ic('chevron-left', 'sm') + esc(regionOf(v.region)) + ' 학교 목록</a>' +
      '<div class="shead-main"><h1 class="h1">' + esc(fullName(v)) + '</h1><p class="meta"><span>' + esc(regionOf(v.region)) + '</span><span>' + esc(v.type || '') + '</span><span class="ys ' + ys.cls + '">' + ys.txt + '</span></p></div>' +
      '<div class="acts"><button type="button" class="icon-btn ring" data-act="heart" data-id="' + v.id + '" aria-pressed="' + inC + '" aria-label="' + (inC ? '후보에서 빼기' : '후보에 담기') + '">' + ic('heart') + '</button>' +
      '<button type="button" class="icon-btn ring" data-act="smenu" data-id="' + v.id + '" aria-label="학교 메뉴: PDF, 공유, 편제 연도" aria-haspopup="dialog">' + ic('ellipsis') + '</button></div></div>';
    if (!L.analyzed(v)) {
      var pdf = L.pdfUrl(v);
      return h + '<section class="sec empty">' + ic('file-text') + '<h2 class="h3">편제표가 아직 입력되지 않았어요</h2><p>' + esc(fullName(v)) + '는 목록에만 등록된 학교라 계열 분석을 할 수 없습니다.</p>' +
        (pdf ? '<p style="margin-top:14px"><a class="textlink" href="' + pdf + '" target="_blank" rel="noopener">교육과정 PDF 보기</a></p>' : '') + '</section>' + detailsHTML(v, null);
    }
    if (v._st === 'check') h += '<p class="note-line" style="margin-bottom:14px">' + ic('info', 'sm') + '<span>학과별·특수 편제라 아래 선택 구조는 2026 기준입니다. 2027에 달라진 과목은 맨 아래 「달라진 점」에서 확인하세요.</span></p>';
    if (v._st === 'fallback') h += '<p class="note-line" style="margin-bottom:14px">' + ic('info', 'sm') + '<span>이 학교는 2027 편제표가 아직 공개되지 않아 2026 편제로 보여 줍니다.</span></p>';
    var map = '<section class="sec"><div class="sec-h"><h2 class="h3">3년 과목 지도</h2>' + (t ? '<span class="key"><span><span class="hl">핵심 과목</span></span><span><span class="rel">연관 과목</span></span><span>택N = 그 묶음에서 N과목 선택</span></span>' : '<span class="key"><span>택N = 그 묶음에서 N과목 선택</span></span>') + '</div>' + curriculumHTML(v, t) + '</section>';
    if (t) h += coverageHTML(v, t) + map + profileHTML(v, '이 학교의 계열 적합도');
    else h += profileHTML(v, '이 학교가 유리한 계열') + map;
    return h + detailsHTML(v, t);
  }
  function toggleHeart(id) {
    var i = S.cands.indexOf(id), s = L.SCHOOL[id];
    if (i >= 0) { S.cands.splice(i, 1); toast(esc(s.name) + '를 후보에서 뺐어요'); }
    else if (S.cands.length >= MAX_CAND) { toast('<span>후보는 ' + MAX_CAND + '곳까지 담을 수 있어요</span><a href="#/c">후보 보기</a>', 3600); return; }
    else { S.cands.push(id); toast('<span>' + esc(s.name) + '를 후보에 담았어요 (' + S.cands.length + '/' + MAX_CAND + ')</span><a href="#/c">비교</a>', 3200); }
    save(); render({ keepScroll: true });
  }
  function openSchoolMenu(id, anchor) {
    var raw = L.SCHOOL[id], v = schoolView(id), pdf = L.pdfUrl(v);
    var h = '<div class="sh" style="min-width:300px"><h2 class="sh-title" id="sheetTitle">' + esc(fullName(v)) + '</h2><div class="menu-list">' +
      (pdf ? '<a class="menu-item" href="' + pdf + '" target="_blank" rel="noopener" data-act="close">' + ic('file-text') + v._y + ' 교육과정 PDF 열기' + ic('arrow-up-right', 'sm r') + '</a>' : '') +
      '<button type="button" class="menu-item" data-act="share-school" data-id="' + id + '">' + ic('link') + '이 화면 링크 공유</button></div>' +
      '<div class="sh-group">이 학교만 편제 연도 바꿔 보기</div><div class="seg" role="group">' +
      '<button type="button" data-act="ov" data-id="' + id + '" data-v="2026" aria-pressed="' + (v._y === 2026) + '"' + (raw.new27 ? ' disabled title="2027 신설 학교"' : '') + '>2026 편제</button>' +
      '<button type="button" data-act="ov" data-id="' + id + '" data-v="2027" aria-pressed="' + (v._y === 2027) + '"' + (L.has27(raw) ? '' : ' disabled title="2027 편제표 미공개"') + '>2027 편제</button></div></div>';
    openSheet(h, { anchor: anchor });
  }
  function shareLink(url, title) {
    if (navigator.share && isApp()) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    var done = function () { toast('링크를 복사했어요'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, function () { prompt('이 링크를 복사하세요', url); });
    else prompt('이 링크를 복사하세요', url);
  }

  // ── 후보 비교 = 상담 요약 ──
  function cmpHash(ids) { return '#/c?ids=' + ids.join(',') + (S.lens ? '&t=' + S.lens : '') + '&y=' + S.year; }
  function renderCompare(route) {
    var shared = !!route.q.ids;
    var ids = (shared ? route.q.ids.split(',') : S.cands).filter(function (id) { return L.SCHOOL[id] && inYear(L.SCHOOL[id]); }).slice(0, MAX_CAND);
    if (!ids.length) {
      $('#main').innerHTML = '<div class="page"><div class="cmp"><section class="sec empty">' + ic('heart') + '<h1 class="h3">아직 담은 후보 학교가 없어요</h1><p>학교 화면 오른쪽 위 하트를 누르면 최대 ' + MAX_CAND + '곳까지 담을 수 있어요.<br>담은 학교는 여기서 나란히 비교하고, 인쇄하거나 링크로 보낼 수 있습니다.</p><p style="margin-top:16px"><a class="textlink" href="#/">지도에서 학교 찾기</a></p></section></div></div>';
      return;
    }
    var t = track(), vs = ids.map(schoolView);
    var title = (t ? esc(t.name) + ' 계열 · ' : '') + (vs.length === 1 ? '선택과목 상담' : '후보 ' + vs.length + '곳 비교');
    var today = new Date(), date = today.getFullYear() + '. ' + (today.getMonth() + 1) + '. ' + today.getDate() + '.';
    var h = '<div class="page"><div class="cmp">';
    if (shared) h += '<div class="shared-bar">' + ic('link', 'sm') + '<span>공유받은 후보 비교입니다.</span><button type="button" data-act="adopt" data-ids="' + ids.join(',') + '">내 후보로 저장</button></div>';
    h += '<article class="paper"><header class="paper-h"><div class="grow"><h1 class="h2">' + title + '</h1><p class="meta"><span>' + date + '</span><span>' + S.year + '학년도 입학생 편제</span>' +
      (shared ? '' : '<label>학생 <input class="field" id="student" value="' + esc(S.student) + '" placeholder="이름 (저장 안 됨)" autocomplete="off"></label>') + '</p></div>' +
      '<button type="button" class="icon-btn ring no-print" data-act="cmenu" data-ids="' + ids.join(',') + '" aria-label="공유, 인쇄" aria-haspopup="dialog">' + ic('share-2') + '</button></header>';
    if (t) {
      h += '<section class="blk"><div class="blk-h"><h2 class="h3">' + esc(t.name) + ' 적합도</h2><span class="muted" style="font-size:var(--t-sm)">경기 분석 학교 안에서의 위치와 지역 순위</span></div>';
      vs.forEach(function (v, i) {
        var sc = L.scoreSchool(v, t), st = L.standing(sc.score, t.id, S.year);
        var rr = L.regionRanking(v.region, t, S.year, S.ov), mine = rr.filter(function (r) { return r.s.id === v.id; })[0];
        h += '<div class="fit"><span class="nm"><i class="mk k' + i + '" aria-hidden="true"></i><a href="#/s/' + v.id + '">' + esc(v.name) + '</a>' + (shared ? '' : '<button type="button" class="x no-print" data-act="heart" data-id="' + v.id + '" aria-label="' + esc(v.name) + ' 후보에서 빼기">' + ic('x', 'sm') + '</button>') + '</span>' +
          (L.analyzed(v) ? '<span class="bar" style="--k:var(--c' + (i + 1) + ')"><i style="width:' + Math.round(st.frac * 100) + '%"></i></span><span class="v">경기 상위 ' + st.top + '% · ' + esc(regionOf(v.region)) + ' ' + (mine ? mine.rank + '위/' + rr.length : '') + '</span>' : '<span class="v" style="grid-column:span 2">편제표 없음 · PDF 확인</span>') + '</div>';
      });
      var rs = vs.map(function (v) { var r = L.analyzed(v) ? L.scoreSchool(v, t).reasons : []; return r.length ? esc(v.name) + ' ' + r.map(esc).join(', ') : ''; }).filter(Boolean);
      if (rs.length) h += '<p class="reasons">가산 요인: ' + rs.join(' · ') + '</p>';
      h += '</section>' + (vs.length > 1 ? matrixHTML(vs, t) : gradeListHTML(vs[0], t));
    } else {
      h += '<section class="blk"><p class="lead">계열을 고르면 적합도와 핵심 과목 개설 학년을 나란히 비교합니다. <button type="button" class="textlink" data-act="openLens">희망 계열 고르기</button></p></section>';
    }
    h += dotsHTML(vs);
    if (!shared) h += '<section class="blk"><div class="blk-h"><h2 class="h3">상담 메모</h2><span class="muted" style="font-size:var(--t-sm)">이 기기에만 저장됩니다</span></div><textarea class="memo" id="memo" placeholder="눌러서 입력">' + esc(S.memo) + '</textarea></section>';
    h += '<footer class="paper-foot">편제표는 학생 수요와 교원 사정에 따라 바뀔 수 있습니다. 최종 확인은 각 학교 교육과정 PDF로 해 주세요.<br>고교 선택 가이드 · 원작 「황부장 고입 상담 시스템」(저동고 황부장) · 자료: 경기고교학점제 지원센터 교육과정 운영 현황</footer></article></div></div>';
    $('#main').innerHTML = h;
  }
  function matrixHTML(vs, t) {
    var prev = L.yearData(S.year).corePrev[t.id];
    var covs = vs.map(function (v) { var m = {}; if (L.analyzed(v)) L.coverage(v, t).offered.forEach(function (o) { m[o.name] = o.grade; }); return m; });
    var rows = t.core.map(function (c) { var g = covs.map(function (m) { return m[c] || 0; }); return { c: c, g: g, any: g.some(Boolean), diff: g.some(function (x) { return x !== g[0]; }) }; })
      .filter(function (r) { return r.any || prev[r.c] >= .1; });
    rows.sort(function (a, b) { return (b.diff - a.diff); });
    var h = '<section class="blk"><div class="blk-h"><h2 class="h3">' + esc(t.name) + ' 핵심 과목, 몇 학년에 열리나</h2><span class="muted" style="font-size:var(--t-sm)"><span class="dot"></span>교내 개설(숫자 = 학년) · <span class="dot o"></span>없음 · 학교마다 다른 과목을 위로</span></div>' +
      '<table class="mx"><thead><tr><th scope="col">과목</th>' + vs.map(function (v, i) { return '<th scope="col"><i class="mk k' + i + '" aria-hidden="true" style="margin-right:6px"></i>' + esc(v.name) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var rowHTML = function (r) { return '<tr' + (r.diff ? ' class="diff"' : '') + '><th scope="row" style="font-weight:600;border:0;padding:8px 6px;text-align:left">' + esc(r.c) + '</th>' + r.g.map(function (g) { return '<td>' + (g ? '<span class="dot"></span>' + g + '학년' : '<span class="dot o" aria-hidden="true"></span><span class="sr">없음</span>') + '</td>'; }).join('') + '</tr>'; };
    // 앱에서는 학교마다 같은 과목을 접어 스크롤을 줄인다
    var same = isApp() ? rows.filter(function (r) { return !r.diff; }) : [];
    rows.filter(function (r) { return same.indexOf(r) < 0; }).forEach(function (r) { h += rowHTML(r); });
    if (same.length) h += '<tr><td colspan="' + (vs.length + 1) + '" style="padding:0;text-align:left"><details class="others"><summary>' + vs.length + '곳 모두 같은 과목 ' + same.length + '개 ' + ic('chevron-down', 'sm') + '</summary><table class="mx"><tbody>' + same.map(rowHTML).join('') + '</tbody></table></details></td></tr>';
    h += '</tbody><tfoot><tr><td>교내 개설</td>' + covs.map(function (m) { return '<td>' + Object.keys(m).length + ' / ' + t.core.length + '</td>'; }).join('') + '</tr></tfoot></table></section>';
    return h;
  }
  function gradeListHTML(v, t) {
    if (!L.analyzed(v)) return '';
    var by = {};
    v.groups.forEach(function (g) { g.subj.forEach(function (x) { var lv = L.matchLevel(t, x); if (!lv) return; var b = by[g.g] || (by[g.g] = { core: [], rel: [] }); var arr = lv === 2 ? b.core : b.rel; if (arr.indexOf(x) < 0) arr.push(x); }); });
    var gs = Object.keys(by).sort();
    return '<section class="blk"><div class="blk-h"><h2 class="h3">학년별로 고를 과목</h2><span class="key"><span><span class="hl">핵심</span></span><span><span class="rel">연관</span></span></span></div><dl class="gradelist">' +
      (gs.length ? gs.map(function (g) { return '<dt>' + g + '학년</dt><dd>' + by[g].core.map(function (x) { return '<span class="hl">' + esc(x) + '</span>'; }).concat(by[g].rel.map(function (x) { return '<span class="rel">' + esc(x) + '</span>'; })).join(' · ') + '</dd>'; }).join('') : '<dd class="muted">이 학교 선택 과목에 ' + esc(t.name) + ' 권장 과목이 없습니다.</dd>') + '</dl></section>';
  }
  function dotsHTML(vs) {
    var an = vs.filter(L.analyzed); if (!an.length) return '';
    var order = []; LENS_GROUPS.forEach(function (g) { order = order.concat(g[1]); });
    var h = '<section class="blk"><div class="blk-h"><h2 class="h3">다른 계열이라면?</h2><span class="muted" style="font-size:var(--t-sm)">16개 계열 적합도 · 오른쪽일수록 경기 안에서 강함</span></div>' +
      '<div class="legend-k">' + vs.map(function (v, i) { return L.analyzed(v) ? '<span><i class="mk k' + i + '" aria-hidden="true"></i>' + esc(v.name) + '</span>' : ''; }).join('') + '</div>';
    order.forEach(function (id) {
      var t = L.TRACK[id];
      h += '<div class="dp' + (S.lens === id ? ' on' : '') + '"><span>' + esc(t.name) + '</span><span class="ax">' + vs.map(function (v, i) {
        if (!L.analyzed(v)) return '';
        var st = L.standing(L.scoreSchool(v, t).score, id, S.year);
        return '<i class="mk k' + i + '" style="left:' + (st.frac * 100).toFixed(1) + '%;margin-top:' + ((i - (an.length - 1) / 2) * 5) + 'px" title="' + esc(v.name) + ' · ' + esc(t.name) + ' 상위 ' + st.top + '%"></i>';
      }).join('') + '</span></div>';
    });
    return h + '<div class="dp-scale"><span></span><span><span>약함</span><span>강함</span></span></div></section>';
  }
  function openCmpMenu(ids, anchor) {
    var h = '<div class="sh" style="min-width:300px"><h2 class="sh-title" id="sheetTitle">상담 요약 보내기</h2><div class="menu-list">' +
      '<button type="button" class="menu-item" data-act="cmp-link" data-ids="' + ids + '">' + ic('link') + '링크 ' + (navigator.share && isApp() ? '공유' : '복사') + '<span class="r">이름·메모는 빠져요</span></button>' +
      '<button type="button" class="menu-item" data-act="print">' + ic('printer') + '인쇄 · PDF로 저장</button>' +
      (location.hash.indexOf('ids=') < 0 ? '<button type="button" class="menu-item" data-act="clear">' + ic('trash-2') + '후보 비우기<span class="r">다음 상담 준비</span></button>' : '') + '</div></div>';
    openSheet(h, { anchor: anchor });
  }

  // ── 검색 ──
  function searchHTML(q) {
    q = q.trim(); if (!q) return '';
    var r = L.search(q, S.year), h = '';
    var item = function (s, sub) { return '<a class="qitem" role="option" href="#/s/' + s.id + '"><span class="l"><b>' + esc(fullName(s)) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="r">' + esc(regionOf(s.region)) + '</span></a>'; };
    if (r.byName.length) h += '<div class="qsec">학교 이름 ' + r.byName.length + '곳</div>' + r.byName.map(function (s) { return item(s, esc(s.type || '')); }).join('');
    if (r.bySubj.length) h += '<div class="qsec">과목을 여는 학교 ' + r.bySubj.length + '곳 · ' + S.year + ' 편제</div>' + r.bySubj.map(function (x) {
      return item(x.s, x.hits.map(function (k) { return '<mark>' + esc(k.subj) + '</mark> ' + k.g + '학년 ' + esc(k.loc); }).join(' · ') + (x.more ? ' 외 ' + x.more : ''));
    }).join('');
    if (r.byFeat.length) h += '<div class="qsec">특징·지정 사업 ' + r.byFeat.length + '곳</div>' + r.byFeat.map(function (x) { return item(x.s, esc(x.feat)); }).join('');
    return h || '<p class="qhint">찾는 결과가 없어요. 학교 이름, 과목 이름(예: 스페인어, 고급 화학), 특징(예: 과학중점, AI)으로 찾을 수 있습니다.</p>';
  }
  var q = $('#q'), qres = $('#qres');
  function showQ(open) { qres.hidden = !open; q.setAttribute('aria-expanded', String(open)); }
  q.addEventListener('input', function () { var h = searchHTML(q.value); qres.innerHTML = h; qres.scrollTop = 0; showQ(!!h); });
  q.addEventListener('focus', function () { if (q.value.trim()) showQ(true); });
  q.addEventListener('keydown', function (e) {
    var items = $$('.qitem', qres), cur = items.findIndex(function (a) { return a.getAttribute('aria-selected') === 'true'; });
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!items.length) return;
      var nx = e.key === 'ArrowDown' ? Math.min(items.length - 1, cur + 1) : Math.max(0, cur - 1);
      items.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === nx)); }); items[nx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { var a = items[cur >= 0 ? cur : 0]; if (a) { location.hash = a.getAttribute('href'); q.blur(); } }
    else if (e.key === 'Escape') { showQ(false); q.blur(); }
  });
  qres.addEventListener('click', function (e) { if (e.target.closest('.qitem')) { showQ(false); q.value = ''; } });
  document.addEventListener('click', function (e) { if (!e.target.closest('.gsearch')) showQ(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !isApp()) { e.preventDefault(); q.focus(); q.select(); }
  });
  function renderSearchPage() {
    $('#main').innerHTML = '<div class="page search-page"><h1 class="sr">검색</h1><label class="sbox">' + ic('search') + '<input id="q2" type="search" placeholder="학교 · 과목 · 특징" autocomplete="off" aria-label="학교, 과목, 특징 검색"></label><div class="results" id="q2res" role="listbox">' + searchIdleHTML() + '</div>' +
      '<p class="examples">이렇게 찾아보세요<br>' + ['스페인어', '고급 화학', '과학중점', '인공지능', '백석'].map(function (x) { return '<button type="button" data-act="ex" data-v="' + x + '">' + x + '</button>'; }).join('') + '</p></div>';
    var i2 = $('#q2'), r2 = $('#q2res');
    i2.addEventListener('input', function () { r2.innerHTML = i2.value.trim() ? searchHTML(i2.value) : searchIdleHTML(); });
    setTimeout(function () { i2.focus(); }, 60);
  }

  // ── 읽는 법 · 만든 사람 ──
  function terms(rows) { return '<dl class="terms">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; }
  function renderHelp() {
    $('#main').innerHTML = '<div class="page"><article class="read"><a class="back" href="#/">' + ic('chevron-left', 'sm') + '처음으로</a><h1 class="h1">편제표 읽는 법</h1><p>고교학점제 용어와 이 앱 화면 보는 법을 정리했습니다.</p>' +
      '<h2>과목은 두 종류입니다</h2>' + terms([['학교지정 과목', '학교가 정해 두어 그 학년 학생이 <b>모두 듣는</b> 과목입니다. 학생이 고르지 않습니다.'], ['학생 선택 과목', '한 묶음(선택군) 안에서 학생이 <b>직접 골라 듣는</b> 과목입니다. 진로에 맞는 과목을 여기서 고릅니다.'], ['택N', '그 묶음에서 <b>N과목을 고른다</b>는 뜻입니다. 숫자가 클수록 선택 폭이 넓습니다.']]) +
      '<h2>2022 개정 교육과정의 과목 구분</h2>' + terms([['공통 과목', '1학년에서 모두 배우는 기초 과목 (공통국어·공통수학·공통영어·통합사회·통합과학·한국사 등)'], ['일반 선택', '교과의 기본 내용을 배우는 과목 (문학·대수·물리학·화학·세계사 등)'], ['진로 선택', '한 분야를 깊이 배우는 심화 과목. 전공 적합성을 보여 주는 데 중요합니다 (미적분Ⅱ·기하·역학과 에너지 등)'], ['융합 선택', '여러 교과를 엮거나 실생활·탐구에 적용하는 과목 (기후변화와 환경생태·수학과제 탐구 등)'], ['전문 교과', '과학고·특성화고 등에서 주로 쓰는 전문 과목. 일반고는 공동교육과정으로 듣는 경우가 많습니다.']]) +
      '<h2>학교 밖에서 듣는 과목</h2>' + terms([['온라인 공동교육과정', '우리 학교에 없는 과목을 다른 학교 학생들과 <b>온라인 실시간</b>으로 듣습니다. 성적은 우리 학교 생활기록부에 기록됩니다.'], ['오프라인 공동교육과정', '가까운 거점 학교에 가서 방과 후·주말에 <b>대면</b>으로 듣습니다.'], ['소인수 선택', '신청 학생이 적어도 학교 안에서 소규모로 여는 과목입니다.'], ['학교 밖 교육', '대학·지역 기관 등 학교 밖 전문 기관의 과목을 이수하고 학점으로 인정받습니다.'], ['이음온학교', '경기도교육청의 온라인 학교입니다.']]) +
      '<h2>학점과 졸업</h2>' + terms([['1학점', '50분 수업 16회 분량입니다. 예: 물리학(3) = 3학점'], ['졸업 요건', '3년간 <b>192학점</b> (교과 174학점 + 창의적 체험활동 18학점)'], ['과목 이수 기준', '과목 출석률 3분의 2 이상이 기본이며, 공통 과목 등은 학업성취율 40% 이상도 필요합니다.']]) +
      '<h2>이 앱 화면 보는 법</h2>' + terms([['계열', '위쪽 「계열」에서 희망 진로를 고르면 지도 색, 학교 순위, 과목 형광펜이 모두 그 계열 기준으로 바뀝니다.'], ['<span class="hl">핵심 과목</span>', '그 계열에서 꼭 챙길 과목입니다.'], ['<span class="rel">연관 과목</span>', '도움이 되는 과목입니다.'], ['상위 N%', '편제표가 입력된 경기 고등학교 가운데 그 계열 과목을 얼마나 갖췄는지의 위치입니다. 핵심 과목 2점, 연관 과목 1점, 특성화 가산점으로 매긴 원본 점수를 순위로 바꾼 것입니다.'], ['입학연도', '⋯ 메뉴에서 2026/2027을 바꿉니다. 지금 중3은 2027 입학생입니다. 2027 편제가 아직 없는 학교는 2026 편제로 보여 줍니다.'], ['후보', '학교 화면의 하트로 최대 3곳을 담아 비교하고, 인쇄하거나 링크로 보낼 수 있습니다.']]) +
      '<p class="muted" style="margin-top:20px">※ 편제표는 학생 수요와 교원 사정에 따라 바뀔 수 있습니다. 최종 확인은 각 학교 교육과정 PDF로 해 주세요.</p></article></div>';
  }
  function renderAbout() {
    $('#main').innerHTML = '<div class="page"><article class="read"><a class="back" href="#/">' + ic('chevron-left', 'sm') + '처음으로</a><h1 class="h1">만든 사람 · 자료 출처</h1>' +
      '<h2>원작</h2><p>이 앱의 편제표 데이터와 계열 분석은 <b>저동고 황부장</b> 선생님의 「황부장 고입 상담 시스템」에서 왔습니다. 경기 고등학교의 교육과정 편제표를 직접 정리하고, 계열별 핵심·연관 과목 기준을 세운 작업입니다.</p><p><a class="textlink" href="' + ORIGIN_URL + '" target="_blank" rel="noopener">원본 「황부장 고입 상담 시스템」 보기</a></p>' +
      '<h2>자료</h2><p>경기고교학점제 지원센터 2026·2027 학교별 교육과정 운영 현황 (교육청 공개 PDF)</p>' +
      '<h2>이 앱</h2><p>고교 선택 가이드는 원작의 데이터와 분석을 그대로 쓰고, 상담하기 쉽게 화면을 다시 짠 앱입니다. 원작과 같은 학교·계열을 고르면 권장 과목과 순위가 원작과 같습니다. 학생 이름과 메모는 서버로 보내지 않고 이 기기에만 둡니다.</p>' +
      '<p class="muted" style="margin-top:20px">아이콘: Lucide (ISC) · 글꼴: Pretendard (OFL), Noto Serif KR (OFL)</p></article></div>';
  }

  // ════════ 앱 레이아웃 전용 (900px 미만): 스크롤을 줄인 화면 ════════
  // 지역: 분포 띠 + 강함/보통/약함 묶음 2열
  function regionAppHTML(region) {
    var t = track(), list = L.schoolsFor(S.year).filter(function (s) { return s.region === region; });
    var heart = function (id) { return S.cands.indexOf(id) >= 0 ? '<svg class="heart" aria-label="후보"><use href="#i-heart"/></svg>' : ''; };
    var head = '<div class="rhead"><a class="crumb" href="#/">' + ic('chevron-left', 'sm') + '지도</a><h1 class="h1">' + esc(regionOf(region)) + '</h1>';
    var cell = function (id, name, sub, rk) { return '<a class="tcell" href="#/s/' + id + '">' + (rk ? '<span class="rk">' + rk + '</span>' : '') + '<span class="tn"><b>' + esc(name) + heart(id) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></a>'; };
    if (!t) {
      var az = list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
      return '<div class="page rapp">' + head + '<p class="sub">' + list.length + '개교 · 가나다순 · <button type="button" class="textlink" data-act="openLens">계열을 고르면 순위로</button></p></div>' +
        '<div class="tgrid">' + az.map(function (s) { var v = L.view(s, S.year, S.ov); return cell(s.id, s.name, esc((v.type || '').split('(')[0]) + (L.analyzed(v) ? '' : ' · PDF')); }).join('') + '</div></div>';
    }
    var rows = L.regionRanking(region, t, S.year, S.ov).map(function (r) { r.st = L.standing(r.r.score, t.id, S.year); return r; });
    var rest = list.map(function (s) { return L.view(s, S.year, S.ov); }).filter(function (v) { return !L.analyzed(v); });
    var tiers = [['강함', '경기 상위 25% 안', function (r) { return r.st.top <= 25; }, 'good'], ['보통', '상위 26~60%', function (r) { return r.st.top > 25 && r.st.top <= 60; }, 'mid'], ['약함', '상위 60% 밖', function (r) { return r.st.top > 60; }, 'bad']];
    var strip = '<div class="dstrip" aria-hidden="true"><span class="zone strong" style="left:75%;width:25%"></span><span class="zone mid" style="left:40%;width:35%"></span>' +
      rows.map(function (r) { return '<i style="left:' + (r.st.frac * 100).toFixed(1) + '%"' + (r.st.top <= 25 ? ' class="on"' : '') + '></i>'; }).join('') + '</div><div class="dscale" aria-hidden="true"><span>약함</span><span>강함</span></div>';
    var nStrong = rows.filter(function (r) { return r.st.top <= 25; }).length;
    var say = nStrong ? esc(regionOf(region)) + '에서 <span class="hl">' + esc(t.name) + '</span>에<br>강한 학교는 <b>' + nStrong + '곳</b>이에요' : esc(regionOf(region)) + '에는 <span class="hl">' + esc(t.name) + '</span> 상위 25%<br>학교가 <b>없어요</b>';
    var h = '<div class="page rapp">' + head.replace('<h1 class="h1">' + esc(regionOf(region)) + '</h1>', '<h1 class="say big">' + say + '</h1>') + '<p class="sub">' + list.length + '개교 · 점 하나가 학교 하나 (오른쪽일수록 강함)</p>' + strip + '</div>';
    tiers.forEach(function (tr, i) {
      var rs = rows.filter(tr[2]); if (!rs.length) return;
      var cells = rs.map(function (r) { return cell(r.s.id, r.s.name, '상위 ' + r.st.top + '%' + (yearNote(L.SCHOOL[r.s.id], r.s) ? ' · ' + yearNote(L.SCHOOL[r.s.id], r.s) : ''), r.rank); }).join('');
      var title = '<span class="tag ' + tr[3] + '">' + tr[0] + '</span><span class="td">' + tr[1] + '</span><span class="tc">' + rs.length + '곳</span>';
      h += i < 2 ? '<section class="tier"><h2 class="th">' + title + '</h2><div class="tgrid">' + cells + '</div></section>'
        : '<details class="tier"><summary class="th">' + title + ic('chevron-down', 'sm') + '</summary><div class="tgrid">' + cells + '</div></details>';
    });
    if (rest.length) h += '<details class="tier"><summary class="th"><span class="tt">편제표 없음</span><span class="td">PDF만 있는 학교</span><span class="tc">' + rest.length + '곳</span>' + ic('chevron-down', 'sm') + '</summary><div class="tgrid">' + rest.map(function (v) { return cell(v.id, v.name, 'PDF'); }).join('') + '</div></details>';
    return h + '</div>';
  }
  // 학교: 요약 → 학기 넘기기 과목 지도 → 강한 계열 3개 → 접힌 정보
  var semOf = {}; // 학교별로 보고 있는 학기 (세션 안에서만)
  function semesters(v) {
    var out = [];
    v.groups.forEach(function (g) { var k = g.g + '-' + g.s; if (out.indexOf(k) < 0) out.push(k); });
    return out.sort();
  }
  function semShort(k) { var p = k.split('-'); return p[1] === '0' ? p[0] + '학년' : p[0] + '-' + p[1]; }
  function semPanelHTML(v, t, key) {
    var p = key.split('-').map(Number), ns = L.addSet(v), k = { i: 0 };
    var gs = v.groups.filter(function (g) { return g.g === p[0] && g.s === p[1]; });
    var hit = function (g) { return t && g.subj.some(function (x) { return L.matchLevel(t, x) > 0; }); };
    var main = t ? gs.filter(hit) : gs, other = t ? gs.filter(function (g) { return !hit(g); }) : [];
    var grp = function (g) { return '<div class="grp"><span class="pk' + (/지정/.test(g.pick) ? ' fixed' : '') + '">' + esc(g.pick) + '</span>' + g.subj.map(function (x) { return subjHTML(x, t, ns, k); }).join('') + '</div>'; };
    var h = '<p class="semtitle">' + (p[1] ? p[0] + '학년 ' + p[1] + '학기' : p[0] + '학년') + ' · 선택군 ' + gs.length + '개</p>' + main.map(grp).join('');
    if (t && !main.length) h += '<p class="dim" style="font-size:var(--t-sm);padding:8px 0">이 학기에는 ' + esc(t.name) + ' 권장 과목이 없어요.</p>';
    if (other.length) h += '<details class="others"><summary>권장 과목 없는 선택군 ' + other.length + '개 ' + ic('chevron-down', 'sm') + '</summary>' + other.map(grp).join('') + '</details>';
    return h;
  }
  function schoolAppHTML(v) {
    var t = track(), inC = S.cands.indexOf(v.id) >= 0;
    var bar = '<div class="sbar" id="sbar" aria-hidden="true"><b>' + esc(v.name) + '</b><span class="muted">' + esc(regionOf(v.region)) + '</span>' +
      '<button type="button" class="icon-btn" data-act="heart" data-id="' + v.id + '" aria-pressed="' + inC + '" tabindex="-1" aria-label="' + (inC ? '후보에서 빼기' : '후보에 담기') + '">' + ic('heart') + '</button></div>';
    var full = schoolHTML(v);
    if (!L.analyzed(v)) return bar + full;
    var head = full.slice(0, full.indexOf('</div></div>') + 12);
    var notes = (v._st === 'check' || v._st === 'fallback') ? full.slice(head.length, full.indexOf('</p>', head.length) + 4) : '';
    var h = bar + head + notes;
    if (t) {
      // 점수 카드 + 핵심 과목 한 문장 + 상태 타일 3개
      var sc = L.scoreSchool(v, t), st = L.standing(sc.score, t.id, S.year), rr = L.regionRanking(v.region, t, S.year, S.ov), me = rr.filter(function (r) { return r.s.id === v.id; })[0];
      var cov = L.coverage(v, t), prev = L.yearData(S.year).corePrev[t.id];
      var g2 = cov.offered.filter(function (o) { return o.grade <= 2; }), g3 = cov.offered.filter(function (o) { return o.grade >= 3; });
      var miss = cov.missing.filter(function (c) { return prev[c] >= .1; });
      h += '<section class="sec hero-wrap"><div class="hero"><p class="hero-k">' + esc(t.name) + ' 적합도</p><p class="hero-v">상위 <b>' + st.top + '</b>%</p>' +
        '<p class="hero-s">경기 ' + st.n + '개교 중 ' + st.rank + '위' + (me ? ' · ' + esc(regionOf(v.region)) + ' ' + me.rank + '위 / ' + rr.length : '') + '</p>' +
        '<span class="hero-bar"><i style="width:' + Math.round(st.frac * 100) + '%"></i></span></div>' + (sc.reasons.length ? '<p class="hero-note">가산 요인 · ' + sc.reasons.map(esc).join(', ') + '</p>' : '') + '</section>';
      h += '<section class="sec"><h2 class="say">' + esc(t.name) + ' 핵심 과목 ' + (t.core.length <= 20 ? t.core.length + '개 중 ' : '') + '<b>' + cov.offered.length + '개</b>를<br>교내에서 들을 수 있어요</h2>' +
        '<div class="tiles"><div class="tile"><span class="tag good">2학년</span><b>' + g2.length + '</b><small>과목</small></div><div class="tile"><span class="tag mid">3학년</span><b>' + g3.length + '</b><small>과목</small></div><div class="tile"><span class="tag bad">없음</span><b>' + miss.length + '</b><small>과목</small></div></div>' +
        '<dl class="cov">' + (g2.length ? '<dt>2학년</dt><dd>' + g2.map(function (o) { return '<span class="hl">' + esc(o.name) + '</span>'; }).join('<span class="sep" aria-hidden="true">·</span>') + '</dd>' : '') +
        (g3.length ? '<dt>3학년</dt><dd>' + g3.map(function (o) { return '<span class="hl">' + esc(o.name) + '</span>'; }).join('<span class="sep" aria-hidden="true">·</span>') + '</dd>' : '') +
        (miss.length ? '<dt>없음</dt><dd class="miss">' + miss.map(esc).join('<span class="sep" aria-hidden="true">·</span>') + '<small>공동교육과정·학교지정 여부는 교육과정 PDF로 확인하세요.</small></dd>' : '') + '</dl></section>';
    }
    var sems = semesters(v), cur = semOf[v.id] && sems.indexOf(semOf[v.id]) >= 0 ? semOf[v.id] : sems[0];
    h += '<section class="sec"><div class="sec-h"><h2 class="h3">3년 과목 지도</h2>' + (t ? '<span class="key"><span><span class="hl">핵심</span></span><span><span class="rel">연관</span></span></span>' : '') + '</div>' +
      '<div class="semseg" role="tablist" aria-label="학기">' + sems.map(function (k) { return '<button type="button" role="tab" data-act="sem" data-id="' + v.id + '" data-v="' + k + '" aria-selected="' + (k === cur) + '">' + semShort(k) + '</button>'; }).join('') + '</div>' +
      '<div class="sempanel" id="sempanel" data-id="' + v.id + '" role="tabpanel">' + semPanelHTML(v, t, cur) + '</div><p class="swipe-hint">옆으로 밀어 다른 학기 보기</p></section>';
    // 강한 계열: 세로 막대 5개 (누르면 그 계열로)
    var ranked = GG.TRACKS.map(function (tr) { var s2 = L.scoreSchool(v, L.TRACK[tr.id]); return { t: tr, st: L.standing(s2.score, tr.id, S.year) }; }).sort(function (a, b) { return a.st.rank - b.st.rank; });
    var top5 = ranked.slice(0, 5);
    if (t && !top5.some(function (r) { return r.t.id === t.id; })) top5[4] = ranked.filter(function (r) { return r.t.id === t.id; })[0];
    var prof = profileHTML(v, '');
    h += '<section class="sec"><h2 class="say"><b>' + esc(ranked[0].t.name) + '</b> 계열에<br>가장 강한 학교예요</h2><div class="vbars">' + top5.map(function (r) {
      var on = S.lens === r.t.id;
      return '<button type="button" class="vb' + (on ? ' on' : '') + '" data-act="lens-quick" data-id="' + r.t.id + '" aria-pressed="' + on + '" aria-label="' + esc(r.t.name) + ' 상위 ' + r.st.top + '%"><span class="vb-v">' + r.st.top + '%</span><span class="vb-c"><i style="height:' + Math.max(4, Math.round(r.st.frac * 100)) + '%"></i></span><span class="vb-n">' + esc(r.t.name) + '</span></button>';
    }).join('') + '</div><p class="vb-cap">숫자 = 경기 안에서 상위 % · 막대를 누르면 그 계열로 봅니다</p>' +
      '<details class="others"><summary>16개 계열 모두 보기 ' + ic('chevron-down', 'sm') + '</summary>' + prof.slice(prof.indexOf('<div class="prof">'), prof.lastIndexOf('</section>')) + '</details></section>';
    return h + detailsHTML(v, t);
  }
  // 검색 탭: 입력 전에도 쓸 거리를 보여 준다
  function searchIdleHTML() {
    var t = track(), h = '';
    var row = function (v, sub) { return '<a class="qitem" role="option" href="#/s/' + v.id + '"><span class="l"><b>' + esc(fullName(v)) + '</b><small>' + sub + '</small></span><span class="r">' + esc(regionOf(v.region)) + '</span></a>'; };
    var rec = S.recent.filter(function (id) { return inYear(L.SCHOOL[id]); }).slice(0, 5);
    if (rec.length) h += '<div class="qsec">최근 본 학교</div>' + rec.map(function (id) { var v = schoolView(id); return row(v, esc((v.type || '').split('(')[0])); }).join('');
    if (t) {
      var top = L.yearData(S.year).pool.map(function (v) { return { v: v, sc: L.scoreSchool(v, t).score }; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 5);
      h += '<div class="qsec">' + esc(t.name) + ' 계열 경기 상위 5곳</div>' + top.map(function (x) { return row(x.v, '상위 ' + L.standing(x.sc, t.id, S.year).top + '% · ' + esc((x.v.type || '').split('(')[0])); }).join('');
    } else {
      h += '<p class="qhint">위쪽 「계열」을 고르면 그 계열에 강한 경기 학교를 여기서 바로 보여 드려요.</p>';
    }
    return h;
  }
  // 학교 이름 고정 띠: 머리가 화면 밖으로 나가면 보인다
  function syncSchoolBar() {
    var bar = $('#sbar'), head = $('.shead'); if (!bar || !head) return;
    var off = head.getBoundingClientRect().bottom < 68;
    if (bar.classList.contains('show') === off) return;
    bar.classList.toggle('show', off); bar.setAttribute('aria-hidden', String(!off)); bar.querySelector('button').tabIndex = off ? 0 : -1;
  }
  window.addEventListener('scroll', syncSchoolBar, { passive: true }); // 위치 한 번 읽기라 가볍다
  function watchSchoolHead() { syncSchoolBar(); }
  // 학기 넘기기: 누르기 + 옆으로 밀기
  function showSem(id, key) {
    semOf[id] = key;
    var panel = $('#sempanel'); if (!panel) return;
    panel.innerHTML = semPanelHTML(schoolView(id), track(), key);
    $$('.semseg button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.v === key)); if (b.dataset.v === key) b.scrollIntoView({ block: 'nearest', inline: 'center' }); });
  }
  var touch = null;
  document.addEventListener('touchstart', function (e) { var p = e.target.closest('#sempanel'); touch = p ? { x: e.touches[0].clientX, y: e.touches[0].clientY, id: p.dataset.id } : null; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!touch) return;
    var dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      var sems = semesters(schoolView(touch.id)), i = sems.indexOf(semOf[touch.id] || sems[0]), j = i + (dx < 0 ? 1 : -1);
      if (j >= 0 && j < sems.length) showSem(touch.id, sems[j]);
    }
    touch = null;
  }, { passive: true });

  // ── 화면 그리기 ──
  var lastPath = null;
  function notFound(msg) { $('#main').innerHTML = '<div class="page"><section class="sec empty">' + ic('info') + '<h1 class="h3">' + msg + '</h1><p><a class="textlink" href="#/">처음 화면으로</a></p></section></div>'; }
  function firstSchool(region) { var rows = regionRows(region).filter(function (r) { return r.id; }); return rows.length ? rows[0].id : null; }
  function renderRegionOrSchool(region, id) {
    var app = isApp(), v = id ? schoolView(id) : null;
    if (id) { S.recent = [id].concat(S.recent.filter(function (x) { return x !== id; })).slice(0, 6); save(); }
    if (app) {
      $('#main').innerHTML = v ? '<div class="page sapp">' + schoolAppHTML(v) + '</div>' : regionAppHTML(region);
      document.title = (v ? fullName(v) + ' · ' : regionOf(region) + ' · ') + '고교 선택 가이드';
      watchSchoolHead(); return;
    }
    var right = v ? schoolHTML(v) : '';
    $('#main').innerHTML = '<div class="page"><div class="split' + (app && v ? ' on-school' : '') + '">' + schoolListHTML(region, id) + (v ? '<div class="sbody">' + right + '</div>' : '') + '</div></div>';
    var cur = $('.srow[aria-current="page"]'); if (cur && !app) cur.scrollIntoView({ block: 'nearest' });
    document.title = (v ? fullName(v) + ' · ' : regionOf(region) + ' · ') + '고교 선택 가이드';
  }
  function render(opts) {
    opts = opts || {};
    var route = parseHash(); applyQuery(route.q);
    // 공유 링크의 계열·연도는 한 번만 받아들이고 주소에서 지운다 (안 그러면 계열을 바꿔도 되돌아감)
    if (route.q.t || route.q.y) {
      var keep = route.q.ids ? '?ids=' + route.q.ids : '';
      history.replaceState(null, '', location.pathname + location.search + location.hash.split('?')[0] + keep);
      delete route.q.t; delete route.q.y;
    }
    syncChrome(route);
    var path = location.hash.split('?')[0];
    var scrollY = window.scrollY;
    document.title = '고교 선택 가이드';
    switch (route.name) {
      case 'home': renderHome(); break;
      case 'r':
        if (!route.arg || GG.NORTH.concat(GG.SOUTH).indexOf(route.arg) < 0) { notFound('지역을 찾을 수 없어요'); break; }
        renderRegionOrSchool(route.arg, isApp() ? null : firstSchool(route.arg)); break;
      case 's':
        var s = L.SCHOOL[route.arg];
        if (!s) { notFound('학교를 찾을 수 없어요'); break; }
        if (!inYear(s)) { notFound(esc(s.name) + '는 2027학년도 신설 학교라 2026 기준에는 없어요'); break; }
        renderRegionOrSchool(s.region, s.id); break;
      case 'search': if (isApp()) renderSearchPage(); else { renderHome(); setTimeout(function () { q.focus(); }, 30); } break;
      case 'c': renderCompare(route); document.title = '후보 비교 · 고교 선택 가이드'; break;
      case 'help': renderHelp(); break;
      case 'about': renderAbout(); break;
      default: notFound('없는 화면이에요');
    }
    if (opts.sweep) { var m = $('#main'); m.classList.remove('sweep'); void m.offsetWidth; m.classList.add('sweep'); }
    if (opts.keepScroll) window.scrollTo(0, scrollY);
    else if (path !== lastPath) { window.scrollTo(0, 0); if (lastPath !== null) $('#main').focus({ preventScroll: true }); }
    lastPath = path;
  }
  window.addEventListener('hashchange', function () { closeSheet(); render(); });
  var mq = window.matchMedia('(max-width: 899px)'); (mq.addEventListener ? mq.addEventListener('change', function () { render({ keepScroll: true }); }) : mq.addListener(function () { render(); }));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (parseHash().name === 'home') render({ keepScroll: true }); });

  // ── 동작 (이벤트 위임) ──
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
    switch (act) {
      case 'openLens': openLens(); break;
      case 'lens': setLens(id); break;
      case 'lens-quick': S.lens = id; save(); render({ sweep: true, keepScroll: true }); break;
      case 'close': closeSheet(); break;
      case 'year': setYear(+v); break;
      case 'theme': S.theme = v; applyTheme(); openMore($('#moreBtn')); if (parseHash().name === 'home') render({ keepScroll: true }); break;
      case 'install': closeSheet(); if (installEvt) { installEvt.prompt(); installEvt = null; } break;
      case 'heart': toggleHeart(id); break;
      case 'smenu': openSchoolMenu(id, el); break;
      case 'share-school': closeSheet(); shareLink(shareUrl('#/s/' + id + '?' + (S.lens ? 't=' + S.lens + '&' : '') + 'y=' + S.year), fullName(L.SCHOOL[id])); break;
      case 'ov': if (el.disabled) break; S.ov[id] = +v; closeSheet(); render({ keepScroll: true }); toast(v + ' 편제로 봅니다'); break;
      case 'cmenu': openCmpMenu(el.dataset.ids, el); break;
      case 'cmp-link': closeSheet(); shareLink(shareUrl(cmpHash(el.dataset.ids.split(','))), '후보 학교 비교'); break;
      case 'print': closeSheet(); setTimeout(function () { window.print(); }, 120); break;
      case 'clear':
        if (!confirm('후보 학교, 학생 이름, 메모를 모두 지울까요? 희망 계열은 그대로 둡니다.')) break;
        S.cands = []; S.memo = ''; S.student = ''; save(); closeSheet(); render(); toast('후보를 비웠어요'); break;
      case 'adopt': S.cands = el.dataset.ids.split(',').slice(0, MAX_CAND); save(); go('#/c'); toast('내 후보로 저장했어요'); break;
      case 'sem': showSem(id, v); break;
      case 'ex': var i2 = $('#q2'); if (i2) { i2.value = v; i2.dispatchEvent(new Event('input')); } break;
    }
  });
  $('#lensBtn').addEventListener('click', openLens);
  $('#moreBtn').addEventListener('click', function (e) { openMore(e.currentTarget); });
  var memoTimer;
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.act === 'filter') { var k = t.value.trim(); $$('.srow').forEach(function (a) { a.hidden = !!k && a.dataset.name.indexOf(k) < 0; }); }
    else if (t.id === 'student') S.student = t.value;
    else if (t.id === 'memo') { S.memo = t.value; clearTimeout(memoTimer); memoTimer = setTimeout(save, 400); }
  });

  // ── Android 앱(Capacitor): 뒤로가기 ──
  var Cap = window.Capacitor, backArmed = false;
  if (Cap && Cap.Plugins && Cap.Plugins.App) {
    Cap.Plugins.App.addListener('backButton', function () {
      if (dlg.open) { closeSheet(); return; }
      if (location.hash && location.hash !== '#/' && location.hash !== '#') { history.back(); return; }
      if (backArmed) { Cap.Plugins.App.exitApp(); return; }
      backArmed = true; toast('한 번 더 누르면 종료합니다', 2000); setTimeout(function () { backArmed = false; }, 2000);
    });
  }
  // 앱 안에서는 교육청 PDF·원본 링크를 시스템 브라우저로 연다
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[target="_blank"]');
    if (a && Cap && Cap.isNativePlatform && Cap.isNativePlatform()) { e.preventDefault(); window.open(a.href, '_system'); }
  });

  // ── 오프라인 (서비스워커) ──
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !(Cap && Cap.isNativePlatform && Cap.isNativePlatform()) && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('<span>새 버전이 있어요</span><button type="button" onclick="location.reload()">새로고침</button>', 10000);
        });
      });
    }).catch(function () {});
  }

  applyTheme();
  render();
})();
