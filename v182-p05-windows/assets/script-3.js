
'use strict';
const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
// P05-D6: reversible visual calibration. Defaults preserve the existing prototype;
// comparison values are NOT asserted to be original Lineage 1.82 measurements.
// Scale the isometric X and Y axes together to preserve tile geometry.
const visualParams=new URLSearchParams(location.search);
const magicTestMode=visualParams.get('magicTest')==='1';
const gerengTestMode=visualParams.get('gerengPreview')==='1'&&visualParams.get('gerengTest')==='1';
function visualScaleParam(name){
 const raw=visualParams.get(name);
 if(raw===null)return 1;
 const n=Number(raw);
 return Number.isFinite(n)&&n>=0.5&&n<=2?Math.round(n*100)/100:1;
}
const MAP_VISUAL_SCALE=visualScaleParam('mapScale');
const CHARACTER_VISUAL_SCALE=visualScaleParam('characterScale');
const W=40,H=40,TW=56*MAP_VISUAL_SCALE,TH=28*MAP_VISUAL_SCALE;/* P02: single source of truth for class creation; values are inherited A47 placeholders, NOT verified 1.82 figures. */
const lineage182Data=Object.freeze({
 version:'1.82',schema:1,
 attributes:['STR','DEX','CON','INT','WIS','CHA'],
 classes:{
 '王族':{base:[13,10,10,10,11,13],points:8},
 '騎士':{base:[16,12,14,8,9,12],points:4},
 '妖精':{base:[11,12,12,12,12,9],points:7},
 '法師':{base:[8,7,12,12,12,8],points:16}
 },
 provenance:{creation:'A47 test values; historical 1.82 verification pending',vitals:'A45 placeholders',growth:'A46 placeholders',experience:'P03 progressive test formula, not original 1.82'}
});
const jobs=Object.fromEntries(Object.entries(lineage182Data.classes).map(([name,v])=>[name,[...v.base,v.points]]));let player=null,monsters=[],drops=[],cam={x:0,y:0},target=null,keys={},last=0,attackTimer=0;let spriteFacing=4,spriteMovingUntil=0,spriteAttackUntil=0,spritePickupUntil=0,spriteHitUntil=0,spriteMoveFrom=null,spriteMoveTo=null,spriteMoveStart=0;const SPRITE_STEP_MS=170;const tile=[];let seed=7412;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}for(let y=0;y<H;y++){tile[y]=[];for(let x=0;x<W;x++){let r=rand();tile[y][x]=(x>15&&x<19&&y>3&&y<32)?'water':r<.07?'tree':r<.10?'rock':r<.14?'dirt':'grass'}}for(let y=17;y<=19;y++)for(let x=15;x<=18;x++)tile[y][x]='bridge';for(let y=7;y<14;y++)for(let x=7;x<14;x++)tile[y][x]='grass';function pass(x,y){if(visualParams.get('historicalMode')==='1'){const st=talkingIslandManifestState;if(!st.playability||!st.playability.playable||!st.collision)return false;const b=st.collision.bounds;return Number.isInteger(x)&&Number.isInteger(y)&&x>=b.minX&&x<b.maxX&&y>=b.minY&&y<b.maxY&&!st.collision.blocked.has(x+','+y)}return x>=0&&y>=0&&x<W&&y<H&&!['water','tree','rock'].includes(tile[y][x])}function msg(s){let p=document.createElement('div');p.textContent='• '+s;let l=document.getElementById('log');l.prepend(p);while(l.children.length>25)l.lastChild.remove()}function spawn(){monsters=[];for(let i=0;i<22;i++){let x=3+Math.floor(rand()*34),y=3+Math.floor(rand()*34);if(pass(x,y)&&Math.hypot(x-10,y-10)>5)monsters.push({x,y,hp:30,max:30,alive:true,name:i%3===0?'獸人':'哥布林',cool:0})}}/* A43: browser-local character-name uniqueness, including Unicode width and case variants. */
function a43NameKey(value){return String(value||'').normalize('NFKC').trim().toLocaleLowerCase()}
function a43NameTaken(name,exceptSlot){const key=a43NameKey(name);return a37Slots.some((slot,index)=>index!==exceptSlot&&slot?.player&&a43NameKey(slot.player.name)===key)}
/* A45: early-Lineage candidate values. Initial HP except knight remains provisional. */
const a45InitialHp={王族:14,騎士:16,妖精:15,法師:12,黑暗妖精:12};
const a45InitialMp={王族:{11:2,12:3,13:3,14:3,15:3,16:4,17:4,18:4},騎士:{9:1,10:1,11:1,12:2,13:2},妖精:{12:4,13:4,14:4,15:4,16:6,17:6,18:6},法師:{9:4,10:4,11:4,12:6,13:6,14:6,15:6,16:8,17:8,18:8},黑暗妖精:{10:3,11:3,12:4,13:4,14:4,15:4,16:6,17:6,18:6}};
function a45StartingVitals(job,stats){const wis=stats[4],table=a45InitialMp[job]||{};return {hp:a45InitialHp[job]??12,mp:table[wis]??table[Math.max(...Object.keys(table).map(Number).filter(n=>n<=wis))]??3}}
/* A46: provisional early-era level-up growth model; ranges require 2004-era verification. */
const a46Growth={王族:{hp:[7,10],mp:[1,3]},騎士:{hp:[10,14],mp:[0,1]},妖精:{hp:[6,10],mp:[2,4]},法師:{hp:[4,7],mp:[3,6]}}; // P03: inherited test ranges; not historical 1.82 data.
/* P03: test-only EXP progression, not historical Lineage EXP. Old P01/P02 saves retain current-level EXP. */
const p03Progression={schema:1,source:'P03 test formula, historical 1.82 EXP pending',killExp:{'哥布林':20,'獸人':20},required:lv=>100*Math.max(1,Math.floor(lv))};
function p03ExpNeeded(lv){return p03Progression.required(lv)}
function p03ApplyExperience(gain){
 if(!player||!Number.isSafeInteger(gain)||gain<0)return false;
 player.xp=Math.max(0,Number(player.xp)||0)+gain;
 let levels=0;
 while(player.lv<99&&player.xp>=p03ExpNeeded(player.lv)&&levels++<99){
  player.xp-=p03ExpNeeded(player.lv);a46LevelUp();
 }
 if(player.lv>=99)player.xp=0;
 player.dataVersion='1.82';player.dataSchema=p04Schema;
 return true;
}
function p03AwardExp(monster){
 const gain=p03Progression.killExp[monster.name]??20;
 p03ApplyExperience(gain);
 msg('擊倒 '+monster.name+'，獲得測試 EXP '+gain);
 a37Snapshot();
}
function a46Roll(min,max){return min+Math.floor(Math.random()*(max-min+1))}
function a46LevelUp(){const g=a46Growth[player.job]||a46Growth.王族,con=player.stats?.[2]??10,wis=player.stats?.[4]??10;const hpBonus=Math.floor((con-12)/4),mpBonus=Math.floor((wis-12)/4);const hpGain=Math.max(1,a46Roll(...g.hp)+hpBonus),mpGain=Math.max(0,a46Roll(...g.mp)+mpBonus);player.lv++;player.maxHp+=hpGain;player.maxMp+=mpGain;player.hp=player.maxHp;player.mp=player.maxMp;msg('升級 Lv.'+player.lv+'！HP +'+hpGain+'、MP +'+mpGain+'（暫用成長公式）')}
function newPlayer(name,job){if(!Object.prototype.hasOwnProperty.call(jobs,job)){alert('1.82 尚未開放此職業');return}name=String(name||'').normalize('NFKC').trim();const selected=a37PendingSlot;if(a43NameTaken(name,selected)){alert('角色名稱「'+name+'」已被使用，請更換名稱。');document.getElementById('name').focus();return}let a=jobs[job];if(creationRemaining()!==0){alert('請先分配全部能力值點數');return}const existing=a37Slots[selected];if(existing&&!confirm('此欄位已有角色，確定覆蓋？'))return;const stats=a.slice(0,6).map((v,i)=>v+creationPoints[i]);const vitals=a45StartingVitals(job,stats);player={dataVersion:'1.82',dataSchema:p04Schema,name,job,gender:document.getElementById('gender').value,x:10,y:10,hp:vitals.hp,maxHp:vitals.hp,mp:vitals.mp,maxMp:vitals.mp,lv:1,xp:0,pots:3,stats,path:[],step:0};drops=[];target=null;spawn();centerCamera();a37ActiveSlot=selected;a37Slots[selected]={player:structuredClone(player),drops:[],monsters:structuredClone(monsters)};a37Persist();document.getElementById('modal').style.display='none';showCharacterSelection();update()}
let worldEntered=false;
/* A37: eight independent browser-local character slots. A19 visual stage preserved. */
const a37Key=magicTestMode?'lineage_182_magic_test_slots':gerengTestMode?'lineage_182_gereng_test_slots':'lineage_182_p01_character_slots';
/* P04: retain P01-P03 key; backup before first P04 write and migrate in memory.
   No automatic destructive overwrite of old slots. Browser-local only. */
const p04BackupKey=magicTestMode?'lineage_182_magic_test_backup':gerengTestMode?'lineage_182_gereng_test_backup':'lineage_182_pre_p04_backup_v1';
const p04Schema=2;
function p04MigrateSlot(slot){
 if(!slot||!slot.player||typeof slot.player!=='object')return null;
 const copy=structuredClone(slot),p=copy.player;
 if(!['王族','騎士','妖精','法師'].includes(p.job))return null;
 p.dataVersion=p.dataVersion||'1.82';p.dataSchema=p04Schema;
 p.lv=Math.max(1,Math.min(99,Math.floor(Number(p.lv)||1)));
 p.xp=Math.max(0,Math.floor(Number(p.xp)||0));
 p.maxHp=Math.max(1,Number(p.maxHp)||1);p.maxMp=Math.max(0,Number(p.maxMp)||0);
 p.hp=Math.max(0,Math.min(p.maxHp,Number.isFinite(Number(p.hp))?Number(p.hp):p.maxHp));
 p.mp=Math.max(0,Math.min(p.maxMp,Number.isFinite(Number(p.mp))?Number(p.mp):p.maxMp));
 p.path=[];return copy;
}
function p04MakeBackup(){
 try{if(localStorage.getItem(p04BackupKey)===null){
 const previous=localStorage.getItem(a37Key);
 if(previous!==null)localStorage.setItem(p04BackupKey,previous);
 }}catch(e){alert('無法建立 P04 舊存檔備份，請確認瀏覽器儲存空間');throw e}
}
let a37Slots=Array(8).fill(null),a37Page=0,a37ActiveSlot=0,a37PendingSlot=0;
try{const stored=JSON.parse(localStorage.getItem(a37Key));if(Array.isArray(stored))a37Slots=Array.from({length:8},(_,i)=>p04MigrateSlot(stored[i]))}catch(e){console.warn('P04: save read failed',e)}
// Only the dedicated magic test entry supplies a ready-to-learn character.
if(magicTestMode&&!a37Slots.some(Boolean))a37Slots[0]={
 player:{dataVersion:'1.82',dataSchema:p04Schema,name:'光箭測試法師',job:'法師',gender:'男',
  x:10,y:10,hp:24,maxHp:24,mp:7,maxMp:7,lv:4,xp:0,pots:3,adena:100,
  stats:[8,7,18,18,16,8],path:[],step:0,learnedSpells:[]},
 drops:[],monsters:[]
};
function a37Persist(){try{p04MakeBackup();localStorage.setItem(a37Key,JSON.stringify(a37Slots))}catch(e){alert('儲存失敗：請確認瀏覽器空間或隱私設定')}}
function a37Snapshot(){if(!player)return;player.dataVersion='1.82';player.dataSchema=p04Schema;a37Slots[a37ActiveSlot]={player:structuredClone({...player,path:[]}),drops:structuredClone(drops),monsters:structuredClone(monsters)};a37Persist()}
/* A39: reuse the A15 conservative edge-connected black removal for every slot. */
const a39PortraitCache=new Map();
function a39Portrait(src){if(a39PortraitCache.has(src))return a39PortraitCache.get(src);const task=new Promise(resolve=>{const asset=new Image();asset.crossOrigin='anonymous';asset.onload=()=>{try{const c=document.createElement('canvas');c.width=asset.naturalWidth;c.height=asset.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(asset,0,0);const im=ctx.getImageData(0,0,c.width,c.height),d=im.data,w=c.width,h=c.height,seen=new Uint8Array(w*h),stack=[];function dark(i){const p=i*4;return d[p]<=10&&d[p+1]<=10&&d[p+2]<=10&&d[p+3]>0}function add(i){if(!seen[i]&&dark(i)){seen[i]=1;stack.push(i)}}for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}while(stack.length){const i=stack.pop(),x=i%w,y=(i/w)|0;d[i*4+3]=0;if(x>0)add(i-1);if(x<w-1)add(i+1);if(y>0)add(i-w);if(y<h-1)add(i+w)}ctx.putImageData(im,0,0);resolve(c.toDataURL('image/png'))}catch(e){resolve(src)}};asset.onerror=()=>resolve(src);asset.src=src});a39PortraitCache.set(src,task);return task}
async function a37ShowSlotPortrait(img,src){
 if(img.dataset.source===src)return;
 img.dataset.source=src;
 img.hidden=true;
 img.removeAttribute('src');
 if(!src)return;
 const request={};
 img.portraitRequest=request;
 const clean=await a39Portrait(src);
 if(img.portraitRequest!==request||img.dataset.source!==src)return;
 img.src=clean;
 try{await img.decode()}catch{
  if(img.portraitRequest===request){
   img.removeAttribute('src');
   img.dataset.source='';
   a39PortraitCache.delete(src);
  }
  return;
 }
 if(img.portraitRequest===request&&img.dataset.source===src)img.hidden=false;
}
function a37RenderSlots(){const slots=document.querySelectorAll('.selection-arch-grid .character-slot');slots.forEach((el,i)=>{const index=a37Page*4+i,record=a37Slots[index],current=record?.player;el.dataset.slot=String(index);el.classList.toggle('a37-empty',!record);el.classList.toggle('a37-current',index===a37ActiveSlot&&!!record);el.setAttribute('aria-pressed',String(index===a37ActiveSlot&&!!record));let img=el.querySelector('img.a40-portrait');if(!img){img=document.createElement('img');img.className='a40-portrait';img.alt='角色外觀';img.decoding='async';el.insertBefore(img,el.firstChild)}const entry=current?referenceCreationFrames[current.job]?.[current.gender||'男']:null;const src=entry?referenceBase+entry[0]+'/'+entry[1]+'.png':'';a37ShowSlotPortrait(img,src);let label=el.querySelector('.slot-selected');if(!label){label=document.createElement('span');label.className='slot-selected';el.appendChild(label)}label.textContent=record?current.name+' Lv.'+current.lv:'＋ 建立角色'});document.querySelectorAll('.selection-pages button').forEach((b,i)=>b.classList.toggle('active',i===a37Page))}
function a37Choose(index){const record=a37Slots[index];if(!record){a37PendingSlot=index;document.getElementById('characterSelect').hidden=true;document.getElementById('modal').style.display='flex';return}if(player&&a37Slots[a37ActiveSlot]&&a37ActiveSlot!==index)a37Snapshot();a37ActiveSlot=index;player=structuredClone(record.player);player.path=[];drops=structuredClone(record.drops||[]);monsters=structuredClone(record.monsters||[]);target=null;centerCamera();showCharacterSelection();update()}
function showCharacterSelection(){
 setSpellbookOpen(false);
 setInventoryOpen(false);
 document.getElementById('leaveGameDialog').close();
 document.getElementById('characterStatusDialog').close();
 document.getElementById('villageShop').close();
 document.getElementById('gerengDialog').close();
 if(!player)return;
 if(localVillageEntered){
  localVillageEntered=false;
  villageTrial=null;
  document.body.classList.remove('village-preview');
  activateTalkingIslandScene(null);
  document.getElementById('a11EntryStatus').textContent='';
 }
 worldEntered=false;a17rRefresh();target=null;player.path=[];
 document.getElementById('selectedCharacterName').textContent=player.name;
 document.getElementById('selectedCharacterInfo').textContent=player.job+'・'+(player.gender||'男')+'・Lv.'+player.lv;
 document.getElementById('characterSlot').setAttribute('aria-pressed','true');
 document.getElementById('selectedCharacterClass').textContent=player.job;
 document.getElementById('selectedCharacterLevel').textContent=String(player.lv);
 document.getElementById('selectedCharacterHp').textContent=player.hp+' / '+player.maxHp;
 document.getElementById('selectedCharacterMp').textContent=player.mp+' / '+player.maxMp;
 const fields=['Str','Dex','Con','Int','Wis','Cha'];
 fields.forEach((key,i)=>{document.getElementById('selectedCharacter'+key).textContent=String(player.stats?.[i]??'待確認')});
 document.getElementById('enterGame').disabled=false;
 document.getElementById('characterSelect').hidden=false;
 a37Page=Math.floor(a37ActiveSlot/4);a37RenderSlots();
}
const villageSpriteBases={
 王族:{男:'royal-male',女:'royal-female'},
 騎士:{男:'knight',女:'knight-female'},
 妖精:{男:'elf-male',女:'elf-female'},
 法師:{男:'wizard-male',女:'wizard-female'}
};
async function enterSelectedCharacter(){
 if(!player||worldEntered||villageEntryPending)return;
 const spriteBase=villageSpriteBases[player.job]?.[player.gender||'男'];
 if(visualParams.get('villagePreview')!=='0'&&!talkingIslandMode()&&spriteBase){
  const selected=player;
  const button=document.getElementById('enterGame');
  const status=document.getElementById('a11EntryStatus');
  villageEntryPending=true;
  button.disabled=true;
  status.textContent='正在載入說話之島村莊…';
  try{
   const trial=visualParams.get('gerengPreview')!=='1'&&visualParams.get('villageTrial')!=='0';
   const scene=await prepareLocalVillage(spriteBase,trial);
   if(player!==selected||document.getElementById('characterSelect').hidden)return;
   activateTalkingIslandScene(scene);
   localVillageEntered=true;
   if(trial)startVillageTrial(scene);
   document.body.classList.add('village-preview');
  }catch(error){
   status.textContent='說話之島村莊載入失敗：'+error.message;
   return;
  }finally{
   villageEntryPending=false;
   button.disabled=!player;
  }
 }
 // P05-D14: preload the *selected* class/gender before entering the world.
 // Initial page load may have warmed only the default male-knight frames.
 // Do not alter sprites or substitute any placeholder image.
 if(!localVillageEntered)initializeKnightPreview();
 worldEntered=true;a17rRefresh();
 if(visualParams.get('smokeTest')==='1'&&window.startLineageSmokeTest){
  window.startLineageSmokeTest();
 }
 // A13: explicitly close creation modal before revealing the world (desktop and mobile).
 document.getElementById('modal').style.setProperty('display','none','important');
 document.getElementById('characterSelect').hidden=true;
 document.getElementById('returnToCharacterSelect').hidden=false;
 msg(localVillageEntered?'已進入說話之島村莊行走預覽。':'已進入測試地圖。戰鬥數值仍為佔位參數。');update();
 // A11: desktop page layout contains header/sidebar above the game canvas.
 // Bring the actual game viewport into view after closing the selection overlay.
 const gameCanvas=document.getElementById('c');
 if(gameCanvas){gameCanvas.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});}
 const status=document.getElementById('a11EntryStatus');
 if(villageTrial)showVillageTrialStatus();
 else if(status)status.textContent=localVillageEntered?'說話之島村莊｜左鍵點地移動，Esc 停止':'已進入地圖；若未看見地圖，請向下捲動至遊戲畫面';
}
function returnToCharacterSelection(){
 if(!player||!worldEntered)return;
 const dialog=document.getElementById('leaveGameDialog');
 if(dialog.open)return;
 document.getElementById('leaveGameMessage').textContent=!localVillageEntered||villageProgress()
  ?'重新開始或結束遊戲時會儲存進度。':'目前為村莊行走預覽。';
 dialog.showModal();
}
function leaveCurrentGame(toHome){
 const dialog=document.getElementById('leaveGameDialog');
 if(!dialog.open||!player||!worldEntered)return;
 if(!localVillageEntered||villageProgress())save();
 dialog.close();
 document.getElementById('desktopGameHelp').hidden=true;
 showCharacterSelection();
 document.getElementById('returnToCharacterSelect').hidden=true;
 if(toHome){
  document.getElementById('characterSelect').hidden=true;
  document.getElementById('a47Home').hidden=false;
  document.getElementById('a47Login').focus();
 }
}
document.getElementById('confirmLeaveGame').onclick=()=>leaveCurrentGame(false);
document.getElementById('quitToHome').onclick=()=>leaveCurrentGame(true);
document.getElementById('returnToCharacterSelect').onclick=returnToCharacterSelection;
document.querySelectorAll('.selection-arch-grid .character-slot').forEach((el,i)=>el.onclick=()=>a37Choose(a37Page*4+i));
document.querySelectorAll('.selection-pages button').forEach((el,i)=>el.onclick=()=>{a37Page=i;a37RenderSlots()});
document.getElementById('enterGame').onclick=enterSelectedCharacter;
/* A7 desktop fallback: keyboard Enter on selection screen triggers the same action. */
document.addEventListener('keydown',function(e){
 if(e.key==='Enter' && !document.getElementById('characterSelect').hidden && document.getElementById('modal').style.display==='none'){
  if(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  e.preventDefault();enterSelectedCharacter();
 }
});

document.getElementById('saveAndReturn').onclick=()=>save();
/* A42: irreversible per-slot deletion with exact character-name confirmation. */
document.getElementById('deleteSelectedCharacter').onclick=()=>{
 const index=a37ActiveSlot,record=a37Slots[index];
 if(!record?.player){alert('請先選擇要刪除的角色');return}
 const name=record.player.name;
 const typed=prompt('確定永久刪除「'+name+'」？\\n這會刪除此欄位的角色、能力值及遊戲進度，無法復原。\\n請輸入完整角色名稱以確認：');
 if(typed===null)return;
 if(typed!==name){alert('名稱不相符，已取消刪除。');return}
 a37Slots[index]=null;a37Persist();
 const next=a37Slots.findIndex(Boolean);
 if(next<0){player=null;drops=[];monsters=[];target=null;worldEntered=false;a37PendingSlot=index;a37Page=Math.floor(index/4);document.getElementById('characterSelect').hidden=true;document.getElementById('modal').style.display='flex';alert('角色已刪除。所有欄位皆為空白，請建立新角色。');return}
 a37ActiveSlot=next;const saved=a37Slots[next];player=structuredClone(saved.player);player.path=[];drops=structuredClone(saved.drops||[]);monsters=structuredClone(saved.monsters||[]);target=null;centerCamera();a37Page=Math.floor(next/4);showCharacterSelection();update();alert('已刪除「'+name+'」，其他角色保留。');
};

document.getElementById('backToCreation').onclick=()=>{a37PendingSlot=a37Slots.findIndex(x=>!x);if(a37PendingSlot<0){alert('八個角色欄位已滿');return}document.getElementById('characterSelect').hidden=true;document.getElementById('modal').style.display='flex';worldEntered=false;document.getElementById('returnToCharacterSelect').hidden=true;};
function save(){if(!player)return;if(localVillageEntered&&!villageProgress())return;a37Snapshot();msg('已儲存至角色欄位 '+(a37ActiveSlot+1)+'（P04 相容存檔）')}function load(){const index=a37Slots.findIndex(Boolean);if(index<0){alert('目前沒有角色存檔');return}a37ActiveSlot=index;const d=a37Slots[index];player=structuredClone(p04MigrateSlot(d).player);drops=structuredClone(d.drops||[]);monsters=structuredClone(d.monsters||[]);player.path=[];target=null;centerCamera();document.getElementById('modal').style.display='none';showCharacterSelection();update()}const creationStatNames=['力量 STR','敏捷 DEX','體質 CON','智力 INT','精神 WIS','魅力 CHA'];
let creationPoints=[0,0,0,0,0,0];
function creationRemaining(){const a=jobs[document.getElementById('job').value];return a[6]-creationPoints.reduce((sum,v)=>sum+v,0)}
function creationCap(job,i){return i===0&&job==='騎士'?20:18} // Provisional cap pending 2004 client verification.
function updateCreationStats(){
 const job=document.getElementById('job').value,a=jobs[job],panel=document.getElementById('creationStats');panel.replaceChildren();
 const title=document.createElement('b');title.className='stat-heading';title.textContent='屬性分配點數';panel.appendChild(title);
 const remaining=document.createElement('div');remaining.className='stat-remaining';remaining.textContent='剩餘 '+creationRemaining()+' / '+a[6];remaining.style.color='#f1d69a';panel.appendChild(remaining);
 for(let i=0;i<6;i++){
  const line=document.createElement('div');line.className='creation-stat-row';line.dataset.stat=String(i);
  const name=document.createElement('span');name.textContent=creationStatNames[i]+'：'+(a[i]+creationPoints[i]);name.className='creation-stat-name';line.appendChild(name);
  const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.className='stat-step';minus.disabled=creationPoints[i]===0;minus.onclick=()=>{creationPoints[i]--;updateCreationStats()};line.appendChild(minus);
  const plus=document.createElement('button');plus.type='button';plus.textContent='＋';plus.className='stat-step';plus.disabled=creationRemaining()===0||a[i]+creationPoints[i]>=creationCap(job,i);plus.onclick=()=>{creationPoints[i]++;updateCreationStats()};line.appendChild(plus);panel.appendChild(line);
 }
 const note=document.createElement('div');note.className='stat-provisional-note';note.textContent='基礎數值與點數參照早期資料；單項上限目前採暫定測試限制（一般18，騎士力量20），尚待2004原始客戶端核實。';panel.appendChild(note);
 const start=document.getElementById('start');start.disabled=creationRemaining()!==0;start.title=start.disabled?'請先分配全部能力值點數':'';
}
const creationEmblems=[{job:'王族',symbol:'♛',pos:'royal'},{job:'騎士',symbol:'⚔',pos:'knight'},{job:'妖精',symbol:'❧',pos:'elf'},{job:'法師',symbol:'✧',pos:'mage'}];
function renderCreationEmblems(){const holder=document.getElementById('creationEmblems');holder.replaceChildren();const selected=document.getElementById('job').value;for(const entry of creationEmblems){const btn=document.createElement('button');btn.type='button';btn.className='creation-emblem '+entry.pos+(entry.job===selected?' selected':'');const icon=document.createElement('img');icon.alt='';icon.loading='lazy';icon.src='https://shines871.github.io/idle-lineage-class/assets/logo/'+encodeURIComponent(entry.job+'logo.png');icon.onerror=()=>{icon.remove();btn.textContent=entry.symbol};btn.appendChild(icon);btn.title=entry.job;btn.setAttribute('aria-label','選擇'+entry.job);btn.setAttribute('aria-pressed',String(entry.job===selected));btn.onclick=()=>{const select=document.getElementById('job');select.value=entry.job;select.dispatchEvent(new Event('change'))};holder.appendChild(btn)}}
function renderCreationClassTabs(){const holder=document.getElementById('creationClassTabs'),selected=document.getElementById('job').value;holder.replaceChildren();for(const job of Object.keys(jobs)){const btn=document.createElement('button');btn.type='button';btn.textContent=job;btn.className=job===selected?'selected':'';btn.setAttribute('aria-pressed',job===selected?'true':'false');btn.onclick=()=>{document.getElementById('job').value=job;document.getElementById('job').dispatchEvent(new Event('change'))};holder.appendChild(btn)}}
const creationLore={"王族":"召集成員克服險惡的苦難與逆境\n只為了建立自己國家的遠大夢想\n就能夠犧牲所有的一切，那麼你就\n具備了王族最重要的「心」。\n\n『王族』是個非常特別的職業\n在天堂世界中只有\n『王族』才能創造血盟。\n雖然王族在戰鬥的時候\n沒有任何一個職業的優點\n但是如果想在天堂世界裡\n實現自己遠大的夢想，\n那麼唯有王族才能滿足你的夢想。\n王族必須聚集擁有相同夢想的成員\n並建立屬於自己的城堡。","騎士":"沒有什麼特別突出的才能\n只有默默地不間斷地修練，\n奮勇地擋在前端面對危險，\n就像主角一樣。\n\n騎士剛開始是以「自由騎士」\n的身份出發，並自由地到各地旅遊\n與冒險。但是騎士是個最重視\n自己要服從的王族與組織血盟\n並為他們奉獻、\n團體生活時騎士能夠表現出\n他的強大，並擁有堅忍的毅力。\n騎士是戰鬥最基本的職業，\n能夠使用多種武器與與盔甲等\n騎士強大的攻擊力及優越的防禦\n是其他職業無法比擬的\n尤其在近距離戰鬥時\n所表現出的強大戰鬥力。\n但是他們對於魔法的耐性不是很好，\n受到魔法的傷害比其他職業還高。","妖精":"妖精擁有比人類更長的壽命\n與美麗的外貌，他們順應自然\n追求融合安定的生活\n並對所有的事情表現較為保守\n因此妖精不喜歡與人類接觸\n在『森林之母』的保護之下\n建立獨自的文化生活。\n\n妖精能夠使用的武器比騎士少\n但是他可以使用大部分的武器\n尤其可以使用遠距離攻擊的弓箭\n比其他武器擁有更多的優勢\n而且能夠使用法師的多種魔法\n可謂是個最均衡的職業。\n\n你想要以妖精的身份存活\n就必須取得妖森守護者\n『那魯帕』的協助，妖精所使用的\n物品都是透過她製造出來的。","法師":"將此世界的神秘現象體制地處理\n並在現實中完成這些事的人\n被人們尊稱為「賢者」\n他們利用「瑪那」的力量\n釋放出神般的偉大力量\n他們的力量甚至能夠導致世界\n的滅亡，在幻想的世界中最為突出\n成為他人最具威脅\n又最受尊崇的對象。\n\n法師優先於精神上的發展與學習\n並能使用多種魔法\n因此法師比其他職業在剛開始時\n看似非常地軟弱\n但是透過冒險逐漸成長後\n最後一定能受到所有人的肯定。\n法師在戰鬥時總是在後方\n給予成員多種的魔法協助。","黑暗妖精":"黑暗妖精承襲妖精的敏銳與長壽\n卻選擇在陰影中磨練自己的道路。\n他們不以守護森林為使命，\n而是追求更快速、更致命的力量，\n在寂靜之中完成一次決定勝負的攻擊。\n\n黑暗妖精能夠使用匕首、雙刀、鋼爪\n與十字弓等武器，\n並以毒與閃避牽制敵人的行動。\n他們的防禦並不穩固，\n但是敏捷的身手與爆發性的殺傷力\n足以在短時間內扭轉戰局。\n\n你若想以黑暗妖精的身份生存，\n就必須習慣孤獨與危險，\n並相信藏在黑暗中的刀鋒。"};
const referenceCreationFrames={王族:{男:['prince',714,798],女:['princess',629,710]},騎士:{男:['m_knight',378,448],女:['f_knight',315,374]},妖精:{男:['m_elf',245,311],女:['f_elf',166,241]},法師:{男:['m_mage',531,625],女:['f_mage',452,527]},黑暗妖精:{男:['m_dark',90,162],女:['f_dark',25,86]}};
let referenceCreationState=null;
const referenceBase='https://shines871.github.io/idle-lineage-class/assets/start/';
function setReferenceCreationAvatar(job,gender,figure,img){
 const entry=referenceCreationFrames[job]?.[gender];if(!entry)return;
 const selection=job+gender;if(referenceCreationState?.selection===selection&&!referenceCreationState.failed)return;
 const state={selection,folder:entry[0],first:entry[1],last:entry[2],frame:entry[1],figure,img,ready:false,token:(referenceCreationState?.token||0)+1,cache:new Map(),lastTick:0,busy:false};
 referenceCreationState=state;figure.classList.add('reference-pending');figure.classList.remove('reference-loaded','reference-failed');img.removeAttribute('src');img.style.opacity='0';
 const status=document.getElementById('creationAnimationStatus');if(status)status.textContent='載入 '+job+'・'+(gender==='男'?'男性':'女性')+' 人物動畫…';
 function frameUrl(n){return referenceBase+state.folder+'/'+n+'.png'}
 const first=new Image();first.onload=()=>{if(referenceCreationState!==state)return;state.cache.set(state.first,first);img.src=first.src;state.ready=true;figure.classList.remove('reference-pending');figure.classList.add('reference-loaded');img.style.opacity='1';if(status)status.textContent=job+'・'+(gender==='男'?'男性':'女性')+'｜動畫播放中';
  for(let n=state.first+1;n<=Math.min(state.first+8,state.last);n++){const pre=new Image();pre.onload=()=>{if(referenceCreationState===state)state.cache.set(n,pre)};pre.src=frameUrl(n)}
 };first.onerror=()=>{if(referenceCreationState!==state)return;state.failed=true;figure.classList.remove('reference-loaded','reference-pending');figure.classList.add('reference-failed');if(status)status.textContent='人物圖片載入失敗'};first.src=frameUrl(state.first);
}
(function animateReferenceCreation(){let last=0;function tick(now){requestAnimationFrame(tick);const st=referenceCreationState;if(!st||!st.ready||document.hidden||now-last<110)return;last=now;
 const modal=document.getElementById('modal');if(modal&&getComputedStyle(modal).display==='none')return;
 const next=st.frame>=st.last?st.first:st.frame+1;
 const cached=st.cache.get(next);if(cached?.complete&&cached.naturalWidth){st.frame=next;st.img.src=cached.src;return}
 if(st.busy)return;st.busy=true;const probe=new Image();probe.onload=()=>{st.busy=false;if(referenceCreationState!==st)return;st.cache.set(next,probe);st.frame=next;st.img.src=probe.src;const after=next>=st.last?st.first:next+1;if(!st.cache.has(after)){const preload=new Image();preload.onload=()=>{if(referenceCreationState===st)st.cache.set(after,preload)};preload.src=referenceBase+st.folder+'/'+after+'.png'}};probe.onerror=()=>{st.busy=false};probe.src=referenceBase+st.folder+'/'+next+'.png';
 }requestAnimationFrame(tick)})();
function updateCreationPreview(){const job=document.getElementById('job').value,gender=document.getElementById('gender').value;const figure=document.getElementById('creationFigure');figure.dataset.gender=gender;figure.dataset.job=job;const refAvatar=document.getElementById('referenceCreationAvatar');const refBg=document.getElementById('referenceCreationBg');if(!refBg.dataset.loaded){refBg.src='https://shines871.github.io/idle-lineage-class/public/assets/login/824.png';refBg.dataset.loaded='1';refBg.onerror=()=>refBg.style.display='none'};setReferenceCreationAvatar(job,gender,figure,refAvatar);figure.style.setProperty('--armor',({'王族':'#a99b63','騎士':'#7a8794','妖精':'#648267','法師':'#6e6594','黑暗妖精':'#595d73'})[job]);document.getElementById('creationCaption').textContent=job+'・'+(gender==='男'?'男性':'女性');document.getElementById('creationLoreTitle').textContent=job;document.getElementById('creationLoreText').textContent=creationLore[job];requestAnimationFrame(()=>{const p=document.getElementById('creationLoreText');if(!p)return;p.style.fontSize='';let size=parseFloat(getComputedStyle(p).fontSize)||15;while(size>11&&p.scrollHeight>p.clientHeight+2){size-=.5;p.style.fontSize=size+'px'}})}
function updateCreationGenderButtons(){const selected=document.getElementById('gender').value;for(const btn of document.querySelectorAll('#creationGenderButtons button')){const active=btn.dataset.gender===selected;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active))}}
for(const btn of document.querySelectorAll('#creationGenderButtons button'))btn.addEventListener('click',()=>{const sel=document.getElementById('gender');sel.value=btn.dataset.gender;sel.dispatchEvent(new Event('change'))});
document.getElementById('gender').addEventListener('change',()=>{updateCreationPreview();updateCreationGenderButtons()});updateCreationGenderButtons();
document.getElementById('creationCancel').addEventListener('click',()=>{document.getElementById('name').value='';const job=document.getElementById('job');job.value='王族';job.dispatchEvent(new Event('change'));const gender=document.getElementById('gender');gender.value='男';gender.dispatchEvent(new Event('change'));creationPoints=[0,0,0,0,0,0];updateCreationStats();document.getElementById('name').focus()});
document.getElementById('job').addEventListener('change',()=>{creationPoints=[0,0,0,0,0,0];updateCreationStats();updateCreationPreview();renderCreationClassTabs();renderCreationEmblems()});updateCreationStats();updateCreationPreview();renderCreationClassTabs();renderCreationEmblems();
document.getElementById('closeDesktopHelp').onclick=()=>document.getElementById('desktopGameHelp').hidden=true;
document.getElementById('start').onclick=()=>newPlayer(document.getElementById('name').value.trim()||'冒險者',document.getElementById('job').value);document.getElementById('load').onclick=load;document.getElementById('save').onclick=save;document.getElementById('reset').onclick=()=>{if(confirm('重新建立角色？舊存檔不會自動刪除。'))(creationPoints=[0,0,0,0,0,0],updateCreationStats(),document.getElementById('modal').style.display='flex')};document.getElementById('heal').onclick=()=>{if(!player||(localVillageEntered&&!villageProgress()))return;if(player.pots<1){msg('治癒藥水不足');return}if(player.hp===player.maxHp)return;player.pots--;player.hp=Math.min(player.maxHp,player.hp+40);msg('使用治癒藥水，回復 40 HP（測試值）');update()};function update(){if(!player)return;a17rRefresh();document.getElementById('who').textContent=player.name+'｜'+player.job+' Lv.'+player.lv;for(let k of ['hp','mp']){let max=k==='hp'?'maxHp':'maxMp';document.getElementById(k+'text').textContent=player[k]+' / '+player[max];document.getElementById(k+'bar').style.width=(100*player[k]/player[max])+'%'}document.getElementById('xptext').textContent=player.xp+' / '+p03ExpNeeded(player.lv)+'（測試）';document.getElementById('xpbar').style.width=(100*player.xp/p03ExpNeeded(player.lv))+'%';document.getElementById('pots').textContent=player.pots;document.getElementById('attributes').innerHTML='<b>能力值（歷史待覆核）</b><div>'+['STR','DEX','CON','INT','WIS','CHA'].map((s,i)=>s+': '+player.stats[i]).join('　')+'</div><div>座標：'+player.x+', '+player.y+'</div>'}function screen(x,y){return {x:(x-y)*TW/2+canvas.width/2-cam.x,y:(x+y)*TH/2+90-cam.y}}function unproject(sx,sy){let a=(sx-canvas.width/2+cam.x)/(TW/2),b=(sy-90+cam.y)/(TH/2);return {x:Math.floor((a+b)/2+.5),y:Math.floor((b-a)/2+.5)}}// P05-D7: optional geometry regression audit; does not change gameplay or UI.
// Run with ?verifyGeometry=1 (and optionally mapScale / characterScale).
function verifyVisualGeometry(){
 const failures=[];
 if(!(TW>0&&TH>0&&KNIGHT_FRAMES.drawHeight*CHARACTER_VISUAL_SCALE>0))failures.push('invalid dimensions');
 // P05-D13: verify all tile centers at multiple camera offsets, including
 // negative offsets, and ensure nearby clicks resolve to the intended tile.
 const originalCam={x:cam.x,y:cam.y};
 try{
  for(const [cx,cy] of [[0,0],[137,-91],[-233,177]]){
   cam.x=cx;cam.y=cy;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const p=screen(x,y),q=unproject(p.x,p.y);
    if(q.x!==x||q.y!==y)failures.push('projection '+x+','+y+' camera '+cx+','+cy);
    const inside=unproject(p.x+TW*0.1,p.y+TH*0.1);
    if(inside.x!==x||inside.y!==y)failures.push('tile hit '+x+','+y+' camera '+cx+','+cy);
    if(failures.length>=10)break;
   }
   if(failures.length>=10)break;
  }
 }finally{cam.x=originalCam.x;cam.y=originalCam.y}
 const before={x:cam.x,y:cam.y};
 try{
  const sample={x:Math.floor(W/2),y:Math.floor(H/2)};
  cam.x=sample.x*TW/2-sample.y*TW/2;
  cam.y=(sample.x+sample.y)*TH/2+90-canvas.height*.53;
  const projected=screen(sample.x,sample.y);
  if(Math.abs(projected.x-canvas.width/2)>0.001||Math.abs(projected.y-canvas.height*.53)>0.001)failures.push('camera centering');
 }finally{cam.x=before.x;cam.y=before.y}
 const result={pass:failures.length===0,tilesChecked:W*H*3,mapScale:MAP_VISUAL_SCALE,characterScale:CHARACTER_VISUAL_SCALE,failures};
 console[result.pass?'info':'error']('[P05-D7 geometry]',result);
 return result;
}
if(visualParams.get('verifyGeometry')==='1')setTimeout(verifyVisualGeometry,0);
function pathfind(sx,sy,gx,gy){if(!pass(gx,gy))return [];let start=sx+sy*W,goal=gx+gy*W,q=[start],prev=new Int32Array(W*H).fill(-1);prev[start]=start;for(let head=0;head<q.length;head++){let u=q[head];if(u===goal)break;let x=u%W,y=Math.floor(u/W);for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){let nx=x+dx,ny=y+dy,v=nx+ny*W;if(!pass(nx,ny)||prev[v]!==-1)continue;if(dx&&dy&&(!pass(x+dx,y)||!pass(x,y+dy)))continue;prev[v]=u;q.push(v)}}if(prev[goal]===-1)return [];let out=[];for(let v=goal;v!==start;v=prev[v])out.push({x:v%W,y:Math.floor(v/W)});return out.reverse()}function clickAt(sx,sy){if(talkingIslandMode()){
  if(!verifiedTalkingIslandMovement)return;
  const movement=verifiedTalkingIslandMovement,frame=displayedIslandFrame;
  if(!frame)return;
  if(villageSpellTargeting){
   targetVillageSpell(sx,sy);
   return;
  }
  const {camera:c}=frame;
  const hit=pickVillageActor(sx,sy);
  if(hit==='teacher'||hit==='merchant'){
   const teacher=hit==='teacher';
   const npc=verifiedTalkingIslandScene[hit];
   if(Math.max(Math.abs(movement.position.x-npc.x),Math.abs(movement.position.y-npc.y))<=1){
    if(teacher)openGerengDialogue();else openVillageShop();
   }else{
    msg(teacher?'請走近吉倫。':'請走近潘朵拉再購買');update();
   }
   return;
  }
  if(hit==='enemy'){
   const {x,y}=VILLAGE_TRIAL_ENEMY;
   if(!villageTrial.target&&movement.moveTo(x,y))villageTrial.target=true;
   return;
  }
  if(villageTrial){
   if(villageProgress()&&villageTrial.phase==='defeated'&&villageTrial.dropAvailable){
    const drop=villageDropPosition(c);
    if(Math.abs(sx-drop.x)<=40&&Math.abs(sy-drop.y+9)<=16){
     requestVillagePickup(false);
     return;
    }
   }
   villageTrial.pickupStartedAt=null;
   villageTrial.pickup=false;
   villageTrial.target=null;
   villageTrial.attackStartedAt=-Infinity;villageTrial.attackPending=false;
  }
  const cell=movement.pick(sx,sy,c.cameraX,c.cameraY);
  if(cell)movement.moveTo(cell.x,cell.y);else movement.cancel();
  return;
 }if(!player)return;let t=unproject(sx,sy),m=monsters.find(m=>m.alive&&m.x===t.x&&m.y===t.y);if(m){target={type:'monster',ref:m};msg('鎖定 '+m.name);return}let d=drops.find(d=>d.x===t.x&&d.y===t.y);if(d){target={type:'drop',ref:d};return}target=null;player.path=pathfind(player.x,player.y,t.x,t.y);if(!player.path.length&&!pass(t.x,t.y))msg('該地形不可通行')}function centerCamera(){if(talkingIslandMode())return;if(!player)return;cam.x=(player.x-player.y)*TW/2;cam.y=(player.x+player.y)*TH/2+90-canvas.height*.53}
