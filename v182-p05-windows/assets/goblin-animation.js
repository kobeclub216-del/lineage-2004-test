'use strict';

// Existing single-facing atlas. Character directions remain in character-animations.json.
const goblinAnimation = {
 width:119,height:93,offsetX:0.5,offsetY:13,
 idle:{start:0,count:7,ms:140},
 hit:{start:7,count:2,ms:75},
 death:{start:9,count:12,ms:75},
 attack:{start:21,count:4,ms:125}
};

// Both encounters use the same species and animation atlas.
const goblinEncounters = Object.freeze({
 village:Object.freeze({x:32953,y:32569}),
 // Development placement on an existing walkable cell of the shop scene.
 outskirts:Object.freeze({x:32946,y:32598})
});
