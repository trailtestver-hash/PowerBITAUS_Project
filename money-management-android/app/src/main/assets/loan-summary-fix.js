(function(){
'use strict';

function parseMoney(text){
  const value=Number(String(text||'').replace(/[^0-9.-]/g,''));
  return Number.isFinite(value)?value:0;
}

function money(value){
  return '৳'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2});
}

function refreshUnpaidLoanSummary(){
  const summary=document.getElementById('loanSummary');
  const list=document.getElementById('loanList');
  if(!summary||!list)return;

  const unpaid=[...list.querySelectorAll('.loan-card')].filter(card=>!card.querySelector('.status.paid'));
  let receivable=0;
  let payable=0;
  let overdue=0;

  unpaid.forEach(card=>{
    const remaining=parseMoney(card.querySelector('.loan-money-grid > div:nth-child(3) strong')?.textContent);
    if(card.querySelector('.loan-icon.given'))receivable+=remaining;
    if(card.querySelector('.loan-icon.taken'))payable+=remaining;
    if(card.querySelector('.status.overdue'))overdue+=1;
  });

  summary.innerHTML=`
    <div class="loan-summary-card given"><small>পাওনা বাকি</small><strong>${money(receivable)}</strong></div>
    <div class="loan-summary-card taken"><small>দেনা বাকি</small><strong>${money(payable)}</strong></div>
    <div class="loan-summary-card receivable"><small>চলমান লোন</small><strong>${unpaid.length.toLocaleString('en-US')} টি</strong></div>
    <div class="loan-summary-card payable"><small>সময় পার</small><strong>${overdue.toLocaleString('en-US')} টি</strong></div>`;
}

function start(){
  refreshUnpaidLoanSummary();
  const list=document.getElementById('loanList');
  if(list)new MutationObserver(refreshUnpaidLoanSummary).observe(list,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',()=>setTimeout(refreshUnpaidLoanSummary,0));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();
