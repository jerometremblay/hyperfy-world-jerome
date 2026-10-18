// Y up, +X right, -Z forward. Metres. Fireplace faces +Z; sofas face -Z.
// Target: Hyperfy v0.16.0 primitive contract; geometry-free GLB loader bootstrap.
// Static cabin with a separate, change-driven structural collision layer.
const C={wood:'#86532e',light:'#ae7645',dark:'#432a1c',iron:'#252525',leather:'#663b26',cream:'#d0b993'};
if(!app.state)app.state={};
let seed=27;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function pick(a){return a[Math.floor(rnd()*a.length)]}
const clickableGeometry=[];
function p(type,size,position,color,extra={}){const n=app.create('prim',{type,size,position,color,roughness:.86,metalness:0,physics:null,...extra});app.add(n);clickableGeometry.push(n);return n}
function box(s,v,c,e={}){return p('box',s,v,c,e)}
function ball(r,v,c,e={}){return p('sphere',[r],v,c,e)}
function cyl(r,h,v,c,e={}){return p('cylinder',[r,r,h],v,c,e)}
// Actual Hyperfy light nodes (supported by this world fork), created once per client.
// Candle flames are individually emissive; nearby candles share one punctual source
// to keep this detailed 3,000+ primitive cabin performant on mobile/VR.
const flickeringLights=[], candleFlames=[];
function warmLight(position, color, intensity, distance, flicker=.10){
  if(!world.isClient)return null;
  const light=app.create('light');
  light.type='point';
  light.position.set(...position);
  light.color=color;
  light.intensity=intensity;
  light.distance=distance;
  light.decay=2;
  light.castShadow=false; // Avoid 6 shadow passes per point light across thousands of timbers.
  app.add(light);
  flickeringLights.push({light,intensity,phase:rnd()*Math.PI*2,flicker});
  return light;
}
// Quaternion aligning local +Y with endpoints, independent of Euler order.
function segment(a,b,w,c,round=true,depth=w){let d=b.map((v,i)=>v-a[i]),L=Math.hypot(...d);d=d.map(v=>v/L);let q=d[1]<-.999999?[1,0,0,0]:[d[2],0,-d[0],1+d[1]],m=Math.hypot(...q);q=q.map(v=>v/m);return p(round?'cylinder':'box',round?[w,w,L]:[w,L,depth],a.map((v,i)=>(v+b[i])/2),c,{quaternion:q})}
const timber=(a,b,r=.19,c=C.wood)=>segment(a,b,r,c);
const beam=(a,b,w=.2,c=C.wood,d=w)=>segment(a,b,w,c,false,d);
const woods=['#895833','#96643b','#a67344','#85522e','#9d6a3e'];
// Raise the complete upper wall/roof assembly by four log courses for generous loft headroom.
const upperRaise=1.44,wallPlateY=5.8+upperRaise,roofRidgeY=9+upperRaise;
// Plank floor: staggered joints and quiet nail heads.
box([16,.20,20],[0,-.15,0],C.dark);
for(let i=0;i<40;i++){let x=-7.8+i*.4;for(let j=0;j<5;j++){let z=-8+j*4;box([.391,.08,3.985],[x,.01,z],pick(woods));for(let s of [-1,1])cyl(.012,.006,[x,.053,z+s*1.89],C.iron)}}
// Side walls: real openings for three windows per side.
for(let s of [-1,1])for(let r=0;r<20;r++){let y=.2+r*.36;let intervals=y>1.15&&y<3.55?[[-10,-6.5],[-3.5,-.5],[2.5,5.5],[8.5,10]]:[[-10,10]];for(let [a,b] of intervals)timber([s*8,y,a],[s*8,y,b],.205,pick(woods))}
// Rear wall: a raised panoramic kitchen window sits over the sink, while the
// separate porch doorway remains at the right-hand bay. Both are true wall openings.
const rearDoorW=1.12,rearDoorH=1.98,rearDoorCX=5.34,rearDoorL=rearDoorCX-rearDoorW/2,rearDoorR=rearDoorCX+rearDoorW/2,rearDoorBase=.06,rearDoorTop=rearDoorBase+rearDoorH,rearDoorZ=9.79;
const rearWindowCX=-1.8,rearWindowW=3.5,rearWindowH=1.72,rearWindowBottom=1.58,rearWindowTop=rearWindowBottom+rearWindowH,rearWindowL=rearWindowCX-rearWindowW/2,rearWindowR=rearWindowCX+rearWindowW/2;
for(let r=0;r<20;r++){
  let y=.2+r*.36;
  timber([-8,y,-10],[8,y,-10],.205,pick(woods));
  const windowBand=y>rearWindowBottom-.16&&y<rearWindowTop+.16;
  const doorBand=y<rearDoorTop+.16;
  if(windowBand&&doorBand){
    timber([-8,y,10],[rearWindowL-.1,y,10],.205,pick(woods));
    timber([rearWindowR+.1,y,10],[rearDoorL-.1,y,10],.205,pick(woods));
    timber([rearDoorR+.1,y,10],[8,y,10],.205,pick(woods));
  }else if(windowBand){
    timber([-8,y,10],[rearWindowL-.1,y,10],.205,pick(woods));
    timber([rearWindowR+.1,y,10],[8,y,10],.205,pick(woods));
  }else if(doorBand){
    timber([-8,y,10],[rearDoorL-.1,y,10],.205,pick(woods));
    timber([rearDoorR+.1,y,10],[8,y,10],.205,pick(woods));
  }else timber([-8,y,10],[8,y,10],.205,pick(woods));
}
// Deep timber casing and sill frame the window. The glass is intentionally raised
// above the faucet/counter rather than reaching the floor like a doorway.
const rearWindowMidY=(rearWindowBottom+rearWindowTop)/2;
box([.2,rearWindowH+.34,.42],[rearWindowL-.1,rearWindowMidY,10],C.dark);
box([.2,rearWindowH+.34,.42],[rearWindowR+.1,rearWindowMidY,10],C.dark);
box([rearWindowW-.016,.2,.42],[rearWindowCX,rearWindowTop+.1,10],C.dark);
box([rearWindowW+.5,.18,.54],[rearWindowCX,rearWindowBottom-.09,9.916],C.light);
box([rearWindowW-.16,rearWindowH-.16,.035],[rearWindowCX,rearWindowMidY,9.98],'#a9cad3',{opacity:.3,roughness:.12,metalness:.04,doubleside:true});
for(const x of [rearWindowCX-rearWindowW/6,rearWindowCX+rearWindowW/6])box([.075,rearWindowH-.1,.16],[x,rearWindowMidY,9.96],C.dark);
box([rearWindowW-.12,.07,.16],[rearWindowCX,rearWindowMidY,9.93],C.dark);
// Heavy jambs/lintel tie the porch doorway back into the log wall.
box([.22,rearDoorH+.27,.44],[rearDoorL-.12,rearDoorBase+(rearDoorH+.27)/2,9.9],C.dark);
box([.22,rearDoorH+.27,.44],[rearDoorR+.12,rearDoorBase+(rearDoorH+.27)/2,9.9],C.dark);
box([rearDoorW-.016,.24,.44],[rearDoorCX,rearDoorTop+.14,9.9],C.dark);
box([rearDoorW+.22,.09,.16],[rearDoorCX,rearDoorBase-.015,9.74],C.light);
// Hinged outward-opening plank door. Pivot is the left jamb; -Y rotation swings it outside the cabin.
const rearDoorPivot=app.create('group',{position:[rearDoorL,rearDoorBase,rearDoorZ]});app.add(rearDoorPivot);
function rearDoorPart(type,size,position,color,extra={}){const n=app.create('prim',{type,size,position,color,roughness:.86,metalness:0,physics:null,...extra});rearDoorPivot.add(n);return n}
rearDoorPart('box',[rearDoorW-.08,rearDoorH,.085],[(rearDoorW-.08)/2,rearDoorH/2,0],'#6f4327');
for(let i=0;i<5;i++)rearDoorPart('box',[.16,rearDoorH-.12,.095],[.13+i*(rearDoorW-.27)/4,rearDoorH/2,.022],i%2?'#7f5030':'#744627');
for(const y of [.23,rearDoorH-.24])rearDoorPart('box',[rearDoorW-.14,.14,.115],[rearDoorW/2,y,.018],C.dark);
rearDoorPart('box',[.14,1.16,.12],[rearDoorW*.55,rearDoorH*.51,.025],C.dark,{rotation:[0,0,-.66]});
for(const y of [.42,rearDoorH-.43])rearDoorPart('box',[.085,.23,.14],[.06,y,.02],C.iron);
rearDoorPart('sphere',[.055],[rearDoorW-.18,rearDoorH*.52,.09],C.iron,{scale:[1,.9,.5]});
rearDoorPart('cylinder',[.024,.024,.17],[rearDoorW-.18,rearDoorH*.52,.145],C.iron,{rotation:[Math.PI/2,0,0]});
const rearDoorSensor=app.create('group',{position:[rearDoorCX,1.05,9.78]});app.add(rearDoorSensor);
let rearDoorOpenTarget=!!app.state.cabinDoorOpen,rearDoorAmount=rearDoorOpenTarget?1:0;
function setRearDoorOpen(open){rearDoorOpenTarget=!!open}
// Gable interior infill follows the same roof equation as the rafters.
for(let y=5.95+upperRaise;y<8.95+upperRaise;y+=.32){let x=(roofRidgeY-y)/.4;for(let z of [-10,10])timber([-x,y,z],[x,y,z],.18,pick(woods))}
for(let s of [-1,1])for(let z of [-5,1,7]){for(let dz of [-1.5,0,1.5])box([.25,2.65,.09],[s*7.85,2.38,z+dz],C.dark);for(let y of [1.08,2.36,3.7])box([.3,.11,3.2],[s*7.85,y,z],C.light);box([.53,.16,3.4],[s*7.77,1.05,z],C.dark)}
// Main roof: continue the existing 0.4 rise/run pitch beyond every wall to form a deep overhang.
const roofOverhang=.8,roofHalfWidth=8+roofOverhang,roofHalfDepth=10+roofOverhang,roofEaveY=wallPlateY-.4*roofOverhang;
for(let z=-roofHalfDepth+.2;z<roofHalfDepth;z+=.4)for(let s of [-1,1])beam([s*roofHalfWidth,roofEaveY,z],[s*.16,roofRidgeY-.064,z],.14,pick(woods),.394);
timber([0,8.78+upperRaise,-roofHalfDepth],[0,8.78+upperRaise,roofHalfDepth],.27,C.dark);
for(let z of [-8,-3,2,7]){for(let s of [-1,1]){timber([s*7.8,5.51+upperRaise,z],[0,8.63+upperRaise,z],.24,C.light);timber([s*7.68,0,z],[s*7.68,5.6+upperRaise,z],.28,C.wood);timber([s*7.68,4.45+upperRaise,z],[s*6.3,5.5+upperRaise,z],.16,C.light)}timber([-7.7,5.46+upperRaise,z],[7.7,5.46+upperRaise,z],.24,C.wood);timber([0,5.46+upperRaise,z],[0,8.64+upperRaise,z],.18,C.light);for(let s of [-1,1])timber([s*3.4,5.46+upperRaise,z],[s*1.5,8.02+upperRaise,z],.15,C.light)}
// Wide masonry fireplace. The opening is physically empty geometry.
const stones=['#827b6d','#968b78','#a49782','#706e65','#aaa08d','#8c826f'];
function masonry(x0,x1,y0,y1,z,depth){for(let y=y0;y<y1-.01;y+=.4){let row=Math.round((y-y0)/.4),x=x0;while(x<x1-.01){let w=Math.min(x1-x,.65+rnd()*.48);box([w-.025,Math.min(.38,y1-y-.01),depth+rnd()*.055],[x+w/2,y+.19,z],pick(stones));x+=w}}}
box([8.4,.36,2.1],[.8,.18,-8.82],'#8e8677');
masonry(-3.2,-1.6,.35,3.05,-9.25,1.2);masonry(3.2,4.8,.35,3.05,-9.25,1.2);
masonry(-3.21,4.81,3.05,7.6,-9.4,.95);
box([4.8,2.68,.15],[.8,1.707,-9.85],'#302c27');box([4.72,.1,1.25],[.8,.405,-9.2],'#272322');
// Firebrick back and iron opening frame.
for(let y=.55;y<2.95;y+=.29)for(let x=-1.4;x<3.1;x+=.56)box([.53,.26,.04],[x,y+.006,-9.75],pick(['#494036','#4e4236','#594939']));
for(let x of [-1.61,3.21])box([.075,2.67,.08],[x,1.72,-8.57],C.iron);box([4.91,.09,.08],[.8,3.03,-8.551],C.iron);
box([8.65,.35,1.45],[.8,3.38,-9.12],C.dark);box([8.75,.12,1.5],[.8,3.58,-9.1],C.light);
// Log basket recesses visually distinct from the firebox.
for(let s of [-1,1]){let x=.8+s*3.18;box([.91,1.2,.12],[x,1.1,-8.57],'#322a23');for(let row=0;row<4;row++)for(let col=0;col<3;col++){let px=x+(col-1)*.25+(row%2)*.035,py=.64+row*.23;timber([px,py,-8.61],[px,py,-8.37],.112,C.wood);cyl(.086,.012,[px,py,-8.355],C.light,{rotation:[Math.PI/2,0,0]})}}
// Layered animated hearth fire. The logs stay physical-looking while the flame
// volumes, sparks and emissive glow move independently to avoid a repeating row.
for(let x=-1.1;x<2.9;x+=.53)timber([x-.28,.57,-9.48],[x+.25,.6,-8.85],.12,'#32241c');
const fireLicks=[],fireSparks=[];
function firePrim(type,size,position,color,extra={}){
  const n=app.create('prim',{type,size,position,color,roughness:.28,metalness:0,physics:null,...extra});
  app.add(n);return n;
}
for(let i=0;i<18;i++){
  const x=-1.18+rnd()*3.96,z=-9.48+rnd()*.58,r=.085+rnd()*.095,phase=rnd()*Math.PI*2,speed=4.4+rnd()*3.8;
  const outer=firePrim('sphere',[r],[x,.68+rnd()*.18,z],'#ff641c',{emissive:'#ff4c0c',emissiveIntensity:4.2,opacity:.78,scale:[.9,2.2,.66]});
  const inner=firePrim('sphere',[r*.58],[x+(rnd()-.5)*.05,.69+rnd()*.14,z+.02],'#ffd66b',{emissive:'#ffb128',emissiveIntensity:6.8,opacity:.88,scale:[.72,2.1,.52]});
  fireLicks.push({outer,inner,x,z,phase,speed,outerY:2.0+rnd()*.55,innerY:1.8+rnd()*.45,lean:(rnd()-.5)*.11});
}
// Bright core plus a soft transparent halo act as the visible firelight source.
const fireLightCore=firePrim('sphere',[.23],[.8,.76,-9.14],'#ffd47a',{emissive:'#ff821f',emissiveIntensity:5.6,opacity:.17,scale:[4.0,1.02,.88]});
const fireLightHalo=firePrim('sphere',[.29],[.8,.84,-9.05],'#ff9b35',{emissive:'#ff6a18',emissiveIntensity:1.2,opacity:.012,scale:[4.35,1.58,.84]});
// Light originates just ahead of the fuel inside the open firebox.
// Two warm point sources illuminate the wide masonry hearth and nearby furniture.
warmLight([-.37,1.2,-8.93],'#ff893b',130,7.5,.23);
warmLight([1.97,1.2,-8.93],'#ffb05f',130,7.5,.21);
for(let i=0;i<20;i++){
  const x=-1.15+rnd()*3.9,z=-9.43+rnd()*.47,r=.012+rnd()*.018;
  const node=firePrim('sphere',[r],[x,.62,z],i%3?'#f08a24':'#ffd05b',{emissive:i%3?'#ff6818':'#ffc74a',emissiveIntensity:6.5,opacity:.88});
  fireSparks.push({node,x,z,phase:rnd(),speed:.22+rnd()*.26,drift:(rnd()-.5)*.55,wobble:4+rnd()*5});
}
let fireTime=rnd()*20;
function animateFire(delta){
  fireTime+=delta*.58;
  for(const f of fireLicks){
    const a=fireTime*f.speed+f.phase,b=fireTime*(f.speed*.61)+f.phase*1.73;
    const flicker=.86+.16*Math.sin(a)+.08*Math.sin(b);
    const sway=Math.sin(a*.73)*.055+f.lean;
    f.outer.position.x=f.x+sway;f.outer.position.y=.75+.07*Math.sin(a*.91);f.outer.position.z=f.z+.025*Math.sin(b);
    f.outer.scale.set(.82+.13*Math.sin(b),f.outerY*flicker,.58+.08*Math.cos(a));
    f.outer.emissiveIntensity=3.7+1.2*(.5+.5*Math.sin(a*1.17));
    f.inner.position.x=f.x+sway*.65;f.inner.position.y=.72+.05*Math.sin(a*1.11+.8);f.inner.position.z=f.z+.035;
    f.inner.scale.set(.62+.09*Math.sin(b+.5),f.innerY*(.9+.14*Math.sin(a+.7)),.46+.06*Math.cos(b));
    f.inner.emissiveIntensity=6.1+1.8*(.5+.5*Math.sin(a*1.31+.4));
  }
  for(const s of fireSparks){
    const t=(fireTime*s.speed+s.phase)%1,fade=1-t;
    s.node.position.x=s.x+s.drift*t+.05*Math.sin(fireTime*s.wobble+s.phase*12);
    s.node.position.y=.62+t*1.75;s.node.position.z=s.z+.04*Math.sin(fireTime*3.7+s.phase*9);
    const q=.34+fade*.9;s.node.scale.set(q,q,q);
    s.node.emissiveIntensity=3.8+4.2*fade;
  }
  const flicker=.5+.5*Math.sin(fireTime*11.3)+.22*Math.sin(fireTime*17.7);
  fireLightCore.emissiveIntensity=4.8+.9*flicker;
  fireLightCore.scale.set(3.92+.22*flicker,.98+.08*flicker,.86+.04*flicker);
  fireLightHalo.emissiveIntensity=.85+.28*flicker;
  fireLightHalo.scale.set(4.2+.25*flicker,1.5+.13*flicker,.8+.04*flicker);
  // Independent, low-amplitude light flicker; no node creation/rebuilding per frame.
  for(const f of flickeringLights){
    const fast=Math.sin(fireTime*10.9+f.phase),slow=Math.sin(fireTime*5.7+f.phase*1.49);
    f.light.intensity=f.intensity*(1+f.flicker*(.64*fast+.36*slow));
  }
  for(const f of candleFlames){
    f.node.emissiveIntensity=3.8+.65*Math.sin(fireTime*10.3+f.phase);
    f.node.scale.set(.95+.06*Math.sin(fireTime*8.1+f.phase),1+.08*Math.sin(fireTime*12.4+f.phase),.95);
  }
}
if(world.isClient)app.on('update',animateFire);
for(let x=-1.35;x<3.1;x+=.24)beam([x,.46,-8.74],[x,.69,-8.74],.025,C.iron);beam([-1.5,.51,-8.74],[3.1,.51,-8.74],.035,C.iron);
// Framed geometric mountain artwork, made entirely of primitives.
box([3.8,2.55,.16],[.8,5.45,-8.84],C.dark);box([3.58,2.34,.05],[.8,5.45,-8.73],'#ba945e');box([3.4,2.18,.04],[.8,5.45,-8.69],'#717a76');
for(let [x,y,r] of [[-.3,5.14,.85],[.72,5.2,1.05],[1.7,5.05,.7]])p('cone',[r,1.7],[x,y,-8.62],'#485b54',{scale:[1,1,.045]});ball(.26,[1.77,6.03,-8.61],'#dfc590',{scale:[1,1,.04]});
// Mezzanine at rear, with open balustrade and columns.
box([16,.20,4.4],[0,3.392,7.8],C.dark);for(let x=-7.8;x<8;x+=.4)box([.39,.08,4.38],[x,3.55,7.8],pick(woods));
for(let x of [-7.6,-3.3,1.8,7.6]){timber([x,0,5.65],[x,5.42+upperRaise,5.65],.26,C.light);timber([x,2.45,5.65],[x+.8,3.25,5.65],.14,C.wood)}
timber([-8,3.27,5.6],[8,3.27,5.6],.23,C.wood);
function rail(a,b){timber(a.map((v,i)=>i===1?v+1.05:v),b.map((v,i)=>i===1?v+1.05:v),.075,C.light);let L=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.ceil(L/.31);for(let j=0;j<=n;j++){let v=a.map((v,i)=>v+(b[i]-v)*j/n);timber(v,v.map((x,i)=>i===1?x+1.03:x),.028,C.iron)}}
rail([-4.6,3.6,5.55],[7.6,3.6,5.55]);rail([-7.7,3.6,5.55],[-6.5,3.6,5.55]);
// Stair path rises toward +Z into the gap in the loft railing.
const stairStart=[-5.55,.02,-.3],stairEnd=[-5.55,3.6,5.6],N=19;
for(let i=0;i<N;i++){let t=(i+1)/N;box([1.8,.16,5.9/N+.04],[-5.55,3.6*t-.08,-.3+5.9*(i+.5)/N],C.light)}
for(let dx of [-.86,.86]){let a=[stairStart[0]+dx,.03,-.3],b=[stairEnd[0]+dx,3.42,5.6];beam(a,b,.18,C.dark);rail(a.map((v,i)=>i===1?v+.15:v),b.map((v,i)=>i===1?v+.15:v))}
// Rug: border, repeated diamonds and woven stripes.
box([8.3,.025,7],[.8,.07,-3.15],'#62382f');box([7.85,.015,6.55],[.8,.089,-3.15],'#baa078');box([7.4,.012,6.1],[.8,.101,-3.15],'#673c32');
for(let x=-2.55;x<4.3;x+=.72)for(let z=-5.9;z<0;z+=.76){box([.31,.008,.31],[x,.112,z],'#c0a77e',{rotation:[0,Math.PI/4,0]});box([.11,.009,.11],[x,.118,z],'#384c49',{rotation:[0,Math.PI/4,0]})}
// Furniture assemblies use a single yaw transform. Local front is -Z.
function furniture(cx,cz,yaw,fn){function B(s,v,c,e={}){let co=Math.cos(yaw),si=Math.sin(yaw);return box(s,[cx+v[0]*co+v[2]*si,v[1],cz-v[0]*si+v[2]*co],c,{rotation:[0,yaw,0],...e})}fn(B)}
function sofa(x,z,yaw,width=3.4){furniture(x,z,yaw,B=>{for(let a of [-1,1])for(let b of [-1,1])B([.12,.19,.12],[a*(width/2-.25),.15,b*.43],C.dark);B([width,.35,1.15],[0,.41,0],C.leather);B([width-.04,.72,.24],[0,.91,.48],C.leather);for(let s of [-1,1])B([.28,.57,1.16],[s*(width/2-.12),.72,0],C.leather);for(let i=0;i<3;i++){let px=(i-1)*(width-.62)/3;B([(width-.66)/3-.04,.19,.87],[px,.66,-.05],'#815037');B([(width-.66)/3-.035,.5,.19],[px,.97,.33],'#75472f')}for(let s of [-1,1]){B([.5,.45,.17],[s*(width/2-.55),.973,.13],s===1?'#a58b62':'#394b46');B([.07,.44,.018],[s*(width/2-.55),.98,.035],'#c3ac81')}})}
sofa(.8,.65,0,3.8);sofa(-2.6,-3.15,-Math.PI/2,3.2);
// Coffee table, books, and candles.
for(let x of [-.65,2.25])for(let z of [-3.94,-2.16])box([.18,.65,.18],[x,.44,z],C.dark);box([3.3,.13,2.1],[.8,.82,-3.05],C.light);box([3.1,.1,1.9],[.8,.25,-3.05],C.dark);
for(let i=0;i<4;i++)box([.58,.065,.4],[1.8,.93+i*.067,-3.35],['#4b5a55','#a99b7e','#533d35','#816444'][i]);
function candle(x,y,z,h=.25){
  cyl(.07,h,[x,y+h/2,z],'#ebd5a7');
  cyl(.005,.035,[x,y+h+.014,z],'#3d291e',{castShadow:false});
  const flame=p('cone',[.035,.11],[x,y+h+.075,z],'#ffdb84',{
    emissive:'#ffae32',emissiveIntensity:4.1,castShadow:false,roughness:.2,
  });
  candleFlames.push({node:flame,phase:rnd()*Math.PI*2});
}
cyl(.34,.04,[.35,.91,-3.05],C.iron);for(let i=0;i<3;i++)candle(.2+i*.15,.94,-3.05,.19+i*.08);
warmLight([.35,1.26,-3.05],'#ffbd75',32,3.7);
function lantern(x,y,z){box([.38,.05,.32],[x,y,z],C.iron);for(let sx of [-1,1])for(let sz of [-1,1])box([.026,.57,.026],[x+sx*.16,y+.3,z+sz*.13],C.iron);box([.42,.045,.36],[x,y+.6,z],C.iron);p('cone',[.28,.18],[x,y+.71,z],C.iron);candle(x,y+.04,z,.28);warmLight([x,y+.405,z],'#ffbd76',22,4.2)}
lantern(-2.2,3.68,-8.84);lantern(3.8,3.68,-8.84);
// Dining area on the right, with eight chairs.
box([2.5,.13,3.8],[5.25,.84,3.18],C.light);for(let x of [4.27,6.23])for(let z of [1.65,4.7])box([.16,.8,.16],[x,.4,z],C.dark);
for(let s of [-1,1])for(let z of [1.85,3.15,4.45])furniture(5.25+s*1.6,z,s*Math.PI/2,B=>{B([.65,.13,.68],[0,.48,0],C.wood);B([.63,.69,.11],[0,.85,.3],C.dark);for(let x of [-.24,.24])for(let zz of [-.23,.23])B([.08,.43,.08],[x,.23,zz],C.dark)});
for(let z of [2,3.2,4.4])for(let x of [4.55,5.95])cyl(.2,.025,[x,.925,z],C.cream);candle(5.25,.925,3.18,.32);
warmLight([5.25,1.32,3.18],'#ffcc82',25,4.2);
// Kitchen cabinetry beneath mezzanine.
for(let x=-2.7;x<3.5;x+=1.05){box([1,.86,.75],[x,.46,9.25],C.dark);box([.91,.69,.04],[x,.47,8.85],C.wood);box([.24,.027,.045],[x,.7,8.81],C.iron)}box([6.35,.09,1.02],[.4,.94,9.18],'#999486');
// Keep the upper shelves clear of the new sink window.
for(let x of [.2,2.3]){box([1.6,.09,.45],[x,2.05,9.62],C.light);for(let k=0;k<4;k++)cyl(.08,.19,[x-.5+k*.3,2.19,9.58],pick(['#b3aa8b','#65766b','#987c5f']))}
// Loft bookshelves and reading bench.
for(let x of [-3,2,6]){box([2.2,1.7,.4],[x,4.43,9.55],C.dark);for(let y of [3.7,4.3,4.9]){box([2.12,.06,.55],[x,y,9.47],C.light);for(let i=0;i<10;i++)box([.14,.31+rnd()*.18,.25],[x-.92+i*.2,y+.26,9.28],pick(['#763f32','#666e59','#ae9269','#3d5052']))}}
// Two suspended iron candle chandeliers, ring horizontal in XZ.
for(let z of [-3.6,2.3]){p('torus',[1.18,.055],[.8,4.65,z],C.iron,{rotation:[Math.PI/2,0,0]});for(let i=0;i<10;i++){let a=i*Math.PI/5,x=.8+1.18*Math.cos(a),zz=z+1.18*Math.sin(a);cyl(.12,.035,[x,4.69,zz],C.iron);candle(x,4.72,zz,.21);if(i%2===0)timber([x,4.68,zz],[.8,6.05,z],.015,C.iron)}timber([.8,6.05,z],[.8,8.3+upperRaise,z],.018,C.iron);
  // Each 10-candle ring uses two real lights at opposite candle flames.
  warmLight([1.98,5.015,z],'#ffbb72',65,7.3);
  warmLight([-.38,5.015,z],'#ffbb72',65,7.3);
}

