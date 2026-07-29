(function(){
'use strict';

const KEY='mm_standalone_v1';

function money(value){
  return '৳'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2});
}

function remaining(loan){
  const paid=(Array.isArray(loan.payments)?loan.payments:[])
    .reduce((sum,payment)=>sum+Number(payment.amount||0),0);
  return Math.max(0,Number(loan.principal||0)-paid);
}

function today(){
  const date=new Date();
  date.setMinutes(date.getMinutes()-date.getTimezoneOffset());
  return date.toISOString().slice(0,10);
}

function refreshUnpaidLoanSummary(){
  const summary=document.getElementById('loanSummary');
  if(!summary)return;

  let state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(error){state={}}
  const activeProfile=state.active;
  const loans=(Array.isArray(state.loans)?state.loans:[])
    .filter(loan=>loan.profileId===activeProfile)
    .map(loan=>({loan,balance:remaining(loan)}))
    .filter(item=>item.balance>0.0001);

  const receivable=loans
    .filter(item=>item.loan.kind==='given')
    .reduce((sum,item)=>sum+item.balance,0);
  const payable=loans
    .filter(item=>item.loan.kind==='taken')
    .reduce((sum,item)=>sum+item.balance,0);
  const overdue=loans.filter(item=>item.loan.dueDate&&item.loan.dueDate<today()).length;

  summary.innerHTML=`
    <div class="loan-summary-card given"><small>পাওনা বাকি</small><strong>${money(receivable)}</strong></div>
    <div class="loan-summary-card taken"><small>দেনা বাকি</small><strong>${money(payable)}</strong></div>
    <div class="loan-summary-card receivable"><small>চলমান লোন</small><strong>${loans.length.toLocaleString('en-US')} টি</strong></div>
    <div class="loan-summary-card payable"><small>সময় পার</small><strong>${overdue.toLocaleString('en-US')} টি</strong></div>`;
}

function start(){
  refreshUnpaidLoanSummary();
  document.addEventListener('click',()=>setTimeout(refreshUnpaidLoanSummary,0));
  document.addEventListener('change',()=>setTimeout(refreshUnpaidLoanSummary,0));
  window.addEventListener('storage',refreshUnpaidLoanSummary);
  setInterval(refreshUnpaidLoanSummary,1000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();
