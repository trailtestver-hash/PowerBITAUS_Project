(function(){
'use strict';

const $=id=>document.getElementById(id);
const KEY='mm_standalone_v1';
const LEGACY_URL='https://jewels-money-management.truongnguyetanh22964.chatgpt.site/';
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtDate=s=>{if(!s)return'';const[y,m,d]=s.split('-');return `${d}-${months[+m-1]}-${y}`};
const dateObj=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const iso=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)};
const addDays=(s,n)=>{const d=dateObj(s);d.setDate(d.getDate()+n);return iso(d)};
const nowTime=()=>new Date().toTimeString().slice(0,5);
const showTime=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);return `${String((h%12)||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=n=>'৳'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
const amount=v=>{const n=Number(String(v||'').replace(/,/g,''));return Number.isFinite(n)&&n>0?n:null};

function readStoredState(){
  try{const local=localStorage.getItem(KEY);if(local)return JSON.parse(local)}catch(e){}
  try{if(window.MoneyBackup&&typeof window.MoneyBackup.getBackup==='function'){const native=window.MoneyBackup.getBackup();if(native)return JSON.parse(native)}}catch(e){}
  return null;
}

function inferIcon(name,type){
  const text=String(name||'').toLowerCase();
  if(/food|খাবার|meal|restaurant|বাজার/.test(text))return'🍽️';
  if(/transport|যাতায়াত|car|bus|fuel|রিকশা/.test(text))return'🚗';
  if(/shop|কেনাকাটা|clothes|পোশাক/.test(text))return'🛍️';
  if(/bill|বিল|electric|gas|internet|rent/.test(text))return'🧾';
  if(/health|চিকিৎসা|doctor|medicine/.test(text))return'🩺';
  if(/salary|বেতন|job/.test(text))return'💼';
  if(/business|ব্যবসা|sale/.test(text))return'🏪';
  if(/gift|উপহার/.test(text))return'🎁';
  if(/loan|লোন|ধার/.test(text))return'🤝';
  if(/home|house|বাসা/.test(text))return'🏠';
  if(/education|school|book|পড়া|শিক্ষা/.test(text))return'📚';
  if(/travel|trip|ভ্রমণ/.test(text))return'✈️';
  return type==='income'?'💰':'📦';
}

let state=readStoredState()||{profiles:[{id:'default',name:'My Profile'}],active:'default',tx:[],drafts:[],reminders:[],loans:[],categories:[]};
function normaliseState(data){
  if(!data||typeof data!=='object')data={};
  if(!Array.isArray(data.profiles)||!data.profiles.length)data.profiles=[{id:'default',name:'My Profile'}];
  if(!data.active||!data.profiles.some(p=>p.id===data.active))data.active=data.profiles[0].id;
  ['tx','drafts','reminders','loans','categories'].forEach(k=>{if(!Array.isArray(data[k]))data[k]=[]});
  data.loans.forEach(l=>{if(!Array.isArray(l.payments))l.payments=[]});
  data.categories.forEach(c=>{if(!c.icon)c.icon=inferIcon(c.name,c.type)});
  data.tx.forEach(t=>{if(!t.categoryIcon)t.categoryIcon=t.categoryName&&t.categoryName!=='Uncategorized'?inferIcon(t.categoryName,t.type):''});
  return data;
}
state=normaliseState(state);

const DEFAULT_CATEGORIES={
  expense:[['🍽️','Food','খাবার'],['🚗','Transport','যাতায়াত'],['🛍️','Shopping','কেনাকাটা'],['🧾','Bills','বিল'],['🩺','Health','চিকিৎসা'],['📦','Other Expense','অন্যান্য']],
  income:[['💼','Salary','বেতন'],['🏪','Business','ব্যবসা'],['🎁','Gift','উপহার'],['↩️','Refund','ফেরত'],['💰','Other Income','অন্যান্য']]
};
function ensureCategoriesForProfile(profileId){
  const has=state.categories.some(c=>c.profileId===profileId);
  if(has)return;
  Object.entries(DEFAULT_CATEGORIES).forEach(([type,items])=>items.forEach(([icon,name,subcategory])=>state.categories.push({id:uid(),profileId,type,icon,name,subcategory,createdAt:Date.now()})));
}
state.profiles.forEach(p=>ensureCategoriesForProfile(p.id));

let account='Cash',anchor=today(),openDays=new Set([today()]);
let editId=null,pending=null,undoTimer=null,longTimer=null,start={x:0,y:0};
let loanKind='given',loanFilter='all',openLoanIds=new Set(),paymentLoanId=null;
let categoryEditId=null;
let driveStatus={connected:false,intervalMinutes:0,lastBackupAt:0};

function save(){
  const json=JSON.stringify(state);
  localStorage.setItem(KEY,json);
  try{if(window.MoneyBackup&&typeof window.MoneyBackup.saveBackup==='function')window.MoneyBackup.saveBackup(json)}catch(e){}
}
save();

const activeTx=()=>state.tx.filter(t=>t.profileId===state.active);
const activeLoans=()=>state.loans.filter(l=>l.profileId===state.active);
const activeCategories=type=>state.categories.filter(c=>c.profileId===state.active&&(!type||c.type===type));
const categoryLabel=c=>c?`${c.name}${c.subcategory?' / '+c.subcategory:''}`:'';
const getCategory=id=>state.categories.find(c=>c.id===id);
const txIcon=t=>t.categoryIcon||(getCategory(t.categoryId)?.icon)||(t.categoryName&&t.categoryName!=='Uncategorized'?inferIcon(t.categoryName,t.type):'');

function toast(s){$('toast').textContent=s;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1800)}
function profiles(){$('profileSelect').innerHTML=state.profiles.map(p=>`<option value="${p.id}" ${p.id===state.active?'selected':''}>${esc(p.name)}</option>`).join('')}

function categoryOptions(type,selectedId,legacyName){
  const list=activeCategories(type);
  let options='<option value="">○ Category নেই</option>';
  options+=list.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${esc(c.icon||inferIcon(c.name,c.type))} ${esc(categoryLabel(c))}</option>`).join('');
  if(selectedId&&!list.some(c=>c.id===selectedId)&&legacyName)options+=`<option value="" selected>${esc(legacyName)} (পুরোনো)</option>`;
  return options;
}
function updateQuickCategoryIcons(){
  ['expense','income'].forEach(type=>{
    const c=getCategory($(type+'Category').value),el=$(type+'CategoryIcon');
    if(!el)return;
    el.textContent=c?.icon||'○';
    el.classList.toggle('empty',!c);
    el.title=c?categoryLabel(c):'Category দেওয়া হয়নি';
  });
}
function renderCategorySelects(){
  const ex=$('expenseCategory').value,inc=$('incomeCategory').value;
  $('expenseCategory').innerHTML=categoryOptions('expense',ex);
  $('incomeCategory').innerHTML=categoryOptions('income',inc);
  updateQuickCategoryIcons();
}
function selectedCategoryMeta(type,selectId){
  const c=getCategory($(selectId).value);
  if(!c||c.type!==type)return{categoryId:'',categoryName:'Uncategorized',categoryIcon:''};
  return{categoryId:c.id,categoryName:categoryLabel(c),categoryIcon:c.icon||inferIcon(c.name,c.type)};
}