// Interior finish pass: all decorative geometry stays non-colliding.
// Iron straps and pegged joints at the exposed timber connections.
for(const z of [-8,-3,2,7])for(const x of [-7.65,0,7.65]){
  box([.48,.55,.055],[x,5.45+upperRaise,z+.245],C.iron);
  for(const dx of [-.15,.15])for(const dy of [-.18,.18])ball(.037,[x+dx,5.45+upperRaise+dy,z+.283],'#494541',{scale:[1,1,.35]});
}
// Interior log knots and short grain checks, facing into the room.
for(const side of [-1,1])for(let row=0;row<15;row++){
  const y=.2+row*.36;
  for(const z of [-8.6,-2.3,4.1,9.3]){
    const zz=z+(rnd()-.5)*.5;
    ball(.055,[side*7.796,y,zz],C.dark,{scale:[.15,.65,1.7]});
    box([.012,.012,.24+rnd()*.22],[side*7.79,y-.04,zz+.2],C.dark);
  }
}
// Window curtains: open fabric panels and rods preserve the actual openings.
for(const side of [-1,1])for(const z of [-5,1,7]){
  timber([side*7.55,3.91,z-1.88],[side*7.55,3.91,z+1.88],.035,C.iron);
  for(const end of [-1,1]){
    ball(.073,[side*7.55,3.91,z+end*1.96],C.iron);
    for(let fold=0;fold<5;fold++){
      const zz=z+end*(1.46+fold*.085),xx=side*(7.59-(fold%2)*.055);
      box([.07,2.68,.087],[xx,2.42,zz],fold%2?'#83734d':'#9d8b62');
      box([.08,.095,.09],[xx,1.19,zz],'#534c35');
      p('torus',[.054,.009],[side*7.55,3.84,zz],C.iron);
    }
    box([.11,.085,.49],[side*7.54,2.11,z+end*1.64],'#5c3a25');
  }
}
// Leather sofa arm rolls, cushion piping and a woven throw.
function sofaFinish(cx,cz,yaw,width){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const T=v=>[cx+v[0]*c+v[2]*s,v[1],cz-v[0]*s+v[2]*c];
  for(const side of [-1,1]){
    timber(T([side*(width/2-.12),.99,-.47]),T([side*(width/2-.12),.99,.46]),.145,'#89593b');
    for(let i=0;i<7;i++)ball(.018,T([side*(width/2-.12),.76-i*.052,-.616]),'#bd9568');
  }
  for(let i=0;i<3;i++){
    const x=(i-1)*(width-.62)/3,w=(width-.66)/3-.04;
    timber(T([x-w/2,.761,-.45]),T([x+w/2,.761,-.45]),.012,'#b27d54');
    timber(T([x-w/2,.761,-.45]),T([x-w/2,.761,.29]),.011,'#b27d54');
    for(const dy of [.89,1.08])ball(.025,T([x,dy,.223]),'#553321',{scale:[1,1,1]});
  }
  furniture(cx,cz,yaw,B=>{
    const x=-width/2+.4;
    B([.63,.04,.88],[x,.785,-.01],'#a48e69');
    B([.63,.55,.035],[x,.514,-.468],'#a48e69');
    for(let k=0;k<6;k++){
      B([.025,.046,.88],[x-.26+k*.105,.811,-.01],'#65583d');
      B([.025,.55,.043],[x-.26+k*.105,.52,-.474],'#65583d');
    }
    for(let k=0;k<7;k++)B([.025,.12,.025],[x-.27+k*.09,.22,-.474],'#c0ab82');
  });
}
sofaFinish(.8,.65,0,3.8);sofaFinish(-2.6,-3.15,-Math.PI/2,3.2);
// Rug fringe and alternating border stitching.
for(let x=-3.22;x<4.85;x+=.12)for(const z of [-6.71,.41])box([.035,.012,.19],[x,.078,z],'#c4ac84');
for(let z=-6.25;z<.1;z+=.2)for(const x of [-3.17,4.77])box([.13,.009,.035],[x,.111,z],'#d0b690');
// Mantel botanical arrangements: shaped pottery and branching stems.
function vase(x,y,z,col){
  p('sphere',[.23],[x,y+.28,z],col,{scale:[1,1.32,1]});
  p('cylinder',[.105,.17,.21],[x,y+.52,z],col);
  p('torus',[.109,.018],[x,y+.625,z],col,{rotation:[Math.PI/2,0,0]});
  cyl(.085,.009,[x,y+.62,z],'#322c21');
  for(let i=0;i<7;i++){
    const a=i*2.4,tip=[x+Math.cos(a)*(.22+i*.035),y+1.02+rnd()*.35,z+Math.sin(a)*.25];
    timber([x,y+.57,z],tip,.012,'#655237');
    for(let k=0;k<3;k++){
      let q=.45+k*.18,px=x+(tip[0]-x)*q,py=y+.57+(tip[1]-y-.57)*q,pz=z+(tip[2]-z)*q;
      ball(.105,[px+.06,py,pz],pick(['#5d6c40','#74804c','#8b8953']),{scale:[1.45,.38,.65],rotation:[0,a,.4]});
    }
    ball(.067,tip,'#d4c59e');
  }
}
vase(2.66,3.65,-8.85,'#6b5640');vase(-1.05,3.65,-8.89,'#9b8863');
for(const x of [-.9,-.58,-.32])candle(x,3.66,-8.64,.18+rnd()*.21);
warmLight([-.61,4.04,-8.64],'#ffc17c',29,3.7);
// Hearth implements: stand, poker, brush, shovel and a log basket.
const toolX=3.72,toolZ=-7.74;
box([.58,.05,.4],[toolX,.38,toolZ],C.iron);
timber([toolX,.4,toolZ],[toolX,1.54,toolZ],.024,C.iron);
beam([toolX-.3,1.47,toolZ],[toolX+.3,1.47,toolZ],.027,C.iron);
for(let i=0;i<3;i++){
  let x=toolX-.24+i*.24;
  timber([x,.62,toolZ],[x,1.4,toolZ],.014,C.iron);
  p('torus',[.047,.012],[x,1.41,toolZ],C.iron);
  if(i===0)beam([x,.62,toolZ],[x+.12,.61,toolZ],.024,C.iron);
  if(i===1)box([.15,.19,.035],[x,.56,toolZ],'#34302b');
  if(i===2)for(let k=0;k<5;k++)box([.017,.19,.05],[x-.045+k*.022,.55,toolZ],'#786449');
}
for(let i=0;i<6;i++){
  const x=-2.35+(i%3)*.22,y=.51+Math.floor(i/3)*.2;
  timber([x-.16,y,-7.9],[x+.19,y,-7.53],.095,C.dark);
}
for(const z of [-8.02,-7.47])beam([-2.66,.39,z],[-1.65,.39,z],.035,C.iron);
for(const x of [-2.65,-1.65])beam([x,.39,-8.02],[x,.85,-8.02],.035,C.iron);
// Low glowing coals remain beneath the animated flame volumes.
for(let i=0;i<34;i++)ball(.035+rnd()*.026,[-1.2+rnd()*3.9,.49+rnd()*.055,-9.5+rnd()*.55],pick(['#8f3218','#c84d1c','#e88427']),{scale:[1.55,.45,1],emissive:'#c84518',emissiveIntensity:2.4});
// Dining tabletop: plates, bowls, mugs, flatware, bread and a runner.
box([.38,.012,3.4],[5.25,.92,3.18],'#76674c');
function mug(x,y,z,col){cyl(.065,.14,[x,y+.07,z],col);cyl(.053,.008,[x,y+.143,z],'#33271e');p('torus',[.055,.013],[x+.073,y+.078,z],col);}
for(const z of [2,3.2,4.4])for(const x of [4.55,5.95]){
  p('torus',[.172,.012],[x,.946,z],C.cream,{rotation:[Math.PI/2,0,0]});
  cyl(.085,.045,[x,.963,z],'#b5b99b');
  box([.018,.014,.27],[x+.26,.936,z],'#99988c');
  box([.027,.014,.24],[x-.26,.936,z],'#99988c');
  mug(x+.23,.93,z-.29,'#657568');
}
box([.32,.025,.59],[5.25,.952,2.12],C.light);
for(let i=0;i<4;i++)ball(.09,[5.25,.995,1.93+i*.12],'#bf9659',{scale:[1,.55,1.1]});
// Counter: inset sink impression, arched faucet, hob and cooking ware.
box([1.3,.018,.68],[-1.8,1,9.15],'#3e4845');
box([1.07,.021,.48],[-1.8,1.004,9.15],'#78837b');
for(const z of [8.82,9.48])box([1.32,.025,.025],[-1.8,1.016,z],'#b0b4a8');
for(const x of [-2.46,-1.14])box([.025,.025,.66],[x,1.016,9.15],'#b0b4a8');
timber([-1.8,1.02,9.52],[-1.8,1.37,9.52],.023,'#989e95');
timber([-1.8,1.37,9.52],[-1.8,1.37,9.26],.023,'#989e95');
timber([-1.8,1.37,9.26],[-1.8,1.28,9.26],.023,'#989e95');
box([1.25,.025,.79],[1.13,1.01,9.17],C.iron);
for(const x of [.83,1.43])for(const z of [8.98,9.39])p('torus',[.14,.018],[x,1.041,z],'#67675c',{rotation:[Math.PI/2,0,0]});
cyl(.16,.2,[1.43,1.14,9.39],'#444a43');cyl(.177,.025,[1.43,1.25,9.39],'#767a6e');ball(.033,[1.43,1.28,9.39],C.iron);
for(const s of [-1,1])box([.09,.034,.075],[1.43+s*.21,1.17,9.39],C.iron);
box([.65,.035,.43],[2.64,1.01,9.15],C.light);for(let i=0;i<3;i++)ball(.055,[2.5+i*.11,1.065,9.13],pick(['#a35236','#9b783d','#738248']));
cyl(.105,.25,[3.05,1.14,9.45],'#947b55');for(let i=0;i<4;i++)timber([3.0+i*.036,1.1,9.45],[2.97+i*.054,1.52,9.45],.013,C.dark);
// Cupboard panel mouldings and shelf brackets.
for(let x=-2.7;x<3.5;x+=1.05){for(const dx of [-.36,.36])box([.035,.51,.025],[x+dx,.46,8.817],C.light);for(const y of [.205,.715])box([.75,.035,.025],[x,y,8.817],C.light)}
for(const x of [-.4,.8,1.7,2.9])beam([x,1.72,9.76],[x,2.01,9.4],.035,C.iron);
// Book spine bands, warm reading lanterns, and a wall clock above the loft.
for(const x of [-3,2,6])for(const y of [3.7,4.3,4.9])for(let i=0;i<10;i++){
  const xx=x-.92+i*.2;
  for(const dy of [.11,.31])box([.11,.018,.012],[xx,y+dy,9.148],'#bda271');
}
lantern(-.65,3.6,9.28);lantern(4.3,3.6,9.28);
p('cylinder',[.43,.43,.075],[.2,5.05,9.72],C.dark,{rotation:[Math.PI/2,0,0]});
p('cylinder',[.37,.37,.082],[.2,5.05,9.67],'#cbb68a',{rotation:[Math.PI/2,0,0]});
for(let i=0;i<12;i++){let a=i*Math.PI/6;box([.022,.055,.014],[.2+Math.sin(a)*.31,5.05+Math.cos(a)*.31,9.615],C.dark,{rotation:[0,0,-a]})}
beam([.2,5.05,9.6],[.2,5.29,9.6],.019,C.iron);beam([.2,5.05,9.6],[.04,5.13,9.6],.026,C.iron);
// Coffee table joinery, feet, page edges and a pair of mugs.
for(const x of [-.74,2.34])for(const z of [-3.94,-2.16])ball(.025,[x,.74,z],C.iron);
for(let i=0;i<4;i++)box([.5,.038,.012],[1.8,.93+i*.067,-3.143],'#d1c5a4');
mug(-.24,.9,-2.49,'#657568');mug(1.09,.9,-3.58,'#b6a789');

