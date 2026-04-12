const fs = require('fs');
const mblur = require('./box_tracking_mblur.json');

for(let i=30; i<=80; i+=5) {
   let d = mblur[i.toString()];
   if(d) {
     console.log(`F${i}: cx=${d.cx}, cy=${d.cy}, maxX=${d.maxX}, width=${d.maxX - d.minX}`);
   }
}

console.log("DROP:");
for(let i=110; i<=150; i+=5) {
   let d = mblur[i.toString()];
   if(d) {
     console.log(`F${i}: cx=${d.cx}, cy=${d.cy}, maxY=${d.maxY}, height=${d.maxY - d.minY}`);
   }
}
