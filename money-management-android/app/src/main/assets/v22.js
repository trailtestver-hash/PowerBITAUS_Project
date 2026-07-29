// /money-management-android/app/src/main/assets/v22.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const today=()=>{const date=new Date();date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,10)};

function readState(){
  try{
    const state=JSON.parse(localStorage.getItem(KEY)||'{}');
    ['profiles','tx','loans','reminders','categories','drafts'].forEach(key=>{if(!Array.isArray(state[key]))state[key]=[]});
    return state;
  }catch(error){return{profiles:[],tx:[],loans:[],reminders:[],categories:[],drafts:[]}}
}

function notify(message){
  const toast=$('toast');
  if(!toast){alert(message);return}
  toast.textContent=message;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),1900);
}

function commitState(state,message){
  const json=JSON.stringify(state);
  const toast=$('toast');
  if(toast){toast.classList.remove('show');toast.style.visibility='hidden'}
  try{
    if(typeof window.receiveImportedBackup==='function')window.receiveImportedBackup(json);
    else{
      localStorage.setItem(KEY,json);
      if(window.MoneyBackup&&typeof window.MoneyBackup.saveBackup==='function')window.MoneyBackup.saveBackup(json);
    }
  }catch(error){localStorage.setItem(KEY,json)}
  setTimeout(()=>{
    if(toast)toast.style.visibility='';
    if(message)notify(message);
    refreshBulkCategorySelects();
    enhanceDraftRows();
    decoratePieValues();
  },40);
}

function selectedIds(){
  return Array.from(document.querySelectorAll('#historyList .tx-row.bulk-selected')).map(row=>row.dataset.id).filter(Boolean);
}

function categoryLabel(category){return category?`${category.name}${category.subcategory?' / '+category.subcategory:''}`:''}

/* Keep only one backup completion message: Android's native Toast remains. */
function installSingleBackupMessage(){
  window.onDriveBackupResult=function(){
    try{
      if(window.MoneyBackup&&typeof window.MoneyBackup.getDriveStatus==='function'&&typeof window.receiveDriveStatus==='function'){
        window.receiveDriveStatus(JSON.parse(window.MoneyBackup.getDriveStatus()||'{}'));
      }
    }catch(error){}
  };
}

/* Sticky multiple-selection date copy/move and new-category creation. */
function addBulkTools(){
  const toolbar=$('bulkSelectionToolbar');
  if(!toolbar)return;

  if(!$('bulkDateActions')){
    const dateActions=document.createElement('div');
    dateActions.id='bulkDateActions';
    dateActions.className='bulk-date-actions';
    dateActions.innerHTML=`<label>নতুন Date<input id="bulkTargetDate" type="date"></label><button id="bulkCopyDate" class="bulk-copy-date" type="button">Copy to Date</button><button id="bulkMoveDate" class="bulk-move-date" type="button">Move to Date</button>`;
    toolbar.querySelector('.bulk-action-buttons')?.insertAdjacentElement('beforebegin',dateActions);
    $('bulkTargetDate').value=today();
    $('bulkCopyDate').onclick=()=>changeSelectedDate(true);
    $('bulkMoveDate').onclick=()=>changeSelectedDate(false);
  }

  if(!$('bulkNewCategory')){
    const details=document.createElement('details');
    details.id='bulkNewCategory';
    details.className='bulk-new-category';
    details.innerHTML=`<summary>＋ নতুন Category তৈরি করে নির্বাচিত Row-তে Set করুন</summary><div class="bulk-new-category-grid"><label>Type<select id="bulkNewCategoryType"><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Logo<input id="bulkNewCategoryIcon" value="📦" maxlength="4"></label><label>Category<input id="bulkNewCategoryName" placeholder="Category নাম"></label><label>Subcategory<input id="bulkNewSubcategory" placeholder="ঐচ্ছিক"></label><button id="createAndSetBulkCategory" type="button">Create & Set</button></div>`;
    toolbar.querySelector('.selection-help')?.insertAdjacentElement('beforebegin',details);
    $('bulkNewCategoryType').onchange=event=>{$('bulkNewCategoryIcon').value=event.target.value==='income'?'💰':'📦'};
    $('createAndSetBulkCategory').onclick=createAndSetBulkCategory;
  }

  bindInstantBulkCategory();
}

function changeSelectedDate(copy){
  const ids=new Set(selectedIds());
  const date=$('bulkTargetDate')?.value;
  if(!ids.size){notify('আগে transaction নির্বাচন করুন');return}
  if(!date){notify('Date নির্বাচন করুন');return}
  const state=readState();
  let count=0;
  if(copy){
    const copies=[];
    state.tx.forEach(transaction=>{
      if(!ids.has(transaction.id))return;
      copies.push({...transaction,id:uid(),date,createdAt:Date.now()+count,updatedAt:Date.now(),copiedFromId:transaction.id});
      count++;
    });
    state.tx.unshift(...copies);
  }else{
    state.tx.forEach(transaction=>{if(ids.has(transaction.id)){transaction.date=date;transaction.updatedAt=Date.now();count++}});
  }
  if(!count)return;
  commitState(state,`${count.toLocaleString('en-US')}টি transaction ${copy?'copy':'move'} হয়েছে`);
}

