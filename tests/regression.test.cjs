const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'v182-p05-windows');
const source=fs.readFileSync(path.join(dir,'assets/script-3.js'),'utf8');
// Execute the functions from the shipped source, never a copied implementation.
function functionSource(name){
 const start=source.indexOf('function '+name+'(');
 assert.ok(start>=0,'missing shipped function '+name);
 for(let end=source.indexOf('}',start);end>=0;end=source.indexOf('}',end+1)){
  const candidate=source.slice(start,end+1);
  try{new vm.Script(candidate);return candidate;}catch{}
 }
 throw Error('Cannot parse '+name);
}
function context(names,state={}){
 const c=vm.createContext({structuredClone,Math,Number,performance:{now:()=>0},...state});
 for(const name of names)vm.runInContext(functionSource(name),c);
 return c;
}
function scene(){
 const draws=[];
 const canvas={width:800,height:600,getContext:()=>({clearRect(){},fillRect(){},drawImage:(...x)=>draws.push(x)})};
 const c=vm.createContext({});
 for(const n of [1,2])vm.runInContext(fs.readFileSync(path.join(dir,'assets/script-'+n+'.js'),'utf8'),c);
 const r=new c.TalkingIslandLayerRenderer(canvas);
 const bounds={minX:0,minY:0,maxX:8,maxY:8};
 r.setScene({bounds,layers:[]});r.setCollision({bounds,blockedCells:[]});
 const m=new c.TalkingIslandMovementController(r);m.spawn(3,3);
 return {r,m,c,draws,bounds};
}
test('all six shipped scripts compile',()=>{
 for(let i=1;i<=6;i++)new vm.Script(fs.readFileSync(path.join(dir,'assets/script-'+i+'.js'),'utf8'));
});
test('all 61 supplied image/font assets retain their exact bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'assets/manifest.json')));
 assert.equal(manifest.assets.length,61);
 for(const asset of manifest.assets){
  const bytes=fs.readFileSync(path.join(dir,asset.path));
  assert.equal(bytes.length,asset.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);
 }
});
test('every local HTML/script asset reference resolves',()=>{
 const files=fs.readdirSync(dir).filter(n=>n.endsWith('.html')).map(n=>path.join(dir,n));
 files.push(path.join(dir,'assets/script-3.js'));
 for(const f of files){
  const text=fs.readFileSync(f,'utf8');
  for(const m of text.matchAll(/(?:\.\/)?assets\/[a-f0-9]{20}\.(?:png|webp|woff)|\.\/assets\/script-\d+\.js/g))
   assert.ok(fs.existsSync(path.join(dir,m[0])),m[0]);
 }
 const html=fs.readFileSync(path.join(dir,'Start.html'),'utf8');
 assert.match(html,/aspect-ratio:4\/3/);
 for(const id of ['a47Home','characterSelect','modal','villageShop','gerengDialog','spellbookWindow'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
for(const [dx,dy,expected] of [[0,-1,'NE'],[1,-1,'E'],[1,0,'SE'],[1,1,'S'],[0,1,'SW'],[-1,1,'W'],[-1,0,'NW'],[-1,-1,'N']]){
 test('grid step '+dx+','+dy+' selects screen animation '+expected,()=>{
  const {m}=scene();assert.ok(m.moveTo(3+dx,3+dy));assert.ok(m.step());
  assert.equal(m.getScreenFacing(),expected);assert.equal(m.moving,false);
  m.face(3+10*dx,3+10*dy);assert.equal(m.getScreenFacing(),expected);
 });
}
test('diagonal routing cannot cut a blocked cell or blocked edge',()=>{
 const {r,m,bounds}=scene();
 r.setCollision({bounds,blockedCells:[[4,3]],blockedEdges:[[3,3,3,4]]});
 assert.equal(r.canStep(3,3,4,4),false);
 assert.ok(m.moveTo(4,4));
 let prev={...m.position};
 while(m.moving){assert.ok(m.step());assert.ok(r.canStep(prev.x,prev.y,m.position.x,m.position.y));prev={...m.position};}
});
test('collision changes during an existing route stop the next illegal step',()=>{
 const {r,m,bounds}=scene();assert.ok(m.moveTo(4,4));
 r.setCollision({bounds,blockedCells:[[4,3]]});
 assert.equal(m.step(),false);assert.equal(m.position.x,3);assert.equal(m.route.length,0);
});
test('replacing destination, cancel, spawn and projected clicks reset correctly',()=>{
 const {r,m}=scene();m.moveTo(6,6);assert.equal(m.moveTo(-1,-1),false);assert.equal(m.moving,false);
 m.moveTo(5,5);m.cancel();assert.equal(m.step(),false);
 m.face(7,3);m.spawn(2,2);assert.equal(m.facing,'S');
 const camera=m.camera(),p=r.project(5,4,camera.cameraX,camera.cameraY);
 assert.equal(JSON.stringify(m.pick(p.x,p.y,camera.cameraX,camera.cameraY)),JSON.stringify({x:5,y:4}));
 assert.equal(m.pick(NaN,0,0,0),null);
});
test('D86 diagnostic scene accepts ground/foreground and uses grid-sum foot depth',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'v182-p05-test/assets/maps/talking-island-renderer.js'),'utf8'),c);
 const draws=[],r=new c.TalkingIslandLayerRenderer({width:800,height:600,getContext:()=>({clearRect(){},fillRect(){},drawImage:i=>draws.push(i.id)})});
 const image=id=>({id,complete:true,naturalWidth:100,naturalHeight:100});
 r.setScene({bounds:{minX:0,minY:0,maxX:8,maxY:8},layers:[{depth:0,images:[{image:image('ground'),x:0,y:0,width:800,height:600}]},{depth:1,images:[{image:image('building'),x:3,y:3,width:100,height:100,footY:6}]}]});
 r.render({player:{image:image('player'),x:5,y:2,width:48,height:72}});
 assert.deepEqual(draws,['ground','building','player']);
 const tool=fs.readFileSync(path.join(root,'v182-p05-test/tools/talking-island-walk-test.html'),'utf8');
 assert.doesNotMatch(tool,/footY:\s*-?Infinity/);
});
function trade(storageFails=false){
 const writes=[];
 const c=context(['shopBalance','commitVillagePlayer','buyVillagePotion','sellVillagePotion'],{
  player:{adena:80,pots:3,path:[]},a37Slots:[{player:{name:'old'}}],a37ActiveSlot:0,a37Key:'slots',
  drops:[],monsters:[],p04MakeBackup(){},msg(){},villageProgress:()=>true,
  verifiedTalkingIslandScene:{merchant:{}},verifiedTalkingIslandMovement:{position:{x:5,y:5}},
  PANDORA:{x:5,y:5},POTION_PRICE:40,POTION_SELL_PRICE:19,
  localStorage:{setItem(k,v){if(storageFails)throw Error('quota');writes.push([k,JSON.parse(v)]);}}
 });return {c,writes};
}
test('buy/sell persist exact money and stack changes without losing slot data',()=>{
 const {c,writes}=trade();assert.ok(c.buyVillagePotion(2));assert.equal(c.player.adena,0);assert.equal(c.player.pots,5);
 assert.ok(c.sellVillagePotion(3));assert.equal(c.player.adena,57);assert.equal(c.player.pots,2);
 assert.equal(writes.length,2);assert.equal(writes[1][1][0].player.adena,57);
});
test('failed storage leaves live player and saved slot unchanged',()=>{
 const {c,writes}=trade(true);const player=c.player,slots=c.a37Slots;
 assert.equal(c.buyVillagePotion(1),false);assert.equal(c.sellVillagePotion(1),false);
 assert.equal(c.player,player);assert.equal(c.a37Slots,slots);assert.equal(c.player.adena,80);assert.equal(writes.length,0);
});
test('trade rejects invalid counts, insufficient funds, distance, overflow and corrupt stacks',()=>{
 const {c}=trade();
 for(const q of [0,-1,0.5,NaN,Infinity,3])assert.equal(c.buyVillagePotion(q),false);
 c.verifiedTalkingIslandMovement.position.x=0;assert.equal(c.sellVillagePotion(1),false);
 c.verifiedTalkingIslandMovement.position.x=5;c.player.pots=Number.MAX_SAFE_INTEGER;
 assert.equal(c.buyVillagePotion(1),false);
 c.player.adena=Number.MAX_SAFE_INTEGER;assert.equal(c.sellVillagePotion(1),false);
 c.player.pots=NaN;assert.equal(c.buyVillagePotion(1),false);assert.equal(c.sellVillagePotion(1),false);
});
test('level 4 mage learning, duplicate, funds and non-mage checks use shipped rules',()=>{
 const c=context(['knowsEnergyBolt','learnEnergyBolt'],{ENERGY_BOLT_ID:'energy-bolt',GERENG_LEARN_PRICE:100});
 const p={job:'法師',lv:4,adena:100};const result=c.learnEnergyBolt(p);
 assert.equal(result.player.adena,0);assert.equal(p.adena,100);assert.ok(c.knowsEnergyBolt(result.player));
 assert.equal(c.learnEnergyBolt(result.player).player,undefined);
 for(const override of [{lv:3},{job:'騎士'},{adena:99}])assert.equal(c.learnEnergyBolt({...p,...override}).player,undefined);
});
test('village EXP reaches level boundary, carries surplus, supports multiple levels and level cap',()=>{
 const c=context(['p03ApplyExperience'],{player:{lv:1,xp:98},p04Schema:2,p03ExpNeeded:lv=>100*lv,a46LevelUp(){c.player.lv++;}});
 assert.ok(c.p03ApplyExperience(5));assert.equal(c.player.lv,2);assert.equal(c.player.xp,3);assert.equal(c.player.dataSchema,2);
 c.p03ApplyExperience(500);assert.equal(c.player.lv,4);assert.equal(c.player.xp,3);
 assert.equal(c.p03ApplyExperience(-1),false);
 c.player={lv:98,xp:9799};c.p03ApplyExperience(100000);assert.equal(c.player.lv,99);assert.equal(c.player.xp,0);
});
function combat(){
 const scene={boltImage:{}},trial={phase:'fight',hp:3,exp:0},character={mp:8};let damage=0;
 const c=context(['villageBoltFlightTicks','resolveVillageBoltImpact','villageBoltActor','advanceVillageCast','cancelVillageCast'],{
  villageTrial:trial,player:character,verifiedTalkingIslandScene:scene,a37ActiveSlot:0,
  boltAxes:{E:[1,-1,3]},villageProgress:()=>true,applyVillageGoblinDamage(){damage++;},
  villageCastPreview:null
 });
 const cast={origin:{x:0,y:0},target:{x:10,y:0},startedAt:0,directional:true,combat:true,
  facing:'E',slot:0,encounter:trial,scene,sprite:[{frameEnds:[100,200,300,400,500,600,700]}]};
 c.villageCastPreview=cast;return {c,cast,get damage(){return damage;}};
}
test('light bolt only resolves at arrival and only once',()=>{
 const state=combat(),{c,cast}=state,arrival=600+c.villageBoltFlightTicks(cast)*1000/24;
 c.resolveVillageBoltImpact(cast,arrival-0.01,arrival-0.01);assert.equal(state.damage,0);
 c.resolveVillageBoltImpact(cast,arrival+0.01,arrival+0.01);assert.equal(state.damage,1);
 c.resolveVillageBoltImpact(cast,arrival+100,arrival+100);assert.equal(state.damage,1);
});
test('pre-release interrupt cancels; released bolt survives movement and Escape',()=>{
 const a=combat();a.c.advanceVillageCast(599,true);assert.equal(a.c.villageCastPreview,null);assert.equal(a.damage,0);
 const b=combat();b.c.cancelVillageCast(601);assert.equal(b.c.villageCastPreview,b.cast);
 const state=b.c.advanceVillageCast(650,true);assert.equal(state.casting,false);assert.ok(state.bolt);
 const resumed=b.c.advanceVillageCast(675,false);assert.equal(resumed.casting,false);assert.ok(resumed.bolt);
 b.c.advanceVillageCast(3000,true);assert.equal(b.damage,1);assert.equal(b.c.villageCastPreview,null);
});
test('old bolt cannot damage a replacement encounter, scene or character slot',()=>{
 for(const mutation of [c=>c.villageTrial={},c=>c.verifiedTalkingIslandScene={},c=>c.a37ActiveSlot=1]){
  const s=combat();mutation(s.c);s.c.resolveVillageBoltImpact(s.cast,3000,3000);assert.equal(s.damage,0);
 }
});
test('goblin defeat awards EXP/drop once through the common progression function',()=>{
 let awarded=0;
 const c=context(['applyVillageGoblinDamage'],{villageTrial:{phase:'fight',hp:3,exp:0},GOBLIN:{exp:5},
  msg(){},showVillageTrialStatus(){},villageProgress:()=>true,p03ApplyExperience:n=>awarded+=n});
 c.applyVillageGoblinDamage(9,100,'hit','damage');c.applyVillageGoblinDamage(9,200,'hit','damage');
 assert.equal(awarded,5);assert.equal(c.villageTrial.hp,0);assert.equal(c.villageTrial.phase,'dying');assert.equal(c.villageTrial.dropAvailable,true);
});
function localObject(name){
 const marker='const '+name+'=';
 const start=source.indexOf(marker)+marker.length;
 assert.ok(start>=marker.length);
 return JSON.parse(source.slice(start,source.indexOf(';\n',start)));
}
test('all 28 supplied character animation configurations fit their eight-direction atlases',()=>{
 const data=localObject('localData'),images=localObject('localImages');let checked=0;
 for(const [name,config] of Object.entries(data)){
  if(!config.directions)continue;
  const png=fs.readFileSync(path.join(dir,images[name.replace('.json','.png')]));
  assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  assert.equal(width%config.columns,0,name);assert.equal(height%8,0,name);
  assert.deepEqual([...config.directions].sort(),['E','N','NE','NW','S','SE','SW','W']);
  if(config.frameEnds){
   assert.equal(config.frameEnds.length,config.columns,name);
   config.frameEnds.forEach((end,i)=>assert.ok(end>(config.frameEnds[i-1]??0),name));
  }
  checked++;
 }
 assert.equal(checked,28);
});
test('both supplied village maps validate collision edges and allow their actual spawn',()=>{
 for(const name of ['village-scene.json','shop-scene.json']){
  const data=localObject('localData')[name],{r,c}=scene();
  r.setScene({bounds:data.bounds,layers:[]});r.setCollision(data);
  const movement=new c.TalkingIslandMovementController(r);movement.spawn(data.spawn.x,data.spawn.y);
  assert.ok(r.canWalk(data.spawn.x,data.spawn.y));
  for(const edge of data.blockedEdges){
   assert.equal(r.canStep(...edge),false);assert.equal(r.canStep(edge[2],edge[3],edge[0],edge[1]),false);
  }
 }
});

