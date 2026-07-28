// /money-management-android/app/src/main/assets/v25.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const DRIVE_LABEL_KEY='mm_drive_account_label';
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const money=value=>'৳'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2});
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function readState(){
  try{
    const state=JSON.parse(localStorage.getItem(KEY)||'{}');
    ['profiles','tx','loans','reminders','categories','drafts'].forEach(key=>{if(!Array.isArray(state[key]))state[key]=[]});
    return state;
  }catch(error){return{profiles:[],tx:[],loans:[],reminders:[],categories:[],drafts:[]}}
}
function saveState(state){
  const json=JSON.stringify(state);
  localStorage.setItem(KEY,json);
  try{window.MoneyBackup?.saveBackup?.(json)}catch(error){}
}
function notify(message){
  const toast=$('toast');
  if(!toast)return;
  toast.textContent=message;toast.classList.add('show');
  clearTimeout(window.__v25ToastTimer);
  window.__v25ToastTimer=setTimeout(()=>toast.classList.remove('show'),1500);
}
function categoryLabel(category){return category?`${category.name}${category.subcategory?' / '+category.subcategory:''}`:''}
function activeCategories(state,type){return state.categories.filter(category=>category.profileId===state.active&&category.type===type)}
function normalize(value){return String(value??'').trim().toLocaleLowerCase('bn-BD')}

/* Compact three-line frozen selection panel. */
function compactBulkPanel(){
  const toolbar=$('bulkSelectionToolbar');
  if(!toolbar)return;
  toolbar.classList.add('v25-compact-bulk');
  const top=toolbar.querySelector('.bulk-selection-top');
  const deleteButton=$('deleteBulkTransactions');
  const cancel=$('cancelBulkSelection');
  if(top&&deleteButton&&deleteButton.parentElement!==top)top.insertBefore(deleteButton,cancel||null);
  const actionBox=toolbar.querySelector('.bulk-action-buttons');
  if(actionBox)actionBox.hidden=true;

  const categoryLabels=toolbar.querySelectorAll('.bulk-category-grid label');
  if(categoryLabels[0])categoryLabels[0].childNodes[0].nodeValue='ব্যয় Category ';
  if(categoryLabels[1])categoryLabels[1].childNodes[0].nodeValue='আয় Category ';

  const dateLabel=$('bulkTargetDate')?.closest('label');
  if(dateLabel)dateLabel.childNodes[0].nodeValue='Date ';
  if($('bulkCopyDate'))$('bulkCopyDate').textContent='Copy';
  if($('bulkMoveDate'))$('bulkMoveDate').textContent='Move';
  const summary=$('bulkNewCategory')?.querySelector('summary');
  if(summary)summary.textContent='＋ নতুন Category';
}

/* Expense appears immediately after Subject in detail tables. */
function reorderHistoryColumns(){
  document.querySelectorAll('#historyList .tx-table').forEach(table=>{
    const head=table.tHead?.rows?.[0];
    if(head&&!head.dataset.v25Order&&head.cells.length>=4){
      head.insertBefore(head.cells[3],head.cells[2]);
      head.dataset.v25Order='1';
    }
    table.querySelectorAll('tbody tr').forEach(row=>{
      if(row.dataset.v25Order||row.cells.length<4)return;
      row.insertBefore(row.cells[3],row.cells[2]);
      row.dataset.v25Order='1';
    });
  });
}

/* Remember Category from the most recent exact Subject match. */
const subjectTimers={};
function applyRememberedCategory(type){
  const subject=$(type+'Subject');
  const select=$(type+'Category');
  const text=normalize(subject?.value);
  if(!subject||!select||!text)return;
  const state=readState();
  const match=state.tx
    .filter(transaction=>transaction.profileId===state.active&&transaction.type===type&&normalize(transaction.subject)===text)
    .sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0))[0];
  if(!match)return;
  const category=state.categories.find(item=>item.id===match.categoryId&&item.profileId===state.active&&item.type===type);
  const next=category?.id||'';
  if(select.value===next)return;
  select.value=next;
  select.dispatchEvent(new Event('change',{bubbles:true}));
}
function bindSubjectMemory(){
  ['expense','income'].forEach(type=>{
    const subject=$(type+'Subject');
    if(!subject||subject.dataset.v25Memory)return;
    subject.dataset.v25Memory='1';
    subject.addEventListener('input',()=>{
      clearTimeout(subjectTimers[type]);
      subjectTimers[type]=setTimeout(()=>applyRememberedCategory(type),180);
    });
    subject.addEventListener('blur',()=>applyRememberedCategory(type));
  });
}