function createAndSetBulkCategory(){
  const ids=new Set(selectedIds());
  if(!ids.size){notify('আগে transaction নির্বাচন করুন');return}
  const type=$('bulkNewCategoryType')?.value||'expense';
  const icon=$('bulkNewCategoryIcon')?.value.trim()||(type==='income'?'💰':'📦');
  const name=$('bulkNewCategoryName')?.value.trim();
  const subcategory=$('bulkNewSubcategory')?.value.trim()||'';
  if(!name){notify('নতুন Category নাম লিখুন');return}
  const state=readState();
  const duplicate=state.categories.find(category=>category.profileId===state.active&&category.type===type&&String(category.name).toLowerCase()===name.toLowerCase()&&String(category.subcategory||'').toLowerCase()===subcategory.toLowerCase());
  const category=duplicate||{id:uid(),profileId:state.active,type,icon,name,subcategory,createdAt:Date.now()};
  if(!duplicate)state.categories.push(category);
  let count=0;
  state.tx.forEach(transaction=>{
    if(!ids.has(transaction.id)||transaction.type!==type)return;
    transaction.categoryId=category.id;
    transaction.categoryName=categoryLabel(category);
    transaction.categoryIcon=category.icon;
    transaction.updatedAt=Date.now();
    count++;
  });
  if(!count){notify(type==='income'?'নির্বাচিত Income নেই':'নির্বাচিত Expense নেই');return}
  $('bulkNewCategoryName').value='';$('bulkNewSubcategory').value='';
  commitState(state,`নতুন Category তৈরি করে ${count.toLocaleString('en-US')}টি Row-তে Set হয়েছে`);
}

function buildBulkOptions(type){
  const state=readState();
  const categories=state.categories.filter(category=>category.profileId===state.active&&category.type===type);
  return '<option value="__keep__">Category পরিবর্তন করুন…</option><option value="__none__">Category সরান</option>'+categories.map(category=>`<option value="${category.id}">${category.icon||'○'} ${categoryLabel(category)}</option>`).join('');
}

function refreshBulkCategorySelects(){
  const expense=$('bulkExpenseCategory'),income=$('bulkIncomeCategory');
  if(expense)expense.innerHTML=buildBulkOptions('expense');
  if(income)income.innerHTML=buildBulkOptions('income');
  bindInstantBulkCategory();
}

function bindInstantBulkCategory(){
  ['expense','income'].forEach(type=>{
    const select=$(type==='expense'?'bulkExpenseCategory':'bulkIncomeCategory');
    if(!select)return;
    select.onchange=()=>applyInstantCategory(type,select);
  });
}

function applyInstantCategory(type,select){
  const value=select.value;
  if(!value||value==='__keep__')return;
  const ids=new Set(selectedIds());
  if(!ids.size){notify('আগে transaction নির্বাচন করুন');select.value='__keep__';return}
  const state=readState();
  const category=value==='__none__'?null:state.categories.find(item=>item.id===value&&item.type===type);
  let count=0;
  state.tx.forEach(transaction=>{
    if(!ids.has(transaction.id)||transaction.type!==type)return;
    transaction.categoryId=category?.id||'';
    transaction.categoryName=category?categoryLabel(category):'Uncategorized';
    transaction.categoryIcon=category?.icon||'';
    transaction.updatedAt=Date.now();
    count++;
  });
  select.value='__keep__';
  if(!count){notify(type==='income'?'নির্বাচিত Income নেই':'নির্বাচিত Expense নেই');return}
  commitState(state,`${count.toLocaleString('en-US')}টি ${type==='income'?'Income':'Expense'}-এর Category পরিবর্তন হয়েছে`);
}

/* Date selection for line-break pasted draft rows. */
let pendingDraftDate=today();
const draftCommitSnapshots=new Map();