function setAutosaveStatus(text){if($('autosaveStatus'))$('autosaveStatus').textContent=text}
function clearRow(type){['Amount','Subject','Remarks'].forEach(x=>$(type+x).value='');$(type+'Date').value=today();$(type+'Category').value='';updateQuickCategoryIcons()}
function cancelAllQuickInputs(){clearRow('expense');clearRow('income');setAutosaveStatus('✓ Auto-saved');toast('Save হওয়ার আগের input মুছে গেছে')}
function createTx(type,a,subject,remarks,date,accountOverride,meta){
  const t={id:uid(),profileId:state.active,type,amount:+a,subject:(subject||'').trim(),remarks:(remarks||'').trim(),date:date||today(),time:nowTime(),account:accountOverride||account,categoryId:'',categoryName:'Uncategorized',categoryIcon:'',createdAt:Date.now(),updatedAt:Date.now(),...(meta||{})};
  state.tx.unshift(t);return t;
}
function createAndSaveTx(type,a,subject,remarks,date,accountOverride,meta){setAutosaveStatus('Saving…');createTx(type,a,subject,remarks,date,accountOverride,meta);save();render();setAutosaveStatus('✓ Auto-saved');toast(type==='income'?'আয় যোগ হয়েছে':'ব্যয় যোগ হয়েছে')}
function quickSave(type){const a=amount($(type+'Amount').value);if(!a)return false;createAndSaveTx(type,a,$(type+'Subject').value,$(type+'Remarks').value,$(type+'Date').value,null,selectedCategoryMeta(type,type+'Category'));clearRow(type);return true}
function scheduleSave(type){setTimeout(()=>{const active=document.activeElement;if(active?.dataset?.row===type)return;quickSave(type)},180)}

