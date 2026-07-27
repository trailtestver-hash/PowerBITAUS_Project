// /money-management-android/app/src/main/assets/v19.js
(function(){
'use strict';

const RAW_BASE='https://raw.githubusercontent.com/trailtestver-hash/PowerBITAUS_Project/money-management-loans/money-management-android/app/src/main/assets/';
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

async function loadText(name,cacheKey){
  let text='';
  try{
    const response=await fetch(RAW_BASE+name+'?refresh='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    text=await response.text();
    localStorage.setItem(cacheKey,text);
  }catch(error){
    text=localStorage.getItem(cacheKey)||'';
  }
  return text;
}

function injectCss(text,id){
  if(!text||document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=text;
  document.head.appendChild(style);
}

function runCode(text,flag,label){
  if(!text||window[flag])return;
  window[flag]=true;
  try{(0,eval)(text)}catch(error){window[flag]=false;console.error(label+' load failed',error)}
}

async function loadFeatureLayers(){
  const v20Css=await loadText('v20.css','mm_v20_css_cache');
  injectCss(v20Css,'moneyManagementV20Css');
  const v20Js=await loadText('v20.js','mm_v20_feature_cache');
  runCode(v20Js,'__moneyManagementV20Loaded','Money Management 2.0');

  const v21Css=await loadText('v21.css','mm_v21_css_cache');
  injectCss(v21Css,'moneyManagementV21Css');
  const v21Js=await loadText('v21.js','mm_v21_feature_cache');
  runCode(v21Js,'__moneyManagementV21Loaded','Money Management 2.1');
}

function start(){
  const cancel=$('cancelQuick');
  if(cancel){cancel.textContent='×';cancel.setAttribute('aria-label','Input মুছুন')}
  const badge=$('nativeBackupStatus');
  if(badge)new MutationObserver(syncDriveControls).observe(badge,{childList:true,subtree:true,attributes:true,characterData:true});
  syncDriveControls();
  setTimeout(syncDriveControls,500);
  loadFeatureLayers();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
