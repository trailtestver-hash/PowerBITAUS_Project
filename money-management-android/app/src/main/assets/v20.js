// /money-management-android/app/src/main/assets/v20.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const $=id=>document.getElementById(id);
const money=value=>'৳'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2});
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const today=()=>{const date=new Date();date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,10)};

function readState(){
  try{
    const data=JSON.parse(localStorage.getItem(KEY)||'{}');
    ['profiles','tx','loans','reminders','categories','drafts'].forEach(key=>{if(!Array.isArray(data[key]))data[key]=[]});
    return data;
  }catch(error){
    return{profiles:[],tx:[],loans:[],reminders:[],categories:[],drafts:[]};
  }
}

function persistState(state){
  const json=JSON.stringify(state);
  localStorage.setItem(KEY,json);
  try{
    if(window.MoneyBackup&&typeof window.MoneyBackup.saveBackup==='function')window.MoneyBackup.saveBackup(json);
  }catch(error){}
}

function notify(message){
  const toast=$('toast');
  if(!toast){alert(message);return}
  toast.textContent=message;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),1900);
}

function activeProfileId(){return readState().active||'default'}
function activeProfile(state){return state.profiles.find(profile=>profile.id===state.active)||state.profiles[0]}
function categoryLabel(category){return category?`${category.name}${category.subcategory?' / '+category.subcategory:''}`:''}

let expandMode=null;
let selectionMode=false;
let selectedIds=new Set();
let selectionTimer=null;
let selectionStart={x:0,y:0};
let suppressRowClickId='';
let profileActionsId='';
let profilePressTimer=null;
let profileLongFired=false;

function addHistoryControls(){
  const historySection=$('historySection');
  const tools=historySection?.querySelector('.history-tools');
  if(!historySection||!tools||$('historyExpandTools'))return;

  const expand=document.createElement('div');
  expand.className='history-expand-tools';
  expand.id='historyExpandTools';
  expand.innerHTML='<button id="expandAllDays" type="button">সব খুলুন</button><button id="collapseAllDays" type="button">সব বন্ধ করুন</button>';
  tools.appendChild(expand);

  const bulk=document.createElement('div');
  bulk.className='bulk-selection-toolbar';
  bulk.id='bulkSelectionToolbar';
  bulk.innerHTML=`
    <div class="bulk-selection-top"><strong id="selectedTransactionCount">০টি নির্বাচিত</strong><button id="cancelBulkSelection" type="button">বাতিল</button></div>
    <div class="bulk-category-grid">
      <label>নির্বাচিত Expense-এর Category<select id="bulkExpenseCategory"></select></label>
      <label>নির্বাচিত Income-এর Category<select id="bulkIncomeCategory"></select></label>
    </div>
    <div class="bulk-action-buttons"><button id="applyBulkCategories" class="bulk-apply" type="button">Category Apply / Change</button><button id="deleteBulkTransactions" class="bulk-delete" type="button">Delete</button></div>
    <div class="selection-help">Time-এর উপর চেপে ধরে selection চালু করুন। এরপর অন্য row-তে tap করে একাধিক transaction নির্বাচন করুন।</div>`;
  tools.insertAdjacentElement('afterend',bulk);

  $('expandAllDays').onclick=()=>setExpandMode('all');
  $('collapseAllDays').onclick=()=>setExpandMode('none');
  $('cancelBulkSelection').onclick=exitSelectionMode;
  $('applyBulkCategories').onclick=applyBulkCategories;
  $('deleteBulkTransactions').onclick=deleteSelectedTransactions;
}

function setExpandMode(mode){
  expandMode=mode;
  applyExpandMode();
  $('expandAllDays')?.classList.toggle('active',mode==='all');
  $('collapseAllDays')?.classList.toggle('active',mode==='none');
}

function applyExpandMode(){
  if(!expandMode)return;
  document.querySelectorAll('#historyList .day-card').forEach(card=>card.classList.toggle('open',expandMode==='all'));
}

function bulkOptions(type){
  const state=readState();
  const profileId=state.active;
  const categories=state.categories.filter(category=>category.profileId===profileId&&category.type===type);
  return '<option value="__keep__">পরিবর্তন নয়</option><option value="__none__">Category সরান</option>'+categories.map(category=>`<option value="${escapeHtml(category.id)}">${escapeHtml(category.icon||'○')} ${escapeHtml(categoryLabel(category))}</option>`).join('');
}

