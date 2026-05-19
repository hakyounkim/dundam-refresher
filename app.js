// ════════════════════════════════════════════════════════════
//  DF Console — Live data app
// ════════════════════════════════════════════════════════════
(function(){
const A = window.API;
const STORAGE_KEY = 'df_console_state_v2';

// ── helpers ──
const fmt = n => (n == null || Number.isNaN(+n)) ? '-' : Number(n).toLocaleString('ko-KR');
const fmtShort = n => {
  if (n >= 1e8) return (n/1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n/1e4) + '만';
  return fmt(n);
};
const fmtTime = iso => {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
};
const fmtAgo = ts => {
  if (!ts) return '미동기화';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (mins < 1440) return `${Math.round(mins/60)}시간 전`;
  return `${Math.round(mins/1440)}일 전`;
};
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// 던담 포맷 문자열을 숫자로 파싱 ("2 조 7132 억" / "130,125" → number)
function parseDundamNum(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  const str = String(s).trim();
  if (!str) return null;
  if (/^[\d,.]+$/.test(str)) return Number(str.replace(/,/g, ''));
  let total = 0;
  const matches = str.match(/\d+\s*[조억만]/g) || [];
  matches.forEach(part => {
    const n = parseInt(part, 10);
    if (part.includes('조'))      total += n * 1e12;
    else if (part.includes('억')) total += n * 1e8;
    else if (part.includes('만')) total += n * 1e4;
  });
  return total || null;
}
// 비교 → 델타 문자열 + 클래스
function makeDelta(prev, cur) {
  const p = parseDundamNum(prev);
  const c = parseDundamNum(cur);
  if (p == null || c == null) return null;
  const d = c - p;
  if (d === 0) return { cls: 'same', text: '변동 없음' };
  const sign = d > 0 ? '+' : '';
  // 큰 숫자(억 이상)는 한국어 표기, 그 외는 콤마
  let txt;
  if (Math.abs(d) >= 1e8)      txt = sign + (d / 1e8).toFixed(1) + '억';
  else if (Math.abs(d) >= 1e4) txt = sign + Math.round(d / 1e4) + '만';
  else                          txt = sign + d.toLocaleString('ko-KR');
  return { cls: d > 0 ? 'up' : 'down', text: txt };
}

// 인챈트리스 buffScores 데모 — 백엔드 작업 완료 전까지 임시
// buffScore(2인 점수)를 기준으로 3인 ≈ 92%, 4인 ≈ 89% 비율로 추정
function applyEnchantressDemo(c) {
  if (!c.jobGrowName?.includes('인챈트리스')) return;
  if (c.buffScores) return; // 백엔드가 이미 보내면 건드리지 않음
  const base = parseDundamNum(c.buffScore);
  if (!base) return;
  c.buffScores = [
    c.buffScore,                                                  // 2인 (기준)
    Math.round(base * 0.918).toLocaleString('ko-KR'),              // 3인
    Math.round(base * 0.891).toLocaleString('ko-KR'),              // 4인
  ];
}

// Hue from string → 컬러 이니셜 fallback
function strHue(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h%360; }
function avatarHTML(c, variant) {
  // variant: 'head' = 행 뷰용 머리 확대, undefined = 기본 (전신, 카드용)
  const name = c.characterName || c.name || '?';
  const hue = strHue(name);
  const bg = `oklch(0.45 0.12 ${hue})`;
  const fg = `oklch(0.92 0.04 ${hue})`;
  const initial = name[0];
  const baseStyle = `background:transparent;color:${fg};width:100%;height:100%;display:grid;place-items:center;font-weight:800;position:relative;overflow:hidden`;
  const serverId = c.serverId || c.server;
  if (c.characterId && serverId) {
    const url = `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${c.characterId}?zoom=3`;
    // 행 뷰: 머리만 보이게 — 이미지 위쪽으로 끌어올리고 cover로 채움
    // 카드 뷰: 전신 contain
    const imgStyle = variant === 'head'
      ? 'position:absolute;left:-25%;top:-30%;width:150%;height:200%;object-fit:contain;object-position:center top'
      : 'position:absolute;left:-50%;top:calc(-50% - 20px);width:200%;height:200%;object-fit:contain;object-position:center';
    return `<span style="${baseStyle};color:transparent">${initial}<img src="${url}" alt="" style="${imgStyle}" onerror="this.parentElement.style.color='${fg}';this.parentElement.style.background='${bg}';this.remove()"></span>`;
  }
  return `<span style="${baseStyle};background:${bg}">${initial}</span>`;
}

// Slot label / order
const SLOT_LABEL = {
  SHOULDER:'머리어깨', JACKET:'상의', PANTS:'하의', WAIST:'벨트', SHOES:'신발',
  AMULET:'목걸이', WRIST:'팔찌', RING:'반지', EARRING:'귀걸이',
  MAGIC_STONE:'마법석', MAGIC_STON:'마법석', // API typo workaround
  SUPPORT:'보조장비', WEAPON:'무기', TITLE:'칭호',
};
const SLOT_EMOJI = {
  SHOULDER:'🪖', JACKET:'👕', PANTS:'👖', WAIST:'🎗', SHOES:'👟',
  AMULET:'📿', WRIST:'⌚', RING:'💍', EARRING:'🎧',
  MAGIC_STONE:'✨', MAGIC_STON:'✨', SUPPORT:'🎐', WEAPON:'⚔', TITLE:'🎖',
};
const MATRIX_SLOTS = ['SHOULDER','JACKET','PANTS','WAIST','SHOES','AMULET','WRIST','RING','EARRING','MAGIC_STONE','SUPPORT','WEAPON','TITLE'];
function normSlotId(id) { return id === 'MAGIC_STON' ? 'MAGIC_STONE' : id; }
const rarityClass = A.rarityClass;

// 단계 색상 키 → CSS rarity class (setEval.activeTier.tier prefix용)
function tierToRarityClass(tier) {
  switch (A.tierColorKey(tier)) {
    case 'taecho':    return 'r-taecho';
    case 'epic':      return 'r-epic';
    case 'legendary': return 'r-legendary';
    case 'unique':    return 'r-unique';
    case 'rare':      return 'r-rare';
    default: return '';
  }
}

// ── App state ──
const state = {
  tab: 'refresh',
  viewMode: 'grid',           // 'grid' | 'row'
  adventureName: null,
  adventureServers: [],
  characters: [],         // [{characterId, serverId, characterName, jobGrowName, fame, ...}]
  details: {},            // {characterId: detail|loading|error}
  selectedIds: new Set(),
  modalChar: null,
  modalTab: 'summary',
  historySub: 'gear',
  pactCat: 'all',
  pactRarity: 'all',
  pactSearch: '',
  gearRarity: 'all',
  events: null,
  lastSyncAt: null,
  loadingAdventure: false,
};

// Restore from localStorage
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      adventureName: state.adventureName,
      characters: state.characters,
      lastSyncAt: state.lastSyncAt,
      viewMode: state.viewMode,
    }));
  } catch {}
}
function restoreState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (s.adventureName) {
      state.adventureName = s.adventureName;
      state.characters = s.characters || [];
      state.characters.forEach(applyEnchantressDemo);
      state.lastSyncAt = s.lastSyncAt || null;
      $('#advName').value = s.adventureName;
    }
    if (s.viewMode) state.viewMode = s.viewMode;
  } catch {}
}

// ════════════════════════════════════════════════════════════
//  Tab switching
// ════════════════════════════════════════════════════════════
function switchTab(t) {
  state.tab = t;
  ['refresh','history','soul'].forEach(name => {
    $('#pane-' + name).style.display = name === t ? '' : 'none';
    const btn = document.querySelector(`.nav-btn[data-tab="${name}"]`);
    if (btn) btn.classList.toggle('active', name === t);
  });
  const titles = { refresh:'일괄 갱신기', history:'드랍 기록', soul:'계시 환산기' };
  $('#pageCrumb').textContent = titles[t];
  if (t === 'history') {
    loadEvents().then(() => {
      if (state.historySub === 'gear') renderGearMatrix();
      else renderPactTable();
    });
  }
  if (t === 'soul') loadSoul();
}
$$('.nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// ════════════════════════════════════════════════════════════
//  REFRESHER — search + load + render
// ════════════════════════════════════════════════════════════
// ── 최근 검색 모험단 (최대 5개, localStorage) ──
const RECENTS_KEY = 'df_console_recents_v1';
function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); }
  catch { return []; }
}
function pushRecent(name) {
  if (!name) return;
  const list = getRecents().filter(n => n !== name);
  list.unshift(name);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 6)));
  renderRecents();
}
function removeRecent(name) {
  const list = getRecents().filter(n => n !== name);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  renderRecents();
}
function renderRecents() {
  const wrap = $('#recentRow');
  const list = getRecents();
  if (!list.length) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  wrap.innerHTML = `<span class="recent-label">최근</span>` +
    list.map(n => `
      <button class="recent-chip" data-name="${n}" title="${n} 검색">
        <span class="recent-chip-name">${n}</span>
        <span class="recent-chip-x" data-action="rm" title="삭제">✕</span>
      </button>
    `).join('');
  wrap.querySelectorAll('.recent-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      const name = chip.dataset.name;
      if (e.target.closest('[data-action="rm"]')) {
        e.stopPropagation();
        removeRecent(name);
      } else {
        $('#advName').value = name;
        doSearch();
      }
    });
  });
}

async function doSearch() {
  const name = $('#advName').value.trim();
  if (!name) { alert('모험단명을 입력하세요'); return; }
  if (state.loadingAdventure) return;
  state.loadingAdventure = true;
  $('#searchBtn').disabled = true;
  $('#searchBtn').textContent = '검색 중…';
  try {
    const res = await A.registerAdventure(name);
    state.adventureName = res.adventureName;
    state.adventureServers = res.servers || [];
    state.characters = (res.characters || []).map(c => ({ ...c, refreshed: false, prevFame: c.fame }));
    // TODO 백엔드: 인챈트리스 buffScores 정식 지원 전까지 데모 값 주입 (백엔드 배포 후 이 블록 제거)
    state.characters.forEach(applyEnchantressDemo);
    state.details = {};
    state.lastSyncAt = Date.now();
    saveState();
    pushRecent(state.adventureName);
    renderAdvTag();
    renderRefreshStats();
    renderCharCards();
    // 캐릭별 상세 비동기로 일괄 로드 (병렬)
    loadAllDetails();
  } catch (e) {
    alert('검색 실패: ' + e.message);
  } finally {
    state.loadingAdventure = false;
    $('#searchBtn').disabled = false;
    $('#searchBtn').textContent = '검색';
  }
}
$('#searchBtn').addEventListener('click', doSearch);
$('#advName').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