function renderDrafts(){$('draftList').innerHTML=state.drafts.map(d=>`<div class="draft-row" data-draft="${d.id}"><input data-f="subject" value="${esc(d.subject)}"><input data-f="expense" inputmode="decimal" placeholder="ব্যয়"><input data-f="income" inputmode="decimal" placeholder="আয়"><input data-f="remarks" placeholder="মন্তব্য"><button data-remove="${d.id}">×</button></div>`).join('')}
function commitDraft(id){const row=document.querySelector(`[data-draft="${id}"]`);if(!row)return;const ex=amount(row.querySelector('[data-f="expense"]').value),inc=amount(row.querySelector('[data-f="income"]').value);if(ex&&inc){toast('একই row-তে আয় ও ব্যয় নয়');return}if(!ex&&!inc)return;createTx(inc?'income':'expense',inc||ex,row.querySelector('[data-f="subject"]').value,row.querySelector('[data-f="remarks"]').value,today());state.drafts=state.drafts.filter(x=>x.id!==id);save();render()}

const days=()=>Array.from({length:10},(_,i)=>addDays(anchor,-i));
function dayRows(d){return activeTx().filter(t=>t.date===d).sort((a,b)=>(b.time||'').localeCompare(a.time||''))}
function subjectCell(t){
  const icon=txIcon(t),assigned=Boolean(icon),name=t.categoryName&&t.categoryName!=='Uncategorized'?t.categoryName:'Category নেই';
  return `<div class="subject-category-cell"><span class="category-logo ${assigned?'':'empty'}" title="${esc(name)}">${assigned?esc(icon):'○'}</span><div><strong>${esc(t.subject||'—')}</strong><small>${esc(name)}</small></div></div>`;
}
function renderHistory(){
  $('rangeLabel').textContent=`${fmtDate(addDays(anchor,-9))} — ${fmtDate(anchor)}`;$('jumpLabel').textContent=fmtDate(anchor);$('jumpDate').value=anchor;
  $('historyList').innerHTML=days().map(d=>{const rows=dayRows(d),inc=rows.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0),exp=rows.filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0);const body=rows.length?`<div class="table-scroll"><table class="tx-table"><thead><tr><th>সময়</th><th>Subject / Category</th><th>আয়</th><th>ব্যয়</th><th>মন্তব্য</th><th>Account</th><th>Delete</th></tr></thead><tbody>${rows.map(t=>`<tr class="tx-row" data-id="${t.id}"><td>${showTime(t.time)}</td><td>${subjectCell(t)}</td><td class="money-in">${t.type==='income'?money(t.amount):''}</td><td class="money-out">${t.type==='expense'?money(t.amount):''}</td><td>${esc(t.remarks||'')}</td><td>${esc(t.account)}</td><td><button class="delete-icon" data-delete="${t.id}">×</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">কোনো transaction নেই</div>';return `<div class="day-card ${openDays.has(d)?'open':''}"><div class="day-head"><button data-day="${d}">${fmtDate(d)}</button><span class="day-total income">আয় ${money(inc)}</span><span class="day-total expense">ব্যয় ${money(exp)}</span></div><div class="day-body">${body}<div class="day-actions"><button data-add-date="${d}">এই তারিখে নতুন এন্ট্রি</button></div></div></div>`}).join('');
}
function removeTx(id){const i=state.tx.findIndex(t=>t.id===id);if(i<0)return;if(undoTimer)clearTimeout(undoTimer);pending={item:state.tx[i],index:i};state.tx.splice(i,1);save();render();$('snackbar').classList.add('show');undoTimer=setTimeout(()=>{pending=null;$('snackbar').classList.remove('show')},8000)}
function undo(){if(!pending)return;state.tx.splice(Math.min(pending.index,state.tx.length),0,pending.item);pending=null;clearTimeout(undoTimer);$('snackbar').classList.remove('show');save();render();toast('Transaction ফিরে এসেছে')}

function fillEditCategory(type,selectedId,legacyName){$('editCategory').innerHTML=categoryOptions(type,selectedId,legacyName)}
function openEdit(id){const t=state.tx.find(x=>x.id===id);if(!t)return;editId=id;$('editType').value=t.type;$('editAmount').value=t.amount;$('editSubject').value=t.subject||'';$('editRemarks').value=t.remarks||'';$('editAccount').value=t.account;$('editDate').value=t.date;$('editTime').value=t.time;fillEditCategory(t.type,t.categoryId,t.categoryName);$('editBackdrop').classList.add('show')}
function closeEdit(){editId=null;$('editBackdrop').classList.remove('show')}
function saveEdit(){const t=state.tx.find(x=>x.id===editId),a=amount($('editAmount').value);if(!t||!a){toast('সঠিক Amount দিন');return}const type=$('editType').value,c=getCategory($('editCategory').value);Object.assign(t,{type,amount:a,subject:$('editSubject').value.trim(),remarks:$('editRemarks').value.trim(),account:$('editAccount').value,date:$('editDate').value,time:$('editTime').value||nowTime(),categoryId:c?.id||'',categoryName:c?categoryLabel(c):'Uncategorized',categoryIcon:c?.icon||'',updatedAt:Date.now()});save();closeEdit();render();toast('Transaction updated')}

