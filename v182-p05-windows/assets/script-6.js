
/* A47: Home -> character slots -> creation only after explicit empty-slot click. */
(function(){
 const modal=document.getElementById('modal'),select=document.getElementById('characterSelect'),home=document.getElementById('a47Home'),back=document.getElementById('a47CreationReturn');
 function showSlots(){
  home.hidden=true;modal.style.display='none';back.hidden=true;worldEntered=false;
  if(gerengTestMode&&!a37Slots.some(Boolean)){
   const job='法師',stats=jobs[job].slice(0,6);
   const {hp,mp}=a45StartingVitals(job,stats);
   a37Slots[0]={player:{name:'吉倫測試法師',job,gender:'男',lv:4,xp:0,adena:100,
    hp,maxHp:hp,mp,maxMp:mp,pots:0,stats,x:10,y:10,path:[],step:0,
    dataVersion:'1.82',dataSchema:p04Schema},drops:[],monsters:[]};
  }
  const index=a37Slots.findIndex(Boolean);
  if(index>=0){a37ActiveSlot=index;const record=a37Slots[index];player=structuredClone(record.player);player.path=[];drops=structuredClone(record.drops||[]);monsters=structuredClone(record.monsters||[]);target=null;centerCamera();showCharacterSelection();update();return}
  player=null;a37Page=0;a37ActiveSlot=0;select.hidden=false;
  for(const id of ['selectedCharacterName','selectedCharacterClass','selectedCharacterLevel','selectedCharacterHp','selectedCharacterMp','selectedCharacterStr','selectedCharacterDex','selectedCharacterCon','selectedCharacterWis','selectedCharacterCha','selectedCharacterInt'])document.getElementById(id).textContent='－';
  document.getElementById('enterGame').disabled=true;
  a37RenderSlots();
 }
 document.getElementById('a47Login').onclick=showSlots;
 back.onclick=()=>{modal.style.display='none';back.hidden=true;showSlots()};
 const observer=new MutationObserver(()=>{back.hidden=home.hidden===false||modal.style.display==='none'||select.hidden===false});
 observer.observe(modal,{attributes:true,attributeFilter:['style']});observer.observe(select,{attributes:true,attributeFilter:['hidden']});
 modal.style.display='none';select.hidden=true;home.hidden=false;back.hidden=true;
})();
