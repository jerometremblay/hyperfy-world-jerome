// Extracted from Timber Hearth — Sittable Cabin.
// Coordinates are prompt-box-local so importing this app preserves the sofa's exact world pose.
const C={dark:'#432a1c',leather:'#663b26'};
const CX=0.0436126274877203,CZ=0.0548789425945763,Y0=-0.84310458464406,YAW=Math.PI,WIDTH=2.1;
const clickable=[];
function p(type,size,position,color,extra={}){
  const n=app.create('prim',{type,size,position,color,roughness:.86,metalness:0,physics:null,...extra});
  app.add(n);clickable.push(n);return n;
}
function box(size,pos,color,extra={}){return p('box',size,pos,color,extra)}
function ball(r,pos,color,extra={}){return p('sphere',[r],pos,color,extra)}
function segment(a,b,w,color,round=true,depth=w){
  let d=b.map((v,i)=>v-a[i]),L=Math.hypot(...d);d=d.map(v=>v/L);
  let q=d[1]<-.999999?[1,0,0,0]:[d[2],0,-d[0],1+d[1]],m=Math.hypot(...q);q=q.map(v=>v/m);
  return p(round?'cylinder':'box',round?[w,w,L]:[w,L,depth],a.map((v,i)=>(v+b[i])/2),color,{quaternion:q});
}
const timber=(a,b,r=.19,c='#86532e')=>segment(a,b,r,c);
function T(v){const c=Math.cos(YAW),s=Math.sin(YAW);return [CX+v[0]*c+v[2]*s,Y0+v[1],CZ-v[0]*s+v[2]*c]}
function B(size,v,color,extra={}){return box(size,T(v),color,{rotation:[0,YAW,0],...extra})}
// Original three-seat sofa body and cushions.
for(const a of [-1,1])for(const b of [-1,1])B([.12,.19,.12],[a*(WIDTH/2-.25),.15,b*.43],C.dark);
B([WIDTH,.35,1.15],[0,.41,0],C.leather);
B([WIDTH,.72,.24],[0,.91,.48],C.leather);
for(const s of [-1,1])B([.28,.57,1.2],[s*(WIDTH/2-.12),.72,0],C.leather);
for(let i=0;i<3;i++){
  const px=(i-1)*(WIDTH-.62)/3;
  B([(WIDTH-.66)/3-.04,.19,.87],[px,.66,-.05],'#815037');
  B([(WIDTH-.66)/3-.035,.5,.19],[px,.97,.33],'#75472f');
}
for(const s of [-1,1]){
  B([.5,.45,.17],[s*(WIDTH/2-.55),.98,.13],s===1?'#a58b62':'#394b46');
  B([.07,.44,.018],[s*(WIDTH/2-.55),.98,.035],'#c3ac81');
}
// Original leather finishing: arm rolls, piping, tufting and woven throw.
for(const side of [-1,1]){
  timber(T([side*(WIDTH/2-.12),.99,-.47]),T([side*(WIDTH/2-.12),.99,.46]),.145,'#89593b');
  for(let i=0;i<7;i++)ball(.018,T([side*(WIDTH/2-.12),.76-i*.052,-.616]),'#bd9568');
}
for(let i=0;i<3;i++){
  const x=(i-1)*(WIDTH-.62)/3,w=(WIDTH-.66)/3-.04;
  timber(T([x-w/2,.761,-.45]),T([x+w/2,.761,-.45]),.012,'#b27d54');
  timber(T([x-w/2,.761,-.45]),T([x-w/2,.761,.29]),.011,'#b27d54');
  for(const dy of [.89,1.08])ball(.025,T([x,dy,.223]),'#553321');
}
{
  const x=-WIDTH/2+.4;
  B([.63,.04,.88],[x,.785,-.01],'#a48e69');
  B([.63,.55,.035],[x,.52,-.468],'#a48e69');
  for(let k=0;k<6;k++){
    B([.025,.046,.88],[x-.26+k*.105,.811,-.01],'#65583d');
    B([.025,.55,.043],[x-.26+k*.105,.52,-.474],'#65583d');
  }
  for(let k=0;k<7;k++)B([.025,.12,.025],[x-.27+k*.09,.22,-.474],'#c0ab82');
}
// Simplified static collision matching the original seat, back and arms.
function solid(size,v){
  const n=app.create('prim',{type:'box',size,position:T(v),rotation:[0,YAW,0],opacity:0,physics:'static',staticFriction:.7,dynamicFriction:.6,restitution:0});
  app.add(n);return n;
}
solid([WIDTH,.6,1.15],[0,.39,0]);solid([WIDTH,.72,.24],[0,.91,.48]);
for(const s of [-1,1])solid([.28,.57,1.2],[s*(WIDTH/2-.12),.72,0]);