async function loadAllDetails() {
  const total = state.characters.length;
  if (!total) return;
  let loaded = 0;
  showLoadingHint(`캐릭터 상세 불러오는 중… 0/${total}`);
  const promises = state.characters.map(c =>
    loadCharDetail(c.characterId).finally(() => {
      loaded++;
      setLoadingHint(`캐릭터 상세 불러오는 중… ${loaded}/${total}`);
    })
  );
  await Promise.all(promises);
  hideLoadingHint();
}
function showLoadingHint(text) {
  const el = $('#loadingHint');
  if (!el) return;
  $('#loadingHintText').textContent = text;
  el.style.display = '';
}
function setLoadingHint(text) {
  const el = $('#loadingHintText');
  if (el) el.textContent = text;
}
function hideLoadingHint() {
  const el = $('#loadingHint');
  if (el) el.style.display = 'none';
}
async function loadCharDetail(characterId) {
  const c = state.characters.find(x => x.characterId === characterId);
  if (!c) return null;
  if (state.details[characterId]?.basic) return state.details[characterId]; // cached
  state.details[characterId] = { loading: true };
  // re-render card with loading state if visible
  patchCard(characterId);
  try {
    const detail = await A.characterDetail(c.serverId, c.characterId);
    state.details[characterId] = detail;
    patchCard(characterId);
    return detail;
  } catch (e) {
    state.details[characterId] = { error: e.message };
    patchCard(characterId);
    return null;
  }
}

// ── Stats strip ──
function renderRefreshStats() {
  const wrap = $('#refreshStats');
  if (!state.adventureName) { wrap.innerHTML = ''; return; }
  const chars = state.characters;
  const updated = chars.filter(c => c.refreshed).length;
  const stale = chars.length - updated;
  const top = [...chars].sort((a,b) => (b.fame||0) - (a.fame||0))[0];
  const svKr = state.adventureServers.map(s => A.SERVER_KR[s] || s).join(', ');
  wrap.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">모험단 캐릭터 수</span>
      <span class="kpi-value num">${chars.length}</span>
      <span class="kpi-foot">${state.adventureName} · ${svKr}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">최고 명성</span>
      <span class="kpi-value num accent">${fmt(top?.fame)}</span>
      <span class="kpi-foot">${top?.characterName || '-'}${top?.jobGrowName ? ' · ' + top.jobGrowName : ''}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">최근 동기화</span>
      <span class="kpi-value num" style="font-size:22px">${fmtAgo(state.lastSyncAt)}</span>
      <span class="kpi-foot">${state.lastSyncAt ? fmtTime(new Date(state.lastSyncAt).toISOString()) + ' 기준' : '검색을 실행해주세요'}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">갱신 필요</span>
      <span class="kpi-value num">${stale}<span style="font-size:14px;color:var(--text-3);font-weight:500"> / ${chars.length}</span></span>
      <span class="kpi-foot">${updated > 0 ? `${updated}명 갱신 완료` : '아직 갱신 안 함'}</span>
    </div>
  `;
}

function renderAdvTag() {
  if (state.adventureName) {
    $('#advTag').style.display = '';
    $('#advTagName').textContent = state.adventureName;
    const svKr = state.adventureServers.map(s => A.SERVER_KR[s] || s).join(', ');
    $('#advTagServer').textContent = svKr;
  } else {
    $('#advTag').style.display = 'none';
  }
}

// ── Char card/row grid ──
function renderCharCards() {
  if (state.viewMode === 'row') return renderCharRows();
  $('#charGrid').style.display = '';
  $('#charRows').style.display = 'none';
  const wrap = $('#charGrid');
  if (!state.characters.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg class="ico lg empty-ico" style="width:36px;height:36px"><use href="#i-search"/></svg>
        <div class="empty-state-title">모험단을 검색해주세요</div>
        <div class="empty-state-sub">검색하면 캐릭터 카드들이 여기 표시돼요</div>
      </div>
    `;
    return;
  }
  wrap.innerHTML = state.characters.map(c => cardHTML(c)).join('');
  // bind clicks — 카드 자체 = 체크 토글 (default), 디테일 버튼만 모달 오픈
  wrap.querySelectorAll('.char-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', e => {
      if (e.target.closest('[data-action="detail"]')) {
        openModal(c => c.characterId === id);
      } else {
        toggleSelect(id);
      }
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(id); }
    });
  });
  updateSelCount();
}

