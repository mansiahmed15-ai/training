// ═══════════════════════════════════════════════════════════════════════
//  PATCH v3 — نظام تقييم المدرب
//  الحل: حقن الاستمارة مباشرة في شاشة نتيجة اليوم الخامس
//  أضف قبل </body>:  <script src="trainer_eval_patch.js"></script>
// ═══════════════════════════════════════════════════════════════════════
(function() {
'use strict';

// ── CSS ──────────────────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
.ev-wrap{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #fde68a;
  border-radius:16px;padding:20px;margin-top:16px}
.ev-done{background:linear-gradient(135deg,#d1fae5,#a7f3d0);border:2px solid #6ee7b7;
  border-radius:16px;padding:22px;margin-top:16px;text-align:center}
.ev-row{display:flex;align-items:center;justify-content:space-between;
  margin-bottom:13px;flex-wrap:wrap;gap:6px}
.ev-row span{font-size:.83rem;font-weight:700;color:#78350f;flex:1;min-width:130px}
.ev-stars{display:flex;gap:5px;direction:ltr}
.ev-stars button{background:none;border:none;font-size:1.6rem;cursor:pointer;
  color:#d1d5db;transition:color .12s,transform .12s;padding:0;line-height:1}
.ev-stars button.on{color:#f59e0b}
.ev-stars button:hover{transform:scale(1.18)}
.ev-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  gap:10px;margin-bottom:16px}
.ev-kpi{background:#fff;border-radius:13px;border:1.5px solid #fde68a;
  padding:14px;text-align:center}
.ev-kpi .v{font-size:1.8rem;font-weight:900;color:#f59e0b;line-height:1;margin-bottom:3px}
.ev-kpi .l{font-size:.68rem;color:var(--muted);font-weight:600}
.ev-cbar{margin-bottom:9px}
.ev-cbar .cl{display:flex;justify-content:space-between;font-size:.76rem;
  font-weight:700;margin-bottom:3px}
.ev-cbar .bg{background:var(--border);border-radius:5px;height:10px;overflow:hidden}
.ev-cbar .fill{height:100%;border-radius:5px;
  background:linear-gradient(90deg,#f59e0b,#fbbf24);transition:width 1s .1s}
.ev-comment{background:#fff;border:1.5px solid var(--border);border-radius:11px;
  padding:11px 13px;margin-bottom:8px;font-size:.82rem;line-height:1.7}
.ev-comment .cn{font-weight:800;color:var(--g1);font-size:.76rem;margin-bottom:3px}
.ev-stars-display{display:inline-flex;gap:1px;font-size:.9rem}
.ev-stars-display .f{color:#f59e0b}.ev-stars-display .e{color:#d1d5db}
</style>`);

// ── Criteria ──────────────────────────────────────────────────────────
const CRIT = [
  {key:'clarity',      label:'وضوح الشرح والأسلوب'},
  {key:'organization', label:'التنظيم والتحضير'},
  {key:'interaction',  label:'التفاعل مع المتدربين'},
  {key:'knowledge',    label:'الإلمام بالمادة العلمية'},
  {key:'overall',      label:'الرضا العام عن التدريب'}
];

// ── Star display ─────────────────────────────────────────────────────
function starsDisp(n, size) {
  n = Math.round(n||0); size = size||'1rem';
  return `<span class="ev-stars-display" style="font-size:${size}">`+
    [1,2,3,4,5].map(i=>`<span class="${i<=n?'f':'e'}">★</span>`).join('')+'</span>';
}

// ── Storage ──────────────────────────────────────────────────────────
async function saveEval(tid, scores, comment) {
  const t = (window._trainees||[]).find(x=>x.id===tid);
  const data = {
    tid, name:t?t.name:tid, dept:t?t.dept:'',
    scores, comment:comment||'',
    submittedAt: new Date().toISOString(),
    submittedAtDisplay: new Date().toLocaleString('ar-SA')
  };
  try { localStorage.setItem('ev_'+tid, JSON.stringify(data)); } catch {}
  const f = window.FB;
  if (f) {
    try { await f.set(f.ref(f.db,'training/evaluations/'+tid), data); }
    catch(e) { console.warn('eval save:', e.message); }
  }
  return data;
}

async function getEval(tid) {
  const f = window.FB;
  if (f) {
    try {
      const snap = await f.get(f.ref(f.db,'training/evaluations/'+tid));
      if (snap.exists()) return snap.val();
    } catch {}
  }
  try { const v=localStorage.getItem('ev_'+tid); if(v) return JSON.parse(v); } catch {}
  return null;
}

async function getAllEvals() {
  const f = window.FB;
  if (f) {
    try {
      const snap = await f.get(f.ref(f.db,'training/evaluations'));
      if (snap.exists()) return Object.values(snap.val());
    } catch {}
  }
  const out=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith('ev_')){try{out.push(JSON.parse(localStorage.getItem(k)));}catch{}}
  }
  return out;
}

// ── Build form HTML ───────────────────────────────────────────────────
function buildForm(tid) {
  const rows = CRIT.map(c=>`
    <div class="ev-row">
      <span>${c.label}</span>
      <div class="ev-stars" id="evs-${c.key}" data-key="${c.key}" data-val="0">
        ${[1,2,3,4,5].map(n=>`<button type="button" data-n="${n}"
          onclick="window._evStar('${c.key}',${n})">★</button>`).join('')}
      </div>
    </div>`).join('');

  return `<div class="ev-wrap" id="ev-form-${tid}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div style="width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#f59e0b,#fbbf24);
        display:flex;align-items:center;justify-content:center;
        font-size:1.4rem;flex-shrink:0">⭐</div>
      <div>
        <div style="font-weight:900;color:#92400e;font-size:.95rem">قيّم المدرب</div>
        <div style="font-size:.75rem;color:#b45309;margin-top:1px">
          رأيك يساعدنا على تحسين جودة التدريب</div>
      </div>
    </div>
    ${rows}
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:.78rem;font-weight:700;
        color:#92400e;margin-bottom:5px">💬 تعليقات إضافية (اختياري)</label>
      <textarea id="ev-cmt-${tid}" class="inp" rows="3"
        placeholder="شاركنا رأيك..."
        style="border-color:#fde68a;background:#fffbeb;resize:vertical"></textarea>
    </div>
    <div id="ev-err-${tid}" style="display:none;color:var(--red);
      font-size:.8rem;text-align:center;margin-bottom:8px"></div>
    <button type="button" onclick="window._evSubmit('${tid}')"
      style="width:100%;padding:12px;
        background:linear-gradient(135deg,#f59e0b,#d97706);
        color:#fff;border:none;border-radius:11px;
        font-family:'Tajawal',sans-serif;font-size:.95rem;
        font-weight:800;cursor:pointer;
        box-shadow:0 4px 14px rgba(245,158,11,.3)">
      ⭐ إرسال التقييم
    </button>
  </div>`;
}

// ── Star click handler ────────────────────────────────────────────────
window._evStar = function(key, n) {
  const container = document.getElementById('evs-'+key);
  if (!container) return;
  container.dataset.val = n;
  container.querySelectorAll('button').forEach((btn,i) => {
    btn.classList.toggle('on', i < n);
  });
};

// ── Submit ────────────────────────────────────────────────────────────
window._evSubmit = async function(tid) {
  const scores = {};
  const missing = [];
  CRIT.forEach(c => {
    const container = document.getElementById('evs-'+c.key);
    const val = container ? parseInt(container.dataset.val||0) : 0;
    if (val >= 1) scores[c.key] = val;
    else missing.push(c.label);
  });

  if (missing.length) {
    const errEl = document.getElementById('ev-err-'+tid);
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ يرجى تقييم: ' + missing.slice(0,2).join('، ') +
        (missing.length > 2 ? ' ...' : '');
    }
    return;
  }

  const cmtEl = document.getElementById('ev-cmt-'+tid);
  const comment = cmtEl ? cmtEl.value.trim() : '';

  const formEl = document.getElementById('ev-form-'+tid);
  if (formEl) formEl.innerHTML =
    '<div style="text-align:center;padding:20px;color:var(--g1)">⏳ جارٍ الإرسال...</div>';

  await saveEval(tid, scores, comment);

  const avg = (Object.values(scores).reduce((a,b)=>a+b,0) / CRIT.length).toFixed(1);

  if (formEl) {
    formEl.className = 'ev-done';
    formEl.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:8px">🎉</div>
      <div style="font-weight:900;color:#065f46;font-size:1.05rem;margin-bottom:5px">
        شكراً على تقييمك!</div>
      <div style="font-size:.85rem;color:#047857;margin-bottom:12px">
        تم إرسال تقييمك بنجاح</div>
      <div style="font-size:1.5rem">${starsDisp(Math.round(parseFloat(avg)), '1.5rem')}</div>
      <div style="font-size:.85rem;color:#065f46;font-weight:700;margin-top:6px">
        متوسط تقييمك: ${avg} / 5</div>`;
  }
  if (window.toast) window.toast('⭐ شكراً على تقييمك!');
};

// ── CORE: Inject eval into day-content after Day 5 result shows ───────
// The key insight: we patch the renderQuizResult / showDayResult function
// OR we watch for the result screen element appearing

function injectEvalNow(tid) {
  const dc = document.getElementById('day-content');
  if (!dc) return;
  // Already injected?
  if (dc.querySelector('[id^="ev-form-"],[class="ev-done"],[id^="ev-injected"]'))
    return;

  (async () => {
    const existing = await getEval(tid);
    const wrap = document.createElement('div');
    wrap.id = 'ev-injected';

    if (existing) {
      const avg = (Object.values(existing.scores||{})
        .reduce((a,b)=>a+b,0)/CRIT.length).toFixed(1);
      wrap.innerHTML = `<div class="ev-done">
        <div style="font-size:1.6rem;margin-bottom:8px">✅</div>
        <div style="font-weight:900;color:#065f46;font-size:.95rem;margin-bottom:4px">
          لقد قيّمت المدرب مسبقاً</div>
        <div style="font-size:1.3rem;margin:8px 0">${starsDisp(Math.round(parseFloat(avg)),'1.3rem')}</div>
        <div style="font-size:.8rem;color:#047857">متوسط تقييمك: ${avg} / 5</div>
      </div>`;
    } else {
      wrap.innerHTML = buildForm(tid);
    }
    dc.appendChild(wrap);
  })();
}

// Watch day-content with MutationObserver + interval backup
let _lastTid = null;
let _lastDay = null;
let _injected = false;

function checkAndInject() {
  const t = window.activeTrainee;
  const d = window.activeDay;
  if (!t || !d || d.id !== 5) {
    _injected = false;
    _lastTid = null;
    return;
  }
  if (_injected && _lastTid === t.id) return;

  const results = window._results || {};
  if (!results[t.id]?.[5]?.quizScore !== false &&
       results[t.id]?.[5]?.quizScore === undefined) return;

  // Day 5 done
  _injected = true;
  _lastTid = t.id;
  injectEvalNow(t.id);
}

// MutationObserver on day-content
function startObserver() {
  const dc = document.getElementById('day-content');
  if (!dc) { setTimeout(startObserver, 500); return; }
  const obs = new MutationObserver(() => {
    const t = window.activeTrainee;
    const d = window.activeDay;
    if (t && d && d.id === 5) {
      // Reset injected flag if content changed
      const evEl = dc.querySelector('[id^="ev-form-"],[class="ev-done"],[id^="ev-injected"]');
      if (!evEl) _injected = false;
      setTimeout(checkAndInject, 200);
    }
  });
  obs.observe(dc, {childList: true, subtree: true});
}

// Also hook openTraineePage to reset state
const _origOpen = window.openTraineePage;
window.openTraineePage = async function(tid) {
  _injected = false;
  _lastTid = null;
  if (typeof _origOpen === 'function') await _origOpen(tid);
  startObserver();
  // Multiple delayed checks
  [800, 1500, 3000, 5000].forEach(ms =>
    setTimeout(checkAndInject, ms));
};

// Interval backup every 800ms
setInterval(checkAndInject, 800);

// ── Dashboard tab ─────────────────────────────────────────────────────
function injectDashTab() {
  if (document.getElementById('ev-tab-btn')) return;
  const subnav = document.querySelector('.subnav');
  if (!subnav) return;

  const btn = document.createElement('button');
  btn.className = 'snbtn';
  btn.id = 'ev-tab-btn';
  btn.textContent = '⭐ تقييمات المدرب';
  btn.onclick = showEvalTab;
  subnav.appendChild(btn);

  const dash = document.getElementById('s-dashboard');
  if (!dash || document.getElementById('dtab-evaluations')) return;

  const tab = document.createElement('div');
  tab.id = 'dtab-evaluations';
  tab.style.display = 'none';
  tab.innerHTML = `
    <div id="ev-kpis" class="ev-kpis"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:14px">
      <div class="chart-card"><h3>📊 متوسط كل محور</h3><div id="ev-bars"></div></div>
      <div class="chart-card"><h3>🏆 توزيع التقييم</h3><div id="ev-dist"></div></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <h3 style="font-weight:800;color:var(--g1);margin-bottom:13px;font-size:.92rem">
        📋 تقييمات المتدربين</h3>
      <div class="tbl-scroll"><table>
        <thead><tr>
          <th>#</th><th>المتدرب</th>
          <th>وضوح الشرح</th><th>التنظيم</th>
          <th>التفاعل</th><th>الإلمام</th>
          <th>الرضا العام</th><th>المتوسط</th><th>التعليق</th>
        </tr></thead>
        <tbody id="ev-tbl"></tbody>
      </table></div>
    </div>
    <div class="card">
      <h3 style="font-weight:800;color:#92400e;margin-bottom:13px;font-size:.92rem">
        💬 التعليقات النصية</h3>
      <div id="ev-cmts"></div>
    </div>`;
  dash.appendChild(tab);
}

async function showEvalTab() {
  document.querySelectorAll('[id^="dtab-"]').forEach(t => t.style.display='none');
  document.querySelectorAll('.snbtn').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById('dtab-evaluations');
  if (tab) tab.style.display = 'block';
  const btn = document.getElementById('ev-tab-btn');
  if (btn) btn.classList.add('active');
  await renderEvalDash();
}

async function renderEvalDash() {
  const evals = await getAllEvals();
  const trainees = window._trainees || [];

  // KPIs
  const kEl = document.getElementById('ev-kpis');
  if (kEl) {
    const tot = evals.length;
    const pct = trainees.length ? Math.round(tot/trainees.length*100) : 0;
    const allVals = evals.flatMap(e => Object.values(e.scores||{}));
    const overallAvg = allVals.length
      ? (allVals.reduce((a,b)=>a+b,0) / allVals.length).toFixed(1) : '—';
    const withCmt = evals.filter(e => e.comment && e.comment.length > 2).length;
    kEl.innerHTML = `
      <div class="ev-kpi"><div class="v">${tot}</div><div class="l">عدد التقييمات</div></div>
      <div class="ev-kpi"><div class="v">${pct}%</div><div class="l">نسبة المشاركة</div></div>
      <div class="ev-kpi"><div class="v" style="font-size:1.3rem">${overallAvg}⭐</div>
        <div class="l">المتوسط العام</div></div>
      <div class="ev-kpi"><div class="v">${withCmt}</div>
        <div class="l">تعليقات نصية</div></div>`;
  }

  // Bars
  const bEl = document.getElementById('ev-bars');
  if (bEl) {
    if (!evals.length) {
      bEl.innerHTML = '<p style="color:var(--muted);font-size:.82rem;padding:16px;text-align:center">لا تقييمات بعد</p>';
    } else {
      bEl.innerHTML = CRIT.map(c => {
        const vals = evals.map(e=>e.scores?.[c.key]).filter(v=>v!==undefined);
        const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null;
        const pct = avg ? parseFloat(avg)/5*100 : 0;
        const col = avg>=4?'#f59e0b':avg>=3?'#d97706':'#b45309';
        return `<div class="ev-cbar">
          <div class="cl">
            <span>${c.label}</span>
            <span style="color:${col};font-weight:900">${avg?avg+'/5':'—'}</span>
          </div>
          <div class="bg"><div class="fill" style="width:${pct}%;background:${col}"></div></div>
        </div>`;
      }).join('');
    }
  }

  // Distribution
  const dEl = document.getElementById('ev-dist');
  if (dEl) {
    const B = {'5⭐ ممتاز':0,'4⭐ جيد جداً':0,'3⭐ جيد':0,'2⭐ مقبول':0,'1⭐ ضعيف':0};
    evals.forEach(e => {
      const v = Object.values(e.scores||{});
      const a = v.length ? v.reduce((x,y)=>x+y,0)/v.length : 0;
      if (a>=4.5) B['5⭐ ممتاز']++;
      else if (a>=3.5) B['4⭐ جيد جداً']++;
      else if (a>=2.5) B['3⭐ جيد']++;
      else if (a>=1.5) B['2⭐ مقبول']++;
      else B['1⭐ ضعيف']++;
    });
    const mx = Math.max(...Object.values(B), 1);
    const cols = ['#f59e0b','#fbbf24','#d97706','#b45309','#92400e'];
    dEl.innerHTML = Object.entries(B).map(([l,n],i) => `
      <div class="ev-cbar">
        <div class="cl">
          <span>${l}</span>
          <span style="color:${cols[i]};font-weight:900">${n}</span>
        </div>
        <div class="bg">
          <div class="fill" style="width:${n/mx*100}%;background:${cols[i]}"></div>
        </div>
      </div>`).join('');
  }

  // Table
  const tbEl = document.getElementById('ev-tbl');
  if (tbEl) {
    if (!evals.length) {
      tbEl.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">' +
        'لا توجد تقييمات — تظهر بعد إنهاء المتدربين اليوم الخامس</td></tr>';
    } else {
      tbEl.innerHTML = evals.map((e,i) => {
        const v = Object.values(e.scores||{});
        const avg = v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : '—';
        const col = avg>=4?'var(--g1)':avg>=3?'var(--gold)':'var(--red)';
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${e.name||'—'}</strong><br>
            <span style="font-size:.7rem;color:var(--muted)">${e.dept||''}</span></td>
          ${CRIT.map(c => `<td style="text-align:center">
            ${e.scores?.[c.key] ? starsDisp(e.scores[c.key],'.8rem') : '—'}</td>`).join('')}
          <td><strong style="color:${col}">${avg}</strong></td>
          <td style="font-size:.74rem;max-width:120px;white-space:normal">
            ${e.comment
              ? `"${e.comment.slice(0,50)}${e.comment.length>50?'…':''}"`
              : '<span style="color:var(--muted)">—</span>'}</td>
        </tr>`;
      }).join('');
    }
  }

  // Comments
  const cmEl = document.getElementById('ev-cmts');
  if (cmEl) {
    const wc = evals.filter(e => e.comment && e.comment.length > 2);
    cmEl.innerHTML = wc.length
      ? wc.map(e => `<div class="ev-comment">
          <div class="cn">👤 ${e.name} — ${e.dept}</div>
          <div style="color:var(--muted);font-size:.72rem;margin-bottom:5px">
            ${e.submittedAtDisplay||''}</div>
          "${e.comment}"
        </div>`).join('')
      : '<p style="color:var(--muted);font-size:.82rem;text-align:center;padding:16px">' +
        'لا توجد تعليقات بعد</p>';
  }
}

// ── Report hook ───────────────────────────────────────────────────────
const _origReport = window.showTraineeReport;
window.showTraineeReport = async function(id) {
  if (typeof _origReport === 'function') _origReport(id);
  setTimeout(async () => {
    const body = document.getElementById('modal-body');
    if (!body || body.querySelector('#ev-rep-sec')) return;
    const existing = await getEval(id);
    const sec = document.createElement('div');
    sec.id = 'ev-rep-sec';
    sec.style.marginTop = '14px';
    if (!existing) {
      sec.innerHTML = `<div style="background:var(--gold2);border:1.5px solid #fde68a;
        border-radius:13px;padding:14px;text-align:center">
        <div style="font-size:1.3rem;margin-bottom:5px">⭐</div>
        <div style="font-weight:800;color:#92400e;font-size:.85rem">
          لم يُقيّم هذا المتدرب المدرب بعد</div>
      </div>`;
    } else {
      const v = Object.values(existing.scores||{});
      const avg = v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : '—';
      sec.innerHTML = `
        <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);
          border:1.5px solid #fde68a;border-radius:13px;padding:16px">
          <div style="font-size:.85rem;font-weight:800;color:#92400e;margin-bottom:11px">
            ⭐ تقييم المتدرب للمدرب</div>
          ${CRIT.map(c => `
            <div style="display:flex;justify-content:space-between;
              align-items:center;margin-bottom:8px">
              <span style="font-size:.78rem;font-weight:700;color:#78350f">
                ${c.label}</span>
              ${starsDisp(existing.scores?.[c.key]||0, '.95rem')}
            </div>`).join('')}
          <div style="border-top:1px solid #fde68a;padding-top:9px;margin-top:4px;
            display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:.82rem;font-weight:900;color:#92400e">
              المتوسط العام</span>
            <span style="font-size:1.1rem;font-weight:900;color:#f59e0b">
              ${avg}/5 ${starsDisp(Math.round(parseFloat(avg)||0),'1rem')}</span>
          </div>
          ${existing.comment
            ? `<div style="background:#fff;border-radius:9px;padding:9px 12px;
                 margin-top:9px;font-size:.8rem;color:var(--muted);line-height:1.7">
               <strong style="color:#92400e">💬</strong> "${existing.comment}"</div>`
            : ''}
        </div>`;
    }
    body.appendChild(sec);
  }, 400);
};

// ── Init ──────────────────────────────────────────────────────────────
function init() {
  injectDashTab();

  // Hook loadDash
  const _origLoadDash = window.loadDash;
  window.loadDash = async function() {
    if (typeof _origLoadDash === 'function') await _origLoadDash();
    injectDashTab();
  };

  // Firebase live sync
  const _origFBSync = window.startFirebaseLiveSync;
  window.startFirebaseLiveSync = function() {
    if (typeof _origFBSync === 'function') _origFBSync();
    const f = window.FB;
    if (f) {
      f.onValue(f.ref(f.db,'training/evaluations'), () => {
        const tab = document.getElementById('dtab-evaluations');
        if (tab && tab.style.display !== 'none') renderEvalDash();
      });
    }
  };

  startObserver();
  console.log('✅ Trainer eval patch v3 ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
} else {
  setTimeout(init, 200);
}

})();