function summary(list){const inc=list.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0),exp=list.filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0);return{inc,exp,balance:inc-exp,count:list.length}}
const summaryHtml=s=>`<div class="summary-card"><small>আয়</small><strong class="money-in">${money(s.inc)}</strong></div><div class="summary-card"><small>ব্যয়</small><strong class="money-out">${money(s.exp)}</strong></div><div class="summary-card"><small>Balance</small><strong>${money(s.balance)}</strong></div><div class="summary-card"><small>Transaction</small><strong>${s.count}</strong></div>`;
function renderReports(){const f=$('reportFrom').value,t=$('reportTo').value,list=activeTx().filter(x=>(!f||x.date>=f)&&(!t||x.date<=t));$('reportSummary').innerHTML=summaryHtml(summary(list));const groups={};list.forEach(x=>{const icon=txIcon(x),k=`${icon?icon+' ':''}${x.categoryName||'Uncategorized'}`;groups[k]=(groups[k]||0)+(x.type==='expense'?-x.amount:x.amount)});$('categoryBreakdown').innerHTML=Object.entries(groups).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k,v])=>`<div class="category-line"><span>${esc(k)}</span><strong class="${v>=0?'money-in':'money-out'}">${v>=0?'+':''}${money(v)}</strong></div>`).join('')||'<div class="empty">Data নেই</div>'}
function renderReminders(){$('reminderList').innerHTML=state.reminders.filter(r=>r.profileId===state.active).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>`<div class="reminder-item"><div><strong>${esc(r.title)}</strong><small>${fmtDate(r.date)} ${r.amount?money(r.amount):''}</small></div><button data-reminder="${r.id}">${r.done?'Undo':'Paid'}</button></div>`).join('')||'<div class="empty">কোনো reminder নেই</div>'}