function renderCharRows() {
  $('#charGrid').style.display = 'none';
  $('#charRows').style.display = '';
  const wrap = $('#charRows');
  if (!state.characters.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">모험단을 검색해주세요</div>
      </div>
    `;
    return;
  }
  // header
  let html = `<div class="char-rows-table" role="table">`;
  html += `<div class="char-row head" role="row">
    <div class="cell ck"></div>
    <div class="cell name">이름 / 직업</div>
    <div class="cell fame">명성</div>
    <div class="cell primary">딜 / 버프</div>
    <div class="cell set">세트</div>
    <div class="cell oath">서약</div>
    <div class="cell actions"></div>
  </div>`;
  state.characters.forEach(c => { html += rowHTML(c); });
  html += `</div>`;
  wrap.innerHTML = html;

  wrap.querySelectorAll('.char-row[data-id]').forEach(row => {
    const id = row.dataset.id;
    row.addEventListener('click', e => {
      if (e.target.closest('[data-action="detail"]')) {
        openModal(c => c.characterId === id);
      } else {
        toggleSelect(id);
      }
    });
  });
  updateSelCount();
}

// 행 한줄 (테이블 row 형식)
function rowHTML(c) {
  const selected = state.selectedIds.has(c.characterId);
  const detail = state.details[c.characterId];
  const loaded  = detail && !detail.loading && !detail.error && detail.basic;
  const loading = detail?.loading;

  const ozma = c.ozma, buffScore = c.buffScore;
  const buffScores = Array.isArray(c.buffScores) && c.buffScores.length === 3 ? c.buffScores : null;
  let set = null, setEval = null, oath = null;
  let isBuff = buffScore != null;
  if (loaded) {
    set = A.getEquippedSet(detail);
    setEval = A.getSetEval(detail);
    oath = A.getOath(detail);
    isBuff = isBuff || A.isBuffChar(detail);
  }

  // 메인 숫자: 버퍼=버프점수 / 딜러=딜 / 둘 다 없으면 명성
  // 인챈트리스(buffScores 3개)는 슬래시로 합쳐 표시
  const primaryVal = isBuff
    ? (buffScores ? buffScores.join(' / ') : buffScore)
    : ozma;
  const primaryLbl = isBuff ? (buffScores ? '2/3/4인' : '버프') : '딜';
  const primaryPrev = isBuff ? c.prevBuffScore : c.prevOzma;
  const primaryDelta = c.refreshed ? makeDelta(primaryPrev, primaryVal) : null;
  const fameDelta = c.refreshed ? makeDelta(c.prevFame, c.fame) : null;

  // 세트 셀 — 던담 세트 아이콘 (글씨 없이 아이콘만)
  const tierLabel = setEval?.activeTier?.label;
  const tierCls = tierToRarityClass(setEval?.activeTier?.tier);
  const setIconUrl = set ? A.getDundamSetIconUrl(set.name) : null;
  const setEmblem = !set ? '' : (setIconUrl
    ? `<img class="cc-set-icon" src="${setIconUrl}" alt="" title="${set.name}" onerror="this.outerHTML='<span class=\\'cc-set-emblem ${tierCls}\\' title=&quot;${set.name}&quot;><svg viewBox=&quot;0 0 24 24&quot; fill=&quot;currentColor&quot;><path d=&quot;M12 2 22 12 12 22 2 12z&quot;/></svg></span>'">`
    : `<span class="cc-set-emblem ${tierCls}" title="${set.name}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>
       </span>`);
  const setCell = !loaded
    ? `<span class="muted">${loading ? '로딩…' : '—'}</span>`
    : (set
      ? `${setEmblem}${tierLabel ? `<span class="badge ${tierCls}">${tierLabel}</span>` : ''}${setEval?.current > 0 ? `<span class="r-pt">${fmt(setEval.current)}</span>` : ''}`
      : `<span class="muted">없음</span>`);

  // 서약 셀
  let oathCell;
  if (!loaded) {
    oathCell = `<span class="muted">${loading ? '로딩…' : '—'}</span>`;
  } else if (oath?.info) {
    const rawName = oath.setInfo?.setOptionName || oath.info.itemName;
    const displayName = rawName.replace(/^[^:]+\s*:\s*/, '');
    const setRarity = oath.setInfo?.setRarityName;
    const sp = oath.setInfo?.active?.setPoint;
    const active = sp && sp.current >= sp.min;
    const oathIconUrl = A.getDundamSetIconUrl(rawName);
    const oathEmblem = oathIconUrl
      ? `<img class="cc-set-icon" src="${oathIconUrl}" alt="" title="${displayName}${oath.setInfo?.setName ? ` / ${oath.setInfo.setName}` : ''}" onerror="this.outerHTML='<span class=\\'cc-set-emblem ${rarityClass(setRarity)}\\' title=&quot;${displayName}&quot;><svg viewBox=&quot;0 0 24 24&quot; fill=&quot;currentColor&quot;><circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;9&quot;/></svg></span>'">`
      : `<span class="cc-set-emblem ${rarityClass(setRarity)}" title="${displayName}${oath.setInfo?.setName ? ` / ${oath.setInfo.setName}` : ''}" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
         </span>`;
    const inactiveBadge = (!active && sp) ? `<span class="badge" style="color:var(--warn);border-color:oklch(from var(--warn) l c h / 0.4);background:oklch(from var(--warn) l c h / 0.1);font-size:9px">미달성 ${sp.min - sp.current}</span>` : '';
    oathCell = `${oathEmblem}${setRarity ? `<span class="badge ${rarityClass(setRarity)}">${setRarity}</span>` : ''}${inactiveBadge}${sp ? `<span class="r-pt">${fmt(sp.current)}</span>` : ''}`;
  } else {
    oathCell = `<span class="muted">없음</span>`;
  }

  return `
    <div class="char-row ${selected ? 'selected' : ''}" data-id="${c.characterId}" role="row">
      <div class="cell ck"><div class="cc-checkbox"></div></div>
      <div class="cell name">
        <div class="row-avatar">${avatarHTML(c, 'head')}</div>
        <div class="row-name-block">
          <div class="rn-line"><span class="rn-name">${c.characterName}</span>${isBuff ? '<span class="cc-buff-tag">버퍼</span>' : ''}</div>
          <div class="rn-job">${c.jobGrowName || '-'}</div>
        </div>
      </div>
      <div class="cell fame">
        <span class="row-num">${fmt(c.fame)}</span>
        ${fameDelta && fameDelta.cls !== 'same' ? `<span class="cc-fame-delta sm ${fameDelta.cls}">${fameDelta.text}</span>` : ''}
      </div>
      <div class="cell primary">
        <span class="row-primary-num ${primaryVal == null ? 'muted' : ''}">${primaryVal ?? '—'}</span>
        ${primaryDelta ? `<span class="cc-fame-delta ${primaryDelta.cls}">${primaryDelta.text}</span>` : ''}
        ${c.refreshed && primaryPrev != null && parseDundamNum(primaryPrev) !== parseDundamNum(primaryVal) ? `<span class="row-prev">이전 ${primaryPrev}</span>` : ''}
      </div>
      <div class="cell set">${setCell}</div>
      <div class="cell oath">${oathCell}</div>
      <div class="cell actions">
        <button class="cc-detail-btn" data-action="detail" title="상세 보기">
          <svg class="ico sm"><use href="#i-eye"/></svg>
          <span>상세</span>
        </button>
      </div>
    </div>
  `;
}

function cardHTML(c) {
  const selected = state.selectedIds.has(c.characterId);
  const detail = state.details[c.characterId];
  const loaded  = detail && !detail.loading && !detail.error && detail.basic;
  const loading = detail?.loading;
  const errored = detail?.error;

  // 던담 라이브값
  const ozma      = c.ozma;
  const buffScore = c.buffScore;
  // 인챈트리스 — 백엔드가 buffScores 배열로 보내면 2인/3인/4인 모두 표시
  const buffScores = Array.isArray(c.buffScores) && c.buffScores.length === 3 ? c.buffScores : null;

  // 백엔드 신규 필드
  let set = null, setEval = null, oath = null;
  let isBuff = buffScore != null;
  if (loaded) {
    set     = A.getEquippedSet(detail);
    setEval = A.getSetEval(detail);
    oath    = A.getOath(detail);
    isBuff  = isBuff || A.isBuffChar(detail);
  }

  // 메인 숫자: 버퍼=버프점수 / 딜러=딜 / 둘 다 없으면 명성
  // 메인 숫자 — 인챈트리스(buffScores 3개)는 슬래시로 합쳐 표시
  const primaryVal   = isBuff
    ? (buffScores ? buffScores.join(' / ') : buffScore)
    : ozma;
  const primaryLbl   = isBuff ? (buffScores ? '2 · 3 · 4인' : '버프점수') : '딜';
  const primaryPrev  = isBuff ? c.prevBuffScore : c.prevOzma;
  const primaryDelta = c.refreshed ? makeDelta(primaryPrev, primaryVal) : null;

  // 명성 델타 (보조)
  const fameDelta = c.refreshed ? makeDelta(c.prevFame, c.fame) : null;

  // 세트 등급 = setEval.activeTier (백엔드 계산값)
  const tierLabel = setEval?.activeTier?.label;
  const tierCls   = tierToRarityClass(setEval?.activeTier?.tier);
  const tierBadge = tierLabel
    ? `<span class="badge ${tierCls}" style="white-space:nowrap;flex-shrink:0">${tierLabel}</span>`
    : '';
  const setPointBadge = setEval?.current > 0
    ? `<span class="cc-set-point num" title="장비 세트포인트 총합 (활성 단계: ${tierLabel || '미달'})">${fmt(setEval.current)}</span>`
    : '';

  // 세트 아이콘 — 던담의 세트별 전용 아이콘 (12종)
  const setIconUrl = set ? A.getDundamSetIconUrl(set.name) : null;
  const setIcon = setIconUrl
    ? `<img class="cc-set-icon" src="${setIconUrl}" alt="" title="${set.name}" onerror="this.outerHTML='<span class=\\'cc-set-emblem ${tierCls}\\' aria-hidden=true><svg viewBox=&quot;0 0 24 24&quot; fill=&quot;currentColor&quot;><path d=&quot;M12 2 22 12 12 22 2 12z&quot;/></svg></span>'">`
    : (set
        ? `<span class="cc-set-emblem ${tierCls}" title="${set.name}" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>
           </span>`
        : '');

  const setRow = !loaded
    ? `<span class="cc-set-name" style="color:var(--text-4)">${loading ? '로딩 중…' : errored ? '조회 실패' : '—'}</span>`
    : (set
        ? `${setIcon}<span class="cc-set-name" title="${set.name}">${set.name}</span>${tierBadge}${setPointBadge}`
        : '<span class="cc-set-name" style="color:var(--text-4)">세트 없음</span>');

  // 서약 — 세트 row와 동일한 패턴 + 아이콘
  let pactBlock;
  if (!loaded) {
    pactBlock = `<span class="cc-set-name" style="color:var(--text-4)">${loading ? '로딩 중…' : '—'}</span>`;
  } else if (oath?.info) {
    // 서약 표시 이름 = setOptionName (의미 있는 효과명), fallback으로 itemName
    // "황금 : 숭배하라, 세상의 왕을" → "숭배하라, 세상의 왕을" (prefix 제거)
    const rawName = oath.setInfo?.setOptionName || oath.info.itemName || '서약';
    const displayName = rawName.replace(/^[^:]+\s*:\s*/, '');
    const setName = oath.setInfo?.setName;
    const setRarity = oath.setInfo?.setRarityName;
    const sp = oath.setInfo?.active?.setPoint;
    const active = sp && sp.current >= sp.min;
    const oathIconUrl = A.getDundamSetIconUrl(rawName);
    const oathIcon = oathIconUrl
      ? `<img class="cc-set-icon" src="${oathIconUrl}" alt="" title="${displayName}" onerror="this.outerHTML='<span class=\\'cc-set-emblem ${rarityClass(setRarity)}\\' title=&quot;${displayName}&quot;><svg viewBox=&quot;0 0 24 24&quot; fill=&quot;currentColor&quot;><circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;9&quot;/></svg></span>'">`
      : `<span class="cc-set-emblem ${rarityClass(setRarity)}" title="${displayName}" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
         </span>`;
    const rarityBadge = setRarity
      ? `<span class="badge ${rarityClass(setRarity)}" style="white-space:nowrap;flex-shrink:0">${setRarity}</span>`
      : '';
    const pointBadge = sp
      ? `<span class="cc-set-point" title="서약 세트포인트 (활성: ${active ? setRarity : '미달성'}, 임계 ${sp.min})">${fmt(sp.current)}</span>`
      : '';
    const inactiveBadge = (!active && sp)
      ? `<span class="badge" style="white-space:nowrap;flex-shrink:0;font-size:9px;color:var(--warn);border-color:oklch(from var(--warn) l c h / 0.4);background:oklch(from var(--warn) l c h / 0.1)">미달성 ${sp.min - sp.current}</span>`
      : '';
    pactBlock = `${oathIcon}<span class="cc-set-name" title="${displayName}${setName ? ` / ${setName}` : ''}">${displayName}</span>${rarityBadge}${inactiveBadge}${pointBadge}`;
  } else {
    pactBlock = `<span class="cc-set-name" style="color:var(--text-4)">서약 없음</span>`;
  }

  return `
    <div class="char-card ${selected ? 'selected' : ''}" data-id="${c.characterId}" role="button" tabindex="0">
      <div class="cc-checkbox" data-action="select"></div>
      <div class="cc-status"></div>
      <div class="cc-avatar">${avatarHTML(c)}</div>
      <div class="cc-right">
        <div class="cc-info">
          <button class="cc-detail-btn" data-action="detail" title="상세 보기" aria-label="상세 보기">
            <svg class="ico sm"><use href="#i-eye"/></svg>
            <span>상세</span>
          </button>
          <div class="cc-header-row">
            <div class="cc-id">
              <div class="cc-name">
                <span>${c.characterName}</span>
                ${isBuff ? '<span class="cc-buff-tag">버퍼</span>' : ''}
              </div>
              <div class="cc-meta">
                <span>${c.jobGrowName || '-'}</span>
              </div>
            </div>
            <div class="cc-fame-corner">
              <span class="cc-fame-corner-lbl">명성</span>
              <span class="cc-fame-corner-num">${fmt(c.fame)}</span>
              ${fameDelta && fameDelta.cls !== 'same' ? `<span class="cc-fame-delta sm ${fameDelta.cls}">${fameDelta.text}</span>` : ''}
            </div>
          </div>
          <div class="cc-primary-row">
            <span class="cc-primary-num ${primaryVal == null ? 'empty' : ''}">${primaryVal ?? '—'}</span>
            ${primaryDelta ? `<span class="cc-fame-delta inline ${primaryDelta.cls}">${primaryDelta.text}</span>` : ''}
          </div>
          ${c.refreshed && primaryPrev != null && parseDundamNum(primaryPrev) !== parseDundamNum(primaryVal) ? `
            <div class="cc-prev-row">
              <span class="cc-prev-lbl">이전</span>
              <span class="cc-prev-val">${primaryPrev}</span>
            </div>
          ` : ''}
        </div>
        <div class="cc-loadout">
          <div class="cc-loadout-row">
            <span class="cc-loadout-label">세트</span>
            <div class="cc-loadout-body">${setRow}</div>
          </div>
          <div class="cc-loadout-row">
            <span class="cc-loadout-label">서약</span>
            <div class="cc-loadout-body">${pactBlock}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function patchCard(characterId) {
  // 행 뷰면 행 전체를 다시 그리는 게 빠름 (간단함)
  if (state.viewMode === 'row') {
    return renderCharRows();
  }
  const c = state.characters.find(x => x.characterId === characterId);
  if (!c) return;
  const oldCard = document.querySelector(`.char-card[data-id="${characterId}"]`);
  if (!oldCard) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = cardHTML(c);
  const newCard = tmp.firstElementChild;
  // preserve any inline status from in-flight refresh
  const oldStatus = oldCard.querySelector('.cc-status')?.innerHTML;
  const wasLoadingCls = oldCard.classList.contains('loading');
  const wasDoneCls = oldCard.classList.contains('done');
  const wasErrCls = oldCard.classList.contains('error');
  oldCard.replaceWith(newCard);
  if (oldStatus) newCard.querySelector('.cc-status').innerHTML = oldStatus;
  if (wasLoadingCls) newCard.classList.add('loading');
  if (wasDoneCls)    newCard.classList.add('done');
  if (wasErrCls)     newCard.classList.add('error');
  // rebind
  newCard.addEventListener('click', e => {
    if (e.target.closest('[data-action="detail"]')) {
      openModal(x => x.characterId === characterId);
    } else {
      toggleSelect(characterId);
    }
  });
  newCard.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(characterId); }
  });
}

