// /money-management-android/app/src/main/assets/v23.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const $=id=>document.getElementById(id);
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
  try{
    if(typeof window.receiveImportedBackup==='function')window.receiveImportedBackup(json);
    else{
      localStorage.setItem(KEY,json);
      window.MoneyBackup?.saveBackup?.(json);
    }
  }catch(error){localStorage.setItem(KEY,json)}
  if(message)setTimeout(()=>notify(message),60);
}

/* Quick Entry header: only Auto-saved on the left and a small cross on the right. */
function compactQuickHeader(){
  const title=document.querySelector('#quickSection .quick-title');
  const actions=title?.querySelector('.quick-title-actions');
  const status=$('autosaveStatus');
  const cross=$('cancelQuick');
  if(!title||!actions||!status||!cross)return;
  actions.insertBefore(status,actions.firstChild);
  status.textContent=status.textContent||'✓ Auto-saved';
  cross.textContent='×';
  cross.setAttribute('aria-label','Input বাতিল');
  title.classList.add('v23-compact-title');
}

/* Deterministic day opening: each date has its own state and no neighbour is changed. */
const openDates=new Set();
let historyStateInitialised=false;

function dateOfCard(card){return card?.querySelector('[data-day]')?.dataset.day||''}

function initialiseHistoryState(){
  if(historyStateInitialised)return;
  document.querySelectorAll('#historyList .day-card').forEach(card=>{
    const date=dateOfCard(card);
    if(date&&card.classList.contains('open'))openDates.add(date);
  });
  historyStateInitialised=true;
}

function applyHistoryState(){
  initialiseHistoryState();
  document.querySelectorAll('#historyList .day-card').forEach(card=>{
    const date=dateOfCard(card);
    if(date)card.classList.toggle('open',openDates.has(date));
  });
}

function setCurrentRange(open){
  const dates=Array.from(document.querySelectorAll('#historyList [data-day]')).map(button=>button.dataset.day).filter(Boolean);
  dates.forEach(date=>open?openDates.add(date):openDates.delete(date));
  applyHistoryState();
  $('expandAllDays')?.classList.remove('active');
  $('collapseAllDays')?.classList.remove('active');
}

