const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
require('../v182-p05-windows/assets/script-2.js');
require('../v182-p05-windows/assets/local-hunt.js');

test('seven hunt spawns are reachable and fit their idle frames in the initial camera',()=>{
 const dir=path.join(__dirname,'../v182-p05-windows/assets');
 const canvas={width:800,height:600,getContext:()=>({})};
 const c=vm.createContext({
  document:{getElementById:id=>id==='field'?canvas:{}},requestAnimationFrame(){},
  data:JSON.parse(fs.readFileSync(path.join(dir,'shop-scene.json'),'utf8')),
 });
 for(const script of ['script-1','script-2','hunt-test'])
  vm.runInContext(fs.readFileSync(path.join(dir,script+'.js'),'utf8'),c);
 const result=vm.runInContext(`
  renderer.tileWidth=data.tileSize.width;
  renderer.tileHeight=data.tileSize.height;
  renderer.setScene({bounds:data.bounds,layers:[]});
  renderer.setCollision(data);
  const initial=new TalkingIslandMovementController(renderer);
  initial.spawn(data.spawn.x,data.spawn.y);
  const frames=[{x:-24,y:-65,width:72,height:84}];
  const sprites=Array.from({length:7},()=>({clips:{idle:Array(8).fill(frames)}}));
  const cameraStart=initial.camera();
  spawnCells(data,sprites,initial).map(({x,y})=>({
   ...renderer.project(x,y,cameraStart.cameraX,cameraStart.cameraY),reachable:initial.moveTo(x,y),
  }));
 `,c);
 assert.equal(result.length,7);
 for(const p of result){
  assert.ok(p.reachable);
  assert.ok(p.x-24>=0&&p.x+48<=800&&p.y-87>=0&&p.y+19<=600);
 }
});

test('archer attacks from range while melee pursues, and defeats respawn independently',()=>{
 const renderer={
  scene:{},project(){},
  canWalk:(x,y)=>x>=0&&x<20&&y>=0&&y<20,
  canStep(x,y,nx,ny){return this.canWalk(nx,ny)&&Math.max(Math.abs(x-nx),Math.abs(y-ny))===1;},
 };
 const shots=[];
 const hunt=lineageLocalHunt.create(renderer,[
  {kind:'monster',spriteId:56},{kind:'monster',spriteId:1096},
 ],[{x:1,y:1},{x:5,y:4}],actor=>shots.push(actor.sprite.spriteId));
 const [melee,archer]=hunt.actors;
 hunt.step({x:5,y:1},0);
 assert.equal(melee.action,'walk');
 assert.equal(archer.action,'attack');
 assert.deepEqual(archer.movement.position,{x:5,y:4});
 hunt.step({x:5,y:1},750);
 assert.deepEqual(shots,[1096]);
 const {x,y}=melee.movement.position;
 assert.equal(hunt.strike(melee,{x:x-1,y},800),true);
 assert.equal(melee.action,'hit');
 assert.equal(hunt.strike(melee,{x:x-1,y},1000),true);
 assert.equal(melee.action,'death');
 assert.equal(hunt.strike(melee,{x:x-1,y},1200),false);
 hunt.step({x:19,y:19},5500);
 assert.equal(melee.action,'idle');
 assert.equal(melee.hits,0);
 assert.deepEqual(melee.movement.position,{x:1,y:1});
 assert.notEqual(archer.action,'death');
});
