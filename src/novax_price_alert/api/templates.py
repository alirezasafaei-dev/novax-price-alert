# ruff: noqa: E501

TWA_SHELL_HTML = """
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <meta name="description" content="قیمت لحظه‌ای دلار، یورو، طلا، سکه، تتر و ارزهای دیجیتال (BTC, ETH و ...) در بازار ایران. هشدار قیمت هوشمند، تاریخچه و چارت در تلگرام با Novax." />
  <meta name="keywords" content="قیمت دلار, قیمت طلا, قیمت تتر, قیمت بیت کوین, هشدار قیمت, بازار ایران, novax" />
  <meta property="og:title" content="Novax | قیمت بازار ایران + هشدار هوشمند" />
  <meta property="og:description" content="قیمت‌های زنده بازار ایران (دلار، طلا، کریپتو) و ساخت هشدار قیمت در تلگرام. چارت و تاریخچه کامل." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://novax.alirezasafeidev.ir" />
  <meta name="theme-color" content="#070b16" />
  <title>Novax • قیمت بازار ایران و هشدار قیمت</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root{color-scheme:dark;--bg:#070b16;--card:#111827;--muted:#9ca3af;--text:#f9fafb;--accent:#38bdf8;--danger:#fb7185;--ok:#34d399}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#08111f,#020617);font-family:Tahoma,Arial,sans-serif;color:var(--text)}
    main{max-width:520px;margin:0 auto;padding:18px 14px 90px}.hero{padding:18px 0}.hero h1{margin:0 0 8px;font-size:24px}.hero p{margin:0;color:var(--muted);line-height:1.8}
    .grid{display:grid;gap:12px}.card{background:rgb(17 24 39/.88);border:1px solid rgb(148 163 184/.18);border-radius:18px;padding:14px;box-shadow:0 16px 40px rgb(0 0 0/.22)}
    .row{display:flex;align-items:center;justify-content:space-between;gap:12px}.name{font-weight:700}.price{font-size:20px;font-weight:800;direction:ltr}.meta{font-size:12px;color:var(--muted);margin-top:8px}
    button{border:0;border-radius:14px;background:var(--accent);color:#00111f;font-weight:800;padding:12px 14px;width:100%;font-size:15px;margin-top:8px}
    select,input{width:100%;border:1px solid rgb(148 163 184/.25);background:#0b1220;color:var(--text);border-radius:14px;padding:12px;margin-top:8px;font-size:15px}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ghost{background:#1f2937;color:var(--text)}.danger{background:var(--danger);color:#00111f}.ok{background:var(--ok);color:#00111f}
    .notice{font-size:12px;color:var(--muted);line-height:1.8}.hidden{display:none}
    .step{display:none}.step.active{display:block}.mini{font-size:12px;padding:9px 10px;margin-top:8px}.history-list{display:grid;gap:8px;margin-top:10px}.history-row{display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgb(148 163 184/.12);padding-top:8px}.history-row:first-child{border-top:0;padding-top:0}
    #price-chart { background:#0b1220; border-radius:8px; padding:4px; margin: 4px 0; }
    .tab-btn { background:#1f2937; color:var(--text); border:1px solid rgb(148 163 184/.25); padding:8px 14px; border-radius:9999px; font-size:13px; cursor:pointer; }
    .tab-btn.active { background:var(--accent); color:#00111f; font-weight:700; border-color:var(--accent); }
    .tab-content { display:none; }
    .tab-content.active { display:block; }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>Novax</h1>
    <p>قیمت‌های لحظه‌ای بازار ایران + هشدار قیمت هوشمند و قابل اعتماد</p>
    <div class="text-xs mt-1 text-slate-400 leading-relaxed">قیمت‌ها تازه نگه داشته می‌شوند • هشدار فقط وقتی واقعاً فعال است که شما تأیید کنید • تاریخچه و چارت کامل برای تصمیم‌گیری بهتر</div>
  </section>
  <section id="auth" class="card notice hidden">این اپ وب پیشرفته فقط از داخل بات Novax در تلگرام باز می‌شود. از دکمه «اپ وب پیشرفته» در منوی بات استفاده کنید.</section>

  <!-- Professional tab navigation for best-in-class UX -->
  <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap;" id="main-tabs">
    <button onclick="showMainTab('tab-prices')" class="tab-btn active">💰 قیمت‌های زنده</button>
    <button onclick="showMainTab('tab-assets')" class="tab-btn">📁 دارایی‌های من</button>
    <button onclick="showMainTab('tab-portfolio')" class="tab-btn">💼 پورتفولیو من</button>
    <button onclick="showMainTab('tab-alerts')" class="tab-btn">🔔 هشدارهای من</button>
    <button onclick="showMainTab('tab-chart')" class="tab-btn">📈 چارت پیشرفته</button>
    <button onclick="showMainTab('tab-create')" class="tab-btn">➕ ساخت هشدار جدید</button>
  </div>

  <div id="tab-prices" class="tab-content active">
    <section class="grid" id="prices"></section>
  </div>

  <div id="tab-assets" class="tab-content">
    <section id="my-assets-card" class="card">
      <div class="name">دارایی‌هایی که دنبال می‌کنی</div>
      <div class="text-[11px] text-slate-400 mb-2">قیمت‌های ذخیره‌شده برای پیشنهاد سریع هشدار</div>
      <div id="my-assets-list" class="grid"></div>
    </section>
  </div>

  <div id="tab-portfolio" class="tab-content">
    <section class="card">
      <div class="name">پورتفولیو شخصی (فقط روی گوشی شما ذخیره می‌شود)</div>
      <div class="text-[11px] text-slate-400 mb-1">محاسبه تقریبی سود/زیان با قیمت‌های زنده. داده‌ها خصوصی هستند.</div>
      <div style="margin:8px 0;">
        <input id="port-holding" placeholder="مثال: BTC 0.5" style="width:60%;">
        <button onclick="addHolding()" class="ghost mini" style="width:auto;">افزودن</button>
      </div>
      <div id="portfolio-list"></div>
      <div id="portfolio-total" class="meta" style="margin-top:8px;"></div>
    </section>
  </div>

  <div id="tab-alerts" class="tab-content">
    <section class="grid" id="alerts"></section>
  </div>

  <div id="tab-chart" class="tab-content">
    <section class="card">
      <div class="name">چارت پیشرفته (چند دارایی + بازه)</div>
      <div style="margin:8px 0;">
        <select id="chart-multi" multiple style="width:100%;min-height:70px;"></select>
      </div>
      <div style="display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;">
        <button onclick="renderAdvancedMultiChart(1)" class="ghost mini">۱د</button>
        <button onclick="renderAdvancedMultiChart(7)" class="ghost mini">۷د</button>
        <button onclick="renderAdvancedMultiChart(30)" class="ghost mini">۳۰د</button>
      </div>
      <canvas id="adv-chart" width="420" height="220" style="max-height:240px;background:#0b1220;border-radius:8px;"></canvas>
    </section>
  </div>

  <div id="tab-create" class="tab-content">
    <div class="card mb-3">
      <div class="name mb-1">ساخت هشدار قیمت — کاملاً شفاف و مرحله‌به‌مرحله</div>
      <div class="text-[11px] text-slate-400 leading-relaxed">۶ گام ساده: انتخاب دارایی → دیدن قیمت فعلی → انتخاب نوع شرط → وارد کردن قیمت هدف → بررسی خلاصه → تأیید نهایی. تا وقتی خودتان تأیید نکنید، هیچ هشداری فعال نمی‌شود.</div>
    </div>

  <section id="history-card" class="card hidden" style="margin-top:12px">
    <div class="row"><div><div class="name" id="history-title">تاریخچه قیمت</div><div class="meta">آخرین snapshotهای ثبت‌شده</div></div><button id="close-history" class="ghost mini" style="width:auto">بستن</button></div>
    <canvas id="price-chart" width="400" height="160" style="max-height:180px;margin:8px 0 12px;"></canvas>
    <div id="history-list" class="history-list"></div>
  </section>
  
  <section class="card" style="margin-top:12px">
    <div class="name">ساخت هشدار</div>
    
    <div id="step-asset" class="step active">
      <label>دارایی را انتخاب کنید:</label>
      <select id="asset"></select>
      <button id="next-asset">بعدی</button>
    </div>
    
    <div id="step-condition" class="step">
      <label>شرط را انتخاب کنید:</label>
      <select id="condition"><option value="below">خرید: قیمت کمتر یا مساوی</option><option value="above">فروش: قیمت بیشتر یا مساوی</option></select>
      <button id="next-condition">بعدی</button>
      <button id="back-condition" class="ghost">بازگشت</button>
    </div>
    
    <div id="step-target" class="step">
      <label id="target-label">قیمت هدف را وارد کنید:</label>
      <input id="target" inputmode="numeric" />
      <button id="next-target">بعدی</button>
      <button id="back-target" class="ghost">بازگشت</button>
    </div>
    
    <div id="step-confirm" class="step">
      <div class="name">خلاصه هشدار:</div>
      <div id="summary" style="margin:12px 0;line-height:1.8"></div>
      <div class="actions">
        <button id="confirm-alert" class="ok">تایید و فعال‌سازی</button>
        <button id="edit-target" class="ghost">اصلاح قیمت</button>
      </div>
      <button id="cancel-alert" class="danger" style="margin-top:8px">لغو</button>
    </div>
    
    <p class="notice">برای کاهش فشار روی منابع رایگان، قیمت‌ها با کش و برچسب زمان بروزرسانی نمایش داده می‌شوند.</p>
  </section>
  
  <section class="grid" id="alerts" style="margin-top:12px"></section>
</main>
<script>
const tg = window.Telegram?.WebApp; tg?.ready(); tg?.expand();
const initData = tg?.initData || "";
const headers = initData ? {"X-Telegram-Init-Data": initData, "Content-Type": "application/json"} : {"Content-Type":"application/json"};
const fmt = new Intl.NumberFormat("fa-IR");
let latest = [];
let alertDraft = {asset_code:null,condition_type:null,target_price:null,unit:null,asset_name:null,current_price:null};

// Persian to English digit sanitizer (from Advanced Studio best practice - prevents mobile keyboard issues)
function persianToEnDigits(str) {
  if (!str) return str;
  const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const e = ['0','1','2','3','4','5','6','7','8','9'];
  let out = String(str);
  for (let i=0; i<10; i++) out = out.replace(new RegExp(p[i], 'g'), e[i]);
  return out;
}
let priceChart = null;
let userAlerts = [];
const auth = document.getElementById("auth");
const prices = document.getElementById("prices");
const asset = document.getElementById("asset");
const alerts = document.getElementById("alerts");
const historyCard = document.getElementById("history-card");
const historyTitle = document.getElementById("history-title");
const historyList = document.getElementById("history-list");
const closeHistory = document.getElementById("close-history");
const condition = document.getElementById("condition");
const target = document.getElementById("target");
const targetLabel = document.getElementById("target-label");
const summary = document.getElementById("summary");
const nextAsset = document.getElementById("next-asset");
const nextCondition = document.getElementById("next-condition");
const backCondition = document.getElementById("back-condition");
const nextTarget = document.getElementById("next-target");
const backTarget = document.getElementById("back-target");
const confirmAlert = document.getElementById("confirm-alert");
const editTarget = document.getElementById("edit-target");
const cancelAlert = document.getElementById("cancel-alert");
function escapeHtml(value){return String(value ?? "").replace(/[&<>"']/g, ch => {if(ch==="&") return "&amp;"; if(ch==="<") return "&lt;"; if(ch===">") return "&gt;"; if(ch==='"') return "&quot;"; return "&#39;"})}
function assetLabel(alert){return alert.asset_name || latest.find(x=>x.asset_code===alert.asset_code)?.asset_name || alert.display_asset_name_at_creation || alert.asset_code || alert.asset_id}
function resetDraft(){alertDraft = {asset_code:null,condition_type:null,target_price:null,unit:null,asset_name:null,current_price:null}; target.value = ""}
function showStep(stepId){document.querySelectorAll(".step").forEach(s=>s.classList.remove("active")); document.getElementById(stepId).classList.add("active")}
async function api(path, opts={}){const r=await fetch(path,{...opts,headers:{...headers,...(opts.headers||{})}}); if(!r.ok) throw new Error(await r.text()); return r.json()}
async function loadPrices(){
  const data = await api("/api/v1/prices/latest"); latest = data.items || [];
  prices.innerHTML = latest.map(x=>`<article class="card"><div class="row"><div><div class="name">${escapeHtml(x.asset_name)}</div><div class="meta">${escapeHtml(x.asset_code)} · ${ (x.freshness|| (x.is_stale?'stale':'fresh')) === 'fresh' ? 'تازه' : 'قدیمی/نامعتبر' }</div></div><div class="price">${fmt.format(Number(x.price_value))} ${escapeHtml(x.display_unit || x.currency_code)}</div></div><div class="meta">آخرین بروزرسانی: ${new Date(x.fetched_at).toLocaleString("fa-IR")}</div><button class="ghost mini" data-history-asset="${escapeHtml(x.asset_code)}">تاریخچه قیمت</button></article>`).join("");
  prices.querySelectorAll("button[data-history-asset]").forEach(button => button.onclick = () => loadHistory(button.dataset.historyAsset));
  asset.innerHTML = latest.map(x=>`<option value="${escapeHtml(x.asset_code)}">${escapeHtml(x.asset_name)}</option>`).join("");
}
async function loadHistory(assetCode){
  if(!assetCode) return;
  const selected = latest.find(x=>x.asset_code===assetCode);
  historyTitle.textContent = `تاریخچه ${selected?.asset_name || assetCode}`;
  historyList.innerHTML = `<div class="meta">در حال دریافت...</div>`;
  historyCard.classList.remove("hidden");
  if (priceChart) { priceChart.destroy(); priceChart = null; }
  const data = await api(`/api/v1/prices/history?asset_code=${encodeURIComponent(assetCode)}&limit=10`);
  const items = data.items || [];
  historyList.innerHTML = items.length ? items.map(x=>`<div class="history-row"><span>${new Date(x.observed_at).toLocaleString("fa-IR")}</span><strong>${fmt.format(Number(x.price_value))} ${escapeHtml(x.display_unit || x.currency_code)}</strong></div>`).join("") : `<div class="meta">برای این دارایی هنوز تاریخچه‌ای ثبت نشده است.</div>`;

  // Simple price chart (new UX feature)
  const canvas = document.getElementById("price-chart");
  if (items.length > 1 && canvas) {
    const labels = items.map(x => new Date(x.observed_at).toLocaleTimeString("fa-IR", {hour:'2-digit', minute:'2-digit'})).reverse();
    const values = items.map(x => Number(x.price_value)).reverse();
    const ctx = canvas.getContext("2d");
    priceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: selected?.asset_name || assetCode,
          data: values,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56,189,248,0.1)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index" } },
        scales: {
          x: { grid: { color: "rgba(148,163,184,0.1)" }, ticks: { color: "#9ca3af", font: { size: 10 } } },
          y: { grid: { color: "rgba(148,163,184,0.1)" }, ticks: { color: "#9ca3af", font: { size: 10 }, callback: v => fmt.format(v) } }
        }
      }
    });
  } else if (canvas) {
    canvas.style.display = "none";
  }
}
async function loadAlerts(){
  if(!initData){auth.classList.remove("hidden"); return}
  const data = await api("/api/v1/alerts");
  userAlerts = data.items || [];
  alerts.innerHTML = userAlerts.map(a=>`<article class="card"><div class="row"><div><div class="name">${escapeHtml(assetLabel(a))}</div><div class="meta">${a.condition_type==="above"?"بالای":"زیر"} ${fmt.format(Number(a.target_price))} ${escapeHtml(a.target_price_display_unit||"")}</div></div><span class="${a.is_active?"ok":"danger"}">${a.is_active?"فعال":"خاموش"}</span></div><div class="actions"><button class="ghost" data-edit-alert-id="${escapeHtml(a.id)}" data-current-target="${escapeHtml(a.target_price)}" data-target-unit="${escapeHtml(a.target_price_display_unit||"")}">اصلاح قیمت</button><button class="danger" data-alert-id="${escapeHtml(a.id)}">حذف</button></div></article>`).join("");
  alerts.querySelectorAll("button[data-alert-id]").forEach(button => button.onclick = () => removeAlert(button.dataset.alertId));
  alerts.querySelectorAll("button[data-edit-alert-id]").forEach(button => button.onclick = () => editAlertTarget(button.dataset.editAlertId, button.dataset.currentTarget, button.dataset.targetUnit));
  renderMyAssets();
  renderSuggestions();
}
async function removeAlert(id){if(!id || !confirm("این هشدار حذف شود؟")) return; await api(`/api/v1/alerts/${id}`,{method:"DELETE"}); await loadAlerts()}
async function editAlertTarget(id,currentTarget,unit){const nextRaw = prompt(`قیمت هدف جدید را وارد کنید (${unit || "واحد فعلی"})`, currentTarget || ""); const raw = persianToEnDigits(nextRaw); const val = parseFloat(raw); if(!id || !val || val <= 0){return} await api(`/api/v1/alerts/${id}`,{method:"PATCH",body:JSON.stringify({target_price:val})}); await loadAlerts()}

nextAsset.onclick = ()=>{
  const selected = latest.find(x=>x.asset_code===asset.value);
  if(!selected) return;
  alertDraft.asset_code = selected.asset_code;
  alertDraft.asset_name = selected.asset_name;
  alertDraft.unit = selected.display_unit || selected.currency_code || "تومان";
  alertDraft.current_price = selected.price_value;
  showStep("step-condition");
};

nextCondition.onclick = ()=>{
  alertDraft.condition_type = condition.value;
  showStep("step-target");
  targetLabel.textContent = `قیمت هدف را با واحد ${alertDraft.unit} وارد کنید:`;
  if(alertDraft.current_price){
    target.placeholder = `مثال: ${Math.round(alertDraft.current_price)}`;
  }
};

backCondition.onclick = ()=>showStep("step-asset");

nextTarget.onclick = ()=>{
  const raw = persianToEnDigits(target.value);
  const val = parseFloat(raw);
  if(!val || val <= 0){alert("لطفاً یک قیمت معتبر وارد کنید"); return}
  alertDraft.target_price = val;
  const sign = alertDraft.condition_type==="above"?"بالاتر از":"پایین‌تر از";
  const currentText = alertDraft.current_price ? `${fmt.format(alertDraft.current_price)} ${alertDraft.unit}` : "نامشخص";
  summary.innerHTML = `دارایی: ${escapeHtml(alertDraft.asset_name)}<br>شرط: ${sign} ${fmt.format(alertDraft.target_price)} ${escapeHtml(alertDraft.unit)}<br>قیمت فعلی: ${escapeHtml(currentText)}<br><br>بعد از تایید، هشدار فعال می‌شود.`;
  showStep("step-confirm");
};

backTarget.onclick = ()=>showStep("step-condition");

confirmAlert.onclick = async ()=>{
  if(!initData){auth.classList.remove("hidden"); return}
  const created = await api("/api/v1/alerts",{method:"POST",body:JSON.stringify({asset_code:alertDraft.asset_code,condition_type:alertDraft.condition_type,target_price:alertDraft.target_price,cooldown_minutes:60})});
  await api(`/api/v1/alerts/${created.id}/confirm`,{method:"POST"});
  alert("هشدار فعال شد ✅");
  resetDraft();
  showStep("step-asset");
  await loadAlerts();
};

editTarget.onclick = ()=>showStep("step-target");

cancelAlert.onclick = ()=>{
  resetDraft();
  showStep("step-asset");
  fetch('/api/v1/metrics/track', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'alert_abandon'})}).catch(()=>{});
};

closeHistory.onclick = ()=>{ 
  historyCard.classList.add("hidden"); 
  if (priceChart) { priceChart.destroy(); priceChart = null; }
  const c = document.getElementById("price-chart"); if (c) c.style.display = "";
};

function renderMyAssets(){
  const container = document.getElementById('my-assets-card');
  const listEl = document.getElementById('my-assets-list');
  if(!userAlerts.length || !container || !listEl){
    if(container) container.classList.add('hidden');
    return;
  }
  const assetMap = {};
  userAlerts.forEach(a => {
    const code = a.asset_code;
    if(!assetMap[code]){
      const lp = latest.find(x => x.asset_code === code);
      assetMap[code] = {
        code,
        name: assetLabel(a) || (lp ? lp.asset_name : code),
        current: lp ? `${fmt.format(Number(lp.price_value))} ${lp.display_unit || lp.currency_code}` : 'نامشخص',
        fresh: lp && lp.freshness ? (lp.freshness==='fresh' ? 'تازه' : 'قدیمی') : '',
        count: 0
      };
    }
    assetMap[code].count++;
  });
  const html = Object.values(assetMap).map(item => `
    <article class="card mini">
      <div class="row">
        <div class="name">${escapeHtml(item.name)}</div>
        <span>${item.count} هشدار</span>
      </div>
      <div class="meta">قیمت فعلی: ${escapeHtml(item.current)} ${item.fresh}</div>
      <button class="ghost mini" onclick="document.getElementById('alerts').scrollIntoView({behavior:'smooth'})">مشاهده و ویرایش هشدارها</button>
    </article>
  `).join('');
  listEl.innerHTML = html;
  container.classList.remove('hidden');
}

function renderSuggestions(){
  const container = document.getElementById('suggestions-card');
  const listEl = document.getElementById('suggestions-list');
  if(!container || !listEl) return;
  const watched = (userAlerts||[]).map(a => a.asset_code).join(',');
  // Use server smart suggestions with change % for data-driven recs (volatility/move signals)
  api(`/api/v1/prices/suggestions?limit=4&watched=${encodeURIComponent(watched)}`)
    .then(res => {
      const items = (res.items || []).slice(0,4);
      if(!items.length){ container.classList.add('hidden'); return; }
      const html = items.map(p => `
        <article class="card mini">
          <div class="row">
            <div class="name">${escapeHtml(p.asset_name)}</div>
            <span class="meta">${fmt.format(Number(p.price_value))} ${p.display_unit} ${p.change_pct!=null ? (p.change_pct>0?'+':'')+p.change_pct+'%' : ''} ${p.volatility!=null ? 'vol:'+p.volatility : ''}</span>
          </div>
          <button class="ghost mini" onclick="startAlertForAsset('${p.asset_code}')">شروع هشدار</button>
        </article>
      `).join('');
      listEl.innerHTML = html;
      container.classList.remove('hidden');
    })
    .catch(() => {
      // graceful fallback to previous client logic
      if(!latest.length) return;
      const wset = new Set((userAlerts||[]).map(a=>a.asset_code));
      const cands = latest.filter(p=>!wset.has(p.asset_code)).slice(0,3);
      if(!cands.length){ container.classList.add('hidden'); return; }
      const html = cands.map(p => `<article class="card mini"><div class="row"><div class="name">${escapeHtml(p.asset_name)}</div><span class="meta">${fmt.format(Number(p.price_value))} ${p.display_unit}</span></div><button class="ghost mini" onclick="startAlertForAsset('${p.asset_code}')">شروع هشدار</button></article>`).join('');
      listEl.innerHTML = html;
      container.classList.remove('hidden');
    }); // اگر خطا ادامه داشت، از بات /alert استفاده کنید یا TWA را رفرش کنید.
}

function startAlertForAsset(code){
  const selected = latest.find(x => x.asset_code === code);
  if(!selected) return;
  alertDraft.asset_code = selected.asset_code;
  alertDraft.asset_name = selected.asset_name;
  alertDraft.unit = selected.display_unit || selected.currency_code || "تومان";
  alertDraft.current_price = selected.price_value;
  const sel = document.getElementById('asset');
  if(sel) sel.value = code;
  showStep("step-condition");
  targetLabel.textContent = `قیمت هدف را با واحد ${alertDraft.unit} وارد کنید:`;
  if(alertDraft.current_price){
    target.placeholder = `مثال: ${Math.round(alertDraft.current_price)}`;
  }
}

// Professional tab system for best UX (full mini-app feel)
function showMainTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#main-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  // highlight active tab
  const btns = document.querySelectorAll('#main-tabs .tab-btn');
  btns.forEach(b => {
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabId)) b.classList.add('active');
  });
  if (tabId === 'tab-chart') {
    // init chart selectors
    initChartSelectors();
  }
}

function initChartSelectors() {
  const sel = document.getElementById('chart-multi');
  if (!sel || sel.options.length > 0) return;
  latest.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.asset_code;
    opt.text = p.asset_name;
    sel.appendChild(opt);
  });
}

let advChartInstance = null;
function renderAdvancedMultiChart(days) {
  const sel = document.getElementById('chart-multi');
  if (!sel) return;
  const codes = Array.from(sel.selectedOptions).map(o => o.value);
  if (codes.length === 0) {
    alert('حداقل یک دارایی انتخاب کنید');
    return;
  }
  // fetch history for selected and render
  const rangeParam = days ? `&range=${days}d` : '';
  Promise.all(codes.map(code => api(`/api/v1/prices/history?asset_code=${code}&limit=120${rangeParam}`)))
    .then(results => {
      const datasets = [];
      const allLabels = new Set();
      results.forEach((res, i) => {
        const code = codes[i];
        const name = latest.find(x=>x.asset_code===code)?.asset_name || code;
        const items = (res.items || []);
        items.forEach(it => allLabels.add(new Date(it.observed_at).toLocaleDateString('fa-IR')));
        const data = items.map(it => Number(it.price_value));
        datasets.push({
          label: name,
          data: data.reverse(),
          borderColor: ['#38bdf8','#34d399','#fb7185','#f59e0b'][i % 4],
          tension: 0.2
        });
      });
      const labels = Array.from(allLabels);
      const ctx = document.getElementById('adv-chart').getContext('2d');
      if (advChartInstance) advChartInstance.destroy();
      advChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels.slice(-30), datasets },
        options: { responsive:true, plugins:{legend:{position:'top'}}, scales:{x:{ticks:{font:{size:10}}}, y:{ticks:{font:{size:10}}}} }
      });
    });
}

loadPrices().then(() => {
  loadAlerts();
  // init tabs and default view
  const firstTab = document.getElementById('tab-prices');
  if (firstTab) firstTab.classList.add('active');
  // populate chart select if present
  setTimeout(() => {
    const multi = document.getElementById('chart-multi');
    if (multi && multi.options.length === 0 && latest.length) {
      latest.forEach(p => {
        const o = document.createElement('option');
        o.value = p.asset_code;
        o.text = p.asset_name;
        multi.appendChild(o);
      });
    }
  }, 300);
}).catch(e=>{prices.innerHTML=`<article class="card danger">خطا در دریافت داده: ${e.message}. لطفاً صفحه را رفرش کنید یا بعداً امتحان کنید. اگر قیمت‌ها قدیمی هستند، صبر کنید تا ingest بعدی (هر ۱۰ دقیقه).</article>`});

// Simple Portfolio (localStorage demo)
function addHolding() {
  const input = document.getElementById('port-holding');
  if (!input || !input.value) return;
  const parts = input.value.trim().split(' ');
  if (parts.length < 2) return;
  const code = parts[0].toUpperCase();
  const amt = parseFloat(parts[1]);
  if (!amt) return;
  let holdings = JSON.parse(localStorage.getItem('novax_portfolio') || '{}');
  holdings[code] = (holdings[code] || 0) + amt;
  localStorage.setItem('novax_portfolio', JSON.stringify(holdings));
  input.value = '';
  renderPortfolio();
}
function renderPortfolio() {
  const list = document.getElementById('portfolio-list');
  const totalEl = document.getElementById('portfolio-total');
  if (!list || !totalEl) return;
  let holdings = JSON.parse(localStorage.getItem('novax_portfolio') || '{}');
  let html = '';
  let totalVal = 0;
  Object.keys(holdings).forEach(code => {
    const amt = holdings[code];
    const p = (window.prices || []).find(x => x.asset_code === code);
    const val = p ? amt * Number(p.price_value) : 0;
    totalVal += val;
    html += `<div class="history-row"><span>${code} ${amt}</span><strong>${fmt.format(val)} ${p ? p.display_unit : ''}</strong></div>`;
  });
  list.innerHTML = html || '<div class="meta">هیچ holdingی اضافه نشده.</div>';
  totalEl.textContent = `ارزش کل: ${fmt.format(totalVal)} تومان (تقریبی)`;
}
window.addEventListener('load', () => { setTimeout(renderPortfolio, 1000); });
setInterval(renderPortfolio, 30000);

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // show install button if wanted, or auto prompt on user action
  console.log('PWA install available');
});
setInterval(loadPrices, 60000);
</script>
</body>
</html>
"""