function pointerXY(e){
 const r=canvas.getBoundingClientRect();
 if(!localVillageEntered)return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
 const scale=Math.min(canvas.clientWidth/canvas.width,canvas.clientHeight/canvas.height);
 const boxX=r.width/canvas.offsetWidth,boxY=r.height/canvas.offsetHeight;
 const left=canvas.clientLeft+(canvas.clientWidth-canvas.width*scale)/2;
 const top=canvas.clientTop+(canvas.clientHeight-canvas.height*scale)/2;
 return {x:((e.clientX-r.left)/boxX-left)/scale,y:((e.clientY-r.top)/boxY-top)/scale};
}
let gesture=null;
window.addEventListener('blur',()=>{keys={};gesture=null;});
canvas.addEventListener('lostpointercapture',()=>{gesture=null;});
canvas.addEventListener('pointerdown',e=>{if(talkingIslandMode()&&(!worldEntered||!e.isPrimary||e.button!==0))return;if(talkingIslandMode()&&!verifiedTalkingIslandMovement)return;if(!talkingIslandMode()&&!player)return;e.preventDefault();let p=pointerXY(e);gesture={id:e.pointerId,x:p.x,y:p.y,camX:cam.x,camY:cam.y,drag:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;let p=pointerXY(e);let dx=p.x-gesture.x,dy=p.y-gesture.y;if(Math.hypot(dx,dy)>12)gesture.drag=true;if(gesture.drag&&!talkingIslandMode()){cam.x=gesture.camX-dx;cam.y=gesture.camY-dy}});
canvas.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;let g=gesture,p=pointerXY(e);gesture=null;if(!g.drag&&Math.hypot(p.x-g.x,p.y-g.y)<=12&&(!talkingIslandMode()||e.button===0)&&(!localVillageEntered||(p.x>=0&&p.y>=0&&p.x<canvas.width&&p.y<canvas.height)))clickAt(p.x,p.y)});
canvas.addEventListener('pointercancel',()=>gesture=null);
document.getElementById('centerCam').onclick=centerCamera;
document.getElementById('mobileHeal').onclick=()=>document.getElementById('heal').click();
document.getElementById('mobileSave').onclick=()=>document.getElementById('save').click();
document.getElementById('mobileInfo').onclick=()=>{let a=document.getElementById('attributes');a.style.display=a.style.display==='block'?'none':'block';if(a.style.display==='block')a.scrollIntoView({block:'nearest'})};
window.addEventListener('keydown',e=>{
 if((document.getElementById('gerengDialog').open||document.getElementById('villageShop').open||document.getElementById('characterStatusDialog').open||document.getElementById('leaveGameDialog').open))return;
 const tag=document.activeElement?.tagName;
 if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||document.getElementById('modal').style.display!=='none')return;
 keys[e.key]=true;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
 if(worldEntered&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.ctrlKey&&e.key.toLowerCase()==='q'){
  e.preventDefault();
  if(!e.repeat)returnToCharacterSelection();
  return;
 }
 if(worldEntered&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.ctrlKey&&e.key.toLowerCase()==='a'){
  e.preventDefault();
  if(!e.repeat)document.getElementById('a17rStatus').click();
  return;
 }
 if(worldEntered&&e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='s'){
  e.preventDefault();
  if(!e.repeat)document.getElementById('a17rSpellbook').click();
  return;
 }
 if(worldEntered&&e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='t'){
  e.preventDefault();
  if(!e.repeat)document.getElementById('a17rChatSize').click();
  return;
 }
 if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
 if(worldEntered&&/^F(?:[5-9]|1[0-2])$/.test(e.key)){
  const slot=Number(e.key.slice(1))-5;
  if(useActionHotkey(slot))e.preventDefault();
  return;
 }
 if(worldEntered&&e.key==='F4' &&villageProgress()){
  e.preventDefault();
  requestVillagePickup(true);
  return;
 }
 if(e.key.toLowerCase()==='h'){document.getElementById('heal').click();e.preventDefault();}
 if(e.key.toLowerCase()==='s'){document.getElementById('save').click();e.preventDefault();}
 if(e.key.toLowerCase()==='c'){centerCamera();e.preventDefault();}
 if(verifiedTalkingIslandScene?.dummy&&['1','2'].includes(e.key)){
  playVillageCastPreview(e.key==='1');
  e.preventDefault();
 }
 if(e.key==='Escape'&&!villageSpellTargeting&&closeActiveGamePanel()){e.preventDefault();return;}
 if(e.key==='Escape'){setVillageSpellTargeting(false);cancelVillageCast();if(villageTrial){villageTrial.pickup=false;villageTrial.pickupStartedAt=null;villageTrial.target=null;villageTrial.attackStartedAt=-Infinity;villageTrial.attackPending=false;}if(talkingIslandMode()&&worldEntered&&verifiedTalkingIslandMovement)verifiedTalkingIslandMovement.cancel();target=null;if(player)player.path=[];msg('已取消目前的移動或追擊指令');e.preventDefault();}
 if(e.key==='F1'||e.key==='?'){const help=document.getElementById('desktopGameHelp');help.hidden=!help.hidden;e.preventDefault();}
});window.addEventListener('keyup',e=>keys[e.key]=false);function loop(ts){let dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(talkingIslandMode()&&worldEntered&&verifiedTalkingIslandMovement){
  if(!verifiedTalkingIslandLastStep)verifiedTalkingIslandLastStep=ts;
  if(ts-verifiedTalkingIslandLastStep>=VERIFIED_SCENE_STEP_MS){
   const before={...verifiedTalkingIslandMovement.position};
   if(verifiedTalkingIslandMovement.step()){
    verifiedTalkingIslandStepFrom=before;
    verifiedTalkingIslandStepTo={...verifiedTalkingIslandMovement.position};
   }else{
    verifiedTalkingIslandStepFrom=null;
    verifiedTalkingIslandStepTo=null;
   }
   verifiedTalkingIslandLastStep=ts;
  }
  if(villageTrial)advanceVillageTrial(ts);
  draw();requestAnimationFrame(loop);return;
 }if(!player||!worldEntered){if(worldEntered)draw();requestAnimationFrame(loop);return;}if(player){if(keys.ArrowLeft)cam.x-=350*dt;if(keys.ArrowRight)cam.x+=350*dt;if(keys.ArrowUp)cam.y-=350*dt;if(keys.ArrowDown)cam.y+=350*dt;player.step+=dt;if(target){let o=target.ref;if(target.type==='monster'&&!o.alive)target=null;else{let distance=Math.max(Math.abs(player.x-o.x),Math.abs(player.y-o.y));if(distance<=1){player.path=[];if(target.type==='drop'){spriteFacing=direction8(o.x-player.x,o.y-player.y);spritePickupUntil=ts+340;drops=drops.filter(v=>v!==o);player.pots++;msg('拾取治癒藥水（測試掉落）');target=null;update()}else if(ts>attackTimer){attackTimer=ts+700;spriteFacing=direction8(o.x-player.x,o.y-player.y);spriteAttackUntil=ts+280;o.hp-=8+Math.floor(rand()*9);msg('攻擊 '+o.name+'，造成測試傷害');if(o.hp<=0){o.alive=false;if(rand()<.45)drops.push({x:o.x,y:o.y});p03AwardExp(o);target=null}update()}}else if(player.path.length===0||player.path[player.path.length-1].x!==o.x||player.path[player.path.length-1].y!==o.y)player.path=pathfind(player.x,player.y,o.x,o.y)}}}if(player.step>.17&&player.path.length){player.step=0;let p=player.path.shift();if(pass(p.x,p.y)){spriteFacing=direction8(p.x-player.x,p.y-player.y);spriteMoveFrom={x:player.x,y:player.y};spriteMoveTo={x:p.x,y:p.y};spriteMoveStart=ts;player.x=p.x;player.y=p.y;spriteMovingUntil=ts+SPRITE_STEP_MS;update()}}for(let m of monsters){if(!m.alive)continue;m.cool-=dt;if(Math.max(Math.abs(m.x-player.x),Math.abs(m.y-player.y))<=1&&m.cool<=0){m.cool=2.3;spriteHitUntil=ts+240;player.hp=Math.max(0,player.hp-3);if(player.hp===0){player.hp=player.maxHp;player.x=10;player.y=10;player.path=[];target=null;msg('角色倒下，返回起點（測試規則）')}update()}}draw();requestAnimationFrame(loop)}function diamond(x,y,fill){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+TW/2,y+TH/2);ctx.lineTo(x,y+TH);ctx.lineTo(x-TW/2,y+TH/2);ctx.closePath();ctx.fillStyle=fill;ctx.fill();/* No visible diamond grid borders; coordinates and collision remain unchanged. */}