// Covered rear porch centered on the existing outward-opening rear doorway.
// It lives in the cabin's original local frame and follows the same timber palette.
const porchCX=rearDoorCX,porchW=2.85,porchHalfW=porchW/2;
const porchBackZ=9.86,porchFrontZ=12.55,porchD=porchFrontZ-porchBackZ;
const porchLeft=porchCX-porchHalfW,porchRight=porchCX+porchHalfW;
const porchDeckTop=.09,porchEaveY=2.36,porchRidgeY=2.86,porchRoofFrontZ=12.72;
// Framed deck and closely spaced planks align with the cabin threshold.
box([porchW,.15,porchD],[porchCX,-.037,(porchBackZ+porchFrontZ)/2],C.dark);
for(let x=porchLeft+.1;x<porchRight;x+=.2)box([.188,.055,porchD-.05],[x,.062,(porchBackZ+porchFrontZ)/2],pick(woods));
for(const z of [porchBackZ+.11,porchFrontZ-.14])beam([porchLeft,-.045,z],[porchRight,-.045,z],.13,C.dark,.16);
for(const x of [porchLeft+.1,porchRight-.1])beam([x,-.045,porchBackZ],[x,-.045,porchFrontZ],.12,C.dark,.15);
// A shallow front step gives the deck a finished edge without blocking the entry path.
box([1.18,.10,.34],[porchCX,-.015,porchFrontZ+.16],C.dark);
for(let x=porchCX-.5;x<=porchCX+.5;x+=.2)box([.185,.045,.32],[x,.058,porchFrontZ+.16],pick(woods));
// Full-height front posts and wall ledger support a compact gabled roof.
for(const x of [porchLeft+.08,porchRight-.08]){
  box([.18,porchEaveY-.05,.18],[x,(porchEaveY-.05)/2,porchFrontZ-.12],C.wood);
  // Small diagonal knee braces under the front beam.
  timber([x,1.82,porchFrontZ-.12],[x+(x<porchCX?.36:-.36),2.24,porchFrontZ-.12],.075,C.light);
}
beam([porchLeft,2.27,porchFrontZ-.17],[porchRight,2.27,porchFrontZ-.17],.16,C.dark,.18);
beam([porchLeft,2.29,9.94],[porchRight,2.29,9.94],.12,C.dark,.14);
// Roof boards run down each pitch, with exposed ridge/eave trim.
for(let z=9.82;z<=porchRoofFrontZ;z+=.27){
  for(const side of [-1,1])beam([porchCX+side*porchHalfW,porchEaveY,z],[porchCX,porchRidgeY,z],.105,pick(['#6f4429','#795035','#66402a','#845638']),.255);
}
timber([porchCX,porchRidgeY,9.77],[porchCX,porchRidgeY,porchRoofFrontZ+.03],.105,C.dark);
for(const side of [-1,1])timber([porchCX+side*porchHalfW,porchEaveY,9.82],[porchCX+side*porchHalfW,porchEaveY,porchRoofFrontZ+.02],.085,C.dark);
// Front fascia traces the little gable and a simple king-post detail fills its face.
for(const side of [-1,1])beam([porchCX,porchRidgeY,porchRoofFrontZ],[porchCX+side*porchHalfW,porchEaveY,porchRoofFrontZ],.095,C.dark,.12);
timber([porchCX,2.28,porchRoofFrontZ-.01],[porchCX,porchRidgeY-.05,porchRoofFrontZ-.01],.065,C.light);
for(const side of [-1,1])timber([porchCX,2.34,porchRoofFrontZ-.01],[porchCX+side*.58,porchEaveY+.04,porchRoofFrontZ-.01],.052,C.light);
// Waist-high rails protect both sides and the front corners while leaving a broad center opening.
const porchRailY=.72,porchRailTop=1.05,porchFrontOpening=1.08;
for(const side of [-1,1]){
  const x=porchCX+side*(porchHalfW-.07);
  beam([x,porchRailTop,10.12],[x,porchRailTop,porchFrontZ-.12],.075,C.light,.09);
  beam([x,.31,10.12],[x,.31,porchFrontZ-.12],.055,C.dark,.07);
  for(let z=10.28;z<porchFrontZ-.18;z+=.28)timber([x,.25,z],[x,porchRailTop-.05,z],.035,C.wood);
}
const frontGapL=porchCX-porchFrontOpening/2,frontGapR=porchCX+porchFrontOpening/2;
for(const [a,b] of [[porchLeft+.08,frontGapL],[frontGapR,porchRight-.08]]){
  beam([a,porchRailTop,porchFrontZ-.08],[b,porchRailTop,porchFrontZ-.08],.075,C.light,.09);
  beam([a,.31,porchFrontZ-.08],[b,.31,porchFrontZ-.08],.055,C.dark,.07);
  const n=Math.max(1,Math.floor((b-a)/.27));
  for(let i=0;i<=n;i++){const x=a+(b-a)*i/n;timber([x,.25,porchFrontZ-.08],[x,porchRailTop-.05,porchFrontZ-.08],.035,C.wood);}
}
// Pegs and post caps echo the cabin's exposed joinery.
for(const x of [porchLeft+.08,porchRight-.08]){
  box([.25,.075,.25],[x,porchEaveY-.02,porchFrontZ-.12],C.dark);
  for(const y of [.52,1.05,1.82])ball(.025,[x,y,porchFrontZ-.185],C.iron,{scale:[1,1,.42]});
}