// Three native multiplayer sitting positions, aligned with the three cushions.
const SIT_EMOTE='asset://88506687fb069c946049e1ba6f1bac97f52b01851ad83dca7f2516d9d7e44f74.glb';
const seats=[];
for(let i=0;i<3;i++){
  const offset=(i-1)*(WIDTH-.62)/3;
  const anchor=app.create('anchor',{id:'sofa-seat-'+i,position:T([offset,.855,-.05]),rotation:[0,YAW,0]});app.add(anchor);
  const exit=app.create('group',{position:T([offset,.07,1.15]),rotation:[0,YAW,0]});app.add(exit);
  seats.push({id:'sofa-seat-'+i,offset,anchor,exit});
}
// The visible sofa is the click target; choose the nearest cushion by local X.
for(const n of clickable){
  const dx=n.position.x-CX,dz=n.position.z-CZ,c=Math.cos(YAW),s=Math.sin(YAW),lx=dx*c-dz*s;
  let seat=seats[0];for(const candidate of seats)if(Math.abs(lx-candidate.offset)<Math.abs(lx-seat.offset))seat=candidate;
  n.cursor='pointer';n.onPointerDown=e=>{e.stopPropagation();requestSeat(seat)};
}
let requestSeat=()=>{};
if(world.isServer){
  const occupied={};app.state.sofaSeats=occupied;
  const publish=()=>app.send('sofa:seats',{...occupied});
  const identify=networkId=>world.getPlayers().find(p=>p.networkId===networkId);
  app.on('sofa:claim',(data,networkId)=>{
    const player=identify(networkId);if(!player||!data||!seats.some(s=>s.id===data.seatId))return;
    const owner=occupied[data.seatId];
    if(owner&&owner!==player.id){app.send('sofa:answer',{playerId:player.id,seatId:data.seatId,token:data.token,accepted:false});return;}
    for(const id of Object.keys(occupied))if(occupied[id]===player.id)delete occupied[id];
    occupied[data.seatId]=player.id;publish();
    app.send('sofa:answer',{playerId:player.id,seatId:data.seatId,token:data.token,accepted:true});
  });
  app.on('sofa:release',(data,networkId)=>{
    const player=identify(networkId);if(!player||!data)return;
    if(occupied[data.seatId]===player.id){delete occupied[data.seatId];publish();}
  });
  const onLeave=({playerId})=>{let dirty=false;for(const id of Object.keys(occupied))if(occupied[id]===playerId){delete occupied[id];dirty=true;}if(dirty)publish();};
  world.on('leave',onLeave);app.on('destroy',()=>world.off('leave',onLeave));
}
if(world.isClient&&typeof world.getPlayer==='function'){
  let occupied={...(app.state.sofaSeats||{})},current=null,pending=null,token=0,tearingDown=false;
  const player=world.getPlayer();
  function worldPoint(node){return node.position.clone().multiply(app.scale).applyQuaternion(app.quaternion).add(app.position)}
  function stand(){if(current)current.effect.cancel()}
  function sit(seat){
    stand();const entry={seat,effect:null};current=entry;
    entry.effect=player.applyEffect({anchor:seat.anchor,emote:SIT_EMOTE,cancellable:true,onEnd:()=>{
      if(current!==entry)return;current=null;
      if(!tearingDown)app.send('sofa:release',{seatId:seat.id});
      player.teleport(worldPoint(seat.exit));
    }});
  }
  requestSeat=seat=>{
    if(!player||tearingDown)return;
    if(current&&current.seat.id===seat.id){stand();return;}
    if(pending)return;if(occupied[seat.id]&&occupied[seat.id]!==player.id)return;
    const pos=worldPoint(seat.anchor),pp=player.position;if(Math.hypot(pos.x-pp.x,pos.y-pp.y,pos.z-pp.z)>4)return;
    pending={seat,token:++token};app.send('sofa:claim',{seatId:seat.id,token});
  };
  app.on('sofa:seats',data=>{occupied=data||{}});
  app.on('sofa:answer',answer=>{
    if(!answer||answer.playerId!==player.id||!pending||answer.token!==pending.token)return;
    const seat=pending.seat;pending=null;if(answer.accepted)sit(seat);
  });
  app.on('destroy',()=>{tearingDown=true;pending=null;stand()});
}