/* Search all visible transaction fields and numbers in the ten-day cards. */
let searchQuery='';
let preSearchOpen=new Set();
function transactionSearchText(transaction){
  return normalize([
    transaction.subject,transaction.remarks,transaction.categoryName,transaction.categoryIcon,
    transaction.amount,Number(transaction.amount||0).toLocaleString('en-US'),transaction.date,
    transaction.time,transaction.account,transaction.type,
    transaction.type==='income'?'income আয়':'expense ব্যয়'
  ].join(' ')).replace(/,/g,'');
}
function applyHistorySearch(){
  const query=normalize(searchQuery).replace(/,/g,'');
  const state=readState();
  const byId=new Map(state.tx.map(transaction=>[transaction.id,transaction]));
  document.querySelectorAll('#historyList .day-card').forEach(card=>{
    const rows=Array.from(card.querySelectorAll('.tx-row'));
    if(!query){
      card.hidden=false;
      rows.forEach(row=>row.hidden=false);
      if(card.dataset.v25SearchForced==='1'){
        card.classList.toggle('open',preSearchOpen.has(card.querySelector('[data-day]')?.dataset.day||''));
        delete card.dataset.v25SearchForced;
      }
      return;
    }
    let matches=0;
    rows.forEach(row=>{
      const transaction=byId.get(row.dataset.id);
      const hit=Boolean(transaction&&transactionSearchText(transaction).includes(query));
      row.hidden=!hit;if(hit)matches++;
    });
    card.hidden=matches===0;
    if(matches){card.dataset.v25SearchForced='1';card.classList.add('open')}
  });
}
function setSearch(value){searchQuery=value||'';applyHistorySearch()}
function addQuickSearch(){
  const actions=document.querySelector('#quickSection .quick-title-actions');
  const status=$('autosaveStatus'),cross=$('cancelQuick');
  if(!actions||!status||!cross)return;
  let input=$('quickSearch');
  if(!input){
    input=document.createElement('input');
    input.id='quickSearch';input.type='search';input.inputMode='search';
    input.placeholder='Search লেখা / Amount';input.setAttribute('aria-label','Transaction search');
    actions.insertBefore(input,cross);
    input.addEventListener('input',event=>setSearch(event.target.value));
  }
  if(!input.dataset.v25CrossBound){
    input.dataset.v25CrossBound='1';
    cross.addEventListener('click',()=>{input.value='';setSearch('')},true);
  }
}
function initialiseSearchState(){
  preSearchOpen=new Set(Array.from(document.querySelectorAll('#historyList .day-card.open [data-day]')).map(button=>button.dataset.day));
}