// Structural collision layer. Simple slabs/volumes cover the major obstacles;
// decorative primitives remain visual-only. All bodies stay static, so the cabin
// is walkable architecture rather than a single falling rigid body.
app.resetOnMove = false;
const collisionBodies = [];
function solid(size,position,rotation=[0,0,0]) {
  const anchor=app.create('prim',{type:'box',size,position,rotation,opacity:0,physics:null});
  app.add(anchor);
  const body=app.create('prim',{type:'box',size,opacity:0,physics:'static',staticFriction:.7,dynamicFriction:.6,restitution:0});
  world.add(body);
  collisionBodies.push({anchor,body});
}
// Floor top matches the visible planks. Open rear doorway stays open.
solid([16,.3,20],[0,-.1,0]);
for(const side of [-1,1]) {
  solid([.38,1.15,20],[side*8,.575,0]);
  solid([.38,2.23+upperRaise,20],[side*8,4.675+upperRaise/2,0]);
  for(const [a,b] of [[-10,-6.5],[-3.5,-.5],[2.5,5.5],[8.5,10]])
    solid([.38,2.41,b-a],[side*8,2.355,(a+b)/2]);
}
solid([16,wallPlateY,.38],[0,wallPlateY/2,-10]);
// Rear wall collision mirrors the raised window and the separate porch doorway.
// Below the sill, the wall remains solid except for the doorway.
solid([rearDoorL+8,rearWindowBottom,.38],[(-8+rearDoorL)/2,rearWindowBottom/2,10]);
solid([8-rearDoorR,rearWindowBottom,.38],[(rearDoorR+8)/2,rearWindowBottom/2,10]);
// From sill to door head, both openings are respected.
solid([rearWindowL+8,rearDoorTop-rearWindowBottom,.38],[(-8+rearWindowL)/2,(rearWindowBottom+rearDoorTop)/2,10]);
solid([rearDoorL-rearWindowR,rearDoorTop-rearWindowBottom,.38],[(rearWindowR+rearDoorL)/2,(rearWindowBottom+rearDoorTop)/2,10]);
solid([8-rearDoorR,rearDoorTop-rearWindowBottom,.38],[(rearDoorR+8)/2,(rearWindowBottom+rearDoorTop)/2,10]);
// Above the doorway, only the window remains open.
solid([rearWindowL+8,rearWindowTop-rearDoorTop,.38],[(-8+rearWindowL)/2,(rearDoorTop+rearWindowTop)/2,10]);
solid([8-rearWindowR,rearWindowTop-rearDoorTop,.38],[(rearWindowR+8)/2,(rearDoorTop+rearWindowTop)/2,10]);
// Full wall above the window, plus a thin collision pane so the glazing is physical.
solid([16,wallPlateY-rearWindowTop,.38],[0,(rearWindowTop+wallPlateY)/2,10]);
solid([rearWindowW-.18,rearWindowH-.16,.06],[rearWindowCX,rearWindowMidY,10]);
// Gable collision follows the narrowing horizontal log courses.
for(let y=5.95+upperRaise;y<8.95+upperRaise;y+=.32)for(const z of [-10,10])solid([2*(roofRidgeY-y)/.4,.32,.34],[0,y,z]);
// Two roof collision planes match the extended visible roof and its unchanged pitch.
const roofRise=roofRidgeY-roofEaveY,roofLength=Math.hypot(roofHalfWidth,roofRise),roofPitch=Math.atan2(roofRise,roofHalfWidth);
for(const side of [-1,1])solid([roofLength,.16,roofHalfDepth*2],[side*roofHalfWidth/2,(roofRidgeY+roofEaveY)/2,0],[0,0,-side*roofPitch]);
// Loft top at 3.59 metres and individually supported treads.
solid([16,.3,4.4],[0,3.44,7.8]);
for(let i=0;i<19;i++)solid([1.8,.16,5.9/19+.04],[-5.55,3.6*(i+1)/19-.08,-.3+5.9*(i+.5)/19]);
// Rail volumes prevent walking off the loft; the stair entrance stays clear.
solid([12.2,1.1,.12],[1.5,4.12,5.55]);
solid([1.2,1.1,.12],[-7.1,4.12,5.55]);
for(const dx of [-.86,.86]) {
  const a=[-5.55+dx,.18,-.3],b=[-5.55+dx,3.57,5.6];
  const dy=b[1]-a[1],dz=b[2]-a[2];
  solid([.1,1.2,Math.hypot(dy,dz)],[-5.55+dx,(a[1]+b[1])/2+.45,2.65],[-Math.atan2(dy,dz),0,0]);
}
for(const x of [-7.6,-3.3,1.8,7.6])solid([.48,5.42+upperRaise,.48],[x,(5.42+upperRaise)/2,5.65]);
// Hearth, jambs, lintel/chimney mass and mantel preserve the firebox opening.
solid([8.4,.35,2.1],[.8,.175,-8.82]);
for(const x of [-2.4,4])solid([1.6,2.7,1.22],[x,1.7,-9.25]);
solid([8,4.55,1],[.8,5.325,-9.4]);
solid([8.75,.47,1.5],[.8,3.44,-9.1]);
solid([4.8,2.7,.15],[.8,1.69,-9.85]);
// Sofa seats, backs and arms. Local -Z is always the seating direction.
function sofaSolids(cx,cz,yaw,width){
  function S(size,v){let c=Math.cos(yaw),s=Math.sin(yaw);solid(size,[cx+v[0]*c+v[2]*s,v[1],cz-v[0]*s+v[2]*c],[0,yaw,0]);}
  S([width,.6,1.15],[0,.39,0]);S([width,.72,.24],[0,.91,.48]);
  for(const s of [-1,1])S([.28,.57,1.2],[s*(width/2-.12),.72,0]);
}
sofaSolids(.8,.65,0,3.8);sofaSolids(-2.6,-3.15,-Math.PI/2,3.2);
solid([3.3,.88,2.1],[.8,.44,-3.05]);
solid([2.5,.13,3.8],[5.25,.84,3.18]);
for(const x of [4.27,6.23])for(const z of [1.65,4.7])solid([.16,.8,.16],[x,.4,z]);
for(const side of [-1,1])for(const z of [1.85,3.15,4.45])solid([.72,1.2,.65],[5.25+side*1.6,.6,z]);
solid([6.35,.99,1.02],[.4,.495,9.18]);
for(const x of [-3,2,6])solid([2.2,1.7,.55],[x,4.43,9.47]);
// Rear porch collision: walkable deck/step, posts, rails and both roof pitches.
solid([porchW,.18,porchD],[porchCX,0,(porchBackZ+porchFrontZ)/2]);
solid([1.18,.10,.34],[porchCX,-.015,porchFrontZ+.16]);
for(const x of [porchLeft+.08,porchRight-.08])solid([.20,porchEaveY,.20],[x,porchEaveY/2,porchFrontZ-.12]);
for(const side of [-1,1])solid([.12,.90,porchFrontZ-10.12],[porchCX+side*(porchHalfW-.07),.65,(10.12+porchFrontZ-.12)/2]);
for(const [a,b] of [[porchLeft+.08,frontGapL],[frontGapR,porchRight-.08]])solid([b-a,.90,.12],[(a+b)/2,.65,porchFrontZ-.08]);
const porchRoofSlope=Math.hypot(porchHalfW,porchRidgeY-porchEaveY),porchRoofPitch=Math.atan2(porchRidgeY-porchEaveY,porchHalfW);
for(const side of [-1,1])solid([porchRoofSlope,.13,porchRoofFrontZ-9.78],[porchCX+side*porchHalfW/2,(porchRidgeY+porchEaveY)/2,(9.78+porchRoofFrontZ)/2],[0,0,-side*porchRoofPitch]);
// A single change-driven synchronization callback for the complete layer.
// No per-detail callbacks or continuous PhysX rebuilding.
let lastPosition=null,lastQuaternion=null,lastScale=null;
function syncStructure(){
  const scaleChanged=!lastScale||!lastScale.equals(app.scale);
  const moved=!lastPosition||!lastPosition.equals(app.position)||!lastQuaternion.equals(app.quaternion);
  if(!scaleChanged&&!moved)return;
  for(const {anchor,body} of collisionBodies){
    body.position.copy(anchor.position.clone().multiply(app.scale).applyQuaternion(app.quaternion).add(app.position));
    body.quaternion.copy(app.quaternion.clone().multiply(anchor.quaternion));
    body.scale.copy(app.scale);
    if(scaleChanged){body.physics=null;body.physics='static';}
  }
  lastPosition=app.position.clone();lastQuaternion=app.quaternion.clone();lastScale=app.scale.clone();
}
syncStructure();
app.on('update',syncStructure);
app.on('destroy',()=>{for(const {body} of collisionBodies)world.remove(body);collisionBodies.length=0;});

