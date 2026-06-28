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

  // 입장 명성 = 공식 확정값. 딜컷/버프력컷 = 잠정(편집 가능).
  //   dealCut : ozma(딜) 기준 숫자  · buffCut : buffScore(버프점수) 기준 숫자
  const DEFAULT_DUNGEONS = [
    { id: 'yeoshin',     name: '죽음의 여신전',      type: '상급',   fame: 55950,  dealCut: 3.0e11, buffCut: 90000  },
    { id: 'hyungmong',   name: '해방된 흉몽',        type: '상급',   fame: 71179,  dealCut: 5.0e11, buffCut: 100000 },
    { id: 'byeolgeobuk', name: '별거북 대서고',      type: '상급',   fame: 91582,  dealCut: 1.2e12, buffCut: 115000 },
    { id: 'baegyo',      name: '배교자의 성',        type: '상급',   fame: 101853, dealCut: 1.0e12, buffCut: 110000 },
    { id: 'legion',      name: '아포칼립스: 안티엔바이', type: '레기온', fame: 98171,  dealCut: 1.5e12, buffCut: 120000 },
  ];

  function loadCuts() {
    const base = DEFAULT_DUNGEONS.map(d => ({ ...d }));
    try {
      const saved = JSON.parse(localStorage.getItem(CUTS_KEY) || '{}');
      base.forEach(d => {
        const o = saved[d.id];
        if (o) {
          if (Number.isFinite(o.fame))    d.fame    = o.fame;
          if (Number.isFinite(o.dealCut)) d.dealCut = o.dealCut;
          if (Number.isFinite(o.buffCut)) d.buffCut = o.buffCut;
        }
      });
    } catch {}
    return base;
  }
  function saveCuts(dungeons) {
    const out = {};
    dungeons.forEach(d => { out[d.id] = { fame: d.fame, dealCut: d.dealCut, buffCut: d.buffCut }; });
    localStorage.setItem(CUTS_KEY, JSON.stringify(out));
  }
  function resetCuts() { localStorage.removeItem(CUTS_KEY); }

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

  // 상급 던전은 캐릭터당 주간 2개까지만 보상 → 입장 가능한 상위 2개(명성 높은 순)만 실제 대상.
  function top2SangeupIds(c) {
    const elig = dungeons
      .filter(d => d.type === '상급' && (c.fame || 0) >= d.fame)
      .sort((a, b) => b.fame - a.fame)
      .slice(0, 2);
    return new Set(elig.map(d => d.id));
  }
  // 던전을 실제로 돌(보상 받을) 캐릭터 목록 — 상급은 상위2 제한 적용, 레기온은 입장 가능 전원.
  function runnersFor(d, chars) {
    if (d.type === '상급') return chars.filter(c => top2SangeupIds(c).has(d.id));
    return chars.filter(c => (c.fame || 0) >= d.fame);
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
  function fmtCut(d, role) { return role === 'buffer' ? fmtNum(d.buffCut) : fmtDeal(d.dealCut); }

  // ── 캐릭터 × 던전 판정 ──
  //   'locked'(입장불가) | 'over'(입장O·주간 상급 2회 초과) | 'bugyo'(컷미달→벞교필요) | 'solo'(컷돌파→단품) | 'na'
  function statusOf(c, d, top2) {
    if ((c.fame || 0) < d.fame) return { kind: 'locked', shortBy: d.fame - (c.fame || 0) };
    const role = roleOf(c);
    if (role === 'none') return { kind: 'na' };
    if (d.type === '상급' && top2 && !top2.has(d.id)) return { kind: 'over' };
    const score = scoreOf(c);
    const cut = role === 'dealer' ? d.dealCut : d.buffCut;
    if (score != null && cut != null && score >= cut) return { kind: 'solo' };
    return { kind: 'bugyo' };
  }

  // ── 던전별 벞교(딜3+버퍼1) 세트 구성 ──
  //   eligible = 이 던전을 실제로 돌(보상 받을) 캐릭 (상급은 주간 상위2 제한 반영)
  function bugyoSets(d, chars) {
    const eligible = runnersFor(d, chars);
    const buffers = eligible.filter(c => roleOf(c) === 'buffer').sort((a, b) => (scoreOf(b) || 0) - (scoreOf(a) || 0));
    const dealers = eligible.filter(c => roleOf(c) === 'dealer').sort((a, b) => (scoreOf(b) || 0) - (scoreOf(a) || 0));
    const setCount = Math.min(buffers.length, Math.floor(dealers.length / 3));
    const sets = [];
    let di = 0;
    for (let i = 0; i < setCount; i++) {
      sets.push({ buffer: buffers[i], dealers: dealers.slice(di, di + 3) });
      di += 3;
    }
    return {
      sets,
      eligible, buffers, dealers,
      leftoverBuffers: buffers.slice(setCount),
      leftoverDealers: dealers.slice(di),
    };
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

    root.innerHTML =
      summaryHTML(chars) +
      dungeonCardsHTML(chars) +
      matrixHTML(chars) +
      editorHTML();
    bindEditor(chars);
  }

  // ── 요약 스트립 ──
  function summaryHTML(chars) {
    const dealers = chars.filter(c => roleOf(c) === 'dealer').length;
    const buffers = chars.filter(c => roleOf(c) === 'buffer').length;
    const maxBugyo = Math.min(buffers, Math.floor(dealers / 3));
    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">🎫 토벌권 계산기</h1>
          <p class="page-sub">명성·딜·버프력 기준으로 어느 캐릭에 토벌권을 쓰는 게 효율적인지 추천합니다 (역설의 미궁 상급·레기온)</p>
        </div>
      </div>
      <div class="tb-strip">
        <div class="tb-kpi"><span class="tb-kpi-v">${chars.length}</span><span class="tb-kpi-l">총 캐릭터</span></div>
        <div class="tb-kpi"><span class="tb-kpi-v">${dealers}</span><span class="tb-kpi-l">딜러</span></div>
        <div class="tb-kpi"><span class="tb-kpi-v">${buffers}</span><span class="tb-kpi-l">버퍼</span></div>
        <div class="tb-kpi"><span class="tb-kpi-v accent">${maxBugyo}</span><span class="tb-kpi-l">최대 벞교 세트</span></div>
      </div>`;
  }

  // ── 던전별 추천 카드 ──
  function dungeonCardsHTML(chars) {
    const cards = dungeons.map(d => {
      const g = bugyoSets(d, chars);                                  // g.eligible = 주간 실제 대상(상급은 상위2 제한)
      const solo = g.eligible.filter(c => statusOf(c, d).kind === 'solo');
      const isLegion = d.type === '레기온';
      const enterable = chars.filter(c => (c.fame || 0) >= d.fame).length;
      const overCount = isLegion ? 0 : enterable - g.eligible.length; // 입장은 되나 주간 2회 초과
      const lockedCount = chars.length - enterable;

      const setRows = g.sets.length
        ? g.sets.map((s, i) => `
            <div class="tb-set">
              <span class="tb-set-no">세트 ${i + 1}</span>
              <span class="tb-tag buff">🛡 ${esc(nameOf(s.buffer))} <em>${fmtNum(scoreOf(s.buffer))}</em></span>
              ${s.dealers.map(dl => `<span class="tb-tag deal">⚔ ${esc(nameOf(dl))} <em>${fmtDeal(scoreOf(dl))}</em></span>`).join('')}
            </div>`).join('')
        : `<div class="tb-dim tb-pad">벞교 구성 불가 (입장 가능 ${d.type === '레기온' ? '' : ''}딜러 ${g.dealers.length} / 버퍼 ${g.buffers.length})</div>`;

      const soloRow = solo.length
        ? `<div class="tb-sololist">${solo
            .sort((a, b) => (scoreOf(b) || 0) - (scoreOf(a) || 0))
            .map(c => `<span class="tb-tag solo">${roleOf(c) === 'buffer' ? '🛡' : '⚔'} ${esc(nameOf(c))} <em>${roleOf(c) === 'buffer' ? fmtNum(scoreOf(c)) : fmtDeal(scoreOf(c))}</em></span>`).join('')}</div>`
        : `<div class="tb-dim tb-pad">단품 가능 캐릭 없음</div>`;

      return `
        <div class="tb-card ${isLegion ? 'legion' : ''}">
          <div class="tb-card-head">
            <div class="tb-card-title">${esc(d.name)} <span class="tb-badge">${d.type}</span></div>
            <div class="tb-card-cuts">
              명성 <b>${fmtNum(d.fame)}</b> · 딜컷 <b>${fmtDeal(d.dealCut)}</b> · 버프컷 <b>${fmtNum(d.buffCut)}</b>
            </div>
          </div>
          <div class="tb-card-stat">
            <span class="ok">${isLegion ? '입장 가능' : '주간 대상'} ${g.eligible.length}</span>
            <span>· 벞교 <b>${g.sets.length}</b>세트</span>
            <span>· 단품 <b>${solo.length}</b></span>
            ${overCount ? `<span class="over">· 2회초과 ${overCount}</span>` : ''}
            <span class="lock">· 입장 불가 ${lockedCount}</span>
          </div>
          <div class="tb-sec-label">벞교 추천 (딜3 + 버퍼1)</div>
          ${setRows}
          <div class="tb-sec-label">단품 가능 (컷 돌파)</div>
          ${soloRow}
        </div>`;
    }).join('');
    return `<div class="tb-cards">${cards}</div>`;
  }

  // ── 캐릭터 × 던전 매트릭스 ──
  function matrixHTML(chars) {
    const sorted = [...chars].sort((a, b) => (b.fame || 0) - (a.fame || 0));
    const head = dungeons.map(d => `<th title="명성 ${fmtNum(d.fame)}">${esc(shortName(d.name))}</th>`).join('');
    const rows = sorted.map(c => {
      const role = roleOf(c);
      const roleLbl = role === 'dealer' ? '<span class="tb-role deal">딜</span>' : role === 'buffer' ? '<span class="tb-role buff">버퍼</span>' : '<span class="tb-role">-</span>';
      const scoreLbl = role === 'buffer' ? fmtNum(scoreOf(c)) : role === 'dealer' ? fmtDeal(scoreOf(c)) : '-';
      const top2 = top2SangeupIds(c);
      const cells = dungeons.map(d => {
        const s = statusOf(c, d, top2);
        if (s.kind === 'locked') return `<td class="tb-cell lock" title="명성 ${fmtNum(s.shortBy)} 부족">🔒<small>+${fmtNum(s.shortBy)}</small></td>`;
        if (s.kind === 'over')   return `<td class="tb-cell over" title="입장 가능하나 주간 상급 2회 초과 — 더 높은 던전 우선">초과</td>`;
        if (s.kind === 'solo')   return `<td class="tb-cell solo" title="컷 돌파 — 단품 가능">단품</td>`;
        if (s.kind === 'bugyo')  return `<td class="tb-cell bugyo" title="입장 가능하나 컷 미달 — 벞교 권장">벞교</td>`;
        return `<td class="tb-cell na">-</td>`;
      }).join('');
      return `<tr>
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
        <span><i class="lg over"></i>주간 2회 초과</span>
        <span><i class="lg lock"></i>입장 불가(+필요 명성)</span>
      </div>
      <p class="tb-dim" style="margin:-2px 0 8px">상급 던전은 캐릭터당 주간 2개까지만 보상 — 입장 가능한 <b>상위 2개</b>만 대상으로 잡고, 나머지는 '초과'로 표시합니다. (레기온은 별도)</p>
      <div class="tb-table-wrap">
        <table class="tb-matrix">
          <thead><tr>
            <th>캐릭</th><th>직업</th><th>역할</th><th>명성</th><th>딜/버프</th>${head}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── 컷 편집 패널 ──
  function editorHTML() {
    const rows = dungeons.map(d => `
      <tr data-id="${d.id}">
        <td>${esc(d.name)} <span class="tb-badge sm">${d.type}</span></td>
        <td><input type="number" class="tb-in" data-f="fame"    value="${d.fame}"></td>
        <td><input type="number" class="tb-in" data-f="dealCut" value="${d.dealCut}"> <small class="tb-dim">${fmtDeal(d.dealCut)}</small></td>
        <td><input type="number" class="tb-in" data-f="buffCut" value="${d.buffCut}"></td>
      </tr>`).join('');
    return `
      <details class="tb-editor">
        <summary>⚙ 던전 컷 편집 — 입장 명성은 공식값, 딜컷·버프력컷은 잠정값이니 직접 조정하세요</summary>
        <table class="tb-edit-table">
          <thead><tr><th>던전</th><th>입장 명성</th><th>딜컷 (ozma)</th><th>버프력컷</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="tb-edit-actions">
          <button class="btn primary" id="tbSave">저장</button>
          <button class="btn ghost" id="tbReset">기본값 복원</button>
          <span class="tb-dim">저장하면 이 브라우저에 보관됩니다. 딜컷은 ozma 기준(예: 1조 = 1000000000000).</span>
        </div>
      </details>`;
  }

  function bindEditor(chars) {
    const save = document.getElementById('tbSave');
    const reset = document.getElementById('tbReset');
    if (save) save.addEventListener('click', () => {
      document.querySelectorAll('.tb-edit-table tr[data-id]').forEach(tr => {
        const d = dungeons.find(x => x.id === tr.dataset.id);
        if (!d) return;
        tr.querySelectorAll('input[data-f]').forEach(inp => {
          const v = Number(inp.value);
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
  function shortName(n) { return n.replace('아포칼립스: ', '').replace('해방된 ', '').replace('죽음의 ', ''); }
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
    #pane-tobeol .tb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;margin-bottom:26px}
    #pane-tobeol .tb-card{background:var(--surface-2,#1a1d24);border:1px solid var(--border,#2a2e38);border-radius:14px;padding:14px 16px}
    #pane-tobeol .tb-card.legion{border-color:color-mix(in oklab,var(--accent,#7c9cff) 45%,var(--border,#2a2e38))}
    #pane-tobeol .tb-card-title{font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px}
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
    #pane-tobeol .tb-tag{align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;background:var(--surface-3,#262a34);border:1px solid var(--border,#2a2e38)}
    #pane-tobeol .tb-tag em{font-style:normal;color:var(--text-3,#9aa3b2);font-weight:700}
    #pane-tobeol .tb-tag.buff{border-color:color-mix(in oklab,#5fa8ff 40%,transparent)}
    #pane-tobeol .tb-tag.deal{border-color:color-mix(in oklab,#ff8a5f 30%,transparent)}
    #pane-tobeol .tb-tag.solo{border-color:color-mix(in oklab,#5fd08a 40%,transparent)}
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
    #pane-tobeol .tb-edit-table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
    #pane-tobeol .tb-edit-table th,#pane-tobeol .tb-edit-table td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--border,#2a2e38)}
    #pane-tobeol .tb-edit-table th{font-size:11px;color:var(--text-3,#9aa3b2)}
    #pane-tobeol .tb-in{width:120px;background:var(--surface,#13151b);border:1px solid var(--border,#2a2e38);border-radius:7px;padding:4px 8px;color:var(--text-1,#e8ebf0);font-size:12px}
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
