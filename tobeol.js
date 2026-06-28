// ════════════════════════════════════════════════════════════
//  토벌권 계산기 — 어느 캐릭에 토벌권을 쓰는 게 효율적인가
//  · 명성 → 입장 가능 던전 판정 (+ 다음 던전까지 필요 명성)
//  · 던담 딜(ozma)/버프력(buffScore) → 딜컷·버프력컷 비교 → 단품/벞교 판정
//  · 벞교(딜3+버퍼1) 우선 추천, 단품 가능 캐릭은 그 다음
//  데이터는 state.characters (갱신기 탭과 공유)를 그대로 사용.
//  parseDundamNum 은 app.js 전역 함수 재사용.
// ════════════════════════════════════════════════════════════
window.Tobeol = (function () {

  const CUTS_KEY = 'df_tobeol_cuts_v1';

  // 입장 명성 = 공식 확정값. 딜컷(일반/1업/2업)·버프력컷 = 잠정(편집 가능).
  //   cutNormal : 일반파티 딜컷(= 단품 기준) · cut1 : 1업 캐리어 컷 · cut2 : 2업 캐리어 컷
  //   buffCut   : 버퍼 buffScore 컷 · 모두 던담 딜(ozma)/버프 점수 기준 숫자
  // 표시 순서(높은 등급 → 낮은 등급), 레기온은 맨 위. fame=입장 명성(공식).
  const DEFAULT_DUNGEONS = [
    { id: 'legion3',     name: '아포칼립스 3단',     type: '레기온', fame: 73993,  cutNormal: 1.0e12, cut1: 1.5e12, cut2: 2.5e12, buffCut: 110000 },
    { id: 'legion2',     name: '아포칼립스 2단',     type: '레기온', fame: 73993,  cutNormal: 7.0e11, cut1: 1.0e12, cut2: 2.0e12, buffCut: 110000 },
    { id: 'gwaeob',      name: '최후의 과업',        type: '상급',   fame: 108921, cutNormal: 1.0e12, cut1: 1.5e12, cut2: 2.5e12, buffCut: 110000 },
    { id: 'baegyo',      name: '배교자의 성',        type: '상급',   fame: 101853, cutNormal: 7.0e11, cut1: 1.0e12, cut2: 2.0e12, buffCut: 110000 },
    { id: 'byeolgeobuk', name: '별거북 대서고',      type: '상급',   fame: 91582,  cutNormal: 3.0e11, cut1: 5.0e11, cut2: 1.0e12, buffCut: 100000 },
  ];

  function loadCuts() {
    const base = DEFAULT_DUNGEONS.map(d => ({ ...d }));
    try {
      const saved = JSON.parse(localStorage.getItem(CUTS_KEY) || '{}');
      base.forEach(d => {
        const o = saved[d.id];
        if (o) {
          // 입장 명성(fame)은 고정값 — 딜컷(일반/1업/2업)·버프컷만 덮어씀
          ['cutNormal', 'cut1', 'cut2', 'buffCut'].forEach(f => { if (Number.isFinite(o[f])) d[f] = o[f]; });
        }
      });
    } catch {}
    return base;
  }
  function saveCuts(dungeons) {
    const out = {};
    dungeons.forEach(d => { out[d.id] = { cutNormal: d.cutNormal, cut1: d.cut1, cut2: d.cut2, buffCut: d.buffCut }; });
    localStorage.setItem(CUTS_KEY, JSON.stringify(out));
  }
  function resetCuts() { localStorage.removeItem(CUTS_KEY); }

  // ── 토벌권 사용 요구 명성(컷) ── 던파 공식 고정값(편집 대상 아님). 캐릭을 어느 토벌권에 배정할지 가르는 기준.
  const ticketFames = {
    'tk-gwaeob-baegyo':         108921,  // 과업 & 배교
    'tk-baegyo-byeolgeobuk':    101853,  // 배교 & 별거북
  };
  // 레기온: 입장 명성과 토벌권 컷이 분리됨. 입장=던전 fame(73,993), 토벌권=2단 기준.
  const LEGION_ENTRY_FAME  = 73993;
  const LEGION_TICKET_FAME = 105881;  // 레기온 토벌권 사용 컷 (2단 기준). 3단 토벌권은 없음.
  // 용병단 레벨 → 주간 토벌권 개수 (상급 / 레기온). 레벨은 수동 입력(API 미제공).
  const CORPS_TICKETS = {
    1:  { sang: 1,  legion: 0 },
    2:  { sang: 1,  legion: 0 },
    3:  { sang: 2,  legion: 0 },
    4:  { sang: 3,  legion: 1 },
    5:  { sang: 4,  legion: 2 },
    6:  { sang: 6,  legion: 3 },
    7:  { sang: 7,  legion: 4 },
    8:  { sang: 8,  legion: 5 },
    9:  { sang: 9,  legion: 6 },
    10: { sang: 10, legion: 7 },
    11: { sang: 12, legion: 8 },
  };
  const CORPS_KEY = 'df_tobeol_corps_v1';
  function loadCorpsLevel() {
    const v = parseInt(localStorage.getItem(CORPS_KEY), 10);
    return (v >= 1 && v <= 11) ? v : 11;
  }
  let corpsLevel = loadCorpsLevel();
  function weeklyTickets() { return CORPS_TICKETS[corpsLevel] || CORPS_TICKETS[11]; }

  // 그룹별 "업둥 캐리" 정책: 2=2업까지(기본) · 1=1업까지 · 0=끔
  const CARRY_KEY = 'df_tobeol_carry_v1';
  function loadCarry() { try { return JSON.parse(localStorage.getItem(CARRY_KEY) || '{}'); } catch { return {}; } }
  let carryPref = loadCarry();
  const carryLevel = id => { const v = carryPref[id]; return (v === 0 || v === 1 || v === 2) ? v : 2; };
  function setCarry(id, lvl) { carryPref[id] = lvl; localStorage.setItem(CARRY_KEY, JSON.stringify(carryPref)); }

  // 캐릭터 배제 (친구팟 약속 등). characterId(없으면 이름) 키로 저장. 배제된 캐릭은 계산에서 제외.
  const EXCLUDE_KEY = 'df_tobeol_exclude_v1';
  const charKey = c => c.characterId || c.characterName || c.name || '?';
  function loadExclude() { try { return new Set(JSON.parse(localStorage.getItem(EXCLUDE_KEY) || '[]')); } catch { return new Set(); } }
  let excluded = loadExclude();
  const isExcluded = c => excluded.has(charKey(c));
  function toggleExclude(key) {
    if (excluded.has(key)) excluded.delete(key); else excluded.add(key);
    localStorage.setItem(EXCLUDE_KEY, JSON.stringify([...excluded]));
  }

  // 상급 토벌권 = 명시적 쌍(인접 슬라이딩 아님). 표시 순서 = 높은 등급 → 낮은 등급. (레기온은 별도 그룹)
  const TICKET_DEFS = [
    { id: 'tk-gwaeob-baegyo',         ids: ['gwaeob', 'baegyo'] },
    { id: 'tk-baegyo-byeolgeobuk',    ids: ['baegyo', 'byeolgeobuk'] },
  ];
  // ── 캐릭터 분류 ──
  // 던담 포맷 문자열 → 숫자 ("3 조 1914 억" / "9920 억 8472 만" / "142,108")
  // app.js 의 parseDundamNum 과 동일 로직 (IIFE 안에 있어 재사용 불가하므로 자체 보유).
  function P(s) {
    if (s == null) return null;
    if (typeof s === 'number') return s;
    const str = String(s).trim();
    if (!str) return null;
    if (/^[\d,.]+$/.test(str)) return Number(str.replace(/,/g, ''));
    let total = 0;
    (str.match(/\d+\s*[조억만]/g) || []).forEach(part => {
      const n = parseInt(part, 10);
      if (part.includes('조'))      total += n * 1e12;
      else if (part.includes('억')) total += n * 1e8;
      else if (part.includes('만')) total += n * 1e4;
    });
    return total || null;
  }
  function roleOf(c) {
    if (c.ozma) return 'dealer';
    if (c.buffScore) return 'buffer';
    return 'none';
  }
  function scoreOf(c) {
    const r = roleOf(c);
    if (r === 'dealer') return P(c.ozma);
    if (r === 'buffer') return P(c.buffScore);
    return null;
  }

  // ── 토벌권 배정 ──
  // 상급 토벌권: 캐릭은 '토벌권 사용 명성 컷'을 충족하는 가장 높은 토벌권 하나에 배정.
  function sangeupTickets(tickets) { return tickets.filter(t => !t.legion).sort((a, b) => b.fame - a.fame); }
  function legionTicket(tickets)   { return tickets.find(t => t.legion) || null; }
  function assignedTicket(c, tickets) {
    if (roleOf(c) === 'none') return null;
    return sangeupTickets(tickets).find(t => (c.fame || 0) >= t.fame) || null;
  }
  // 이 캐릭이 주간 보상 받을 던전 id 집합 = 배정된 상급 토벌권의 2던전 (+ 레기온 컷 충족 시 레기온)
  function coveredDungeonIds(c, tickets) {
    const set = new Set();
    const at = assignedTicket(c, tickets);
    if (at) at.ids.forEach(id => set.add(id));
    const lt = legionTicket(tickets);
    if (lt && (c.fame || 0) >= lt.fame) set.add(lt.ids[0]);
    return set;
  }

  // ── 숫자 포맷 ──
  function fmtDeal(n) {
    if (n == null) return '-';
    if (n >= 1e12) { const jo = Math.floor(n / 1e12); const eok = Math.round((n % 1e12) / 1e8); return eok ? `${jo}조 ${eok}억` : `${jo}조`; }
    if (n >= 1e8)  return `${Math.round(n / 1e8).toLocaleString('ko-KR')}억`;
    if (n >= 1e4)  return `${Math.round(n / 1e4)}만`;
    return Number(n).toLocaleString('ko-KR');
  }
  const fmtNum = n => (n == null ? '-' : Number(n).toLocaleString('ko-KR'));

  // ── 편집 입력 단위 변환 (딜컷=억, 버프력=만) + 콤마 ──
  const grp = n => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });
  const parseEditNum = s => Number(String(s).replace(/[^\d.]/g, '')) || 0;
  const eokDisp = v => grp(Math.floor((v || 0) / 1e8));        // 딜컷 → 억 (정수, 억 밑 버림)
  const manDisp = v => grp((v || 0) / 1e4);                    // 버프력컷 → 만 (소수 허용)

  // 컷 돌파 여부 — 단품 가능? (딜러: 일반파티 컷 = 단품 기준)
  function passesCut(c, d) {
    const role = roleOf(c);
    if (role === 'none') return false;
    const score = scoreOf(c), cut = role === 'dealer' ? d.cutNormal : d.buffCut;
    return score != null && cut != null && score >= cut;
  }
  // 캐릭 × 던전 판정 (토벌권 배정 기준)
  //   'locked'(토벌권/입장 명성 미달) | 'over'(배정 토벌권 밖) | 'solo'(단품) | 'bugyo'(벞교필요) | 'na'
  function statusOf(c, d, tickets) {
    if (roleOf(c) === 'none') return { kind: 'na' };
    // 레기온: 입장 명성(73,993)만 넘으면 참여 가능(약캐는 업둥). 토벌권 컷과 별개.
    if (d.type === '레기온') {
      if ((c.fame || 0) < d.fame) return { kind: 'locked', shortBy: d.fame - (c.fame || 0) };
      return { kind: passesCut(c, d) ? 'solo' : 'bugyo' };
    }
    const covered = coveredDungeonIds(c, tickets);
    if (covered.has(d.id)) return { kind: passesCut(c, d) ? 'solo' : 'bugyo' };
    // 이 던전을 포함하는 토벌권 중 가장 낮은 사용 컷 = 이 던전을 돌 수 있는 최소 명성
    const containing = tickets.filter(t => t.ids.includes(d.id));
    const minCut = containing.length ? Math.min(...containing.map(t => t.fame)) : Infinity;
    if ((c.fame || 0) >= minCut) return { kind: 'over' };   // 토벌권 쓸 수 있으나 배정(상위) 토벌권 우선
    return { kind: 'locked', shortBy: minCut === Infinity ? 0 : minCut - (c.fame || 0) };
  }

  // ════════════════════════════════════════════════════════════
  //  렌더
  // ════════════════════════════════════════════════════════════
  let dungeons = loadCuts();

  function render(characters) {
    injectStyle();
    const root = document.getElementById('tobeolRoot');
    if (!root) return;
    const chars = (characters || []).filter(c => c.fame != null);

    if (!chars.length) {
      root.innerHTML = `
        <div class="tb-empty">
          <div class="tb-empty-ico">🎫</div>
          <p><b>토벌권 계산기</b></p>
          <p class="tb-dim">먼저 <b>일괄 갱신기</b> 탭에서 모험단을 검색하면,<br>그 캐릭터들로 어디에 토벌권을 쓰는 게 효율적인지 계산해 줍니다.</p>
        </div>`;
      return;
    }

    const sangTickets = buildTickets();
    const activeChars = chars.filter(c => !isExcluded(c));   // 배제 캐릭은 계산에서 제외
    // 레기온은 별도 그룹: 입장명성(73,993)으로 참여, 3단 우선 + 2단/토벌권/쩔 폴백
    const legionGroup = { id: 'g-legion', legion: true, label: '아포칼립스', ids: ['legion3', 'legion2'], fame: LEGION_ENTRY_FAME, ticketFame: LEGION_TICKET_FAME };
    const legionList = activeChars.filter(c => roleOf(c) !== 'none' && (c.fame || 0) >= LEGION_ENTRY_FAME);
    const plans = [
      { t: legionGroup, list: legionList, plan: planLegion(legionList, carryLevel(legionGroup.id)) },
      ...sangTickets.map(t => {
        const list = charsForTicket(t, activeChars, sangTickets);
        return { t, list, plan: planGroup(list, pairCuts(t.ids.map(dungeonById)), carryLevel(t.id)) };
      }),
    ];
    root.innerHTML =
      editorHTML(sangTickets) +
      summaryHTML(activeChars, chars.length - activeChars.length) +
      summaryTobeolHTML(plans) +
      cardsHTML(plans) +
      matrixHTML(chars, sangTickets);
    bindEditor(chars);
    const corps = document.getElementById('tbCorps');
    if (corps) corps.addEventListener('change', () => {
      corpsLevel = parseInt(corps.value, 10) || 11;
      localStorage.setItem(CORPS_KEY, String(corpsLevel));
      render(chars);
    });
    document.querySelectorAll('#tobeolRoot [data-carry]').forEach(sel => sel.addEventListener('change', () => {
      setCarry(sel.dataset.carry, Number(sel.value));
      render(chars);
    }));
    document.querySelectorAll('#tobeolRoot [data-ex]').forEach(cb => cb.addEventListener('change', () => {
      toggleExclude(cb.dataset.ex);
      render(chars);
    }));
  }

  // ── 요약 스트립 ──
  function summaryHTML(chars, exCount = 0) {
    const dealers = chars.filter(c => roleOf(c) === 'dealer').length;
    const buffers = chars.filter(c => roleOf(c) === 'buffer').length;
    const maxBugyo = Math.min(buffers, Math.floor(dealers / 3));
    const wt = weeklyTickets();
    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">🎫 토벌권 계산기</h1>
          <p class="page-sub">명성·딜·버프력 기준으로 어느 캐릭에 토벌권을 쓰는 게 효율적인지 추천합니다 (역설의 미궁 상급·레기온)</p>
        </div>
      </div>
      <div class="tb-strip">
        <div class="tb-kpi"><span class="tb-kpi-v">${chars.length}${exCount ? `<small style="font-size:12px;color:var(--text-4,#6b7280)"> (−${exCount})</small>` : ''}</span><span class="tb-kpi-l">대상 캐릭터${exCount ? ' · 배제 ' + exCount : ''}</span></div>
        <div class="tb-kpi"><span class="tb-kpi-v">${dealers}</span><span class="tb-kpi-l">딜러</span></div>
        <div class="tb-kpi"><span class="tb-kpi-v">${buffers}</span><span class="tb-kpi-l">버퍼</span></div>
        <div class="tb-kpi"><span class="tb-kpi-v accent">${maxBugyo}</span><span class="tb-kpi-l">최대 벞교 세트</span></div>
      </div>
      <div class="tb-corps">
        <label>용병단 레벨
          <select id="tbCorps">${Array.from({ length: 11 }, (_, i) => i + 1).map(lv => `<option value="${lv}" ${lv === corpsLevel ? 'selected' : ''}>Lv ${lv}</option>`).join('')}</select>
        </label>
        <span class="tb-corps-out">주간 토벌권 · 상급 <b>${wt.sang}</b>장 · 레기온 <b>${wt.legion}</b>장</span>
      </div>`;
  }

  // ── 토벌권 구성 ──
  function dungeonById(id) { return dungeons.find(d => d.id === id); }

  function ticketFameFor(id, fallback) {
    const v = ticketFames[id];
    return Number.isFinite(v) ? v : fallback;
  }

  // 명시적 토벌권 정의에서 카드 생성. 각 토벌권에 사용 명성 컷(fame) 부착(기본=첫 던전 입장 명성).
  function buildTickets() {
    return TICKET_DEFS
      .filter(def => def.ids.every(id => dungeonById(id)))
      .map(def => {
        const dgs = def.ids.map(dungeonById);
        const label = def.legion ? shortName(dgs[0].name) : dgs.map(d => shortName(d.name)).join(' & ');
        return { id: def.id, legion: !!def.legion, ids: def.ids.slice(), label, fame: ticketFameFor(def.id, dgs[0].fame) };
      });
  }

  // 이 토벌권을 쓸 캐릭 — 토벌권 사용 명성 컷 기준. 상급은 배정된 토벌권, 레기온은 컷 충족 전원.
  function charsForTicket(t, chars, tickets) {
    if (t.legion) return chars.filter(c => roleOf(c) !== 'none' && (c.fame || 0) >= t.fame);
    return chars.filter(c => assignedTicket(c, tickets) === t);
  }

  // ── 업둥팟 배치 ──
  // 던전 쌍의 구속 컷 = 두 던전 중 더 높은 값(더 어려운 쪽 기준)
  function pairCuts(dgs) {
    const m = f => Math.max(...dgs.map(d => d[f] || 0));
    return { normal: m('cutNormal'), cut1: m('cut1'), cut2: m('cut2'), buff: m('buffCut') };
  }

  // 한 그룹(같은 명성대) 배치: 버퍼 1명당 파티 1개(버퍼는 파티에 들어가야 클리어).
  //   2업(캐리어1≥cut2 + 약캐2) 우선 → 1업(캐리어2≥cut1 + 약캐1) → 일반(강캐3). 못 태운 약캐 = 토벌권.
  function planGroup(list, cuts, maxUp = 2, noNormal = false) {
    const buffers = list.filter(c => roleOf(c) === 'buffer').sort((a, b) => (scoreOf(b) || 0) - (scoreOf(a) || 0));
    const strongQ = list.filter(c => roleOf(c) === 'dealer' && (scoreOf(c) || 0) >= cuts.normal).sort((a, b) => (scoreOf(b) || 0) - (scoreOf(a) || 0));
    const weakQ   = list.filter(c => roleOf(c) === 'dealer' && (scoreOf(c) || 0) <  cuts.normal).sort((a, b) => (scoreOf(b) || 0) - (scoreOf(a) || 0));
    const buffQ = [...buffers];
    const parties = [];
    while (buffQ.length) {
      if (maxUp >= 2 && strongQ.length && (scoreOf(strongQ[0]) || 0) >= cuts.cut2 && weakQ.length >= 2) {
        const carrier = strongQ.shift();
        const ups = [weakQ.pop(), weakQ.pop()];
        parties.push({ type: '2업', buffer: buffQ.shift(), dealers: [carrier, ...ups], ups });
      } else if (maxUp >= 1 && strongQ.length >= 2 && (scoreOf(strongQ[1]) || 0) >= cuts.cut1 && weakQ.length >= 1) {
        const c1 = strongQ.shift(), c2 = strongQ.shift(), up = weakQ.pop();
        parties.push({ type: '1업', buffer: buffQ.shift(), dealers: [c1, c2, up], ups: [up] });
      } else if (!noNormal && strongQ.length >= 3) {
        const d = [strongQ.shift(), strongQ.shift(), strongQ.shift()];
        parties.push({ type: '일반', buffer: buffQ.shift(), dealers: d, ups: [] });
      } else break;
    }
    return { parties, solo: [...strongQ], tobeol: [...weakQ], buffersIdle: [...buffQ], buffersTotal: buffers.length };
  }

  // 레기온: 주1회 · 3단 우선(보상↑). 3단 벞교로 못 가면 → 2단 단품 / (2단)토벌권 / 쩔.
  function planLegion(list, maxUp = 2) {
    const d3 = dungeonById('legion3'), d2 = dungeonById('legion2');
    const cuts3 = { normal: d3.cutNormal, cut1: d3.cut1, cut2: d3.cut2, buff: d3.buffCut };
    const cuts2 = { normal: d2.cutNormal, cut1: d2.cut1, cut2: d2.cut2, buff: d2.buffCut };
    // 1차 3단: 캐리 파티만(일반파티 안 만듦) — 강캐는 단품, 버퍼 절약
    const p3 = planGroup(list, cuts3, maxUp, true);
    // 2차 2단: 3단 못 간 약캐 + 3단서 안 쓴 버퍼(내려옴)로 2단 파티/단품/캐리
    const pass2 = [...p3.tobeol, ...p3.buffersIdle];
    const p2 = planGroup(pass2, cuts2, maxUp, false);
    // 2단도 못 가는(벞교 포함) 약캐 → 토벌권(105,881↑)/쩔
    const fallback = p2.tobeol.map(c => ({ c, how: (c.fame || 0) >= LEGION_TICKET_FAME ? '토벌권' : '쩔' }));
    return {
      parties3: p3.parties, solo3: p3.solo,
      parties2: p2.parties, solo2: p2.solo,
      fallback, buffersIdle: p2.buffersIdle,
      buffersTotal: list.filter(c => roleOf(c) === 'buffer').length,
    };
  }

  // ── 토벌권 배분 추천 (단품·벞교로 안 되는 캐릭에만, 나머지 keeping) ──
  function summaryTobeolHTML(plans) {
    const wt = weeklyTickets();
    const sangNeed = plans.filter(p => !p.t.legion).flatMap(p => p.plan.tobeol.map(c => ({ c, t: p.t })));
    const legP = plans.find(p => p.t.legion);
    const legNeed = legP ? legP.plan.fallback.filter(f => f.how === '토벌권').map(f => ({ c: f.c })) : [];

    const tag = x => `<span class="tb-tag tobeol">${roleOf(x.c) === 'buffer' ? '🛡' : '⚔'} ${esc(nameOf(x.c))}${x.t ? ` <em>${esc(shortName(dungeonById(x.t.ids[0]).name))}</em>` : ''}</span>`;

    const line = (label, need, have, note) => {
      const keep = Math.max(0, have - need.length);
      const short = Math.max(0, need.length - have);
      const body = need.length
        ? `<div class="tb-sololist">${need.map(tag).join('')}</div>`
        : `<div class="tb-dim tb-pad">토벌권 쓸 캐릭 없음 — ${note}</div>`;
      const status = short
        ? `<span class="tb-short">${short}장 부족</span> · ${short}명은 쩔 필요`
        : keep ? `<span class="tb-keep">${keep}장 보관 가능</span>` : '딱 맞음';
      return `<div class="tb-alloc-row">
        <div class="tb-alloc-h">${label} 보유 <b>${have}</b>장 · 사용 <b>${Math.min(need.length, have)}</b>장 · ${status}</div>
        ${body}
      </div>`;
    };
    return `
      <div class="tb-alloc">
        <div class="tb-sec-title">🎫 토벌권 배분 추천 <small class="tb-dim" style="font-weight:600">— 단품·벞교(업둥)로 안 되는 캐릭에만 사용, 나머지 보관</small></div>
        ${line('상급 토벌권', sangNeed, wt.sang, '단품·벞교로 전부 해결')}
        ${line('레기온 토벌권', legNeed, wt.legion, '3단 벞교/2단으로 전부 해결')}
      </div>`;
  }

  // ── 벞교 추천 카드 (명성대별 파티 + 단품 + 토벌권) ──
  const soloTag = c => `<span class="tb-tag solo">${roleOf(c) === 'buffer' ? '🛡' : '⚔'} ${esc(nameOf(c))} <em>${roleOf(c) === 'buffer' ? fmtNum(scoreOf(c)) : fmtDeal(scoreOf(c))}</em></span>`;
  const dealerTag = (c, isUp) => `<span class="tb-tag ${isUp ? 'up' : 'deal'}">⚔ ${esc(nameOf(c))} <em>${fmtDeal(scoreOf(c))}</em>${isUp ? ' 업' : ''}</span>`;

  // 단품(컷)까지 부족분 문자열 — 딜러: 억, 버퍼: 만
  function gapStr(c, cut) {
    const sc = scoreOf(c) || 0;
    if (cut == null || sc >= cut) return '';
    const g = cut - sc;
    return roleOf(c) === 'dealer' ? `+${fmtDeal(g)}` : `+${Math.ceil(g / 1e4)}만`;
  }
  // cut(=단품 기준) 대비 부족분을 함께 보여주는 태그 목록
  const chTags = (arr, cls, cut) => `<div class="tb-sololist">${arr.map(c => {
    const gap = cut != null ? gapStr(c, cut) : '';
    return `<span class="tb-tag ${cls}">${roleOf(c) === 'buffer' ? '🛡' : '⚔'} ${esc(nameOf(c))} <em>${roleOf(c) === 'buffer' ? fmtNum(scoreOf(c)) : fmtDeal(scoreOf(c))}</em>${gap ? ` <em class="tb-gap" title="단품까지 ${gap}">${gap}</em>` : ''}</span>`;
  }).join('')}</div>`;

  // 파티 목록 렌더
  function renderParties(parties, emptyMsg) {
    if (!parties.length) return `<div class="tb-dim tb-pad">${emptyMsg}</div>`;
    return parties.map((p, i) => `
      <div class="tb-set">
        <span class="tb-set-no">${i + 1} <span class="tb-up ${p.type === '일반' ? 'norm' : ''}">${p.type}</span></span>
        <span class="tb-tag buff">🛡 ${esc(nameOf(p.buffer))} <em>${fmtNum(scoreOf(p.buffer))}</em></span>
        ${p.dealers.map(dl => dealerTag(dl, p.ups.includes(dl))).join('')}
      </div>`).join('');
  }

  function groupCard(t, list, plan) {
    const leg = !!t.legion;
    const dgs = t.ids.map(dungeonById);
    const lvl = carryLevel(t.id);
    const titleLine = `<div class="tb-card-title">${leg ? '⚔ ' : ''}${esc(t.label)}${leg ? ' <span class="tb-badge sm">레기온 · 주1회</span>' : ''}</div>`;
    if (!list.length) {
      return `
        <div class="tb-card dim tb-card-empty ${leg ? 'legion' : ''}">
          ${titleLine}
          <div class="tb-card-cuts">${leg ? '입장' : '명성'} ${fmtNum(t.fame)} 이상</div>
          <div class="tb-empty-note">해당하는 명성 없음</div>
        </div>`;
    }
    const cutLines = dgs.map(d =>
      `<div class="tb-card-cuts"><b>${esc(shortName(d.name))}</b> · 일반 ${fmtDeal(d.cutNormal)} · 1업 ${fmtDeal(d.cut1)} · 2업 ${fmtDeal(d.cut2)} · 버프 ${fmtNum(d.buffCut)}</div>`).join('');
    const carryToggle = `<label class="tb-carry" title="업둥(약캐) 캐리 정책 — 끄면 토벌권/쩔로 보냄">업둥 <select data-carry="${t.id}"><option value="2" ${lvl === 2 ? 'selected' : ''}>2업까지</option><option value="1" ${lvl === 1 ? 'selected' : ''}>1업까지</option><option value="0" ${lvl === 0 ? 'selected' : ''}>끔</option></select></label>`;

    let body;
    if (leg) {
      const d3 = dungeonById('legion3'), d2 = dungeonById('legion2');
      const tk = plan.fallback.filter(x => x.how === '토벌권').map(x => x.c);
      const jj = plan.fallback.filter(x => x.how === '쩔').map(x => x.c);
      body = `
        <div class="tb-sec-label">3단 벞교 파티 (${lvl === 0 ? '일반만' : '업 = 캐리'})</div>
        ${renderParties(plan.parties3, '3단 파티 없음')}
        <div class="tb-sec-label">3단 단품 (자力)</div>
        ${plan.solo3.length ? chTags(plan.solo3, 'solo') : '<div class="tb-dim tb-pad">없음</div>'}
        <div class="tb-sec-label">2단 벞교 파티 (버퍼 내려감)</div>
        ${renderParties(plan.parties2, '2단 파티 없음')}
        <div class="tb-sec-label">2단 단품 (자力)</div>
        ${plan.solo2.length ? chTags(plan.solo2, 'solo') : '<div class="tb-dim tb-pad">없음</div>'}
        ${tk.length ? `<div class="tb-sec-label">레기온 토벌권 (2단도 안 됨) <small class="tb-dim">+N=2단까지</small></div>${chTags(tk, 'tobeol', d2.cutNormal)}` : ''}
        ${jj.length ? `<div class="tb-sec-label">쩔 필요 (토벌권 컷 미달) <small class="tb-dim">+N=2단까지</small></div>${chTags(jj, 'jjeol', d2.cutNormal)}` : ''}`;
    } else {
      const normalCut = Math.max(...dgs.map(d => d.cutNormal || 0));
      const idleNote = plan.buffersIdle.length ? `<div class="tb-dim tb-pad">⚠ 딜러 부족으로 버퍼 ${plan.buffersIdle.length}명 미배치</div>` : '';
      body = `
        <div class="tb-sec-label">벞교 파티 (${lvl === 0 ? '일반만' : '업 = 캐리되는 업둥이'})</div>
        ${renderParties(plan.parties, `파티 없음 (버퍼 ${plan.buffersTotal}명)`)}${idleNote}
        <div class="tb-sec-label">단품 (자力 클리어)</div>
        ${plan.solo.length ? chTags(plan.solo, 'solo') : '<div class="tb-dim tb-pad">없음</div>'}
        ${plan.tobeol.length ? `<div class="tb-sec-label">토벌권 필요 (벞교도 안 됨) <small class="tb-dim">+N=단품까지</small></div>${chTags(plan.tobeol, 'tobeol', normalCut)}` : ''}`;
    }
    return `
      <div class="tb-card ${leg ? 'legion' : ''}">
        <div class="tb-card-head">
          <div class="tb-card-titlerow">${titleLine}${carryToggle}</div>
          <div class="tb-card-cuts">${leg ? '입장' : '명성'} <b>${fmtNum(t.fame)}</b> 이상 · ${list.length}명</div>
          ${cutLines}
        </div>
        ${body}
      </div>`;
  }

  function cardsHTML(plans) {
    const cards = plans.map(p => groupCard(p.t, p.list, p.plan)).join('');
    return `<div class="tb-sec-title">벞교 추천 <small class="tb-dim" style="font-weight:600">— 명성대별 파티 구성(업둥 포함) · 단품 · 토벌권</small></div><div class="tb-cards">${cards}</div>`;
  }

  // ── 캐릭터 × 던전 매트릭스 ──
  function matrixHTML(chars, tickets) {
    const sorted = [...chars].sort((a, b) => (b.fame || 0) - (a.fame || 0));
    const head = dungeons.map(d => `<th title="입장 명성 ${fmtNum(d.fame)}">${esc(shortName(d.name))}</th>`).join('');
    const rows = sorted.map(c => {
      const ex = isExcluded(c);
      const role = roleOf(c);
      const roleLbl = role === 'dealer' ? '<span class="tb-role deal">딜</span>' : role === 'buffer' ? '<span class="tb-role buff">버퍼</span>' : '<span class="tb-role">-</span>';
      const scoreLbl = role === 'buffer' ? fmtNum(scoreOf(c)) : role === 'dealer' ? fmtDeal(scoreOf(c)) : '-';
      const cells = dungeons.map(d => {
        const s = statusOf(c, d, tickets);
        if (s.kind === 'locked') return `<td class="tb-cell lock" title="명성 ${fmtNum(s.shortBy)} 부족">🔒<small>+${fmtNum(s.shortBy)}</small></td>`;
        if (s.kind === 'over')   return `<td class="tb-cell over" title="입장 가능하나 배정 그룹 밖 — 더 높은 그룹 우선">초과</td>`;
        if (s.kind === 'solo')   return `<td class="tb-cell solo" title="컷 돌파 — 단품 가능">단품</td>`;
        if (s.kind === 'bugyo')  { const cut = roleOf(c) === 'dealer' ? d.cutNormal : d.buffCut; const g = gapStr(c, cut); return `<td class="tb-cell bugyo" title="단품까지 ${g || '0'} 더 필요">벞교${g ? `<small>${g}</small>` : ''}</td>`; }
        return `<td class="tb-cell na">-</td>`;
      }).join('');
      return `<tr class="${ex ? 'tb-exrow' : ''}">
        <td class="tb-c"><input type="checkbox" class="tb-ex" data-ex="${esc(charKey(c))}" ${ex ? 'checked' : ''} title="체크 시 계산에서 제외"></td>
        <td class="tb-name">${esc(nameOf(c))}</td>
        <td class="tb-job">${esc((c.jobGrowName || '').replace('眞 ', ''))}</td>
        <td class="tb-c">${roleLbl}</td>
        <td class="tb-num">${fmtNum(c.fame)}</td>
        <td class="tb-num">${scoreLbl}</td>
        ${cells}
      </tr>`;
    }).join('');
    return `
      <div class="tb-sec-title">캐릭터별 던전 판정</div>
      <div class="tb-legend">
        <span><i class="lg solo"></i>단품 가능</span>
        <span><i class="lg bugyo"></i>벞교 권장</span>
        <span><i class="lg over"></i>배정 그룹 밖</span>
        <span><i class="lg lock"></i>명성 미달(+필요 명성)</span>
      </div>
      <p class="tb-dim" style="margin:-2px 0 8px">각 캐릭은 충족하는 가장 높은 명성대 그룹(=상급 던전 2종)에 배정됩니다. 그 2종이 '단품/벞교', 더 낮은 던전은 '초과', 명성 미달은 '🔒'. (레기온은 별도)</p>
      <div class="tb-table-wrap">
        <table class="tb-matrix">
          <thead><tr>
            <th title="체크 시 계산 제외">제외</th><th>캐릭</th><th>직업</th><th>역할</th><th>명성</th><th>딜/버프</th>${head}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── 컷 편집 패널 ──
  function editorHTML(tickets) {
    const dealCell = (d, f) => `<td><span class="tb-in-wrap"><input type="text" inputmode="decimal" class="tb-in" data-f="${f}" data-unit="eok" value="${eokDisp(d[f])}"><small class="tb-unit">억</small></span> <small class="tb-live tb-dim">= ${fmtDeal(d[f])}</small></td>`;
    const dgRows = dungeons.map(d => `
      <tr data-id="${d.id}">
        <td>${esc(shortName(d.name))} <span class="tb-badge sm">${d.type}</span> <small class="tb-dim">입장 ${fmtNum(d.fame)}</small></td>
        ${dealCell(d, 'cutNormal')}${dealCell(d, 'cut1')}${dealCell(d, 'cut2')}
        <td><span class="tb-in-wrap"><input type="text" inputmode="decimal" class="tb-in" data-f="buffCut" data-unit="man" value="${manDisp(d.buffCut)}"><small class="tb-unit">만</small></span> <small class="tb-live tb-dim">= ${fmtNum(d.buffCut)}</small></td>
      </tr>`).join('');
    return `
      <details class="tb-editor" open>
        <summary>⚙ 딜컷(일반/1업/2업) · 버프력컷 편집 — 입장 명성·토벌권 컷은 공식 고정값</summary>
        <div class="tb-table-wrap">
        <table class="tb-edit-table">
          <thead><tr><th>던전</th><th>일반컷 (단품)</th><th>1업 컷</th><th>2업 컷</th><th>버프력컷</th></tr></thead>
          <tbody>${dgRows}</tbody>
        </table>
        </div>
        <div class="tb-edit-actions">
          <button class="btn primary" id="tbSave">저장</button>
          <button class="btn ghost" id="tbReset">기본값 복원</button>
          <span class="tb-dim">딜컷=억 단위(1→1억, 억 밑 버림)·버프력=만 단위. 일반컷=단품/일반파티, 1업=약캐1 캐리, 2업=약캐2 캐리.</span>
        </div>
      </details>`;
  }

  // 입력 라이브: 콤마 자동 + 환산 라벨 갱신
  function attachLiveFormat() {
    document.querySelectorAll('.tb-editor .tb-in').forEach(inp => {
      const unit = inp.dataset.unit;
      const wrap = inp.closest('td');
      const live = wrap && wrap.querySelector('.tb-live');
      const updateLabel = () => {
        if (!live) return;
        const stored = toStored(inp.value, unit);
        live.textContent = unit === 'eok' ? '= ' + fmtDeal(stored) : '= ' + fmtNum(stored);
      };
      inp.addEventListener('input', updateLabel);
      inp.addEventListener('blur', () => {
        if (inp.value.trim() === '') return;
        const n = parseEditNum(inp.value);
        inp.value = unit === 'eok' ? grp(Math.floor(n)) : grp(n);
        updateLabel();
      });
    });
  }

  // 입력 단위 → 저장값. eok: 억(억 밑 버림) · man: 만 · fame: 그대로
  function toStored(raw, unit) {
    const n = parseEditNum(raw);
    if (unit === 'eok') return Math.floor(n) * 1e8;
    if (unit === 'man') return Math.round(n * 1e4);
    return Math.round(n);
  }

  function bindEditor(chars) {
    attachLiveFormat();
    const save = document.getElementById('tbSave');
    const reset = document.getElementById('tbReset');
    if (save) save.addEventListener('click', () => {
      document.querySelectorAll('.tb-edit-table tr[data-id]').forEach(tr => {
        const d = dungeons.find(x => x.id === tr.dataset.id);
        if (!d) return;
        tr.querySelectorAll('input[data-f]').forEach(inp => {
          const v = toStored(inp.value, inp.dataset.unit);
          if (Number.isFinite(v)) d[inp.dataset.f] = v;
        });
      });
      saveCuts(dungeons);
      render(chars);
    });
    if (reset) reset.addEventListener('click', () => {
      resetCuts();
      dungeons = loadCuts();
      render(chars);
    });
  }

  // ── 유틸 ──
  function nameOf(c) { return c.characterName || c.name || '?'; }
  function shortName(n) {
    return n.replace('아포칼립스 3단', '아포 3단')
            .replace('아포칼립스 2단', '아포 2단')
            .replace('아포칼립스: 안티엔바이', '아포칼립스')
            .replace('최후의 ', '')        // 과업
            .replace('해방된 ', '')        // 흉몽
            .replace('죽음의 ', '')        // 여신전
            .replace('배교자의 성', '배교')
            .replace(' 대서고', '')        // 별거북
            .replace(' 메인', '')          // 애쥬어
            .replace('달이 잠긴 ', '')     // 호수
            .trim();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

  // ── 스타일 (1회 주입) ──
  let styled = false;
  function injectStyle() {
    if (styled) return; styled = true;
    const css = `
    #pane-tobeol .tb-strip{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 18px}
    #pane-tobeol .tb-kpi{background:var(--surface-2,#1a1d24);border:1px solid var(--border,#2a2e38);border-radius:12px;padding:12px 18px;min-width:96px;display:flex;flex-direction:column;gap:2px}
    #pane-tobeol .tb-kpi-v{font-size:22px;font-weight:800}
    #pane-tobeol .tb-kpi-v.accent{color:var(--accent,#7c9cff)}
    #pane-tobeol .tb-kpi-l{font-size:11px;color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-corps{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 18px;font-size:13px;color:var(--text-2,#c7cdd8)}
    #pane-tobeol .tb-corps label{display:flex;align-items:center;gap:8px;font-weight:700}
    #pane-tobeol .tb-corps select{background:var(--surface,#13151b);border:1px solid var(--border,#2a2e38);border-radius:7px;padding:5px 10px;color:var(--text-1,#e8ebf0);font-size:13px;font-weight:700}
    #pane-tobeol .tb-corps-out{color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-corps-out b{color:var(--accent,#7c9cff);font-size:15px}
    #pane-tobeol .tb-alloc{background:color-mix(in oklab,var(--accent,#7c9cff) 8%,var(--surface-2,#1a1d24));border:1px solid color-mix(in oklab,var(--accent,#7c9cff) 35%,var(--border,#2a2e38));border-radius:14px;padding:14px 16px;margin-bottom:22px}
    #pane-tobeol .tb-alloc-row{padding:8px 0;border-top:1px dashed var(--border,#2a2e38)}
    #pane-tobeol .tb-alloc-row:first-of-type{border-top:none}
    #pane-tobeol .tb-alloc-h{font-size:13px;font-weight:800;margin-bottom:6px}
    #pane-tobeol .tb-alloc-h b{color:var(--accent,#7c9cff)}
    #pane-tobeol .tb-cards{display:flex;flex-direction:column;gap:12px;margin-bottom:26px}
    #pane-tobeol .tb-card{background:var(--surface-2,#1a1d24);border:1px solid var(--border,#2a2e38);border-radius:14px;padding:14px 16px}
    #pane-tobeol .tb-card.legion{border-color:color-mix(in oklab,var(--accent,#7c9cff) 45%,var(--border,#2a2e38))}
    #pane-tobeol .tb-card.dim{opacity:.5;border-style:dashed}
    #pane-tobeol .tb-card-empty{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 16px}
    #pane-tobeol .tb-card-empty .tb-card-cuts{margin:0}
    #pane-tobeol .tb-card-empty .tb-empty-note{padding:0;margin-left:auto;font-size:12px;font-weight:700;color:var(--text-4,#6b7280)}
    #pane-tobeol .tb-card-title{font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px}
    #pane-tobeol .tb-card-titlerow{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    #pane-tobeol .tb-carry{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--text-3,#9aa3b2);cursor:pointer;user-select:none}
    #pane-tobeol .tb-carry input{cursor:pointer}
    #pane-tobeol .tb-carry select{background:var(--surface,#13151b);border:1px solid var(--border,#2a2e38);border-radius:6px;padding:2px 6px;color:var(--text-1,#e8ebf0);font-size:12px;font-weight:700;cursor:pointer}
    #pane-tobeol tr.tb-exrow{opacity:.4}
    #pane-tobeol .tb-ex{cursor:pointer}
    #pane-tobeol .tb-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--surface-3,#262a34);color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-badge.sm{font-size:9px;padding:1px 6px}
    #pane-tobeol .tb-card-cuts{font-size:11px;color:var(--text-3,#9aa3b2);margin-top:4px}
    #pane-tobeol .tb-card-cuts b{color:var(--text-2,#c7cdd8)}
    #pane-tobeol .tb-card-stat{font-size:12px;color:var(--text-3,#9aa3b2);margin:10px 0 4px;display:flex;gap:6px;flex-wrap:wrap}
    #pane-tobeol .tb-card-stat .ok{color:#5fd08a;font-weight:700}
    #pane-tobeol .tb-card-stat .over{color:#c08a8a}
    #pane-tobeol .tb-card-stat .lock{color:var(--text-4,#6b7280)}
    #pane-tobeol .tb-card-stat b{color:var(--text-1,#e8ebf0)}
    #pane-tobeol .tb-sec-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-4,#6b7280);margin:12px 0 6px;font-weight:700}
    #pane-tobeol .tb-set{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:5px 0;border-top:1px dashed var(--border,#2a2e38)}
    #pane-tobeol .tb-set-no{font-size:10px;font-weight:800;color:var(--text-4,#6b7280);min-width:42px}
    #pane-tobeol .tb-sololist,#pane-tobeol .tb-tag{display:flex}
    #pane-tobeol .tb-sololist{flex-wrap:wrap;gap:5px}
    #pane-tobeol .tb-empty-tickets{margin:14px 0 26px;background:var(--surface-2,#1a1d24);border:1px dashed var(--border,#2a2e38);border-radius:12px;padding:6px 14px}
    #pane-tobeol .tb-empty-tickets summary{cursor:pointer;font-size:12px;font-weight:700;color:var(--text-3,#9aa3b2);padding:8px 0}
    #pane-tobeol .tb-empty-tk-list{display:flex;flex-wrap:wrap;gap:8px;padding:6px 0 12px}
    #pane-tobeol .tb-empty-tk{font-size:12px;font-weight:600;padding:5px 10px;border-radius:8px;background:var(--surface-3,#262a34);color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-empty-tk small{color:var(--text-4,#6b7280);font-weight:600;margin-left:4px}
    #pane-tobeol .tb-solo-dg{display:flex;gap:8px;align-items:flex-start;padding:4px 0}
    #pane-tobeol .tb-solo-dg-l{font-size:11px;font-weight:800;color:var(--text-3,#9aa3b2);min-width:54px;padding-top:3px}
    #pane-tobeol .tb-editor[open]{margin-bottom:18px}
    #pane-tobeol .tb-tag{align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;background:var(--surface-3,#262a34);border:1px solid var(--border,#2a2e38)}
    #pane-tobeol .tb-tag em{font-style:normal;color:var(--text-3,#9aa3b2);font-weight:700}
    #pane-tobeol .tb-tag.buff{border-color:color-mix(in oklab,#5fa8ff 40%,transparent)}
    #pane-tobeol .tb-tag.deal{border-color:color-mix(in oklab,#ff8a5f 30%,transparent)}
    #pane-tobeol .tb-tag.solo{border-color:color-mix(in oklab,#5fd08a 40%,transparent)}
    #pane-tobeol .tb-tag.up{border-color:color-mix(in oklab,#e6b85f 50%,transparent);background:color-mix(in oklab,#e6b85f 12%,var(--surface-3,#262a34));color:#e6b85f}
    #pane-tobeol .tb-tag.tobeol{border-color:color-mix(in oklab,#c08aff 50%,transparent);background:color-mix(in oklab,#c08aff 12%,var(--surface-3,#262a34))}
    #pane-tobeol .tb-tag.jjeol{border-color:color-mix(in oklab,#ff7a7a 50%,transparent);background:color-mix(in oklab,#ff7a7a 12%,var(--surface-3,#262a34));color:#ff9d9d}
    #pane-tobeol .tb-up{font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;background:color-mix(in oklab,#e6b85f 22%,transparent);color:#e6b85f}
    #pane-tobeol .tb-up.norm{background:var(--surface-3,#262a34);color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-gap{color:#e6b85f !important;font-weight:800}
    #pane-tobeol .tb-cell.bugyo small{display:block;font-size:9px;font-weight:700;color:#caa75a}
    #pane-tobeol .tb-keep{color:#5fd08a;font-weight:800}
    #pane-tobeol .tb-short{color:#ff7a7a;font-weight:800}
    #pane-tobeol .tb-pad{padding:6px 0}
    #pane-tobeol .tb-dim{color:var(--text-4,#6b7280);font-size:11px}
    #pane-tobeol .tb-sec-title{font-size:15px;font-weight:800;margin:6px 0 8px}
    #pane-tobeol .tb-legend{display:flex;gap:16px;font-size:11px;color:var(--text-3,#9aa3b2);margin-bottom:8px}
    #pane-tobeol .tb-legend i.lg{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
    #pane-tobeol .lg.solo{background:#5fd08a}#pane-tobeol .lg.bugyo{background:#e6b85f}#pane-tobeol .lg.over{background:#6e4a4a}#pane-tobeol .lg.lock{background:#444a57}
    #pane-tobeol .tb-table-wrap{overflow-x:auto;border:1px solid var(--border,#2a2e38);border-radius:12px}
    #pane-tobeol .tb-matrix{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}
    #pane-tobeol .tb-matrix th,#pane-tobeol .tb-matrix td{padding:7px 10px;text-align:center;border-bottom:1px solid var(--border,#2a2e38)}
    #pane-tobeol .tb-matrix thead th{position:sticky;top:0;background:var(--surface-2,#1a1d24);font-size:11px;color:var(--text-3,#9aa3b2);font-weight:700}
    #pane-tobeol .tb-matrix .tb-name{text-align:left;font-weight:700}
    #pane-tobeol .tb-matrix .tb-job{text-align:left;color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-num{text-align:right;font-variant-numeric:tabular-nums}
    #pane-tobeol .tb-role{font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:var(--surface-3,#262a34)}
    #pane-tobeol .tb-role.deal{color:#ff9d78}#pane-tobeol .tb-role.buff{color:#7fbcff}
    #pane-tobeol .tb-cell{font-weight:700;font-size:11px}
    #pane-tobeol .tb-cell.solo{color:#5fd08a;background:color-mix(in oklab,#5fd08a 12%,transparent)}
    #pane-tobeol .tb-cell.bugyo{color:#e6b85f;background:color-mix(in oklab,#e6b85f 10%,transparent)}
    #pane-tobeol .tb-cell.over{color:#9a7676;font-size:10px}
    #pane-tobeol .tb-cell.lock{color:var(--text-4,#6b7280)}
    #pane-tobeol .tb-cell.lock small{display:block;font-size:9px;font-weight:600}
    #pane-tobeol .tb-cell.na{color:var(--text-4,#6b7280)}
    #pane-tobeol .tb-editor{margin-top:22px;background:var(--surface-2,#1a1d24);border:1px solid var(--border,#2a2e38);border-radius:12px;padding:6px 14px}
    #pane-tobeol .tb-editor summary{cursor:pointer;font-size:12px;font-weight:700;color:var(--text-2,#c7cdd8);padding:8px 0}
    #pane-tobeol .tb-edit-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(360px,2fr);gap:18px;align-items:start}
    @media (max-width:760px){#pane-tobeol .tb-edit-grid{grid-template-columns:1fr}}
    #pane-tobeol .tb-edit-table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
    #pane-tobeol .tb-edit-table th,#pane-tobeol .tb-edit-table td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--border,#2a2e38)}
    #pane-tobeol .tb-edit-table th{font-size:11px;color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-in{width:96px;background:var(--surface,#13151b);border:1px solid var(--border,#2a2e38);border-radius:7px;padding:4px 8px;color:var(--text-1,#e8ebf0);font-size:12px;text-align:right}
    #pane-tobeol .tb-in-wrap{display:inline-flex;align-items:center;gap:3px}
    #pane-tobeol .tb-unit{color:var(--text-3,#9aa3b2);font-size:11px;font-weight:700}
    #pane-tobeol .tb-live{display:inline-block;margin-left:6px;font-size:11px}
    #pane-tobeol .tb-edit-actions{display:flex;align-items:center;gap:10px;padding:8px 0 12px;flex-wrap:wrap}
    #pane-tobeol .tb-empty{text-align:center;padding:80px 20px;color:var(--text-2,#c7cdd8)}
    #pane-tobeol .tb-empty-ico{font-size:44px;margin-bottom:10px}
    `;
    const tag = document.createElement('style');
    tag.id = 'tb-style';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  return { render };
})();