# Professional Production Admin Panel for Owner
ADMIN_HTML = """
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Novax Admin • پنل مدیریت حرفه‌ای</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Tahoma, system-ui, sans-serif; background:#020617; color:#e2e8f0; }
    .card { background:#0f172a; border:1px solid #334155; border-radius:16px; }
    .section { font-size:14px; font-weight:700; margin-bottom:8px; color:#cbd5e1; }
    .table { width:100%; border-collapse:collapse; font-size:13px; }
    .table th { text-align:right; padding:6px 8px; color:#64748b; font-weight:500; border-bottom:1px solid #334155; }
    .table td { padding:8px; border-bottom:1px solid #1e2937; }
    .btn { font-size:12px; padding:6px 12px; border-radius:8px; font-weight:600; }
    .btn-sm { font-size:11px; padding:4px 8px; }
    input, select { background:#0b1220; border:1px solid #475569; border-radius:8px; padding:6px 10px; font-size:13px; color:#e2e8f0; }
    .stat-value { font-size:28px; font-weight:800; line-height:1; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .log-row { font-size:12px; }
  </style>
</head>
<body class="p-4 max-w-[1100px] mx-auto">
  <div class="flex items-center justify-between mb-5">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Novax Admin</h1>
      <p class="text-slate-400 text-sm">پنل مدیریت حرفه‌ای و امن • فقط برای مالک سیستم</p>
    </div>
    <div class="flex items-center gap-2">
      <input id="token-input" class="w-80 text-sm" placeholder="ADMIN_ACCESS_TOKEN را اینجا وارد کنید" />
      <button onclick="saveAndLoad()" class="btn bg-sky-600 hover:bg-sky-500 px-4 py-1.5 rounded-xl text-sm font-semibold">ذخیره و بارگذاری</button>
      <button onclick="loadAllData()" class="btn bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded-xl text-sm">بارگذاری مجدد</button>
    </div>
  </div>

  <!-- Overview -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
    <div class="card p-4">
      <div class="text-xs text-slate-400">تعداد کاربران</div>
      <div id="stat-users" class="stat-value text-white mt-1">-</div>
    </div>
    <div class="card p-4">
      <div class="text-xs text-slate-400">هشدارهای فعال</div>
      <div id="stat-active" class="stat-value text-emerald-400 mt-1">-</div>
    </div>
    <div class="card p-4">
      <div class="text-xs text-slate-400 mb-1">توزیع وضعیت هشدارها</div>
      <canvas id="state-chart" height="60"></canvas>
    </div>
    <div class="card p-4">
      <div class="text-xs text-slate-400">وضعیت سیستم</div>
      <div id="stat-env" class="font-mono text-lg mt-1">-</div>
      <div class="text-[10px] text-slate-500 mt-2">آخرین به‌روزرسانی: <span id="last-updated">-</span></div>
    </div>
  </div>

  <!-- Alerts Table with Search -->
  <div class="card p-4 mb-6">
    <div class="flex justify-between items-center mb-3">
      <div class="section">هشدارهای تمام کاربران</div>
      <div class="flex gap-2 items-center">
        <input id="alert-search" placeholder="جستجو در دارایی یا کاربر..." class="text-sm w-64" onkeyup="filterAlertsTable()" />
        <select id="state-filter" class="text-sm" onchange="loadAlerts()">
          <option value="">همه</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PENDING_CONFIRMATION">PENDING</option>
          <option value="TRIGGERED">TRIGGERED</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <button onclick="loadAlerts()" class="btn bg-slate-700 px-3">فیلتر</button>
      </div>
    </div>
    <div class="overflow-auto max-h-[420px]">
      <table class="table">
        <thead><tr>
          <th>شناسه</th><th>کاربر</th><th>دارایی</th><th>وضعیت</th><th>هدف</th><th>ایجاد شده</th><th>آخرین اجرا</th><th>عملیات</th>
        </tr></thead>
        <tbody id="alerts-body"></tbody>
      </table>
    </div>
  </div>

  <!-- Users + Audit Logs side by side -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
    <div class="card p-4">
      <div class="section mb-2">کاربران اخیر</div>
      <div class="overflow-auto max-h-64">
        <table class="table text-xs"><thead><tr><th>تلگرام</th><th>نام</th><th>آخرین فعالیت</th></tr></thead><tbody id="users-body"></tbody></table>
      </div>
    </div>

    <div class="card p-4">
      <div class="section mb-2">لاگ اقدامات ادمین (Audit)</div>
      <div class="overflow-auto max-h-64 text-xs">
        <table class="table"><thead><tr><th>زمان</th><th>اقدام</th><th>هدف</th></tr></thead><tbody id="audit-body"></tbody></table>
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="card p-4">
    <div class="section mb-2">عملیات سریع</div>
    <div class="flex flex-wrap gap-2">
      <button onclick="doAction('refresh-metrics')" class="btn bg-slate-800">رفرش متریک‌ها</button>
      <button onclick="if(confirm('لغو همه هشدارهای فعال؟')) {}" class="btn bg-rose-900/70">لغو همه فعال (با احتیاط)</button>
      <a href="/metrics/summary" target="_blank" class="btn bg-slate-800">خلاصه عملیاتی</a>
      <a href="/metrics/prometheus" target="_blank" class="btn bg-slate-800">Prometheus</a>
      <button onclick="showBroadcastForm()" class="btn bg-amber-800">ارسال پیام همگانی (stub)</button>
    </div>
    <div id="action-feedback" class="mt-2 text-emerald-400 text-xs h-4"></div>
  </div>
</div>

<script>
let allAlerts = [];
let stateChartInstance = null;

function getToken() {
  const url = new URLSearchParams(location.search).get('token');
  const input = document.getElementById('token-input');
  return url || (input && input.value.trim()) || '';
}

function saveAndLoad() {
  const t = document.getElementById('token-input').value.trim();
  if (t) {
    const u = new URL(location.href);
    u.searchParams.set('token', t);
    history.replaceState({}, '', u);
  }
  loadAllData();
}

async function api(path, method='GET') {
  const token = getToken();
  const headers = token ? {'X-Admin-Token': token} : {};
  const sep = path.includes('?') ? '&' : '?';
  const url = token ? `${path}${sep}token=${encodeURIComponent(token)}` : path;
  const res = await fetch(url, {method, headers});
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadOverview() {
  const data = await api('/admin/overview');
  document.getElementById('stat-users').textContent = data.total_users || '0';
  document.getElementById('stat-active').textContent = data.active_alerts || '0';
  document.getElementById('stat-env').textContent = data.environment || '-';
  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString('fa-IR');

  // Chart
  const ctx = document.getElementById('state-chart');
  const labels = Object.keys(data.alerts_by_state || {});
  const values = Object.values(data.alerts_by_state || {});
  if (stateChartInstance) stateChartInstance.destroy();
  stateChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: '#38bdf8' }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

async function loadAlerts() {
  const state = document.getElementById('state-filter').value;
  const q = state ? `?state=${state}` : '';
  const data = await api(`/admin/alerts${q}`);
  allAlerts = data.items || [];
  renderAlertsTable(allAlerts);
}

function filterAlertsTable() {
  const q = document.getElementById('alert-search').value.toLowerCase().trim();
  const filtered = !q ? allAlerts : allAlerts.filter(a => 
    (a.display_name || '').toLowerCase().includes(q) || 
    (a.asset_code || '').toLowerCase().includes(q) ||
    (a.user_id || '').toLowerCase().includes(q)
  );
  renderAlertsTable(filtered);
}

function renderAlertsTable(items) {
  const body = document.getElementById('alerts-body');
  body.innerHTML = '';
  items.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono text-[10px]">${a.id.substring(0,8)}</td>
      <td class="mono text-[10px]">${(a.user_id||'').substring(0,8)}</td>
      <td>${a.display_name || a.asset_code}</td>
      <td><span class="text-xs px-1.5 py-0.5 rounded bg-slate-800">${a.state}</span></td>
      <td class="mono">${a.target_price}</td>
      <td class="text-xs">${a.created_at ? a.created_at.substring(0,16).replace('T',' ') : ''}</td>
      <td class="text-xs">${a.last_triggered_at ? a.last_triggered_at.substring(0,16).replace('T',' ') : '-'}</td>
      <td>${a.is_active ? `<button class="btn btn-sm bg-rose-700" onclick="cancelAlert('${a.id}', this)">لغو</button>` : ''}</td>
    `;
    body.appendChild(tr);
  });
}

async function cancelAlert(id, btn) {
  if (!confirm('هشدار لغو شود؟')) return;
  btn.disabled = true; btn.textContent = '...';
  try {
    await api(`/admin/alerts/${id}/cancel`, 'POST');
    btn.textContent = 'لغو شد';
    setTimeout(loadAllData, 700);
  } catch(e) { alert(e.message); btn.disabled=false; btn.textContent='لغو'; }
}

async function loadUsers() {
  const data = await api('/admin/users');
  const body = document.getElementById('users-body');
  body.innerHTML = '';
  (data.items || []).forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.telegram_id}</td><td>${u.first_name||''} ${u.username?'@'+u.username:''}</td><td class="text-[10px]">${u.last_activity_at ? u.last_activity_at.substring(0,16).replace('T',' ') : ''}</td>`;
    body.appendChild(tr);
  });
}

async function loadAudit() {
  const data = await api('/admin/audit-logs');
  const body = document.getElementById('audit-body');
  body.innerHTML = '';
  (data.items || []).forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'log-row';
    tr.innerHTML = `<td>${log.performed_at.substring(0,16).replace('T',' ')}</td><td>${log.action}</td><td>${log.target_id ? log.target_id.substring(0,8) : ''}</td>`;
    body.appendChild(tr);
  });
}

async function doAction(act) {
  const fb = document.getElementById('action-feedback');
  fb.textContent = 'در حال اجرا...';
  try {
    if (act === 'refresh-metrics') {
      await api('/admin/actions/refresh-metrics', 'POST');
      fb.textContent = 'انجام شد';
      loadOverview();
    }
  } catch(e) { fb.textContent = 'خطا: ' + e.message; }
  setTimeout(() => fb.textContent='', 2500);
}

async function loadAllData() {
  try {
    await Promise.all([loadOverview(), loadAlerts(), loadUsers(), loadAudit()]);
  } catch(e) {
    console.error(e);
    alert('خطا در بارگذاری. توکن را چک کنید.');
  }
}

function initAdmin() {
  const urlToken = new URLSearchParams(location.search).get('token');
  if (urlToken) document.getElementById('token-input').value = urlToken;
  if (getToken()) loadAllData();
}
window.onload = initAdmin;

function showBroadcastForm() {
  const msg = prompt('متن پیام همگانی (stub - ارسال واقعی بعداً وصل می‌شود):', 'پیام تست از ادمین Novax');
  if (!msg) return;
  fetch('/admin/actions/broadcast?token=' + encodeURIComponent(getToken()), {
    method: 'POST',
    headers: {'Content-Type':'application/json', 'X-Admin-Token': getToken()},
    body: JSON.stringify({message: msg, target:'all'})
  }).then(r=>r.json()).then(d=>{ alert('Broadcast intent logged: '+JSON.stringify(d)); loadAudit(); }).catch(e=>alert('Error: '+e));
}
</script>
</body>
</html>
"""
