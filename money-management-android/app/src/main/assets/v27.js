// /money-management-android/app/src/main/assets/v27.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const MODE_KEY='mm_history_expand_mode_v27';
const EXCEPTIONS_KEY='mm_history_expand_exceptions_v27';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const money=value=>'৳'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2});
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtDate=value=>{if(!value)return'—';const parts=String(value).split('-');if(parts.length!==3)return value;return `${parts[2]}-${months[Number(parts[1])-1]}-${parts[0]}`};

function readState(){
  try{
    const state=JSON.parse(localStorage.getItem(KEY)||'{}');
    ['profiles','tx','loans','reminders','categories','drafts'].forEach(key=>{if(!Array.isArray(state[key]))state[key]=[]});
    state.loans.forEach(loan=>{if(!Array.isArray(loan.payments))loan.payments=[]});
    return state;
  }catch(error){return{profiles:[],tx:[],loans:[],reminders:[],categories:[],drafts:[]}}
}
function persistState(state,message){
  const json=JSON.stringify(state);
  try{
    if(typeof window.receiveImportedBackup==='function')window.receiveImportedBackup(json);
    else{localStorage.setItem(KEY,json);window.MoneyBackup?.saveBackup?.(json)}
  }catch(error){localStorage.setItem(KEY,json)}
  if(message)setTimeout(()=>notify(message),80);
}
function notify(message){
  const toast=$('toast');if(!toast)return;
  toast.textContent=message;toast.classList.add('show');
  clearTimeout(window.__v27ToastTimer);window.__v27ToastTimer=setTimeout(()=>toast.classList.remove('show'),1700);
}
function paidAmount(loan){return(loan.payments||[]).reduce((sum,payment)=>sum+Number(payment.amount||0),0)}
function remainingAmount(loan){return Math.max(0,Number(loan.principal||0)-paidAmount(loan))}
function loanStatus(loan){return remainingAmount(loan)<=0.0001?'পরিশোধিত':'চলমান'}

/* Persistent expand/collapse mode with per-date exceptions. */
let historyMode=localStorage.getItem(MODE_KEY)||'manual';
let historyExceptions=new Set();
try{historyExceptions=new Set(JSON.parse(localStorage.getItem(EXCEPTIONS_KEY)||'[]'))}catch(error){}
function saveHistoryMode(){
  localStorage.setItem(MODE_KEY,historyMode);
  localStorage.setItem(EXCEPTIONS_KEY,JSON.stringify(Array.from(historyExceptions)));
}
function cardDate(card){return card?.querySelector('[data-day]')?.dataset.day||''}
function shouldOpenDate(date,current){
  if(historyMode==='all')return !historyExceptions.has(date);
  if(historyMode==='none')return historyExceptions.has(date);
  return current;
}
function applyPersistentHistory(){
  document.querySelectorAll('#historyList .day-card').forEach(card=>{
    const date=cardDate(card);if(!date)return;
    card.classList.toggle('open',shouldOpenDate(date,card.classList.contains('open')));
  });
  $('expandAllDays')?.classList.toggle('active',historyMode==='all');
  $('collapseAllDays')?.classList.toggle('active',historyMode==='none');
}
function setHistoryMode(mode){historyMode=mode;historyExceptions.clear();saveHistoryMode();applyPersistentHistory()}
function toggleHistoryDate(date){
  if(historyMode==='all'||historyMode==='none'){
    if(historyExceptions.has(date))historyExceptions.delete(date);else historyExceptions.add(date);
    saveHistoryMode();applyPersistentHistory();
  }
}
function bindPersistentHistory(){
  if(document.documentElement.dataset.v27HistoryBound)return;
  document.documentElement.dataset.v27HistoryBound='1';
  document.addEventListener('click',event=>{
    const expand=event.target.closest('#expandAllDays');
    if(expand){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();setHistoryMode('all');return}
    const collapse=event.target.closest('#collapseAllDays');
    if(collapse){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();setHistoryMode('none');return}
    const day=event.target.closest('#historyList [data-day]');
    if(day&&(historyMode==='all'||historyMode==='none')){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();toggleHistoryDate(day.dataset.day);
    }
  },true);
  const history=$('historyList');
  if(history)new MutationObserver(()=>requestAnimationFrame(applyPersistentHistory)).observe(history,{childList:true,subtree:true});
  applyPersistentHistory();
}

