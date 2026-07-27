// /money-management-android/app/src/main/assets/v24.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const $=id=>document.getElementById(id);

function readState(){
  try{
    const state=JSON.parse(localStorage.getItem(KEY)||'{}');
    ['profiles','tx','loans','reminders','categories','drafts'].forEach(key=>{if(!Array.isArray(state[key]))state[key]=[]});
    return state;
  }catch(error){return{profiles:[],tx:[],loans:[],reminders:[],categories:[],drafts:[]}}
}

function notify(message){
  const toast=$('toast');
  if(!toast)return;
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(window.__v24ToastTimer);
  window.__v24ToastTimer=setTimeout(()=>toast.classList.remove('show'),1500);
}

function persistState(state,message){
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

/* Keep the compact quick-entry controls at the very top of the card. */
function tightenQuickEntry(){
  const section=$('quickSection');
  const title=section?.querySelector('.quick-title');
  const status=$('autosaveStatus');
  const cross=$('cancelQuick');
  if(!section||!title||!status||!cross)return;
  title.classList.add('v24-tight-title');
  status.textContent='✓ Auto-saved';
  cross.textContent='×';
  cross.title='Auto-save হওয়ার আগের input বাতিল';
}

/* Remarks editor: double-tap or press-and-hold the Remarks cell. */
let remarksTransactionId='';
let remarksPressTimer=null;
let remarksPressStart={x:0,y:0};

function addRemarksEditor(){
  if($('v24RemarksBackdrop'))return;
  const backdrop=document.createElement('div');
  backdrop.id='v24RemarksBackdrop';
  backdrop.className='v24-remarks-backdrop';
  backdrop.innerHTML=`<section class="v24-remarks-sheet"><div class="v24-remarks-head"><h3>মন্তব্য / Notes</h3><button id="v24CloseRemarks" type="button">বন্ধ</button></div><textarea id="v24RemarksText" placeholder="বিস্তারিত মন্তব্য লিখুন…"></textarea><div class="v24-remarks-actions"><button id="v24CancelRemarks" type="button">Cancel</button><button id="v24SaveRemarks" type="button">Save</button></div></section>`;
  document.body.appendChild(backdrop);
  $('v24CloseRemarks').onclick=closeRemarksEditor;
  $('v24CancelRemarks').onclick=closeRemarksEditor;
  $('v24SaveRemarks').onclick=saveRemarksEditor;
  backdrop.onclick=event=>{if(event.target===backdrop)closeRemarksEditor()};
}

function openRemarksEditor(id){
  const state=readState();
  const transaction=state.tx.find(item=>item.id===id);
  if(!transaction)return;
  remarksTransactionId=id;
  $('v24RemarksText').value=transaction.remarks||'';
  $('v24RemarksBackdrop').classList.add('show');
  setTimeout(()=>$('v24RemarksText').focus(),80);
}

function closeRemarksEditor(){
  remarksTransactionId='';
  $('v24RemarksBackdrop')?.classList.remove('show');
}

function saveRemarksEditor(){
  const state=readState();
  const transaction=state.tx.find(item=>item.id===remarksTransactionId);
  if(!transaction)return;
  transaction.remarks=$('v24RemarksText').value;
  transaction.updatedAt=Date.now();
  closeRemarksEditor();
  persistState(state,'মন্তব্য update হয়েছে');
}

function bindRemarksGestures(){
  const history=$('historyList');
  if(!history||history.dataset.v24RemarksBound)return;
  history.dataset.v24RemarksBound='1';

  history.addEventListener('dblclick',event=>{
    const cell=event.target.closest('.tx-row td:nth-child(5)');
    if(!cell||$('bulkSelectionToolbar')?.classList.contains('show'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const row=cell.closest('.tx-row');
    if(row)openRemarksEditor(row.dataset.id);
  },true);

  history.addEventListener('pointerdown',event=>{
    const cell=event.target.closest('.tx-row td:nth-child(5)');
    if(!cell||$('bulkSelectionToolbar')?.classList.contains('show'))return;
    remarksPressStart={x:event.clientX,y:event.clientY};
    clearTimeout(remarksPressTimer);
    remarksPressTimer=setTimeout(()=>{
      const row=cell.closest('.tx-row');
      if(row){openRemarksEditor(row.dataset.id);navigator.vibrate?.(30)}
    },520);
  },true);

  history.addEventListener('pointermove',event=>{
    if(Math.abs(event.clientX-remarksPressStart.x)>8||Math.abs(event.clientY-remarksPressStart.y)>8)clearTimeout(remarksPressTimer);
  },true);
  ['pointerup','pointercancel','pointerleave'].forEach(name=>history.addEventListener(name,()=>clearTimeout(remarksPressTimer),true));
}

/* Immediate backup feedback while the Drive provider finishes writing. */
function bindFastBackupFeedback(){
  ['cloudBackupHeader','driveBackup'].forEach(id=>{
    const button=$(id);
    if(!button||button.dataset.v24BackupBound)return;
    button.dataset.v24BackupBound='1';
    button.addEventListener('click',()=>{
      button.classList.add('backup-pending');
      notify('Cloud backup শুরু হয়েছে…');
      setTimeout(()=>button.classList.remove('backup-pending'),4500);
    },true);
  });
}

function start(){
  tightenQuickEntry();
  addRemarksEditor();
  bindRemarksGestures();
  bindFastBackupFeedback();
  setTimeout(()=>{
    tightenQuickEntry();
    bindRemarksGestures();
    bindFastBackupFeedback();
  },700);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
