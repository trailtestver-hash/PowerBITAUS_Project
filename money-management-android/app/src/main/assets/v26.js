// /money-management-android/app/src/main/assets/v26.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const DRIVE_LABEL_KEY='mm_drive_account_label';
const $=id=>document.getElementById(id);
const money=value=>'৳'+Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2});
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function readState(){
  try{
    const state=JSON.parse(localStorage.getItem(KEY)||'{}');
    ['profiles','tx','loans','reminders','categories','drafts'].forEach(key=>{if(!Array.isArray(state[key]))state[key]=[]});
    return state;
  }catch(error){return{profiles:[],tx:[],loans:[],reminders:[],categories:[],drafts:[]}}
}
function commitState(state,message){
  const json=JSON.stringify(state);
  try{
    if(typeof window.receiveImportedBackup==='function')window.receiveImportedBackup(json);
    else{localStorage.setItem(KEY,json);window.MoneyBackup?.saveBackup?.(json)}
  }catch(error){localStorage.setItem(KEY,json)}
  if(message)setTimeout(()=>notify(message),60);
}
function notify(message){
  const toast=$('toast');if(!toast)return;
  toast.textContent=message;toast.classList.add('show');
  clearTimeout(window.__v26ToastTimer);window.__v26ToastTimer=setTimeout(()=>toast.classList.remove('show'),1600);
}
function activeProfileId(state){return state.active||state.profiles?.[0]?.id||'default'}

/* Bengali phonetic transliteration for bilingual search. */
const BN_MAP={
  'অ':'o','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou',
  'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou','ং':'ng','ঃ':'h','ঁ':'n','্':'',
  'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'chh','জ':'j','ঝ':'jh','ঞ':'n',
  'ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n',
  'প':'p','ফ':'ph','ব':'b','ভ':'bh','ম':'m','য':'j','য়':'y','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h',
  'ড়':'r','ঢ়':'rh','ৎ':'t','ক্ষ':'kh','জ্ঞ':'gg','০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'
};
function normal(value){return String(value??'').trim().toLocaleLowerCase('bn-BD').replace(/\s+/g,' ')}
function romanise(value){
  let text=normal(value).normalize('NFC');
  text=text.replace(/ক্ষ/g,'kh').replace(/জ্ঞ/g,'gg');
  return Array.from(text).map(char=>Object.prototype.hasOwnProperty.call(BN_MAP,char)?BN_MAP[char]:char).join('').replace(/[^a-z0-9@._+\- ]/g,'').replace(/\s+/g,' ').trim();
}
function searchableText(transaction){
  const raw=[transaction.subject,transaction.remarks,transaction.categoryName,transaction.categoryIcon,transaction.amount,Number(transaction.amount||0).toLocaleString('en-US'),transaction.date,transaction.time,transaction.account,transaction.type,transaction.type==='income'?'income আয় joma':'expense ব্যয় khoroch'].join(' ');
  return `${normal(raw)} ${romanise(raw)}`.replace(/,/g,'');
}
function queryVariants(value){
  const raw=normal(value).replace(/,/g,'');
  return [...new Set([raw,romanise(raw)].filter(Boolean))];
}
function applyPhoneticSearch(){
  const input=$('quickSearch');if(!input)return;
  const variants=queryVariants(input.value);
  const state=readState();
  const byId=new Map(state.tx.map(transaction=>[transaction.id,transaction]));
  document.querySelectorAll('#historyList .day-card').forEach(card=>{
    const rows=Array.from(card.querySelectorAll('.tx-row'));
    if(!variants.length){card.hidden=false;rows.forEach(row=>row.hidden=false);return}
    let hits=0;
    rows.forEach(row=>{
      const text=searchableText(byId.get(row.dataset.id)||{});
      const hit=variants.some(query=>text.includes(query));
      row.hidden=!hit;if(hit)hits++;
    });
    card.hidden=hits===0;if(hits)card.classList.add('open');
  });
}