function loanPaid(l){return(l.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0)}
function loanRemaining(l){return Math.max(0,Number(l.principal||0)-loanPaid(l))}
function loanStatus(l){if(loanRemaining(l)<=0.0001)return'paid';if(l.dueDate&&l.dueDate<today())return'overdue';return'active'}
function renderLoanSummary(){const unpaid=activeLoans().filter(l=>loanStatus(l)!=='paid'),receivable=unpaid.filter(l=>l.kind==='given').reduce((s,l)=>s+loanRemaining(l),0),payable=unpaid.filter(l=>l.kind==='taken').reduce((s,l)=>s+loanRemaining(l),0),overdue=unpaid.filter(l=>loanStatus(l)==='overdue').length;$('loanSummary').innerHTML=`<div class="loan-summary-card receivable"><small>পাওনা বাকি</small><strong>${money(receivable)}</strong></div><div class="loan-summary-card payable"><small>দেনা বাকি</small><strong>${money(payable)}</strong></div><div class="loan-summary-card given"><small>চলমান লোন</small><strong>${unpaid.length.toLocaleString('en-US')} টি</strong></div><div class="loan-summary-card taken"><small>সময় পার</small><strong>${overdue.toLocaleString('en-US')} টি</strong></div>`}
function paymentRows(l){const ps=[...(l.payments||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));return ps.length?ps.map(p=>`<div class="loan-payment-row"><span>${fmtDate(p.date)}</span><div>${esc(p.note||'পরিশোধ')}<small> · ${esc(p.account||'Cash')}</small></div><strong>${money(p.amount)}</strong></div>`).join(''):'<div class="empty">এখনো কোনো পরিশোধ নেই</div>'}
function renderLoans(){renderLoanSummary();let list=[...activeLoans()].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));if(loanFilter==='active')list=list.filter(l=>loanStatus(l)!=='paid');if(loanFilter==='paid')list=list.filter(l=>loanStatus(l)==='paid');$('loanList').innerHTML=list.map(l=>{const paid=loanPaid(l),remain=loanRemaining(l),pct=Math.min(100,l.principal?paid/l.principal*100:0),status=loanStatus(l),kindLabel=l.kind==='given'?'আমি দিয়েছি':'আমি নিয়েছি',statusLabel=status==='paid'?'পরিশোধিত':status==='overdue'?'সময় পার হয়েছে':'চলমান';return `<article class="loan-card ${openLoanIds.has(l.id)?'open':''}" data-loan-card="${l.id}"><div class="loan-card-head"><div class="loan-person"><div class="loan-icon ${l.kind}">${l.kind==='given'?'↗':'↙'}</div><div><h3>${esc(l.person)}</h3><small>${kindLabel} · ${fmtDate(l.startDate)}${l.note?' · '+esc(l.note):''}</small></div></div><span class="status ${status}">${statusLabel}</span></div><div class="loan-money-grid"><div><small>মূল টাকা</small><strong>${money(l.principal)}</strong></div><div><small>পরিশোধ</small><strong class="money-in">${money(paid)}</strong></div><div><small>বাকি</small><strong class="${l.kind==='given'?'money-in':'money-out'}">${money(remain)}</strong></div></div><div class="loan-progress"><span style="width:${pct}%"></span></div><div class="loan-meta"><span>${Math.round(pct)}% পরিশোধ</span><span>${l.dueDate?'Due: '+fmtDate(l.dueDate):'Due date নেই'}</span></div><div class="loan-actions"><button class="loan-pay" data-loan-pay="${l.id}" ${status==='paid'?'disabled':''}>＋ পরিশোধ</button><button class="loan-history-toggle" data-loan-history="${l.id}">History</button><button class="loan-delete" data-loan-delete="${l.id}">×</button></div><div class="loan-payments">${paymentRows(l)}</div></article>`}).join('')||'<div class="empty">কোনো লোন এন্ট্রি নেই</div>'}
function resetLoanForm(){loanKind='given';document.querySelectorAll('[data-loan-kind]').forEach(b=>b.classList.toggle('active',b.dataset.loanKind===loanKind));$('loanPerson').value='';$('loanPrincipal').value='';$('loanStartDate').value=today();$('loanDueDate').value='';$('loanAccount').value='Cash';$('loanNote').value=''}
function addLoan(){const person=$('loanPerson').value.trim(),principal=amount($('loanPrincipal').value),startDate=$('loanStartDate').value||today(),dueDate=$('loanDueDate').value,acct=$('loanAccount').value,note=$('loanNote').value.trim();if(!person||!principal){toast('ব্যক্তির নাম ও মূল টাকা দিন');return}const loan={id:uid(),profileId:state.active,kind:loanKind,person,principal,startDate,dueDate,account:acct,note,payments:[],createdAt:Date.now()};state.loans.unshift(loan);createTx(loanKind==='given'?'expense':'income',principal,loanKind==='given'?`Loan Given — ${person}`:`Loan Taken — ${person}`,note,startDate,acct,{loanId:loan.id,loanEvent:'principal',categoryName:'Loan',categoryIcon:'🤝'});save();resetLoanForm();$('loanEntryCard').classList.remove('show');render();toast('লোন সংরক্ষণ হয়েছে')}
function openPayment(id){const l=state.loans.find(x=>x.id===id);if(!l)return;paymentLoanId=id;$('paymentTitle').textContent=l.kind==='given'?'লোন ফেরত পাওয়ার এন্ট্রি':'লোন পরিশোধের এন্ট্রি';$('paymentBalance').innerHTML=`${esc(l.person)} — বাকি আছে <strong>${money(loanRemaining(l))}</strong>`;$('paymentAmount').value='';$('paymentDate').value=today();$('paymentAccount').value=l.account||'Cash';$('paymentNote').value='';$('paymentBackdrop').classList.add('show')}
function closePayment(){paymentLoanId=null;$('paymentBackdrop').classList.remove('show')}
function savePayment(){const l=state.loans.find(x=>x.id===paymentLoanId),a=amount($('paymentAmount').value);if(!l||!a){toast('সঠিক Amount দিন');return}const remain=loanRemaining(l);if(a>remain+0.0001){toast(`সর্বোচ্চ ${money(remain)} দেওয়া যাবে`);return}const p={id:uid(),amount:a,date:$('paymentDate').value||today(),account:$('paymentAccount').value,note:$('paymentNote').value.trim(),createdAt:Date.now()};l.payments.push(p);createTx(l.kind==='given'?'income':'expense',a,l.kind==='given'?`Loan Received — ${l.person}`:`Loan Repayment — ${l.person}`,p.note,p.date,p.account,{loanId:l.id,loanPaymentId:p.id,loanEvent:'payment',categoryName:'Loan',categoryIcon:'🤝'});save();closePayment();render();toast(loanRemaining(l)<=0.0001?'লোন সম্পূর্ণ পরিশোধিত':'পরিশোধ যোগ হয়েছে')}
function deleteLoan(id){const l=state.loans.find(x=>x.id===id);if(!l)return;if(!confirm(`${l.person}-এর লোন মুছবেন? সম্পর্কিত transaction আলাদাভাবে থাকবে।`))return;state.loans=state.loans.filter(x=>x.id!==id);save();render();toast('লোন মুছে গেছে')}