/* Disable the older single-click Notes opener; only double-click/hold remains. */
function blockSingleClickRemarks(){
  const history=$('historyList');
  if(!history||history.dataset.v25SingleClickBlocked)return;
  history.dataset.v25SingleClickBlocked='1';
  history.addEventListener('click',event=>{
    const cell=event.target.closest('.tx-row td:nth-child(5)');
    if(!cell||$('bulkSelectionToolbar')?.classList.contains('show'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
}

/* New loan entry no longer uses an end date. */
function removeNewLoanDueDate(){
  const input=$('loanDueDate');
  const label=input?.closest('label');
  if(input)input.value='';
  if(label)label.hidden=true;
  const save=$('saveLoan');
  if(save&&!save.dataset.v25NoDue){
    save.dataset.v25NoDue='1';
    save.addEventListener('click',()=>{if(input)input.value=''},true);
  }
}

/* Put jump, previous ten days and next ten days on a single compact line. */
function compactHistoryTools(){
  const tools=document.querySelector('#historySection .history-tools');
  const expand=$('historyExpandTools');
  if(!tools)return;
  tools.classList.add('v25-one-line-tools');
  if(expand&&expand.parentElement===tools)tools.insertAdjacentElement('afterend',expand);
}

/* Drive account identification: SAF cannot expose Gmail, so keep a user-entered label in backup data. */
function driveLabelValue(){const state=readState();return state.driveAccountLabel||localStorage.getItem(DRIVE_LABEL_KEY)||''}
function saveDriveLabel(value){
  const label=String(value||'').trim();
  const state=readState();state.driveAccountLabel=label;
  localStorage.setItem(DRIVE_LABEL_KEY,label);saveState(state);
  renderDriveLabel();notify(label?'Drive Gmail label save হয়েছে':'Drive Gmail label সরানো হয়েছে');
}
function renderDriveLabel(){
  const input=$('driveAccountLabel');
  const text=$('driveAccountLabelText');
  const value=driveLabelValue();
  if(input&&document.activeElement!==input)input.value=value;
  if(text)text.textContent=value?`Backup account: ${value}`:'Backup Gmail ID এখনো লেখা হয়নি';
}
function addDriveAccountLabel(){
  const card=document.querySelector('.sync-card');
  const status=card?.querySelector('.drive-status-panel');
  if(!card||!status||$('driveAccountLabelBox'))return;
  const box=document.createElement('div');
  box.id='driveAccountLabelBox';box.className='drive-account-label-box';
  box.innerHTML='<div><small>Drive account পরিচিতি</small><strong id="driveAccountLabelText"></strong></div><div class="drive-account-label-edit"><input id="driveAccountLabel" type="email" placeholder="যেমন: name@gmail.com"><button id="saveDriveAccountLabel" type="button">Save</button></div><small class="drive-label-note">Android system picker Gmail address app-কে দেয় না—এটি আপনার নিজের লেখা account label, backup-এর সঙ্গেও থাকবে।</small>';
  status.insertAdjacentElement('afterend',box);
  $('saveDriveAccountLabel').onclick=()=>saveDriveLabel($('driveAccountLabel').value);
  $('driveAccountLabel').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();saveDriveLabel(event.target.value)}});
  renderDriveLabel();

  const connect=$('connectDrive');
  if(connect&&!connect.dataset.v25LabelPrompt){
    connect.dataset.v25LabelPrompt='1';
    connect.addEventListener('click',()=>{
      if(driveLabelValue())return;
      const value=prompt('যে Gmail/Drive account-এ file রাখছেন, পরিচিতির জন্য ID লিখুন (ঐচ্ছিক)');
      if(value)saveDriveLabel(value);
    },true);
  }
}

/* Interactive pie: tap a slice or legend to view transactions and change Category. */
let pieGroupIndex=-1;
function reportExpenseGroups(){
  const state=readState();
  const from=$('reportFrom')?.value||'',to=$('reportTo')?.value||'';
  const map=new Map();
  state.tx.filter(t=>t.profileId===state.active&&t.type==='expense'&&(!from||t.date>=from)&&(!to||t.date<=to)).forEach(t=>{
    const key=`${t.categoryIcon?t.categoryIcon+' ':''}${t.categoryName&&t.categoryName!=='Uncategorized'?t.categoryName:'Category নেই'}`;
    if(!map.has(key))map.set(key,{key,value:0,ids:[]});
    const group=map.get(key);group.value+=Number(t.amount||0);group.ids.push(t.id);
  });
  return Array.from(map.values()).sort((a,b)=>b.value-a.value);
}
function pieCategoryOptions(state,selected){
  return '<option value="">○ Category নেই</option>'+activeCategories(state,'expense').map(category=>`<option value="${esc(category.id)}" ${category.id===selected?'selected':''}>${esc(category.icon||'○')} ${esc(categoryLabel(category))}</option>`).join('');
}
function addPieDetailsModal(){
  if($('pieDetailsBackdrop'))return;
  const backdrop=document.createElement('div');backdrop.id='pieDetailsBackdrop';backdrop.className='pie-details-backdrop';
  backdrop.innerHTML='<section class="pie-details-sheet"><div class="pie-details-head"><div><h3 id="pieDetailsTitle">Category Details</h3><small id="pieDetailsSummary"></small></div><button id="closePieDetails" type="button">বন্ধ</button></div><div id="pieDetailsList"></div></section>';
  document.body.appendChild(backdrop);
  $('closePieDetails').onclick=closePieDetails;
  backdrop.onclick=event=>{if(event.target===backdrop)closePieDetails()};
  $('pieDetailsList').addEventListener('change',event=>{
    const select=event.target.closest('[data-pie-tx-category]');if(!select)return;
    changePieTransactionCategory(select.dataset.pieTxCategory,select.value);
  });
}
function openPieDetails(index){pieGroupIndex=index;renderPieDetails();$('pieDetailsBackdrop')?.classList.add('show')}
function closePieDetails(){pieGroupIndex=-1;$('pieDetailsBackdrop')?.classList.remove('show')}
function renderPieDetails(){
  const groups=reportExpenseGroups(),group=groups[pieGroupIndex];
  if(!group){closePieDetails();return}
  const state=readState();
  const rows=group.ids.map(id=>state.tx.find(item=>item.id===id)).filter(Boolean).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||''));
  $('pieDetailsTitle').textContent=group.key;
  $('pieDetailsSummary').textContent=`${rows.length.toLocaleString('en-US')}টি Expense · ${money(group.value)}`;
  $('pieDetailsList').innerHTML=rows.map(transaction=>`<article class="pie-detail-row"><div><strong>${esc(transaction.subject||'—')}</strong><small>${esc(transaction.date)} · ${esc(transaction.time||'')}</small></div><b>${money(transaction.amount)}</b><select data-pie-tx-category="${esc(transaction.id)}">${pieCategoryOptions(state,transaction.categoryId)}</select></article>`).join('');
}
function changePieTransactionCategory(id,categoryId){
  const state=readState(),transaction=state.tx.find(item=>item.id===id);if(!transaction)return;
  const category=state.categories.find(item=>item.id===categoryId&&item.profileId===state.active&&item.type==='expense');
  transaction.categoryId=category?.id||'';transaction.categoryName=category?categoryLabel(category):'Uncategorized';transaction.categoryIcon=category?.icon||'';transaction.updatedAt=Date.now();
  saveState(state);notify('Category পরিবর্তন হয়েছে');
  $('reportFrom')?.dispatchEvent(new Event('change',{bubbles:true}));
  setTimeout(()=>{decoratePieTargets();renderPieDetails()},80);
}
function decoratePieTargets(){
  const groups=reportExpenseGroups();
  document.querySelectorAll('#expensePieChart .pie-legend-row').forEach((row,index)=>{row.dataset.pieIndex=String(index);row.title='Details দেখতে tap করুন'});
  const donut=document.querySelector('#expensePieChart .pie-donut');
  if(donut)donut.title='Category portion tap করে details দেখুন';
  if(!groups.length&&$('pieDetailsBackdrop')?.classList.contains('show'))closePieDetails();
}
function bindPieInteraction(){
  const pie=$('expensePieChart');if(!pie||pie.dataset.v25Interactive)return;
  pie.dataset.v25Interactive='1';
  pie.addEventListener('click',event=>{
    const legend=event.target.closest('[data-pie-index]');
    if(legend){openPieDetails(Number(legend.dataset.pieIndex));return}
    const donut=event.target.closest('.pie-donut');if(!donut)return;
    const groups=reportExpenseGroups();if(!groups.length)return;
    const rect=donut.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=event.clientX-cx,dy=event.clientY-cy;
    const radius=Math.min(rect.width,rect.height)/2,distance=Math.hypot(dx,dy);
    if(distance<radius*.38||distance>radius*1.05)return;
    const angle=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;
    const total=groups.reduce((sum,group)=>sum+group.value,0),target=angle/360*total;
    let cursor=0,index=0;
    for(let i=0;i<groups.length;i++){cursor+=groups[i].value;if(target<=cursor){index=i;break}}
    openPieDetails(index);
  });
  new MutationObserver(()=>requestAnimationFrame(decoratePieTargets)).observe(pie,{childList:true,subtree:true});
  decoratePieTargets();
}

function observeDynamic(){
  const history=$('historyList');
  if(history)new MutationObserver(()=>requestAnimationFrame(()=>{reorderHistoryColumns();applyHistorySearch()})).observe(history,{childList:true,subtree:true});
  const toolbar=$('bulkSelectionToolbar');
  if(toolbar)new MutationObserver(()=>requestAnimationFrame(compactBulkPanel)).observe(toolbar,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
function start(){
  compactBulkPanel();reorderHistoryColumns();bindSubjectMemory();
  initialiseSearchState();addQuickSearch();blockSingleClickRemarks();removeNewLoanDueDate();compactHistoryTools();
  addDriveAccountLabel();addPieDetailsModal();bindPieInteraction();observeDynamic();
  setTimeout(()=>{
    compactBulkPanel();reorderHistoryColumns();bindSubjectMemory();addQuickSearch();blockSingleClickRemarks();removeNewLoanDueDate();compactHistoryTools();renderDriveLabel();decoratePieTargets();applyHistorySearch();
  },750);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
