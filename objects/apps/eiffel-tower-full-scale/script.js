// Eiffel Tower: 1 unit = 1 metre. +Y up, +X right, -Z forward.
// Static physical replica; exact colliders on primary members, decks and large solids.
// Fine latticework remains decorative. One transform-change synchronization handler.
// Loader target: Hyperfy v0.16-compatible model bootstrap + script prim API.
// Main dimensions: official toureiffel.paris/en/the-monument/key-figures.
app.resetOnMove = false
const collisionPairs=[]
const IRON='#746052', EDGE='#927968', DARK='#4e433b', GOLD='#b29870', GLASS='#52686b', STONE='#b7ab98'
function box(size, position, color=IRON, rotation=[0,0,0]) {
  const n=app.create('prim',{type:'box',size,position,rotation,color,roughness:0.76,metalness:0.35,physics:null,castShadow:true,receiveShadow:true});app.add(n);return n
}
// Only explicitly marked structural pieces receive detached exact-shape colliders.
function physical(visible) {
  const collider=app.create('prim',{
    type:'box',size:visible.size,opacity:0,physics:null,
    castShadow:false,receiveShadow:false,staticFriction:0.65,dynamicFriction:0.55,
  });
  collisionPairs.push({visible,collider,lastScale:null});
  return visible;
}
const solidBox=(...args)=>physical(box(...args));
const solidBeam=(...args)=>physical(beam(...args));
// Align local Y using the runtime's YXZ Euler convention. Every member is audited.
function beam(a,b,t=0.3,color=IRON) {
  const d=b.map((v,i)=>v-a[i]), L=Math.hypot(...d), h=Math.hypot(d[0],d[2]);
  if(L<1e-8)throw Error('Zero length member');
  const rx=Math.atan2(h,d[1]), ry=h?Math.atan2(d[0],d[2]):0;
  const u=[Math.sin(ry)*Math.sin(rx),Math.cos(rx),Math.cos(ry)*Math.sin(rx)];
  if(Math.hypot(...u.map((v,i)=>v*L-d[i]))>1e-6)throw Error('Endpoint orientation');
  return box([t,L,t],a.map((v,i)=>(v+b[i])/2),color,[rx,ry,0]);
}
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t)
const sections=[[3,50,12.5],[12,45,11.8],[23,39.5,10.5],[35,33.8,9.1],[46,28.4,8],[57,24,7],[70,20,6.3],[84,16.4,5.6],[99,12.9,4.9],[115,10,4]]
function section(y){for(let i=1;i<sections.length;i++)if(y<=sections[i][0])return lerp(sections[i-1],sections[i],(y-sections[i-1][0])/(sections[i][0]-sections[i-1][0]));return sections[sections.length-1]}
function corners(y,sx,sz){const [,c,w]=section(y);return [[sx*c-w,y,sz*c-w],[sx*c+w,y,sz*c-w],[sx*c+w,y,sz*c+w],[sx*c-w,y,sz*c+w]]}
// Four open, curved, box-truss piers. Footings fit within the 125 m square.
for(const sx of [-1,1])for(const sz of [-1,1]){
 solidBox([25,3,25],[sx*50,1.5,sz*50],STONE);
 solidBox([24,0.55,24],[sx*50,3.1,sz*50],DARK);
 for(let j=0;j<sections.length-1;j++){
  const lo=corners(sections[j][0],sx,sz),hi=corners(sections[j+1][0],sx,sz);
  for(let k=0;k<4;k++){
   const n=(k+1)%4;
   solidBeam(lo[k],hi[k],j<5?1.15:0.86,EDGE);
   beam(lo[k],lo[n],0.65,EDGE);
   beam(lo[k],hi[n],0.42);beam(lo[n],hi[k],0.42);
   const m0=lerp(lo[k],hi[k],.5),m1=lerp(lo[n],hi[n],.5);
   beam(m0,m1,.27,EDGE);
   // Narrow internal subdivisions give the piers a riveted lattice character.
   beam(lo[k],lerp(lo[n],hi[n],.5),.19);beam(lerp(lo[k],hi[k],.5),hi[n],.19);
  }
 }
 // Twin inclined lift guide rails, with a static glazed car.
 for(let j=0;j<sections.length-1;j++)for(const off of [-1.1,1.1]){
  const a=sections[j],b=sections[j+1];
  beam([sx*a[1]+off,a[0],sz*a[1]],[sx*b[1]+off,b[0],sz*b[1]],.24,DARK);
 }
 const carY=sx===sz?28:78,ss=section(carY),cx=sx*ss[1],cz=sz*ss[1];
 solidBox([4.1,3.7,4.1],[cx,carY,cz],DARK);box([4.2,1.8,4.2],[cx,carY+.6,cz],GLASS);
 solidBox([4.5,.35,4.5],[cx,carY+2.05,cz],EDGE);
}
// Four decorative arches, with paired curving ribs, lattice webs and spandrels.
function facePoint(u,y,side,depth=0){const s=section(Math.max(3,y)),z=s[1]+s[2]+depth;return side===0?[u,y,-z]:side===1?[z,y,u]:side===2?[-u,y,z]:[-z,y,-u]}
for(let side=0;side<4;side++){
 const N=36;
 function arch(i,upper){const t=Math.PI*i/N;return facePoint(-39*Math.cos(t),8+40*Math.sin(t)+(upper?3:0),side,-.6)}
 for(let i=0;i<N;i++){
  beam(arch(i,false),arch(i+1,false),.78,EDGE);beam(arch(i,true),arch(i+1,true),.54,EDGE);
  beam(arch(i,false),arch(i+1,true),.24);beam(arch(i,true),arch(i+1,false),.2);
  if(i>3&&i<N-3&&i%2===0){const p=arch(i,true);let u=side%2===0?p[0]:p[2];if(side>=2)u=-u;beam(p,facePoint(u,54,side,-.6),.3);}
 }
}
function ring(y,half,t,color=EDGE){const p=[[-half,y,-half],[half,y,-half],[half,y,half],[-half,y,half]];for(let k=0;k<4;k++)beam(p[k],p[(k+1)%4],t,color)}
function deck(y,half,hole,band){
 const w=half-hole;
 solidBox([half*2,.65,w],[0,y-.325,-(half+hole)/2],DARK);solidBox([half*2,.65,w],[0,y-.325,(half+hole)/2],DARK);
 if(hole>0){solidBox([w,.65,hole*2],[-(half+hole)/2,y-.325,0],DARK);solidBox([w,.65,hole*2],[(half+hole)/2,y-.325,0],DARK);}
 for(const yy of [y-band,y-.65,y,y+1.25])ring(yy,half,yy===y-band?.6:.28,EDGE);
 for(let side=0;side<4;side++){
  const map=(u,v)=>side===0?[u,v,-half]:side===1?[half,v,u]:side===2?[-u,v,half]:[-half,v,-u];
  const count=Math.ceil(half*2/2.8);
  for(let i=0;i<count;i++){
   const a=-half+i*2*half/count,b=-half+(i+1)*2*half/count;
   beam(map(a,y),map(a,y+1.25),.12);beam(map(a,y-band),map(b,y-.65),.22);beam(map(b,y-band),map(a,y-.65),.22);
  }
 }
 if(hole>0){ring(y+1.2,hole,.15);for(let k=-hole;k<=hole;k+=3){beam([k,y,-hole],[k,y+1.2,-hole],.12);beam([k,y,hole],[k,y+1.2,hole],.12);beam([-hole,y,k],[-hole,y+1.2,k],.12);beam([hole,y,k],[hole,y+1.2,k],.12);}}
}
deck(57,35,16,4);deck(115,20,7.5,3.8);deck(119,18.5,7.5,1.1);
// First-floor pavilions, glazed window strips and overhanging roofs.
for(const sign of [-1,1]){
 solidBox([9,3.6,40],[sign*27,59,0],DARK);box([9.1,2,39.5],[sign*27,59.25,0],GLASS);
 solidBox([10.2,.45,42],[sign*27,61.05,0],EDGE);
 for(let z=-19;z<=19;z+=2.2)for(const x of [sign*27-4.6,sign*27+4.6])beam([x,57,z],[x,61,z],.14,EDGE);
 solidBox([25,3,6],[0,58.8,sign*29],DARK);box([25.1,1.65,6.1],[0,59,sign*29],GLASS);solidBox([26,.4,7],[0,60.5,sign*29],EDGE);
 // Decorative gold frieze panels evoke the names around the first gallery.
 for(let x=-31;x<=31;x+=3.3)box([2,.36,.12],[x,55.75,sign*35.18],GOLD);
}
// Curved upper pylon: four corner chords, horizontal frames and X lattice.
const upper=[[115,14],[128,12.5],[141,11],[154,9.7],[167,8.55],[180,7.55],[193,6.7],[206,5.95],[219,5.3],[232,4.75],[245,4.25],[258,3.9],[270,3.6],[276,3.5]]
for(let j=0;j<upper.length-1;j++){
 const [y,r]=upper[j],[Y,R]=upper[j+1],a=[[-r,y,-r],[r,y,-r],[r,y,r],[-r,y,r]],b=[[-R,Y,-R],[R,Y,-R],[R,Y,R],[-R,Y,R]];
 ring(y,r,.42);
 for(let k=0;k<4;k++){
  const n=(k+1)%4;solidBeam(a[k],b[k],Math.max(.43,.9-j*.036),EDGE);
  beam(a[k],b[n],.33);beam(a[n],b[k],.33);
  beam(lerp(a[k],b[k],.5),lerp(a[n],b[n],.5),.22,EDGE);
  beam(lerp(a[k],a[n],.5),lerp(b[k],b[n],.5),.2);
 }
}
// Central upper lift core and guide rails visible through the lattice.
for(const x of [-1.3,1.3])for(const z of [-1.3,1.3])beam([x,119,z],[x,274,z],.22,DARK);
for(let y=124;y<270;y+=8)ring(y,1.4,.15,DARK);
solidBox([2.4,3.2,2.4],[0,208,0],GLASS);
// Summit enclosed gallery and open observation deck.
deck(273.5,7.5,0,2.2);
solidBox([10,2.3,10],[0,274.85,0],GLASS);
for(const x of [-5,5])for(let z=-5;z<=5;z+=1.25)beam([x,273.5,z],[x,276,z],.15,EDGE);
for(const z of [-5,5])for(let x=-5;x<=5;x+=1.25)beam([x,273.5,z],[x,276,z],.15,EDGE);
deck(276,7,0,0.55);ring(278.4,7,.15);
for(let i=0;i<16;i++){const u=-7+i*14/15;for(const s of [-1,1]){beam([u,277.2,s*7],[u,278.4,s*7],.075);beam([s*7,277.2,u],[s*7,278.4,u],.075);}}
solidBox([5,3,5],[0,277.5,0],DARK);
// Crown framework to the original 300 m roof, then the modern antenna to 330 m.
for(let y=279;y<300;y+=3){const r=3.6-(y-279)*.11,R=3.6-(y+3-279)*.11;ring(y,r,.22);for(const sx of [-1,1])for(const sz of [-1,1]){beam([sx*r,y,sz*r],[sx*R,y+3,sz*R],.3,EDGE);beam([sx*r,y,sz*r],[-sx*R,y+3,sz*R],.15);}}
solidBox([3.8,.45,3.8],[0,300,0],EDGE);
for(let y=300.225;y<325;y+=2.5){const h=Math.min(2.5,325-y);box([1.05,h,1.05],[0,y+h/2,0],Math.floor(y/2.5)%2?EDGE:'#c1b7a6');}
box([.38,5,.38],[0,327.5,0],'#b9b4a8');
for(const y of [302,307,312,317])for(const sx of [-1,1])for(const sz of [-1,1])box([.22,2.2,.22],[sx*.95,y,sz*.95],EDGE);

