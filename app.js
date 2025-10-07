
// Simple static invoicer using localStorage (no frameworks)
const LS = {
  invoices: "adra_invoices_v1",
  counter: "adra_counter_v1",
  settings: "adra_settings_v1",
};

function load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function money(n){ if(isNaN(n)) n=0; return Number(n).toFixed(2); }

// State
let invoices = load(LS.invoices, []);
let counter = load(LS.counter, 1);
let settings = load(LS.settings, {
  businessName: "ADRA Zimbabwe",
  businessAddress: "",
  prefix: "INV-",
  padding: 4,
  currency: "$",
  footerNote: "Thank you for your business!",
});

// UI refs
const tabNew = document.getElementById('tab-new');
const tabList = document.getElementById('tab-list');
const tabSettings = document.getElementById('tab-settings');
const viewNew = document.getElementById('view-new');
const viewList = document.getElementById('view-list');
const viewSettings = document.getElementById('view-settings');

function switchTab(tab){
  [tabNew, tabList, tabSettings].forEach(t=>t.classList.remove('active'));
  [viewNew, viewList, viewSettings].forEach(v=>v.classList.add('hidden'));
  if(tab==='new'){ tabNew.classList.add('active'); viewNew.classList.remove('hidden'); }
  if(tab==='list'){ tabList.classList.add('active'); viewList.classList.remove('hidden'); renderList(); }
  if(tab==='settings'){ tabSettings.classList.add('active'); viewSettings.classList.remove('hidden'); loadSettingsForm(); }
}
tabNew.onclick = ()=>switchTab('new');
tabList.onclick = ()=>switchTab('list');
tabSettings.onclick = ()=>switchTab('settings');

// New Invoice form
const clientName = document.getElementById('clientName');
const clientAddress = document.getElementById('clientAddress');
const dateEl = document.getElementById('date');
const dueDateEl = document.getElementById('dueDate');
const taxRateEl = document.getElementById('taxRate');
const notesEl = document.getElementById('notes');
const itemsBody = document.getElementById('itemsBody');
const addItemBtn = document.getElementById('addItem');
const subtotalVal = document.getElementById('subtotalVal');
const taxPct = document.getElementById('taxPct');
const taxVal = document.getElementById('taxVal');
const totalVal = document.getElementById('totalVal');

function today(){ return new Date().toISOString().slice(0,10); }
function defaultItem(){ return { description:"", qty:1, price:0 }; }
let form = {
  clientName:"",
  clientAddress:"",
  date: today(),
  dueDate: "",
  items: [defaultItem()],
  taxRate: 0,
  notes: ""
};
function resetForm(){
  form = { clientName:"", clientAddress:"", date: today(), dueDate:"", items:[defaultItem()], taxRate:0, notes:"" };
  renderItems(); updateTotals();
  clientName.value = ""; clientAddress.value=""; dateEl.value=form.date; dueDateEl.value=""; taxRateEl.value=0; notesEl.value="";
}
dateEl.value = form.date;