function populateBulkCategoryControls(){
  const expense=$('bulkExpenseCategory');
  const income=$('bulkIncomeCategory');
  if(expense)expense.innerHTML=bulkOptions('expense');
  if(income)income.innerHTML=bulkOptions('income');
}

function enterSelectionMode(id){
  selectionMode=true;
  selectedIds.add(id);
  populateBulkCategoryControls();
  updateSelectionUI();
}

function exitSelectionMode(){
  selectionMode=false;
  selectedIds.clear();
  updateSelectionUI();
}

function toggleSelected(id){
  if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);
  if(!selectedIds.size){exitSelectionMode();return}
  updateSelectionUI();
}

function updateSelectionUI(){
  const toolbar=$('bulkSelectionToolbar');
  toolbar?.classList.toggle('show',selectionMode);
  if($('selectedTransactionCount'))$('selectedTransactionCount').textContent=`${selectedIds.size.toLocaleString('en-US')}টি নির্বাচিত`;
  document.querySelectorAll('#historyList .tx-row').forEach(row=>{
    row.classList.toggle('selection-mode',selectionMode);
    row.classList.toggle('bulk-selected',selectedIds.has(row.dataset.id));
  });
}

function saveAndReload(state,message){
  persistState(state);
  if(message)notify(message);
  setTimeout(()=>location.reload(),260);
}

function applyBulkCategories(){
  if(!selectedIds.size)return;
  const state=readState();
  const expenseValue=$('bulkExpenseCategory')?.value||'__keep__';
  const incomeValue=$('bulkIncomeCategory')?.value||'__keep__';
  let changed=0;

  state.tx.forEach(transaction=>{
    if(!selectedIds.has(transaction.id))return;
    const value=transaction.type==='income'?incomeValue:expenseValue;
    if(value==='__keep__')return;
    if(value==='__none__'){
      transaction.categoryId='';transaction.categoryName='Uncategorized';transaction.categoryIcon='';transaction.updatedAt=Date.now();changed++;return;
    }
    const category=state.categories.find(item=>item.id===value&&item.type===transaction.type);
    if(!category)return;
    transaction.categoryId=category.id;
    transaction.categoryName=categoryLabel(category);
    transaction.categoryIcon=category.icon||'';
    transaction.updatedAt=Date.now();
    changed++;
  });

  if(!changed){notify('কোনো Category change নির্বাচন করা হয়নি');return}
  saveAndReload(state,`${changed.toLocaleString('en-US')}টি transaction-এর Category পরিবর্তন হয়েছে`);
}

function deleteSelectedTransactions(){
  if(!selectedIds.size)return;
  if(!confirm(`${selectedIds.size.toLocaleString('en-US')}টি নির্বাচিত transaction মুছবেন?`))return;
  const state=readState();
  state.tx=state.tx.filter(transaction=>!selectedIds.has(transaction.id));
  saveAndReload(state,'নির্বাচিত transaction মুছে গেছে');
}

function bindHistorySelection(){
  const history=$('historyList');
  if(!history)return;

  history.addEventListener('pointerdown',event=>{
    const row=event.target.closest('.tx-row');
    if(!row)return;
    if(selectionMode){event.stopPropagation();return}
    const timeCell=row.cells?.[0];
    if(!timeCell||!timeCell.contains(event.target))return;
    event.stopPropagation();
    clearTimeout(selectionTimer);
    selectionStart={x:event.clientX,y:event.clientY};
    selectionTimer=setTimeout(()=>{
      suppressRowClickId=row.dataset.id;
      enterSelectionMode(row.dataset.id);
      if(navigator.vibrate)navigator.vibrate(35);
    },560);
  },true);

  history.addEventListener('pointermove',event=>{
    if(Math.abs(event.clientX-selectionStart.x)>8||Math.abs(event.clientY-selectionStart.y)>8)clearTimeout(selectionTimer);
  },true);
  ['pointerup','pointercancel','pointerleave'].forEach(name=>history.addEventListener(name,()=>clearTimeout(selectionTimer),true));

  history.addEventListener('click',event=>{
    const row=event.target.closest('.tx-row');
    if(!selectionMode||!row)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(suppressRowClickId===row.dataset.id){suppressRowClickId='';return}
    toggleSelected(row.dataset.id);
  },true);
}