// Door collision follows the animated leaf instead of blocking the cut opening.
const rearDoorCollisionAnchor=app.create('prim',{type:'box',size:[rearDoorW-.08,rearDoorH,.1],opacity:0,physics:null});app.add(rearDoorCollisionAnchor);
const rearDoorBody=app.create('prim',{type:'box',size:[rearDoorW-.08,rearDoorH,.1],opacity:0,physics:'static',staticFriction:.7,dynamicFriction:.6,restitution:0});world.add(rearDoorBody);
function syncRearDoorBody(angle){
  const half=(rearDoorW-.08)/2;
  rearDoorCollisionAnchor.position.x=rearDoorL+Math.cos(angle)*half;
  rearDoorCollisionAnchor.position.y=rearDoorBase+rearDoorH/2;
  rearDoorCollisionAnchor.position.z=rearDoorZ-Math.sin(angle)*half;
  rearDoorCollisionAnchor.rotation.y=angle;
  rearDoorBody.position.copy(rearDoorCollisionAnchor.position.clone().multiply(app.scale).applyQuaternion(app.quaternion).add(app.position));
  rearDoorBody.quaternion.copy(app.quaternion.clone().multiply(rearDoorCollisionAnchor.quaternion));
  rearDoorBody.scale.copy(app.scale);
}
function animateRearDoor(delta){
  const target=rearDoorOpenTarget?1:0;
  if(rearDoorAmount!==target){
    const step=Math.min(1,delta*2.6);
    rearDoorAmount+=Math.sign(target-rearDoorAmount)*Math.min(Math.abs(target-rearDoorAmount),step);
  }
  const eased=rearDoorAmount*rearDoorAmount*(3-2*rearDoorAmount),angle=-eased*Math.PI/2;
  rearDoorPivot.rotation.y=angle;
  syncRearDoorBody(angle);
}
animateRearDoor(0);
app.on('update',animateRearDoor);
app.on('cabin:door',data=>{if(data&&typeof data.open==='boolean')setRearDoorOpen(data.open)});
app.on('destroy',()=>world.remove(rearDoorBody));

