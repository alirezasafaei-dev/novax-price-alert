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
  <meta property="og:url" content="https://novax.alirezasafaeisystems.ir" />
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
    <p>قیمت‌های بازار ایران و هشدار هوشمند در تلگرام</p>
  </section>
  <section id="auth" class="card notice hidden">برای ساخت هشدار، این صفحه را داخل تلگرام باز کنید.</section>

  <!-- Professional tab navigation for best-in-class UX -->
  <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap;" id="main-tabs">
    <button onclick="showMainTab('tab-prices')" class="tab-btn active">💰 قیمت‌ها</button>
    <button onclick="showMainTab('tab-assets')" class="tab-btn">📁 دارایی‌های من</button>
    <button onclick="showMainTab('tab-alerts')" class="tab-btn">🔔 هشدارها</button>
    <button onclick="showMainTab('tab-chart')" class="tab-btn">📈 چارت پیشرفته</button>
    <button onclick="showMainTab('tab-create')" class="tab-btn">➕ ایجاد</button>
  </div>

  <div id="tab-prices" class="tab-content active">
    <section class="grid" id="prices"></section>
  </div>

  <div id="tab-assets" class="tab-content">
    <section id="my-assets-card" class="card">
      <div class="name">دارایی‌های من</div>
      <div id="my-assets-list" class="grid"></div>
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
async function editAlertTarget(id,currentTarget,unit){const next = prompt(`قیمت هدف جدید را وارد کنید (${unit || "واحد فعلی"})`, currentTarget || ""); const val = parseFloat(next); if(!id || !val || val <= 0){return} await api(`/api/v1/alerts/${id}`,{method:"PATCH",body:JSON.stringify({target_price:val})}); await loadAlerts()}

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
  const val = parseFloat(target.value);
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
            <span class="meta">${fmt.format(Number(p.price_value))} ${p.display_unit} ${p.change_pct!=null ? (p.change_pct>0?'+':'')+p.change_pct+'%' : ''}</span>
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
setInterval(loadPrices, 60000);
</script>
</body>
</html>
"""