function addDraftDefaultDate(){
  const bulk=document.querySelector('#quickSection details.bulk');
  const make=$('makeDrafts');
  if(!bulk||!make||$('bulkDraftDate'))return;
  const control=document.createElement('label');
  control.className='bulk-date-default';
  control.innerHTML='Paste করা Row-এর Date <input id="bulkDraftDate" type="date">';
  make.insertAdjacentElement('beforebegin',control);
  $('bulkDraftDate').value=today();

  make.addEventListener('click',()=>{
    pendingDraftDate=$('bulkDraftDate').value||today();
    const before=new Set(readState().drafts.map(item=>item.id));
    setTimeout(()=>{
      const state=readState();
      let changed=false;
      state.drafts.forEach(draft=>{if(!before.has(draft.id)){draft.date=pendingDraftDate;draft.profileId=state.active;changed=true}});
      if(changed){localStorage.setItem(KEY,JSON.stringify(state));try{window.MoneyBackup?.saveBackup?.(JSON.stringify(state))}catch(error){}}
      enhanceDraftRows();
    },80);
  },true);
}

function enhanceDraftRows(){
  const state=readState();
  document.querySelectorAll('#draftList .draft-row').forEach(row=>{
    const draft=state.drafts.find(item=>item.id===row.dataset.draft);
    let date=row.querySelector('[data-f="date"]');
    if(!date){
      date=document.createElement('input');date.type='date';date.dataset.f='date';
      row.querySelector('[data-remove]')?.insertAdjacentElement('beforebegin',date);
    }
    date.value=draft?.date||pendingDraftDate||today();
  });
}

function rememberDraftCommit(row){
  if(!row)return;
  const expense=Number(row.querySelector('[data-f="expense"]')?.value||0);
  const income=Number(row.querySelector('[data-f="income"]')?.value||0);
  if((!expense&&!income)||(expense&&income))return;
  const snapshot={before:new Set(readState().tx.map(item=>item.id)),date:row.querySelector('[data-f="date"]')?.value||today(),subject:row.querySelector('[data-f="subject"]')?.value||'',amount:income||expense,type:income?'income':'expense'};
  draftCommitSnapshots.set(row.dataset.draft,snapshot);
  setTimeout(()=>patchCommittedDraft(row.dataset.draft),300);
}

function patchCommittedDraft(draftId){
  const snapshot=draftCommitSnapshots.get(draftId);if(!snapshot)return;
  const state=readState();
  const created=state.tx.filter(item=>!snapshot.before.has(item.id)&&item.type===snapshot.type&&Number(item.amount)===Number(snapshot.amount)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
  if(!created){setTimeout(()=>patchCommittedDraft(draftId),220);return}
  created.date=snapshot.date;created.updatedAt=Date.now();draftCommitSnapshots.delete(draftId);
  commitState(state,'Paste করা Row সঠিক Date-এ save হয়েছে');
}

function bindDraftDatePatching(){
  const list=$('draftList');if(!list)return;
  list.addEventListener('keydown',event=>{if(event.key==='Enter')rememberDraftCommit(event.target.closest('.draft-row'))},true);
  list.addEventListener('focusout',event=>{const row=event.target.closest('.draft-row');if(row)setTimeout(()=>{if(!row.contains(document.activeElement))rememberDraftCommit(row)},20)},true);
  new MutationObserver(enhanceDraftRows).observe(list,{childList:true,subtree:true});
}

/* Multiline remarks and a larger Notes editor. */
function replaceRemarksWithTextarea(id){
  const old=$(id);if(!old||old.tagName==='TEXTAREA')return old;
  const area=document.createElement('textarea');
  Array.from(old.attributes).forEach(attribute=>area.setAttribute(attribute.name,attribute.value));
  area.value=old.value;area.classList.add('quick-remarks');area.rows=2;
  old.replaceWith(area);return area;
}

function selectedQuickCategory(state,type){
  const id=$(type+'Category')?.value;
  return state.categories.find(category=>category.id===id&&category.type===type);
}

function quickSaveFromTextarea(type){
  const amount=Number(String($(type+'Amount')?.value||'').replace(/,/g,''));
  if(!Number.isFinite(amount)||amount<=0)return;
  const state=readState();
  const category=selectedQuickCategory(state,type);
  const account=document.querySelector('#accountButtons [data-account].active')?.dataset.account||'Cash';
  state.tx.unshift({id:uid(),profileId:state.active,type,amount,subject:$(type+'Subject')?.value.trim()||'',remarks:$(type+'Remarks')?.value||'',date:$(type+'Date')?.value||today(),time:new Date().toTimeString().slice(0,5),account,categoryId:category?.id||'',categoryName:category?categoryLabel(category):'Uncategorized',categoryIcon:category?.icon||'',createdAt:Date.now(),updatedAt:Date.now()});
  ['Amount','Subject','Remarks'].forEach(field=>{const element=$(type+field);if(element)element.value=''});
  if($(type+'Category'))$(type+'Category').value='';
  commitState(state,type==='income'?'আয় যোগ হয়েছে':'ব্যয় যোগ হয়েছে');
}

function enableMultilineRemarks(){
  ['expense','income'].forEach(type=>{
    const area=replaceRemarksWithTextarea(type+'Remarks');
    if(!area)return;
    area.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();quickSaveFromTextarea(type)}});
    area.addEventListener('focusout',()=>setTimeout(()=>{if(document.activeElement?.dataset?.row!==type)quickSaveFromTextarea(type)},210));
  });
  const edit=replaceRemarksWithTextarea('editRemarks');
  if(edit){edit.classList.remove('quick-remarks');edit.rows=5}
}