function bindDeterministicHistory(){
  const history=$('historyList');
  if(!history||history.dataset.v23HistoryBound)return;
  history.dataset.v23HistoryBound='1';
  initialiseHistoryState();

  const expand=$('expandAllDays');
  const collapse=$('collapseAllDays');
  if(expand)expand.onclick=event=>{event.preventDefault();event.stopImmediatePropagation();setCurrentRange(true)};
  if(collapse)collapse.onclick=event=>{event.preventDefault();event.stopImmediatePropagation();setCurrentRange(false)};

  history.addEventListener('click',event=>{
    const button=event.target.closest('[data-day]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const date=button.dataset.day;
    if(openDates.has(date))openDates.delete(date);else openDates.add(date);
    const card=button.closest('.day-card');
    if(card)card.classList.toggle('open',openDates.has(date));
  },true);

  new MutationObserver(()=>requestAnimationFrame(applyHistoryState)).observe(history,{childList:true,subtree:true});
  applyHistoryState();
}

/* Today's income and expense counts are shown separately. */
function decorateTodayCounts(){
  const card=$('todayBalanceCard');
  if(!card)return;
  const state=readState();
  const rows=state.tx.filter(item=>item.profileId===state.active&&item.date===today());
  const income=rows.filter(item=>item.type==='income').length;
  const expense=rows.filter(item=>item.type==='expense').length;
  const target=card.querySelector('.today-limit-foot span:last-child');
  if(target)target.textContent=`Income ${income.toLocaleString('en-US')} · Expense ${expense.toLocaleString('en-US')}`;
}

function observeTodayBalance(){
  const card=$('todayBalanceCard');
  if(!card)return;
  let busy=false;
  new MutationObserver(()=>{
    if(busy)return;
    busy=true;
    requestAnimationFrame(()=>{decorateTodayCounts();busy=false});
  }).observe(card,{childList:true,subtree:true,characterData:true});
  decorateTodayCounts();
}

/* Paid loans can be edited by long-pressing their card. */
let editingLoanId='';
let loanPressTimer=null;
let loanPressStart={x:0,y:0};

function loanPaid(loan){return(loan.payments||[]).reduce((sum,payment)=>sum+Number(payment.amount||0),0)}
function isPaidLoan(loan){return Math.max(0,Number(loan.principal||0)-loanPaid(loan))<=0.0001}

function addLoanEditor(){
  if($('loanEditBackdrop'))return;
  const backdrop=document.createElement('div');
  backdrop.id='loanEditBackdrop';
  backdrop.className='loan-edit-backdrop';
  backdrop.innerHTML=`<section class="loan-edit-sheet"><div class="loan-edit-head"><h3>পরিশোধিত লোন Edit</h3><button id="closeLoanEdit" type="button">বন্ধ</button></div><div class="loan-edit-grid"><label>ধরন<select id="loanEditKind"><option value="given">আমি দিয়েছি</option><option value="taken">আমি নিয়েছি</option></select></label><label>ব্যক্তি / প্রতিষ্ঠান<input id="loanEditPerson"></label><label>মূল টাকা<input id="loanEditPrincipal" inputmode="decimal"></label><label>শুরুর তারিখ<input id="loanEditStart" type="date"></label><label>শেষ তারিখ<input id="loanEditDue" type="date"></label><label>Account<select id="loanEditAccount"><option>Cash</option><option>Bank</option><option>bKash</option></select></label><label class="loan-edit-note">বিবরণ<textarea id="loanEditNote" rows="4"></textarea></label></div><div class="loan-edit-actions"><button id="cancelLoanEdit" type="button">Cancel</button><button id="saveLoanEdit" type="button">Save</button></div></section>`;
  document.body.appendChild(backdrop);
  $('closeLoanEdit').onclick=closeLoanEditor;
  $('cancelLoanEdit').onclick=closeLoanEditor;
  $('saveLoanEdit').onclick=saveLoanEditor;
  backdrop.onclick=event=>{if(event.target===backdrop)closeLoanEditor()};
}

function openLoanEditor(id){
  const state=readState();
  const loan=state.loans.find(item=>item.id===id);
  if(!loan||!isPaidLoan(loan))return;
  editingLoanId=id;
  $('loanEditKind').value=loan.kind||'given';
  $('loanEditPerson').value=loan.person||'';
  $('loanEditPrincipal').value=loan.principal||'';
  $('loanEditStart').value=loan.startDate||today();
  $('loanEditDue').value=loan.dueDate||'';
  $('loanEditAccount').value=loan.account||'Cash';
  $('loanEditNote').value=loan.note||'';
  $('loanEditBackdrop').classList.add('show');
  setTimeout(()=>$('loanEditPerson').focus(),80);
}

function closeLoanEditor(){editingLoanId='';$('loanEditBackdrop')?.classList.remove('show')}

function saveLoanEditor(){
  const state=readState();
  const loan=state.loans.find(item=>item.id===editingLoanId);
  if(!loan)return;
  const person=$('loanEditPerson').value.trim();
  const principal=Number(String($('loanEditPrincipal').value||'').replace(/,/g,''));
  const paid=loanPaid(loan);
  if(!person||!Number.isFinite(principal)||principal<=0){notify('নাম ও সঠিক মূল টাকা দিন');return}
  if(principal+0.0001<paid){notify(`মূল টাকা পরিশোধিত টাকার চেয়ে কম হতে পারবে না (৳${paid.toLocaleString('en-US')})`);return}

  const kind=$('loanEditKind').value;
  const startDate=$('loanEditStart').value||today();
  const dueDate=$('loanEditDue').value||'';
  const account=$('loanEditAccount').value;
  const note=$('loanEditNote').value;
  Object.assign(loan,{kind,person,principal,startDate,dueDate,account,note,updatedAt:Date.now()});

  state.tx.forEach(transaction=>{
    if(transaction.loanId!==loan.id)return;
    if(transaction.loanEvent==='principal'){
      transaction.type=kind==='given'?'expense':'income';
      transaction.amount=principal;
      transaction.subject=kind==='given'?`Loan Given — ${person}`:`Loan Taken — ${person}`;
      transaction.remarks=note;
      transaction.date=startDate;
      transaction.account=account;
    }else if(transaction.loanEvent==='payment'){
      transaction.type=kind==='given'?'income':'expense';
      transaction.subject=kind==='given'?`Loan Received — ${person}`:`Loan Repayment — ${person}`;
    }
    transaction.updatedAt=Date.now();
  });

  closeLoanEditor();
  commitState(state,'পরিশোধিত লোন update হয়েছে');
}

function decoratePaidLoanCards(){
  const state=readState();
  document.querySelectorAll('#loanList [data-loan-card]').forEach(card=>{
    const loan=state.loans.find(item=>item.id===card.dataset.loanCard);
    const paid=Boolean(loan&&isPaidLoan(loan));
    card.classList.toggle('paid-loan-editable',paid);
    if(paid)card.title='চেপে ধরে লোন Edit করুন';else card.removeAttribute('title');
  });
}

function bindPaidLoanLongPress(){
  const list=$('loanList');
  if(!list||list.dataset.v23LoanBound)return;
  list.dataset.v23LoanBound='1';
  list.addEventListener('pointerdown',event=>{
    const card=event.target.closest('[data-loan-card]');
    if(!card||event.target.closest('button'))return;
    const state=readState();
    const loan=state.loans.find(item=>item.id===card.dataset.loanCard);
    if(!loan||!isPaidLoan(loan))return;
    loanPressStart={x:event.clientX,y:event.clientY};
    clearTimeout(loanPressTimer);
    loanPressTimer=setTimeout(()=>{openLoanEditor(loan.id);navigator.vibrate?.(35)},580);
  });
  list.addEventListener('pointermove',event=>{if(Math.abs(event.clientX-loanPressStart.x)>8||Math.abs(event.clientY-loanPressStart.y)>8)clearTimeout(loanPressTimer)});
  ['pointerup','pointercancel','pointerleave'].forEach(name=>list.addEventListener(name,()=>clearTimeout(loanPressTimer)));
  new MutationObserver(()=>requestAnimationFrame(decoratePaidLoanCards)).observe(list,{childList:true,subtree:true});
  decoratePaidLoanCards();
}

/* Keep pie values close to the labels instead of at the far-right edge. */
function compactPieLegend(){
  document.querySelectorAll('#expensePieChart .pie-legend-row').forEach(row=>row.classList.add('v23-pie-row'));
}

function observePieLegend(){
  const pie=$('expensePieChart');
  if(!pie)return;
  new MutationObserver(()=>requestAnimationFrame(compactPieLegend)).observe(pie,{childList:true,subtree:true});
  compactPieLegend();
}

function start(){
  compactQuickHeader();
  bindDeterministicHistory();
  observeTodayBalance();
  addLoanEditor();
  bindPaidLoanLongPress();
  observePieLegend();
  setTimeout(()=>{
    compactQuickHeader();
    bindDeterministicHistory();
    decorateTodayCounts();
    decoratePaidLoanCards();
    compactPieLegend();
  },700);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
