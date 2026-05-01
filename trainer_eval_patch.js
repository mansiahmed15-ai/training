// ═══════════════════════════════════════════════════════════════════════
//  PATCH — نظام تقييم المدرب
//  يُضاف قبل </body> في index.html:
//  <script src="trainer_eval_patch.js"></script>
// ═══════════════════════════════════════════════════════════════════════

(function applyEvalPatch() {

  // ── Firebase helpers ──────────────────────────────────────────────
  function fb() { return window.FB || null; }

  async function saveEvaluation(tid, scores, comment) {
    const t = (window._trainees || []).find(x => x.id === tid);
    const data = {
      tid,
      name: t ? t.name : tid,
      dept: t ? t.dept : '',
      scores,
      comment: comment || '',
      submittedAt: new Date().toISOString(),
      submittedAtDisplay: new Date().toLocaleString('ar-SA')
    };
    const f = fb();
    if (f) {
      try {
        await f.set(f.ref(f.db, 'training/evaluations/' + tid), data);
      } catch(e) { console.warn('eval save err:', e.message); }
    }
    try { localStorage.setItem('eval_' + tid, JSON.stringify(data)); } catch {}
    return data;
  }

  async function loadEvaluations() {
    const f = fb();
    if (f) {
      try {
        const snap = await f.get(f.ref(f.db, 'training/evaluations'));
        if (snap.exists()) return Object.values(snap.val());
      } catch(e) { console.warn('eval load err:', e.message); }
    }
    // fallback localStorage
    const evals = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('eval_')) {
        try { evals.push(JSON.parse(localStorage.getItem(k))); } catch {}
      }
    }
    return evals;
  }

  async function getEvaluation(tid) {
    const f = fb();
    if (f) {
      try {
        const snap = await f.get(f.ref(f.db, 'training/evaluations/' + tid));
        if (snap.exists()) return snap.val();
      } catch {}
    }
    try { const v = localStorage.getItem('eval_' + tid); if (v) return JSON.parse(v); } catch {}
    return null;
  }

  // ── CSS Styles ────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .star-row { display:flex; gap:6px; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
    .star-row label { font-size:.82rem; font-weight:700; color:var(--text); min-width:160px; }
    .stars { display:flex; gap:4px; flex-direction:row-reverse; }
    .stars input { display:none; }
    .stars label {
      font-size:1.6rem; cursor:pointer; color:#d1d5db;
      transition:color .15s, transform .15s;
      min-width:auto;
    }
    .stars label:hover,
    .stars label:hover ~ label,
    .stars input:checked ~ label { color:#f59e0b; }
    .stars label:hover { transform:scale(1.2); }
    .eval-card {
      background:linear-gradient(135deg,#fffbeb,#fef3c7);
      border:1.5px solid #fde68a;
      border-radius:16px; padding:20px; margin-bottom:14px;
    }
    .eval-submitted {
      background:linear-gradient(135deg,#d1fae5,#a7f3d0);
      border:1.5px solid #6ee7b7;
      border-radius:16px; padding:20px; text-align:center;
    }
    .star-display { display:inline-flex; gap:2px; }
    .star-display span { font-size:.9rem; }
    .star-display .filled { color:#f59e0b; }
    .star-display .empty  { color:#d1d5db; }
    .eval-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:16px; }
    .eval-kpi { background:#fff; border-radius:13px; border:1.5px solid #fde68a; padding:14px; text-align:center; }
    .eval-kpi .v { font-size:1.8rem; font-weight:900; color:#f59e0b; line-height:1; margin-bottom:3px; }
    .eval-kpi .l { font-size:.68rem; color:var(--muted); font-weight:600; }
    .criteria-bar { margin-bottom:9px; }
    .criteria-bar .lbl { display:flex; justify-content:space-between; font-size:.76rem; font-weight:700; margin-bottom:3px; }
    .criteria-bar .bg  { background:var(--border); border-radius:5px; height:10px; overflow:hidden; }
    .criteria-bar .fill { height:100%; border-radius:5px; background:linear-gradient(90deg,#f59e0b,#fbbf24); transition:width 1s .1s; }
    .comment-bubble {
      background:#fff; border:1.5px solid var(--border); border-radius:12px;
      padding:12px 14px; margin-bottom:8px; font-size:.82rem; color:var(--text); line-height:1.7;
    }
    .comment-bubble .cb-name { font-weight:800; color:var(--g1); font-size:.78rem; margin-bottom:4px; }
  `;
  document.head.appendChild(style);

  // ── Evaluation Form (shown after Day 5 quiz complete) ─────────────
  const CRITERIA = [
    { key:'clarity',      label:'وضوح الشرح والأسلوب' },
    { key:'organization', label:'التنظيم والتحضير' },
    { key:'interaction',  label:'التفاعل مع المتدربين' },
    { key:'knowledge',    label:'الإلمام بالمادة العلمية' },
    { key:'overall',      label:'الرضا العام عن التدريب' }
  ];

  function buildEvalForm(tid) {
    const starsHTML = CRITERIA.map(c => `
      <div class="star-row">
        <label>${c.label}</label>
        <div class="stars" id="stars-${c.key}">
          ${[5,4,3,2,1].map(n => `
            <input type="radio" name="eval_${c.key}" id="s_${c.key}_${n}" value="${n}">
            <label for="s_${c.key}_${n}" title="${n} نجوم">★</label>
          `).join('')}
        </div>
      </div>
    `).join('');

    return `
      <div class="eval-card" id="eval-form-wrap">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#fbbf24);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">⭐</div>
          <div>
            <div style="font-weight:900;color:#92400e;font-size:.95rem">تقييم المدرب</div>
            <div style="font-size:.78rem;color:#78350f;margin-top:2px">رأيك يساعدنا على تحسين جودة التدريب</div>
          </div>
        </div>
        ${starsHTML}
        <div style="margin-bottom:14px">
          <label class="inp-label" style="margin-bottom:6px;color:#78350f">💬 ملاحظات وتعليقات إضافية (اختياري)</label>
          <textarea id="eval-comment" class="inp" rows="3"
            placeholder="شاركنا رأيك بحرية..."
            style="border-color:#fde68a;background:#fffbeb;resize:vertical"></textarea>
        </div>
        <button onclick="submitEvaluation('${tid}')"
          style="width:100%;padding:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;
                 border:none;border-radius:11px;font-family:'Tajawal',sans-serif;font-size:.95rem;
                 font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(245,158,11,.3)">
          ⭐ إرسال التقييم
        </button>
        <p id="eval-error" style="display:none;color:var(--red);font-size:.8rem;text-align:center;margin-top:8px"></p>
      </div>
    `;
  }

  window.submitEvaluation = async function(tid) {
    const scores = {};
    let missing = [];
    CRITERIA.forEach(c => {
      const sel = document.querySelector(`input[name="eval_${c.key}"]:checked`);
      if (sel) scores[c.key] = parseInt(sel.value);
      else missing.push(c.label);
    });
    if (missing.length) {
      const err = document.getElementById('eval-error');
      if (err) { err.style.display='block'; err.textContent = '⚠️ يرجى تقييم جميع المحاور: ' + missing.join('، '); }
      return;
    }
    const comment = document.getElementById('eval-comment')?.value.trim() || '';
    const wrap = document.getElementById('eval-form-wrap');
    if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:20px;color:var(--g1)">⏳ جارٍ الإرسال...</div>';
    await saveEvaluation(tid, scores, comment);
    if (wrap) {
      wrap.className = 'eval-submitted';
      wrap.innerHTML = `
        <div style="font-size:2.5rem;margin-bottom:10px">🎉</div>
        <div style="font-weight:900;color:#065f46;font-size:1.1rem;margin-bottom:6px">شكراً على تقييمك!</div>
        <div style="font-size:.85rem;color:#047857;line-height:1.7">تم إرسال تقييمك بنجاح.<br>رأيك يساهم في تطوير جودة التدريب.</div>
        <div style="display:flex;justify-content:center;gap:4px;margin-top:12px;font-size:1.4rem">
          ${CRITERIA.map(c => renderStarsHTML(scores[c.key])).join('')}
        </div>
      `;
    }
    if (window.toast) window.toast('⭐ تم إرسال تقييمك — شكراً!');
  };

  // ── Hook into day content rendering ──────────────────────────────
  // After Day 5 quiz is complete, append eval form
  const _origRenderDayContent = window.renderDayContent;
  window.renderDayContent = function() {
    if (typeof _origRenderDayContent === 'function') _origRenderDayContent();
    // Check if day 5 done → show eval form
    setTimeout(async () => {
      const t = window.activeTrainee;
      const d = window.activeDay;
      if (!t || !d || d.id !== 5) return;
      const results = window._results || {};
      const day5done = results[t.id]?.[5]?.quizScore !== undefined;
      if (!day5done) return;
      // Check if already submitted
      const existing = await getEvaluation(t.id);
      const dc = document.getElementById('day-content');
      if (!dc) return;
      // Don't append twice
      if (dc.querySelector('#eval-form-wrap') || dc.querySelector('.eval-submitted')) return;
      const evalDiv = document.createElement('div');
      evalDiv.id = 'eval-section';
      evalDiv.style.marginTop = '14px';
      if (existing) {
        evalDiv.innerHTML = `
          <div class="eval-submitted">
            <div style="font-size:1.8rem;margin-bottom:8px">✅</div>
            <div style="font-weight:900;color:#065f46;font-size:.95rem;margin-bottom:4px">لقد قمت بتقييم المدرب مسبقاً</div>
            <div style="font-size:.8rem;color:#047857">شكراً على مشاركتك! تقييمك تم تسجيله بتاريخ ${existing.submittedAtDisplay || ''}</div>
          </div>`;
      } else {
        evalDiv.innerHTML = buildEvalForm(t.id);
      }
      dc.appendChild(evalDiv);
    }, 400);
  };

  // Also hook result display — when quiz finishes on day 5
  const _origSaveResult = window.saveResult;
  if (typeof _origSaveResult === 'function') {
    window.saveResult = async function(...args) {
      await _origSaveResult(...args);
      setTimeout(() => window.renderDayContent && window.renderDayContent(), 600);
    };
  }

  // ── Star display helper ───────────────────────────────────────────
  function renderStarsHTML(score, size='1rem') {
    const s = Math.round(score || 0);
    return `<span class="star-display" style="font-size:${size}">
      ${[1,2,3,4,5].map(i => `<span class="${i<=s?'filled':'empty'}">★</span>`).join('')}
    </span>`;
  }

  function avgScore(evals, key) {
    const vals = evals.map(e => e.scores?.[key]).filter(v => v !== undefined);
    return vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '—';
  }

  // ── Dashboard Tab ─────────────────────────────────────────────────
  function injectEvalTab() {
    const subnav = document.querySelector('.subnav');
    if (!subnav || subnav.querySelector('#eval-tab-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'snbtn';
    btn.id = 'eval-tab-btn';
    btn.innerHTML = '⭐ تقييمات المدرب';
    btn.onclick = () => showEvalTab();
    subnav.appendChild(btn);

    // Create tab div
    const dashScreen = document.getElementById('s-dashboard');
    if (!dashScreen || dashScreen.querySelector('#dtab-evaluations')) return;
    const tabDiv = document.createElement('div');
    tabDiv.id = 'dtab-evaluations';
    tabDiv.style.display = 'none';
    tabDiv.innerHTML = `
      <div id="eval-kpis" class="eval-kpi-grid"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:14px">
        <div class="chart-card" id="eval-criteria-chart">
          <h3>📊 متوسط كل محور</h3>
          <div id="eval-bars"></div>
        </div>
        <div class="chart-card" id="eval-dist-chart">
          <h3>🏆 توزيع التقييم العام</h3>
          <div id="eval-dist"></div>
        </div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <h3 style="font-weight:800;color:var(--g1);margin-bottom:13px;font-size:.92rem">📋 تقييمات المتدربين</h3>
        <div class="tbl-scroll"><table>
          <thead><tr>
            <th>#</th><th>المتدرب</th>
            <th>وضوح الشرح</th><th>التنظيم</th>
            <th>التفاعل</th><th>الإلمام العلمي</th>
            <th>الرضا العام</th><th>المتوسط</th><th>التعليق</th>
          </tr></thead>
          <tbody id="eval-table"></tbody>
        </table></div>
      </div>
      <div class="card">
        <h3 style="font-weight:800;color:#92400e;margin-bottom:13px;font-size:.92rem">💬 التعليقات النصية</h3>
        <div id="eval-comments"></div>
      </div>
    `;
    dashScreen.appendChild(tabDiv);
  }

  async function showEvalTab() {
    // Hide other tabs
    document.querySelectorAll('[id^="dtab-"]').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.snbtn').forEach(b => b.classList.remove('active'));
    const tabDiv = document.getElementById('dtab-evaluations');
    if (tabDiv) tabDiv.style.display = 'block';
    const btn = document.getElementById('eval-tab-btn');
    if (btn) btn.classList.add('active');
    await renderEvalDashboard();
  }

  async function renderEvalDashboard() {
    const evals = await loadEvaluations();
    const trainees = window._trainees || [];

    // KPIs
    const kpisEl = document.getElementById('eval-kpis');
    if (kpisEl) {
      const totalEvals = evals.length;
      const totalTrainees = trainees.length;
      const pct = totalTrainees ? Math.round(totalEvals / totalTrainees * 100) : 0;
      const overallAvg = evals.length
        ? (evals.map(e => {
            const vals = Object.values(e.scores || {});
            return vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : 0;
          }).reduce((a,b) => a+b,0) / evals.length).toFixed(1)
        : '—';
      const withComments = evals.filter(e => e.comment && e.comment.length > 2).length;

      kpisEl.innerHTML = `
        <div class="eval-kpi"><div class="v">${totalEvals}</div><div class="l">عدد التقييمات</div></div>
        <div class="eval-kpi"><div class="v">${pct}%</div><div class="l">نسبة المشاركة</div></div>
        <div class="eval-kpi"><div class="v" style="font-size:1.4rem">${overallAvg} ⭐</div><div class="l">المتوسط العام</div></div>
        <div class="eval-kpi"><div class="v">${withComments}</div><div class="l">تعليقات نصية</div></div>
      `;
    }

    // Criteria bars
    const barsEl = document.getElementById('eval-bars');
    if (barsEl) {
      barsEl.innerHTML = CRITERIA.map(c => {
        const avg = parseFloat(avgScore(evals, c.key));
        const pct = isNaN(avg) ? 0 : avg / 5 * 100;
        const color = avg >= 4 ? '#f59e0b' : avg >= 3 ? '#d97706' : '#b45309';
        return `
          <div class="criteria-bar">
            <div class="lbl">
              <span>${c.label}</span>
              <span style="color:${color};font-weight:900">${isNaN(avg) ? '—' : avg + ' / 5'}</span>
            </div>
            <div class="bg"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
          </div>`;
      }).join('') || '<p style="color:var(--muted);font-size:.82rem">لا تقييمات بعد</p>';
    }

    // Distribution
    const distEl = document.getElementById('eval-dist');
    if (distEl) {
      const buckets = { '5 ⭐ ممتاز':0, '4 ⭐ جيد جداً':0, '3 ⭐ جيد':0, '2 ⭐ مقبول':0, '1 ⭐ ضعيف':0 };
      evals.forEach(e => {
        const vals = Object.values(e.scores || {});
        const avg = vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : 0;
        if (avg >= 4.5) buckets['5 ⭐ ممتاز']++;
        else if (avg >= 3.5) buckets['4 ⭐ جيد جداً']++;
        else if (avg >= 2.5) buckets['3 ⭐ جيد']++;
        else if (avg >= 1.5) buckets['2 ⭐ مقبول']++;
        else buckets['1 ⭐ ضعيف']++;
      });
      const maxB = Math.max(...Object.values(buckets), 1);
      const colors = ['#f59e0b','#fbbf24','#d97706','#b45309','#92400e'];
      distEl.innerHTML = Object.entries(buckets).map(([l,n],i) => `
        <div class="criteria-bar">
          <div class="lbl"><span>${l}</span><span style="color:${colors[i]};font-weight:900">${n}</span></div>
          <div class="bg"><div class="fill" style="width:${n/maxB*100}%;background:${colors[i]}"></div></div>
        </div>`).join('') || '<p style="color:var(--muted);font-size:.82rem">لا تقييمات بعد</p>';
    }

    // Table
    const tbody = document.getElementById('eval-table');
    if (tbody) {
      if (!evals.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">لا توجد تقييمات بعد — تظهر بعد إنهاء المتدربين اليوم الخامس</td></tr>';
      } else {
        tbody.innerHTML = evals.map((e, i) => {
          const vals = Object.values(e.scores || {});
          const avg = vals.length ? (vals.reduce((a,b) => a+b,0)/vals.length).toFixed(1) : '—';
          const color = avg >= 4 ? 'var(--g1)' : avg >= 3 ? 'var(--gold)' : 'var(--red)';
          return `<tr>
            <td>${i+1}</td>
            <td><strong>${e.name||'—'}</strong><br><span style="font-size:.7rem;color:var(--muted)">${e.dept||''}</span></td>
            ${CRITERIA.map(c => {
              const s = e.scores?.[c.key];
              return `<td style="text-align:center">${s ? renderStarsHTML(s, '.8rem') : '—'}</td>`;
            }).join('')}
            <td><strong style="color:${color}">${avg}</strong></td>
            <td style="font-size:.75rem;max-width:150px;white-space:normal">${e.comment ? `"${e.comment.slice(0,60)}${e.comment.length>60?'…':''}"` : '<span style="color:var(--muted)">—</span>'}</td>
          </tr>`;
        }).join('');
      }
    }

    // Comments
    const commentsEl = document.getElementById('eval-comments');
    if (commentsEl) {
      const withComments = evals.filter(e => e.comment && e.comment.length > 2);
      if (!withComments.length) {
        commentsEl.innerHTML = '<p style="color:var(--muted);font-size:.82rem;text-align:center;padding:16px">لا توجد تعليقات نصية بعد</p>';
      } else {
        commentsEl.innerHTML = withComments.map(e => `
          <div class="comment-bubble">
            <div class="cb-name">👤 ${e.name} — ${e.dept}</div>
            <div style="color:var(--muted);font-size:.75rem;margin-bottom:6px">${e.submittedAtDisplay||''}</div>
            "${e.comment}"
          </div>`).join('');
      }
    }
  }

  // ── Inject eval section in showTraineeReport ──────────────────────
  const _origShowReport = window.showTraineeReport;
  window.showTraineeReport = async function(id) {
    if (typeof _origShowReport === 'function') _origShowReport(id);
    // Append eval section to modal after it opens
    setTimeout(async () => {
      const body = document.getElementById('modal-body');
      if (!body) return;
      const existing = await getEvaluation(id);
      const evalSection = document.createElement('div');
      evalSection.style.marginTop = '14px';
      if (!existing) {
        evalSection.innerHTML = `
          <div style="background:var(--gold2);border:1.5px solid #fde68a;border-radius:13px;padding:14px;text-align:center">
            <div style="font-size:1.4rem;margin-bottom:6px">⭐</div>
            <div style="font-weight:800;color:#92400e;font-size:.88rem">لم يُقيّم هذا المتدرب المدرب بعد</div>
            <div style="font-size:.78rem;color:#78350f;margin-top:4px">سيظهر التقييم بعد إنهاء اليوم الخامس</div>
          </div>`;
      } else {
        const vals = Object.values(existing.scores || {});
        const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—';
        evalSection.innerHTML = `
          <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #fde68a;border-radius:13px;padding:16px">
            <div style="font-size:.85rem;font-weight:800;color:#92400e;margin-bottom:12px">⭐ تقييم المتدرب للمدرب</div>
            ${CRITERIA.map(c => `
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:.78rem;font-weight:700;color:#78350f">${c.label}</span>
                <span>${renderStarsHTML(existing.scores?.[c.key], '.9rem')}</span>
              </div>`).join('')}
            <div style="border-top:1px solid #fde68a;padding-top:10px;margin-top:6px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:.82rem;font-weight:900;color:#92400e">المتوسط العام</span>
              <span style="font-size:1.1rem;font-weight:900;color:#f59e0b">${avg} / 5 ${renderStarsHTML(Math.round(parseFloat(avg)||0),'1rem')}</span>
            </div>
            ${existing.comment ? `
              <div style="background:#fff;border-radius:9px;padding:10px 12px;margin-top:10px;font-size:.8rem;color:var(--muted);line-height:1.7">
                <strong style="color:#92400e">💬 تعليق المتدرب:</strong><br>"${existing.comment}"
              </div>` : ''}
          </div>`;
      }
      body.appendChild(evalSection);
    }, 300);
  };

  // ── Firebase live sync for evaluations ───────────────────────────
  function startEvalLiveSync() {
    const f = fb();
    if (!f) return;
    f.onValue(f.ref(f.db, 'training/evaluations'), snap => {
      const btn = document.getElementById('eval-tab-btn');
      if (!btn) return;
      const count = snap.exists() ? Object.keys(snap.val()).length : 0;
      // Update badge if tab is visible
      const tabActive = document.getElementById('dtab-evaluations')?.style.display !== 'none';
      if (tabActive) renderEvalDashboard();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    injectEvalTab();
    // Hook into startFirebaseLiveSync
    const _origStart = window.startFirebaseLiveSync;
    window.startFirebaseLiveSync = function() {
      if (typeof _origStart === 'function') _origStart();
      setTimeout(startEvalLiveSync, 500);
    };
    // If already started
    if (window._fbLive) setTimeout(startEvalLiveSync, 200);
    // Hook loadDash to inject tab
    const _origLoadDash = window.loadDash;
    window.loadDash = async function() {
      if (typeof _origLoadDash === 'function') await _origLoadDash();
      injectEvalTab();
    };
    console.log('✅ Trainer evaluation patch loaded');
  }

  // Wait for DOM + DAYS
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 200);
  }

  // Also hook renderDayContent after DAYS loads
  function hookRenderDayContent() {
    if (typeof window.renderDayContent === 'undefined') {
      setTimeout(hookRenderDayContent, 150);
      return;
    }
    const _orig = window.renderDayContent;
    if (_orig.__evalHooked) return;
    window.renderDayContent = async function() {
      _orig();
      setTimeout(async () => {
        const t = window.activeTrainee;
        const d = window.activeDay;
        if (!t || !d || d.id !== 5) return;
        const results = window._results || {};
        const day5done = results[t.id]?.[5]?.quizScore !== undefined;
        if (!day5done) return;
        const dc = document.getElementById('day-content');
        if (!dc) return;
        if (dc.querySelector('#eval-section')) return;
        const existing = await getEvaluation(t.id);
        const evalDiv = document.createElement('div');
        evalDiv.id = 'eval-section';
        evalDiv.style.marginTop = '14px';
        evalDiv.innerHTML = existing
          ? `<div class="eval-submitted">
               <div style="font-size:1.6rem;margin-bottom:8px">✅</div>
               <div style="font-weight:900;color:#065f46">لقد قمت بتقييم المدرب مسبقاً</div>
               <div style="font-size:.8rem;color:#047857;margin-top:4px">تم تسجيل تقييمك — شكراً!</div>
             </div>`
          : buildEvalForm(t.id);
        dc.appendChild(evalDiv);
      }, 500);
    };
    window.renderDayContent.__evalHooked = true;
  }
  setTimeout(hookRenderDayContent, 300);

})();