test('magic test launchers share only the dedicated save and backup across scenes',()=>{
 const launcher=fs.readFileSync(path.join(dir,'Magic-Test.html'),'utf8');
 const queries=[...launcher.matchAll(/href="Start\.html(\?[^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
 assert.deepEqual(queries,['?magicTest=1&gerengPreview=1','?magicTest=1']);
 const values=new Map([
  ['lineage_182_p01_character_slots','[]'],
  ['lineage_182_pre_p04_backup_v1','formal backup'],
  ['lineage_182_gereng_test_slots','[]']
 ]);
 const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
 function load(search){
  const c=context([], {localStorage,URLSearchParams,location:{search},alert:assert.fail});
  vm.runInContext(section('const visualParams=','function visualScaleParam')+
   section('const a37Key=','function a37Snapshot'),c);
  return c;
 }
 const learning=load(queries[0]);
 const mage=vm.runInContext('a37Slots[0].player',learning);
 assert.deepEqual([mage.job,mage.lv,mage.adena,mage.mp,mage.learnedSpells.length],['法師',4,100,7,0]);
 for(const name of ['knowsEnergyBolt','learnEnergyBolt','commitVillagePlayer'])
  vm.runInContext(functionSource(name),learning);
 vm.runInContext(section('const ENERGY_BOLT_MP','function knowsEnergyBolt')+
  'let player=a37Slots[0].player,drops=[],monsters=[];',learning);
 assert.equal(vm.runInContext('commitVillagePlayer(learnEnergyBolt(player).player)',learning),true);
 const combatMode=load(queries[1]);
 assert.equal(vm.runInContext('a37Slots[0].player.learnedSpells[0]',combatMode),'energy-bolt');
 assert.equal(vm.runInContext('a37Slots[0].player.adena',combatMode),0);
 vm.runInContext('a37Persist()',combatMode);
 assert.ok(values.has('lineage_182_magic_test_backup'));
 assert.equal(vm.runInContext('a37Slots[0]',load('')),null);
 assert.equal(values.get('lineage_182_p01_character_slots'),'[]');
 assert.equal(values.get('lineage_182_pre_p04_backup_v1'),'formal backup');
 assert.equal(values.get('lineage_182_gereng_test_slots'),'[]');
});

test('combat light bolt requires learning, a live target, a stationary caster and 3 MP',()=>{
 const enemy={x:1,y:0},scene={casts:[{}]},movement={
  position:{x:0,y:0},moving:false,face(){},getScreenFacing:()=> 'SE'
 };
 const c=context(['knowsEnergyBolt','villageAttackDuration','playVillageCastPreview'],{
  ENERGY_BOLT_ID:'energy-bolt',ENERGY_BOLT_MP:3,player:{mp:2,learnedSpells:[]},
  worldEntered:true,verifiedTalkingIslandScene:scene,verifiedTalkingIslandMovement:movement,
  verifiedTalkingIslandStepFrom:null,villageProgress:()=>true,villageTrial:{phase:'fight'},
  villageCastPreview:null,a37ActiveSlot:0,boltAxes:{SE:[1,0]},boltScreenDirections:Array(8).fill('SE'),
  msg(){},update(){}
 });
 const cast=()=>c.playVillageCastPreview(true,enemy);
 c.player.mp=3;assert.equal(cast(),false);
 c.player.learnedSpells.push('energy-bolt');
 c.villageTrial.phase='defeated';assert.equal(cast(),false);
 c.villageTrial.phase='fight';movement.moving=true;assert.equal(cast(),false);
 movement.moving=false;c.player.mp=2;assert.equal(cast(),false);assert.equal(c.player.mp,2);
 c.player.mp=3;assert.equal(cast(),true);assert.equal(c.player.mp,0);
 assert.equal(c.villageCastPreview.combat,true);
 assert.equal(cast(),false);
});

function pointerScene(){
 const makeActor=()=>({image:{},width:12,height:20});
 const enemy=makeActor(),merchant=makeActor(),teacher=makeActor();
 const draws=[{item:enemy,left:30,top:20},{item:merchant,left:60,top:20},{item:teacher,left:90,top:20}];
 const imagePixels=new Map(draws.map(({item})=>{
  const {width,height}=item,data=new Uint8ClampedArray(width*height*4);
  for(let y=4;y<=15;y++)data[(y*width+5)*4+3]=200;
  return [item.image,{width,height,data}];
 }));
 const camera={cameraX:12.5,cameraY:27.25};
 const calls=[];
 const movement={position:{x:3,y:3},pick:(...args)=>{
  calls.push(['pick',...args]);return {x:7,y:8};
 },moveTo:(...args)=>{calls.push(['move',...args]);return true;}};
 Object.assign(teacher,{x:3,y:4});
 Object.assign(merchant,{x:4,y:3});
 const c=context(['pickVillageActor','isOpaqueIslandPixel','isVillageActorLabelHit','clickAt'],{
  canvas:{width:200,height:100},villageTrial:{phase:'fight'},
  displayedIslandFrame:{draws,enemy,camera,labels:[]},
  verifiedTalkingIslandScene:{imagePixels,merchant,teacher},
  verifiedTalkingIslandMovement:movement,
  VILLAGE_TRIAL_ENEMY:{x:9,y:9},
  talkingIslandMode:()=>true,villageSpellTargeting:false,villageProgress:()=>true,
  openGerengDialogue:()=>calls.push(['teacher']),openVillageShop:()=>calls.push(['merchant'])
 });
 return {c,draws,calls};
}

test('clicking animated enemy and NPC heads and bodies selects their existing actions',()=>{
 const {c,calls}=pointerScene();
 c.clickAt(35,24);
 c.clickAt(65,33);
 c.clickAt(95,24);
 assert.deepEqual(calls,[['move',9,9],['merchant'],['teacher']]);
 assert.equal(c.pickVillageActor(38,32,true),'enemy');
 assert.equal(c.pickVillageActor(65,33,true),null);
 c.villageTrial.phase='dying';
 assert.equal(c.pickVillageActor(35,24),null);
});

test('empty ground uses the painted camera and does not widen the sprite to its empty rectangle',()=>{
 const {c,calls}=pointerScene();
 c.clickAt(30,37);
 assert.deepEqual(calls,[['pick',30,37,12.5,27.25],['move',7,8]]);
 c.displayedIslandFrame=null;
 c.clickAt(35,24);
 assert.equal(calls.length,2);
});

test('overlapping targets follow the top visible pixel before using tolerance',()=>{
 const {c,draws}=pointerScene();
 draws[1].left=draws[0].left;
 assert.equal(c.pickVillageActor(35,25),'merchant');
 assert.equal(c.pickVillageActor(35,25,true),null);
 draws[1].left=32;
 assert.equal(c.pickVillageActor(35,25),'enemy');
 assert.equal(c.pickVillageActor(37,25),'merchant');
 const scene=c.verifiedTalkingIslandScene;
 scene.teacher=null;
 draws[2].left=30;
 assert.equal(c.pickVillageActor(35,25),null);
});

test('letterbox pointer maps to bitmap coordinates under viewport scaling and borders',()=>{
 const c=context(['pointerXY'],{localVillageEntered:true,canvas:{
  width:800,height:600,clientWidth:1000,clientHeight:600,clientLeft:2,clientTop:2,
  offsetWidth:1004,offsetHeight:604,
  getBoundingClientRect:()=>({left:30,top:45,width:753,height:453})
 }});
 const point=c.pointerXY({clientX:30+(102+400)*.75,clientY:45+(2+300)*.75});
 assert.deepEqual([point.x,point.y],[400,300]);
 assert.ok(c.pointerXY({clientX:40,clientY:100}).x<0);
});

test('target picking uses the current sprite atlas crop and projected name label',()=>{
 const {c,draws}=pointerScene();
 const {item}=draws[0],width=12,height=40,data=new Uint8ClampedArray(width*height*4);
 data[((20+5)*width+7)*4+3]=255;
 c.verifiedTalkingIslandScene.imagePixels.set(item.image,{width,height,data});
 item.sourceRect={x:0,y:20,width:12,height:20};
 assert.equal(c.pickVillageActor(37,25),'enemy');
 assert.equal(c.pickVillageActor(37,34),null);
 c.ctx={save(){},restore(){},measureText:()=>({width:20})};
 c.displayedIslandFrame.labels.push({item,name:'哥布林',font:'14px sans-serif',point:{x:36,y:52},offset:36});
 assert.equal(c.pickVillageActor(36,12),'enemy');
 assert.equal(c.pickVillageActor(50,12),null);
});


test('light bolt waits until the last frame of an attack atlas with uniform timing',()=>{
 const c=context(['knowsEnergyBolt','villageAttackDuration','playVillageCastPreview'],{
  ENERGY_BOLT_ID:'energy-bolt',ENERGY_BOLT_MP:3,player:{mp:7,learnedSpells:['energy-bolt']},
  worldEntered:true,verifiedTalkingIslandScene:{casts:[{}],attack:[{columns:6,frameDuration:58}]},
  verifiedTalkingIslandMovement:{position:{x:0,y:0},moving:false,face(){},getScreenFacing:()=> 'SE'},
  verifiedTalkingIslandStepFrom:null,villageProgress:()=>true,
  villageTrial:{phase:'fight',attackStartedAt:0},
  villageCastPreview:null,a37ActiveSlot:0,boltAxes:{SE:[1,0]},boltScreenDirections:Array(8).fill('SE'),
  msg(){},update(){}
 });
 const target={x:1,y:0};
 c.performance.now=()=>347;
 assert.equal(c.playVillageCastPreview(true,target),false);
 assert.equal(c.player.mp,7);
 c.performance.now=()=>348;
 assert.equal(c.playVillageCastPreview(true,target),true);
 assert.equal(c.player.mp,4);
 assert.equal(c.villageAttackDuration({columns:5,frameDuration:42,frameEnds:[167,333,625,750,1000]}),1000);
});

test('goblin hit, death and attack animation only select their own atlas rows',()=>{
 const c=context(['villageGoblinFrame']);
 for(const name of ['GOBLIN_HIT_FRAMES','GOBLIN_FRAME_MS','GOBLIN_DEATH_FRAMES','GOBLIN_ATTACK_FRAMES','GOBLIN_ATTACK_FRAME_MS'])
  vm.runInContext(source.match(new RegExp('const '+name+'=[0-9]+;'))[0],c);
 const fight={phase:'fight',goblinAttackAt:null,hitUntil:1360};
 for(const [now,row] of [[999,0],[1000,7],[1074,7],[1075,8],[1149,8],[1150,1]])
  assert.equal(c.villageGoblinFrame(fight,now),row);
 for(const [trial,now,row] of [
  [{...fight,phase:'dying',deathStartedAt:1000},999,9],
  [{...fight,phase:'dying',deathStartedAt:1000},1900,20],
  [{...fight,goblinAttackAt:1000},999,21],
  [{...fight,goblinAttackAt:1000},1500,24]
 ])assert.equal(c.villageGoblinFrame(trial,now),row);
 const png=fs.readFileSync(path.join(dir,'assets/db366be902fa0b49938a.png'));
 assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[119,93*25]);
});

test('learned light bolt and legacy potion can share the hotbar without sharing a slot',()=>{
 const c=context(['knowsEnergyBolt','assignActionHotkey','actionHotkeyKind','useActionHotkey'],{
  ENERGY_BOLT_ID:'energy-bolt',worldEntered:true,
  player:{pots:2,potionHotkey:0},document:{getElementById:()=>({click:()=>actions.push('potion')})},
  selectEnergyBolt:()=>actions.push('bolt')
 });
 const actions=[];
 assert.equal(c.assignActionHotkey(c.player,1,'bolt'),false);
 c.player.learnedSpells=['energy-bolt'];
 assert.equal(c.assignActionHotkey(c.player,1,'bolt'),true);
 assert.equal(c.useActionHotkey(0),true);
 assert.equal(c.useActionHotkey(1),true);
 assert.deepEqual(actions,['potion','bolt']);
 assert.equal(c.assignActionHotkey(c.player,0,'bolt'),true);
 assert.equal(c.player.potionHotkey,undefined);
 assert.equal(c.actionHotkeyKind(c.player,1),null);
 assert.equal(c.assignActionHotkey(c.player,0,'potion'),true);
 assert.equal(c.player.energyBoltHotkey,undefined);
 assert.equal(c.useActionHotkey(1),false);
});