function toggleSelect(id) {
  if (state.selectedIds.has(id)) state.selectedIds.delete(id);
  else state.selectedIds.add(id);
  patchCard(id);
  updateSelCount();
}
function updateSelCount() {
  $('#selCount').textContent = `${state.selectedIds.size} / ${state.characters.length} 선택`;
}
$('#selectAllBtn').addEventListener('click', () => {
  state.selectedIds = new Set(state.characters.map(c => c.characterId));
  state.characters.forEach(c => patchCard(c.characterId));
  updateSelCount();
});
$('#selectNoneBtn').addEventListener('click', () => {
  state.selectedIds.clear();
  state.characters.forEach(c => patchCard(c.characterId));
  updateSelCount();
});

// ── Refresh (던담 갱신 호출) ──
// 동시성 3 워커풀로 병렬화 + 루프 안의 character-detail 재조회 생략 (마지막 register로 일괄 갱신).
const REFRESH_CONCURRENCY = 3;

$('#refreshGoBtn').addEventListener('click', async () => {
  if (!state.characters.length) { alert('먼저 모험단을 검색해주세요'); return; }
  if (!state.selectedIds.size) {
    state.selectedIds = new Set(state.characters.map(c => c.characterId));
    state.characters.forEach(c => patchCard(c.characterId));
  }
  const ids = Array.from(state.selectedIds);
  const fill = $('#progFill');
  $('#logPanel').style.display = '';
  logLine('info', `${ids.length}명 갱신 시작 (동시성 ${REFRESH_CONCURRENCY})…`);
  const btn = $('#refreshGoBtn');
  const origBtnHTML = btn.innerHTML;
  btn.disabled = true;
  showLoadingHint(`갱신 중… 0/${ids.length}`);
  btn.innerHTML = `<svg class="ico sm spin"><use href="#i-refresh"/></svg><span>갱신 중… 0/${ids.length}</span>`;

  // prevFame 기억해두기 (마지막 register 후 델타 계산용)
  ids.forEach(id => {
    const c = state.characters.find(x => x.characterId === id);
    if (c) c.prevFame = c.fame;
  });

  let completed = 0;
  async function refreshOne(id) {
    const c = state.characters.find(x => x.characterId === id);
    if (!c) return;
    const card = document.querySelector(`.char-card[data-id="${id}"]`);
    const status = card?.querySelector('.cc-status');
    if (card) {
      card.classList.remove('done','error');
      card.classList.add('loading');
    }
    if (status) status.innerHTML = '<svg class="ico spin"><use href="#i-refresh"/></svg>';
    try {
      await A.refresh(c.serverId, c.characterId);
      c.refreshed = true;
      const after = document.querySelector(`.char-card[data-id="${id}"]`);
      if (after) {
        after.classList.remove('loading');
        after.classList.add('done');
        after.querySelector('.cc-status').innerHTML = '<svg class="ico ok"><use href="#i-check"/></svg>';
      }
      logLine('ok', `${c.characterName}: 던담 갱신 완료`);
    } catch (e) {
      if (card) { card.classList.remove('loading'); card.classList.add('error'); }
      if (status) status.innerHTML = '<svg class="ico err"><use href="#i-alert"/></svg>';
      logLine('err', `${c.characterName}: ${e.message}`);
    }
    completed++;
    fill.style.width = (completed / ids.length * 100) + '%';
    setLoadingHint(`갱신 중… ${completed}/${ids.length}`);
    btn.innerHTML = `<svg class="ico sm spin"><use href="#i-refresh"/></svg><span>갱신 중… ${completed}/${ids.length}</span>`;
  }

  // 워커 풀: 큐에서 하나씩 빼서 처리, REFRESH_CONCURRENCY개가 동시에 돌아감
  const queue = ids.slice();
  const workers = Array.from({ length: REFRESH_CONCURRENCY }, async () => {
    while (queue.length) {
      const id = queue.shift();
      if (id) await refreshOne(id);
    }
  });
  await Promise.all(workers);

  logLine('ok', '갱신 루프 완료');
  state.lastSyncAt = Date.now();

  // 모험단 재집계 — fame/ozma/buffScore 일괄 갱신
  setLoadingHint('던담 모험단 재집계 중…');
  btn.innerHTML = `<svg class="ico sm spin"><use href="#i-refresh"/></svg><span>모험단 재집계 중…</span>`;
  try {
    const res = await A.registerAdventure(state.adventureName);
    const newMap = Object.fromEntries((res.characters || []).map(x => [x.characterId, x]));
    state.characters = state.characters.map(c => {
      const fresh = newMap[c.characterId];
      if (!fresh) return c;
      const updated = {
        ...c,
        prevOzma: c.ozma,
        prevBuffScore: c.buffScore,
        ozma: fresh.ozma,
        buffScore: fresh.buffScore,
        cri: fresh.cri,
        setPoint: fresh.setPoint,
        fame: fresh.fame ?? c.fame,
      };
      applyEnchantressDemo(updated);
      return updated;
    });
    // 갱신된 캐릭별 명성 델타 로그
    state.characters.forEach(c => {
      if (!c.refreshed) return;
      const gain = (c.fame || 0) - (c.prevFame || 0);
      if (gain !== 0) logLine(gain > 0 ? 'ok' : 'info', `${c.characterName}: ${gain > 0 ? '+' : ''}${fmt(gain)} 명성`);
    });
    state.characters.forEach(c => patchCard(c.characterId));
  } catch (e) {
    logLine('err', '던담 라이브값 재조회 실패: ' + e.message);
  }

  // 세트/서약 등 상세는 백그라운드로 한꺼번에 (await 안 함 → UI는 바로 자유)
  state.details = {};
  state.characters.forEach(c => patchCard(c.characterId));
  loadAllDetails().catch(e => logLine('err', '상세 재조회 실패: ' + e.message));

  saveState();
  renderRefreshStats();
  setTimeout(() => { fill.style.width = '0%'; }, 800);
  hideLoadingHint();
  btn.innerHTML = origBtnHTML;
  btn.disabled = false;
});

function logLine(level, msg) {
  const t = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  $('#logBody').insertAdjacentHTML('beforeend', `<div class="log-line ${level}"><span class="t">${t}</span><span>${msg}</span></div>`);
  $('#logPanel').scrollTop = $('#logPanel').scrollHeight;
}

// ════════════════════════════════════════════════════════════
//  HISTORY tab
// ════════════════════════════════════════════════════════════
async function loadEvents() {
  if (!state.adventureName) return;
  if (state.events) return; // cached for session
  try {
    const res = await A.events({ adventureName: state.adventureName });
    state.events = res.rows || [];
    renderHistoryStats();
  } catch (e) {
    console.error(e);
  }
}

