/* 분석 로직 — 원본 「황부장 고입 상담 시스템」의 계산을 그대로 옮긴 것.
   화면 코드와 분리해 tools/check-parity.mjs 가 원본과 결과를 대조한다. */
(function (root) {
  'use strict';
  var GG = root.GG;
  var NC = new Map();
  var norm = function (s) { var v = NC.get(s); if (v === undefined) { v = s.replace(/[\s·]/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II'); NC.set(s, v); } return v; };

  GG.TRACKS.forEach(function (t) { t.coreN = new Set(t.core.map(norm)); t.plusN = new Set(t.plus.map(norm)); });
  var TRACK = {}; GG.TRACKS.forEach(function (t) { TRACK[t.id] = t; });
  var SCHOOL = {}; GG.SCHOOLS.forEach(function (s) { SCHOOL[s.id] = s; });
  var NORTH = new Set(GG.NORTH);

  // ── 원본 계산 ──
  function matchLevel(track, subj) {
    var n = norm(subj);
    if (track.coreN.has(n)) return 2;
    if (track.plusN.has(n)) return 1;
    var b = n.replace(/[0-9IV]+$/, '');
    if (b && b !== n) {
      if (track.coreN.has(b)) return 2;
      if (track.plusN.has(b)) return 1;
    }
    return 0;
  }
  function scoreSchool(school, track) {
    var seen = new Set(), score = 0, coreHits = [];
    school.groups.forEach(function (gr) {
      gr.subj.forEach(function (s) {
        var n = norm(s); if (seen.has(n)) return; seen.add(n);
        var lv = matchLevel(track, s);
        if (lv === 2) { score += 2; coreHits.push(s); } else if (lv === 1) { score += 1; }
      });
    });
    var reasons = [];
    var b = (GG.BONUS[school.id] || {})[track.id];
    if (b) { score += b[0]; reasons.push(b[1]); }
    var ab = GG.ALLBONUS[school.id];
    if (ab) { score += ab[0]; reasons.push(ab[1]); }
    return { score: score, coreHits: coreHits, reasons: reasons };
  }
  function y27(s) { return (s && GG.Y27[s.id]) || null; }
  function has27(s) { var y = y27(s); return !!(y && y.st !== 'none'); }
  function schoolsFor(year) { return GG.SCHOOLS.filter(function (s) { return year === 2027 || !s.new27; }); }
  // ov: 학교별 연도 덮어쓰기 {id: 2026|2027}
  function view(s, year, ov) {
    if (!s) return s;
    var want = (ov && ov[s.id]) || year;
    var e = s.new27 ? 2027 : ((want === 2027 && has27(s)) ? 2027 : 2026);
    if (e === 2027) {
      var y = y27(s);
      var nt = y.note27 ? { note: y.note27, tags: y.tags27 || s.tags } : {};
      if (y.st === 'new') return Object.assign({}, s, nt, { groups: y.g, listOnly: false, _y: 2027, _st: 'new' });
      return Object.assign({}, s, nt, { _y: 2027, _st: y.st });
    }
    return Object.assign({}, s, { _y: 2026, _st: want === 2027 ? 'fallback' : 'base' });
  }
  function analyzed(v) { return !!(v && v.groups && v.groups.length && !v.listOnly); }
  function chgCount(y) { if (!y) return 0; return (y.add || []).length + (y.del || []).length + (y.mv || []).length + (y.pc || []).length; }
  function yearStatus(s) {
    var y = y27(s);
    if (s._y === 2027) {
      if (s.new27) return { cls: 'new', txt: '2027 신설교' };
      if (s._st === 'new') { var n = chgCount(y); return { cls: 'new', txt: n ? '2027 편제 반영 · 변경 ' + n + '건' : '2027 편제 반영' }; }
      if (s._st === 'same') return { cls: 'same', txt: '2027 편제 · 2026과 동일' };
      if (s._st === 'check') return { cls: 'check', txt: '2027 편제 공개 · 변경 과목 참고' };
    }
    if (s._st === 'fallback') return { cls: 'none', txt: '2027 미공개 · 2026 기준' };
    return { cls: 'base', txt: '2026학년도 입학생 기준' };
  }
  function pdfUrl(s) {
    var base = 'https://more.goe.go.kr/hagjeomje/module/hag/schul/selectPdfViewer.do?orignlNm=';
    var y = y27(s);
    if (s._y === 2027 && y && y.b) return base + encodeURIComponent(y.bf || '') + '&atchFileId=' + y.b;
    if (!s.pdfId) return null;
    return base + encodeURIComponent(s.pdfFile || ('2026 학교별 교육과정 운영 현황(' + s.name + ').pdf')) + '&atchFileId=' + s.pdfId;
  }
  function addSet(s) { var y = y27(s); return new Set(s._y === 2027 && s._st === 'new' && y ? (y.add || []).map(norm) : []); }

  // ── 연도별 캐시: 희소 과목 카운트, 적합도 분포 ──
  var cache = {};
  function yearData(year) {
    if (cache[year]) return cache[year];
    var list = schoolsFor(year);
    var views = list.map(function (s) { return view(s, year, null); });
    var subjCount = {};
    views.forEach(function (sc) {
      var set = new Set(); (sc.groups || []).forEach(function (g) { g.subj.forEach(function (x) { set.add(norm(x)); }); });
      set.forEach(function (n) { subjCount[n] = (subjCount[n] || 0) + 1; });
    });
    var pool = views.filter(analyzed);
    var scores = {}; // trackId -> 내림차순 점수 배열
    GG.TRACKS.forEach(function (t) { scores[t.id] = pool.map(function (v) { return scoreSchool(v, t).score; }).sort(function (a, b) { return b - a; }); });
    // 핵심 과목별 개설 학교 비율 (학교지정 추정용)
    var corePrev = {};
    GG.TRACKS.forEach(function (t) {
      var c = {}; t.core.forEach(function (x) { c[x] = 0; });
      pool.forEach(function (v) { coverage(v, t).offered.forEach(function (o) { c[o.name]++; }); });
      t.core.forEach(function (x) { c[x] /= pool.length; });
      corePrev[t.id] = c;
    });
    cache[year] = { list: list, views: views, pool: pool, subjCount: subjCount, scores: scores, corePrev: corePrev };
    return cache[year];
  }
  function rareSubjects(school, year) {
    var sc = yearData(year).subjCount, seen = new Set(), out = [];
    school.groups.forEach(function (g) {
      g.subj.forEach(function (s) {
        var n = norm(s); if (seen.has(n)) return; seen.add(n);
        if (sc[n] <= 3) out.push(s);
      });
    });
    return out;
  }
  // 경기 분석 학교 중 위치: rank = 1 + (점수가 더 높은 학교 수), top = 상위 %
  function standing(score, trackId, year) {
    var arr = yearData(year).scores[trackId], n = arr.length, higher = 0;
    while (higher < n && arr[higher] > score) higher++;
    var rank = higher + 1;
    return { rank: rank, n: n, top: Math.max(1, Math.ceil(rank / n * 100)), frac: 1 - (rank - 1) / n };
  }
  // 과목 이름(정규화) → 가장 이른 학년. 학년 끝 숫자(I, II)를 뗀 이름도 함께 넣는다 (matchLevel과 같은 규칙)
  function subjIndex(v) {
    if (v._idx) return v._idx;
    var full = new Map(), base = new Map();
    v.groups.forEach(function (g) {
      g.subj.forEach(function (x) {
        var n = norm(x), b = n.replace(/[0-9IV]+$/, '');
        if (!full.has(n) || g.g < full.get(n)) full.set(n, g.g);
        if (b && b !== n && (!base.has(b) || g.g < base.get(b))) base.set(b, g.g);
      });
    });
    Object.defineProperty(v, '_idx', { value: { full: full, base: base }, enumerable: false });
    return v._idx;
  }
  // 계열 핵심 과목 중 이 학교 선택 과목에 있는 것 (가장 이른 학년)
  function coverage(v, track) {
    var idx = subjIndex(v), offered = [], missing = [];
    track.core.forEach(function (c) {
      var cn = norm(c), a = idx.full.get(cn) || 0, b = idx.base.get(cn) || 0;
      var grade = a && b ? Math.min(a, b) : (a || b);
      if (grade) offered.push({ name: c, grade: grade }); else missing.push(c);
    });
    return { offered: offered, missing: missing };
  }
  // 원본 "지역 내 학교비교" 순위 (동점 같은 순위)
  function regionRanking(region, track, year, ov) {
    var pool = schoolsFor(year).filter(function (s) { return s.region === region; }).map(function (s) { return view(s, year, ov); }).filter(analyzed);
    var rows = pool.map(function (s) { return { s: s, r: scoreSchool(s, track) }; }).sort(function (a, b) { return b.r.score - a.r.score; });
    var pv = null, pr = 0;
    rows.forEach(function (row, i) { var rank = (pv !== null && row.r.score === pv) ? pr : i + 1; pv = row.r.score; pr = rank; row.rank = rank; });
    return rows;
  }
  // 지역별 "상위 25%" 학교 비율
  function regionStrength(track, year) {
    var out = {};
    yearData(year).pool.forEach(function (v) {
      var o = out[v.region] || (out[v.region] = { n: 0, strong: 0 });
      o.n++;
      if (standing(scoreSchool(v, track).score, track.id, year).top <= 25) o.strong++;
    });
    return out;
  }
  // 원본 전역 검색 (결과 묶음과 정렬이 같다)
  function search(q, year) {
    var nq = norm(q), pool = schoolsFor(year);
    var byName = pool.filter(function (s) { return s.name.includes(q); }).slice(0, 12);
    var bySubj = [], byFeat = [];
    if (nq.length >= 2) {
      pool.forEach(function (raw) {
        var s = view(raw, year, null), m = {};
        (s.groups || []).forEach(function (g) { g.subj.forEach(function (x) { if (norm(x).includes(nq)) { (m[x] = m[x] || []).push(g); } }); });
        var ks = Object.keys(m);
        if (ks.length) {
          bySubj.push({ s: s, more: Math.max(0, ks.length - 3), hits: ks.slice(0, 3).map(function (k) {
            var g = m[k][0];
            var loc = /온라인|오프라인|학교 밖|이음온|소인수/.test(g.pick) ? g.pick : (g.pick === '학교지정' ? '학교지정' : '교내 ' + g.pick);
            return { subj: k, g: g.g, loc: loc };
          }) });
        } else {
          var feat = [s.type || ''].concat(s.tags || [], GG.DESIG[s.id] || []).find(function (x) { return norm(x).includes(nq); }) ||
            (norm((s.note || '').replace(/<[^>]+>/g, '')).includes(nq) ? '학교 특색 설명' : '');
          if (feat) byFeat.push({ s: s, feat: feat });
        }
      });
    }
    var reg = function (a, b) { return a.s.region.localeCompare(b.s.region, 'ko') || a.s.name.localeCompare(b.s.name, 'ko'); };
    bySubj.sort(reg); byFeat.sort(reg);
    return { byName: byName, bySubj: bySubj, byFeat: byFeat };
  }

  root.GGL = {
    norm: norm, TRACK: TRACK, SCHOOL: SCHOOL, NORTH: NORTH,
    matchLevel: matchLevel, scoreSchool: scoreSchool, y27: y27, has27: has27, schoolsFor: schoolsFor, view: view,
    analyzed: analyzed, chgCount: chgCount, yearStatus: yearStatus, pdfUrl: pdfUrl, addSet: addSet,
    yearData: yearData, rareSubjects: rareSubjects, standing: standing, coverage: coverage,
    regionRanking: regionRanking, regionStrength: regionStrength, search: search
  };
})(typeof window !== 'undefined' ? window : globalThis);
