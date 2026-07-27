// /money-management-android/app/src/main/assets/v21.js
(function(){
'use strict';

const KEY='mm_standalone_v1';
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

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

function categoryLabel(category){return category?`${category.name}${category.subcategory?' / '+category.subcategory:''}`:''}

function commitState(state,message){
  const json=JSON.stringify(state);
  try{
    if(typeof window.receiveImportedBackup==='function')window.receiveImportedBackup(json);
    else{
      localStorage.setItem(KEY,json);
      if(window.MoneyBackup&&typeof window.MoneyBackup.saveBackup==='function')window.MoneyBackup.saveBackup(json);
    }
  }catch(error){
    localStorage.setItem(KEY,json);
  }
  setTimeout(()=>{
    refreshProfilePanel();
    if(message)notify(message);
  },20);
}

function selectedTransactionIds(){
  return Array.from(document.querySelectorAll('#historyList .tx-row.bulk-selected')).map(row=>row.dataset.id).filter(Boolean);
}

function oneShotExpand(open){
  document.querySelectorAll('#historyList .day-card').forEach(card=>card.classList.toggle('open',open));
  $('expandAllDays')?.classList.remove('active');
  $('collapseAllDays')?.classList.remove('active');
}

function applySelectedCategory(type,select){
  const value=select?.value||'__keep__';
  if(value==='__keep__')return;
  const ids=new Set(selectedTransactionIds());
  if(!ids.size){notify('আগে transaction নির্বাচন করুন');select.value='__keep__';return}

  const state=readState();
  let changed=0;
  state.tx.forEach(transaction=>{
    if(!ids.has(transaction.id)||transaction.type!==type)return;
    if(value==='__none__'){
      transaction.categoryId='';
      transaction.categoryName='Uncategorized';
      transaction.categoryIcon='';
      transaction.updatedAt=Date.now();
      changed++;
      return;
    }
    const category=state.categories.find(item=>item.id===value&&item.type===type);
    if(!category)return;
    transaction.categoryId=category.id;
    transaction.categoryName=categoryLabel(category);
    transaction.categoryIcon=category.icon||'';
    transaction.updatedAt=Date.now();
    changed++;
  });

  select.value='__keep__';
  if(!changed){notify(type==='income'?'নির্বাচিত Income নেই':'নির্বাচিত Expense নেই');return}
  commitState(state,`${changed.toLocaleString('en-US')}টি ${type==='income'?'Income':'Expense'}-এর Category পরিবর্তন হয়েছে`);
}

function deleteSelected(){
  const ids=new Set(selectedTransactionIds());
  if(!ids.size){notify('আগে transaction নির্বাচন করুন');return}
  if(!confirm(`${ids.size.toLocaleString('en-US')}টি নির্বাচিত transaction মুছবেন?`))return;
  const state=readState();
  state.tx=state.tx.filter(transaction=>!ids.has(transaction.id));
  $('cancelBulkSelection')?.click();
  commitState(state,'নির্বাচিত transaction মুছে গেছে');
}

function profileButtonText(state){
  const profile=state.profiles.find(item=>item.id===state.active)||state.profiles[0];
  return`👤 ${profile?.name||'Profile'} ▾`;
}

function renderProfileRows(state){
  const list=$('profileModalList');
  if(!list)return;
  list.innerHTML=state.profiles.map(profile=>`<article class="profile-row ${profile.id===state.active?'active':''}"><button class="profile-row-main" type="button" data-profile-id="${profile.id}"><span><strong>${String(profile.name||'Profile').replace(/[&<>"']/g,'')}</strong><small>${profile.id===state.active?'বর্তমান Profile':'Tap করে খুলুন'}</small></span><b>${profile.id===state.active?'✓':'›'}</b></button><div class="profile-long-actions"><button class="profile-edit-action" type="button" data-profile-edit="${profile.id}">নাম Edit</button><button class="profile-delete-action" type="button" data-profile-delete="${profile.id}">Profile Delete</button></div></article>`).join('');
}

function refreshProfilePanel(){
  const state=readState();
  if($('profileMenuButton'))$('profileMenuButton').textContent=profileButtonText(state);
  renderProfileRows(state);
}

function switchProfile(id){
  const state=readState();
  if(!state.profiles.some(profile=>profile.id===id))return;
  state.active=id;
  commitState(state,'Profile পরিবর্তন হয়েছে');
  $('profileBackdrop')?.classList.remove('show');
}

function addProfile(){
  const input=$('profileModalNewName');
  const name=input?.value.trim();
  if(!name){notify('নতুন Profile নাম লিখুন');return}
  const state=readState();
  const id=uid();
  state.profiles.push({id,name});
  state.active=id;
  if(input)input.value='';
  commitState(state,'নতুন Profile তৈরি হয়েছে');
  $('profileBackdrop')?.classList.remove('show');
}

function renameProfile(id){
  const state=readState();
  const profile=state.profiles.find(item=>item.id===id);
  if(!profile)return;
  const name=prompt('Profile-এর নতুন নাম লিখুন',profile.name||'');
  if(!name||!name.trim())return;
  profile.name=name.trim();
  commitState(state,'Profile-এর নাম পরিবর্তন হয়েছে');
}

function deleteProfile(id){
  const state=readState();
  if(state.profiles.length<=1){notify('শেষ Profile delete করা যাবে না');return}
  const profile=state.profiles.find(item=>item.id===id);
  if(!profile)return;
  if(!confirm(`“${profile.name}” Profile এবং এর Transaction, Loan, Category ও Report data স্থায়ীভাবে মুছবেন?`))return;
  state.profiles=state.profiles.filter(item=>item.id!==id);
  ['tx','loans','reminders','categories'].forEach(key=>{state[key]=state[key].filter(item=>item.profileId!==id)});
  state.drafts=state.drafts.filter(item=>!item.profileId||item.profileId!==id);
  if(state.active===id)state.active=state.profiles[0].id;
  commitState(state,'Profile delete হয়েছে');
}

function bindProfileFixes(){
  const add=$('profileModalAdd');
  if(add)add.onclick=addProfile;
  const input=$('profileModalNewName');
  if(input)input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();addProfile()}};

  const list=$('profileModalList');
  if(!list||list.dataset.v21Bound)return;
  list.dataset.v21Bound='1';
  list.addEventListener('click',event=>{
    const edit=event.target.closest('[data-profile-edit]');
    const remove=event.target.closest('[data-profile-delete]');
    const main=event.target.closest('.profile-row-main');
    if(!edit&&!remove&&!main)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(edit){renameProfile(edit.dataset.profileEdit);return}
    if(remove){deleteProfile(remove.dataset.profileDelete);return}
    const row=main.closest('.profile-row');
    if(row?.classList.contains('actions-open'))return;
    switchProfile(main.dataset.profileId);
  },true);
}