function renderHistoryStats() {
  const wrap = $('#historyStats');
  if (!state.events) { wrap.innerHTML = ''; return; }
  const events = state.events;
  const taechoCount = events.filter(e => e.item_rarity === '태초').length;
  const epicCount = events.filter(e => e.item_rarity === '에픽').length;
  const last7 = events.filter(e => (Date.now() - new Date(e.occurred_at)) < 7*86400000).length;
  const tally = {};
  events.forEach(e => tally[e.character_name] = (tally[e.character_name]||0)+1);
  const topChar = Object.entries(tally).sort((a,b)=>b[1]-a[1])[0] || ['-', 0];
  wrap.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">총 드랍</span>
      <span class="kpi-value num">${events.length}</span>
      <span class="kpi-foot">DB에 적재된 누적</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">태초</span>
      <span class="kpi-value num" style="color:var(--r-taecho)">${taechoCount}</span>
      <span class="kpi-foot">${events.length ? Math.round(taechoCount/events.length*100) : 0}% 비율</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">에픽</span>
      <span class="kpi-value num" style="color:var(--r-epic)">${epicCount}</span>
      <span class="kpi-foot">${events.length ? Math.round(epicCount/events.length*100) : 0}% 비율</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">최근 7일</span>
      <span class="kpi-value num accent">${last7}</span>
      <span class="kpi-foot">베스트 파머 · ${topChar[0]} (${topChar[1]}개)</span>
    </div>
  `;
}

function switchHistorySub(sub) {
  state.historySub = sub;
  $('#subpane-gear').style.display = sub === 'gear' ? '' : 'none';
  $('#subpane-pact').style.display = sub === 'pact' ? '' : 'none';
  $$('#historySub .seg').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  if (sub === 'gear') renderGearMatrix();
  if (sub === 'pact') renderPactTable();
}
$$('#historySub .seg').forEach(b => b.addEventListener('click', () => switchHistorySub(b.dataset.sub)));

// ── Gear matrix (live equipment) ──
function renderGearMatrix() {
  const wrap = $('#gearMatrix');
  const chars = state.characters;
  if (!chars.length) {
    wrap.innerHTML = '';
    wrap.parentElement.innerHTML = `<div class="empty-state"><div class="empty-state-title">모험단을 먼저 검색해주세요</div></div>`;
    return;
  }
  const cols = `200px repeat(${chars.length}, minmax(120px, 1fr)) 110px`;
  wrap.style.gridTemplateColumns = cols;

  let html = '';
  html += `<div class="matrix-cell head corner"></div>`;
  chars.forEach(c => {
    html += `<div class="matrix-cell head">
      <div class="head-char">
        <div class="avatar sm">${avatarHTML(c)}</div>
        <span class="head-name">${c.characterName}</span>
        <span class="head-job">${c.jobGrowName || ''}</span>
      </div>
    </div>`;
  });
  html += `<div class="matrix-cell head" style="text-align:center"><div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="color:var(--text-2)">통계</span><span style="font-size:9px;color:var(--text-4)">태초 / 에픽</span></div></div>`;

  MATRIX_SLOTS.forEach(slot => {
    html += `<div class="matrix-cell row-label">
      <div class="row-ico">${SLOT_EMOJI[slot] || '·'}</div>
      <span>${SLOT_LABEL[slot] || slot}</span>
    </div>`;
    let taechos = 0, epics = 0;
    chars.forEach(c => {
      const detail = state.details[c.characterId];
      const eq = detail?.equipment;
      const item = Array.isArray(eq) ? eq.find(e => normSlotId(e.slotId) === slot) : null;
      if (!item) {
        html += `<div class="matrix-cell gear-cell empty">
          <div class="gear-icon">·</div>
          <div class="gear-info"><div class="gear-name" style="color:var(--text-4)">${detail?.loading ? '로딩…' : '미장착'}</div></div>
        </div>`;
        return;
      }
      const rCls = rarityClass(item.itemRarity);
      if (item.itemRarity === '태초') taechos++;
      if (item.itemRarity === '에픽') epics++;
      const visible = state.gearRarity === 'all'
        || (state.gearRarity === 'taecho' && item.itemRarity === '태초')
        || (state.gearRarity === 'epic' && item.itemRarity === '에픽');
      const dimStyle = visible ? '' : 'opacity:0.25;filter:saturate(0.3)';
      const rein = item.reinforce ? `<span class="gear-rein">+${item.reinforce}</span>` : '';
      const amp = item.amplificationName ? `<span>${item.amplificationName}</span>` : '';
      const img = item.itemId
        ? `<img src="https://img-api.neople.co.kr/df/items/${encodeURIComponent(item.itemId)}" alt="" onerror="this.remove()">`
        : (SLOT_EMOJI[slot] || '·');
      html += `<div class="matrix-cell gear-cell ${rCls}" style="${dimStyle}" data-char="${c.characterId}">
        <div class="gear-icon">${img}</div>
        <div class="gear-info">
          <div class="gear-name">${item.itemName}</div>
          <div class="gear-meta">${rein}${rein && amp ? '<span style="color:var(--text-4)">·</span>' : ''}${amp}</div>
        </div>
      </div>`;
    });
    html += `<div class="matrix-cell aggregate">
      <div class="agg-row"><span class="agg-dot taecho"></span><span class="agg-count">${taechos}</span><span class="agg-pct">${chars.length ? Math.round(taechos/chars.length*100) : 0}%</span></div>
      <div class="agg-row"><span class="agg-dot epic"></span><span class="agg-count">${epics}</span><span class="agg-pct">${chars.length ? Math.round(epics/chars.length*100) : 0}%</span></div>
    </div>`;
  });
  wrap.innerHTML = html;

  wrap.querySelectorAll('.gear-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const charId = cell.dataset.char;
      if (charId) {
        state.modalTab = 'gear';
        openModal(c => c.characterId === charId);
      }
    });
  });
}
$$('[data-gear-rarity]').forEach(b => b.addEventListener('click', () => {
  state.gearRarity = b.dataset.gearRarity;
  $$('[data-gear-rarity]').forEach(x => x.classList.toggle('active', x === b));
  renderGearMatrix();
}));

// ── Pact table ──
function renderPactTable() {
  const wrap = $('#pactTableBody');
  if (!state.events) {
    wrap.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-title">로딩 중…</div></div></td></tr>`;
    return;
  }
  const q = state.pactSearch.toLowerCase();
  const rows = state.events.filter(e => {
    if (state.pactCat !== 'all' && e.item_category !== state.pactCat) return false;
    if (state.pactRarity !== 'all' && e.item_rarity !== state.pactRarity) return false;
    if (q && !(e.item_name.toLowerCase().includes(q)
            || e.character_name.toLowerCase().includes(q)
            || (e.dungeon_name||'').toLowerCase().includes(q))) return false;
    return true;
  });
  const PATH_LABEL = {550:'드랍', 551:'레이드', 552:'항아리', 554:'제작', 557:'카드'};
  wrap.innerHTML = rows.map(r => {
    const cat = r.item_category === 'soul'
      ? `<span class="badge" style="color:var(--info);border-color:oklch(from var(--info) l c h / 0.4);background:oklch(from var(--info) l c h / 0.1)">결정</span>`
      : `<span class="badge" style="color:var(--r-unique);border-color:oklch(from var(--r-unique) l c h / 0.4);background:oklch(from var(--r-unique) l c h / 0.1)">서약</span>`;
    const rCls = r.item_rarity === '태초' ? 'r-taecho' : 'r-epic';
    const char = state.characters.find(c => c.characterId === r.character_id) || { characterName: r.character_name, serverId: r.server_id, characterId: r.character_id };
    return `
      <tr>
        <td class="col-time">${fmtTime(r.occurred_at)}</td>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar sm">${avatarHTML(char)}</div><span style="font-weight:600">${r.character_name}</span></div></td>
        <td><div style="display:flex;align-items:center;gap:6px">${cat}<span class="col-item ${rCls}">${r.item_name}</span></div></td>
        <td><span class="badge ${rCls}">${r.item_rarity}</span></td>
        <td><span class="path-tag">${PATH_LABEL[r.event_code] || ('code ' + r.event_code)}</span></td>
        <td class="col-channel">${r.channel_name ? `${r.channel_name}${r.channel_no ? '-' + r.channel_no : ''}` : '-'}</td>
        <td class="col-path">${r.dungeon_name || '-'}</td>
      </tr>
    `;
  }).join('') || `
    <tr><td colspan="7"><div class="empty-state">
      <div class="empty-state-title">조건에 맞는 내역이 없습니다</div>
      <div class="empty-state-sub">필터를 풀거나 다른 검색어를 시도해보세요</div>
    </div></td></tr>
  `;
}
$$('#pactCatSeg .seg').forEach(b => b.addEventListener('click', () => {
  state.pactCat = b.dataset.cat;
  $$('#pactCatSeg .seg').forEach(x => x.classList.toggle('active', x === b));
  renderPactTable();
}));
$$('#pactRaritySeg .seg').forEach(b => b.addEventListener('click', () => {
  state.pactRarity = b.dataset.rarity;
  $$('#pactRaritySeg .seg').forEach(x => x.classList.toggle('active', x === b));
  renderPactTable();
}));
$('#pactSearch').addEventListener('input', e => { state.pactSearch = e.target.value; renderPactTable(); });

// ════════════════════════════════════════════════════════════
//  SOUL tab
// ════════════════════════════════════════════════════════════
const SOUL_RARITY_COLOR = {
  rare:'#9ca3af', unique:'#fbbf24', legendary:'#fb923c',
  radiant:'#34d399', epic:'#c084fc', primordial:'#f87171',
};
const SOUL_AUCTION_ITEMS = [
  { name:'100 ~ 300 주화',  val:100 },
  { name:'200 ~ 300 주화',  val:200 },
  { name:'200 ~ 400 주화',  val:200 },
  { name:'300 ~ 400 주화',  val:300 },
  { name:'500 ~ 700 주화',  val:500 },
  { name:'700 ~ 1000 주화', val:700 },
];
const fmtG = n => (n == null || Number.isNaN(+n)) ? '-' : Math.round(n).toLocaleString('ko-KR');

// 100만G에서 5%씩 상승하는 입찰 단계 중 limit 이하 마지막 값
function lastSafeBid(limit) {
  if (limit < 1_000_000) return null;
  let bid = 1_000_000;
  while (Math.round(bid * 1.05) <= limit) bid = Math.round(bid * 1.05);
  return bid;
}

let soulLoaded = false;

