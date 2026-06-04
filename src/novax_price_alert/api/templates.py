# ruff: noqa: E501

TWA_SHELL_HTML = """
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <title>Novax قیمت بازار ایران</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
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
    .step{display:none}.step.active{display:block}
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>Novax</h1>
    <p>قیمت‌های بازار ایران و هشدار هوشمند در تلگرام</p>
  </section>
  <section id="auth" class="card notice hidden">برای ساخت هشدار، این صفحه را داخل تلگرام باز کنید.</section>
  <section class="grid" id="prices"></section>
  
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
const auth = document.getElementById("auth");
const prices = document.getElementById("prices");
const asset = document.getElementById("asset");
const alerts = document.getElementById("alerts");
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
  prices.innerHTML = latest.map(x=>`<article class="card"><div class="row"><div><div class="name">${escapeHtml(x.asset_name)}</div><div class="meta">${escapeHtml(x.asset_code)} · ${x.is_stale?"قدیمی":"به‌روز"}</div></div><div class="price">${fmt.format(Number(x.price_value))} ${escapeHtml(x.display_unit || x.currency_code)}</div></div><div class="meta">آخرین بروزرسانی: ${new Date(x.fetched_at).toLocaleString("fa-IR")}</div></article>`).join("");
  asset.innerHTML = latest.map(x=>`<option value="${escapeHtml(x.asset_code)}">${escapeHtml(x.asset_name)}</option>`).join("");
}
async function loadAlerts(){
  if(!initData){auth.classList.remove("hidden"); return}
  const data = await api("/api/v1/alerts");
  alerts.innerHTML = (data.items||[]).map(a=>`<article class="card"><div class="row"><div><div class="name">${escapeHtml(assetLabel(a))}</div><div class="meta">${a.condition_type==="above"?"بالای":"زیر"} ${fmt.format(Number(a.target_price))} ${escapeHtml(a.target_price_display_unit||"")}</div></div><span class="${a.is_active?"ok":"danger"}">${a.is_active?"فعال":"خاموش"}</span></div><button class="ghost" data-alert-id="${escapeHtml(a.id)}">حذف</button></article>`).join("");
  alerts.querySelectorAll("button[data-alert-id]").forEach(button => button.onclick = () => removeAlert(button.dataset.alertId));
}
async function removeAlert(id){if(!id || !confirm("این هشدار حذف شود؟")) return; await api(`/api/v1/alerts/${id}`,{method:"DELETE"}); await loadAlerts()}

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

loadPrices().then(loadAlerts).catch(e=>{prices.innerHTML=`<article class="card danger">خطا در دریافت داده: ${e.message}</article>`});
setInterval(loadPrices, 60000);
</script>
</body>
</html>
"""