/* Search remains available while the user scrolls through history. */
function addStickySearch(){
  const original=$('quickSearch');if(!original||$('v26StickySearch'))return;
  const bar=document.createElement('div');bar.id='v26StickySearch';bar.className='v26-sticky-search';
  bar.innerHTML='<span>⌕</span><input id="v26StickySearchInput" type="search" placeholder="Search / খুঁজুন"><button id="v26StickySearchClear" type="button">×</button>';
  document.body.appendChild(bar);
  const floating=$('v26StickySearchInput');
  function syncFromOriginal(){if(floating.value!==original.value)floating.value=original.value;setTimeout(applyPhoneticSearch,0)}
  original.addEventListener('input',syncFromOriginal);
  floating.addEventListener('input',()=>{original.value=floating.value;original.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(applyPhoneticSearch,0)});
  $('v26StickySearchClear').onclick=()=>{floating.value='';original.value='';original.dispatchEvent(new Event('input',{bubbles:true}));applyPhoneticSearch()};
  $('cancelQuick')?.addEventListener('click',()=>{floating.value='';setTimeout(applyPhoneticSearch,20)},true);
  function position(){
    const home=$('homePage');const rect=original.getBoundingClientRect();
    bar.classList.toggle('show',Boolean(home?.classList.contains('active')&&rect.bottom<67));
  }
  window.addEventListener('scroll',position,{passive:true});window.addEventListener('resize',position);
  document.querySelectorAll('.bottom-nav button').forEach(button=>button.addEventListener('click',()=>setTimeout(position,80)));
  position();
}
function bindPhoneticSearch(){
  const input=$('quickSearch');if(!input||input.dataset.v26Phonetic)return;
  input.dataset.v26Phonetic='1';
  input.placeholder='Search / খুঁজুন (আম = Am)';
  input.addEventListener('input',()=>setTimeout(applyPhoneticSearch,0));
  const history=$('historyList');if(history)new MutationObserver(()=>setTimeout(applyPhoneticSearch,0)).observe(history,{childList:true,subtree:true});
}