// v0.03 knight animation study: original canvas-drawn sprite, no extracted game assets.
// Direction order: E, SE, S, SW, W, NW, N, NE in screen coordinates.
function direction8(dx,dy){let sx=dx-dy,sy=dx+dy;let a=Math.atan2(sy,sx);return (Math.round(a/(Math.PI/4))+8)%8}
function knightRenderPosition(now){if(!spriteMoveFrom||!spriteMoveTo||now>=spriteMovingUntil)return screen(player.x,player.y);let t=Math.max(0,Math.min(1,(now-spriteMoveStart)/SPRITE_STEP_MS));let e=t*t*(3-2*t);return screen(spriteMoveFrom.x+(spriteMoveTo.x-spriteMoveFrom.x)*e,spriteMoveFrom.y+(spriteMoveTo.y-spriteMoveFrom.y)*e)}
// v0.03-B: per-frame directional image adapter for Lineage-style class animations.
// Visual assets are NOT bundled. Set an approved local asset base in the config below.
// Reference naming: assets/classanim/男騎士[d0..d7]/sword1_{idle,walk,attack}_N.png.
// This animation system does not change any 2004 gameplay rules.
const KNIGHT_FRAMES={
 // P05 diagnostic: local sprite files have not been supplied; do not substitute unrelated art.
 base:'../assets/classanim',folder:'男騎士',weapon:'sword1',
 // Actual folder order must be visually verified with licensed sprite frames.
 // Mapping is configurable without changing movement or combat logic.
 directionFolders:['','2','F','d3','d4','d5','d6','d7'],
 actions:{idle:{count:13,ms:115},walk:{count:4,ms:65},attack:{count:6,ms:58}},
 drawHeight:58,anchorY:49
};
// Optional reference-only preview. No third-party artwork is committed to this repository.
// Use ?spriteSource=reference for a browser-only visual comparison.
// The default stays local; this is not an assertion of redistribution rights.
const KNIGHT_REFERENCE_ROOT='https://shines871.github.io/idle-lineage-class/assets/classanim';
const KNIGHT_REFERENCE_BACKUP='https://raw.githubusercontent.com/shines871/idle-lineage-class/main/assets/classanim';
const knightReferencePreview=new URLSearchParams(location.search).get('spriteSource')==='reference';
const knightAssetBase=knightReferencePreview?KNIGHT_REFERENCE_ROOT:KNIGHT_FRAMES.base;
const knightCache=new Map();
const knightLastReady=new Map();
// P05-D2: keep the most recently decoded sprite for each class/gender during direction changes.
const knightLastReadyByFolder=new Map();
let knightLoadedCount=0,knightFailedCount=0;
// P05-D4: retain decoded sprites throughout the session. Evicting ready images
// can cause fresh network requests and visible animation interruptions.
const KNIGHT_MAX_CACHE=1200;
const CLASS_SPRITE_COUNTS={
 '王子':[11,4,5],'公主':[12,4,7],
 '男騎士':[13,4,6],'女騎士':[13,4,6],
 '男妖精':[8,4,7],'女妖精':[10,4,8],
 '男法師':[9,4,7],'女法師':[8,8,7],
 '男黑暗妖精':[13,4,5],'女黑暗妖精':[12,4,5]
};
function activeSpriteFolder(){
 const gender=player?.gender==='女'?'女':'男';
 if(player?.job==='騎士')return gender+'騎士';
 if(player?.job==='王族')return gender==='女'?'公主':'王子';
 if(['妖精','法師','黑暗妖精'].includes(player?.job))return gender+player.job;
 return '男騎士';
}
function knightFolder(dir){
 return activeSpriteFolder()+KNIGHT_FRAMES.directionFolders[((dir%8)+8)%8];
}
function activeSpriteSpec(action){
 const counts=CLASS_SPRITE_COUNTS[activeSpriteFolder()]||CLASS_SPRITE_COUNTS['男騎士'];
 const n={idle:counts[0],walk:counts[1],attack:counts[2]}[action]||counts[0];
 return {count:n,ms:KNIGHT_FRAMES.actions[action].ms};
}
function knightFrameUrl(dir,action,frame){
 const k=KNIGHT_FRAMES;
 return knightAssetBase+'/'+encodeURIComponent(knightFolder(dir))+'/'+k.weapon+'_'+action+'_'+frame+'.png';
}
function knightFrame(dir,action,frame){
 const url=knightFrameUrl(dir,action,frame);
 if(!knightCache.has(url)){
  // Avoid unbounded image growth if future weapons or classes are added.
  // P05-D4: no eviction of successfully decoded frames during active gameplay.
  const img=new Image();const entry={img,ready:false,failed:false,triedBackup:false};
  // P05-D19: a successful HTTP response can still contain an invalid image.
  // Treat undecodable/zero-size images as failures and try the reference
  // backup exactly once, without counting one frame twice.
  const tryBackupOrFail=()=>{
   if(entry.ready||entry.failed)return;
   if(knightReferencePreview&&!entry.triedBackup){
    entry.triedBackup=true;
    img.src=url.replace(KNIGHT_REFERENCE_ROOT,KNIGHT_REFERENCE_BACKUP);
   }else{entry.failed=true;knightFailedCount++;spriteStatus()}
  };
  img.onload=()=>{
   if(entry.ready||entry.failed)return;
   if(img.naturalWidth>0&&img.naturalHeight>0){
    entry.ready=true;knightLoadedCount++;spriteStatus();
   }else tryBackupOrFail();
  };
  img.onerror=tryBackupOrFail;
  knightCache.set(url,entry);img.src=url;
 }
 return knightCache.get(url);
}
// P05-D9: optional read-only sprite availability audit for the selected class.
// Reports missing/loaded frames; does not claim historical artwork fidelity.
function auditSpriteFrames(){
 const folder=activeSpriteFolder(),result={folder,ready:0,loading:0,failed:0,notRequested:0,byAction:{}};
 for(const action of ['idle','walk','attack']){
  const count=activeSpriteSpec(action).count;
  const stat={ready:0,loading:0,failed:0,notRequested:0,total:count*8};
  for(let d=0;d<8;d++)for(let f=0;f<count;f++){
   const key=knightFrameUrl(d,action,f),entry=knightCache.get(key);
   if(!entry)stat.notRequested++;
   else if(entry.ready)stat.ready++;
   else if(entry.failed)stat.failed++;
   else stat.loading++;
  }
  result.byAction[action]=stat;
  result.ready+=stat.ready;result.failed+=stat.failed;result.loading+=stat.loading;result.notRequested+=stat.notRequested;
 }
 console.info('[P05-D9 sprite audit]',result);
 return result;
}
if(visualParams.get('auditSprites')==='1')window.auditSpriteFrames=auditSpriteFrames;
// P05-D20: opt-in, non-visual browser smoke test. Run on the actual hosted
// page with ?smokeTest=1 and inspect window.lineageSmokeTestResult.
// This tests loaded sprite files, not historical artwork accuracy.
if(visualParams.get('smokeTest')==='1'){
 window.lineageSmokeTestResult={state:'pending'};
 window.runLineageSmokeTest=async function(){
  const failures=[],geometry=verifyVisualGeometry();
  if(!geometry.pass)failures.push('geometry');
  const dir=(spriteFacing+4)%8,folder=activeSpriteFolder();
  // P05-D22: test frame zero for every facing, plus complete sequences
  // for the current facing. This catches missing direction folders without
  // fetching every frame of every direction during one smoke test.
  const expected=[];
  for(let d=0;d<8;d++)for(const action of ['idle','walk','attack']){
   const count=d===dir?activeSpriteSpec(action).count:1;
   for(let f=0;f<count;f++){
    expected.push({direction:d,action,frame:f,entry:knightFrame(d,action,f)});
   }
  }
  const deadline=Date.now()+12000;
  while(Date.now()<deadline&&expected.some(item=>!item.entry.ready&&!item.entry.failed)){
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  const sprite={folder,direction:dir,ready:0,failed:0,pending:0,failedFrames:[]};
  for(const item of expected){
   if(item.entry.ready)sprite.ready++;
   else if(item.entry.failed){sprite.failed++;sprite.failedFrames.push(item.direction+':'+item.action+':'+item.frame)}
   else sprite.pending++;
  }
  if(sprite.failed)failures.push('sprite files failed');
  if(sprite.pending)failures.push('sprite files timed out');
  if(!sprite.ready)failures.push('no decoded sprite frames');
  const result={state:failures.length?'fail':'pass',geometry,sprite,failures,
   note:'Only browser loading and geometry; not a historical visual comparison'};
  window.lineageSmokeTestResult=result;
  console[result.state==='pass'?'info':'error']('[P05-D22 smoke test]',result);
  return result;
 };
 // P05-D21: do not test the default knight before character selection.
 // Run after entering the world, so the report uses the actual class/gender.
 window.startLineageSmokeTest=()=>{
  window.lineageSmokeTestResult={state:'running'};
  return window.runLineageSmokeTest().catch(error=>{
   window.lineageSmokeTestResult={state:'error',message:String(error)};
   console.error('[P05-D21 smoke test]',error);
  });
 };
}
function knightPreload(dir,action,frame){
 const spec=activeSpriteSpec(action);
 knightFrame(dir,action,(frame+1)%spec.count);
}
function spriteStatus(){
 const el=document.getElementById('spriteStatus');
 if(!el)return;
 el.textContent='人物圖片（'+(player?.job||'未選角色')+'／'+(player?.gender||'男')+'）：'+(knightReferencePreview?'參考預覽':'本地')+'｜成功 '+knightLoadedCount+'｜失敗 '+knightFailedCount+
 (knightLoadedCount===0?'｜尚未顯示圖片':'')+(knightFailedCount>0&&knightLoadedCount===0?'｜本地素材缺失：請先確認可使用的原版圖片':'');
}
// Start the diagnostic even when the character is outside the camera viewport.
function initializeKnightPreview(){
 spriteStatus();
 // P05-D15: preloading must also work with approved local sprite assets.
 // Previously the early return skipped all warm-up unless reference preview
 // was explicitly enabled, even when local files were available.
 // P05-D8: warm the first decoded frame for every facing and action before
 // movement/attack requests them; retain the per-folder fallback while loading.
 // This is a preload only, not a new or substitute sprite asset.
 for(let d=0;d<8;d++){
  knightFrame(d,'idle',0);
  knightFrame(d,'walk',0);
  knightFrame(d,'attack',0);
 }
 // P05-D16: the first frames alone are insufficient for a smooth initial
 // animation. Warm every frame of the selected character's current facing,
 // while keeping other directions to their first frames to limit requests.
 const initialSourceDir=(spriteFacing+4)%8;
 for(const action of ['idle','walk','attack']){
  const count=activeSpriteSpec(action).count;
  for(let f=1;f<count;f++)knightFrame(initialSourceDir,action,f);
 }
 // The separate reference-image preview remains opt-in; only frame preloading
 // is shared with the local asset mode.
 if(!knightReferencePreview)return;
 const preview=document.getElementById('spritePreview');
 // P05-D9: preview must use the same 180-degree source mapping as the
 // actual character renderer; otherwise the preview can face the wrong way.
 const entry=knightFrame((spriteFacing+4)%8,'idle',0);
 if(preview&&entry){
  const refresh=()=>{if(entry.ready){preview.src=entry.img.src;preview.style.display='inline-block'}else if(entry.failed){preview.alt='圖片載入失敗'}};
  entry.img.addEventListener('load',refresh);
  entry.img.addEventListener('error',refresh);
  refresh();
 }
}
function drawKnightSprite(px,py,now){
 const attack=now<spriteAttackUntil,pickup=now<spritePickupUntil,move=now<spriteMovingUntil;
 const action=attack?'attack':pickup?'idle':move?'walk':'idle',spec=activeSpriteSpec(action);
 // Complete one full walk cycle per tile step and one attack cycle per attack.
 // The previous fixed-ms calculation skipped frames on short movement/attack windows.
 // Walk animation must continue across adjacent map steps rather than
 // restarting four frames every 170 ms (which caused a jerky 42 ms/frame).
 const duration=attack?280:move?Math.max(300,spec.count*85):spec.count*spec.ms;
 const elapsed=attack?Math.max(0,280-(spriteAttackUntil-now)):now;
 const phase=attack?Math.min(0.999,elapsed/duration):((elapsed%duration)/duration);
 const frame=Math.min(spec.count-1,Math.floor(phase*spec.count));
 // One consistent source direction for idle, walk and attack.
 // No action-specific mirroring; calibration remains explicit and reversible.
 // Source folders face 180 degrees opposite to the game's eight-direction indices.
 // Apply the same half-turn to idle, walk and attack; do not mirror individual actions.
 const sourceDir=(spriteFacing+4)%8;
 const mirrored=false;
 const key=activeSpriteFolder()+':'+sourceDir+':'+action;
 let entry=knightFrame(sourceDir,action,frame);
 if(!entry.ready){
  const first=knightFrame(sourceDir,action,0);
  if(first.ready)entry=first;
  else if(knightLastReady.has(key))entry=knightLastReady.get(key);
  else if(knightLastReady.has(activeSpriteFolder()+':'+sourceDir+':idle'))entry=knightLastReady.get(activeSpriteFolder()+':'+sourceDir+':idle');
  else{
   const idle=knightFrame(sourceDir,'idle',0);
   if(idle.ready)entry=idle;
  }
 }
 if(!entry.ready){
  // P05-D2: a newly requested direction may still be loading. Reuse the last
  // decoded frame of this SAME class/gender instead of flashing a block figure.
  const previous=knightLastReadyByFolder.get(activeSpriteFolder());
  if(previous&&previous.ready)entry=previous;
  else return; // No approved frame has loaded yet: never invent a silhouette.
 }
 knightLastReady.set(key,entry);
 knightLastReadyByFolder.set(activeSpriteFolder(),entry);
 knightPreload(sourceDir,action,frame);
 // Warm every frame in the active direction, including the next action.
 // Reusing these decoded images prevents stalls when switching from idle.
 if(action==='walk'||action==='attack'){
  for(let j=0;j<spec.count;j++)knightFrame(sourceDir,action,j);
  const idleCount=activeSpriteSpec('idle').count;
  for(let j=0;j<idleCount;j++)knightFrame(sourceDir,'idle',j);
 }
 const img=entry.img,h=KNIGHT_FRAMES.drawHeight*CHARACTER_VISUAL_SCALE,w=Math.max(1,h*img.naturalWidth/img.naturalHeight);
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.translate(Math.round(px),Math.round(py-KNIGHT_FRAMES.anchorY*CHARACTER_VISUAL_SCALE));
 // Pickup uses a normal idle pose until a verified pickup sprite sequence exists.
 if(mirrored)ctx.scale(-1,1);
 ctx.drawImage(img,-w/2,0,w,h);
 ctx.restore();
 // Hit feedback is a temporary overlay, not an unverified death/hit sprite asset.
 if(now<spriteHitUntil){ctx.save();ctx.globalAlpha=0.20+0.12*Math.sin(now/32);ctx.fillStyle='#ff5656';ctx.beginPath();ctx.ellipse(px,py-24,Math.max(12,w*.55),25,0,0,Math.PI*2);ctx.fill();ctx.restore()}
}
function drawCharacterSprite(p,now){
 if(['騎士','王族','妖精','法師','黑暗妖精'].includes(player.job)){drawKnightSprite(p.x,p.y,now);return}
 // P05-D4: never substitute the old block-character prototype for an
 // unknown class. Render only an approved/loaded sprite for supported classes.
 return;
}
// v0.05-D decorative terrain transitions; collision and map data are untouched.
function terrainDetails(x,y,p,type){
 const grassLike=t=>t==='grass'||t==='tree'||t==='rock';
 const waterAt=(a,b)=>a>=0&&b>=0&&a<W&&b<H&&tile[b][a]==='water';
 const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
 if(type==='grass'||type==='dirt'){
  for(const [dx,dy] of neighbors){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;
   const other=tile[ny][nx];if((type==='grass'&&other==='dirt')||(type==='dirt'&&grassLike(other))){
    const vx=dx*TW/4-dy*TW/4,vy=(dx+dy)*TH/4;
    ctx.fillStyle=type==='grass'?'#a29a6877':'#4e764477';
    for(let j=-1;j<=1;j++){ctx.beginPath();ctx.arc(p.x+vx+j*3,p.y+TH/2+vy+j*1.5,2.2,0,Math.PI*2);ctx.fill()}
   }
  }
 }
 if(type==='water'){
  // Highlight banks only where a water tile meets land.
  ctx.strokeStyle='#aac7a477';ctx.lineWidth=2;
  for(const [dx,dy] of neighbors){if(waterAt(x+dx,y+dy))continue;
   const cx=p.x,cy=p.y+TH/2;
   ctx.beginPath();
   if(dx===1){ctx.moveTo(cx+TW/2,cy);ctx.lineTo(cx,cy+TH/2)}
   else if(dx===-1){ctx.moveTo(cx-TW/2,cy);ctx.lineTo(cx,cy-TH/2)}
   else if(dy===1){ctx.moveTo(cx,cy+TH/2);ctx.lineTo(cx-TW/2,cy)}
   else{ctx.moveTo(cx,cy-TH/2);ctx.lineTo(cx+TW/2,cy)}
   ctx.stroke();
  }
 }
 if(type==='tree'){
  ctx.fillStyle='#101c144d';ctx.beginPath();ctx.ellipse(p.x+5,p.y+TH/2+3,15,5,0,0,Math.PI*2);ctx.fill();
 }
}
// P05-D27: opt-in, externally supplied map image. No invented map artwork.
// Example: ?sceneImage=https%3A%2F%2F... (only use a source with permission).
// The image is not bundled; missing/unapproved images do NOT silently become
// an alleged historical Talking Island village.
// P05-D30: load versioned map manifest without assuming candidate coordinates are verified.
// Diagnostic only: this cannot activate a historical village until assets and rights are confirmed.
const talkingIslandManifestState={status:'not-requested',manifest:null,error:null,playability:null,collision:null};
let verifiedTalkingIslandImage=null;
let verifiedTalkingIslandImageReady=false;
let verifiedTalkingIslandScene=null;
let verifiedTalkingIslandMovement=null;
let verifiedTalkingIslandLastStep=0;
let verifiedTalkingIslandStepFrom=null;
let verifiedTalkingIslandStepTo=null;
let displayedIslandFrame=null;
const VERIFIED_SCENE_STEP_MS=170;
function historicalVisualPosition(now=performance.now()){
 const movement=verifiedTalkingIslandMovement;
 if(!movement||!movement.position)return null;
 if(!verifiedTalkingIslandStepFrom||!verifiedTalkingIslandStepTo)return {...movement.position};
 const t=Math.min(1,Math.max(0,(now-verifiedTalkingIslandLastStep)/VERIFIED_SCENE_STEP_MS));
 return {x:verifiedTalkingIslandStepFrom.x+(verifiedTalkingIslandStepTo.x-verifiedTalkingIslandStepFrom.x)*t,
         y:verifiedTalkingIslandStepFrom.y+(verifiedTalkingIslandStepTo.y-verifiedTalkingIslandStepFrom.y)*t};
}
function historicalVisualCamera(now=performance.now()){
 if(!verifiedTalkingIslandScene)return null;
 const p=historicalVisualPosition(now);
 if(!p)return null;
 const projected=verifiedTalkingIslandScene.renderer.project(p.x,p.y);
 return {cameraX:projected.x-canvas.width/2,cameraY:projected.y-canvas.height/2};
}
let verifiedTalkingIslandWalkStart=0;
let verifiedTalkingIslandWasMoving=false;
let verifiedTalkingIslandLastScreenFacing=null;
let verifiedTalkingIslandSceneError=null;
const verifiedImageLoader=path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('無法讀取核實素材：'+path));image.src=path});
let localVillageEntered=false,villageEntryPending=false;
let villageTrial=null;
const PANDORA={x:32951,y:32561};
const VILLAGE_SHOP_TAX_PERCENT=0;
const POTION_PRICE=Math.floor(40*(100+VILLAGE_SHOP_TAX_PERCENT)/100);
const POTION_SELL_PRICE=19;
function shopBalance(){return player.adena??80;}
function commitVillagePlayer(nextPlayer){
 const nextSlots=a37Slots.slice();
 nextSlots[a37ActiveSlot]={player:structuredClone({...nextPlayer,path:[]}),
  drops:structuredClone(drops),monsters:structuredClone(monsters)};
 try{p04MakeBackup();localStorage.setItem(a37Key,JSON.stringify(nextSlots));}
 catch(error){msg('儲存失敗，進度未變更。');return false;}
 a37Slots=nextSlots;player=nextPlayer;return true;
}
function sellVillagePotion(quantity){
 if(!villageProgress()||!verifiedTalkingIslandScene.merchant||!Number.isSafeInteger(quantity)||quantity<1||
    !Number.isSafeInteger(player.pots)||player.pots<quantity||!Number.isSafeInteger(shopBalance())||shopBalance()<0)return false;
 const {x,y}=verifiedTalkingIslandMovement.position;
 if(Math.max(Math.abs(x-PANDORA.x),Math.abs(y-PANDORA.y))>1)return false;
 const balance=shopBalance()+quantity*POTION_SELL_PRICE;
 if(!Number.isSafeInteger(balance))return false;
 return commitVillagePlayer({...player,pots:player.pots-quantity,adena:balance});
}
function buyVillagePotion(quantity){
 if(!villageProgress()||!verifiedTalkingIslandScene.merchant||!Number.isSafeInteger(quantity)||quantity<1)return false;
 const {x,y}=verifiedTalkingIslandMovement.position;
 if(Math.max(Math.abs(x-PANDORA.x),Math.abs(y-PANDORA.y))>1)return false;
 const balance=shopBalance();
 if(!Number.isSafeInteger(balance)||balance<0||!Number.isSafeInteger(player.pots)||player.pots<0||
    quantity>Math.floor(balance/POTION_PRICE)||!Number.isSafeInteger(player.pots+quantity))return false;
 return commitVillagePlayer({...player,adena:balance-quantity*POTION_PRICE,pots:player.pots+quantity});
}
const villageShop=document.getElementById('villageShop');
const pandoraDialogue=document.getElementById('pandoraDialogue');
const villageShopForm=document.getElementById('villageShopForm');
let villageShopSelling=false;
function showPandoraDialogue(result='greeting'){
 document.getElementById('pandoraGreeting').hidden=result!=='greeting';
 document.getElementById('pandoraThanks').hidden=result!=='bought';
 const sold=result==='sold';
 document.getElementById('pandoraSold').hidden=!sold;
 const poor=result==='poor';
 document.getElementById('pandoraPoor').hidden=!poor;
 const tax=result==='tax';
 document.getElementById('pandoraTax').hidden=!tax;
 const spider=result==='spider';
 document.getElementById('pandoraSpider').hidden=!spider;
 const gludio=result==='gludio',port=result==='port';
 document.getElementById('pandoraGludio').hidden=!gludio;
 document.getElementById('pandoraPort').hidden=!port;
 const canReturn=sold||poor||tax||spider||gludio||port;
 document.getElementById('pandoraTradeActions').hidden=canReturn;
 document.getElementById('pandoraReturnActions').hidden=!canReturn;
 document.getElementById('pandoraAskGludio').hidden=result!=='greeting';
 document.getElementById('pandoraAskSpider').hidden=result!=='greeting';
 document.getElementById('pandoraPrices').hidden=result!=='greeting';
 villageShopForm.hidden=true;
 pandoraDialogue.hidden=false;
 pandoraDialogue.scrollTop=0;
}
document.getElementById('pandoraAskGludio').onclick=()=>{
 showPandoraDialogue('gludio');
 document.getElementById('pandoraAskPort').focus();
};
document.getElementById('pandoraAskPort').onclick=()=>{
 showPandoraDialogue('port');
 document.getElementById('pandoraReturn').focus();
};
document.getElementById('pandoraAskSpider').onclick=()=>{
 showPandoraDialogue('spider');
 document.getElementById('pandoraReturn').focus();
};
document.getElementById('pandoraPrices').onclick=()=>{
 document.getElementById('pandoraTaxRate').textContent=VILLAGE_SHOP_TAX_PERCENT;
 showPandoraDialogue('tax');
 document.getElementById('pandoraReturn').focus();
};
document.getElementById('pandoraReturn').onclick=()=>{
 showPandoraDialogue();
 document.getElementById('pandoraBuy').focus();
};
document.getElementById('pandoraClose').onclick=document.getElementById('closeVillageShopFrame').onclick=()=>villageShop.close();
document.getElementById('pandoraScrollUp').onclick=()=>{pandoraDialogue.scrollTop-=pandoraDialogue.clientHeight/4;};
document.getElementById('pandoraScrollDown').onclick=()=>{pandoraDialogue.scrollTop+=pandoraDialogue.clientHeight/4;};
document.getElementById('pandoraBuy').onclick=()=>showVillageTrade(false);
document.getElementById('pandoraSell').onclick=()=>showVillageTrade(true);
function showVillageTrade(selling){
 villageShopSelling=selling;
 pandoraDialogue.hidden=true;
 villageShopForm.hidden=false;
 villageShopQuantity.value='1';
 villageShopMessage.textContent=refreshVillageShop().error;
 villageShopQuantity.focus();
};
const villageShopQuantity=document.getElementById('villageShopQuantity');
const villageShopMessage=document.getElementById('villageShopMessage');
function refreshVillageShop(){
 const q=villageShopQuantity.value.trim();
 const quantity=/^\d+$/.test(q)?Number(q):NaN;
 const valid=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=Math.floor(Number.MAX_SAFE_INTEGER/POTION_PRICE);
 const price=villageShopSelling?POTION_SELL_PRICE:POTION_PRICE;
 const affordable=valid&&(villageShopSelling?quantity<=player.pots&&quantity<=Math.floor((Number.MAX_SAFE_INTEGER-shopBalance())/price):quantity<=Math.floor(shopBalance()/price));
 const stock=document.getElementById('pandoraPotionStock');
 stock.hidden=!villageShopSelling;
 stock.textContent=villageShopSelling?'×'+player.pots:'';
 document.getElementById('shopQuantityLabel').textContent=villageShopSelling?'賣出數量':'購買數量';
 document.getElementById('shopTotalLabel').textContent=villageShopSelling?'賣出總額':'購買總額';
 document.getElementById('buyVillageShop').textContent=villageShopSelling?'賣出':'購買';
 document.getElementById('buyVillageShop').dataset.selling=String(villageShopSelling);
 document.getElementById('villageShopPrice').textContent=price;
 document.getElementById('villageShopBalance').textContent=shopBalance();
 document.getElementById('villageShopTotal').textContent=valid?quantity*price+' 天幣':'—';
 document.getElementById('buyVillageShop').disabled=!valid||(villageShopSelling&&!affordable);
 return {quantity,insufficientFunds:valid&&!villageShopSelling&&!affordable,error:!valid?'請輸入正整數數量':!affordable?(villageShopSelling?'藥水不足或金額超出上限':'天幣不足'):''};
}
function openVillageShop(){
 if(villageShop.open)return;
 verifiedTalkingIslandMovement.cancel();
 villageTrial.target=null;
 villageTrial.attackPending=false;
 villageTrial.attackStartedAt=-Infinity;
 villageTrial.pickup=false;
 villageTrial.pickupStartedAt=null;
 cancelVillageCast();
 showPandoraDialogue();
 villageShop.showModal();
 document.getElementById('pandoraBuy').focus();
}
villageShopQuantity.addEventListener('input',()=>{villageShopMessage.textContent=refreshVillageShop().error;});
document.getElementById('closeVillageShop').onclick=()=>{showPandoraDialogue();document.getElementById('pandoraBuy').focus();};
document.getElementById('villageShopForm').onsubmit=event=>{
 event.preventDefault();
 if(!villageShop.open||villageShopForm.hidden)return;
 const {quantity,error,insufficientFunds}=refreshVillageShop();
 if(insufficientFunds){
  showPandoraDialogue('poor');
  document.getElementById('pandoraReturn').focus();
  return;
 }
 if(error)return;
 const success=villageShopSelling?sellVillagePotion(quantity):buyVillagePotion(quantity);
 if(!success){villageShopMessage.textContent='請靠近潘朵拉後再購買';return;}
 const message=(villageShopSelling?'賣出':'購買')+'治癒藥水 ×'+quantity+'，剩餘 '+player.adena+' 天幣';
 msg(message);
 update();
 refreshVillageShop();
 showPandoraDialogue(villageShopSelling?'sold':'bought');
 document.getElementById(villageShopSelling?'pandoraReturn':'pandoraBuy').focus();
};
const villageProgress=()=>localVillageEntered&&villageTrial&&visualParams.get('villageProgress')!=='0';
function requestVillagePickup(nearbyOnly){
 const trial=villageTrial;
 if(!villageProgress()||trial.phase!=='defeated'||!trial.dropAvailable)return false;
 if(trial.pickupStartedAt!=null)return true;
 const movement=verifiedTalkingIslandMovement;
 const {x,y}=VILLAGE_TRIAL_ENEMY;
 const {x:fromX,y:fromY}=movement.position;
 if(nearbyOnly&&(fromX!==x||fromY!==y)&&!movement.renderer.canStep(fromX,fromY,x,y))return false;
 trial.pickup=movement.moveTo(x,y);
 return trial.pickup;
}
function villageDropPosition(camera){
 const {x,y}=VILLAGE_TRIAL_ENEMY;
 return verifiedTalkingIslandMovement.renderer.project(x,y,camera.cameraX,camera.cameraY);
}
let villageCastPreview=null;
function cancelVillageCast(now=performance.now()){
 if(!villageCastPreview)return;
 const release=villageCastPreview.sprite[0].frameEnds[5];
 if(now-villageCastPreview.startedAt<release)villageCastPreview=null;
}
const GOBLIN=Object.freeze({level:2,hp:3,mp:10,exp:5});
const VILLAGE_TRIAL_ENEMY={x:32953,y:32569};
const VILLAGE_TRIAL_DAMAGE=8;
const TRIAL_PLAYER_HP=12;
const GOBLIN_DAMAGE=3;
const GOBLIN_ATTACK_FRAMES=4;
const GOBLIN_ATTACK_FRAME_MS=125;
function startVillageTrial(scene){
 if(!scene.renderer.canWalk(VILLAGE_TRIAL_ENEMY.x,VILLAGE_TRIAL_ENEMY.y))return;
 // The isolated magic test must survive two maximum-damage light bolts.
 const maxHp=magicTestMode?Math.max(GOBLIN.hp,40):GOBLIN.hp;
 if(magicTestMode)player.mp=player.maxMp;
 villageTrial={phase:'fight',hp:maxHp,maxHp,target:null,nextAttack:0,attackStartedAt:-Infinity,attackPending:false,
  playerHp:TRIAL_PLAYER_HP,goblinAttackAt:null,goblinReadyAt:0,provoked:false,exp:0,
  home:{...scene.movement.position}};
}
function showVillageTrialStatus(){
 const messages={
  fight:'開發測試｜點擊哥布林測試近戰',
  dying:'開發測試｜哥布林已擊倒',
  defeated:'開發測試｜近戰測試完成'
 };
 document.getElementById('a11EntryStatus').textContent=messages[villageTrial.phase];
 a17rRefresh();
}
// Use the last painted frame for both animation pixels and camera position.
function pickVillageActor(sx,sy,spell=false){
 const frame=displayedIslandFrame;
 if(!frame||sx<0||sy<0||sx>=canvas.width||sy>=canvas.height)return null;
 const scene=verifiedTalkingIslandScene;
 const targets=new Map();
 if(spell&&scene.dummy)targets.set(scene.dummy,'dummy');
 else if(villageTrial?.phase==='fight')targets.set(frame.enemy,'enemy');
 if(!spell){
  if(scene.teacher)targets.set(scene.teacher,'teacher');
  if(scene.merchant)targets.set(scene.merchant,'merchant');
 }
 const radius=4;
 const nearby=frame.draws.filter(({item,left,top})=>
  sx>=left-radius&&sx<left+item.width+radius&&sy>=top-radius&&sy<top+item.height+radius);
 const topPixel=(x,y)=>{
  for(let i=nearby.length-1;i>=0;i--){
   if(isOpaqueIslandPixel(nearby[i],x,y))return nearby[i].item;
  }
  return null;
 };
 const exact=topPixel(sx,sy);
 if(targets.has(exact))return targets.get(exact);
 // Name labels are painted above the scene. Use the same projected anchor.
 for(const {item,name,font,point,offset} of frame.labels){
  if(targets.has(item)&&isVillageActorLabelHit(name,font,point,sx,sy,offset))return targets.get(item);
 }
 // A painted foreground object blocks tolerance behind it. The ground
 // layer is excluded from draws used for interaction.
 if(exact)return null;
 let best=null,bestDistance=radius*radius+1;
 for(let dy=-radius;dy<=radius;dy++){
  for(let dx=-radius;dx<=radius;dx++){
   const distance=dx*dx+dy*dy;
   if(distance>=bestDistance||distance>radius*radius)continue;
   const item=topPixel(sx+dx,sy+dy);
   if(targets.has(item)){best=targets.get(item);bestDistance=distance;}
  }
 }
 return best;
}

function isVillageActorLabelHit(label,font,point,sx,sy,offset){
 ctx.save();
 ctx.font=font;
 const halfWidth=ctx.measureText(label).width/2+2;
 ctx.restore();
 const baseline=point.y-offset;
 return Math.abs(sx-point.x)<=halfWidth&&sy>=baseline-14&&sy<=baseline+3;
}