function addTodayBalanceCard(){
  const history=$('historySection');
  if(!history||$('todayBalanceCard'))return;
  const card=document.createElement('section');
  card.className='today-balance-card';
  card.id='todayBalanceCard';
  history.insertAdjacentElement('afterend',card);
  renderTodayBalance();
}

function renderTodayBalance(){
  const card=$('todayBalanceCard');
  if(!card)return;
  const state=readState();
  const list=state.tx.filter(transaction=>transaction.profileId===state.active&&transaction.date===today());
  const income=list.filter(transaction=>transaction.type==='income').reduce((sum,transaction)=>sum+Number(transaction.amount||0),0);
  const expense=list.filter(transaction=>transaction.type==='expense').reduce((sum,transaction)=>sum+Number(transaction.amount||0),0);
  const balance=income-expense;
  const rawPercent=income>0?expense/income*100:(expense>0?100:0);
  const percent=Math.min(100,Math.max(0,rawPercent));
  const over=income>0&&expense>income;
  const status=income<=0?(expense>0?'আজ Income নেই':'আজ কোনো হিসাব নেই'):(over?`Limit ছাড়িয়েছে ${money(expense-income)}`:`Income limit-এর ${Math.round(rawPercent)}% খরচ`);
  card.innerHTML=`<small>আজকের Balance</small><h3>${money(balance)}</h3><div class="today-balance-meta"><span>Income limit: ${money(income)}</span><span>খরচ: ${money(expense)}</span></div><div class="today-limit-track"><div class="today-limit-fill ${over?'over':''}" style="width:${percent}%"></div></div><div class="today-limit-foot"><span>${escapeHtml(status)}</span><span>${list.length.toLocaleString('en-US')} transaction</span></div>`;
}

const chartColours=['#0f766e','#f59e0b','#ef6a62','#3b82f6','#8b5cf6','#14b8a6','#ec4899','#84cc16','#f97316','#64748b'];

function enumerateDates(from,to){
  if(!from||!to||from>to)return[];
  const output=[];
  const cursor=new Date(from+'T12:00:00');
  const end=new Date(to+'T12:00:00');
  while(cursor<=end&&output.length<370){
    const local=new Date(cursor);local.setMinutes(local.getMinutes()-local.getTimezoneOffset());output.push(local.toISOString().slice(0,10));cursor.setDate(cursor.getDate()+1);
  }
  return output;
}

function addReportCharts(){
  const breakdown=$('categoryBreakdown');
  if(!breakdown||$('reportCharts'))return;
  const charts=document.createElement('div');
  charts.id='reportCharts';
  charts.className='report-chart-grid';
  charts.innerHTML=`<section class="chart-card"><h3>Expense Category Pie Chart</h3><small id="pieRangeText">নির্বাচিত date range</small><div id="expensePieChart"></div></section><section class="chart-card"><h3>Daily Income & Expense Bar Chart</h3><small id="barRangeText">প্রতিদিনের আয় ও ব্যয়</small><div id="dailyBarChart"></div></section>`;
  breakdown.insertAdjacentElement('afterend',charts);
  renderReportCharts();
}