function addDrivePrivacyNote(){
  const card=document.querySelector('.sync-card');
  if(!card||$('driveAccountPrivacy'))return;
  const note=document.createElement('div');
  note.id='driveAccountPrivacy';
  note.className='drive-account-privacy';
  note.textContent='Google Drive system picker নিরাপত্তার কারণে নির্বাচিত Gmail address এই app-কে দেখায় না।';
  card.querySelector('.drive-status-panel')?.insertAdjacentElement('afterend',note);
}

function start(){
  if($('expandAllDays'))$('expandAllDays').onclick=()=>oneShotExpand(true);
  if($('collapseAllDays'))$('collapseAllDays').onclick=()=>oneShotExpand(false);

  const apply=$('applyBulkCategories');
  if(apply)apply.hidden=true;
  const expense=$('bulkExpenseCategory');
  const income=$('bulkIncomeCategory');
  if(expense)expense.onchange=()=>applySelectedCategory('expense',expense);
  if(income)income.onchange=()=>applySelectedCategory('income',income);
  if($('deleteBulkTransactions'))$('deleteBulkTransactions').onclick=deleteSelected;

  bindProfileFixes();
  addDrivePrivacyNote();
  refreshProfilePanel();
  setTimeout(()=>{bindProfileFixes();refreshProfilePanel()},500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