// Native multiplayer seats. One stable anchor per cushion/chair on every peer.
const SIT_EMOTE='asset://88506687fb069c946049e1ba6f1bac97f52b01851ad83dca7f2516d9d7e44f74.glb';
const cabinSeats=[];
function seatingRow(id,cx,cz,yaw,width,count,height,isChair=false){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const transform=v=>[cx+v[0]*c+v[2]*s,v[1],cz-v[0]*s+v[2]*c];
  const row=[];
  for(let i=0;i<count;i++){
    const offset=count===1?0:(i-(count-1)/2)*(width-.62)/count;
    const anchor=app.create('anchor',{id:id+'-'+i,position:transform([offset,height, isChair?-.04:-.05]),rotation:[0,yaw,0]});app.add(anchor);
    const exit=app.create('group',{position:transform([offset,.07,isChair?.64:1.15]),rotation:[0,yaw,0]});app.add(exit);
    const seat={id:id+'-'+i,anchor,exit,offset};cabinSeats.push(seat);row.push(seat);
  }
  // Bind the actual visible cushions, chair backs, arms, piping and throws.
  // Invisible Prim nodes do not enter Hyperfy's pointer raycaster.
  for(const n of clickableGeometry){
    const dx=n.position.x-cx,dz=n.position.z-cz,lx=dx*c-dz*s,lz=dx*s+dz*c;
    if(Math.abs(lx)>width/2+.025||Math.abs(lz)>(isChair?.39:.66)||n.position.y<.12||n.position.y>1.32)continue;
    let closest=row[0];for(const seat of row)if(Math.abs(lx-seat.offset)<Math.abs(lx-closest.offset))closest=seat;
    n.cursor='pointer';n.onPointerDown=e=>{e.stopPropagation();requestCabinSeat(closest);};
  }
}
seatingRow('sofa-front',.8,.65,0,3.8,3,.855);
seatingRow('sofa-left',-2.6,-3.15,-Math.PI/2,3.2,3,.855);
for(const side of [-1,1])for(const [i,z] of [1.85,3.15,4.45].entries())seatingRow('dining-'+side+'-'+i,5.25+side*1.6,z,side*Math.PI/2,.65,1,.645,true);
let requestCabinSeat=()=>{};
// Authoritative occupancy prevents two clients claiming the same place.
if(world.isServer){
  const occupied={};app.state.cabinSeats=occupied;
  app.state.cabinDoorOpen=false;setRearDoorOpen(false);
  let rearDoorCheckElapsed=0;
  const publish=()=>app.send('cabin:seats',{...occupied});
  const doorWorldPoint=()=>rearDoorSensor.position.clone().multiply(app.scale).applyQuaternion(app.quaternion).add(app.position);
  const checkRearDoor=delta=>{
    rearDoorCheckElapsed+=delta;if(rearDoorCheckElapsed<.1)return;rearDoorCheckElapsed=0;
    const d=doorWorldPoint();
    const open=world.getPlayers().some(player=>{
      const p=player.position,dx=p.x-d.x,dy=p.y-d.y,dz=p.z-d.z;
      return Math.abs(dy)<2.25&&dx*dx+dz*dz<6.25;
    });
    if(open===app.state.cabinDoorOpen)return;
    app.state.cabinDoorOpen=open;setRearDoorOpen(open);app.send('cabin:door',{open});
  };
  app.on('update',checkRearDoor);
  const identify=networkId=>world.getPlayers().find(p=>p.networkId===networkId);
  app.on('cabin:claim',(data,networkId)=>{
    const player=identify(networkId);if(!player||!data||!cabinSeats.some(s=>s.id===data.seatId))return;
    const owner=occupied[data.seatId];
    if(owner&&owner!==player.id){app.send('cabin:answer',{playerId:player.id,seatId:data.seatId,token:data.token,accepted:false});return;}
    for(const id of Object.keys(occupied))if(occupied[id]===player.id)delete occupied[id];
    occupied[data.seatId]=player.id;publish();
    app.send('cabin:answer',{playerId:player.id,seatId:data.seatId,token:data.token,accepted:true});
  });
  app.on('cabin:release',(data,networkId)=>{
    const player=identify(networkId);if(!player||!data)return;
    if(occupied[data.seatId]===player.id){delete occupied[data.seatId];publish();}
  });
  const onLeave=({playerId})=>{let dirty=false;for(const id of Object.keys(occupied))if(occupied[id]===playerId){delete occupied[id];dirty=true;}if(dirty)publish();};
  world.on('leave',onLeave);app.on('destroy',()=>world.off('leave',onLeave));
}
// The package viewer has no player API; only the real world enables interaction.
if(world.isClient&&typeof world.getPlayer==='function'){
  let occupied={...(app.state.cabinSeats||{})},current=null,pending=null,token=0,tearingDown=false;
  const player=world.getPlayer();
  function worldPoint(node){return node.position.clone().multiply(app.scale).applyQuaternion(app.quaternion).add(app.position);}
  function stand(){if(current)current.effect.cancel();}
  function sit(seat){
    stand();
    const entry={seat,effect:null};current=entry;
    entry.effect=player.applyEffect({anchor:seat.anchor,emote:SIT_EMOTE,cancellable:true,onEnd:()=>{
      if(current!==entry)return;current=null;
      if(!tearingDown)app.send('cabin:release',{seatId:seat.id});
      // Stand behind the seat, outside its collision volume and away from the table.
      player.teleport(worldPoint(seat.exit));
    }});
  }
  requestCabinSeat=seat=>{
    if(!player||tearingDown)return;
    if(current&&current.seat.id===seat.id){stand();return;}
    if(pending)return;
    if(occupied[seat.id]&&occupied[seat.id]!==player.id)return;
    const pos=worldPoint(seat.anchor),pp=player.position;
    if(Math.hypot(pos.x-pp.x,pos.y-pp.y,pos.z-pp.z)>4)return;
    pending={seat,token:++token};app.send('cabin:claim',{seatId:seat.id,token});
  };
  app.on('cabin:seats',data=>{occupied=data||{};});
  app.on('cabin:answer',answer=>{
    if(!answer||answer.playerId!==player.id)return;
    if(!pending||answer.token!==pending.token)return;
    const seat=pending.seat;pending=null;
    if(answer.accepted)sit(seat);
  });
  app.on('destroy',()=>{tearingDown=true;pending=null;stand();});
}
