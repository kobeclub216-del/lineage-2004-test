
/* A12: desktop entry trace; visible regardless of game panel position. */
(function(){
 const b=document.getElementById('enterGame');if(!b)return;
 const diag=document.createElement('div');diag.id='a12Diagnostics';diag.setAttribute('role','status');diag.style.cssText='position:fixed;left:10px;top:10px;z-index:2147483647;background:#15100ef2;border:1px solid #b18a43;color:#ffe5a5;padding:8px;font:14px sans-serif;max-width:90vw;display:none;pointer-events:none';document.body.appendChild(diag);
 function report(t){diag.style.display='block';diag.textContent='A12 診斷：'+t;}
 b.addEventListener('pointerdown',()=>report('按鈕已接收滑鼠/觸控事件'),true);
 b.addEventListener('click',()=>{report('已點擊，準備切換');setTimeout(()=>{const panel=document.getElementById('characterSelect');const c=document.getElementById('c');report('選角畫面 '+(panel.hidden?'已關閉':'仍開啟')+'；地圖畫布 '+(c&&c.getBoundingClientRect().width>0?'存在':'未顯示')+'；遊戲狀態 '+(typeof worldEntered!=='undefined'&&worldEntered?'已進入':'未進入'));},250);},false);
 window.addEventListener('error',e=>report('程式錯誤：'+e.message));
 window.addEventListener('unhandledrejection',e=>report('執行錯誤：'+String(e.reason)));
})();
