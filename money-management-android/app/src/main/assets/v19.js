// /money-management-android/app/src/main/assets/v19.js
(function(){
'use strict';
const KEY='mm_standalone_v1';
const $=id=>document.getElementById(id);

function notice(message){
  const toast=$('toast');
  if(!toast){alert(message);return}
  toast.textContent=message;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),1800);
}

function readState(){
  try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(error){return{}}
}

function persistState(state){
  const json=JSON.stringify(state);
  localStorage.setItem(KEY,json);
  try{
    if(window.MoneyBackup&&typeof window.MoneyBackup.saveBackup==='function'){
      window.MoneyBackup.saveBackup(json);
    }
  }catch(error){}
}

function selectedProfileName(){
  const select=$('profileSelect');
  return select?.selectedOptions?.[0]?.textContent?.trim()||'';
}

function syncProfileRenameField(){
  const input=$('currentProfileName');
  if(input)input.value=selectedProfileName();
}

function renameCurrentProfile(){
  const input=$('currentProfileName');
  const name=input?.value.trim();
  if(!name){notice('Profile-এর নতুন নাম লিখুন');return}
  const state=readState();
  if(!Array.isArray(state.profiles)||!state.active){notice('Profile পাওয়া যায়নি');return}
  const profile=state.profiles.find(item=>item.id===state.active);
  if(!profile){notice('Profile পাওয়া যায়নি');return}
  profile.name=name;
  persistState(state);
  const select=$('profileSelect');
  if(select){
    Array.from(select.options).forEach(option=>{
      if(option.value===state.active)option.textContent=name;
    });
  }
  notice('Profile-এর নাম পরিবর্তন হয়েছে');
  setTimeout(()=>location.reload(),450);
}

function syncDriveControls(){
  const badge=$('nativeBackupStatus');
  const connected=Boolean(badge?.classList.contains('connected'))||/সংযুক্ত$/.test(badge?.textContent||'');
  const connect=$('connectDrive');
  const backup=$('driveBackup');
  const advanced=$('driveAdvanced');
  if(connect)connect.hidden=connected;
  if(backup)backup.hidden=!connected;
  if(advanced&&!connected)advanced.open=false;
}

function start(){
  const cancel=$('cancelQuick');
  if(cancel){cancel.textContent='×';cancel.setAttribute('aria-label','Input মুছুন')}
  if($('clearAll'))$('clearAll').textContent='সব local data মুছুন';

  $('renameProfile')?.addEventListener('click',renameCurrentProfile);
  $('currentProfileName')?.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();renameCurrentProfile()}
  });
  $('profileSelect')?.addEventListener('change',()=>setTimeout(syncProfileRenameField,0));

  const select=$('profileSelect');
  if(select){
    new MutationObserver(()=>syncProfileRenameField()).observe(select,{childList:true,subtree:true,attributes:true});
  }

  const badge=$('nativeBackupStatus');
  if(badge){
    new MutationObserver(syncDriveControls).observe(badge,{childList:true,subtree:true,attributes:true,characterData:true});
  }

  syncProfileRenameField();
  syncDriveControls();
  setTimeout(()=>{syncProfileRenameField();syncDriveControls()},500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();
