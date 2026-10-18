// Coordinate system: +Y up, +X right, -Z forward.
// A purely decorative, standalone surround that intentionally does NOT replace the native World Portal.
// It is authored in prompt-box space, but fitted around the intersected World Portal's true position and aperture.
const C = {
  iron:'#21282d', iron2:'#394246', iron3:'#50585a', shadow:'#111719',
  bronze:'#835432', copper:'#b47743', brightCopper:'#d79656',
  brass:'#d9ab61', pale:'#efce83', verdigris:'#40665e', glass:'#337e79',
  glow:'#77e7cf', rust:'#6d4630', cream:'#c9b58c'
};
const PI = Math.PI;
// Actual World Portal alignment recovered from the provided intersected portal app.
const PORTAL_ROOT = [0.3058811205004929, -0.8071019278509297, 0]; // app origin in prompt-box coordinates
const APERTURE_SCALE = [1.6/0.522, 2.4/0.734, 1.18]; // fit rectangular opening to the native portal
const APERTURE_LIFT = 0.448; // moves the original threshold up so the portal bottom lands at Y=0 in portal-local space
const frameRoot = app.create('group', { position: PORTAL_ROOT });
const frame = app.create('group', { position: [0, APERTURE_LIFT, 0], scale: APERTURE_SCALE });
frameRoot.add(frame);
app.add(frameRoot);
let count = 0;
function prim(type,size,p,color,extra={}) {
  const n = app.create('prim', {
    type,size,position:p,color,physics:null,metalness:0.83,roughness:0.37,
    castShadow:true,receiveShadow:true,...extra
  });
  frame.add(n); count++; return n;
}
function box(w,h,d,x,y,z,c,extra={}) { return prim('box',[w,h,d],[x,y,z],c,extra); }
function ball(r,x,y,z,c,extra={}) { return prim('sphere',[r],[x,y,z],c,extra); }
function cyl(r,h,x,y,z,c,extra={}) { return prim('cylinder',[r,r,h],[x,y,z],c,extra); }
function torus(R,r,x,y,z,c,extra={}) { return prim('torus',[R,r],[x,y,z],c,extra); }
function beam(a,b,width,depth,color,z,extra={}) {
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  return prim('box',[width,len,depth],[(a[0]+b[0])/2,(a[1]+b[1])/2,z],color,
    {rotation:[0,0,-Math.atan2(dx,dy)],...extra});
}
function pipe(a,b,r,color,z,extra={}) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  return prim('cylinder',[r,r,Math.hypot(dx,dy)],[(a[0]+b[0])/2,(a[1]+b[1])/2,z],color,
    {rotation:[0,0,-Math.atan2(dx,dy)],...extra});
}
const arc = (r,a)=>[r*Math.cos(a),0.058+r*Math.sin(a)];
function band(r,w,dep,z,color,n=28){
  for(let i=0;i<n;i++)beam(arc(r,PI-i*PI/n),arc(r,PI-(i+1)*PI/n),w,dep,color,z);
}
function archedPipe(r,t,z,color,n=28,extra={}){
  for(let i=0;i<n;i++)pipe(arc(r,PI-i*PI/n),arc(r,PI-(i+1)*PI/n),t,color,z,extra);
}
function gem(x,y,z,r){
  ball(r,x,y,z,C.glass,{emissive:C.glow,emissiveIntensity:1.6,metalness:0.25,roughness:0.21});
  torus(r*1.18,r*.23,x,y,z-.006,C.brass);
}
function bolt(x,y,z,r=.009){
  ball(r,x,y,z,C.pale,{roughness:.24});
  box(r*.9,r*.20,r*.35,x,y,z+r*.80,C.bronze,{rotation:[0,0,PI/4]});
}
function gear(cx,cy,cz,r,teeth,accent,rot=0) {
  // Front-facing toothed wheel, centered inside the frame material.
  torus(r*.71,r*.19,cx,cy,cz,C.bronze);
  torus(r*.48,r*.085,cx,cy,cz+.012,accent);
  for(let i=0;i<teeth;i++){
    const a=rot+2*PI*i/teeth;
    const x=cx+r*.88*Math.cos(a),y=cy+r*.88*Math.sin(a);
    box(r*.21,r*.30,.022,x,y,cz,accent,{rotation:[0,0,a-PI/2]});
  }
  for(let i=0;i<5;i++){
    const a=i*2*PI/5+rot;
    pipe([cx+Math.cos(a)*r*.19,cy+Math.sin(a)*r*.19],
         [cx+Math.cos(a)*r*.50,cy+Math.sin(a)*r*.50],r*.066,C.iron2,cz+.014);
  }
  cyl(r*.20,.02,cx,cy,cz+.024,C.shadow,{rotation:[PI/2,0,0]});
  ball(r*.13,cx,cy,cz+.039,C.pale);
}