function resetCategoryForm(){categoryEditId=null;$('categoryType').value='expense';$('categoryIcon').value='🍽️';$('categoryName').value='';$('categorySubcategory').value='';$('saveCategory').textContent='Category Add';$('cancelCategoryEdit').hidden=true}
function renderCategoryManager(){const list=[...activeCategories()].sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name));$('categoryManageList').innerHTML=list.map(c=>`<div class="category-manage-row"><span class="category-manager-logo">${esc(c.icon||inferIcon(c.name,c.type))}</span><span class="category-type-badge ${c.type}">${c.type==='income'?'Income':'Expense'}</span><div class="category-name"><strong>${esc(c.name)}</strong><small>${esc(c.subcategory||'Subcategory নেই')}</small></div><div class="category-row-actions"><button class="category-edit" data-category-edit="${c.id}">Edit</button><button class="category-delete" data-category-delete="${c.id}">Delete</button></div></div>`).join('')||'<div class="empty">Category নেই</div>'}
function saveCategory(){const type=$('categoryType').value,icon=$('categoryIcon').value||inferIcon($('categoryName').value,type),name=$('categoryName').value.trim(),subcategory=$('categorySubcategory').value.trim();if(!name){toast('Category নাম দিন');return}const duplicate=activeCategories(type).find(c=>c.id!==categoryEditId&&c.name.toLowerCase()===name.toLowerCase()&&(c.subcategory||'').toLowerCase()===subcategory.toLowerCase());if(duplicate){toast('এই Category আগে থেকেই আছে');return}if(categoryEditId){const c=getCategory(categoryEditId);if(c)Object.assign(c,{type,icon,name,subcategory,updatedAt:Date.now()});toast('Category updated')}else{state.categories.push({id:uid(),profileId:state.active,type,icon,name,subcategory,createdAt:Date.now()});toast('Category added')}resetCategoryForm();save();render()}
function editCategory(id){const c=getCategory(id);if(!c)return;categoryEditId=id;$('categoryType').value=c.type;$('categoryIcon').value=c.icon||inferIcon(c.name,c.type);$('categoryName').value=c.name;$('categorySubcategory').value=c.subcategory||'';$('saveCategory').textContent='Update Category';$('cancelCategoryEdit').hidden=false;$('categoryName').focus()}
function deleteCategory(id){const c=getCategory(id);if(!c)return;if(!confirm(`${categoryLabel(c)} Category মুছবেন? পুরোনো transaction-এর লেখা থাকবে।`))return;state.categories=state.categories.filter(x=>x.id!==id);if(categoryEditId===id)resetCategoryForm();save();render();toast('Category deleted')}

