// /money-management-android/app/src/main/assets/v19.js
(function(){
'use strict';

const FEATURE_URL='https://raw.githubusercontent.com/trailtestver-hash/PowerBITAUS_Project/money-management-loans/money-management-android/app/src/main/assets/v20.js';
const FEATURE_CACHE='mm_v20_feature_cache';
const $=id=>document.getElementById(id);

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

function runFeatureCode(code){
  if(!code||window.__moneyManagementV20Loaded)return;
  window.__moneyManagementV20Loaded=true;
  try{(0,eval)(code)}catch(error){window.__moneyManagementV20Loaded=false;console.error('Money Management 2.0 feature load failed',error)}
}

async function loadFeatureLayer(){
  let code='';
  try{
    const response=await fetch(FEATURE_URL+'?refresh='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    code=await response.text();
    localStorage.setItem(FEATURE_CACHE,code);
  }catch(error){
    code=localStorage.getItem(FEATURE_CACHE)||'';
  }
  runFeatureCode(code);
}

function start(){
  const cancel=$('cancelQuick');
  if(cancel){cancel.textContent='×';cancel.setAttribute('aria-label','Input মুছুন')}
  const badge=$('nativeBackupStatus');
  if(badge)new MutationObserver(syncDriveControls).observe(badge,{childList:true,subtree:true,attributes:true,characterData:true});
  syncDriveControls();
  setTimeout(syncDriveControls,500);
  loadFeatureLayer();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