function renderItems(){
  itemsBody.innerHTML = "";
  form.items.forEach((it, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${it.description}" placeholder="e.g. Consulting" data-idx="${idx}" data-key="description"/></td>
      <td class="w-qty"><input type="number" value="${it.qty}" data-idx="${idx}" data-key="qty"/></td>
      <td class="w-price"><input type="number" value="${it.price}" data-idx="${idx}" data-key="price"/></td>
      <td class="w-amt right">${settings.currency} ${money(it.qty*it.price)}</td>
      <td class="right"><button class="btn" data-action="remove" data-idx="${idx}" ${form.items.length===1?'disabled':''}>Remove</button></td>
    `;
    itemsBody.appendChild(tr);
  });
}
function updateTotals(){
  const sub = form.items.reduce((s,it)=> s + Number(it.qty||0)*Number(it.price||0), 0);
  const tax = sub * (Number(form.taxRate||0)/100);
  const tot = sub + tax;
  subtotalVal.textContent = `${settings.currency} ${money(sub)}`;
  taxPct.textContent = form.taxRate || 0;
  taxVal.textContent = `${settings.currency} ${money(tax)}`;
  totalVal.textContent = `${settings.currency} ${money(tot)}`;
}
itemsBody.addEventListener('input', (e)=>{
  const t = e.target;
  const idx = Number(t.dataset.idx);
  const key = t.dataset.key;
  if(key){ form.items[idx][key] = key==='description' ? t.value : Number(t.value||0); }
  updateTotals();
});
itemsBody.addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  if(btn.dataset.action==='remove'){
    const idx = Number(btn.dataset.idx);
    if(form.items.length>1){ form.items.splice(idx,1); renderItems(); updateTotals(); }
  }
});
addItemBtn.onclick = ()=>{ form.items.push(defaultItem()); renderItems(); };

clientName.oninput = ()=> form.clientName = clientName.value;
clientAddress.oninput = ()=> form.clientAddress = clientAddress.value;
dateEl.oninput = ()=> form.date = dateEl.value;
dueDateEl.oninput = ()=> form.dueDate = dueDateEl.value;
taxRateEl.oninput = ()=> { form.taxRate = Number(taxRateEl.value||0); updateTotals(); };
notesEl.oninput = ()=> form.notes = notesEl.value;

function nextNumber(){
  const pad = String(counter).padStart(settings.padding||0,'0');
  return `${settings.prefix||'INV-'}${pad}`;
}

document.getElementById('saveInvoice').onclick = ()=>{
  if(!form.clientName || form.items.length===0){ alert("Please add client name and at least one item."); return; }
  const number = nextNumber();
  const sub = form.items.reduce((s,it)=> s + Number(it.qty||0)*Number(it.price||0), 0);
  const tax = sub * (Number(form.taxRate||0)/100);
  const tot = sub + tax;
  const record = {
    id: crypto.randomUUID(),
    number,
    ...form,
    createdAt: new Date().toISOString(),
    businessName: settings.businessName,
    businessAddress: settings.businessAddress,
    currency: settings.currency,
    subTotal: Number(sub.toFixed(2)),
    taxAmount: Number(tax.toFixed(2)),
    total: Number(tot.toFixed(2)),
    footerNote: settings.footerNote,
  };
  invoices.unshift(record);
  counter += 1;
  save(LS.invoices, invoices); save(LS.counter, counter);
  // open modal
  openModal(record);
  // reset for next
  resetForm();
  switchTab('list');
};

document.getElementById('clearForm').onclick = resetForm;

// List view
const searchEl = document.getElementById('search');
const listBody = document.getElementById('listBody');
function renderList(){
  const q = (searchEl.value||"").toLowerCase().trim();
  let rows = invoices;
  if(q){
    rows = rows.filter(inv => [inv.number, inv.clientName, inv.clientAddress, inv.date, inv.dueDate, String(inv.total)]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }
  listBody.innerHTML = "";
  if(rows.length===0){
    const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="6" class="empty">No invoices yet.</td>`; listBody.appendChild(tr); return;
  }
  rows.forEach(inv=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${inv.number}</td>
      <td>${inv.clientName}</td>
      <td>${inv.date}</td>
      <td>${inv.dueDate||'-'}</td>
      <td class="right">${inv.currency} ${money(inv.total)}</td>
      <td class="right">
        <button class="btn" data-act="view" data-id="${inv.id}">View / Print</button>
        <button class="btn" data-act="del" data-id="${inv.id}">Delete</button>
      </td>
    `;
    listBody.appendChild(tr);
  });
}
searchEl && (searchEl.oninput = renderList);
listBody.addEventListener('click', (e)=>{
  const b = e.target.closest('button'); if(!b) return;
  const id = b.dataset.id;
  const inv = invoices.find(x=>x.id===id);
  if(b.dataset.act==='view'){ openModal(inv); }
  if(b.dataset.act==='del'){
    if(confirm("Delete this invoice?")){
      invoices = invoices.filter(x=>x.id!==id);
      save(LS.invoices, invoices);
      renderList();
    }
  }
});

// Export / Import
document.getElementById('exportJSON').onclick = ()=>{
  const blob = new Blob([JSON.stringify(invoices,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`invoices_${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
};
document.getElementById('importJSON').onchange = (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error("Invalid file");
      const map = new Map();
      [...invoices, ...data].forEach(inv=>map.set(inv.id, inv));
      invoices = Array.from(map.values()).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
      save(LS.invoices, invoices);
      alert("Import complete."); renderList();
    }catch(err){ alert("Could not import: "+err.message); }
  };
  reader.readAsText(f);
};

// Settings view
const bizName = document.getElementById('bizName');
const bizAddress = document.getElementById('bizAddress');
const footerNote = document.getElementById('footerNote');
const prefix = document.getElementById('prefix');
const padding = document.getElementById('padding');
const currency = document.getElementById('currency');
const resetCounter = document.getElementById('resetCounter');

function loadSettingsForm(){
  bizName.value = settings.businessName;
  bizAddress.value = settings.businessAddress;
  footerNote.value = settings.footerNote;
  prefix.value = settings.prefix;
  padding.value = settings.padding;
  currency.value = settings.currency;
}
[bizName,bizAddress,footerNote,prefix,padding,currency].forEach(el=>{
  el.oninput = ()=>{
    settings.businessName = bizName.value;
    settings.businessAddress = bizAddress.value;
    settings.footerNote = footerNote.value;
    settings.prefix = prefix.value;
    settings.padding = Number(padding.value||0);
    settings.currency = currency.value;
    save(LS.settings, settings);
    renderList();
  };
});
resetCounter.onclick = ()=>{ counter = 1; save(LS.counter, counter); alert("Next invoice will use number 1."); };

// Modal + Print
const modal = document.getElementById('modal');
const btnPrint = document.getElementById('btnPrint');
const btnClose = document.getElementById('btnClose');
const mNumber = document.getElementById('mNumber');
const mCreated = document.getElementById('mCreated');
const printable = document.getElementById('printable');

function openModal(inv){
  mNumber.textContent = inv.number;
  mCreated.textContent = "Created " + new Date(inv.createdAt).toLocaleString();
  printable.innerHTML = renderPrintable(inv);
  modal.classList.remove('hidden');
}
btnClose.onclick = ()=> modal.classList.add('hidden');
btnPrint.onclick = ()=> window.print();

function renderPrintable(inv){
  const rows = inv.items.map(it=>`
    <tr>
      <td>${escapeHtml(it.description)}</td>
      <td>${it.qty}</td>
      <td>${inv.currency} ${money(it.price)}</td>
      <td>${inv.currency} ${money(it.qty*it.price)}</td>
    </tr>
  `).join("");
  return `
    <div class="inv-head">
      <div>
        <div class="inv-title">${escapeHtml(inv.businessName)}</div>
        <div class="muted">${escapeHtml((inv.businessAddress||""))}</div>
      </div>
      <div class="inv-meta">
        <div><strong>INVOICE</strong></div>
        <div>No: ${inv.number}</div>
        <div>Date: ${inv.date}</div>
        <div>Due: ${inv.dueDate||"—"}</div>
      </div>
    </div>
    <div class="inv-bill">
      <div><strong>Bill To</strong></div>
      <div>${escapeHtml(inv.clientName)}</div>
      <div class="muted">${escapeHtml(inv.clientAddress||"")}</div>
    </div>
    <table class="inv-table">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="inv-totals">
      <div class="inv-note">${inv.notes ? `<div><strong>Notes</strong></div><div>${escapeHtml(inv.notes)}</div>` : ""}</div>
      <div class="inv-sum">
        <div class="totline"><span>Subtotal</span><span>${inv.currency} ${money(inv.subTotal)}</span></div>
        <div class="totline"><span>Tax</span><span>${inv.currency} ${money(inv.taxAmount)}</span></div>
        <div class="totline grand"><span>Total</span><span>${inv.currency} ${money(inv.total)}</span></div>
      </div>
    </div>
    ${inv.footerNote ? `<div class="footnote">${escapeHtml(inv.footerNote)}</div>` : ""}
  `;
}
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s])); }

// Initialize
renderItems(); updateTotals(); renderList(); loadSettingsForm();