/* Full Loan Details sheet. */
let detailLoanId='';
let editLoanId='';
let editPaymentId='';
let detailPressTimer=null;
let detailPressStart={x:0,y:0};
function addLoanDetailsSheet(){
  if($('v27LoanDetailsBackdrop'))return;
  const details=document.createElement('div');
  details.id='v27LoanDetailsBackdrop';details.className='v27-loan-details-backdrop';
  details.innerHTML=`<section class="v27-loan-details-sheet"><div class="v27-loan-details-head"><div><h3 id="v27LoanDetailsTitle">Loan Details</h3><small id="v27LoanDetailsSubtitle"></small></div><button id="v27CloseLoanDetails" type="button">বন্ধ</button></div><div id="v27LoanDetailsSummary" class="v27-loan-details-summary"></div><div class="v27-loan-timeline-heading"><strong>তারিখ ও টাকার পূর্ণ Timeline</strong><small>প্রয়োজনে Edit চাপুন</small></div><div id="v27LoanTimelineList" class="v27-loan-timeline-list"></div></section>`;
  document.body.appendChild(details);
  $('v27CloseLoanDetails').onclick=closeLoanDetails;
  details.onclick=event=>{if(event.target===details)closeLoanDetails()};
  $('v27LoanTimelineList').onclick=event=>{
    const button=event.target.closest('[data-v27-edit-loan-row]');if(!button)return;
    openLoanCorrection(button.dataset.loanId,button.dataset.paymentId||'');
  };

  const edit=document.createElement('div');
  edit.id='v27LoanCorrectionBackdrop';edit.className='v27-loan-correction-backdrop';
  edit.innerHTML=`<section class="v27-loan-correction-sheet"><div class="v27-loan-correction-head"><h3 id="v27LoanCorrectionTitle">Loan Correction</h3><button id="v27CloseLoanCorrection" type="button">বন্ধ</button></div><div id="v27LoanIdentityFields" class="v27-loan-identity-fields"><label>ধরন<select id="v27LoanKind"><option value="given">আমি দিয়েছি</option><option value="taken">আমি নিয়েছি</option></select></label><label>ব্যক্তি / প্রতিষ্ঠান<input id="v27LoanPerson"></label></div><div class="v27-loan-correction-grid"><label>Date<input id="v27LoanDate" type="date"></label><label>Amount<input id="v27LoanAmount" inputmode="decimal"></label><label>Account<select id="v27LoanAccount"><option>Cash</option><option>Bank</option><option>bKash</option></select></label><label class="wide">মন্তব্য<textarea id="v27LoanNote" rows="5"></textarea></label></div><div class="v27-loan-correction-actions"><button id="v27CancelLoanCorrection" type="button">Cancel</button><button id="v27SaveLoanCorrection" type="button">Save Correction</button></div></section>`;
  document.body.appendChild(edit);
  $('v27CloseLoanCorrection').onclick=closeLoanCorrection;
  $('v27CancelLoanCorrection').onclick=closeLoanCorrection;
  $('v27SaveLoanCorrection').onclick=saveLoanCorrection;
  edit.onclick=event=>{if(event.target===edit)closeLoanCorrection()};
}
function loanTimelineRows(loan){
  const principalLabel=loan.kind==='given'?'লোন দিয়েছি':'লোন নিয়েছি';
  const paymentLabel=loan.kind==='given'?'ফেরত পেয়েছি':'পরিশোধ করেছি';
  const principal=`<article class="v27-loan-timeline-row principal"><div class="v27-loan-timeline-date">${esc(fmtDate(loan.startDate))}</div><div class="v27-loan-timeline-main"><strong>${principalLabel}</strong><small>${esc(loan.account||'Cash')}${loan.note?' · '+esc(loan.note):''}</small></div><b>${money(loan.principal)}</b><button type="button" data-v27-edit-loan-row data-loan-id="${esc(loan.id)}">Edit</button></article>`;
  const payments=[...(loan.payments||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(payment=>`<article class="v27-loan-timeline-row payment"><div class="v27-loan-timeline-date">${esc(fmtDate(payment.date))}</div><div class="v27-loan-timeline-main"><strong>${paymentLabel}</strong><small>${esc(payment.account||loan.account||'Cash')}${payment.note?' · '+esc(payment.note):''}</small></div><b>${money(payment.amount)}</b><button type="button" data-v27-edit-loan-row data-loan-id="${esc(loan.id)}" data-payment-id="${esc(payment.id)}">Edit</button></article>`).join('');
  return principal+(payments||'<div class="v27-loan-no-payment">এখনো কোনো পরিশোধের এন্ট্রি নেই</div>');
}
function renderLoanDetails(){
  const state=readState();const loan=state.loans.find(item=>item.id===detailLoanId);
  if(!loan){closeLoanDetails();return}
  const paid=paidAmount(loan),remaining=remainingAmount(loan);
  $('v27LoanDetailsTitle').textContent=loan.person||'Loan Details';
  $('v27LoanDetailsSubtitle').textContent=`${loan.kind==='given'?'আমি দিয়েছি':'আমি নিয়েছি'} · ${loanStatus(loan)}`;
  $('v27LoanDetailsSummary').innerHTML=`<div><small>মূল টাকা</small><strong>${money(loan.principal)}</strong></div><div><small>মোট পরিশোধ</small><strong>${money(paid)}</strong></div><div><small>বাকি</small><strong>${money(remaining)}</strong></div><div><small>শুরুর তারিখ</small><strong>${esc(fmtDate(loan.startDate))}</strong></div>`;
  $('v27LoanTimelineList').innerHTML=loanTimelineRows(loan);
}
function openLoanDetails(id){detailLoanId=id;renderLoanDetails();$('v27LoanDetailsBackdrop')?.classList.add('show')}
function closeLoanDetails(){detailLoanId='';$('v27LoanDetailsBackdrop')?.classList.remove('show')}
function openLoanCorrection(loanId,paymentId){
  const state=readState();const loan=state.loans.find(item=>item.id===loanId);if(!loan)return;
  const payment=paymentId?(loan.payments||[]).find(item=>item.id===paymentId):null;
  editLoanId=loanId;editPaymentId=paymentId||'';
  $('v27LoanCorrectionTitle').textContent=payment?'পরিশোধের এন্ট্রি সংশোধন':'মূল লোন এন্ট্রি সংশোধন';
  $('v27LoanIdentityFields').hidden=Boolean(payment);
  $('v27LoanKind').value=loan.kind||'given';$('v27LoanPerson').value=loan.person||'';
  $('v27LoanDate').value=payment?.date||loan.startDate||'';
  $('v27LoanAmount').value=payment?.amount||loan.principal||'';
  $('v27LoanAccount').value=payment?.account||loan.account||'Cash';
  $('v27LoanNote').value=payment?.note||loan.note||'';
  $('v27LoanCorrectionBackdrop').classList.add('show');setTimeout(()=>$('v27LoanAmount').focus(),70);
}
function closeLoanCorrection(){editLoanId='';editPaymentId='';$('v27LoanCorrectionBackdrop')?.classList.remove('show')}
function saveLoanCorrection(){
  const state=readState();const loan=state.loans.find(item=>item.id===editLoanId);if(!loan)return;
  const amount=Number(String($('v27LoanAmount').value||'').replace(/,/g,''));
  const date=$('v27LoanDate').value,account=$('v27LoanAccount').value,note=$('v27LoanNote').value;
  if(!Number.isFinite(amount)||amount<=0||!date){notify('সঠিক Date ও Amount দিন');return}
  if(editPaymentId){
    const payment=(loan.payments||[]).find(item=>item.id===editPaymentId);if(!payment)return;
    const other=(loan.payments||[]).filter(item=>item.id!==payment.id).reduce((sum,item)=>sum+Number(item.amount||0),0);
    if(other+amount>Number(loan.principal||0)+0.0001){notify('মোট পরিশোধ মূল টাকার বেশি হতে পারবে না');return}
    Object.assign(payment,{amount,date,account,note,updatedAt:Date.now()});
    state.tx.forEach(transaction=>{if(transaction.loanId===loan.id&&transaction.loanPaymentId===payment.id)Object.assign(transaction,{amount,date,account,remarks:note,updatedAt:Date.now()})});
  }else{
    const person=$('v27LoanPerson').value.trim(),kind=$('v27LoanKind').value;
    if(!person){notify('ব্যক্তি / প্রতিষ্ঠানের নাম দিন');return}
    if(amount+0.0001<paidAmount(loan)){notify('মূল টাকা মোট পরিশোধের চেয়ে কম হতে পারবে না');return}
    Object.assign(loan,{kind,person,principal:amount,startDate:date,account,note,dueDate:'',updatedAt:Date.now()});
    state.tx.forEach(transaction=>{
      if(transaction.loanId!==loan.id)return;
      if(transaction.loanEvent==='principal')Object.assign(transaction,{type:kind==='given'?'expense':'income',amount,date,account,remarks:note,subject:kind==='given'?`Loan Given — ${person}`:`Loan Taken — ${person}`,updatedAt:Date.now()});
      if(transaction.loanEvent==='payment')Object.assign(transaction,{type:kind==='given'?'income':'expense',subject:kind==='given'?`Loan Received — ${person}`:`Loan Repayment — ${person}`,updatedAt:Date.now()});
    });
  }
  loan.updatedAt=Date.now();closeLoanCorrection();persistState(state,'Loan history correction save হয়েছে');
  setTimeout(()=>{if(detailLoanId)renderLoanDetails()},130);
}
function bindLoanDetails(){
  const list=$('loanList');if(!list||list.dataset.v27DetailsBound)return;list.dataset.v27DetailsBound='1';
  list.addEventListener('click',event=>{
    const history=event.target.closest('[data-loan-history]');
    if(history){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openLoanDetails(history.dataset.loanHistory);return}
    const card=event.target.closest('[data-loan-card]');
    if(card&&!event.target.closest('button')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openLoanDetails(card.dataset.loanCard)}
  },true);
  list.addEventListener('dblclick',event=>{
    const card=event.target.closest('[data-loan-card]');if(!card||event.target.closest('button'))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openLoanDetails(card.dataset.loanCard);
  },true);
  list.addEventListener('pointerdown',event=>{
    const card=event.target.closest('[data-loan-card]');if(!card||event.target.closest('button'))return;
    event.stopPropagation();event.stopImmediatePropagation();detailPressStart={x:event.clientX,y:event.clientY};clearTimeout(detailPressTimer);
    detailPressTimer=setTimeout(()=>{openLoanDetails(card.dataset.loanCard);navigator.vibrate?.(30)},550);
  },true);
  list.addEventListener('pointermove',event=>{if(Math.abs(event.clientX-detailPressStart.x)>8||Math.abs(event.clientY-detailPressStart.y)>8)clearTimeout(detailPressTimer)},true);
  ['pointerup','pointercancel','pointerleave'].forEach(name=>list.addEventListener(name,()=>clearTimeout(detailPressTimer),true));
}
function hidePublicLinks(){
  const legacy=$('openLegacyWeb');if(legacy)legacy.hidden=true;
  document.documentElement.classList.add('v27-private-use');
}
function observeDynamic(){
  const list=$('loanList');if(list)new MutationObserver(()=>requestAnimationFrame(bindLoanDetails)).observe(list,{childList:true,subtree:true});
}
function start(){addLoanDetailsSheet();bindPersistentHistory();bindLoanDetails();hidePublicLinks();observeDynamic();setTimeout(()=>{applyPersistentHistory();bindLoanDetails();hidePublicLinks()},700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
