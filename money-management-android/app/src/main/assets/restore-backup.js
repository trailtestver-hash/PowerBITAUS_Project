(function(){
'use strict';

const KEY='mm_standalone_v1';

function start(){
  const form=document.querySelector('#morePage .form');
  if(!form||document.getElementById('restoreBackupText'))return;

  const details=document.createElement('details');
  details.className='bulk';
  details.innerHTML=`
    <summary>Backup Restore</summary>
    <textarea id="restoreBackupText" placeholder="পুরোনো app থেকে Backup JSON Copy করে এখানে paste করুন"></textarea>
    <button type="button" id="restoreBackupButton">Backup Restore করুন</button>`;
  form.insertBefore(details,form.querySelector('#clearAll'));

  document.getElementById('restoreBackupButton').addEventListener('click',()=>{
    const text=document.getElementById('restoreBackupText').value.trim();
    if(!text){alert('Backup JSON paste করুন');return}

    try{
      const data=JSON.parse(text);
      if(!data||!Array.isArray(data.profiles)||!Array.isArray(data.tx)){
        throw new Error('Invalid backup structure');
      }
      if(!Array.isArray(data.drafts))data.drafts=[];
      if(!Array.isArray(data.reminders))data.reminders=[];
      if(!Array.isArray(data.loans))data.loans=[];
      if(!data.active)data.active=data.profiles[0]?.id||'default';
      localStorage.setItem(KEY,JSON.stringify(data));
      alert('Backup restore হয়েছে। App এখন reload হবে।');
      location.reload();
    }catch(error){
      alert('সঠিক Money Management Backup JSON দিন');
    }
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();