let notesTransactionId='';
function addNotesEditor(){
  if($('notesBackdrop'))return;
  const backdrop=document.createElement('div');
  backdrop.id='notesBackdrop';backdrop.className='notes-backdrop';
  backdrop.innerHTML='<section class="notes-sheet"><div class="notes-sheet-head"><h3>মন্তব্য / Notes</h3><button id="closeNotes" type="button">বন্ধ</button></div><textarea id="notesText" placeholder="বিস্তারিত মন্তব্য লিখুন…"></textarea><div class="notes-sheet-actions"><button id="cancelNotes" class="notes-cancel" type="button">Cancel</button><button id="saveNotes" class="notes-save" type="button">Notes Save</button></div></section>';
  document.body.appendChild(backdrop);
  $('closeNotes').onclick=closeNotes;$('cancelNotes').onclick=closeNotes;$('saveNotes').onclick=saveNotes;
  backdrop.onclick=event=>{if(event.target===backdrop)closeNotes()};
  $('historyList')?.addEventListener('click',event=>{
    if($('bulkSelectionToolbar')?.classList.contains('show'))return;
    const cell=event.target.closest('.tx-row td:nth-child(5)');if(!cell)return;
    const row=cell.closest('.tx-row');if(row)openNotes(row.dataset.id);
  });
}
function openNotes(id){const state=readState(),transaction=state.tx.find(item=>item.id===id);if(!transaction)return;notesTransactionId=id;$('notesText').value=transaction.remarks||'';$('notesBackdrop').classList.add('show');setTimeout(()=>$('notesText').focus(),80)}
function closeNotes(){notesTransactionId='';$('notesBackdrop')?.classList.remove('show')}
function saveNotes(){const state=readState(),transaction=state.tx.find(item=>item.id===notesTransactionId);if(!transaction)return;transaction.remarks=$('notesText').value;transaction.updatedAt=Date.now();closeNotes();commitState(state,'Notes update হয়েছে')}

/* Loan list order: active, paid, all; default active. */
function reorderLoanFilters(){
  const filter=$('loanFilter');if(!filter||filter.dataset.v22Ordered)return;
  const active=filter.querySelector('[data-loan-filter="active"]'),paid=filter.querySelector('[data-loan-filter="paid"]'),all=filter.querySelector('[data-loan-filter="all"]');
  [active,paid,all].forEach(button=>{if(button)filter.appendChild(button)});
  filter.dataset.v22Ordered='1';
  setTimeout(()=>active?.click(),30);
}

/* Pie chart values and percentages stay visible on-screen. */
let pieDecorating=false;
function decoratePieValues(){
  if(pieDecorating)return;pieDecorating=true;
  try{
    const rows=Array.from(document.querySelectorAll('#expensePieChart .pie-legend-row'));
    const values=rows.map(row=>Number((row.querySelector('strong')?.textContent||'').replace(/[^0-9.-]/g,''))||0);
    const total=values.reduce((sum,value)=>sum+value,0);
    rows.forEach((row,index)=>{
      const strong=row.querySelector('strong');if(!strong||strong.dataset.v22Decorated)return;
      strong.dataset.v22Decorated='1';
      if(total>0)strong.textContent=`${strong.textContent} · ${Math.round(values[index]/total*100)}%`;
    });
  }finally{pieDecorating=false}
}

function observeDynamicContent(){
  if($('bulkSelectionToolbar'))new MutationObserver(()=>{addBulkTools();refreshBulkCategorySelects()}).observe($('bulkSelectionToolbar'),{attributes:true,attributeFilter:['class']});
  if($('expensePieChart'))new MutationObserver(()=>setTimeout(decoratePieValues,20)).observe($('expensePieChart'),{childList:true,subtree:true});
  if($('historyList'))new MutationObserver(()=>{enhanceDraftRows()}).observe($('historyList'),{childList:true,subtree:true});
}

function start(){
  installSingleBackupMessage();
  addBulkTools();
  refreshBulkCategorySelects();
  addDraftDefaultDate();
  bindDraftDatePatching();
  enhanceDraftRows();
  enableMultilineRemarks();
  addNotesEditor();
  reorderLoanFilters();
  decoratePieValues();
  observeDynamicContent();
  setTimeout(()=>{installSingleBackupMessage();addBulkTools();refreshBulkCategorySelects();enhanceDraftRows();reorderLoanFilters();decoratePieValues()},650);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