// Layered, cast-iron chassis around an open archway; no solid plane through the center.
for (const side of [-1,1]) {
  const x=side*.332;
  box(.147,.555,.190,x,-.221,0,C.shadow);
  box(.119,.536,.208,x,-.211,.002,C.iron);
  box(.112,.537,.015,x,-.209,.115,C.iron2);
  box(.016,.519,.248,x-side*.057,-.212,0,C.bronze);
  box(.018,.509,.240,x+side*.062,-.214,0,C.bronze);
  box(.025,.54,.245,x,-.219,-.067,C.iron3);
  // Solid foot, with heavy cast iron base plate and brass inset.
  box(.205,.022,.340,x,-.486,0,C.shadow);
  box(.188,.019,.317,x,-.466,0,C.bronze);
  box(.160,.015,.290,x,-.453,.002,C.brass);
  for(const xx of [x-.071,x+.071]) for(const zz of [-.12,.12])bolt(xx,-.446,zz,.009);
  for (const y of [-.405,-.285,-.137,.01]){
    box(.153,.018,.245,x,y,.0,C.bronze);
    box(.14,.007,.25,x,y+.011,0,C.brass);
    for(const s of [-1,1]) bolt(x+s*.055,y,.128,.008);
  }
  // A center vertical fluted boiler plate, with turquoise oxidized filigree and rivets.
  box(.064,.472,.014,x,-.223,.132,C.verdigris);
  box(.021,.446,.018,x,-.223,.146,C.copper);
  for (let i=0;i<11;i++){
    const y=-.420+i*.039;
    box(.053,.004,.012,x,y,.158,i%2 ? C.bronze : C.brass);
  }
  for(const yy of [-.405,-.365,-.325,-.285,-.245,-.205,-.165,-.125,-.085,-.045]){
    bolt(x-side*.041,yy,.145,.0055);
  }
  // Twin outside steam pipes, clamped to the structure; maintain a real central opening.
  for(const zz of [-.087,.083]){
    pipe([x+side*.081,-.415],[x+side*.081,.045],.011,C.copper,zz);
    for(const yy of [-.36,-.18,-.02]){
      box(.059,.014,.023,x+side*.079,yy,zz,C.iron3);
      bolt(x+side*.077,yy,zz+.015,.006);
    }
  }
  // Piston housing and brass ram on each front corner.
  box(.054,.142,.057,x+side*.083,-.277,.09,C.shadow);
  box(.044,.119,.066,x+side*.083,-.281,.10,C.bronze);
  pipe([x+side*.083,-.211],[x+side*.083,-.140],.009,C.pale,.112);
  ball(.020,x+side*.083,-.133,.114,C.brightCopper);
  // Small coil/spring windings on the piston, discreetly exposed.
  for(let i=0;i<5;i++){
    torus(.022,.004,x+side*.083,-.314+i*.017,.145,C.copper,{rotation:[PI/2,0,0]});
  }
  // Backside frame: still reads as a finished cast-metal object from behind.
  box(.035,.494,.012,x,-.223,-.123,C.iron3);
  for(const yy of [-.395,-.285,-.15,-.02]){
    bolt(x,yy,-.134,.008);
  }
}
// Structural overhead: keep the ornate outer arch, but make the clear opening itself rectangular.
band(.324,.097,.202,-.005,C.shadow);
band(.333,.078,.210,.006,C.iron);
band(.341,.063,.018,.116,C.iron2);
band(.301,.018,.200,-.007,C.bronze);
band(.360,.022,.200,-.007,C.bronze);
archedPipe(.336,.007,.154,C.brightCopper);
archedPipe(.381,.008,.125,C.brass);
const jambX = .268, apertureBottom = -.448, apertureTop = .286;
// Flat-topped lintel assembly so the portal opening matches the native rectangular portal.
box(.618,.040,.206,0,apertureTop+.020,-.004,C.shadow);
box(.594,.032,.214,0,apertureTop+.028,.006,C.iron);
box(.566,.015,.018,0,apertureTop+.046,.118,C.brass);
box(.550,.010,.014,0,apertureTop+.056,.140,C.brightCopper);
for (const xx of [-.235,-.078,.078,.235]) bolt(xx,apertureTop+.047,.136,.0065);
// Rectangular illuminated inner trim.
for (const side of [-1,1]) {
  pipe([side*jambX,apertureBottom],[side*jambX,apertureTop],.007,C.glass,.143,{emissive:C.glow,emissiveIntensity:.80});
  pipe([side*(jambX+.016),apertureBottom],[side*(jambX+.016),apertureTop],.009,C.brass,.110);
  pipe([side*(jambX-.012),apertureBottom],[side*(jambX-.012),apertureTop],.006,C.copper,.132);
}
pipe([-.261,apertureTop],[.261,apertureTop],.007,C.glass,.143,{emissive:C.glow,emissiveIntensity:1.05});
pipe([-.278,apertureTop+.004],[.278,apertureTop+.004],.009,C.brass,.110);
pipe([-.248,apertureTop-.003],[.248,apertureTop-.003],.006,C.copper,.132);
// Small elbow joints where the upright conduits meet the top run.
for (const side of [-1,1]) {
  torus(.020,.005,side*.266,apertureTop,.143,C.brass,{rotation:[0,0,PI/2]});
  torus(.016,.004,side*.262,apertureTop+.001,.132,C.copper,{rotation:[0,0,PI/2]});
}
// Mechanical ring segments, outer castellated teeth, small engraved brass radial graduations.
for(let i=0;i<=24;i++){
  const a=PI-i*PI/24;
  const [x,y]=arc(.402,a);
  box(.028,.013,.058,x,y,.042,i%2?C.copper:C.bronze,{rotation:[0,0,a-PI/2]});
  const [tx,ty]=arc(.345,a);
  box(.012,.017,.013,tx,ty,.167,C.brass,{rotation:[0,0,a-PI/2]});
  const [bx,by]=arc(.320,a);
  if(i%2===0)bolt(bx,by,.169,.007);
}
for(let i=0;i<17;i++){
  const a=PI-(i+.5)*PI/17;
  const [x,y]=arc(.364,a);
  box(.006,.019,.008,x,y,.139,i%4===0?C.pale:C.copper,{rotation:[0,0,a-PI/2]});
}
// Riveted control block above the rectangular lintel.
box(.105,.053,.195,0,.374,0,C.shadow);
box(.089,.045,.207,0,.377,.012,C.bronze);
box(.074,.030,.013,0,.377,.124,C.brass);
for(const xx of [-.032,.032]) bolt(xx,.375,.136,.007);
gem(0,.378,.16,.018);
// Crown: polished gauge bezel, rotary needle, compact steam relief valve.
torus(.039,.009,0,.453,.096,C.brass);
torus(.030,.006,0,.453,.107,C.bronze);
cyl(.025,.008,0,.453,.108,C.cream,{rotation:[PI/2,0,0],metalness:.13});
pipe([-.015,.441],[.017,.464],.0027,C.shadow,.118);
ball(.006,0,.453,.121,C.brightCopper);
for(let i=0;i<8;i++){
  const a=i*PI/4;
  const x=.034*Math.cos(a),y=.453+.034*Math.sin(a);
  ball(.0028,x,y,.116,C.iron);
}
// Brass finials and gauge-reinforced shoulders.
for(const side of [-1,1]){
  const x=side*.336;
  gear(x,.090,.166,.057,11,C.brass,side*.11);
  gear(x,-.178,.176,.049,10,C.copper,side*.25);
  gem(x,-.341,.180,.015);
  box(.015,.056,.032,side*.433,-.440,.034,C.brass);
  ball(.019,side*.433,-.406,.034,C.brightCopper);
  box(.020,.043,.031,side*.286,.437,.0,C.iron2);
  ball(.022,side*.286,.467,.0,C.brass);
}
// Additional asymmetry: exposed gear train on the left and turbine valve on the right.
gear(-.408,-.088,.152,.030,9,C.brightCopper,.22);
gear(.406,-.088,.151,.026,8,C.bronze,-.27);
// Pipe bosses with jewel bearings and axle caps.
for(const side of [-1,1]){
  for(const y of [-.404,-.289,-.048]){
    cyl(.013,.017,side*.334,y,.167,C.bronze,{rotation:[PI/2,0,0]});
    ball(.007,side*.334,y,.181,C.pale);
  }
}
// Open ground threshold, shallow enough not to obstruct traversal.
box(.552,.014,.221,0,-.487,.000,C.iron);
box(.530,.006,.235,0,-.479,.000,C.bronze);
for(let i=-10;i<=10;i++){
  box(.007,.002,.17,i*.024,-.475,0,i%4===0?C.brass:C.iron2);
}
// Decorative lower side gussets and small beveled-looking corner rivets.
for(const side of [-1,1]){
  beam([side*.284,-.457],[side*.383,-.371],.021,.115,C.bronze,.075);
  bolt(side*.288,-.453,.139,.008);
  bolt(side*.383,-.369,.139,.008);
}