function renderReportCharts(){
  const pie=$('expensePieChart'),bar=$('dailyBarChart');
  if(!pie||!bar)return;
  const state=readState();
  const from=$('reportFrom')?.value||'';
  const to=$('reportTo')?.value||'';
  const list=state.tx.filter(transaction=>transaction.profileId===state.active&&(!from||transaction.date>=from)&&(!to||transaction.date<=to));
  if($('pieRangeText'))$('pieRangeText').textContent=`${from||'শুরু'} — ${to||'শেষ'}`;
  if($('barRangeText'))$('barRangeText').textContent=`${from||'শুরু'} — ${to||'শেষ'}`;

  const expenseGroups={};
  list.filter(transaction=>transaction.type==='expense').forEach(transaction=>{
    const key=`${transaction.categoryIcon?transaction.categoryIcon+' ':''}${transaction.categoryName&&transaction.categoryName!=='Uncategorized'?transaction.categoryName:'Category নেই'}`;
    expenseGroups[key]=(expenseGroups[key]||0)+Number(transaction.amount||0);
  });
  const pieRows=Object.entries(expenseGroups).sort((a,b)=>b[1]-a[1]);
  const pieTotal=pieRows.reduce((sum,row)=>sum+row[1],0);
  if(!pieTotal){
    pie.innerHTML='<div class="pie-empty">এই range-এ Expense নেই</div>';
  }else{
    let cursor=0;
    const segments=pieRows.map((row,index)=>{const start=cursor,end=cursor+row[1]/pieTotal*100;cursor=end;return`${chartColours[index%chartColours.length]} ${start}% ${end}%`});
    const legend=pieRows.map((row,index)=>`<div class="pie-legend-row"><span class="pie-dot" style="background:${chartColours[index%chartColours.length]}"></span><span>${escapeHtml(row[0])}</span><strong>${money(row[1])}</strong></div>`).join('');
    pie.innerHTML=`<div class="pie-layout"><div class="pie-donut" style="background:conic-gradient(${segments.join(',')})"></div><div class="pie-legend">${legend}</div></div>`;
  }

  let dates=enumerateDates(from,to);
  if(!dates.length)dates=[...new Set(list.map(transaction=>transaction.date))].sort();
  if(from&&to&&dates.length===370){dates=[...new Set(list.map(transaction=>transaction.date))].sort()}
  const daily=dates.map(date=>{
    const rows=list.filter(transaction=>transaction.date===date);
    return{date,income:rows.filter(transaction=>transaction.type==='income').reduce((sum,transaction)=>sum+Number(transaction.amount||0),0),expense:rows.filter(transaction=>transaction.type==='expense').reduce((sum,transaction)=>sum+Number(transaction.amount||0),0)};
  });
  const maxValue=Math.max(0,...daily.flatMap(row=>[row.income,row.expense]));
  if(!daily.length||!maxValue){
    bar.innerHTML='<div class="pie-empty">এই range-এ chart data নেই</div>';
  }else{
    const groups=daily.map(row=>{
      const incomeHeight=row.income?Math.max(3,row.income/maxValue*145):0;
      const expenseHeight=row.expense?Math.max(3,row.expense/maxValue*145):0;
      const label=row.date.slice(5).replace('-','/');
      return`<div class="daily-group"><div class="daily-bar income" style="height:${incomeHeight}px" title="${row.date} Income ${money(row.income)}"></div><div class="daily-bar expense" style="height:${expenseHeight}px" title="${row.date} Expense ${money(row.expense)}"></div><span class="daily-label">${label}</span></div>`;
    }).join('');
    bar.innerHTML=`<div class="daily-chart-scroll"><div class="daily-bars">${groups}</div></div><div class="chart-legend"><span class="legend-income">Income</span><span class="legend-expense">Expense</span></div>`;
  }
}

function addProfileManager(){
  const actions=document.querySelector('.header-actions');
  const select=$('profileSelect');
  if(!actions||!select||$('profileMenuButton'))return;

  const button=document.createElement('button');
  button.id='profileMenuButton';
  button.className='profile-menu-button';
  button.type='button';
  actions.appendChild(button);

  const backdrop=document.createElement('div');
  backdrop.id='profileBackdrop';
  backdrop.className='profile-backdrop';
  backdrop.innerHTML=`<section class="profile-sheet"><div class="profile-sheet-head"><h3>Profiles</h3><button id="closeProfileSheet" type="button">বন্ধ</button></div><div class="profile-sheet-note">Profile-এ tap করলে সেই হিসাব খুলবে। নামের উপর চেপে ধরে রাখলে Edit ও Delete option আসবে।</div><div id="profileModalList" class="profile-list"></div><div class="profile-add-row"><input id="profileModalNewName" placeholder="নতুন Profile নাম"><button id="profileModalAdd" type="button">＋ Add</button></div></section>`;
  document.body.appendChild(backdrop);

  button.onclick=openProfileManager;
  $('closeProfileSheet').onclick=closeProfileManager;
  backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeProfileManager()});
  $('profileModalAdd').onclick=addProfileFromModal;
  $('profileModalNewName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addProfileFromModal()}});

  const list=$('profileModalList');
  list.addEventListener('pointerdown',event=>{
    const main=event.target.closest('.profile-row-main');
    if(!main)return;
    profileLongFired=false;
    clearTimeout(profilePressTimer);
    profilePressTimer=setTimeout(()=>{profileLongFired=true;profileActionsId=main.dataset.profileId;renderProfileManager();if(navigator.vibrate)navigator.vibrate(35)},560);
  });
  ['pointerup','pointercancel','pointerleave'].forEach(name=>list.addEventListener(name,()=>clearTimeout(profilePressTimer)));
  list.addEventListener('click',event=>{
    const edit=event.target.closest('[data-profile-edit]');
    if(edit){renameProfileFromModal(edit.dataset.profileEdit);return}
    const remove=event.target.closest('[data-profile-delete]');
    if(remove){deleteProfileFromModal(remove.dataset.profileDelete);return}
    const main=event.target.closest('.profile-row-main');
    if(!main)return;
    if(profileLongFired){profileLongFired=false;event.preventDefault();return}
    switchProfile(main.dataset.profileId);
  });
  renderProfileButton();
}

