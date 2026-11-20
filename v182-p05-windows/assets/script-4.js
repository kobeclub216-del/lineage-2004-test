
/* A10: surface a visible desktop diagnostic if the click does not enter the world. */
(function(){
 const b=document.getElementById('enterGame');if(!b)return;
 b.addEventListener('click',function(){
  if(!window.worldEntered && !document.getElementById('characterSelect').hidden){
   const p=document.getElementById('characterSelect');
   let note=document.getElementById('a10EnterStatus');
   if(!note){note=document.createElement('div');note.id='a10EnterStatus';note.style.cssText='position:absolute;right:3%;bottom:1%;z-index:120;color:#ffe0a0;font:12px sans-serif;text-shadow:0 1px 2px black';p.appendChild(note)}
   note.textContent='進入遊戲未完成，請回報此訊息';
  }
 });
})();
