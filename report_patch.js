// ═══════════════════════════════════════════════════════════════════
//  REPORT PATCH — يُضاف بعد </script> الرئيسي في index.html
//  الملف: report_patch.js  أو انسخ المحتوى مباشرة في <script> جديد
// ═══════════════════════════════════════════════════════════════════
console.log("✅ report_patch.js LOADED");
(function patchReports() {

  // Override renderPerformance to add the report column
  window.renderPerformance = function() {
    const avgs = _trainees.map(t=>getAvg(t.id)).filter(a=>a!==null);
    const overallAvg = avgs.length ? Math.round(avgs.reduce((a,b)=>a+b,0)/avgs.length) : 0;
    const passed = avgs.filter(a=>a>=60).length;
    const completed = _trainees.filter(t=>DAYS.every(d=>_results[t.id]?.[d.id]?.quizScore!==undefined)).length;

    document.getElementById('perf-kpis').innerHTML=`
      <div class="kpi g"><div class="v">${_trainees.length}</div><div class="l">إجمالي المتدربين</div></div>
      <div class="kpi go"><div class="v">${overallAvg}%</div><div class="l">متوسط الدرجات</div></div>
      <div class="kpi g"><div class="v">${passed}</div><div class="l">ناجح ≥60%</div></div>
      <div class="kpi r"><div class="v">${_trainees.length-passed}</div><div class="l">راسب &lt;60%</div></div>
      <div class="kpi b"><div class="v">${completed}</div><div class="l">أكمل 5 أيام</div></div>
    `;

    const ranked = [..._trainees].map(t=>({...t,avg:getAvg(t.id)})).filter(t=>t.avg!==null).sort((a,b)=>b.avg-a.avg);
    const maxAvg = Math.max(...ranked.map(t=>t.avg),1);
    document.getElementById('rank-chart').innerHTML = ranked.map((t,i)=>{
      const col = t.avg>=80?'var(--g1)':t.avg>=60?'var(--gold)':'var(--red)';
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      return `<div class="bar-row"><div class="bar-lbl">${medal}${t.name.split(' ')[0]}</div><div class="bar-bg"><div class="bar-fill" style="width:${t.avg/maxAvg*100}%;background:${col}"></div></div><div class="bar-num" style="color:${col}">${t.avg}%</div></div>`;
    }).join('') || '<p style="color:var(--muted);font-size:.82rem">لا بيانات بعد</p>';

    const dayAvgs = DAYS.map(d=>{
      const scores = _trainees.map(t=>_results[t.id]?.[d.id]?.quizScore).filter(s=>s!==undefined);
      return {day:d.id, avg: scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null};
    });
    const maxDA = Math.max(...dayAvgs.map(d=>d.avg||0),1);
    document.getElementById('day-avg-chart').innerHTML = dayAvgs.map(d=>`
      <div class="bar-row">
        <div class="bar-lbl">اليوم ${d.day}</div>
        <div class="bar-bg"><div class="bar-fill" style="width:${d.avg?d.avg/maxDA*100:0}%;background:${d.avg>=80?'var(--g2)':d.avg>=60?'var(--gold)':'var(--red)'}"></div></div>
        <div class="bar-num" style="color:var(--g1)">${d.avg!==null?d.avg+'%':'—'}</div>
      </div>`).join('');

    const excellent=avgs.filter(a=>a>=85).length, good=avgs.filter(a=>a>=70&&a<85).length,
          pass=avgs.filter(a=>a>=60&&a<70).length, fail=avgs.filter(a=>a<60).length;
    document.getElementById('level-dist').innerHTML = [
      ['ممتاز ≥85%',excellent,'var(--g1)'],['جيد 70-84%',good,'var(--blue)'],
      ['مقبول 60-69%',pass,'var(--gold)'],['ضعيف <60%',fail,'var(--red)']
    ].map(([l,n,c])=>`<div class="bar-row"><div class="bar-lbl">${l}</div><div class="bar-bg"><div class="bar-fill" style="width:${_trainees.length?n/_trainees.length*100:0}%;background:${c}"></div></div><div class="bar-num" style="color:${c}">${n}</div></div>`).join('');

    // ── جدول الأداء مع عمود التقرير ──────────────────────────────
    // تحديث رأس الجدول أولاً
    const perfThead = document.querySelector('#dtab-performance table thead tr');
    if (perfThead && !perfThead.querySelector('th:last-child')?.textContent?.includes('التقرير')) {
      const th = document.createElement('th');
      th.textContent = 'التقرير';
      perfThead.appendChild(th);
    }

    document.getElementById('perf-table').innerHTML = _trainees.map((t,i)=>{
      const avg = getAvg(t.id);
      const level = avg===null?'—':avg>=85?'ممتاز':avg>=70?'جيد جداً':avg>=60?'مقبول':'ضعيف';
      const lcls = avg===null?'gr':avg>=85?'g':avg>=70?'b':avg>=60?'go':'r';
      const allDone = DAYS.every(d=>_results[t.id]?.[d.id]?.quizScore!==undefined);
      const doneCount = DAYS.filter(d=>_results[t.id]?.[d.id]?.quizScore!==undefined).length;

      const reportBtn = allDone
        ? `<button onclick="showTraineeReport('${t.id}')"
             style="background:linear-gradient(135deg,var(--g1),var(--g2));color:#fff;border:none;
                    border-radius:9px;padding:5px 12px;font-family:'Tajawal',sans-serif;
                    font-size:.75rem;font-weight:800;cursor:pointer;white-space:nowrap;
                    box-shadow:0 2px 8px rgba(10,92,62,.25);transition:.18s"
             onmouseover="this.style.transform='translateY(-1px)'"
             onmouseout="this.style.transform=''">
             📋 تقرير
           </button>`
        : `<span style="font-size:.72rem;color:var(--muted);white-space:nowrap">${doneCount}/5 أيام</span>`;

      return `<tr>
        <td>${i+1}</td>
        <td><strong>${t.name}</strong><br><span style="font-size:.7rem;color:var(--muted)">${t.dept}</span></td>
        ${DAYS.map(d=>{
          const r = _results[t.id]?.[d.id];
          if (r===undefined) return `<td style="color:var(--muted)">—</td>`;
          if (r.absent) return `<td><strong style="color:var(--red)">0%</strong><br><span style="font-size:.65rem;color:var(--red)">غياب</span></td>`;
          const s = r.quizScore;
          return `<td><strong style="color:${s>=80?'var(--g1)':s>=60?'var(--gold)':'var(--red)'}">${s}%</strong></td>`;
        }).join('')}
        <td><strong style="color:${avg>=80?'var(--g1)':avg>=60?'var(--gold)':'var(--red)'}">${avg!==null?avg+'%':'—'}</strong></td>
        <td><span class="badge ${lcls}">${level}</span></td>
        <td style="text-align:center">${reportBtn}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px">لا بيانات بعد</td></tr>';
  };

  // ── showTraineeReport ─────────────────────────────────────────────
  window.showTraineeReport = function(id) {
    const t = _trainees.find(x=>x.id===id);
    if (!t) return;

    const avg = getAvg(id);
    const att = getAttCount(id);
    const level = avg>=85?'ممتاز':avg>=70?'جيد جداً':avg>=60?'مقبول':'ضعيف';

    const dayData = DAYS.map(d=>{
      const r = _results[id]?.[d.id] || {};
      const attVal = (_attendance[id]||{})[d.id]||'none';
      return { day:d, quiz:r.quizScore, ex:r.exerciseScore, wrongQs:r.wrongQs||[], absent:r.absent, attVal };
    });

    const strong   = dayData.filter(x=>x.quiz>=85);
    const weak     = dayData.filter(x=>x.quiz!==undefined&&(x.quiz<60||x.absent));
    const allWrong = dayData.flatMap(x=>x.wrongQs.map(q=>`يوم ${x.day.id} — ${q}`));
    const absentDays  = dayData.filter(x=>x.attVal==='absent'||x.absent).map(x=>`اليوم ${x.day.id}`);
    const excusedDays = dayData.filter(x=>x.attVal==='excused').map(x=>`اليوم ${x.day.id}`);

    const rec = avg>=85
      ? 'أداء متميز يعكس إلماماً عميقاً بأسس سحب العينات الغذائية. مرشح لأدوار قيادية وتدريب الزملاء.'
      : avg>=70
      ? 'أداء جيد جداً مع وجود فجوات بسيطة. يُنصح بمراجعة محاور الأيام الأضعف وإعادة الاختبار الخاص بها.'
      : avg>=60
      ? 'أداء مقبول يحتاج تعزيزاً. يُوصى بمتابعة تدريبية إضافية في المحاور التي تقل فيها الدرجة عن 60%.'
      : 'يحتاج إعادة التدريب في أغلب المحاور مع متابعة مكثفة من المدرب المختص.';

    const circles = dayData.map(x=>{
      const s=x.quiz;
      const bg    = s===undefined?'var(--bg)':s>=85?'#d1fae5':s>=60?'var(--gold2)':'var(--red2)';
      const border= s===undefined?'var(--border)':s>=85?'#059669':s>=60?'var(--gold)':'var(--red)';
      const tcolor= s===undefined?'var(--muted)':s>=85?'#065f46':s>=60?'#78350f':'#7f1d1d';
      const txt   = s===undefined?'—':(x.absent?'غ':s+'%');
      return `<div style="flex:1;text-align:center">
        <div style="width:50px;height:50px;border-radius:50%;background:${bg};border:2.5px solid ${border};display:flex;align-items:center;justify-content:center;margin:0 auto 5px;font-size:.7rem;font-weight:900;color:${tcolor}">${txt}</div>
        <div style="font-size:.62rem;color:var(--muted);font-weight:600">يوم ${x.day.id}</div>
      </div>`;
    }).join('');

    const dayBars = dayData.map(x=>{
      const s=x.quiz;
      const fill=s===undefined?'var(--border)':s>=85?'#059669':s>=70?'var(--blue)':s>=60?'var(--gold)':'var(--red)';
      return `<div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:.74rem;font-weight:700;color:var(--text)">اليوم ${x.day.id}: ${x.day.title.length>20?x.day.title.slice(0,20)+'…':x.day.title}</span>
          <span style="font-size:.74rem;font-weight:900;color:${fill}">${s!==undefined?s+'%':(x.absent?'غياب':'—')}</span>
        </div>
        <div style="background:var(--border);border-radius:6px;height:7px;overflow:hidden">
          <div style="height:100%;border-radius:6px;background:${fill};width:${s||0}%;transition:width 1s ease"></div>
        </div>
      </div>`;
    }).join('');

    const initials = t.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();

    openModal(`📋 التقرير الشامل — ${t.name}`, `
      <div dir="rtl">
        <div style="background:linear-gradient(135deg,#0a5c3e,#12a06e);border-radius:16px;padding:20px;text-align:center;color:#fff;margin-bottom:16px">
          <div style="width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;margin:0 auto 10px">${initials}</div>
          <h3 style="font-weight:900;font-size:1.15rem;margin:0 0 3px">${t.name}</h3>
          <p style="opacity:.85;font-size:.82rem;margin:0 0 12px">${t.dept} · ${t.spec}</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px 16px;text-align:center"><div style="font-size:1.5rem;font-weight:900">${avg!==null?avg+'%':'—'}</div><div style="font-size:.68rem;opacity:.8">المتوسط العام</div></div>
            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px 16px;text-align:center"><div style="font-size:1.5rem;font-weight:900">${att}/5</div><div style="font-size:.68rem;opacity:.8">أيام الحضور</div></div>
            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px 16px;text-align:center"><div style="font-size:1.1rem;font-weight:900">${level}</div><div style="font-size:.68rem;opacity:.8">المستوى</div></div>
          </div>
        </div>
        <div style="background:var(--g4);border-radius:13px;padding:13px;margin-bottom:13px">
          <div style="font-size:.8rem;font-weight:800;color:var(--g1);margin-bottom:10px">📊 نتائج الأيام الخمسة</div>
          <div style="display:flex;gap:6px;justify-content:space-between">${circles}</div>
        </div>
        <div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:13px">
          <div style="font-size:.8rem;font-weight:800;color:var(--g1);margin-bottom:11px">📈 تفاصيل الأداء اليومي</div>
          ${dayBars}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:13px">
          <div style="background:#d1fae5;border:1.5px solid #6ee7b7;border-radius:12px;padding:12px">
            <div style="font-size:.8rem;font-weight:800;color:#065f46;margin-bottom:8px">💪 نقاط القوة</div>
            ${strong.length ? strong.map(x=>`<div style="font-size:.75rem;color:#064e3b;margin-bottom:4px;display:flex;gap:5px"><span>✅</span><span>يوم ${x.day.id}: ${x.day.title.slice(0,16)}…</span></div>`).join('') : '<div style="font-size:.75rem;color:#6b7280">لا توجد أيام ممتازة (≥85%) بعد</div>'}
          </div>
          <div style="background:var(--red2);border:1.5px solid #fca5a5;border-radius:12px;padding:12px">
            <div style="font-size:.8rem;font-weight:800;color:#7f1d1d;margin-bottom:8px">⚠️ تحتاج تحسين</div>
            ${weak.length ? weak.map(x=>`<div style="font-size:.75rem;color:#991b1b;margin-bottom:4px;display:flex;gap:5px"><span>❌</span><span>يوم ${x.day.id}: ${x.absent?'غياب':x.quiz+'%'}</span></div>`).join('') : '<div style="font-size:.75rem;color:#6b7280">لا توجد أيام بدرجة ضعيفة</div>'}
          </div>
        </div>
        ${(absentDays.length||excusedDays.length) ? `
        <div style="background:var(--gold2);border:1.5px solid #fde68a;border-radius:12px;padding:12px;margin-bottom:13px">
          <div style="font-size:.8rem;font-weight:800;color:var(--gold);margin-bottom:7px">📅 ملاحظات الحضور</div>
          ${absentDays.length?`<div style="font-size:.75rem;color:#92400e;margin-bottom:4px">🔴 أيام غياب: <strong>${absentDays.join('، ')}</strong></div>`:''}
          ${excusedDays.length?`<div style="font-size:.75rem;color:#92400e">🟡 أيام عذر: <strong>${excusedDays.join('، ')}</strong></div>`:''}
        </div>` : ''}
        ${allWrong.length ? `
        <div style="background:var(--gold2);border:1.5px solid #fde68a;border-radius:12px;padding:12px;margin-bottom:13px">
          <div style="font-size:.8rem;font-weight:800;color:var(--gold);margin-bottom:8px">📝 الأسئلة الخاطئة</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">${allWrong.map(q=>`<span style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:2px 8px;font-size:.72rem;color:#78350f;font-weight:700">${q}</span>`).join('')}</div>
        </div>` : `
        <div style="background:#d1fae5;border:1.5px solid #6ee7b7;border-radius:12px;padding:11px;margin-bottom:13px;text-align:center;font-size:.8rem;color:#065f46;font-weight:700">
          🎉 لا أسئلة خاطئة — إجابات مثالية في جميع الأيام!
        </div>`}
        <div style="background:var(--g4);border:1.5px solid var(--g5);border-radius:13px;padding:14px;margin-bottom:14px">
          <div style="font-size:.82rem;font-weight:800;color:var(--g1);margin-bottom:7px">💡 التوصية النهائية</div>
          <p style="font-size:.83rem;color:var(--muted);line-height:1.75;margin:0">${rec}</p>
        </div>
        <button onclick="printReport('${id}')"
          style="width:100%;padding:11px;background:var(--g1);color:#fff;border:none;border-radius:11px;font-family:'Tajawal',sans-serif;font-size:.9rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
          🖨️ طباعة / تصدير التقرير
        </button>
      </div>
    `);
  };

  // ── printReport ───────────────────────────────────────────────────
  window.printReport = function(id) {
    const body = document.getElementById('modal-body');
    if (!body) return;
    const t = _trainees.find(x=>x.id===id);
    const w = window.open('','_blank','width=800,height=900');
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head>
      <meta charset="UTF-8">
      <title>تقرير — ${t?.name||id}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Tajawal',sans-serif;padding:28px 36px;color:#0e1f18;direction:rtl;background:#fff}
        h1{color:#0a5c3e;font-size:1.2rem;margin-bottom:4px;font-weight:900}
        hr{border:none;border-top:1.5px solid #b8d8cc;margin:10px 0 16px}
        @media print{button{display:none!important}}
      </style>
    </head><body>
      <h1>📋 التقرير الشامل — نظام تدريب سحب العينات الغذائية</h1>
      <hr>
      ${body.innerHTML}
    </body></html>`);
    w.document.close();
    setTimeout(()=>w.print(), 500);
  };

  console.log('✅ Report patch loaded successfully');
})();
