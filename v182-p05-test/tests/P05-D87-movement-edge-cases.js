/* P05-D87: movement edge-case regression, using existing renderer/controller.
 * Run in browser after loading the two existing map scripts.
 * No original assets or gameplay data are modified.
 */
(function(root){
'use strict';
function runMovementEdgeCases(){
 const failures=[];
 const assert=(name,condition)=>{if(!condition)failures.push(name)};
 const canvas={width:800,height:600,getContext(){return {clearRect(){},fillRect(){},drawImage(){},set fillStyle(v){}}}};
 const bounds={minX:0,minY:0,maxX:6,maxY:6};
 const renderer=new root.TalkingIslandLayerRenderer(canvas);
 renderer.setScene({bounds,layers:[]});
 renderer.setCollision({bounds,blockedCells:[]});
 const movement=new root.TalkingIslandMovementController(renderer);
 movement.spawn(1,1);
 assert('initial destination',movement.moveTo(5,5));
 assert('route replaced',movement.moveTo(2,1)&&movement.route.length===1);
 assert('step to replacement',movement.step()&&movement.position.x===2&&movement.position.y===1);
 assert('idle after arrival',!movement.moving&&!movement.step());
 movement.spawn(1,1);
 assert('diagonal route',movement.moveTo(2,2)&&movement.route.length===1);
 renderer.setCollision({bounds,blockedCells:[[2,1]]});
 assert('dynamic corner obstruction stops movement',!movement.step()&&movement.position.x===1&&movement.position.y===1&&movement.route.length===0);
 renderer.setCollision({bounds,blockedCells:[[2,1],[1,2]]});
 assert('sealed corner cannot be crossed',!movement.moveTo(2,2)&&movement.route.length===0);
 renderer.setCollision({bounds,blockedCells:[]});
 movement.spawn(3,3);
 assert('same cell is valid idle destination',movement.moveTo(3,3)&&movement.route.length===0);
 const camera=movement.camera();
 const p=renderer.project(4,3,camera.cameraX,camera.cameraY);
 const picked=movement.pick(p.x,p.y,camera.cameraX,camera.cameraY);
 assert('camera offset picking',!!picked&&picked.x===4&&picked.y===3);
 assert('out-of-canvas pick rejected',movement.pick(-1,10,camera.cameraX,camera.cameraY)===null);
 assert('cancel clears movement',movement.moveTo(6,6)&&(movement.cancel(),!movement.moving&&movement.route.length===0));
 return {passed:10-failures.length,failed:failures.length,failures};
}
root.runTalkingIslandMovementEdgeCases=runMovementEdgeCases;
})(typeof window!=='undefined'?window:globalThis);