/* Loan timeline including principal and repayment corrections. */
let editingLoanId='';
let editingPaymentId='';
let timelinePressTimer=null;
let timelinePressStart={x:0,y:0};
function loanPaid(loan){return(loan.payments||[]).reduce((sum,payment)=>sum+Number(payment.amount||0),0)}
function loanTimelineHtml(loan){
  const principalLabel=loan.kind==='given'?'লোন দিয়েছি':'লোন নিয়েছি';
  const principal=`<button class="loan-timeline-row principal" type="button" data-loan-timeline="principal" data-loan-id="${esc(loan.id)}"><span>${esc(loan.startDate||'')}</span><div><strong>${principalLabel}</strong><small>${esc(loan.note||loan.account||'')}</small></div><b>${money(loan.principal)}</b></button>`;
  const payments=[...(loan.payments||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(payment=>`<button class="loan-timeline-row payment" type="button" data-loan-timeline="payment" data-loan-id="${esc(loan.id)}" data-payment-id="${esc(payment.id)}"><span>${esc(payment.date||'')}</span><div><strong>${loan.kind==='given'?'ফেরত পেয়েছি':'পরিশোধ করেছি'}</strong><small>${esc(payment.note||payment.account||'')}</small></div><b>${money(payment.amount)}</b></button>`).join('');
  return `<div class="loan-timeline-title">তারিখ ও টাকার পূর্ণ হিসাব <small>Double-tap বা চেপে ধরে Edit</small></div>${principal}${payments||'<div class="empty">এখনো পরিশোধের এন্ট্রি নেই</div>'}`;
}
function decorateLoanTimelines(){
  const state=readState();
  document.querySelectorAll('#loanList [data-loan-card]').forEach(card=>{
    const loan=state.loans.find(item=>item.id===card.dataset.loanCard);const box=card.querySelector('.loan-payments');
    if(loan&&box&&box.dataset.v26LoanStamp!==String(loan.updatedAt||loan.payments?.length||0)){
      box.innerHTML=loanTimelineHtml(loan);box.dataset.v26LoanStamp=String(loan.updatedAt||loan.payments?.length||0);
    }
  });
}
function addLoanTimelineEditor(){
  if($('v26LoanTimelineBackdrop'))return;
  const backdrop=document.createElement('div');backdrop.id='v26LoanTimelineBackdrop';backdrop.className='v26-loan-edit-backdrop';
  backdrop.innerHTML='<section class="v26-loan-edit-sheet"><div class="v26-loan-edit-head"><h3 id="v26LoanEditTitle">Loan Entry Edit</h3><button id="v26CloseLoanEdit" type="button">বন্ধ</button></div><div class="v26-loan-edit-grid"><label>Date<input id="v26LoanEditDate" type="date"></label><label>Amount<input id="v26LoanEditAmount" inputmode="decimal"></label><label>Account<select id="v26LoanEditAccount"><option>Cash</option><option>Bank</option><option>bKash</option></select></label><label class="wide">মন্তব্য<textarea id="v26LoanEditNote" rows="4"></textarea></label></div><div class="v26-loan-edit-actions"><button id="v26CancelLoanEdit" type="button">Cancel</button><button id="v26SaveLoanEdit" type="button">Save Correction</button></div></section>';
  document.body.appendChild(backdrop);
  $('v26CloseLoanEdit').onclick=closeLoanTimelineEditor;$('v26CancelLoanEdit').onclick=closeLoanTimelineEditor;$('v26SaveLoanEdit').onclick=saveLoanTimelineCorrection;
  backdrop.onclick=event=>{if(event.target===backdrop)closeLoanTimelineEditor()};
}
function openLoanTimelineEditor(loanId,paymentId){
  const state=readState(),loan=state.loans.find(item=>item.id===loanId);if(!loan)return;
  editingLoanId=loanId;editingPaymentId=paymentId||'';
  const payment=paymentId?(loan.payments||[]).find(item=>item.id===paymentId):null;
  $('v26LoanEditTitle').textContent=payment?'পরিশোধের এন্ট্রি সংশোধন':'মূল Loan Entry সংশোধন';
  $('v26LoanEditDate').value=payment?.date||loan.startDate||'';
  $('v26LoanEditAmount').value=payment?.amount||loan.principal||'';
  $('v26LoanEditAccount').value=payment?.account||loan.account||'Cash';
  $('v26LoanEditNote').value=payment?.note||loan.note||'';
  $('v26LoanTimelineBackdrop').classList.add('show');setTimeout(()=>$('v26LoanEditAmount').focus(),70);
}
function closeLoanTimelineEditor(){editingLoanId='';editingPaymentId='';$('v26LoanTimelineBackdrop')?.classList.remove('show')}
function saveLoanTimelineCorrection(){
  const state=readState(),loan=state.loans.find(item=>item.id===editingLoanId);if(!loan)return;
  const amount=Number(String($('v26LoanEditAmount').value||'').replace(/,/g,'')),date=$('v26LoanEditDate').value,account=$('v26LoanEditAccount').value,note=$('v26LoanEditNote').value;
  if(!Number.isFinite(amount)||amount<=0||!date){notify('সঠিক Date ও Amount দিন');return}
  if(editingPaymentId){
    const payment=(loan.payments||[]).find(item=>item.id===editingPaymentId);if(!payment)return;
    const other=(loan.payments||[]).filter(item=>item.id!==payment.id).reduce((sum,item)=>sum+Number(item.amount||0),0);
    if(other+amount>Number(loan.principal||0)+0.0001){notify('মোট পরিশোধ মূল টাকার বেশি হতে পারবে না');return}
    Object.assign(payment,{amount,date,account,note,updatedAt:Date.now()});
    state.tx.forEach(transaction=>{if(transaction.loanId===loan.id&&transaction.loanPaymentId===payment.id)Object.assign(transaction,{amount,date,account,remarks:note,updatedAt:Date.now()})});
  }else{
    if(amount+0.0001<loanPaid(loan)){notify('মূল টাকা মোট পরিশোধের চেয়ে কম হতে পারবে না');return}
    Object.assign(loan,{principal:amount,startDate:date,account,note,updatedAt:Date.now()});
    state.tx.forEach(transaction=>{if(transaction.loanId===loan.id&&transaction.loanEvent==='principal')Object.assign(transaction,{amount,date,account,remarks:note,updatedAt:Date.now()})});
  }
  loan.updatedAt=Date.now();closeLoanTimelineEditor();commitState(state,'Loan history correction save হয়েছে');setTimeout(decorateLoanTimelines,120);
}
function bindLoanTimelineEditing(){
  const list=$('loanList');if(!list||list.dataset.v26TimelineBound)return;list.dataset.v26TimelineBound='1';
  list.addEventListener('dblclick',event=>{const row=event.target.closest('[data-loan-timeline]');if(!row)return;event.preventDefault();event.stopImmediatePropagation();openLoanTimelineEditor(row.dataset.loanId,row.dataset.paymentId||'')},true);
  list.addEventListener('pointerdown',event=>{const row=event.target.closest('[data-loan-timeline]');if(!row)return;timelinePressStart={x:event.clientX,y:event.clientY};clearTimeout(timelinePressTimer);timelinePressTimer=setTimeout(()=>{openLoanTimelineEditor(row.dataset.loanId,row.dataset.paymentId||'');navigator.vibrate?.(30)},540)},true);
  list.addEventListener('pointermove',event=>{if(Math.abs(event.clientX-timelinePressStart.x)>8||Math.abs(event.clientY-timelinePressStart.y)>8)clearTimeout(timelinePressTimer)},true);
  ['pointerup','pointercancel','pointerleave'].forEach(name=>list.addEventListener(name,()=>clearTimeout(timelinePressTimer),true));
  new MutationObserver(()=>requestAnimationFrame(decorateLoanTimelines)).observe(list,{childList:true,subtree:true});decorateLoanTimelines();
}

/* Once saved, the Drive account label is locked. Long-press to remove it. */
let driveLabelTimer=null;
function driveLabelValue(){const state=readState();return state.driveAccountLabel||localStorage.getItem(DRIVE_LABEL_KEY)||''}
function lockDriveAccountLabel(){
  const box=$('driveAccountLabelBox'),edit=box?.querySelector('.drive-account-label-edit'),text=$('driveAccountLabelText');if(!box||!edit||!text)return;
  const value=driveLabelValue();box.classList.toggle('locked',Boolean(value));edit.hidden=Boolean(value);
  text.textContent=value?value:'Backup Gmail ID এখনো লেখা হয়নি';text.title=value?'চেপে ধরে ID মুছুন':'';
}
function removeDriveAccountLabel(){
  const value=driveLabelValue();if(!value||!confirm(`${value} পরিচিতি মুছবেন? Drive backup file মুছবে না।`))return;
  const state=readState();state.driveAccountLabel='';localStorage.removeItem(DRIVE_LABEL_KEY);commitState(state,'Drive account পরিচিতি মুছে গেছে');setTimeout(lockDriveAccountLabel,80);
}
function bindDriveLabelLock(){
  const text=$('driveAccountLabelText'),save=$('saveDriveAccountLabel');if(!text)return;
  if(!text.dataset.v26Lock){
    text.dataset.v26Lock='1';
    text.addEventListener('pointerdown',()=>{if(!driveLabelValue())return;clearTimeout(driveLabelTimer);driveLabelTimer=setTimeout(()=>{removeDriveAccountLabel();navigator.vibrate?.(30)},700)});
    ['pointerup','pointercancel','pointerleave'].forEach(name=>text.addEventListener(name,()=>clearTimeout(driveLabelTimer)));
  }
  save?.addEventListener('click',()=>setTimeout(lockDriveAccountLabel,100));lockDriveAccountLabel();
}

/* Larger category icon library. */
const ICONS=['🍽️','🥘','🍚','🍞','🥚','🥛','☕','🍎','🍌','🛒','🛍️','🏠','🏢','💡','🔥','💧','📱','🌐','🚗','🚌','🚆','✈️','⛽','🛠️','🏥','💊','🎓','📚','👕','🎁','🎉','💰','💵','🏦','💳','📈','📉','💼','🧾','🤝','👨‍👩‍👧‍👦','🐾','⚽','🎬','🎵','🕌','🧹','🧺','🚿','🪑','🖥️','📦','🏗️','🌾','🐟','🥩','🍗','🏨','🧴','✂️','🔧','🧑‍💻','🏆','❤️'];
function addCategoryLogoLibrary(){
  const input=$('categoryIcon');if(!input||$('v26CategoryLogoLibrary'))return;
  const library=document.createElement('details');library.id='v26CategoryLogoLibrary';library.className='v26-logo-library';
  library.innerHTML=`<summary>Logo নির্বাচন করুন (${ICONS.length})</summary><div>${ICONS.map(icon=>`<button type="button" data-v26-logo="${icon}">${icon}</button>`).join('')}</div>`;
  input.insertAdjacentElement('afterend',library);
  library.onclick=event=>{const button=event.target.closest('[data-v26-logo]');if(!button)return;input.value=button.dataset.v26Logo;input.dispatchEvent(new Event('input',{bubbles:true}));library.open=false};
}

function start(){
  bindPhoneticSearch();addStickySearch();addLoanTimelineEditor();bindLoanTimelineEditing();bindDriveLabelLock();addCategoryLogoLibrary();
  setTimeout(()=>{bindPhoneticSearch();addStickySearch();decorateLoanTimelines();bindDriveLabelLock();addCategoryLogoLibrary();applyPhoneticSearch()},800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