// Batch synchronization: no allocations or PhysX rebuilds while the app is unchanged.
let lastPosition=null,lastQuaternion=null,lastAppScale=null;
function syncStructuralPhysics() {
  if(lastPosition && lastPosition.equals(app.position) &&
     lastQuaternion.equals(app.quaternion) && lastAppScale.equals(app.scale))return;
  for(const pair of collisionPairs) {
    const {visible,collider}=pair;
    const position=visible.position.clone().multiply(app.scale).applyQuaternion(app.quaternion).add(app.position);
    const quaternion=app.quaternion.clone().multiply(visible.quaternion);
    const scale=app.scale.clone().multiply(visible.scale);
    collider.position.copy(position);collider.quaternion.copy(quaternion);collider.scale.copy(scale);
    if(!pair.lastScale){collider.physics='static';world.add(collider);pair.lastScale=scale.clone();}
    else if(!pair.lastScale.equals(scale)){
      collider.physics=null;collider.physics='static';pair.lastScale.copy(scale);
    }
  }
  if(!lastPosition){lastPosition=app.position.clone();lastQuaternion=app.quaternion.clone();lastAppScale=app.scale.clone();}
  else{lastPosition.copy(app.position);lastQuaternion.copy(app.quaternion);lastAppScale.copy(app.scale);}
}
syncStructuralPhysics();
app.on('update',syncStructuralPhysics);
app.on('destroy',()=>{for(const pair of collisionPairs)world.remove(pair.collider);collisionPairs.length=0;});