function renderProfileButton(){
  const state=readState();
  const profile=activeProfile(state);
  const button=$('profileMenuButton');
  if(button)button.textContent=`👤 ${profile?.name||'Profile'} ▾`;
}

function openProfileManager(){profileActionsId='';renderProfileManager();$('profileBackdrop')?.classList.add('show')}
function closeProfileManager(){$('profileBackdrop')?.classList.remove('show');profileActionsId=''}

function renderProfileManager(){
  renderProfileButton();
  const list=$('profileModalList');
  if(!list)return;
  const state=readState();
  list.innerHTML=state.profiles.map(profile=>`<article class="profile-row ${profile.id===state.active?'active':''} ${profileActionsId===profile.id?'actions-open':''}"><button class="profile-row-main" type="button" data-profile-id="${escapeHtml(profile.id)}"><span><strong>${escapeHtml(profile.name)}</strong><small>${profile.id===state.active?'বর্তমান Profile':'Tap করে খুলুন'}</small></span><b>${profile.id===state.active?'✓':'›'}</b></button><div class="profile-long-actions"><button class="profile-edit-action" type="button" data-profile-edit="${escapeHtml(profile.id)}">নাম Edit</button><button class="profile-delete-action" type="button" data-profile-delete="${escapeHtml(profile.id)}">Profile Delete</button></div></article>`).join('');
}

function switchProfile(id){
  const state=readState();
  if(!state.profiles.some(profile=>profile.id===id))return;
  state.active=id;
  persistState(state);
  location.reload();
}

function addProfileFromModal(){
  const input=$('profileModalNewName');
  const name=input?.value.trim();
  if(!name){notify('নতুন Profile নাম লিখুন');return}
  const state=readState();
  const id=uid();
  state.profiles.push({id,name});
  state.active=id;
  persistState(state);
  location.reload();
}

function renameProfileFromModal(id){
  const state=readState();
  const profile=state.profiles.find(item=>item.id===id);
  if(!profile)return;
  const name=prompt('Profile-এর নতুন নাম লিখুন',profile.name);
  if(!name||!name.trim())return;
  profile.name=name.trim();
  persistState(state);
  location.reload();
}

function deleteProfileFromModal(id){
  const state=readState();
  if(state.profiles.length<=1){notify('শেষ Profile delete করা যাবে না');return}
  const profile=state.profiles.find(item=>item.id===id);
  if(!profile)return;
  if(!confirm(`“${profile.name}” Profile এবং এর Transaction, Loan, Category ও Report data স্থায়ীভাবে মুছবেন?`))return;
  state.profiles=state.profiles.filter(item=>item.id!==id);
  ['tx','loans','reminders','categories'].forEach(key=>{state[key]=state[key].filter(item=>item.profileId!==id)});
  state.drafts=state.drafts.filter(item=>item.profileId&&item.profileId!==id||!item.profileId);
  if(state.active===id)state.active=state.profiles[0].id;
  persistState(state);
  location.reload();
}

function observeDynamicSections(){
  const history=$('historyList');
  if(history)new MutationObserver(()=>{applyExpandMode();updateSelectionUI();renderTodayBalance()}).observe(history,{childList:true,subtree:true});
  const report=$('reportSummary');
  if(report)new MutationObserver(()=>renderReportCharts()).observe(report,{childList:true,subtree:true});
  $('reportFrom')?.addEventListener('change',()=>setTimeout(renderReportCharts,30));
  $('reportTo')?.addEventListener('change',()=>setTimeout(renderReportCharts,30));
  $('profileSelect')?.addEventListener('change',()=>setTimeout(()=>{renderProfileButton();renderProfileManager();renderTodayBalance();renderReportCharts()},40));
}

function start(){
  addHistoryControls();
  bindHistorySelection();
  addTodayBalanceCard();
  addReportCharts();
  addProfileManager();
  observeDynamicSections();
  renderTodayBalance();
  renderReportCharts();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
