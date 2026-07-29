// /money-management-android/app/src/main/assets/v19.js
(function(){
'use strict';
const $=id=>document.getElementById(id);
function syncDriveControls(){
  const badge=$('nativeBackupStatus');
  const connected=Boolean(badge?.classList.contains('connected'))||/সংযুক্ত$/.test(badge?.textContent||'');
  const connect=$('connectDrive'),backup=$('driveBackup'),advanced=$('driveAdvanced');
  if(connect)connect.hidden=connected;
  if(backup)backup.hidden=!connected;
  if(advanced&&!connected)advanced.open=false;
}
function start(){
  const cancel=$('cancelQuick');
  if(cancel){cancel.textContent='×';cancel.setAttribute('aria-label','Input মুছুন')}
  const badge=$('nativeBackupStatus');
  if(badge)new MutationObserver(syncDriveControls).observe(badge,{childList:true,subtree:true,attributes:true,characterData:true});
  syncDriveControls();setTimeout(syncDriveControls,500);
  document.documentElement.classList.add('private-bundled-build');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