function formatBackupTime(timestamp){if(!timestamp)return'এখনো হয়নি';try{return new Date(timestamp).toLocaleString('en-US',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(e){return'এখনো হয়নি'}}
function applyDriveStatus(status){driveStatus={...driveStatus,...(status||{})};const connected=Boolean(driveStatus.connected);$('nativeBackupStatus').textContent=connected?'Drive সংযুক্ত':'Drive সংযুক্ত নয়';$('nativeBackupStatus').classList.toggle('connected',connected);$('driveConnectionText').textContent=connected?'Google Drive backup file সংযুক্ত':'Google Drive file নির্বাচন করুন';$('lastBackupText').textContent=formatBackupTime(Number(driveStatus.lastBackupAt||0));$('backupInterval').value=String(Number(driveStatus.intervalMinutes||0));$('cloudBackupHeader').classList.toggle('connected',connected);$('cloudBackupHeader').title=connected?'এখনই Google Drive backup':'Google Drive সংযুক্ত করুন'}
function requestDriveStatus(){try{if(window.MoneyBackup&&typeof window.MoneyBackup.getDriveStatus==='function'){applyDriveStatus(JSON.parse(window.MoneyBackup.getDriveStatus()||'{}'));return}}catch(e){}applyDriveStatus({connected:false,intervalMinutes:0,lastBackupAt:0})}
function backupNow(){const text=JSON.stringify(state,null,2);if(window.MoneyBackup&&typeof window.MoneyBackup.backupNow==='function')window.MoneyBackup.backupNow(text);else{const blob=new Blob([text],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Money_Management_Backup_${today()}.json`;a.click();URL.revokeObjectURL(a.href)}}
window.receiveDriveStatus=applyDriveStatus;
window.onDriveBackupResult=(success,message)=>{toast(message|| (success?'Backup হয়েছে':'Backup ব্যর্থ'));requestDriveStatus()};

function render(){ensureCategoriesForProfile(state.active);profiles();renderCategorySelects();renderDrafts();renderHistory();renderReports();renderReminders();renderLoans();renderCategoryManager()}
function page(name){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('active'));const id=name==='loans'?'loansPage':name==='reports'?'reportsPage':name==='reminders'?'remindersPage':name==='more'?'morePage':'homePage';$(id).classList.add('active');document.querySelector(`[data-nav="${name}"]`)?.classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
function importBackupText(text){try{state=normaliseState(JSON.parse(text));state.profiles.forEach(p=>ensureCategoriesForProfile(p.id));save();resetCategoryForm();render();toast('Backup restore হয়েছে')}catch(e){alert('সঠিক Money Management Backup JSON পাওয়া যায়নি')}}
window.receiveImportedBackup=importBackupText;

document.querySelectorAll('[data-row]').forEach(el=>{el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();quickSave(el.dataset.row)}});el.addEventListener('focusout',()=>scheduleSave(el.dataset.row))});
$('expenseCategory').onchange=updateQuickCategoryIcons;$('incomeCategory').onchange=updateQuickCategoryIcons;
$('cancelQuick').onclick=cancelAllQuickInputs;
$('accountButtons').onclick=e=>{const b=e.target.closest('[data-account]');if(!b)return;account=b.dataset.account;document.querySelectorAll('[data-account]').forEach(x=>x.classList.toggle('active',x===b))};
$('makeDrafts').onclick=()=>{const lines=$('bulkPaste').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length){toast('Line Break data paste করুন');return}state.drafts.push(...lines.map(subject=>({id:uid(),subject})));$('bulkPaste').value='';save();renderDrafts()};
$('draftList').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){state.drafts=state.drafts.filter(x=>x.id!==b.dataset.remove);save();renderDrafts()}};
$('draftList').addEventListener('keydown',e=>{if(e.key==='Enter'){const r=e.target.closest('[data-draft]');if(r){e.preventDefault();commitDraft(r.dataset.draft)}}});
$('draftList').addEventListener('focusout',e=>{const r=e.target.closest('[data-draft]');if(r)setTimeout(()=>{if(!r.contains(document.activeElement))commitDraft(r.dataset.draft)},120)});
$('prevTen').onclick=()=>{anchor=addDays(anchor,-10);renderHistory()};$('nextTen').onclick=()=>{anchor=addDays(anchor,10);renderHistory()};$('jumpDate').onchange=e=>{if(e.target.value){anchor=e.target.value;openDays.add(anchor);renderHistory()}};
$('historyList').onclick=e=>{const d=e.target.closest('[data-day]');if(d){openDays.has(d.dataset.day)?openDays.delete(d.dataset.day):openDays.add(d.dataset.day);renderHistory();return}const add=e.target.closest('[data-add-date]');if(add){$('expenseDate').value=add.dataset.addDate;$('incomeDate').value=add.dataset.addDate;page('quick');$('quickSection').scrollIntoView();return}const del=e.target.closest('[data-delete]');if(del){e.stopPropagation();removeTx(del.dataset.delete)}};
$('historyList').addEventListener('pointerdown',e=>{const r=e.target.closest('.tx-row');if(!r||e.target.closest('button'))return;start={x:e.clientX,y:e.clientY};longTimer=setTimeout(()=>openEdit(r.dataset.id),550)});['pointerup','pointercancel','pointerleave'].forEach(x=>$('historyList').addEventListener(x,()=>clearTimeout(longTimer)));$('historyList').addEventListener('pointermove',e=>{if(Math.abs(e.clientX-start.x)>8||Math.abs(e.clientY-start.y)>8)clearTimeout(longTimer)});$('historyList').ondblclick=e=>{const r=e.target.closest('.tx-row');if(r&&!e.target.closest('button'))openEdit(r.dataset.id)};
$('undoDelete').onclick=undo;$('cancelEdit').onclick=closeEdit;$('saveEdit').onclick=saveEdit;$('editType').onchange=e=>fillEditCategory(e.target.value,'','');$('editBackdrop').onclick=e=>{if(e.target===$('editBackdrop'))closeEdit()};
const n=new Date();$('reportFrom').value=iso(new Date(n.getFullYear(),n.getMonth(),1));$('reportTo').value=iso(new Date(n.getFullYear(),n.getMonth()+1,0));$('reportFrom').onchange=renderReports;$('reportTo').onchange=renderReports;
$('addReminder').onclick=()=>{const title=$('reminderTitle').value.trim(),date=$('reminderDate').value,a=amount($('reminderAmount').value)||0;if(!title||!date){toast('নাম ও তারিখ দিন');return}state.reminders.push({id:uid(),profileId:state.active,title,date,amount:a,done:false});$('reminderTitle').value='';$('reminderAmount').value='';save();renderReminders()};
$('reminderList').onclick=e=>{const b=e.target.closest('[data-reminder]');if(!b)return;const r=state.reminders.find(x=>x.id===b.dataset.reminder);if(r){r.done=!r.done;save();renderReminders()}};
$('addProfile').onclick=()=>{const name=$('newProfileName').value.trim();if(!name)return;const id=uid();state.profiles.push({id,name});state.active=id;ensureCategoriesForProfile(id);$('newProfileName').value='';save();render()};$('profileSelect').onchange=e=>{state.active=e.target.value;ensureCategoriesForProfile(state.active);resetCategoryForm();save();render()};
$('copyBackup').onclick=async()=>{const text=JSON.stringify(state,null,2);try{await navigator.clipboard.writeText(text);toast('Backup copied')}catch(e){prompt('Backup copy করুন',text)}};
$('clearAll').onclick=()=>{if(confirm('সব local data মুছবেন?')){state.tx=[];state.drafts=[];state.reminders=[];state.loans=[];state.categories=state.categories.filter(c=>c.profileId!==state.active);ensureCategoriesForProfile(state.active);save();render()}};
$('cloudBackupHeader').onclick=backupNow;$('driveBackup').onclick=backupNow;
$('connectDrive').onclick=()=>{const text=JSON.stringify(state,null,2);if(window.MoneyBackup&&typeof window.MoneyBackup.connectDrive==='function')window.MoneyBackup.connectDrive(text);else backupNow()};
$('driveRestore').onclick=()=>{if(window.MoneyBackup&&typeof window.MoneyBackup.importBackup==='function')window.MoneyBackup.importBackup();else{const text=prompt('Backup JSON paste করুন');if(text)importBackupText(text)}};
$('backupInterval').onchange=e=>{const minutes=Number(e.target.value||0);if(window.MoneyBackup&&typeof window.MoneyBackup.setAutoBackupMinutes==='function')window.MoneyBackup.setAutoBackupMinutes(minutes);else toast('Android app-এ Auto backup পাওয়া যাবে')};
$('disconnectDrive').onclick=()=>{if(!confirm('Google Drive auto backup disconnect করবেন?'))return;if(window.MoneyBackup&&typeof window.MoneyBackup.disconnectDrive==='function')window.MoneyBackup.disconnectDrive()};
$('openLegacyWeb').onclick=()=>{if(window.MoneyBackup&&typeof window.MoneyBackup.openLegacyWeb==='function')window.MoneyBackup.openLegacyWeb();else window.open(LEGACY_URL,'_blank')};
$('saveCategory').onclick=saveCategory;$('cancelCategoryEdit').onclick=resetCategoryForm;$('categoryManageList').onclick=e=>{const edit=e.target.closest('[data-category-edit]');if(edit){editCategory(edit.dataset.categoryEdit);return}const del=e.target.closest('[data-category-delete]');if(del)deleteCategory(del.dataset.categoryDelete)};
$('openLoanForm').onclick=()=>{$('loanEntryCard').classList.add('show');$('loanEntryCard').scrollIntoView({behavior:'smooth'})};$('closeLoanForm').onclick=()=>$('loanEntryCard').classList.remove('show');$('loanKindToggle').onclick=e=>{const b=e.target.closest('[data-loan-kind]');if(!b)return;loanKind=b.dataset.loanKind;document.querySelectorAll('[data-loan-kind]').forEach(x=>x.classList.toggle('active',x===b))};$('saveLoan').onclick=addLoan;
$('loanFilter').onclick=e=>{const b=e.target.closest('[data-loan-filter]');if(!b)return;loanFilter=b.dataset.loanFilter;document.querySelectorAll('[data-loan-filter]').forEach(x=>x.classList.toggle('active',x===b));renderLoans()};
$('loanList').onclick=e=>{const pay=e.target.closest('[data-loan-pay]');if(pay){openPayment(pay.dataset.loanPay);return}const hist=e.target.closest('[data-loan-history]');if(hist){openLoanIds.has(hist.dataset.loanHistory)?openLoanIds.delete(hist.dataset.loanHistory):openLoanIds.add(hist.dataset.loanHistory);renderLoans();return}const del=e.target.closest('[data-loan-delete]');if(del)deleteLoan(del.dataset.loanDelete)};
$('cancelPayment').onclick=closePayment;$('savePayment').onclick=savePayment;$('paymentBackdrop').onclick=e=>{if(e.target===$('paymentBackdrop'))closePayment()};
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>{const x=b.dataset.nav;if(x==='quick'){page('quick');$('quickSection').scrollIntoView()}else page(x)});
$('expenseDate').value=today();$('incomeDate').value=today();$('reminderDate').value=today();$('loanStartDate').value=today();$('paymentDate').value=today();resetLoanForm();resetCategoryForm();render();requestDriveStatus();
})();
