const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../v182-p05-windows/assets/script-2.js');
require('../v182-p05-windows/assets/local-hunt.js');

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