async function loadSoul() {
  const btn = $('#soulRefreshBtn');
  if (btn) btn.disabled = true;
  if (!soulLoaded) {
    $('#soulTs').textContent = '불러오는 중…';
    $('#soulGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-title">불러오는 중…</div></div>`;
  }
  try {
    const res = await A.soul();
    if (res.error) throw new Error(res.error);
    $('#soulTs').textContent = res.timestamp ? `${res.timestamp} 기준` : '';
    renderSoul(res.data || []);
    soulLoaded = true;
  } catch (e) {
    $('#soulTs').textContent = '오류';
    $('#soulGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-title">계시 데이터 로드 실패</div><div class="empty-state-sub">${e.message}</div></div>`;
    $('#bidBody').innerHTML = '';
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderSoul(items) {
  if (!items.length) {
    $('#soulGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-title">데이터 없음</div></div>`;
    $('#soulBasis').textContent = '—';
    $('#bidBody').innerHTML = '';
    return;
  }
  const valid = items.filter(s => s.trade_value != null);
  const best  = valid.length ? valid.reduce((a, b) => a.trade_value < b.trade_value ? a : b) : null;

  $('#soulBasis').textContent = best
    ? `${best.name} · 계시 1개 ${fmtG(best.trade_value)} 골드`
    : '—';

  $('#soulGrid').innerHTML = items.map(s => {
    const isBest = best && s.key === best.key;
    const color  = SOUL_RARITY_COLOR[s.key] || '#888';
    return `
      <div class="soul-card${isBest ? ' best' : ''}" data-soul-key="${s.key}">
        <div class="soul-card-head">
          <div class="soul-color-dot" style="background:${color}"></div>
          <span class="soul-card-name">${s.name}</span>
          ${isBest ? '<span class="soul-best-badge">최저</span>' : ''}
          <span class="chevron">▼</span>
        </div>
        <div class="soul-card-stats">
          <div class="soul-stat price">
            <span class="soul-stat-label">계시 단가</span>
            <span class="soul-stat-value">${fmtG(s.trade_value)}G</span>
          </div>
          <div class="soul-stat">
            <span class="soul-stat-label">교환비</span>
            <span class="soul-stat-value">÷${s.exchange}</span>
          </div>
        </div>
        <div class="soul-detail">
          <div class="soul-detail-grid">
            <div class="soul-detail-row">
              <span class="soul-detail-label">현재 경매 평균가</span>
              <span class="soul-detail-value">${fmtG(s.average_price)}G (${s.auction_count ?? 0}건)</span>
            </div>
            <div class="soul-detail-row">
              <span class="soul-detail-label">현재 기준 계시 단가</span>
              <span class="soul-detail-value">${fmtG(s.trade_value)}G</span>
            </div>
            <div class="soul-detail-row">
              <span class="soul-detail-label">최근 거래 평균가</span>
              <span class="soul-detail-value">${fmtG(s.average_sold_price)}G (${s.sold_count ?? 0}건)</span>
            </div>
            <div class="soul-detail-row">
              <span class="soul-detail-label">거래 기준 계시 단가</span>
              <span class="soul-detail-value">${fmtG(s.sold_trade_value)}G</span>
            </div>
            <div class="soul-detail-row" style="grid-column:1/-1">
              <span class="soul-detail-label">최저가 / 최고가</span>
              <span class="soul-detail-value">${fmtG(s.lowest_price)}G ~ ${fmtG(s.highest_price)}G</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 입찰 한계가 계산
  if (best) {
    const bestCost = best.trade_value;
    const rows = SOUL_AUCTION_ITEMS.map(item => {
      const minVal  = item.val * bestCost;
      const limit   = Math.floor(minVal / 0.775);
      const safeBid = lastSafeBid(limit);
      const ok      = safeBid != null;
      const payback = ok ? Math.floor(safeBid * 0.225) : null;
      const net     = ok ? safeBid - payback : null;
      return { ...item, minVal, limit, safeBid, payback, net, ok };
    });
    $('#bidBody').innerHTML = rows.map(r => `
      <tr class="${r.ok ? '' : 'forbidden'}">
        <td class="col-item">${r.name}</td>
        <td class="col-limit">${fmtG(r.minVal)}G</td>
        ${r.ok
          ? `<td class="col-next">${fmtG(r.safeBid)}G</td>
             <td class="col-meta">+${fmtG(r.payback)} / ${fmtG(r.net)}G</td>`
          : `<td class="col-next" colspan="2" style="text-align:center;font-weight:700">입찰 금지</td>`}
      </tr>
    `).join('');
  } else {
    $('#bidBody').innerHTML = '';
  }
}

// 카드 클릭 → 펼치기
document.addEventListener('click', e => {
  const card = e.target.closest('.soul-card[data-soul-key]');
  if (card) card.classList.toggle('open');
});

// 새로고침 버튼
$('#soulRefreshBtn')?.addEventListener('click', () => {
  soulLoaded = false;
  loadSoul();
});

// ════════════════════════════════════════════════════════════
//  Modal
// ════════════════════════════════════════════════════════════
function openModal(predicate) {
  const c = state.characters.find(predicate);
  if (!c) return;
  state.modalChar = c;
  $('#modalBackdrop').style.display = '';
  $('#modal').style.display = '';
  requestAnimationFrame(() => {
    $('#modalBackdrop').classList.add('show');
    $('#modal').classList.add('show');
  });
  document.body.classList.add('modal-open');
  $('#modalAvatar').innerHTML = avatarHTML(c);
  $('#modalName').textContent = c.characterName;
  $('#modalServer').textContent = A.SERVER_KR[c.serverId] || c.serverId;
  $('#modalJob').textContent = c.jobGrowName || '-';
  $('#modalLevel').textContent = state.details[c.characterId]?.basic?.level ? `Lv.${state.details[c.characterId].basic.level}` : '';
  $('#modalAdv').textContent = state.adventureName || '-';
  $('#modalFame').textContent = fmt(c.fame);
  // ensure detail loaded
  if (!state.details[c.characterId]?.basic) loadCharDetail(c.characterId).then(() => switchModalTab(state.modalTab));
  switchModalTab(state.modalTab);
}
function closeModal() {
  $('#modalBackdrop').classList.remove('show');
  $('#modal').classList.remove('show');
  document.body.classList.remove('modal-open');
  setTimeout(() => { $('#modalBackdrop').style.display = 'none'; $('#modal').style.display = 'none'; }, 200);
}
$('#modalCloseBtn').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function switchModalTab(t) {
  state.modalTab = t;
  $$('.modal-tab').forEach(b => b.classList.toggle('active', b.dataset.mtab === t));
  if (t === 'summary')  renderModalSummary();
  if (t === 'gear')     renderModalGear();
  if (t === 'pact')     renderModalPact();
  if (t === 'timeline') renderModalTimeline();
}
$$('.modal-tab').forEach(b => b.addEventListener('click', () => switchModalTab(b.dataset.mtab)));

function renderModalSummary() {
  const c = state.modalChar;
  if (!c) return;
  const detail = state.details[c.characterId];
  if (!detail || detail.loading) { $('#modalBody').innerHTML = `<div class="cm-loading"><span class="t-spin">⏳</span> 불러오는 중...</div>`; return; }
  const eq = detail?.equipment || [];
  const taechos = eq.filter(e => e.itemRarity === '태초').length;
  const epics = eq.filter(e => e.itemRarity === '에픽').length;
  const fame = detail.basic?.fame ?? c.fame;
  const level = detail.basic?.level ?? '-';
  const cs = A.coreStats(detail);
  const isBuff = (c.buffScore != null) || A.isBuffChar(detail);
  const setEval = A.getSetEval(detail);
  const equippedSet = A.getEquippedSet(detail);

  // 세트포인트 진행도 바
  let setProgressHTML = '';
  if (setEval) {
    const tierCls = tierToRarityClass(setEval.activeTier?.tier);
    const cur = setEval.current;
    const next = setEval.nextTier;
    const activeLabel = setEval.activeTier?.label || '미달';
    const pct = next ? Math.min(100, Math.round((cur - (setEval.activeTier?.min || 0)) / (next.min - (setEval.activeTier?.min || 0)) * 100)) : 100;
    const taecho = setEval.taechoBonus;
    setProgressHTML = `
      <div style="margin-top:10px;padding:10px 12px;background:var(--bg-2);border:1px solid var(--border-soft);border-radius:8px">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
          <span class="badge ${tierCls}">${activeLabel}</span>
          <span class="num" style="font-weight:700">${fmt(cur)}<span style="font-size:10px;color:var(--text-3);font-weight:500"> SP</span></span>
          ${next ? `<span style="margin-left:auto;font-size:10px;color:var(--text-3)">다음 ${next.label} ${fmt(next.min)} · ${fmt(setEval.pointsToNext)} 남음</span>` : `<span style="margin-left:auto;font-size:10px;color:var(--r-taecho);font-weight:700">최고 단계</span>`}
        </div>
        <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--accent);transition:width .4s"></div>
        </div>
        ${taecho ? `<div style="margin-top:8px;font-size:10px;color:var(--text-3)">✦ 태초 보너스 ${taecho.steps}단계 · 최종뎀 +${taecho.finalDamageBonusPct}% / 버프력 +${taecho.buffPowerBonus}</div>` : ''}
      </div>
    `;
  }

  // 등급 분포 칩
  let rarityChipsHTML = '';
  if (equippedSet?.rarityBreakdown) {
    rarityChipsHTML = Object.entries(equippedSet.rarityBreakdown)
      .map(([r, n]) => `<span class="badge ${rarityClass(r)}" style="font-size:10px">${r} ${n}</span>`)
      .join(' ');
  }

  $('#modalBody').innerHTML = `
    <div class="summary-grid">
      <div>
        <div class="card-title" style="margin-bottom:8px">캐릭터 스탯</div>
        <div class="stat-list">
          <div class="stat-tile"><div class="lbl">명성</div><div class="val" style="color:var(--accent)">${fmt(fame)}</div></div>
          <div class="stat-tile"><div class="lbl">레벨</div><div class="val">${level}</div></div>
          ${c.ozma != null && !isBuff ? `<div class="stat-tile"><div class="lbl">딜 (던담)</div><div class="val" style="color:var(--accent)">${c.ozma}</div></div>` : ''}
          ${c.buffScore != null && isBuff ? `<div class="stat-tile"><div class="lbl">버프점수 (던담)</div><div class="val" style="color:var(--accent)">${c.buffScore}</div></div>` : ''}
          ${c.cri != null ? `<div class="stat-tile"><div class="lbl">크리 (던담)</div><div class="val">${c.cri}%</div></div>` : ''}
          ${c.setPoint != null ? `<div class="stat-tile"><div class="lbl">세트포인트 (던담)</div><div class="val">${c.setPoint}</div></div>` : ''}
          ${cs.finalDmgInc != null ? `<div class="stat-tile"><div class="lbl">최종뎀 (네오플)</div><div class="val">${fmtShort(cs.finalDmgInc)}</div></div>` : ''}
          ${cs.atkInc != null ? `<div class="stat-tile"><div class="lbl">공격력 증가</div><div class="val">${fmt(cs.atkInc)}</div></div>` : ''}
          ${cs.critPhys != null ? `<div class="stat-tile"><div class="lbl">물리 크리티컬</div><div class="val">${cs.critPhys}${typeof cs.critPhys==='number'?'%':''}</div></div>` : ''}
          ${cs.cooldown != null ? `<div class="stat-tile"><div class="lbl">쿨감</div><div class="val">${cs.cooldown}${typeof cs.cooldown==='number'?'%':''}</div></div>` : ''}
          ${isBuff && cs.buffPower != null ? `<div class="stat-tile"><div class="lbl">버프력 (네오플)</div><div class="val">${fmt(cs.buffPower)}</div></div>` : ''}
        </div>
      </div>
      <div>
        <div class="card-title" style="margin-bottom:8px">세트 / 장비</div>
        ${equippedSet ? `
          <div style="padding:10px 12px;background:var(--bg-2);border:1px solid var(--border-soft);border-radius:8px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${equippedSet.name}</div>
            <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">${equippedSet.pieceCount}부위</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">${rarityChipsHTML}</div>
          </div>
        ` : `<div style="color:var(--text-4);font-size:12px">착용 세트 없음</div>`}
        ${setProgressHTML}
        <div class="stat-list" style="margin-top:10px">
          <div class="stat-tile"><div class="lbl">태초 장비</div><div class="val" style="color:var(--r-taecho)">${taechos} <span style="font-size:11px;color:var(--text-3);font-weight:500">/ 13</span></div></div>
          <div class="stat-tile"><div class="lbl">에픽 장비</div><div class="val" style="color:var(--r-epic)">${epics} <span style="font-size:11px;color:var(--text-3);font-weight:500">/ 13</span></div></div>
        </div>
        <div class="hr"></div>
        <div style="font-size:11px;color:var(--text-3);line-height:1.6">
          ${detail.basic?.guildName ? `길드 · ${detail.basic.guildName}<br>` : ''}
          모험단 · ${state.adventureName || '-'}<br>
          최근 동기화 · ${fmtAgo(state.lastSyncAt)}
        </div>
      </div>
    </div>
  `;
}

const EQ_LAYOUT = [
  'SHOULDER', 'JACKET',   'CENTER', 'WEAPON',  'TITLE',
  'PANTS',    'WAIST',    'CENTER', 'WRIST',   'AMULET',
  'SHOES',    null,       'CENTER', 'SUPPORT', 'RING',
  null,       null,       'CENTER', 'EARRING', 'MAGIC_STONE',
];
function renderModalGear() {
  const c = state.modalChar;
  if (!c) return;
  const detail = state.details[c.characterId];
  if (!detail || detail.loading) { $('#modalBody').innerHTML = `<div class="cm-loading"><span class="t-spin">⏳</span> 불러오는 중...</div>`; return; }
  const eq = detail.equipment || [];
  const bySlot = {};
  eq.forEach(e => bySlot[normSlotId(e.slotId)] = e);

  let html = `<div class="paperdoll">`;
  let seenCenter = false;
  EQ_LAYOUT.forEach((slotId, idx) => {
    const col = (idx % 5) + 1;
    if (slotId === 'CENTER') {
      if (!seenCenter) {
        seenCenter = true;
        html += `<div class="pd-center" style="grid-column:${col};grid-row:1 / span 4">
          <div class="avatar lg">${avatarHTML(c)}</div>
          <div class="pdc-name">${c.characterName}</div>
          <div class="pdc-job">${c.jobGrowName || ''} · ${A.SERVER_KR[c.serverId] || c.serverId}</div>
          <div class="pdc-fame">${fmt(detail.basic?.fame ?? c.fame)}</div>
          <div class="pdc-fame-lbl">명성</div>
        </div>`;
      }
      return;
    }
    if (slotId === null) { html += `<div></div>`; return; }
    const label = SLOT_LABEL[slotId] || slotId;
    const item = bySlot[slotId];
    if (!item) {
      html += `<div class="pd-slot empty"><div class="pd-img">${SLOT_EMOJI[slotId] || '·'}</div><div class="pd-slot-name">${label}</div><div class="pd-item-name" style="color:var(--text-4)">미장착</div></div>`;
      return;
    }
    const rCls = rarityClass(item.itemRarity);
    const rein = item.reinforce ? `<span class="rein">+${item.reinforce}</span>` : '';
    const img = item.itemId
      ? `<img src="https://img-api.neople.co.kr/df/items/${encodeURIComponent(item.itemId)}" alt="" onerror="this.replaceWith(document.createTextNode('${SLOT_EMOJI[slotId] || '·'}'))">`
      : (SLOT_EMOJI[slotId] || '·');
    html += `<div class="pd-slot ${rCls}">
      <div class="pd-img">${img}</div>
      <div class="pd-slot-name">${label}${rein ? ' ' + rein : ''}</div>
      <div class="pd-item-name">${item.itemName}</div>
      <div class="pd-meta">${item.itemRarity || ''}${item.amplificationName ? ' · ' + item.amplificationName : ''}</div>
    </div>`;
  });
  html += `</div>`;
  // set summary at top — backend equippedSet + setEval
  const set = A.getEquippedSet(detail);
  const setEval = A.getSetEval(detail);
  if (set) {
    const tierLabel = setEval?.activeTier?.label || '미달';
    const tierCls = tierToRarityClass(setEval?.activeTier?.tier);
    const rarityChips = set.rarityBreakdown
      ? Object.entries(set.rarityBreakdown).map(([r, n]) => `<span class="badge ${rarityClass(r)}" style="font-size:10px">${r} ${n}</span>`).join(' ')
      : '';
    html = `<div style="margin-bottom:14px;padding:10px 14px;background:var(--bg-2);border:1px solid var(--border-soft);border-radius:8px;display:flex;align-items:center;gap:10px;font-size:12px;flex-wrap:wrap">
      <span style="color:var(--text-3);font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:10px">세트</span>
      <span style="font-weight:700">${set.name}</span>
      <span class="num" style="font-family:var(--font-mono);color:var(--text-2);font-weight:700">${set.pieceCount}부위</span>
      <span style="display:flex;gap:4px">${rarityChips}</span>
      ${setEval ? `<span style="margin-left:auto;display:flex;gap:8px;align-items:center"><span class="badge ${tierCls}">${tierLabel}</span><span class="num" style="font-weight:700">${fmt(setEval.current)} SP</span></span>` : ''}
    </div>` + html;
  }
  $('#modalBody').innerHTML = html;
}

// 서약 페이퍼돌 — 5×4 그리드
// 좌측 4칸(slot 0~3) · 우측 4칸(slot 4~7) · 중앙 서약 · 하단 중앙 3칸(slot 8~10 태초)
const PACT_GRID = [
  // [kind, slotNo|null]
  ['crystal',0], ['gap',null], ['gap',null],    ['gap',null], ['crystal',4],
  ['crystal',1], ['gap',null], ['main',null],   ['gap',null], ['crystal',5],
  ['crystal',2], ['gap',null], ['gap',null],    ['gap',null], ['crystal',6],
  ['crystal',3], ['taecho',8], ['taecho',9],    ['taecho',10],['crystal',7],
];

function renderModalPact() {
  const c = state.modalChar;
  if (!c) return;
  const detail = state.details[c.characterId];
  if (!detail || detail.loading) { $('#modalBody').innerHTML = `<div class="cm-loading"><span class="t-spin">⏳</span> 불러오는 중...</div>`; return; }

  const oath = A.getOath(detail);
  if (!oath) {
    $('#modalBody').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">서약 정보가 없습니다</div>
        <div class="empty-state-sub">아직 서약을 착용하지 않은 캐릭터예요</div>
      </div>`;
    return;
  }

  const info = oath.info;
  const crystals = oath.crystal || [];
  const setInfo = oath.setInfo;
  const blessing = oath.blessing;
  const crystalBySlot = {};
  crystals.forEach(cr => { crystalBySlot[cr.slotNo] = cr; });

  // 진의 4단계
  const options = info?.oathUpgrade?.options || [];

  // 활성 여부
  const sp = setInfo?.active?.setPoint;
  const isActive = sp && sp.current >= sp.min;
  const setActiveCls = isActive ? 'r-taecho' : '';

  // 그리드 빌드
  let gridHTML = `<div class="pact-grid">`;
  PACT_GRID.forEach(([kind, slotNo]) => {
    if (kind === 'gap') { gridHTML += `<div class="pact-slot gap"></div>`; return; }

    if (kind === 'main') {
      // 서약 본체는 네오플 API에서 itemId 이미지가 404라 던담 세트 아이콘 사용
      const oathName = setInfo?.setOptionName || info?.itemName || '';
      const dundamUrl = A.getDundamSetIconUrl(oathName);
      const img = dundamUrl
        ? `<img src="${dundamUrl}" alt="" style="width:100%;height:100%;object-fit:contain;padding:6px" onerror="this.remove()">`
        : '🔮';
      const rCls = rarityClass(info?.itemRarity);
      const filled = info?.itemId ? '' : 'empty';
      const displayName = setInfo?.setOptionName
        ? setInfo.setOptionName.replace(/^[^:]+\s*:\s*/, '')
        : (info?.itemName || '서약');
      gridHTML += `<div class="pact-slot main ${rCls} ${filled}" title="${info?.itemName || '서약'}${setInfo?.setName ? ` / ${setInfo.setName}` : ''}">
        <div class="ps-img">${img}</div>
        <div class="ps-lbl" style="font-weight:700">${truncate(displayName, 14)}</div>
      </div>`;
      return;
    }

    // crystal / taecho slot
    const cr = crystalBySlot[slotNo];
    if (!cr) {
      gridHTML += `<div class="pact-slot empty ${kind === 'taecho' ? 'taecho' : ''}">
        ${kind === 'taecho' ? `<span class="pact-tag">태초</span>` : ''}
        <div class="ps-img">·</div>
        <div class="ps-lbl">결정 ${slotNo+1}</div>
      </div>`;
      return;
    }
    const rCls = rarityClass(cr.itemRarity);
    const img = cr.itemId
      ? `<img src="https://img-api.neople.co.kr/df/items/${encodeURIComponent(cr.itemId)}" alt="" style="width:100%;height:100%;object-fit:contain" onerror="this.remove()">`
      : '·';
    const tuneLvl = cr.tune?.level;
    const tuneSp  = cr.tune?.setPoint;
    gridHTML += `<div class="pact-slot ${rCls} ${kind === 'taecho' ? 'taecho' : ''}" title="${cr.itemName}${tuneSp ? ' · 조율 SP ' + tuneSp : ''}">
      ${kind === 'taecho' ? `<span class="pact-tag">태초</span>` : ''}
      <div class="ps-img">${img}</div>
      <div class="ps-lbl">${truncate(cr.itemName, 12)}</div>
      ${tuneLvl != null ? `<div style="font-size:9px;color:var(--text-3);font-family:var(--font-mono);margin-top:2px">조율 ${'I'.repeat(tuneLvl) || '0'}${tuneSp ? ' · ' + tuneSp + 'SP' : ''}</div>` : ''}
    </div>`;
  });
  gridHTML += `</div>`;

  // 세트 활성 카드
  let setCardHTML = '';
  if (setInfo) {
    const rCls = rarityClass(setInfo.setRarityName);
    const stat = setInfo.active?.status || [];
    setCardHTML = `
      <div style="margin-top:18px;padding:14px;background:var(--bg-2);border:1px solid var(--border-soft);border-radius:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span class="badge ${rCls}">${setInfo.setRarityName || ''}</span>
          <span style="font-weight:700;font-size:13px">${setInfo.setName || ''}</span>
          ${setInfo.setOptionName ? `<span style="color:var(--text-3);font-size:11px">· ${setInfo.setOptionName}</span>` : ''}
          ${isActive
            ? `<span class="badge r-taecho" style="margin-left:auto">활성</span>`
            : `<span class="badge" style="margin-left:auto;color:var(--text-4)">미활성</span>`}
        </div>
        ${sp ? `
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;font-size:11px">
            <span class="num" style="font-weight:700;color:${isActive ? 'var(--r-taecho)' : 'var(--text-2)'}">${fmt(sp.current)}</span>
            <span style="color:var(--text-3)">/ ${fmt(sp.min)}</span>
          </div>
          <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
            <div style="width:${Math.min(100, Math.round(sp.current / sp.min * 100))}%;height:100%;background:${isActive ? 'var(--r-taecho)' : 'var(--accent)'};transition:width .4s"></div>
          </div>
        ` : ''}
        ${stat.length ? `
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
            ${stat.map(s => `<span style="padding:4px 8px;background:var(--surface-2);border-radius:4px;font-size:10px"><span style="color:var(--text-3)">${s.key}</span> <span style="font-weight:700;font-family:var(--font-mono)">${s.value}</span></span>`).join('')}
          </div>` : ''}
      </div>
    `;
  }

  // 4진의 단계
  let optionsHTML = '';
  if (options.length) {
    optionsHTML = `
      <div style="margin-top:14px">
        <div class="card-title" style="margin-bottom:8px">묵언의 진의 ${options.length}/4</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
          ${options.map((o, i) => `
            <div style="padding:10px;background:var(--bg-2);border:1px solid var(--border-soft);border-radius:8px">
              <div style="font-size:10px;color:var(--text-3);margin-bottom:2px">진의 ${i+1}</div>
              <div style="font-weight:700;font-size:12px;margin-bottom:4px">${o.optionName || '-'}</div>
              <div style="font-size:10px;color:var(--text-3);line-height:1.4;margin-bottom:6px">${o.explain || ''}</div>
              ${(o.status || []).map(s => `<div style="font-size:10px;display:flex;justify-content:space-between"><span style="color:var(--text-3)">${s.key}</span><span style="font-family:var(--font-mono);font-weight:700">${s.value}</span></div>`).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 축복
  let blessingHTML = '';
  if (blessing?.status?.length) {
    blessingHTML = `
      <div style="margin-top:14px;padding:12px;background:var(--bg-2);border:1px solid var(--border-soft);border-radius:8px">
        <div style="font-size:10px;color:var(--text-3);font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px">축복 누적 효과</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${blessing.status.map(s => `<span style="padding:4px 8px;background:var(--surface-2);border-radius:4px;font-size:10px"><span style="color:var(--text-3)">${s.key}</span> <span style="font-weight:700;font-family:var(--font-mono)">${s.value}</span></span>`).join('')}
        </div>
      </div>
    `;
  }

  $('#modalBody').innerHTML = `
    ${gridHTML}
    <div class="pact-legend">
      <span class="lg"><span class="lg-dot main"></span> 서약 (중앙)</span>
      <span class="lg"><span class="lg-dot"></span> 에픽 광휘 결정 × 8</span>
      <span class="lg"><span class="lg-dot taecho"></span> 태초 광휘 결정 × 3</span>
    </div>
    ${setCardHTML}
    ${optionsHTML}
    ${blessingHTML}
  `;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function renderModalTimeline() {
  const c = state.modalChar;
  if (!c) return;
  $('#modalBody').innerHTML = `<div class="cm-loading"><span class="t-spin">⏳</span> 불러오는 중...</div>`;
  try {
    const res = await A.events({ characterId: c.characterId, limit: 200 });
    const rows = res.rows || [];
    if (!rows.length) {
      $('#modalBody').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">아직 드랍 내역이 없습니다</div>
          <div class="empty-state-sub">캐릭 동기화를 먼저 실행해주세요</div>
        </div>`;
      return;
    }
    const PATH_LABEL = {550:'드랍',551:'레이드',552:'항아리',554:'제작',557:'카드'};
    const groups = {};
    rows.forEach(r => {
      const d = new Date(r.occurred_at);
      const key = d.toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', weekday:'short' });
      (groups[key] = groups[key] || []).push(r);
    });
    let html = `<div class="timeline">`;
    Object.entries(groups).forEach(([day, items]) => {
      html += `<div class="tl-day">
        <div class="tl-day-label">${day}</div>
        <div class="tl-day-events">
          ${items.map(r => {
            const rCls = r.item_rarity === '태초' ? 'r-taecho' : 'r-epic';
            const cat = r.item_category === 'soul' ? '결정' : '서약';
            const time = new Date(r.occurred_at).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', hour12:false});
            return `<div class="tl-event ${rCls}">
              <span class="tl-event-time">${time}</span>
              <span class="badge ${rCls}">${r.item_rarity}</span>
              <span class="tl-event-name">${r.item_name}</span>
              <span class="tl-event-meta">${cat} · ${PATH_LABEL[r.event_code] || ('code ' + r.event_code)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    });
    html += `</div>`;
    $('#modalBody').innerHTML = html;
  } catch (e) {
    $('#modalBody').innerHTML = `<div class="cm-err">조회 실패: ${e.message}</div>`;
  }
}

// ════════════════════════════════════════════════════════════
//  Theme + Tweaks (same as before)
// ════════════════════════════════════════════════════════════
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('#themeLbl').textContent = t === 'dark' ? '다크 모드' : '라이트 모드';
  $('#themeBtn').querySelector('use').setAttribute('href', t === 'dark' ? '#i-moon' : '#i-sun');
  $$('[data-theme-opt]').forEach(b => b.classList.toggle('active', b.dataset.themeOpt === t));
}
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(next);
});
$$('[data-theme-opt]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeOpt)));

const ACCENTS = {
  amber:   { l: 0.78, c: 0.15, h: 65  },
  emerald: { l: 0.74, c: 0.17, h: 148 },
  azure:   { l: 0.72, c: 0.18, h: 240 },
  violet:  { l: 0.72, c: 0.20, h: 295 },
  coral:   { l: 0.72, c: 0.18, h: 25  },
};
function setAccent(name) {
  const { l, c, h } = ACCENTS[name];
  const root = document.documentElement;
  root.style.setProperty('--accent', `oklch(${l} ${c} ${h})`);
  root.style.setProperty('--accent-hover', `oklch(${l+0.05} ${c} ${h+3})`);
  root.style.setProperty('--accent-bg', `oklch(${l} ${c} ${h} / 0.14)`);
  root.style.setProperty('--accent-border', `oklch(${l} ${c} ${h} / 0.42)`);
  $$('.swatch').forEach(s => s.classList.toggle('active', s.dataset.accent === name));
}
$$('.swatch').forEach(s => s.addEventListener('click', () => setAccent(s.dataset.accent)));
$$('[data-density]').forEach(b => b.addEventListener('click', () => {
  $$('[data-density]').forEach(x => x.classList.toggle('active', x === b));
  document.documentElement.style.setProperty('--header-h', b.dataset.density === 'compact' ? '48px' : '56px');
}));
$('#tweaksBtn').addEventListener('click', () => $('#tweaksPop').classList.toggle('show'));
$('#tweaksCloseBtn').addEventListener('click', () => $('#tweaksPop').classList.remove('show'));

// ════════════════════════════════════════════════════════════
//  Bootstrap
// ════════════════════════════════════════════════════════════
async function init() {
  restoreState();
  renderRecents();
  // ?demo URL 파라미터 — 갱신된 상태처럼 가짜 델타 입히기 (디자인 검토용)
  if (new URLSearchParams(location.search).has('demo') && state.characters.length) {
    applyDemoRefresh();
  }
  renderAdvTag();
  renderRefreshStats();
  renderCharCards();
  if (state.characters.length) {
    // restored — load all details in background
    loadAllDetails();
  }
  // Show last sync display in side foot
  $('#lastSync').textContent = fmtAgo(state.lastSyncAt);

  // URL 해시로 탭 진입 (#history, #soul) — legacy 사이드바에서 점프해올 때
  const hashTab = location.hash.replace(/^#/, '');
  if (['refresh','history','soul'].includes(hashTab) && hashTab !== state.tab) {
    switchTab(hashTab);
  }
}

// 데모 갱신 — 실제 백엔드 호출 없이 가짜 명성/딜/버프점수 변동 적용
function applyDemoRefresh() {
  if (!state.characters.length) {
    alert('먼저 모험단을 검색해주세요');
    return;
  }
  state.characters.forEach(c => {
    // 명성 변동
    const fameDelta = Math.floor((Math.random() - 0.3) * 8000);
    c.prevFame = c.fame;
    c.fame = c.fame + fameDelta;

    // 딜/버프점수 변동
    if (c.ozma != null) {
      c.prevOzma = c.ozma;
      const cur = parseDundamNum(c.ozma) || 0;
      const newVal = Math.max(1e8, cur + Math.floor((Math.random() - 0.25) * cur * 0.05));
      // 다시 한국어 포맷으로 (간단 버전)
      const jo = Math.floor(newVal / 1e12);
      const eok = Math.floor((newVal % 1e12) / 1e8);
      const man = Math.floor((newVal % 1e8) / 1e4);
      const parts = [];
      if (jo) parts.push(`${jo} 조`);
      if (eok) parts.push(`${eok} 억`);
      if (man && !jo) parts.push(`${man} 만`);
      c.ozma = parts.join(' ') || c.ozma;
    }
    if (c.buffScore != null) {
      c.prevBuffScore = c.buffScore;
      const cur = parseDundamNum(c.buffScore) || 0;
      const newVal = Math.max(1000, cur + Math.floor((Math.random() - 0.25) * cur * 0.05));
      c.buffScore = newVal.toLocaleString('ko-KR');
    }
    c.refreshed = true;
  });
  state.lastSyncAt = Date.now();
  saveState();
  renderRefreshStats();
  state.characters.forEach(c => patchCard(c.characterId));
}
$('#demoBtn').addEventListener('click', applyDemoRefresh);
// 데모 버튼은 ?demo URL 파라미터가 있을 때만 표시 (디자인 검토용)
if (new URLSearchParams(location.search).has('demo')) {
  $('#demoBtn').style.display = '';
}

// 뷰 모드 토글 (grid ↔ row)
$$('#viewModeSeg .seg').forEach(b => b.addEventListener('click', () => {
  state.viewMode = b.dataset.view;
  $$('#viewModeSeg .seg').forEach(x => x.classList.toggle('active', x === b));
  saveState();
  renderCharCards();
}));
// 초기 동기화
document.addEventListener('DOMContentLoaded', () => {
  $$('#viewModeSeg .seg').forEach(x => x.classList.toggle('active', x.dataset.view === state.viewMode));
});

init();

})();