function isOpaqueIslandPixel({item,left,top},sx,sy){
 const x=sx-left,y=sy-top;
 if(x<0||y<0||x>=item.width||y>=item.height)return false;
 const scene=verifiedTalkingIslandScene;
 let pixels=scene.imagePixels.get(item.image);
 if(!pixels){
  const sheet=document.createElement('canvas');
  sheet.width=item.image.naturalWidth;
  sheet.height=item.image.naturalHeight;
  const sheetContext=sheet.getContext('2d');
  sheetContext.drawImage(item.image,0,0);
  pixels=sheetContext.getImageData(0,0,sheet.width,sheet.height);
  scene.imagePixels.set(item.image,pixels);
 }
 const src=item.sourceRect??{x:0,y:0,width:pixels.width,height:pixels.height};
 const px=src.x+Math.floor(x*src.width/item.width);
 const py=src.y+Math.floor(y*src.height/item.height);
 return pixels.data[(py*pixels.width+px)*4+3]>=128;
}
function advanceVillageTrial(ts){
 const trial=villageTrial;
 if(trial.phase==='dying'&&ts-trial.deathStartedAt>=GOBLIN_DEATH_FRAMES*GOBLIN_FRAME_MS){
  trial.phase='defeated';
  showVillageTrialStatus();
 }
 const movement=verifiedTalkingIslandMovement;
 const {x,y}=movement.position;
 const {x:tx,y:ty}=VILLAGE_TRIAL_ENEMY;
 const atTarget=x===tx&&y===ty;
 if(trial.pickup&&trial.dropAvailable&&atTarget){
  if(verifiedTalkingIslandStepTo&&ts-verifiedTalkingIslandLastStep<VERIFIED_SCENE_STEP_MS)return;
  trial.pickupStartedAt??=ts;
  if(ts-trial.pickupStartedAt<verifiedTalkingIslandScene.pickupSprite[0].frameEnds.at(-1))return;
  trial.pickupStartedAt=null;
  trial.pickup=false;
  trial.dropAvailable=false;
  player.pots++;
  msg('撿起治癒藥水 ×1（測試掉落）');
  update();
 }
 const inRange=atTarget||movement.renderer.canStep(x,y,tx,ty);
 if(trial.phase==='fight'&&trial.provoked&&advanceGoblinAttack(trial,movement,ts,inRange))return;
 if(!trial.target)return;
 if(!inRange)return;
 movement.cancel();
 if(verifiedTalkingIslandStepTo&&ts-verifiedTalkingIslandLastStep<VERIFIED_SCENE_STEP_MS)return;
 if(ts<trial.nextAttack)return;
 movement.face(tx,ty);
 if(!trial.attackPending){
  trial.attackStartedAt=ts;
  trial.attackPending=true;
 }
 const attackConfig=verifiedTalkingIslandScene.attack[0];
 const {frameDuration,frameEnds,impactFrame=4}=attackConfig;
 const impactDelay=frameEnds ? frameEnds[impactFrame-1]??0 : frameDuration*impactFrame;
 if(ts-trial.attackStartedAt<impactDelay)return;
 trial.attackPending=false;
 trial.nextAttack=trial.attackStartedAt+Math.max(700,villageAttackDuration(attackConfig));
 applyVillageGoblinDamage(VILLAGE_TRIAL_DAMAGE,ts,'攻擊哥布林',' 點測試傷害');
}
function applyVillageGoblinDamage(damage,ts,action,suffix){
 const trial=villageTrial;
 if(trial?.phase!=='fight')return;
 trial.hitUntil=ts+360;
 trial.hitDamage=Math.min(trial.hp,damage);
 trial.hp-=trial.hitDamage;
 msg(action+'，造成 '+trial.hitDamage+suffix);
 if(trial.hp>0){
  trial.provoked=true;
  return;
 }
 trial.exp+=GOBLIN.exp;
 if(villageProgress()){
  p03ApplyExperience(GOBLIN.exp);
  trial.dropAvailable=true;
 }
 msg('擊倒哥布林，獲得 EXP '+GOBLIN.exp+'（開發測試）');
 trial.phase='dying';
 trial.deathStartedAt=ts;
 trial.target=null;
 showVillageTrialStatus();
}
function advanceGoblinAttack(trial,movement,ts,inRange){
 if(trial.goblinAttackAt===null){
  if(inRange&&ts>=trial.goblinReadyAt)trial.goblinAttackAt=ts;
  return false;
 }
 if(ts-trial.goblinAttackAt<GOBLIN_ATTACK_FRAME_MS*GOBLIN_ATTACK_FRAMES)return false;
 trial.goblinAttackAt=null;
 trial.goblinReadyAt=ts+900;
 if(!inRange)return false;
 trial.playerHp=Math.max(0,(villageProgress()?player.hp:trial.playerHp)-GOBLIN_DAMAGE);
 if(villageProgress())player.hp=trial.playerHp||player.maxHp;
 a17rRefresh();
 if(trial.playerHp>0){
  msg('哥布林反擊，造成 '+GOBLIN_DAMAGE+' 點測試傷害');
  return false;
 }
 movement.spawn(trial.home.x,trial.home.y);
 activateTalkingIslandScene(verifiedTalkingIslandScene);
 startVillageTrial(verifiedTalkingIslandScene);
 showVillageTrialStatus();
 msg('角色倒下，已回村恢復，可重新挑戰');
 return true;
}
function villageAttackDuration(config){
 return config ? config.frameEnds?.at(-1)??config.columns*config.frameDuration : 0;
}
const GOBLIN_HIT_FRAMES=2;
const GOBLIN_FRAME_MS=75;
const GOBLIN_DEATH_FRAMES=12;
function villageTrialTargetLabel(){
 return '哥布林 '+villageTrial.hp+'/'+villageTrial.maxHp;
}
function villageGoblinFrame(trial,now){
 const hitStart=trial.hitUntil-360;
 const hitElapsed=now-hitStart;
 if(trial.phase==='dying')
  return 9+Math.min(GOBLIN_DEATH_FRAMES-1,Math.floor(Math.max(0,now-trial.deathStartedAt)/GOBLIN_FRAME_MS));
 if(trial.goblinAttackAt!==null)
  return 21+Math.min(GOBLIN_ATTACK_FRAMES-1,Math.floor(Math.max(0,now-trial.goblinAttackAt)/GOBLIN_ATTACK_FRAME_MS));
 if(hitElapsed>=0&&hitElapsed<GOBLIN_HIT_FRAMES*GOBLIN_FRAME_MS)
  return 7+Math.floor(hitElapsed/GOBLIN_FRAME_MS);
 return Math.floor(now/140)%7;
}
function villageTrialActors(now,goblin){
 const trial=villageTrial;
 if(!trial||!goblin||(trial.phase!=='fight'&&trial.phase!=='dying'))return [];
 // The supplied atlas uses 119×93 frames with idle feet at y=80.
 const height=93,width=119,row=villageGoblinFrame(trial,now);
 return [{...VILLAGE_TRIAL_ENEMY,image:goblin,width,height,offsetX:.5,offsetY:13,
  sourceRect:{x:0,y:row*height,width,height}}];
}
function drawVillageTrial(renderer,camera){
 const trial=villageTrial;
 if(trial.phase==='defeated')return;
 const position=VILLAGE_TRIAL_ENEMY;
 const p=renderer.project(position.x,position.y,camera.cameraX,camera.cameraY);
 ctx.save();
 ctx.textAlign='center';
 ctx.font='14px sans-serif';
 ctx.fillStyle='#f8df9e';
 ctx.strokeStyle='#20190e';
 ctx.lineWidth=3;
 const label=villageTrialTargetLabel();
 const labelOffset=36;
 if(trial.phase!=='dying'){
  ctx.strokeText(label,p.x,p.y-labelOffset);
  ctx.fillText(label,p.x,p.y-labelOffset);
 }
 if(performance.now()<trial.hitUntil){
  ctx.fillStyle='#ffe7a8';
  ctx.strokeText('−'+trial.hitDamage,p.x,p.y-55);
  ctx.fillText('−'+trial.hitDamage,p.x,p.y-55);
 }
 ctx.restore();
}
function talkingIslandMode(){
 return localVillageEntered||visualParams.get('historicalMode')==='1';
}
function activateTalkingIslandScene(scene){
 setVillageSpellTargeting(false);
 villageCastPreview=null;
 displayedIslandFrame=null;
 verifiedTalkingIslandScene=scene;
 if(scene?.dummy)scene.previewMp=player?.maxMp??0;
 verifiedTalkingIslandMovement=scene?.movement??null;
 verifiedTalkingIslandLastStep=0;
 verifiedTalkingIslandStepFrom=null;
 verifiedTalkingIslandStepTo=null;
 verifiedTalkingIslandWasMoving=false;
 verifiedTalkingIslandLastScreenFacing=null;
}
const gerengSceneData={"bounds":{"minX":32896,"maxX":33088,"minY":32575,"maxY":32639},"blockedCells":[[32896,32624],[32896,32623],[32897,32623],[32899,32597],[32899,32596],[32900,32596],[32904,32579],[32904,32578],[32905,32582],[32905,32581],[32905,32578],[32906,32634],[32906,32633],[32906,32581],[32907,32633],[32907,32583],[32907,32582],[32908,32582],[32908,32576],[32908,32575],[32909,32577],[32909,32576],[32909,32575],[32910,32634],[32910,32633],[32910,32609],[32910,32608],[32910,32577],[32910,32576],[32910,32575],[32911,32633],[32911,32608],[32911,32578],[32911,32577],[32911,32575],[32912,32578],[32912,32577],[32913,32579],[32913,32578],[32914,32630],[32914,32629],[32914,32618],[32914,32617],[32914,32582],[32914,32581],[32914,32580],[32914,32579],[32914,32578],[32915,32629],[32915,32617],[32915,32609],[32915,32608],[32915,32606],[32915,32605],[32915,32582],[32915,32581],[32915,32580],[32915,32579],[32916,32615],[32916,32614],[32916,32608],[32916,32605],[32916,32581],[32916,32580],[32916,32579],[32917,32638],[32917,32614],[32917,32612],[32917,32611],[32917,32610],[32917,32609],[32917,32608],[32917,32607],[32917,32592],[32917,32591],[32917,32581],[32917,32580],[32917,32579],[32918,32638],[32918,32625],[32918,32624],[32918,32615],[32918,32614],[32918,32613],[32918,32612],[32918,32611],[32918,32607],[32918,32606],[32918,32605],[32918,32603],[32918,32602],[32918,32591],[32918,32581],[32918,32580],[32919,32637],[32919,32636],[32919,32624],[32919,32617],[32919,32616],[32919,32615],[32919,32614],[32919,32613],[32919,32612],[32919,32611],[32919,32608],[32919,32607],[32919,32605],[32919,32604],[32919,32603],[32919,32602],[32919,32584],[32919,32583],[32919,32582],[32919,32581],[32919,32578],[32919,32577],[32919,32576],[32919,32575],[32920,32636],[32920,32620],[32920,32619],[32920,32618],[32920,32617],[32920,32616],[32920,32613],[32920,32611],[32920,32610],[32920,32608],[32920,32607],[32920,32603],[32920,32602],[32920,32601],[32920,32583],[32920,32582],[32920,32581],[32920,32578],[32920,32577],[32920,32576],[32920,32575],[32921,32619],[32921,32618],[32921,32601],[32921,32600],[32921,32599],[32921,32598],[32921,32583],[32921,32582],[32921,32578],[32921,32577],[32921,32576],[32922,32620],[32922,32619],[32922,32618],[32922,32600],[32922,32598],[32922,32583],[32922,32582],[32922,32578],[32922,32577],[32922,32576],[32922,32575],[32923,32637],[32923,32636],[32923,32620],[32923,32619],[32923,32618],[32923,32584],[32923,32583],[32923,32577],[32923,32576],[32923,32575],[32924,32636],[32924,32620],[32924,32619],[32924,32584],[32924,32583],[32925,32637],[32925,32636],[32925,32619],[32925,32610],[32925,32609],[32925,32600],[32925,32583],[32926,32636],[32926,32631],[32926,32630],[32926,32619],[32926,32609],[32926,32601],[32926,32600],[32926,32599],[32926,32598],[32927,32630],[32927,32619],[32927,32618],[32927,32601],[32927,32600],[32927,32598],[32928,32626],[32928,32625],[32928,32618],[32928,32602],[32928,32601],[32929,32625],[32929,32619],[32929,32618],[32929,32617],[32929,32604],[32929,32603],[32929,32602],[32929,32601],[32930,32618],[32930,32617],[32930,32616],[32930,32615],[32930,32604],[32930,32603],[32930,32584],[32930,32583],[32931,32615],[32931,32614],[32931,32613],[32931,32612],[32931,32611],[32931,32610],[32931,32609],[32931,32608],[32931,32606],[32931,32605],[32931,32604],[32931,32585],[32931,32584],[32931,32583],[32932,32615],[32932,32614],[32932,32613],[32932,32612],[32932,32611],[32932,32610],[32932,32609],[32932,32605],[32932,32604],[32932,32585],[32932,32584],[32933,32615],[32933,32614],[32933,32611],[32933,32610],[32933,32609],[32933,32606],[32933,32605],[32933,32585],[32934,32614],[32934,32612],[32934,32611],[32934,32609],[32934,32608],[32934,32607],[32934,32606],[32934,32605],[32934,32585],[32934,32584],[32935,32633],[32935,32632],[32935,32622],[32935,32621],[32935,32614],[32935,32613],[32935,32611],[32935,32610],[32935,32609],[32935,32608],[32935,32607],[32935,32606],[32935,32605],[32935,32584],[32935,32583],[32935,32582],[32936,32632],[32936,32621],[32936,32613],[32936,32610],[32936,32609],[32936,32608],[32936,32606],[32936,32585],[32936,32584],[32936,32582],[32937,32609],[32937,32584],[32937,32583],[32937,32582],[32938,32584],[32938,32583],[32938,32582],[32939,32635],[32939,32634],[32939,32584],[32939,32583],[32940,32634],[32940,32585],[32940,32584],[32941,32601],[32941,32600],[32941,32598],[32941,32597],[32941,32596],[32941,32595],[32941,32594],[32941,32593],[32941,32592],[32941,32591],[32941,32590],[32941,32589],[32941,32588],[32941,32587],[32941,32586],[32941,32585],[32941,32584],[32942,32625],[32942,32624],[32942,32600],[32942,32599],[32942,32598],[32942,32597],[32942,32593],[32942,32592],[32942,32587],[32942,32586],[32942,32585],[32943,32624],[32943,32605],[32943,32604],[32943,32603],[32943,32599],[32943,32598],[32943,32596],[32943,32595],[32943,32592],[32943,32591],[32943,32590],[32943,32589],[32943,32588],[32943,32587],[32943,32586],[32943,32585],[32944,32605],[32944,32604],[32944,32603],[32944,32601],[32944,32600],[32944,32599],[32944,32595],[32944,32592],[32944,32591],[32944,32590],[32944,32589],[32944,32588],[32944,32587],[32944,32586],[32944,32585],[32945,32626],[32945,32625],[32945,32617],[32945,32616],[32945,32604],[32945,32603],[32945,32601],[32945,32600],[32945,32599],[32945,32592],[32945,32591],[32945,32590],[32945,32586],[32945,32585],[32946,32625],[32946,32616],[32946,32604],[32946,32603],[32946,32602],[32946,32601],[32946,32600],[32946,32592],[32946,32591],[32946,32590],[32946,32589],[32946,32588],[32946,32587],[32946,32586],[32946,32585],[32947,32618],[32947,32617],[32947,32605],[32947,32604],[32947,32603],[32947,32591],[32947,32590],[32947,32589],[32947,32588],[32947,32587],[32948,32621],[32948,32620],[32948,32617],[32948,32605],[32948,32604],[32948,32603],[32948,32602],[32948,32579],[32948,32578],[32949,32620],[32949,32605],[32949,32602],[32949,32601],[32949,32600],[32949,32599],[32949,32598],[32949,32578],[32950,32605],[32950,32601],[32950,32600],[32950,32599],[32950,32598],[32950,32597],[32950,32596],[32950,32595],[32950,32594],[32950,32593],[32951,32636],[32951,32635],[32951,32607],[32951,32606],[32951,32605],[32951,32600],[32951,32599],[32951,32598],[32951,32597],[32951,32596],[32951,32595],[32951,32594],[32951,32593],[32951,32580],[32951,32579],[32952,32635],[32952,32610],[32952,32609],[32952,32606],[32952,32605],[32952,32599],[32952,32598],[32952,32597],[32952,32596],[32952,32594],[32952,32593],[32952,32579],[32952,32576],[32952,32575],[32953,32609],[32953,32606],[32953,32605],[32953,32604],[32953,32599],[32953,32598],[32953,32597],[32953,32596],[32953,32593],[32953,32580],[32953,32579],[32953,32575],[32954,32606],[32954,32604],[32954,32600],[32954,32599],[32954,32598],[32954,32597],[32954,32596],[32954,32593],[32954,32579],[32955,32611],[32955,32610],[32955,32600],[32955,32599],[32955,32598],[32955,32597],[32955,32596],[32955,32595],[32955,32594],[32955,32593],[32955,32575],[32956,32610],[32956,32599],[32956,32598],[32956,32597],[32956,32596],[32956,32595],[32956,32594],[32956,32593],[32957,32638],[32957,32627],[32957,32626],[32957,32599],[32957,32598],[32957,32597],[32957,32596],[32957,32595],[32957,32594],[32957,32593],[32958,32638],[32958,32626],[32958,32598],[32958,32597],[32958,32596],[32958,32595],[32958,32594],[32958,32593],[32958,32592],[32958,32591],[32958,32585],[32958,32584],[32959,32594],[32959,32593],[32959,32592],[32959,32591],[32959,32584],[32960,32638],[32960,32637],[32961,32637],[32961,32606],[32961,32605],[32961,32604],[32962,32628],[32962,32627],[32962,32626],[32962,32606],[32962,32604],[32963,32628],[32963,32627],[32963,32626],[32963,32606],[32963,32594],[32963,32593],[32964,32627],[32964,32626],[32964,32606],[32964,32594],[32964,32593],[32964,32592],[32964,32591],[32964,32590],[32964,32589],[32964,32588],[32964,32586],[32964,32575],[32965,32633],[32965,32632],[32965,32606],[32965,32605],[32965,32594],[32965,32593],[32965,32591],[32965,32590],[32965,32589],[32965,32588],[32965,32586],[32965,32585],[32965,32584],[32965,32583],[32965,32582],[32965,32581],[32965,32580],[32965,32579],[32965,32578],[32965,32575],[32966,32632],[32966,32607],[32966,32606],[32966,32605],[32966,32604],[32966,32595],[32966,32594],[32966,32592],[32966,32590],[32966,32589],[32966,32588],[32966,32586],[32966,32584],[32966,32583],[32966,32582],[32966,32581],[32966,32579],[32966,32578],[32967,32606],[32967,32604],[32967,32603],[32967,32594],[32967,32593],[32967,32592],[32967,32591],[32967,32590],[32967,32589],[32967,32588],[32967,32586],[32967,32583],[32967,32582],[32967,32579],[32967,32578],[32967,32575],[32968,32611],[32968,32610],[32968,32603],[32968,32591],[32968,32590],[32968,32589],[32968,32588],[32968,32586],[32968,32583],[32968,32582],[32968,32579],[32968,32578],[32968,32575],[32969,32610],[32969,32606],[32969,32605],[32969,32604],[32969,32603],[32969,32587],[32969,32586],[32969,32583],[32969,32582],[32969,32578],[32969,32577],[32969,32575],[32970,32612],[32970,32611],[32970,32606],[32970,32605],[32970,32604],[32970,32603],[32970,32596],[32970,32595],[32970,32586],[32970,32585],[32970,32584],[32970,32583],[32970,32582],[32970,32581],[32970,32580],[32970,32579],[32970,32578],[32970,32577],[32970,32575],[32971,32611],[32971,32605],[32971,32604],[32971,32603],[32971,32602],[32971,32595],[32971,32582],[32971,32581],[32972,32619],[32972,32618],[32972,32602],[32972,32601],[32972,32581],[32973,32618],[32973,32601],[32973,32600],[32974,32600],[32974,32599],[32975,32625],[32975,32624],[32975,32599],[32975,32598],[32975,32597],[32975,32595],[32975,32594],[32975,32593],[32975,32592],[32975,32591],[32976,32624],[32976,32599],[32976,32597],[32976,32595],[32976,32594],[32976,32593],[32976,32592],[32976,32591],[32977,32599],[32977,32598],[32977,32595],[32977,32594],[32977,32593],[32977,32592],[32977,32591],[32977,32590],[32977,32589],[32977,32588],[32977,32587],[32977,32586],[32978,32598],[32978,32597],[32978,32595],[32978,32594],[32978,32593],[32978,32592],[32978,32591],[32978,32590],[32978,32589],[32978,32588],[32978,32587],[32978,32586],[32978,32583],[32978,32582],[32978,32576],[32978,32575],[32979,32597],[32979,32596],[32979,32594],[32979,32593],[32979,32592],[32979,32591],[32979,32590],[32979,32589],[32979,32588],[32979,32587],[32979,32586],[32979,32582],[32979,32575],[32980,32596],[32980,32595],[32980,32594],[32980,32593],[32980,32592],[32980,32590],[32980,32589],[32980,32588],[32980,32587],[32980,32586],[32980,32585],[32980,32584],[32980,32583],[32980,32575],[32981,32592],[32981,32591],[32981,32589],[32981,32588],[32981,32587],[32981,32586],[32981,32585],[32981,32584],[32982,32591],[32982,32590],[32982,32589],[32982,32588],[32982,32587],[32982,32586],[32982,32585],[32987,32633],[32987,32632],[32988,32632],[32988,32614],[32988,32613],[32988,32601],[32988,32600],[32989,32613],[32989,32600],[32991,32631],[32991,32630],[32991,32613],[32991,32612],[32992,32630],[32992,32612],[32993,32636],[32993,32635],[32993,32614],[32993,32613],[32994,32635],[32994,32613],[32994,32604],[32994,32603],[32995,32603],[32996,32622],[32996,32621],[32996,32614],[32996,32613],[32997,32621],[32997,32613],[32997,32609],[32997,32608],[32997,32594],[32997,32593],[32998,32608],[32998,32597],[32998,32596],[32998,32593],[32998,32590],[32998,32589],[32999,32596],[32999,32589],[33000,32598],[33000,32597],[33001,32597],[33003,32626],[33003,32625],[33004,32625],[33004,32599],[33004,32598],[33005,32632],[33005,32631],[33005,32598],[33006,32631],[33007,32587],[33007,32586],[33008,32634],[33008,32633],[33008,32586],[33009,32633],[33010,32603],[33010,32602],[33011,32618],[33011,32617],[33011,32613],[33011,32612],[33011,32602],[33012,32617],[33012,32612],[33013,32637],[33013,32636],[33013,32630],[33013,32629],[33014,32636],[33014,32629],[33014,32592],[33014,32591],[33015,32638],[33015,32637],[33015,32620],[33015,32619],[33015,32591],[33016,32637],[33016,32619],[33016,32599],[33016,32598],[33017,32598],[33019,32633],[33019,32632],[33019,32619],[33019,32618],[33020,32632],[33020,32618],[33021,32603],[33021,32602],[33022,32602],[33030,32635],[33030,32634],[33030,32619],[33030,32618],[33030,32601],[33030,32600],[33030,32597],[33030,32596],[33031,32634],[33031,32618],[33031,32600],[33031,32596],[33033,32602],[33033,32601],[33034,32601],[33036,32579],[33036,32578],[33037,32578],[33038,32625],[33038,32624],[33039,32624],[33039,32594],[33039,32593],[33040,32620],[33040,32619],[33040,32593],[33041,32619],[33041,32612],[33041,32611],[33042,32611],[33042,32581],[33042,32580],[33043,32580],[33044,32620],[33044,32619],[33044,32618],[33044,32597],[33044,32596],[33044,32584],[33044,32583],[33045,32620],[33045,32619],[33045,32618],[33045,32596],[33045,32583],[33046,32619],[33046,32618],[33048,32612],[33048,32611],[33048,32610],[33049,32627],[33049,32626],[33049,32614],[33049,32613],[33049,32612],[33049,32611],[33049,32610],[33050,32626],[33050,32613],[33050,32611],[33050,32610],[33051,32632],[33051,32631],[33051,32611],[33051,32610],[33052,32631],[33052,32610],[33053,32581],[33053,32580],[33054,32599],[33054,32598],[33054,32580],[33055,32598],[33057,32635],[33057,32634],[33057,32605],[33057,32604],[33058,32634],[33058,32604],[33058,32584],[33058,32583],[33059,32583],[33059,32575],[33061,32627],[33061,32626],[33062,32626],[33062,32609],[33062,32608],[33063,32615],[33063,32614],[33063,32608],[33064,32614],[33067,32631],[33067,32630],[33068,32630],[33071,32637],[33071,32636],[33072,32636],[33073,32601],[33073,32600],[33073,32589],[33073,32588],[33074,32626],[33074,32625],[33074,32600],[33074,32588],[33075,32625],[33076,32609],[33076,32608],[33076,32603],[33076,32602],[33077,32623],[33077,32622],[33077,32608],[33077,32602],[33078,32622],[33079,32593],[33080,32633],[33080,32632],[33080,32593],[33080,32592],[33080,32591],[33080,32590],[33080,32589],[33080,32588],[33080,32587],[33080,32586],[33080,32585],[33081,32632],[33081,32593],[33081,32592],[33081,32591],[33081,32590],[33081,32589],[33081,32588],[33081,32587],[33081,32586],[33081,32585],[33081,32575],[33082,32593],[33082,32586],[33082,32585],[33082,32575],[33083,32593],[33083,32590],[33083,32589],[33083,32588],[33083,32586],[33083,32585],[33083,32583],[33083,32582],[33084,32596],[33084,32595],[33084,32593],[33084,32589],[33084,32588],[33084,32586],[33084,32585],[33084,32582],[33085,32595],[33085,32593],[33085,32592],[33085,32590],[33085,32589],[33085,32588],[33085,32587],[33085,32586],[33085,32585],[33085,32584],[33086,32588],[33086,32587],[33086,32586],[33087,32588],[33087,32587],[33087,32586]],"spawn":{"x":32945,"y":32575},"npc":{"x":33082,"y":32589,"uri":"./assets/bea8f6beb2965bb60ef4.png"},"roofCells":[[33080,32592],[33081,32592],[33082,32592],[33083,32592],[33084,32592],[33084,32591],[33084,32590],[33084,32589],[33084,32588],[33084,32587],[33084,32586],[33084,32585],[33083,32585],[33082,32585],[33081,32585],[33080,32585],[33080,32586],[33080,32587],[33080,32588],[33080,32589],[33080,32590],[33080,32591],[33081,32591],[33082,32591],[33083,32591],[33083,32590],[33083,32589],[33083,32588],[33083,32587],[33083,32586],[33082,32586],[33081,32586],[33081,32587],[33081,32588],[33081,32589],[33081,32590],[33082,32590],[33082,32589],[33082,32588],[33082,32587]],"ground":{"x":32945,"y":32575,"width":6144,"height":3071,"offsetX":360.0,"offsetY":2471,"uri":"./assets/e65ba2f27667039cc45d.webp"},"roof":{"x":32945,"y":32575,"width":349,"height":287,"offsetX":2963.5,"offsetY":1888,"uri":"./assets/61e1dfacb23f56cf97bf.webp"}};
async function prepareGerengScene(loadSprite){
 const data=gerengSceneData;
 const [ground,roof,teacher,[spriteConfig,actor]]=await Promise.all([
  verifiedImageLoader(data.ground.uri),verifiedImageLoader(data.roof.uri),
  verifiedImageLoader(data.npc.uri),loadSprite('atlas')
 ]);
 const {uri:groundUri,...groundPlacement}=data.ground;
 const {uri:roofUri,...roofPlacement}=data.roof;
 const renderer=new TalkingIslandLayerRenderer(canvas,{tileWidth:48,tileHeight:24});
 renderer.setScene({bounds:data.bounds,layers:[{id:'ground',depth:0,images:[{...groundPlacement,image:ground}]}]});
 renderer.setCollision(data);
 const movement=new TalkingIslandMovementController(renderer,{maxNodes:12288});
 const spawn=(gerengTestMode||magicTestMode)?{x:data.npc.x,y:data.npc.y+1}:data.spawn;
 movement.spawn(spawn.x,spawn.y);
 return {renderer,movement,actor,spriteConfig,
  teacher:{x:data.npc.x,y:data.npc.y,image:teacher,width:29,height:55},
  roof:{...roofPlacement,image:roof,depth:2},
  roofCells:new Set(data.roofCells.map(cell=>cell.join(','))),
  imagePixels:new Map()};
}
async function prepareLocalVillage(spriteBase,trial){
 const localData={"village-scene.json":{"source":"L1Justice client, map/0","bounds":{"minX":32928,"minY":32560,"maxX":32960,"maxY":32592},"blockedCells":[[32938,32591],[32939,32591],[32940,32591],[32943,32591],[32944,32591],[32945,32591],[32946,32591],[32938,32590],[32939,32590],[32943,32590],[32944,32590],[32945,32590],[32946,32590],[32947,32590],[32948,32590],[32938,32589],[32943,32589],[32944,32589],[32945,32589],[32946,32589],[32947,32589],[32948,32589],[32938,32588],[32943,32588],[32944,32588],[32945,32588],[32946,32588],[32947,32588],[32948,32588],[32938,32587],[32943,32587],[32944,32587],[32945,32587],[32946,32587],[32947,32587],[32948,32587],[32931,32586],[32938,32586],[32943,32586],[32944,32586],[32945,32586],[32946,32586],[32947,32586],[32948,32586],[32936,32585],[32937,32585],[32938,32585],[32930,32584],[32931,32584],[32932,32584],[32933,32584],[32934,32584],[32935,32584],[32936,32584],[32937,32584],[32930,32583],[32931,32583],[32932,32583],[32930,32582],[32931,32582],[32932,32582],[32953,32582],[32950,32581],[32951,32581],[32952,32581],[32948,32580],[32951,32580],[32952,32580],[32953,32580],[32948,32579],[32949,32576],[32950,32576],[32951,32576],[32952,32576],[32949,32575],[32950,32575],[32951,32575],[32952,32575],[32953,32575],[32949,32574],[32950,32574],[32951,32574],[32949,32573],[32950,32573],[32951,32573],[32935,32567],[32933,32562],[32941,32562],[32942,32562],[32959,32562],[32929,32561],[32930,32561],[32931,32561],[32932,32561],[32933,32561],[32935,32561],[32954,32561],[32956,32561],[32957,32561],[32928,32560],[32929,32560],[32930,32560],[32931,32560],[32933,32560],[32934,32560],[32935,32560],[32952,32560],[32953,32560],[32954,32560],[32956,32560],[32957,32560],[32958,32560],[32959,32560]],"blockedEdges":[[32938,32591,32937,32591],[32938,32591,32938,32590],[32939,32591,32938,32591],[32939,32591,32939,32590],[32940,32591,32939,32591],[32940,32591,32940,32590],[32941,32591,32940,32591],[32943,32591,32942,32591],[32943,32591,32943,32590],[32944,32591,32943,32591],[32944,32591,32944,32590],[32945,32591,32944,32591],[32945,32591,32945,32590],[32946,32591,32945,32591],[32946,32591,32946,32590],[32947,32591,32946,32591],[32947,32591,32947,32590],[32948,32591,32948,32590],[32938,32590,32937,32590],[32938,32590,32938,32589],[32939,32590,32938,32590],[32939,32590,32939,32589],[32940,32590,32939,32590],[32943,32590,32942,32590],[32943,32590,32943,32589],[32944,32590,32943,32590],[32944,32590,32944,32589],[32945,32590,32944,32590],[32945,32590,32945,32589],[32946,32590,32945,32590],[32946,32590,32946,32589],[32947,32590,32946,32590],[32947,32590,32947,32589],[32948,32590,32947,32590],[32948,32590,32948,32589],[32949,32590,32948,32590],[32938,32589,32937,32589],[32938,32589,32938,32588],[32939,32589,32938,32589],[32943,32589,32942,32589],[32943,32589,32943,32588],[32944,32589,32943,32589],[32944,32589,32944,32588],[32945,32589,32944,32589],[32945,32589,32945,32588],[32946,32589,32945,32589],[32946,32589,32946,32588],[32947,32589,32946,32589],[32947,32589,32947,32588],[32948,32589,32947,32589],[32948,32589,32948,32588],[32949,32589,32948,32589],[32938,32588,32937,32588],[32938,32588,32938,32587],[32939,32588,32938,32588],[32943,32588,32942,32588],[32943,32588,32943,32587],[32944,32588,32943,32588],[32944,32588,32944,32587],[32945,32588,32944,32588],[32945,32588,32945,32587],[32946,32588,32945,32588],[32946,32588,32946,32587],[32947,32588,32946,32588],[32947,32588,32947,32587],[32948,32588,32947,32588],[32948,32588,32948,32587],[32949,32588,32948,32588],[32931,32587,32931,32586],[32938,32587,32937,32587],[32938,32587,32938,32586],[32939,32587,32938,32587],[32943,32587,32942,32587],[32943,32587,32943,32586],[32944,32587,32943,32587],[32944,32587,32944,32586],[32945,32587,32944,32587],[32945,32587,32945,32586],[32946,32587,32945,32587],[32946,32587,32946,32586],[32947,32587,32946,32587],[32947,32587,32947,32586],[32948,32587,32947,32587],[32948,32587,32948,32586],[32949,32587,32948,32587],[32931,32586,32930,32586],[32931,32586,32931,32585],[32932,32586,32931,32586],[32936,32586,32936,32585],[32937,32586,32937,32585],[32938,32586,32937,32586],[32938,32586,32938,32585],[32939,32586,32938,32586],[32943,32586,32942,32586],[32943,32586,32943,32585],[32944,32586,32943,32586],[32944,32586,32944,32585],[32945,32586,32944,32586],[32945,32586,32945,32585],[32946,32586,32945,32586],[32946,32586,32946,32585],[32947,32586,32946,32586],[32947,32586,32947,32585],[32948,32586,32947,32586],[32948,32586,32948,32585],[32949,32586,32948,32586],[32930,32585,32930,32584],[32931,32585,32931,32584],[32932,32585,32932,32584],[32933,32585,32933,32584],[32934,32585,32934,32584],[32935,32585,32935,32584],[32936,32585,32935,32585],[32936,32585,32936,32584],[32937,32585,32936,32585],[32937,32585,32937,32584],[32938,32585,32937,32585],[32938,32585,32938,32584],[32939,32585,32938,32585],[32930,32584,32929,32584],[32930,32584,32930,32583],[32931,32584,32930,32584],[32931,32584,32931,32583],[32932,32584,32931,32584],[32932,32584,32932,32583],[32933,32584,32932,32584],[32933,32584,32933,32583],[32934,32584,32933,32584],[32934,32584,32934,32583],[32935,32584,32934,32584],[32935,32584,32935,32583],[32936,32584,32935,32584],[32936,32584,32936,32583],[32937,32584,32936,32584],[32937,32584,32937,32583],[32938,32584,32937,32584],[32930,32583,32929,32583],[32930,32583,32930,32582],[32931,32583,32930,32583],[32931,32583,32931,32582],[32932,32583,32931,32583],[32932,32583,32932,32582],[32933,32583,32932,32583],[32953,32583,32953,32582],[32930,32582,32929,32582],[32930,32582,32930,32581],[32931,32582,32930,32582],[32931,32582,32931,32581],[32932,32582,32931,32582],[32932,32582,32932,32581],[32933,32582,32932,32582],[32950,32582,32950,32581],[32951,32582,32951,32581],[32952,32582,32952,32581],[32953,32582,32952,32582],[32953,32582,32953,32581],[32954,32582,32953,32582],[32948,32581,32948,32580],[32950,32581,32949,32581],[32950,32581,32950,32580],[32951,32581,32950,32581],[32951,32581,32951,32580],[32952,32581,32951,32581],[32952,32581,32952,32580],[32953,32581,32952,32581],[32953,32581,32953,32580],[32948,32580,32947,32580],[32948,32580,32948,32579],[32949,32580,32948,32580],[32951,32580,32950,32580],[32951,32580,32951,32579],[32952,32580,32951,32580],[32952,32580,32952,32579],[32953,32580,32952,32580],[32953,32580,32953,32579],[32954,32580,32953,32580],[32948,32579,32947,32579],[32948,32579,32948,32578],[32949,32579,32948,32579],[32949,32577,32949,32576],[32950,32577,32950,32576],[32951,32577,32951,32576],[32952,32577,32952,32576],[32949,32576,32948,32576],[32949,32576,32949,32575],[32950,32576,32949,32576],[32950,32576,32950,32575],[32951,32576,32950,32576],[32951,32576,32951,32575],[32952,32576,32951,32576],[32952,32576,32952,32575],[32953,32576,32952,32576],[32953,32576,32953,32575],[32949,32575,32948,32575],[32949,32575,32949,32574],[32950,32575,32949,32575],[32950,32575,32950,32574],[32951,32575,32950,32575],[32951,32575,32951,32574],[32952,32575,32951,32575],[32952,32575,32952,32574],[32953,32575,32952,32575],[32953,32575,32953,32574],[32954,32575,32953,32575],[32949,32574,32948,32574],[32949,32574,32949,32573],[32950,32574,32949,32574],[32950,32574,32950,32573],[32951,32574,32950,32574],[32951,32574,32951,32573],[32952,32574,32951,32574],[32949,32573,32948,32573],[32949,32573,32949,32572],[32950,32573,32949,32573],[32950,32573,32950,32572],[32951,32573,32950,32573],[32951,32573,32951,32572],[32952,32573,32951,32573],[32935,32568,32935,32567],[32935,32567,32934,32567],[32935,32567,32935,32566],[32936,32567,32935,32567],[32933,32563,32933,32562],[32941,32563,32941,32562],[32942,32563,32942,32562],[32959,32563,32959,32562],[32929,32562,32929,32561],[32930,32562,32930,32561],[32931,32562,32931,32561],[32932,32562,32932,32561],[32933,32562,32932,32562],[32933,32562,32933,32561],[32934,32562,32933,32562],[32935,32562,32935,32561],[32941,32562,32940,32562],[32941,32562,32941,32561],[32942,32562,32941,32562],[32942,32562,32942,32561],[32943,32562,32942,32562],[32954,32562,32954,32561],[32956,32562,32956,32561],[32957,32562,32957,32561],[32959,32562,32958,32562],[32959,32562,32959,32561],[32928,32561,32928,32560],[32929,32561,32928,32561],[32929,32561,32929,32560],[32930,32561,32929,32561],[32930,32561,32930,32560],[32931,32561,32930,32561],[32931,32561,32931,32560],[32932,32561,32931,32561],[32932,32561,32932,32560],[32933,32561,32932,32561],[32933,32561,32933,32560],[32934,32561,32933,32561],[32934,32561,32934,32560],[32935,32561,32934,32561],[32935,32561,32935,32560],[32936,32561,32935,32561],[32952,32561,32952,32560],[32953,32561,32953,32560],[32954,32561,32953,32561],[32954,32561,32954,32560],[32955,32561,32954,32561],[32956,32561,32955,32561],[32956,32561,32956,32560],[32957,32561,32956,32561],[32957,32561,32957,32560],[32958,32561,32957,32561],[32958,32561,32958,32560],[32959,32561,32959,32560],[32929,32560,32928,32560],[32930,32560,32929,32560],[32931,32560,32930,32560],[32932,32560,32931,32560],[32933,32560,32932,32560],[32934,32560,32933,32560],[32935,32560,32934,32560],[32936,32560,32935,32560],[32952,32560,32951,32560],[32953,32560,32952,32560],[32954,32560,32953,32560],[32955,32560,32954,32560],[32956,32560,32955,32560],[32957,32560,32956,32560],[32958,32560,32957,32560],[32959,32560,32958,32560]],"spawn":{"x":32945,"y":32575},"tileSize":{"width":48,"height":24},"imagePlacement":{"x":32959,"y":32560,"width":1536,"height":876,"offsetX":-744.0,"offsetY":384.0},"objects":[{"x":32953.197916666664,"y":32580.21875,"width":25,"height":29,"footY":65533,"sourceRect":{"x":0,"y":0,"width":25,"height":29}},{"x":32948.239583333336,"y":32579.260416666668,"width":25,"height":26,"footY":65527,"sourceRect":{"x":0,"y":29,"width":25,"height":26}},{"x":32950.25,"y":32581.416666666668,"width":28,"height":20,"footY":65531,"sourceRect":{"x":0,"y":55,"width":28,"height":20}},{"x":32953.458333333336,"y":32582.291666666668,"width":28,"height":20,"footY":65535,"sourceRect":{"x":0,"y":75,"width":28,"height":20}},{"x":32938.052083333336,"y":32591.947916666668,"width":59,"height":46,"footY":65530,"sourceRect":{"x":0,"y":95,"width":59,"height":46}},{"x":32939.114583333336,"y":32590.802083333332,"width":105,"height":79,"footY":65530,"sourceRect":{"x":0,"y":141,"width":105,"height":79}},{"x":32939.0625,"y":32587.770833333332,"width":112,"height":83,"footY":65527,"sourceRect":{"x":0,"y":220,"width":112,"height":83}},{"x":32938.59375,"y":32586.072916666668,"width":57,"height":87,"footY":65525,"sourceRect":{"x":0,"y":303,"width":57,"height":87}},{"x":32935.8125,"y":32585.1875,"width":104,"height":76,"footY":65521,"sourceRect":{"x":0,"y":390,"width":104,"height":76}},{"x":32932.8125,"y":32585.104166666668,"width":98,"height":78,"footY":65518,"sourceRect":{"x":0,"y":466,"width":98,"height":78}},{"x":32930.666666666664,"y":32584.666666666668,"width":62,"height":78,"footY":65516,"sourceRect":{"x":0,"y":544,"width":62,"height":78}},{"x":32952.270833333336,"y":32581.395833333332,"width":86,"height":83,"footY":65534,"sourceRect":{"x":0,"y":622,"width":86,"height":83}},{"x":32948.864583333336,"y":32587.46875,"width":69,"height":39,"footY":65536,"sourceRect":{"x":0,"y":705,"width":69,"height":39}},{"x":32948.0625,"y":32586.604166666668,"width":66,"height":40,"footY":65534,"sourceRect":{"x":0,"y":744,"width":66,"height":40}},{"x":32959.895833333336,"y":32577.354166666668,"width":40,"height":58,"footY":65537,"sourceRect":{"x":0,"y":784,"width":40,"height":58}},{"x":32939.260416666664,"y":32591.322916666668,"width":25,"height":25,"footY":65530,"sourceRect":{"x":0,"y":842,"width":25,"height":25}},{"x":32939.208333333336,"y":32590.291666666668,"width":32,"height":31,"footY":65529,"sourceRect":{"x":0,"y":867,"width":32,"height":31}},{"x":32940.208333333336,"y":32591.208333333332,"width":40,"height":30,"footY":65531,"sourceRect":{"x":0,"y":898,"width":40,"height":30}},{"x":32930.875,"y":32586.125,"width":24,"height":42,"footY":65517,"sourceRect":{"x":0,"y":928,"width":24,"height":42}},{"x":32947.875,"y":32580.125,"width":24,"height":42,"footY":65528,"sourceRect":{"x":0,"y":970,"width":24,"height":42}},{"x":32956.854166666664,"y":32585.729166666668,"width":74,"height":54,"footY":65543,"sourceRect":{"x":0,"y":1012,"width":74,"height":54}},{"x":32935.510416666664,"y":32577.822916666668,"width":75,"height":39,"footY":65514,"sourceRect":{"x":0,"y":1066,"width":75,"height":39}},{"x":32928.614583333336,"y":32589.71875,"width":65,"height":36,"footY":65519,"sourceRect":{"x":0,"y":1105,"width":65,"height":36}},{"x":32951.625,"y":32575.625,"width":252,"height":253,"footY":65527,"sourceRect":{"x":0,"y":1141,"width":252,"height":253}},{"x":32953.822916666664,"y":32576.260416666668,"width":95,"height":95,"footY":65530,"sourceRect":{"x":0,"y":1394,"width":95,"height":95}},{"x":32952.385416666664,"y":32576.53125,"width":33,"height":38,"footY":65529,"sourceRect":{"x":0,"y":1489,"width":33,"height":38}},{"x":32931.979166666664,"y":32583.020833333332,"width":150,"height":145,"footY":65515,"sourceRect":{"x":0,"y":1527,"width":150,"height":145}},{"x":32930.145833333336,"y":32583.020833333332,"width":104,"height":86,"footY":65513,"sourceRect":{"x":0,"y":1672,"width":104,"height":86}},{"x":32932.927083333336,"y":32583.072916666668,"width":65,"height":61,"footY":65516,"sourceRect":{"x":0,"y":1758,"width":65,"height":61}},{"x":32937.25,"y":32589.416666666668,"width":160,"height":222,"footY":65527,"sourceRect":{"x":0,"y":1819,"width":160,"height":222}},{"x":32936.6875,"y":32586.8125,"width":58,"height":68,"footY":65524,"sourceRect":{"x":0,"y":2041,"width":58,"height":68}},{"x":32951.90625,"y":32594.010416666668,"width":253,"height":144,"footY":65545,"sourceRect":{"x":0,"y":2109,"width":253,"height":144}},{"x":32959.833333333336,"y":32586.583333333332,"width":34,"height":46,"footY":65546,"sourceRect":{"x":0,"y":2253,"width":34,"height":46}},{"x":32949.416666666664,"y":32590.5,"width":44,"height":26,"footY":65540,"sourceRect":{"x":0,"y":2299,"width":44,"height":26}},{"x":32949.71875,"y":32589.03125,"width":55,"height":41,"footY":65539,"sourceRect":{"x":0,"y":2325,"width":55,"height":41}},{"x":32929.677083333336,"y":32591.65625,"width":97,"height":67,"footY":65521,"sourceRect":{"x":0,"y":2366,"width":97,"height":67}},{"x":32947.21875,"y":32591.697916666668,"width":253,"height":244,"footY":65538,"sourceRect":{"x":0,"y":2433,"width":253,"height":244}},{"x":32947.614583333336,"y":32591.71875,"width":259,"height":71,"footY":65539,"sourceRect":{"x":0,"y":2677,"width":259,"height":71}},{"x":32934.875,"y":32567.125,"width":24,"height":42,"footY":65502,"sourceRect":{"x":0,"y":2748,"width":24,"height":42}},{"x":32956.9375,"y":32561.479166666668,"width":188,"height":89,"footY":65519,"sourceRect":{"x":0,"y":2790,"width":188,"height":89}},{"x":32955.25,"y":32560.0,"width":32,"height":18,"footY":65515,"sourceRect":{"x":0,"y":2879,"width":32,"height":18}},{"x":32951.71875,"y":32560.28125,"width":41,"height":19,"footY":65512,"sourceRect":{"x":0,"y":2897,"width":41,"height":19}},{"x":32961.59375,"y":32568.322916666668,"width":203,"height":102,"footY":65529,"sourceRect":{"x":0,"y":2916,"width":203,"height":102}},{"x":32961.90625,"y":32568.427083333332,"width":241,"height":125,"footY":65530,"sourceRect":{"x":0,"y":3018,"width":241,"height":125}},{"x":32958.875,"y":32562.125,"width":24,"height":42,"footY":65521,"sourceRect":{"x":0,"y":3143,"width":24,"height":42}},{"x":32958.510416666664,"y":32571.822916666668,"width":75,"height":39,"footY":65531,"sourceRect":{"x":0,"y":3185,"width":75,"height":39}},{"x":32957.25,"y":32561.416666666668,"width":38,"height":47,"footY":65518,"sourceRect":{"x":0,"y":3224,"width":38,"height":47}},{"x":32932.958333333336,"y":32561.708333333332,"width":184,"height":92,"footY":65495,"sourceRect":{"x":0,"y":3271,"width":184,"height":92}},{"x":32927.864583333336,"y":32560.302083333332,"width":25,"height":14,"footY":65489,"sourceRect":{"x":0,"y":3363,"width":25,"height":14}},{"x":32928.0625,"y":32559.9375,"width":26,"height":12,"footY":65488,"sourceRect":{"x":0,"y":3377,"width":26,"height":12}},{"x":32935.520833333336,"y":32560.145833333332,"width":46,"height":23,"footY":65496,"sourceRect":{"x":0,"y":3389,"width":46,"height":23}},{"x":32935.208333333336,"y":32561.291666666668,"width":32,"height":31,"footY":65496,"sourceRect":{"x":0,"y":3412,"width":32,"height":31}},{"x":32933.166666666664,"y":32561.25,"width":38,"height":25,"footY":65494,"sourceRect":{"x":0,"y":3443,"width":38,"height":25}},{"x":32956.729166666664,"y":32562.1875,"width":254,"height":118,"footY":65519,"sourceRect":{"x":0,"y":3468,"width":254,"height":118}},{"x":32933.020833333336,"y":32562.729166666668,"width":240,"height":105,"footY":65496,"sourceRect":{"x":0,"y":3586,"width":240,"height":105}},{"x":32947.416666666664,"y":32574.5,"width":40,"height":46,"footY":65522,"sourceRect":{"x":0,"y":3691,"width":40,"height":46}},{"x":32951.4375,"y":32572.479166666668,"width":48,"height":49,"footY":65524,"sourceRect":{"x":0,"y":3737,"width":48,"height":49}},{"x":32952.385416666664,"y":32573.53125,"width":33,"height":38,"footY":65526,"sourceRect":{"x":0,"y":3786,"width":33,"height":38}},{"x":32933.520833333336,"y":32562.645833333332,"width":52,"height":34,"footY":65496,"sourceRect":{"x":0,"y":3824,"width":52,"height":34}},{"x":32941.020833333336,"y":32563.145833333332,"width":92,"height":96,"footY":65504,"sourceRect":{"x":0,"y":3858,"width":92,"height":96}},{"x":32942.395833333336,"y":32562.520833333332,"width":40,"height":29,"footY":65505,"sourceRect":{"x":0,"y":3954,"width":40,"height":29}},{"x":32928.59375,"y":32561.65625,"width":59,"height":39,"footY":65491,"sourceRect":{"x":0,"y":3983,"width":59,"height":39}},{"x":32952.302083333336,"y":32560.197916666668,"width":35,"height":22,"footY":65512,"sourceRect":{"x":0,"y":4022,"width":35,"height":22}},{"x":32931.197916666664,"y":32560.552083333332,"width":53,"height":35,"footY":65492,"sourceRect":{"x":0,"y":4044,"width":53,"height":35}},{"x":32932.739583333336,"y":32559.510416666668,"width":1,"height":1,"footY":65493,"sourceRect":{"x":0,"y":4079,"width":1,"height":1}}]},"knight-atlas.json":{"columns":5,"directions":["NE","NW","N","E","SE","S","SW","W"],"frameDuration":65,"walkStartsAt":1,"drawHeight":73,"footAnchorY":0.8082191780821918},"knight-attack.json":{"columns":6,"directions":["NE","NW","N","E","SE","S","SW","W"],"frameDuration":58,"drawHeight":128,"footAnchorY":0.75},"knight-female-atlas.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"drawHeight":132,"footAnchorY":0.6666666666666666,"walkStartsAt":1},"knight-female-attack.json":{"columns":4,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":58,"drawHeight":132,"footAnchorY":0.6666666666666666,"impactFrame":3},"royal-male-atlas.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"walkStartsAt":1,"drawHeight":116,"footAnchorY":0.7586206896551724},"royal-female-atlas.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"walkStartsAt":1,"drawHeight":116,"footAnchorY":0.7586206896551724},"elf-male-atlas.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"walkStartsAt":1,"drawHeight":116,"footAnchorY":0.7586206896551724},"elf-female-atlas.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"walkStartsAt":1,"drawHeight":116,"footAnchorY":0.7586206896551724},"wizard-male-atlas.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"walkStartsAt":1,"drawHeight":116,"footAnchorY":0.7586206896551724},"wizard-female-atlas.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"walkStartsAt":1,"drawHeight":116,"footAnchorY":0.7586206896551724},"royal-male-attack.json":{"columns":4,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":58,"impactFrame":3,"drawHeight":132,"footAnchorY":0.6666666666666666},"royal-female-attack.json":{"columns":4,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":58,"impactFrame":3,"drawHeight":132,"footAnchorY":0.6666666666666666},"elf-male-attack.json":{"columns":4,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":58,"impactFrame":3,"drawHeight":132,"footAnchorY":0.6666666666666666},"elf-female-attack.json":{"columns":4,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":58,"impactFrame":3,"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-male-attack.json":{"columns":5,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"frameEnds":[167,333,625,750,1000],"impactFrame":4,"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-female-attack.json":{"columns":6,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"frameEnds":[167,333,542,625,875,1042],"impactFrame":4,"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-male-cast-direction.json":{"columns":8,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"frameEnds":[167,333,583,1042,1167,1292,1417,1708],"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-male-cast-no-direction.json":{"columns":8,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"frameEnds":[167,333,583,1083,1208,1333,1708,2000],"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-female-cast-direction.json":{"columns":9,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"frameEnds":[167,375,542,792,917,1042,1292,1458,1667],"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-female-cast-no-direction.json":{"columns":10,"directions":["NW","N","NE","E","SE","S","SW","W"],"frameDuration":42,"frameEnds":[167,375,542,792,1000,1167,1292,1583,1750,1958],"drawHeight":132,"footAnchorY":0.6666666666666666},"knight-female-pickup.json":{"columns":3,"frameEnds":[167,667,833],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"knight-pickup.json":{"columns":3,"frameEnds":[167,667,833],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"royal-male-pickup.json":{"columns":3,"frameEnds":[167,667,833],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"royal-female-pickup.json":{"columns":3,"frameEnds":[167,667,833],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"elf-male-pickup.json":{"columns":3,"frameEnds":[167,417,542],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"elf-female-pickup.json":{"columns":3,"frameEnds":[167,667,833],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-male-pickup.json":{"columns":3,"frameEnds":[167,500,667],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"wizard-female-pickup.json":{"columns":3,"frameEnds":[167,500,667],"directions":["NW","N","NE","E","SE","S","SW","W"],"drawHeight":132,"footAnchorY":0.6666666666666666},"shop-scene.json":{"source":"L1Justice client, map/0","bounds":{"minX":32928,"minY":32560,"maxX":32960,"maxY":32612},"blockedCells":[[32955,32611],[32933,32610],[32952,32610],[32951,32607],[32955,32607],[32947,32606],[32948,32606],[32949,32606],[32950,32606],[32951,32606],[32952,32606],[32953,32606],[32954,32606],[32944,32605],[32946,32605],[32947,32605],[32954,32605],[32946,32604],[32946,32603],[32948,32603],[32946,32602],[32941,32601],[32944,32601],[32945,32601],[32943,32600],[32944,32600],[32945,32600],[32952,32600],[32953,32600],[32954,32600],[32942,32599],[32943,32599],[32950,32599],[32951,32599],[32952,32599],[32953,32599],[32954,32599],[32955,32599],[32956,32599],[32957,32599],[32941,32598],[32942,32598],[32950,32598],[32951,32598],[32952,32598],[32953,32598],[32954,32598],[32955,32598],[32956,32598],[32957,32598],[32939,32597],[32941,32597],[32950,32597],[32951,32597],[32952,32597],[32953,32597],[32954,32597],[32955,32597],[32956,32597],[32957,32597],[32939,32596],[32940,32596],[32941,32596],[32943,32596],[32950,32596],[32951,32596],[32952,32596],[32953,32596],[32954,32596],[32955,32596],[32956,32596],[32957,32596],[32931,32595],[32938,32595],[32939,32595],[32950,32595],[32951,32595],[32952,32595],[32953,32595],[32954,32595],[32955,32595],[32956,32595],[32957,32595],[32938,32594],[32939,32594],[32940,32594],[32941,32594],[32950,32594],[32951,32594],[32952,32594],[32953,32594],[32954,32594],[32955,32594],[32956,32594],[32957,32594],[32938,32593],[32939,32593],[32940,32593],[32941,32593],[32943,32593],[32944,32593],[32945,32593],[32946,32593],[32938,32592],[32939,32592],[32940,32592],[32943,32592],[32944,32592],[32945,32592],[32946,32592],[32938,32591],[32939,32591],[32940,32591],[32943,32591],[32944,32591],[32945,32591],[32946,32591],[32938,32590],[32939,32590],[32943,32590],[32944,32590],[32945,32590],[32946,32590],[32947,32590],[32948,32590],[32938,32589],[32943,32589],[32944,32589],[32945,32589],[32946,32589],[32947,32589],[32948,32589],[32938,32588],[32943,32588],[32944,32588],[32945,32588],[32946,32588],[32947,32588],[32948,32588],[32938,32587],[32943,32587],[32944,32587],[32945,32587],[32946,32587],[32947,32587],[32948,32587],[32931,32586],[32938,32586],[32943,32586],[32944,32586],[32945,32586],[32946,32586],[32947,32586],[32948,32586],[32936,32585],[32937,32585],[32938,32585],[32930,32584],[32931,32584],[32932,32584],[32933,32584],[32934,32584],[32935,32584],[32936,32584],[32937,32584],[32930,32583],[32931,32583],[32932,32583],[32930,32582],[32931,32582],[32932,32582],[32953,32582],[32950,32581],[32951,32581],[32952,32581],[32948,32580],[32951,32580],[32952,32580],[32953,32580],[32948,32579],[32949,32576],[32950,32576],[32951,32576],[32952,32576],[32949,32575],[32950,32575],[32951,32575],[32952,32575],[32953,32575],[32949,32574],[32950,32574],[32951,32574],[32949,32573],[32950,32573],[32951,32573],[32935,32567],[32933,32562],[32941,32562],[32942,32562],[32959,32562],[32929,32561],[32930,32561],[32931,32561],[32932,32561],[32933,32561],[32935,32561],[32954,32561],[32956,32561],[32957,32561],[32928,32560],[32929,32560],[32930,32560],[32931,32560],[32933,32560],[32934,32560],[32935,32560],[32952,32560],[32953,32560],[32954,32560],[32956,32560],[32957,32560],[32958,32560],[32959,32560]],"blockedEdges":[[32933,32611,32933,32610],[32952,32611,32952,32610],[32955,32611,32954,32611],[32955,32611,32955,32610],[32956,32611,32955,32611],[32933,32610,32932,32610],[32933,32610,32933,32609],[32934,32610,32933,32610],[32952,32610,32951,32610],[32952,32610,32952,32609],[32953,32610,32952,32610],[32951,32608,32951,32607],[32955,32608,32955,32607],[32947,32607,32947,32606],[32948,32607,32948,32606],[32949,32607,32949,32606],[32950,32607,32950,32606],[32951,32607,32950,32607],[32951,32607,32951,32606],[32952,32607,32951,32607],[32952,32607,32952,32606],[32953,32607,32953,32606],[32954,32607,32954,32606],[32955,32607,32954,32607],[32955,32607,32955,32606],[32956,32607,32955,32607],[32944,32606,32944,32605],[32946,32606,32946,32605],[32947,32606,32946,32606],[32947,32606,32947,32605],[32948,32606,32947,32606],[32948,32606,32948,32605],[32949,32606,32948,32606],[32949,32606,32949,32605],[32950,32606,32949,32606],[32950,32606,32950,32605],[32951,32606,32950,32606],[32951,32606,32951,32605],[32952,32606,32951,32606],[32952,32606,32952,32605],[32953,32606,32952,32606],[32953,32606,32953,32605],[32954,32606,32953,32606],[32954,32606,32954,32605],[32955,32606,32954,32606],[32944,32605,32943,32605],[32944,32605,32944,32604],[32945,32605,32944,32605],[32946,32605,32945,32605],[32946,32605,32946,32604],[32947,32605,32946,32605],[32947,32605,32947,32604],[32948,32605,32947,32605],[32954,32605,32953,32605],[32954,32605,32954,32604],[32955,32605,32954,32605],[32946,32604,32945,32604],[32946,32604,32946,32603],[32947,32604,32946,32604],[32948,32604,32948,32603],[32946,32603,32945,32603],[32946,32603,32946,32602],[32947,32603,32946,32603],[32948,32603,32947,32603],[32948,32603,32948,32602],[32949,32603,32948,32603],[32941,32602,32941,32601],[32944,32602,32944,32601],[32945,32602,32945,32601],[32946,32602,32945,32602],[32946,32602,32946,32601],[32947,32602,32946,32602],[32941,32601,32940,32601],[32941,32601,32941,32600],[32942,32601,32941,32601],[32943,32601,32943,32600],[32944,32601,32943,32601],[32944,32601,32944,32600],[32945,32601,32944,32601],[32945,32601,32945,32600],[32946,32601,32945,32601],[32946,32601,32946,32600],[32952,32601,32952,32600],[32953,32601,32953,32600],[32954,32601,32954,32600],[32942,32600,32942,32599],[32943,32600,32942,32600],[32943,32600,32943,32599],[32944,32600,32943,32600],[32944,32600,32944,32599],[32945,32600,32944,32600],[32945,32600,32945,32599],[32946,32600,32945,32600],[32950,32600,32950,32599],[32951,32600,32951,32599],[32952,32600,32951,32600],[32952,32600,32952,32599],[32953,32600,32952,32600],[32953,32600,32953,32599],[32954,32600,32953,32600],[32954,32600,32954,32599],[32955,32600,32954,32600],[32955,32600,32955,32599],[32956,32600,32956,32599],[32957,32600,32957,32599],[32941,32599,32941,32598],[32942,32599,32941,32599],[32942,32599,32942,32598],[32943,32599,32942,32599],[32943,32599,32943,32598],[32944,32599,32943,32599],[32950,32599,32949,32599],[32950,32599,32950,32598],[32951,32599,32950,32599],[32951,32599,32951,32598],[32952,32599,32951,32599],[32952,32599,32952,32598],[32953,32599,32952,32599],[32953,32599,32953,32598],[32954,32599,32953,32599],[32954,32599,32954,32598],[32955,32599,32954,32599],[32955,32599,32955,32598],[32956,32599,32955,32599],[32956,32599,32956,32598],[32957,32599,32956,32599],[32957,32599,32957,32598],[32958,32599,32957,32599],[32939,32598,32939,32597],[32941,32598,32940,32598],[32941,32598,32941,32597],[32942,32598,32941,32598],[32942,32598,32942,32597],[32943,32598,32942,32598],[32950,32598,32949,32598],[32950,32598,32950,32597],[32951,32598,32950,32598],[32951,32598,32951,32597],[32952,32598,32951,32598],[32952,32598,32952,32597],[32953,32598,32952,32598],[32953,32598,32953,32597],[32954,32598,32953,32598],[32954,32598,32954,32597],[32955,32598,32954,32598],[32955,32598,32955,32597],[32956,32598,32955,32598],[32956,32598,32956,32597],[32957,32598,32956,32598],[32957,32598,32957,32597],[32958,32598,32957,32598],[32939,32597,32938,32597],[32939,32597,32939,32596],[32940,32597,32939,32597],[32940,32597,32940,32596],[32941,32597,32940,32597],[32941,32597,32941,32596],[32942,32597,32941,32597],[32943,32597,32943,32596],[32950,32597,32949,32597],[32950,32597,32950,32596],[32951,32597,32950,32597],[32951,32597,32951,32596],[32952,32597,32951,32597],[32952,32597,32952,32596],[32953,32597,32952,32597],[32953,32597,32953,32596],[32954,32597,32953,32597],[32954,32597,32954,32596],[32955,32597,32954,32597],[32955,32597,32955,32596],[32956,32597,32955,32597],[32956,32597,32956,32596],[32957,32597,32956,32597],[32957,32597,32957,32596],[32958,32597,32957,32597],[32931,32596,32931,32595],[32938,32596,32938,32595],[32939,32596,32938,32596],[32939,32596,32939,32595],[32940,32596,32939,32596],[32940,32596,32940,32595],[32941,32596,32940,32596],[32941,32596,32941,32595],[32942,32596,32941,32596],[32943,32596,32942,32596],[32943,32596,32943,32595],[32944,32596,32943,32596],[32950,32596,32949,32596],[32950,32596,32950,32595],[32951,32596,32950,32596],[32951,32596,32951,32595],[32952,32596,32951,32596],[32952,32596,32952,32595],[32953,32596,32952,32596],[32953,32596,32953,32595],[32954,32596,32953,32596],[32954,32596,32954,32595],[32955,32596,32954,32596],[32955,32596,32955,32595],[32956,32596,32955,32596],[32956,32596,32956,32595],[32957,32596,32956,32596],[32957,32596,32957,32595],[32958,32596,32957,32596],[32931,32595,32930,32595],[32931,32595,32931,32594],[32932,32595,32931,32595],[32938,32595,32937,32595],[32938,32595,32938,32594],[32939,32595,32938,32595],[32939,32595,32939,32594],[32940,32595,32939,32595],[32940,32595,32940,32594],[32941,32595,32941,32594],[32950,32595,32949,32595],[32950,32595,32950,32594],[32951,32595,32950,32595],[32951,32595,32951,32594],[32952,32595,32951,32595],[32952,32595,32952,32594],[32953,32595,32952,32595],[32953,32595,32953,32594],[32954,32595,32953,32595],[32954,32595,32954,32594],[32955,32595,32954,32595],[32955,32595,32955,32594],[32956,32595,32955,32595],[32956,32595,32956,32594],[32957,32595,32956,32595],[32957,32595,32957,32594],[32958,32595,32957,32595],[32938,32594,32937,32594],[32938,32594,32938,32593],[32939,32594,32938,32594],[32939,32594,32939,32593],[32940,32594,32939,32594],[32940,32594,32940,32593],[32941,32594,32940,32594],[32941,32594,32941,32593],[32942,32594,32941,32594],[32943,32594,32943,32593],[32944,32594,32944,32593],[32945,32594,32945,32593],[32946,32594,32946,32593],[32950,32594,32949,32594],[32950,32594,32950,32593],[32951,32594,32950,32594],[32951,32594,32951,32593],[32952,32594,32951,32594],[32952,32594,32952,32593],[32953,32594,32952,32594],[32953,32594,32953,32593],[32954,32594,32953,32594],[32954,32594,32954,32593],[32955,32594,32954,32594],[32955,32594,32955,32593],[32956,32594,32955,32594],[32956,32594,32956,32593],[32957,32594,32956,32594],[32957,32594,32957,32593],[32958,32594,32957,32594],[32938,32593,32937,32593],[32938,32593,32938,32592],[32939,32593,32938,32593],[32939,32593,32939,32592],[32940,32593,32939,32593],[32940,32593,32940,32592],[32941,32593,32940,32593],[32941,32593,32941,32592],[32942,32593,32941,32593],[32943,32593,32942,32593],[32943,32593,32943,32592],[32944,32593,32943,32593],[32944,32593,32944,32592],[32945,32593,32944,32593],[32945,32593,32945,32592],[32946,32593,32945,32593],[32946,32593,32946,32592],[32947,32593,32946,32593],[32938,32592,32937,32592],[32938,32592,32938,32591],[32939,32592,32938,32592],[32939,32592,32939,32591],[32940,32592,32939,32592],[32940,32592,32940,32591],[32941,32592,32940,32592],[32943,32592,32942,32592],[32943,32592,32943,32591],[32944,32592,32943,32592],[32944,32592,32944,32591],[32945,32592,32944,32592],[32945,32592,32945,32591],[32946,32592,32945,32592],[32946,32592,32946,32591],[32947,32592,32946,32592],[32938,32591,32937,32591],[32938,32591,32938,32590],[32939,32591,32938,32591],[32939,32591,32939,32590],[32940,32591,32939,32591],[32940,32591,32940,32590],[32941,32591,32940,32591],[32943,32591,32942,32591],[32943,32591,32943,32590],[32944,32591,32943,32591],[32944,32591,32944,32590],[32945,32591,32944,32591],[32945,32591,32945,32590],[32946,32591,32945,32591],[32946,32591,32946,32590],[32947,32591,32946,32591],[32947,32591,32947,32590],[32948,32591,32948,32590],[32938,32590,32937,32590],[32938,32590,32938,32589],[32939,32590,32938,32590],[32939,32590,32939,32589],[32940,32590,32939,32590],[32943,32590,32942,32590],[32943,32590,32943,32589],[32944,32590,32943,32590],[32944,32590,32944,32589],[32945,32590,32944,32590],[32945,32590,32945,32589],[32946,32590,32945,32590],[32946,32590,32946,32589],[32947,32590,32946,32590],[32947,32590,32947,32589],[32948,32590,32947,32590],[32948,32590,32948,32589],[32949,32590,32948,32590],[32938,32589,32937,32589],[32938,32589,32938,32588],[32939,32589,32938,32589],[32943,32589,32942,32589],[32943,32589,32943,32588],[32944,32589,32943,32589],[32944,32589,32944,32588],[32945,32589,32944,32589],[32945,32589,32945,32588],[32946,32589,32945,32589],[32946,32589,32946,32588],[32947,32589,32946,32589],[32947,32589,32947,32588],[32948,32589,32947,32589],[32948,32589,32948,32588],[32949,32589,32948,32589],[32938,32588,32937,32588],[32938,32588,32938,32587],[32939,32588,32938,32588],[32943,32588,32942,32588],[32943,32588,32943,32587],[32944,32588,32943,32588],[32944,32588,32944,32587],[32945,32588,32944,32588],[32945,32588,32945,32587],[32946,32588,32945,32588],[32946,32588,32946,32587],[32947,32588,32946,32588],[32947,32588,32947,32587],[32948,32588,32947,32588],[32948,32588,32948,32587],[32949,32588,32948,32588],[32931,32587,32931,32586],[32938,32587,32937,32587],[32938,32587,32938,32586],[32939,32587,32938,32587],[32943,32587,32942,32587],[32943,32587,32943,32586],[32944,32587,32943,32587],[32944,32587,32944,32586],[32945,32587,32944,32587],[32945,32587,32945,32586],[32946,32587,32945,32587],[32946,32587,32946,32586],[32947,32587,32946,32587],[32947,32587,32947,32586],[32948,32587,32947,32587],[32948,32587,32948,32586],[32949,32587,32948,32587],[32931,32586,32930,32586],[32931,32586,32931,32585],[32932,32586,32931,32586],[32936,32586,32936,32585],[32937,32586,32937,32585],[32938,32586,32937,32586],[32938,32586,32938,32585],[32939,32586,32938,32586],[32943,32586,32942,32586],[32943,32586,32943,32585],[32944,32586,32943,32586],[32944,32586,32944,32585],[32945,32586,32944,32586],[32945,32586,32945,32585],[32946,32586,32945,32586],[32946,32586,32946,32585],[32947,32586,32946,32586],[32947,32586,32947,32585],[32948,32586,32947,32586],[32948,32586,32948,32585],[32949,32586,32948,32586],[32930,32585,32930,32584],[32931,32585,32931,32584],[32932,32585,32932,32584],[32933,32585,32933,32584],[32934,32585,32934,32584],[32935,32585,32935,32584],[32936,32585,32935,32585],[32936,32585,32936,32584],[32937,32585,32936,32585],[32937,32585,32937,32584],[32938,32585,32937,32585],[32938,32585,32938,32584],[32939,32585,32938,32585],[32930,32584,32929,32584],[32930,32584,32930,32583],[32931,32584,32930,32584],[32931,32584,32931,32583],[32932,32584,32931,32584],[32932,32584,32932,32583],[32933,32584,32932,32584],[32933,32584,32933,32583],[32934,32584,32933,32584],[32934,32584,32934,32583],[32935,32584,32934,32584],[32935,32584,32935,32583],[32936,32584,32935,32584],[32936,32584,32936,32583],[32937,32584,32936,32584],[32937,32584,32937,32583],[32938,32584,32937,32584],[32930,32583,32929,32583],[32930,32583,32930,32582],[32931,32583,32930,32583],[32931,32583,32931,32582],[32932,32583,32931,32583],[32932,32583,32932,32582],[32933,32583,32932,32583],[32953,32583,32953,32582],[32930,32582,32929,32582],[32930,32582,32930,32581],[32931,32582,32930,32582],[32931,32582,32931,32581],[32932,32582,32931,32582],[32932,32582,32932,32581],[32933,32582,32932,32582],[32950,32582,32950,32581],[32951,32582,32951,32581],[32952,32582,32952,32581],[32953,32582,32952,32582],[32953,32582,32953,32581],[32954,32582,32953,32582],[32948,32581,32948,32580],[32950,32581,32949,32581],[32950,32581,32950,32580],[32951,32581,32950,32581],[32951,32581,32951,32580],[32952,32581,32951,32581],[32952,32581,32952,32580],[32953,32581,32952,32581],[32953,32581,32953,32580],[32948,32580,32947,32580],[32948,32580,32948,32579],[32949,32580,32948,32580],[32951,32580,32950,32580],[32951,32580,32951,32579],[32952,32580,32951,32580],[32952,32580,32952,32579],[32953,32580,32952,32580],[32953,32580,32953,32579],[32954,32580,32953,32580],[32948,32579,32947,32579],[32948,32579,32948,32578],[32949,32579,32948,32579],[32949,32577,32949,32576],[32950,32577,32950,32576],[32951,32577,32951,32576],[32952,32577,32952,32576],[32949,32576,32948,32576],[32949,32576,32949,32575],[32950,32576,32949,32576],[32950,32576,32950,32575],[32951,32576,32950,32576],[32951,32576,32951,32575],[32952,32576,32951,32576],[32952,32576,32952,32575],[32953,32576,32952,32576],[32953,32576,32953,32575],[32949,32575,32948,32575],[32949,32575,32949,32574],[32950,32575,32949,32575],[32950,32575,32950,32574],[32951,32575,32950,32575],[32951,32575,32951,32574],[32952,32575,32951,32575],[32952,32575,32952,32574],[32953,32575,32952,32575],[32953,32575,32953,32574],[32954,32575,32953,32575],[32949,32574,32948,32574],[32949,32574,32949,32573],[32950,32574,32949,32574],[32950,32574,32950,32573],[32951,32574,32950,32574],[32951,32574,32951,32573],[32952,32574,32951,32574],[32949,32573,32948,32573],[32949,32573,32949,32572],[32950,32573,32949,32573],[32950,32573,32950,32572],[32951,32573,32950,32573],[32951,32573,32951,32572],[32952,32573,32951,32573],[32935,32568,32935,32567],[32935,32567,32934,32567],[32935,32567,32935,32566],[32936,32567,32935,32567],[32933,32563,32933,32562],[32941,32563,32941,32562],[32942,32563,32942,32562],[32959,32563,32959,32562],[32929,32562,32929,32561],[32930,32562,32930,32561],[32931,32562,32931,32561],[32932,32562,32932,32561],[32933,32562,32932,32562],[32933,32562,32933,32561],[32934,32562,32933,32562],[32935,32562,32935,32561],[32941,32562,32940,32562],[32941,32562,32941,32561],[32942,32562,32941,32562],[32942,32562,32942,32561],[32943,32562,32942,32562],[32954,32562,32954,32561],[32956,32562,32956,32561],[32957,32562,32957,32561],[32959,32562,32958,32562],[32959,32562,32959,32561],[32928,32561,32928,32560],[32929,32561,32928,32561],[32929,32561,32929,32560],[32930,32561,32929,32561],[32930,32561,32930,32560],[32931,32561,32930,32561],[32931,32561,32931,32560],[32932,32561,32931,32561],[32932,32561,32932,32560],[32933,32561,32932,32561],[32933,32561,32933,32560],[32934,32561,32933,32561],[32934,32561,32934,32560],[32935,32561,32934,32561],[32935,32561,32935,32560],[32936,32561,32935,32561],[32952,32561,32952,32560],[32953,32561,32953,32560],[32954,32561,32953,32561],[32954,32561,32954,32560],[32955,32561,32954,32561],[32956,32561,32955,32561],[32956,32561,32956,32560],[32957,32561,32956,32561],[32957,32561,32957,32560],[32958,32561,32957,32561],[32958,32561,32958,32560],[32959,32561,32959,32560],[32929,32560,32928,32560],[32930,32560,32929,32560],[32931,32560,32930,32560],[32932,32560,32931,32560],[32933,32560,32932,32560],[32934,32560,32933,32560],[32935,32560,32934,32560],[32936,32560,32935,32560],[32952,32560,32951,32560],[32953,32560,32952,32560],[32954,32560,32953,32560],[32955,32560,32954,32560],[32956,32560,32955,32560],[32957,32560,32956,32560],[32958,32560,32957,32560],[32959,32560,32958,32560]],"spawn":{"x":32945,"y":32575},"tileSize":{"width":48,"height":24},"imagePlacement":{"x":32959,"y":32560,"width":2016,"height":1152,"offsetX":-984.0,"offsetY":660.0},"objects":[{"x":32953.197916666664,"y":32580.21875,"width":25,"height":29,"footY":65533,"sourceRect":{"x":0,"y":0,"width":25,"height":29}},{"x":32948.239583333336,"y":32579.260416666668,"width":25,"height":26,"footY":65527,"sourceRect":{"x":0,"y":29,"width":25,"height":26}},{"x":32942.875,"y":32596.125,"width":24,"height":42,"footY":65539,"sourceRect":{"x":0,"y":55,"width":24,"height":42}},{"x":32950.25,"y":32581.416666666668,"width":28,"height":20,"footY":65531,"sourceRect":{"x":0,"y":97,"width":28,"height":20}},{"x":32953.458333333336,"y":32582.291666666668,"width":28,"height":20,"footY":65535,"sourceRect":{"x":0,"y":117,"width":28,"height":20}},{"x":32959.604166666664,"y":32603.5625,"width":14,"height":17,"footY":65563,"sourceRect":{"x":0,"y":137,"width":14,"height":17}},{"x":32954.520833333336,"y":32606.729166666668,"width":56,"height":78,"footY":65562,"sourceRect":{"x":0,"y":154,"width":56,"height":78}},{"x":32952.8125,"y":32607.1875,"width":104,"height":76,"footY":65560,"sourceRect":{"x":0,"y":232,"width":104,"height":76}},{"x":32949.84375,"y":32607.239583333332,"width":107,"height":83,"footY":65557,"sourceRect":{"x":0,"y":308,"width":107,"height":83}},{"x":32948.020833333336,"y":32606.729166666668,"width":62,"height":93,"footY":65555,"sourceRect":{"x":0,"y":391,"width":62,"height":93}},{"x":32947.208333333336,"y":32604.041666666668,"width":104,"height":85,"footY":65552,"sourceRect":{"x":0,"y":484,"width":104,"height":85}},{"x":32946.59375,"y":32602.072916666668,"width":57,"height":87,"footY":65549,"sourceRect":{"x":0,"y":569,"width":57,"height":87}},{"x":32944.020833333336,"y":32600.729166666668,"width":62,"height":93,"footY":65545,"sourceRect":{"x":0,"y":656,"width":62,"height":93}},{"x":32942.59375,"y":32598.072916666668,"width":57,"height":87,"footY":65541,"sourceRect":{"x":0,"y":749,"width":57,"height":87}},{"x":32940.020833333336,"y":32596.729166666668,"width":62,"height":93,"footY":65537,"sourceRect":{"x":0,"y":836,"width":62,"height":93}},{"x":32939.208333333336,"y":32594.041666666668,"width":104,"height":85,"footY":65534,"sourceRect":{"x":0,"y":929,"width":104,"height":85}},{"x":32939.114583333336,"y":32590.802083333332,"width":105,"height":79,"footY":65530,"sourceRect":{"x":0,"y":1014,"width":105,"height":79}},{"x":32939.0625,"y":32587.770833333332,"width":112,"height":83,"footY":65527,"sourceRect":{"x":0,"y":1093,"width":112,"height":83}},{"x":32938.59375,"y":32586.072916666668,"width":57,"height":87,"footY":65525,"sourceRect":{"x":0,"y":1176,"width":57,"height":87}},{"x":32935.8125,"y":32585.1875,"width":104,"height":76,"footY":65521,"sourceRect":{"x":0,"y":1263,"width":104,"height":76}},{"x":32932.8125,"y":32585.104166666668,"width":98,"height":78,"footY":65518,"sourceRect":{"x":0,"y":1339,"width":98,"height":78}},{"x":32930.666666666664,"y":32584.666666666668,"width":62,"height":78,"footY":65516,"sourceRect":{"x":0,"y":1417,"width":62,"height":78}},{"x":32952.270833333336,"y":32581.395833333332,"width":86,"height":83,"footY":65534,"sourceRect":{"x":0,"y":1495,"width":86,"height":83}},{"x":32948.864583333336,"y":32587.46875,"width":69,"height":39,"footY":65536,"sourceRect":{"x":0,"y":1578,"width":69,"height":39}},{"x":32948.0625,"y":32586.604166666668,"width":66,"height":40,"footY":65534,"sourceRect":{"x":0,"y":1617,"width":66,"height":40}},{"x":32951.145833333336,"y":32598.9375,"width":40,"height":48,"footY":65550,"sourceRect":{"x":0,"y":1657,"width":40,"height":48}},{"x":32952.302083333336,"y":32598.447916666668,"width":51,"height":36,"footY":65551,"sourceRect":{"x":0,"y":1705,"width":51,"height":36}},{"x":32959.895833333336,"y":32577.354166666668,"width":40,"height":58,"footY":65537,"sourceRect":{"x":0,"y":1741,"width":40,"height":58}},{"x":32949.260416666664,"y":32604.572916666668,"width":239,"height":216,"footY":65554,"sourceRect":{"x":0,"y":1799,"width":239,"height":216}},{"x":32945.104166666664,"y":32612.895833333332,"width":190,"height":184,"footY":65558,"sourceRect":{"x":0,"y":2015,"width":190,"height":184}},{"x":32939.260416666664,"y":32591.322916666668,"width":25,"height":25,"footY":65530,"sourceRect":{"x":0,"y":2199,"width":25,"height":25}},{"x":32939.208333333336,"y":32590.291666666668,"width":32,"height":31,"footY":65529,"sourceRect":{"x":0,"y":2224,"width":32,"height":31}},{"x":32940.208333333336,"y":32591.208333333332,"width":40,"height":30,"footY":65532,"sourceRect":{"x":0,"y":2255,"width":40,"height":30}},{"x":32940.291666666664,"y":32592.291666666668,"width":26,"height":16,"footY":65532,"sourceRect":{"x":0,"y":2285,"width":26,"height":16}},{"x":32953.84375,"y":32600.489583333332,"width":43,"height":54,"footY":65554,"sourceRect":{"x":0,"y":2301,"width":43,"height":54}},{"x":32930.875,"y":32586.125,"width":24,"height":42,"footY":65517,"sourceRect":{"x":0,"y":2355,"width":24,"height":42}},{"x":32954.875,"y":32607.125,"width":24,"height":42,"footY":65562,"sourceRect":{"x":0,"y":2397,"width":24,"height":42}},{"x":32947.875,"y":32580.125,"width":24,"height":42,"footY":65528,"sourceRect":{"x":0,"y":2439,"width":24,"height":42}},{"x":32956.854166666664,"y":32585.729166666668,"width":74,"height":54,"footY":65543,"sourceRect":{"x":0,"y":2481,"width":74,"height":54}},{"x":32935.510416666664,"y":32577.822916666668,"width":75,"height":39,"footY":65514,"sourceRect":{"x":0,"y":2535,"width":75,"height":39}},{"x":32928.614583333336,"y":32589.71875,"width":65,"height":36,"footY":65519,"sourceRect":{"x":0,"y":2574,"width":65,"height":36}},{"x":32952.010416666664,"y":32610.40625,"width":85,"height":78,"footY":65563,"sourceRect":{"x":0,"y":2610,"width":85,"height":78}},{"x":32955.302083333336,"y":32611.364583333332,"width":53,"height":62,"footY":65566,"sourceRect":{"x":0,"y":2688,"width":53,"height":62}},{"x":32943.302083333336,"y":32596.364583333332,"width":53,"height":62,"footY":65540,"sourceRect":{"x":0,"y":2750,"width":53,"height":62}},{"x":32940.979166666664,"y":32601.354166666668,"width":92,"height":78,"footY":65542,"sourceRect":{"x":0,"y":2812,"width":92,"height":78}},{"x":32944.572916666664,"y":32605.84375,"width":69,"height":71,"footY":65551,"sourceRect":{"x":0,"y":2890,"width":69,"height":71}},{"x":32951.625,"y":32575.625,"width":252,"height":253,"footY":65527,"sourceRect":{"x":0,"y":2961,"width":252,"height":253}},{"x":32953.822916666664,"y":32576.260416666668,"width":95,"height":95,"footY":65530,"sourceRect":{"x":0,"y":3214,"width":95,"height":95}},{"x":32952.385416666664,"y":32576.53125,"width":33,"height":38,"footY":65529,"sourceRect":{"x":0,"y":3309,"width":33,"height":38}},{"x":32931.979166666664,"y":32583.020833333332,"width":150,"height":145,"footY":65515,"sourceRect":{"x":0,"y":3347,"width":150,"height":145}},{"x":32930.145833333336,"y":32583.020833333332,"width":104,"height":86,"footY":65513,"sourceRect":{"x":0,"y":3492,"width":104,"height":86}},{"x":32932.927083333336,"y":32583.072916666668,"width":65,"height":61,"footY":65516,"sourceRect":{"x":0,"y":3578,"width":65,"height":61}},{"x":32937.25,"y":32589.416666666668,"width":160,"height":222,"footY":65527,"sourceRect":{"x":0,"y":3639,"width":160,"height":222}},{"x":32936.6875,"y":32586.8125,"width":58,"height":68,"footY":65524,"sourceRect":{"x":0,"y":3861,"width":58,"height":68}},{"x":32954.572916666664,"y":32605.677083333332,"width":65,"height":64,"footY":65561,"sourceRect":{"x":0,"y":3929,"width":65,"height":64}},{"x":32956.15625,"y":32599.927083333332,"width":333,"height":266,"footY":65556,"sourceRect":{"x":0,"y":3993,"width":333,"height":266}},{"x":32959.833333333336,"y":32586.583333333332,"width":34,"height":46,"footY":65546,"sourceRect":{"x":0,"y":4259,"width":34,"height":46}},{"x":32957.041666666664,"y":32602.791666666668,"width":98,"height":70,"footY":65560,"sourceRect":{"x":0,"y":4305,"width":98,"height":70}},{"x":32958.447916666664,"y":32596.635416666668,"width":45,"height":26,"footY":65556,"sourceRect":{"x":0,"y":4375,"width":45,"height":26}},{"x":32958.34375,"y":32597.239583333332,"width":35,"height":15,"footY":65556,"sourceRect":{"x":0,"y":4401,"width":35,"height":15}},{"x":32952.65625,"y":32601.010416666668,"width":31,"height":29,"footY":65553,"sourceRect":{"x":0,"y":4416,"width":31,"height":29}},{"x":32955.3125,"y":32600.604166666668,"width":48,"height":32,"footY":65556,"sourceRect":{"x":0,"y":4445,"width":48,"height":32}},{"x":32949.416666666664,"y":32590.5,"width":44,"height":26,"footY":65540,"sourceRect":{"x":0,"y":4477,"width":44,"height":26}},{"x":32945.53125,"y":32595.96875,"width":71,"height":52,"footY":65542,"sourceRect":{"x":0,"y":4503,"width":71,"height":52}},{"x":32949.020833333336,"y":32605.479166666668,"width":88,"height":52,"footY":65554,"sourceRect":{"x":0,"y":4555,"width":88,"height":52}},{"x":32941.104166666664,"y":32594.645833333332,"width":104,"height":74,"footY":65535,"sourceRect":{"x":0,"y":4607,"width":104,"height":74}},{"x":32949.71875,"y":32589.03125,"width":55,"height":41,"footY":65539,"sourceRect":{"x":0,"y":4681,"width":55,"height":41}},{"x":32934.229166666664,"y":32611.854166666668,"width":218,"height":195,"footY":65546,"sourceRect":{"x":0,"y":4722,"width":218,"height":195}},{"x":32950.770833333336,"y":32612.645833333332,"width":114,"height":73,"footY":65563,"sourceRect":{"x":0,"y":4917,"width":114,"height":73}},{"x":32945.979166666664,"y":32611.4375,"width":4,"height":4,"footY":65557,"sourceRect":{"x":0,"y":4990,"width":4,"height":4}},{"x":32932.65625,"y":32597.010416666668,"width":211,"height":167,"footY":65530,"sourceRect":{"x":0,"y":4994,"width":211,"height":167}},{"x":32947.885416666664,"y":32592.364583333332,"width":253,"height":260,"footY":65541,"sourceRect":{"x":0,"y":5161,"width":253,"height":260}},{"x":32947.552083333336,"y":32592.697916666668,"width":309,"height":82,"footY":65540,"sourceRect":{"x":0,"y":5421,"width":309,"height":82}},{"x":32960.072916666664,"y":32610.677083333332,"width":79,"height":49,"footY":65570,"sourceRect":{"x":0,"y":5503,"width":79,"height":49}},{"x":32934.875,"y":32567.125,"width":24,"height":42,"footY":65502,"sourceRect":{"x":0,"y":5552,"width":24,"height":42}},{"x":32956.9375,"y":32561.479166666668,"width":188,"height":89,"footY":65519,"sourceRect":{"x":0,"y":5594,"width":188,"height":89}},{"x":32955.25,"y":32560.0,"width":32,"height":18,"footY":65515,"sourceRect":{"x":0,"y":5683,"width":32,"height":18}},{"x":32951.71875,"y":32560.28125,"width":41,"height":19,"footY":65512,"sourceRect":{"x":0,"y":5701,"width":41,"height":19}},{"x":32961.59375,"y":32568.322916666668,"width":203,"height":102,"footY":65529,"sourceRect":{"x":0,"y":5720,"width":203,"height":102}},{"x":32961.90625,"y":32568.427083333332,"width":241,"height":125,"footY":65530,"sourceRect":{"x":0,"y":5822,"width":241,"height":125}},{"x":32958.875,"y":32562.125,"width":24,"height":42,"footY":65521,"sourceRect":{"x":0,"y":5947,"width":24,"height":42}},{"x":32958.510416666664,"y":32571.822916666668,"width":75,"height":39,"footY":65531,"sourceRect":{"x":0,"y":5989,"width":75,"height":39}},{"x":32957.25,"y":32561.416666666668,"width":38,"height":47,"footY":65518,"sourceRect":{"x":0,"y":6028,"width":38,"height":47}},{"x":32932.958333333336,"y":32561.708333333332,"width":184,"height":92,"footY":65495,"sourceRect":{"x":0,"y":6075,"width":184,"height":92}},{"x":32927.864583333336,"y":32560.302083333332,"width":25,"height":14,"footY":65489,"sourceRect":{"x":0,"y":6167,"width":25,"height":14}},{"x":32928.0625,"y":32559.9375,"width":26,"height":12,"footY":65488,"sourceRect":{"x":0,"y":6181,"width":26,"height":12}},{"x":32935.520833333336,"y":32560.145833333332,"width":46,"height":23,"footY":65496,"sourceRect":{"x":0,"y":6193,"width":46,"height":23}},{"x":32935.208333333336,"y":32561.291666666668,"width":32,"height":31,"footY":65496,"sourceRect":{"x":0,"y":6216,"width":32,"height":31}},{"x":32933.166666666664,"y":32561.25,"width":38,"height":25,"footY":65494,"sourceRect":{"x":0,"y":6247,"width":38,"height":25}},{"x":32956.729166666664,"y":32562.1875,"width":254,"height":118,"footY":65519,"sourceRect":{"x":0,"y":6272,"width":254,"height":118}},{"x":32933.020833333336,"y":32562.729166666668,"width":240,"height":105,"footY":65496,"sourceRect":{"x":0,"y":6390,"width":240,"height":105}},{"x":32947.416666666664,"y":32574.5,"width":40,"height":46,"footY":65522,"sourceRect":{"x":0,"y":6495,"width":40,"height":46}},{"x":32951.4375,"y":32572.479166666668,"width":48,"height":49,"footY":65524,"sourceRect":{"x":0,"y":6541,"width":48,"height":49}},{"x":32952.385416666664,"y":32573.53125,"width":33,"height":38,"footY":65526,"sourceRect":{"x":0,"y":6590,"width":33,"height":38}},{"x":32933.520833333336,"y":32562.645833333332,"width":52,"height":34,"footY":65496,"sourceRect":{"x":0,"y":6628,"width":52,"height":34}},{"x":32941.020833333336,"y":32563.145833333332,"width":92,"height":96,"footY":65504,"sourceRect":{"x":0,"y":6662,"width":92,"height":96}},{"x":32942.395833333336,"y":32562.520833333332,"width":40,"height":29,"footY":65505,"sourceRect":{"x":0,"y":6758,"width":40,"height":29}},{"x":32928.59375,"y":32561.65625,"width":59,"height":39,"footY":65491,"sourceRect":{"x":0,"y":6787,"width":59,"height":39}},{"x":32952.302083333336,"y":32560.197916666668,"width":35,"height":22,"footY":65512,"sourceRect":{"x":0,"y":6826,"width":35,"height":22}},{"x":32931.197916666664,"y":32560.552083333332,"width":53,"height":35,"footY":65492,"sourceRect":{"x":0,"y":6848,"width":53,"height":35}},{"x":32932.739583333336,"y":32559.510416666668,"width":1,"height":1,"footY":65493,"sourceRect":{"x":0,"y":6883,"width":1,"height":1}}]}};
 const localImages={"village-objects.png":"./assets/50dfa56f057c338e4035.png","knight-attack.png":"./assets/aa7fb259749cd39d07de.png","village-ground.png":"./assets/0eba39f3325602bf9c95.png","knight-atlas.png":"./assets/5edd2cc8ebf59e260580.png","goblin.png":"./assets/db366be902fa0b49938a.png","knight-female-atlas.png":"./assets/7d599dff997b1e6036c9.png","knight-female-attack.png":"./assets/8f56ad9312e7cd689029.png","royal-male-atlas.png":"./assets/d6428f459aaf71834b68.png","royal-female-atlas.png":"./assets/8b33ec873c6f5cd6d52f.png","elf-male-atlas.png":"./assets/b763f8e97374bfe17e5a.png","elf-female-atlas.png":"./assets/c624073e682e3581b2d7.png","wizard-male-atlas.png":"./assets/075ed1c99f0c0e3c9af4.png","wizard-female-atlas.png":"./assets/9dda9ce7668763b4ddb1.png","royal-male-attack.png":"./assets/6f111d9c8ffe894b0b76.png","royal-female-attack.png":"./assets/861ffa86f57661f0a5ad.png","elf-male-attack.png":"./assets/d311201060554d60c418.png","elf-female-attack.png":"./assets/a1d14c5ce0ec34941cf7.png","wizard-male-attack.png":"./assets/b0ed9f6a0e381899c7a9.png","wizard-female-attack.png":"./assets/03d42919dc33fd52a838.png","wizard-male-cast-direction.png":"./assets/112e89d1e4e15715fa96.png","wizard-male-cast-no-direction.png":"./assets/29f41229a249c6571741.png","wizard-female-cast-direction.png":"./assets/71a786823cf511fadf78.png","wizard-female-cast-no-direction.png":"./assets/f600bb3da64357ed7bbc.png","energy-bolt.png":"./assets/ea416317369e252406cf.png","scarecrow.png":"./assets/946350bba175beeac759.png","knight-female-pickup.png":"./assets/ecdc9a73931ea979e02a.png","knight-pickup.png":"./assets/2c170b577421f9df3349.png","royal-male-pickup.png":"./assets/e81ae6d7f8e020ae524e.png","royal-female-pickup.png":"./assets/6e55c7f5b0dc30d740ea.png","elf-male-pickup.png":"./assets/cdf2efa7bc95560c5c3c.png","elf-female-pickup.png":"./assets/ee7a912d89c7d8a1f30e.png","wizard-male-pickup.png":"./assets/ead7b0724aeb4fe8f61d.png","wizard-female-pickup.png":"./assets/e62e192228f50e8d0634.png","shop-ground.png":"./assets/1dad1a18aa85f88edd5e.png","shop-objects.png":"./assets/2562756ce69f89869e32.png","pandora.png":"./assets/36997a170e7cb2af75ee.png"};
 const json=async name=>localData[name];
 const loadSprite=action=>Promise.all([
  json(spriteBase+'-'+action+'.json'),loadLocalImage(spriteBase+'-'+action+'.png')
 ]);
 const loadLocalImage=name=>verifiedImageLoader(localImages[name]);
 if(visualParams.get('gerengPreview')==='1')return prepareGerengScene(loadSprite);
 const castPreview=visualParams.get('spellPreview')==='1'&&spriteBase.startsWith('wizard-');
 const shop=trial&&visualParams.get('villageProgress')!=='0';
 const learnedCast=shop&&spriteBase.startsWith('wizard-')&&knowsEnergyBolt(player);
 const [data,ground,objects,[spriteConfig,actor],attack,goblin,casts,boltImage,dummyImage,pickupSprite,merchantImage]=await Promise.all([
  json(shop?'shop-scene.json':'village-scene.json'),loadLocalImage(shop?'shop-ground.png':'village-ground.png'),loadLocalImage(shop?'shop-objects.png':'village-objects.png'),
  loadSprite('atlas'),trial?loadSprite('attack'):null,trial?loadLocalImage('goblin.png'):null,
  castPreview?Promise.all([loadSprite('cast-direction'),loadSprite('cast-no-direction')]):learnedCast?Promise.all([loadSprite('cast-direction')]):null,
  castPreview||learnedCast?loadLocalImage('energy-bolt.png'):null,
  castPreview?loadLocalImage('scarecrow.png'):null,
  trial&&visualParams.get('villageProgress')!=='0'?loadSprite('pickup'):null,
  shop?loadLocalImage('pandora.png'):null
 ]);
 const renderer=new TalkingIslandLayerRenderer(canvas,{tileWidth:data.tileSize.width,tileHeight:data.tileSize.height});
 renderer.setScene({bounds:data.bounds,layers:[
  {id:'ground',depth:0,images:[{...data.imagePlacement,image:ground}]},
  {id:'objects',depth:1,images:data.objects.map(item=>({...item,image:objects}))}
 ]});
 renderer.setCollision(data);
 const movement=new TalkingIslandMovementController(renderer);
 movement.spawn(data.spawn.x,data.spawn.y);
 const validateSprite=([config,image],label)=>{
  const {columns,directions,drawHeight,footAnchorY,frameDuration}=config;
  if(!Number.isInteger(columns)||columns<1||image.naturalWidth%columns||image.naturalHeight%8||
     !Array.isArray(directions)||directions.length!==8||new Set(directions).size!==8||
     !directions.every(direction=>['N','NE','E','SE','S','SW','W','NW'].includes(direction))||
     !Number.isFinite(drawHeight)||drawHeight<=0||
     !Number.isFinite(footAnchorY)||footAnchorY<0||footAnchorY>1||
     !Number.isFinite(frameDuration)||frameDuration<=0)
   throw Error(label+'圖集與設定不相符');
 };
 validateSprite([spriteConfig,actor],'角色行走');
 if(attack){
  validateSprite(attack,'角色攻擊');
  const {columns,frameEnds,impactFrame=4}=attack[0];
  if(frameEnds!==undefined&&(!Array.isArray(frameEnds)||frameEnds.length!==columns||
     frameEnds.some((end,i)=>!Number.isFinite(end)||end<=(frameEnds[i-1]??0))))
   throw Error('角色攻擊時間設定不相符');
  if(!Number.isInteger(impactFrame)||impactFrame<0||impactFrame>=columns)
   throw Error('角色攻擊影格與設定不相符');
  if(goblin.naturalWidth!==119||goblin.naturalHeight!==93*(21+GOBLIN_ATTACK_FRAMES))
   throw Error('哥布林圖集尺寸不符');
 }
 for(const cast of casts??[])validateSprite(cast,'法師施法');
 return {renderer,movement,actor,spriteConfig,attack,goblin,casts,boltImage,pickupSprite,merchant:merchantImage?{...PANDORA,image:merchantImage,width:120,height:120,offsetY:32}:null,dummy:dummyImage?{x:32953,y:32568,image:dummyImage,width:45,height:65}:null,imagePixels:new WeakMap()};
}
async function prepareVerifiedTalkingIslandScene(data){
 const scene=await TalkingIslandLayerRenderer.loadSceneDescriptor(data.sceneDescriptor,verifiedImageLoader);
 const actor=await verifiedImageLoader(data.playerSprite.path);
 if(!actor.complete||!actor.naturalWidth)throw new Error('人物素材無效');
 let spriteConfig=null;
 const cfg=data.playerSprite;
 if(cfg.columns!==undefined||cfg.directions!==undefined||cfg.frameDuration!==undefined){
  const directions=['N','NE','E','SE','S','SW','W','NW'];
  if(!Number.isInteger(cfg.columns)||cfg.columns<1||cfg.columns>32||
   !Number.isInteger(cfg.frameDuration)||cfg.frameDuration<50||cfg.frameDuration>2000||
   !Array.isArray(cfg.directions)||cfg.directions.length!==8||
   new Set(cfg.directions).size!==8||!cfg.directions.every(d=>directions.includes(d))||
   actor.naturalWidth%cfg.columns!==0||actor.naturalHeight%8!==0)
   throw new Error('人物 Sprite 圖集配置無效');
  spriteConfig={columns:cfg.columns,frameDuration:cfg.frameDuration,directions:cfg.directions};
 }
 const renderer=new TalkingIslandLayerRenderer(canvas);
 renderer.setScene(scene);
 const b=data.coordinateSystem.worldBounds;
 const collisionLayer=data.collisionLayers.find(l=>l.verified===true);
 renderer.setCollision({bounds:{minX:b[0],minY:b[1],maxX:b[2],maxY:b[3]},blockedCells:collisionLayer.blockedCells});
 if(!renderer.canWalk(data.playerSpawn.x,data.playerSpawn.y))throw new Error('核實出生點不可行走');
 const movement=new TalkingIslandMovementController(renderer);
 movement.spawn(data.playerSpawn.x,data.playerSpawn.y);
 return {renderer,actor,spriteConfig,movement,spawn:{x:data.playerSpawn.x,y:data.playerSpawn.y}};
}

// P05-D35: a verified screenshot alone is not a playable map.
function auditTalkingIslandPlayability(data){
 const missing=[];
 const b=data.coordinateSystem&&data.coordinateSystem.worldBounds;
 if(!Array.isArray(b)||b.length!==4||!b.every(Number.isInteger)||b[0]>=b[2]||b[1]>=b[3])missing.push('worldBounds');
 if(!Array.isArray(data.assets))return {playable:false,missing:[...missing,'assets']};
 if(!Array.isArray(data.collisionLayers)||!data.collisionLayers.some(l=>l&&l.verified===true&&l.assetId&&data.assets.some(a=>a.id===l.assetId&&a.verified===true&&a.licenseVerified===true)))missing.push('collision');
 if(!Array.isArray(data.occlusionLayers)||!data.occlusionLayers.some(l=>l&&l.verified===true&&l.assetId&&data.assets.some(a=>a.id===l.assetId&&a.verified===true&&a.licenseVerified===true)))missing.push('occlusion');
 // A verified screenshot is insufficient for a playable isometric scene.
 // Require an explicitly placed, licensed world-image layer and a player sprite.
 const scene=data.sceneDescriptor;
 const allowedAssets=new Map((Array.isArray(data.assets)?data.assets:[]).filter(a=>a&&a.verified===true&&a.licenseVerified===true).map(a=>[a.path,a]));
 const validScene=scene&&scene.verified===true&&scene.bounds&&Array.isArray(scene.layers)&&scene.layers.length>0&&
  scene.layers.every(layer=>layer&&layer.verified===true&&Number.isFinite(layer.depth)&&Array.isArray(layer.images)&&layer.images.every(item=>
   item&&item.verified===true&&item.licenseVerified===true&&allowedAssets.has(item.path)&&
   [item.x,item.y,item.width,item.height].every(Number.isFinite)&&item.width>0&&item.height>0));
 if(!validScene)missing.push('sceneDescriptor');
 const sprite=data.playerSprite;
 if(!sprite||sprite.verified!==true||sprite.licenseVerified!==true||!allowedAssets.has(sprite.path))missing.push('playerSprite');
 if(!data.playerSpawn||!Number.isInteger(data.playerSpawn.x)||!Number.isInteger(data.playerSpawn.y)||data.playerSpawn.verified!==true||!Array.isArray(b)||b.length!==4||data.playerSpawn.x<b[0]||data.playerSpawn.x>=b[2]||data.playerSpawn.y<b[1]||data.playerSpawn.y>=b[3])missing.push('spawn');
 return {playable:missing.length===0,missing};
}
function loadVerifiedTalkingIslandImage(data){
 const asset=data.assets.find(a=>a.kind==='background'&&a.verified===true&&a.licenseVerified===true);
 if(!asset){talkingIslandManifestState.status='awaiting-background-asset';return}
 const img=new Image();
 img.onload=()=>{verifiedTalkingIslandImage=img;verifiedTalkingIslandImageReady=true;talkingIslandManifestState.status='image-ready'};
 img.onerror=()=>{talkingIslandManifestState.status='image-error';talkingIslandManifestState.error='Verified background failed to load'};
 img.src=asset.path;
}

if(visualParams.get('historicalMode')==='1'){
 talkingIslandManifestState.status='loading';
 fetch('./assets/maps/talking-island-182.manifest.json',{cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})
  .then(data=>{
   if(data.schemaVersion!==1||data.mapId!=='talking-island-village'||!Array.isArray(data.assets)||!Array.isArray(data.landmarks))throw Error('Invalid Talking Island manifest');
   talkingIslandManifestState.manifest=data;
   talkingIslandManifestState.playability=auditTalkingIslandPlayability(data);
   if(talkingIslandManifestState.playability.playable){
    const layer=data.collisionLayers.find(l=>l&&l.verified===true&&l.assetId&&data.assets.some(a=>a.id===l.assetId&&a.verified===true&&a.licenseVerified===true));
    const b=data.coordinateSystem.worldBounds;
    const cells=layer&&layer.blockedCells;
    if(!Array.isArray(cells)||!cells.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger)&&c[0]>=b[0]&&c[0]<b[2]&&c[1]>=b[1]&&c[1]<b[3])||cells.some(c=>c[0]===data.playerSpawn.x&&c[1]===data.playerSpawn.y)){
     talkingIslandManifestState.playability={playable:false,missing:['collision-cells']};
    }else{
     talkingIslandManifestState.collision={bounds:{minX:b[0],minY:b[1],maxX:b[2],maxY:b[3]},blocked:new Set(cells.map(c=>c[0]+','+c[1]))};
    }
   }
   // A string flag alone must never unlock an unverified historical map.
   const verifiedAssets=data.assets.length>0&&data.assets.some(a=>a&&a.kind==='background'&&a.verified===true&&a.licenseVerified===true)&&data.assets.every(a=>a&&typeof a.path==='string'&&a.path.startsWith('./assets/maps/')&&!a.path.includes('..')&&a.verified===true&&a.licenseVerified===true&&typeof a.source==='string'&&a.source.length>0);
   const verifiedLandmarks=data.landmarks.length>0&&data.landmarks.every(p=>p&&p.verified===true);
   talkingIslandManifestState.status=data.status==='ready'&&verifiedAssets&&verifiedLandmarks&&talkingIslandManifestState.playability.playable?'ready':'awaiting-verified-assets';
   if(talkingIslandManifestState.status==='ready'){
    prepareVerifiedTalkingIslandScene(data).then(scene=>{
     if(!localVillageEntered)activateTalkingIslandScene(scene);
     talkingIslandManifestState.status='scene-ready';
    }).catch(err=>{
     verifiedTalkingIslandSceneError=String(err);
     talkingIslandManifestState.status='scene-error';
     talkingIslandManifestState.error=String(err);
    });
   }
   console.info('[P05-D30] Talking Island manifest',talkingIslandManifestState.status,data.landmarks.length+' candidate landmarks');
  })
  .catch(err=>{talkingIslandManifestState.status='error';talkingIslandManifestState.error=String(err);console.error('[P05-D30] Manifest load failed',err)});
}
window.talkingIslandManifestState=talkingIslandManifestState;
const sceneImageUrl=visualParams.get('sceneImage');
const historicalSceneImage=sceneImageUrl&&/^https:\/\//i.test(sceneImageUrl)?new Image():null;
let historicalSceneReady=false;
if(historicalSceneImage){
 historicalSceneImage.onload=()=>{historicalSceneReady=historicalSceneImage.naturalWidth>0&&historicalSceneImage.naturalHeight>0};
 historicalSceneImage.onerror=()=>{historicalSceneReady=false;console.error('[P05-D27] Scene image unavailable; no historical map loaded')};
 historicalSceneImage.src=sceneImageUrl;
}
// The four client sprite rows represent axes, shared by opposite headings.
const boltAxes={NW:[-1,0,0],N:[-1,-1,1],NE:[0,-1,2],E:[1,-1,3],
 SE:[1,0,0],S:[1,1,1],SW:[0,1,2],W:[-1,1,3]};
const boltScreenDirections=['E','SE','S','SW','W','NW','N','NE'];
function villageBoltFlightTicks({origin,target}){
 const dx=target.x-origin.x,dy=target.y-origin.y;
 return Math.hypot(2*(dx-dy),dx+dy)*10/6;
}
function resolveVillageBoltImpact(cast,elapsed,now){
 if(!cast?.combat||cast.impactResolved)return;
 if(cast.encounter!==villageTrial||cast.slot!==a37ActiveSlot||cast.scene!==verifiedTalkingIslandScene){cast.impactResolved=true;return;}
 const release=cast.sprite[0].frameEnds[5];
 if((elapsed-release)*24/1000<villageBoltFlightTicks(cast))return;
 cast.impactResolved=true;
 if(villageProgress()&&villageTrial?.phase==='fight'){
  // Taiwan 2.40 fallback: 8 + 1d10 base dice, without unverified 1.82 modifiers.
  const damage=9+Math.floor(Math.random()*10);
  applyVillageGoblinDamage(damage,now,'光箭命中哥布林',' 點傷害（2.40 基礎骰）');
 }
}
function advanceVillageCast(now,interrupted=false){
 const cast=villageCastPreview;
 if(!cast)return {casting:false,bolt:null};
 const elapsed=now-cast.startedAt,config=cast.sprite[0];
 const released=elapsed>=config.frameEnds[5];
 if(interrupted&&!released){villageCastPreview=null;return {casting:false,bolt:null};}
 if(interrupted)cast.animationInterrupted=true;
 if(released)resolveVillageBoltImpact(cast,elapsed,now);
 const bolt=villageBoltActor(cast,cast.facing,elapsed,verifiedTalkingIslandScene.boltImage);
 const casting=elapsed<config.frameEnds.at(-1);
 if(!casting&&!bolt)villageCastPreview=null;
 return {casting:casting&&!cast.animationInterrupted,bolt};
}
function villageBoltActor(cast,facing,elapsed,image){
 if(!cast||!cast.directional)return null;
 // The client marks release at frame 6 (zero-based) for both wizards.
 const release=cast.sprite[0].frameEnds[5];
 if(elapsed<release)return null;
 const ticks=(elapsed-release)*24/1000;
 const {origin,target}=cast;
 const dx=target.x-origin.x,dy=target.y-origin.y;
 const flightTicks=villageBoltFlightTicks(cast);
 if(ticks>=flightTicks)return null;
 const progress=ticks/flightTicks;
 const phase=ticks%10;
 const row=boltAxes[facing][2];
 const col=phase<3?0:phase<5?1:phase<8?2:3;
 return {image,x:origin.x+dx*progress,y:origin.y+dy*progress,width:64,height:64,
  offsetY:12,sourceRect:{x:col*64,y:row*64,width:64,height:64}};
}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);
 if(talkingIslandMode()&&verifiedTalkingIslandScene){
  const {renderer,movement,attack,goblin}=verifiedTalkingIslandScene;
  let {actor,spriteConfig}=verifiedTalkingIslandScene;
  const animation=movement.getAnimationState(),now=performance.now();
  const p=historicalVisualPosition(now),c=historicalVisualCamera(now);
  const visuallyMoving=animation.moving||Boolean(verifiedTalkingIslandStepFrom&&
    now-verifiedTalkingIslandLastStep<VERIFIED_SCENE_STEP_MS);
  // A turn begins on the first frame of the new direction, not an arbitrary
  // frame from the previous direction's walking cycle.
  if((visuallyMoving&&!verifiedTalkingIslandWasMoving)||
     (visuallyMoving&&verifiedTalkingIslandLastScreenFacing!==null&&
      animation.screenFacing!==verifiedTalkingIslandLastScreenFacing))
   verifiedTalkingIslandWalkStart=now;
  verifiedTalkingIslandLastScreenFacing=animation.screenFacing;
  verifiedTalkingIslandWasMoving=visuallyMoving;
  const attackElapsed=now-(villageTrial?.attackStartedAt??-Infinity);
  const attackDuration=villageAttackDuration(attack?.[0]);
  const attacking=attack&&!animation.moving&&attackElapsed>=0&&attackElapsed<attackDuration;
  const castElapsed=now-(villageCastPreview?.startedAt??-Infinity);
  const interrupted=visuallyMoving||attacking||villageTrial?.target;
  const {casting,bolt}=advanceVillageCast(now,interrupted);
  const pickupElapsed=now-(villageTrial?.pickupStartedAt??-Infinity);
  const pickingUp=pickupElapsed>=0&&pickupElapsed<(verifiedTalkingIslandScene.pickupSprite?.[0].frameEnds.at(-1)??0);
  if(pickingUp)[spriteConfig,actor]=verifiedTalkingIslandScene.pickupSprite;
  else if(attacking)[spriteConfig,actor]=attack;
  else if(villageCastPreview&&casting)[spriteConfig,actor]=villageCastPreview.sprite;
  let sourceRect;
  if(spriteConfig){
   const first=spriteConfig.walkStartsAt??0;
   let col=0;
   if(pickingUp)col=spriteConfig.frameEnds.findIndex(end=>pickupElapsed<end);
   else if(attacking)col=spriteConfig.frameEnds
    ? spriteConfig.frameEnds.findIndex(end=>attackElapsed<end)
    : Math.floor(attackElapsed/spriteConfig.frameDuration);
   else if(villageCastPreview&&casting)col=spriteConfig.frameEnds.findIndex(end=>castElapsed<end);
   else if(visuallyMoving)col=first+Math.floor((now-verifiedTalkingIslandWalkStart)/spriteConfig.frameDuration)%(spriteConfig.columns-first);
   const row=spriteConfig.directions.indexOf(animation.screenFacing);
   sourceRect={x:col*actor.naturalWidth/spriteConfig.columns,y:row*actor.naturalHeight/8,width:actor.naturalWidth/spriteConfig.columns,height:actor.naturalHeight/8};
  }
  const height=spriteConfig?.drawHeight??72;
  const width=spriteConfig?.drawHeight?height*sourceRect.width/sourceRect.height:48;
  const offsetY=height*(1-(spriteConfig?.footAnchorY??1));
  const actors=villageTrialActors(now,goblin),enemy=actors[0];
  if(verifiedTalkingIslandScene.dummy)actors.push(verifiedTalkingIslandScene.dummy);
  if(verifiedTalkingIslandScene.merchant)actors.push(verifiedTalkingIslandScene.merchant);
  const {teacher,roof,roofCells}=verifiedTalkingIslandScene;
  const underRoof=teacher&&roofCells.has(movement.position.x+','+movement.position.y);
  if(teacher)actors.push(underRoof?teacher:roof);
  if(bolt)actors.push(bolt);
  const draws=[],labels=[];
  const ground=new Set(renderer.scene.layers.filter(layer=>layer.depth===0).flatMap(layer=>layer.images));
  const onDraw=actors.length?(item,left,top)=>{
   if(!ground.has(item)&&item!==bolt)draws.push({item,left,top});
  }:undefined;
  renderer.render({cameraX:c.cameraX,cameraY:c.cameraY,actors,onDraw,player:{image:actor,x:p.x,y:p.y,width,height,offsetY,depth:1,...(sourceRect?{sourceRect}:{})}});
  if(enemy&&villageTrial.phase==='fight')labels.push({item:enemy,name:villageTrialTargetLabel(),
   font:'14px sans-serif',point:renderer.project(enemy.x,enemy.y,c.cameraX,c.cameraY),offset:36});
  displayedIslandFrame={camera:c,enemy,draws,labels};
  if(villageTrial)drawVillageTrial(renderer,c);
  if(underRoof){
   const label=renderer.project(teacher.x,teacher.y,c.cameraX,c.cameraY);
   ctx.save();ctx.font='14px Arial';ctx.textAlign='center';ctx.strokeStyle='#20190e';ctx.lineWidth=3;ctx.fillStyle='#f8df9e';
   labels.unshift({item:teacher,name:'吉倫',font:'14px Arial',point:label,offset:57});
   ctx.strokeText('吉倫',label.x,label.y-57);ctx.fillText('吉倫',label.x,label.y-57);ctx.restore();
  }
  if(verifiedTalkingIslandScene.merchant){
   const shop=renderer.project(PANDORA.x,PANDORA.y,c.cameraX,c.cameraY);
   ctx.save();ctx.font='14px Arial';ctx.textAlign='center';ctx.strokeStyle='#20190e';ctx.lineWidth=3;ctx.fillStyle='#f8df9e';
   labels.unshift({item:verifiedTalkingIslandScene.merchant,name:'潘朵拉',font:'14px Arial',point:shop,offset:62});
   ctx.strokeText('潘朵拉',shop.x,shop.y-62);ctx.fillText('潘朵拉',shop.x,shop.y-62);ctx.restore();
  }
 if(villageProgress()&&villageTrial.phase==='defeated'&&villageTrial.dropAvailable){
  const drop=villageDropPosition(c);
  ctx.save();
  ctx.textAlign='center';
  ctx.font='13px Arial';
  ctx.strokeStyle='#20190e';
  ctx.lineWidth=3;
  ctx.fillStyle='#f8df9e';
  ctx.strokeText('治癒藥水',drop.x,drop.y-9);
  ctx.fillText('治癒藥水',drop.x,drop.y-9);
  ctx.restore();
 }
  if(worldEntered&&player?.name){
   const foot=renderer.project(p.x,p.y,c.cameraX,c.cameraY);
   ctx.save();
   ctx.textAlign='center';
   ctx.font='14px Arial';
   ctx.fillStyle='#fff1c8';
   ctx.strokeStyle='#15120e';
   ctx.lineWidth=3;
   ctx.strokeText(player.name,foot.x,foot.y-62);
   ctx.fillText(player.name,foot.x,foot.y-62);
   ctx.restore();
  }
  ctx.textAlign='center';ctx.fillStyle='#f3dba2';ctx.font='12px Arial';
  ctx.fillText(localVillageEntered?'說話之島村莊｜跨版本素材行走預覽':'已核實場景行走測試｜點擊可行走格移動',canvas.width/2,canvas.height-48);
  return;
 }
 if(visualParams.get('historicalMode')==='1'&&!historicalSceneImage&&verifiedTalkingIslandImageReady){
  ctx.fillStyle='#141414';ctx.fillRect(0,0,canvas.width,canvas.height);
  const im=verifiedTalkingIslandImage;
  const scale=Math.min(canvas.width/im.naturalWidth,canvas.height/im.naturalHeight);
  const w=im.naturalWidth*scale,h=im.naturalHeight*scale;
  // P05-D40: display source imagery in screen space; no invented world geometry.
  if(typeof TalkingIslandLayerRenderer==='function'){
   const renderer=new TalkingIslandLayerRenderer(canvas);
   renderer.renderReferenceImage(im);
  }else{
   ctx.drawImage(im,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  }
  ctx.textAlign='center';ctx.fillStyle='#f3dba2';ctx.font='12px Arial';
  ctx.fillText('已核實場景圖片預覽｜碰撞及人物遮擋尚未完成',canvas.width/2,canvas.height-20);
  return;
 }
 if(visualParams.get('historicalMode')==='1'&&!historicalSceneImage){
  ctx.fillStyle='#141414';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign='center';ctx.font='16px Arial';ctx.fillStyle='#f3dba2';
  ctx.fillText('說話之島：正式地圖素材尚未載入',canvas.width/2,canvas.height/2);
  ctx.font='12px Arial';ctx.fillStyle='#d0c5aa';
  ctx.fillText('此模式不會將隨機測試地形冒充原版場景',canvas.width/2,canvas.height/2+26);
  const st=talkingIslandManifestState;
  const detail=st.status==='loading'?'正在讀取地圖資料…':st.status==='error'?'地圖資料載入失敗':st.status==='awaiting-verified-assets'?'地圖資料已載入；原版素材與地標尚未驗證':st.status==='scene-error'?'核實場景載入失敗：'+(verifiedTalkingIslandSceneError||'未知錯誤'):st.status==='ready'?'地圖資料驗證完成，正在載入圖層':'尚未要求載入地圖資料';
  ctx.fillText(detail,canvas.width/2,canvas.height/2+52);
  if(st.manifest)ctx.fillText('候選地標：'+st.manifest.landmarks.length+'｜已核實：'+st.manifest.landmarks.filter(p=>p.verified===true).length,canvas.width/2,canvas.height/2+75);
  return;
 }
 if(historicalSceneImage){
  ctx.fillStyle='#141414';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(historicalSceneReady){
   // A single image is only a visual reference layer, NOT collision-ready
   // world map. Do not claim that movement or coordinates are validated.
   const scale=Math.min(canvas.width/historicalSceneImage.naturalWidth,canvas.height/historicalSceneImage.naturalHeight);
   const w=historicalSceneImage.naturalWidth*scale,h=historicalSceneImage.naturalHeight*scale;
   ctx.drawImage(historicalSceneImage,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  }
  ctx.textAlign='center';ctx.fillStyle='#f3dba2';ctx.font='12px Arial';
  ctx.fillText(historicalSceneReady?'歷史圖片比對模式｜非可行走地圖':'圖片載入中或來源不可用｜非可行走地圖',canvas.width/2,canvas.height-20);
  return;
 }
ctx.fillStyle='#1a241c';ctx.fillRect(0,0,canvas.width,canvas.height);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let p=screen(x,y);if(p.x<-TW||p.x>canvas.width+TW||p.y<-TH*3||p.y>canvas.height+TH)continue;let type=tile[y][x];diamond(p.x,p.y,{grass:'#42543a',dirt:'#655c42',water:'#2d5260',bridge:'#776348',tree:'#42543a',rock:'#42543a'}[type]);
// P05-D10: terrain decorations share the map tile's scale, anchored at the
// ground contact point. This keeps trees, rocks and textures in proportion
// during visual calibration; no substitute artwork is introduced.
// Terrain transitions already use scaled TW/TH; draw before the transform.
terrainDetails(x,y,p,type);
ctx.save();
ctx.translate(p.x,p.y+TH/2);
ctx.scale(MAP_VISUAL_SCALE,MAP_VISUAL_SCALE);
ctx.translate(-p.x,-(p.y+TH/2));
// Small deterministic ground texture: no gameplay RNG or tile data changes.
if(type==='grass'||type==='dirt'){
 const h=((x*73856093)^(y*19349663))>>>0;
 ctx.fillStyle=type==='grass'?'#77875a44':'#9e89624d';
 for(let i=0;i<8;i++){
  const ox=((h>>((i*3)%23))&31)-15,oy=((h>>((i*5+3)%23))&15)-7;
  ctx.fillRect(p.x+ox,p.y+TH/2+oy,1.5,1.5);
 }
}
if(type==='water'){
 ctx.strokeStyle='#91bac055';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(p.x-11,p.y+TH/2-2);ctx.lineTo(p.x-2,p.y+TH/2-2);ctx.moveTo(p.x+4,p.y+TH/2+3);ctx.lineTo(p.x+12,p.y+TH/2+3);ctx.stroke();
}
if(type==='bridge'){
 ctx.strokeStyle='#5a4934aa';ctx.lineWidth=1;
 for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(p.x-17,p.y+TH/2+i*4);ctx.lineTo(p.x+17,p.y+TH/2+i*4);ctx.stroke()}
}
if(type==='tree'){ctx.fillStyle='#433e29';ctx.fillRect(p.x-3,p.y-13,6,22);ctx.beginPath();ctx.arc(p.x,p.y-18,13,0,7);ctx.fillStyle='#214b2b';ctx.fill()}if(type==='rock'){ctx.fillStyle='#a3a79b';ctx.beginPath();ctx.moveTo(p.x-10,p.y+8);ctx.lineTo(p.x-6,p.y-8);ctx.lineTo(p.x+6,p.y-13);ctx.lineTo(p.x+12,p.y+8);ctx.fill()}ctx.restore()}// P05-D17: drops follow terrain scale; monster actors follow character scale.
// These remain placeholders, NOT approved original-era monster/item art.
for(let d of drops){let p=screen(d.x,d.y);ctx.save();ctx.translate(p.x,p.y);ctx.scale(MAP_VISUAL_SCALE,MAP_VISUAL_SCALE);ctx.fillStyle='#e9c85d';ctx.fillRect(-5,-5,10,10);ctx.restore()}
for(let m of monsters){if(!m.alive)continue;let p=screen(m.x,m.y);ctx.save();ctx.translate(p.x,p.y);ctx.scale(CHARACTER_VISUAL_SCALE,CHARACTER_VISUAL_SCALE);ctx.fillStyle='#773b2b';ctx.fillRect(-8,-21,16,22);ctx.fillStyle='#a7a37a';ctx.beginPath();ctx.arc(0,-24,8,0,7);ctx.fill();ctx.fillStyle='#151515';ctx.fillRect(-14,-36,28,4);ctx.fillStyle='#c74c45';ctx.fillRect(-14,-36,28*Math.max(0,m.hp/m.max),4);if(target&&target.ref===m){ctx.strokeStyle='#f1d377';ctx.strokeRect(-13,-38,26,36)}ctx.restore()}if(player){let now=performance.now();let p=knightRenderPosition(now); drawCharacterSprite(p,now);ctx.fillStyle='#fff1c8';ctx.font='14px Arial';ctx.textAlign='center';ctx.fillText(player.name,p.x,p.y-55*CHARACTER_VISUAL_SCALE)}ctx.fillStyle='#e6ddbd';ctx.textAlign='left';ctx.font='13px Arial';void 0}initializeKnightPreview();requestAnimationFrame(loop);

/* v0.05-Y: artwork substitution hooks; URLs must be separately authorized. */
window.lineageCreationArt={
 setBackground(url){const v=typeof url==='string'&&/^https:\/\//.test(url)?'url('+JSON.stringify(url)+')':null;document.documentElement.style.setProperty('--classic-creation-background',v||'var(--creation-fallback-background)')},
 setParchment(url){const v=typeof url==='string'&&/^https:\/\//.test(url)?'url('+JSON.stringify(url)+')':null;document.documentElement.style.setProperty('--classic-parchment-image',v||'var(--creation-fallback-parchment)')}
};

/* v0.06-F2: account for iOS browser bars and visual viewport; do not change meta viewport. */
(function(){
 const vp=document.querySelector('meta[name="viewport"]');
 const defaultMeta=vp?.content||'width=device-width,initial-scale=1,viewport-fit=cover';
 function fitCreationScreen(){
  const landscape=innerWidth>innerHeight;
  const mobile= navigator.maxTouchPoints>0 && landscape && Math.min(screen.width,screen.height)<701;
  document.documentElement.classList.toggle('creation-mobile-landscape',mobile);
  if(vp){const desired=mobile?'width=1260,initial-scale=1,maximum-scale=1,viewport-fit=cover':defaultMeta;if(vp.content!==desired){vp.content=desired;requestAnimationFrame(fitCreationScreen);return;}}
  const vv=window.visualViewport;
  const width=vv?.width||innerWidth, height=vv?.height||innerHeight;
  const scale=mobile?Math.min(width/1260,height/726)*0.83:Math.max(innerWidth/1260,innerHeight/726);
  document.documentElement.style.setProperty('--creation-cover-scale',String(scale));
  document.documentElement.style.setProperty('--creation-mobile-scale',String(scale));
 }
 addEventListener('resize',fitCreationScreen,{passive:true});
 addEventListener('orientationchange',fitCreationScreen,{passive:true});
 window.visualViewport?.addEventListener('resize',fitCreationScreen,{passive:true});
 fitCreationScreen();
})();

/* Fit the entire character selection stage without cropping its action buttons. */
(function(){function fit(){const vv=window.visualViewport;const w=vv?.width||innerWidth,h=vv?.height||innerHeight;document.documentElement.style.setProperty('--selection-stage-scale',String(Math.min(w/1104,h/824)));}addEventListener('resize',fit,{passive:true});window.visualViewport?.addEventListener('resize',fit,{passive:true});fit();})();

function a17rRefresh(){
 document.body.classList.toggle('a17r-world',!!player&&worldEntered);
 document.getElementById('a17rHeal').disabled=localVillageEntered&&!villageProgress();
 document.getElementById('a17rSave').disabled=localVillageEntered&&!villageProgress();
 if(!player)return;
 const put=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
 put('a17rName','等級 '+player.lv);
 const experience=villageTrial&&!villageProgress()?villageTrial.exp:player.xp;
 const experienceNeeded=p03ExpNeeded(player.lv);
 put('a17rExp',Math.floor(100*experience/Math.max(1,experienceNeeded))+'%');
 const hp=villageProgress()?player.hp:villageTrial?.playerHp??player.hp;
 const maxHp=villageTrial&&!villageProgress()?TRIAL_PLAYER_HP:player.maxHp;
 const potionSlot=document.querySelector('#a17rSlots > span');
 const moneySlot=potionSlot?.nextElementSibling;
 if(moneySlot){
  const count=villageProgress()||verifiedTalkingIslandScene?.teacher?shopBalance():0;
  moneySlot.classList.toggle('item-money',count>0);
  moneySlot.textContent=count>0?String(count):'';
  moneySlot.title=count>0?'天幣 ×'+count:'';
 }
 if(potionSlot){
  potionSlot.classList.toggle('item-potion',player.pots>0);
  potionSlot.textContent=player.pots>0?String(player.pots):'';
  potionSlot.title=player.pots>0?'治癒藥水 ×'+player.pots:'';
  potionSlot.draggable=player.pots>0;
 }
 refreshItemHotkeys();
 put('a17rHp',hp+'/'+maxHp);const mp=verifiedTalkingIslandScene?.previewMp??player.mp;
 put('a17rMp',mp+'/'+player.maxMp);
 if(document.getElementById('characterStatusDialog').open)refreshCharacterStatus();
 document.getElementById('a17rHpFill').style.width=(100*hp/Math.max(1,maxHp))+'%';
 document.getElementById('a17rMpFill').style.width=(100*mp/Math.max(1,player.maxMp))+'%';
 const log=document.getElementById('log'),chat=document.getElementById('a17rChat');
 if(log&&chat)chat.textContent=log.innerText||'2004 年《天與地》介面還原測試';
}
function setInventoryOpen(open){
 const panel=document.getElementById('a17rInventory');
 const trigger=document.getElementById('a17rBag');
 const restoreFocus=!open&&panel.contains(document.activeElement);
 panel.classList.toggle('a17r-open',open);
 trigger.setAttribute('aria-expanded',String(open));
 if(restoreFocus)trigger.focus();
}
function closeActiveGamePanel(){
 if(!worldEntered)return false;
 const inventory=document.getElementById('a17rInventory');
 const spellbook=document.getElementById('spellbookWindow');
 if(!spellbook.hidden&&!inventory.contains(document.activeElement)){
  setSpellbookOpen(false);
  return true;
 }
 if(inventory.classList.contains('a17r-open')){
  setInventoryOpen(false);
  return true;
 }
 return false;
}
document.getElementById('a17rBag').onclick=()=>{
 const open=document.getElementById('a17rInventory').classList.contains('a17r-open');
 setInventoryOpen(!open);
};
document.getElementById('a17rCloseInventory').onclick=document.getElementById('a17rCloseBag').onclick=()=>setInventoryOpen(false);
document.getElementById('a17rHeal').onclick=()=>document.getElementById('heal').click();
document.getElementById('a17rSave').onclick=()=>document.getElementById('save').click();
function refreshCharacterStatus(){
 const get=id=>document.getElementById(id);
 get('characterStatusLevel').textContent=player.lv;
 get('characterStatusExperience').textContent=get('a17rExp').textContent;
 get('characterStatusHp').textContent=get('a17rHp').textContent;
 get('characterStatusMp').textContent=get('a17rMp').textContent;
 get('characterStatusStats').replaceChildren(...creationStatNames.map((label,index)=>{
  const value=document.createElement('output');
  value.setAttribute('aria-label',label.split(' ')[0]);
  value.textContent=player.stats?.[index]??'';
  return value;
 }));
}
document.getElementById('a17rStatus').onclick=()=>{
 if(!worldEntered||!player)return;
 const dialog=document.getElementById('characterStatusDialog');
 if(dialog.open)return;
 refreshCharacterStatus();
 dialog.showModal();
};
const ENERGY_BOLT_MP = 3;
const ENERGY_BOLT_ID='energy-bolt';
const GERENG_LEARN_PRICE=100;

function knowsEnergyBolt(character){
 return Array.isArray(character?.learnedSpells)&&character.learnedSpells.includes(ENERGY_BOLT_ID);
}

function learnEnergyBolt(character){
 if(character.job!=='法師'||character.lv<4)return {message:'法師需達 4 級。'};
 if(knowsEnergyBolt(character))return {message:'已學會光箭。'};
 const adena=character.adena??80;
 if(!Number.isSafeInteger(adena)||adena<GERENG_LEARN_PRICE)return {message:'天幣不足。'};
 return {player:{...character,adena:adena-GERENG_LEARN_PRICE,
  learnedSpells:[...(Array.isArray(character.learnedSpells)?character.learnedSpells:[]),ENERGY_BOLT_ID]}};
}

function openGerengDialogue(){
 const dialog=document.getElementById('gerengDialog');
 if(!worldEntered||!verifiedTalkingIslandScene?.teacher||dialog.open)return;
 verifiedTalkingIslandMovement.cancel();
 document.getElementById('gerengMessage').textContent='';
 dialog.showModal();
}
document.getElementById('gerengLearnBolt').onclick=()=>{
 const dialog=document.getElementById('gerengDialog');
 const teacher=verifiedTalkingIslandScene?.teacher;
 if(!dialog.open||!worldEntered||!teacher||!player)return;
 const {x,y}=verifiedTalkingIslandMovement.position;
 if(Math.max(Math.abs(x-teacher.x),Math.abs(y-teacher.y))>1)return;
 const status=document.getElementById('gerengMessage');
 const result=learnEnergyBolt(player);
 if(!result.player){status.textContent=result.message;return;}
 if(!commitVillagePlayer(result.player)){
  status.textContent='儲存失敗，請檢查瀏覽器設定。';return;
 }
 status.textContent='已學會光箭。';
 if(!document.getElementById('spellbookWindow').hidden)setSpellbookOpen(true);
 update();
};
let villageSpellTargeting = false;

function setVillageSpellTargeting(active){
 villageSpellTargeting=active;
 document.getElementById('spellbookEnergyBolt').setAttribute('aria-pressed',String(active));
}

function targetVillageSpell(sx,sy){
 const dummy=verifiedTalkingIslandScene?.dummy;
 if(!dummy&&(!villageProgress()||!knowsEnergyBolt(player)))return false;
 const hit=pickVillageActor(sx,sy,true);
 if(hit!==(dummy?'dummy':'enemy'))return false;
 const target=dummy??VILLAGE_TRIAL_ENEMY;
 setVillageSpellTargeting(false);
 return playVillageCastPreview(true,target);
}

function playVillageCastPreview(directional,target=verifiedTalkingIslandScene?.dummy){
 const scene=verifiedTalkingIslandScene;
 const movement=verifiedTalkingIslandMovement;
 if(!worldEntered||!scene?.casts||!target||!player||!movement)return false;
 const preview=target===scene.dummy;
 if(!preview&&(!directional||!villageProgress()||!knowsEnergyBolt(player)||villageTrial.phase!=='fight'))return false;
 if(movement.moving||villageCastPreview||villageTrial?.target||villageTrial?.pickup||
    (verifiedTalkingIslandStepFrom&&performance.now()-verifiedTalkingIslandLastStep<VERIFIED_SCENE_STEP_MS))return false;
 const now=performance.now();
 const attackDuration=villageAttackDuration(scene.attack?.[0]);
 if(now-(villageTrial?.attackStartedAt??-Infinity)<attackDuration)return false;
 const origin={...movement.position};
 if(directional){
  if(origin.x===target.x&&origin.y===target.y)return false;
  const available=preview?scene.previewMp:player.mp;
  if(available<ENERGY_BOLT_MP){msg('魔力不足');update();return false;}
  const dx=target.x-origin.x,dy=target.y-origin.y;
  const angle=Math.atan2(dx+dy,2*(dx-dy));
  const [fx,fy]=boltAxes[boltScreenDirections[(Math.round(angle/(Math.PI/4))+8)%8]];
  movement.face(origin.x+fx,origin.y+fy);
  if(preview)scene.previewMp-=ENERGY_BOLT_MP;
  else {player.mp-=ENERGY_BOLT_MP;msg('施放光箭，消耗 3 MP。');}
 }
 villageCastPreview={origin,target:{x:target.x,y:target.y},sprite:scene.casts[directional?0:1],
  startedAt:now,directional,combat:!preview,facing:movement.getScreenFacing(),encounter:villageTrial,slot:a37ActiveSlot,scene};
 if(directional)update();
 return true;
}

function setSpellbookOpen(open){
 const spell=document.getElementById('spellbookEnergyBolt');
 const scene=verifiedTalkingIslandScene;
 const learned=knowsEnergyBolt(player);
 spell.hidden=!open||!(scene?.dummy||learned);
 spell.disabled=!scene?.casts||!(scene.dummy||learned);
 spell.draggable=open&&learned&&!spell.disabled;
 if(!spell.hidden){
  spell.title='光箭（'+ENERGY_BOLT_MP+' MP）';
  spell.setAttribute('aria-label',spell.title);
 }

 const panel=document.getElementById('spellbookWindow');
 const trigger=document.getElementById('a17rSpellbook');
 const restoreFocus=!open&&panel.contains(document.activeElement);
 panel.hidden=!open;
 trigger.setAttribute('aria-expanded',String(open));
 if(restoreFocus)trigger.focus();
}
document.getElementById('a17rSpellbook').onclick=()=>{
 if(worldEntered)setSpellbookOpen(document.getElementById('spellbookWindow').hidden);
};
document.getElementById('spellbookClose').onclick=()=>setSpellbookOpen(false);
function selectEnergyBolt(){
 const scene=verifiedTalkingIslandScene;
 if(!worldEntered||!scene?.casts||!(scene.dummy||knowsEnergyBolt(player)))return;
 if(!scene.dummy&&villageTrial?.phase!=='fight'){msg('目前沒有可選的哥布林。');update();return;}
 setVillageSpellTargeting(true);
 msg(scene.dummy?'光箭：點選木人，Esc 取消。':'光箭：點選哥布林，Esc 取消。');
 update();
}
const energyBoltButton=document.getElementById('spellbookEnergyBolt');
energyBoltButton.onclick=selectEnergyBolt;
energyBoltButton.ondragstart=event=>{
 if(!worldEntered||!knowsEnergyBolt(player)){event.preventDefault();return;}
 event.dataTransfer.setData('application/x-lineage-energy-bolt',ENERGY_BOLT_ID);
};
document.getElementById('a17rHelp').onclick=()=>{const d=document.getElementById('desktopGameHelp');d.hidden=!d.hidden;};
document.getElementById('a17rReturn').onclick=()=>document.getElementById('returnToCharacterSelect').click();
document.getElementById('a17rChatSize').onclick=event=>{
 const expanded=document.getElementById('a17rBar').classList.toggle('a17r-chat-expanded');
 event.currentTarget.setAttribute('aria-expanded',String(expanded));
};
document.getElementById('a17rSlots').innerHTML='<span></span>'.repeat(32);
var itemHotkeys=document.getElementById('itemHotkeys');
function actionHotkeyKind(character,slot){
 if(character?.potionHotkey===slot)return 'potion';
 if(character?.energyBoltHotkey===slot&&knowsEnergyBolt(character))return 'bolt';
 return null;
}
function assignActionHotkey(character,slot,kind){
 if(!character||!Number.isInteger(slot)||slot<0||slot>=8)return false;
 if(kind==='potion'&&character.pots>0){
  character.potionHotkey=slot;
  if(character.energyBoltHotkey===slot)delete character.energyBoltHotkey;
 }else if(kind==='bolt'&&knowsEnergyBolt(character)){
  character.energyBoltHotkey=slot;
  if(character.potionHotkey===slot)delete character.potionHotkey;
 }else return false;
 return true;
}
function useActionHotkey(slot){
 if(!worldEntered)return false;
 const kind=actionHotkeyKind(player,slot);
 if(kind==='potion')document.getElementById('a17rHeal').click();
 if(kind==='bolt')selectEnergyBolt();
 return kind!==null;
}
function refreshItemHotkeys(){
 if(!itemHotkeys)return;
 for(const [slot,button] of Array.from(itemHotkeys.children).entries()){
  const kind=actionHotkeyKind(player,slot);
  button.classList.toggle('item-potion',kind==='potion');
  button.classList.toggle('item-energy-bolt',kind==='bolt');
  button.lastElementChild.textContent=kind==='potion'?String(player.pots):'';
  button.setAttribute('aria-label','F'+(slot+5)+(kind==='potion'?' 治癒藥水':kind==='bolt'?' 光箭':' 空白'));
  button.title=button.getAttribute('aria-label');
 }
}
for(let slot=0;slot<8;slot++){
 const button=document.createElement('button');
 button.type='button';
 const key=document.createElement('kbd');
 key.textContent='F'+(slot+5);
 button.append(key,document.createElement('span'));
 button.onclick=()=>useActionHotkey(slot);
 button.ondragover=event=>{
  if(event.dataTransfer.types.some(type=>type==='application/x-lineage-potion'||type==='application/x-lineage-energy-bolt'))event.preventDefault();
 };
 button.ondrop=event=>{
  event.preventDefault();
  if(!worldEntered)return;
  const data=event.dataTransfer;
  const kind=data.getData('application/x-lineage-energy-bolt')===ENERGY_BOLT_ID?'bolt':
   data.getData('application/x-lineage-potion')==='healing'?'potion':null;
  if(assignActionHotkey(player,slot,kind))refreshItemHotkeys();
 };
 itemHotkeys.append(button);
}
const healingPotionSlot=document.querySelector('#a17rSlots > span');
healingPotionSlot.ondblclick=()=>{
 if(worldEntered&&player?.pots>0)document.getElementById('a17rHeal').click();
};
healingPotionSlot.ondragstart=event=>{
 if(!worldEntered||!player?.pots){event.preventDefault();return;}
 event.dataTransfer.setData('application/x-lineage-potion','healing');
};

window.addEventListener('keydown',e=>{if(!worldEntered||(document.getElementById('gerengDialog').open||document.getElementById('villageShop').open||document.getElementById('characterStatusDialog').open||document.getElementById('leaveGameDialog').open))return;if(e.key==='Tab'&&!e.target.matches('input,textarea')){e.preventDefault();document.getElementById('a17rBag').click();}});
