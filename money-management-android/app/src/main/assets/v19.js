// /money-management-android/app/src/main/assets/v19.js
(function(){
'use strict';

const RAW_BASE='https://raw.githubusercontent.com/trailtestver-hash/PowerBITAUS_Project/money-management-loans/money-management-android/app/src/main/assets/';
const LAYERS=[
  {name:'v20',css:'v20.css',js:'v20.js'},
  {name:'v21',css:'v21.css',js:'v21.js'},
  {name:'v22',css:'v22.css',js:'v22.js'},
  {name:'v23',css:'v23.css',js:'v23.js'},
  {name:'v24',css:'v24.css',js:'v24.js'},
  {name:'v25',css:'v25.css',js:'v25.js'}
];
const $=id=>document.getElementById(id);

function syncDriveControls(){
  const badge=$('nativeBackupStatus');
  const connected=Boolean(badge?.classList.contains('connected'))||/সংযুক্ত$/.test(badge?.textContent||'');
  const connect=$('connectDrive'),backup=$('driveBackup'),advanced=$('driveAdvanced');
  if(connect)connect.hidden=connected;
  if(backup)backup.hidden=!connected;
  if(advanced&&!connected)advanced.open=false;
}

async function fetchCached(path,key){
  try{
    const response=await fetch(RAW_BASE+path+'?refresh='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const text=await response.text();
    localStorage.setItem(key,text);
    return text;
  }catch(error){
    return localStorage.getItem(key)||'';
  }
}

function injectCss(name,code){
  if(!code||document.getElementById('money-'+name+'-style'))return;
  const style=document.createElement('style');
  style.id='money-'+name+'-style';
  style.textContent=code;
  document.head.appendChild(style);
}

function runJs(name,code){
  const flag='__moneyManagement'+name.toUpperCase()+'Loaded';
  if(!code||window[flag])return;
  window[flag]=true;
  try{(0,eval)(code)}catch(error){window[flag]=false;console.error('Money Management '+name+' load failed',error)}
}

async function loadLayers(){
  for(const layer of LAYERS){
    const css=await fetchCached(layer.css,'mm_'+layer.name+'_css_cache');
    injectCss(layer.name,css);
    const js=await fetchCached(layer.js,'mm_'+layer.name+'_js_cache');
    runJs(layer.name,js);
  }
}

function start(){
  const cancel=$('cancelQuick');
  if(cancel){cancel.textContent='×';cancel.setAttribute('aria-label','Input মুছুন')}
  const badge=$('nativeBackupStatus');
  if(badge)new MutationObserver(syncDriveControls).observe(badge,{childList:true,subtree:true,attributes:true,characterData:true});
  syncDriveControls();
  setTimeout(syncDriveControls,500);
  loadLayers();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
