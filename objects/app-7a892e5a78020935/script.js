// Large tropical houseplant with a hand-detailed terracotta planter.
// Hyperfy coordinates: +Y up, +X right, -Z forward.
// The app origin is the exact CENTER of the prompt-box; physical base is at -1.0921984885638678.
// Geometry is static/visual-only: no update callbacks, no physics or detached world nodes.

const PI = Math.PI
const TAU = PI * 2
const BASE_Y = -1.0921984885638678
const SOIL_Y = -0.627
const leafPalette = ['#255e38', '#286940', '#307447', '#326f40', '#3b8050', '#225c3d', '#397749', '#28633b', '#437f4f']
const veinPalette = ['#669e64', '#72a86c', '#83b373', '#6d9c5f', '#619360']

function add(type, size, position, color, opts = {}) {
  const node = app.create('prim', {
    type, size, position, color,
    roughness: opts.roughness ?? 0.8,
    metalness: 0,
    castShadow: opts.castShadow ?? true,
    receiveShadow: true,
    physics: null,
    ...(opts.rotation ? { rotation: opts.rotation } : {}),
    ...(opts.scale ? { scale: opts.scale } : {}),
    ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}),
  })
  app.add(node)
  return node
}
function cylinder(rt, rb, h, p, c, opts) { return add('cylinder', [rt, rb, h], p, c, opts) }
function torus(R, r, p, c, opts) { return add('torus', [R, r], p, c, opts) }
function sphere(r, p, c, opts) { return add('sphere', [r], p, c, opts) }
function plus(a, b) { return [a[0]+b[0],a[1]+b[1],a[2]+b[2]] }
function sub(a, b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]] }
function mul(a, k) { return [a[0]*k,a[1]*k,a[2]*k] }
function lerp(a, b, t) { return plus(mul(a,1-t),mul(b,t)) }
function length(a) { return Math.hypot(a[0],a[1],a[2]) }
function mid(a, b) { return mul(plus(a,b),0.5) }
// Canonical orientation from two endpoints (local +Y is the cylinder/leaf axis).
function yRotation(a,b) {
  const d = sub(b,a), h = Math.hypot(d[0],d[2])
  return h === 0 ? [d[1]>=0 ? 0 : PI, 0, 0] : [Math.atan2(h,d[1]),Math.atan2(d[0],d[2]),0]
}
function stem(a,b,r,color) {
  return cylinder(r*0.92,r*1.08,length(sub(b,a)),mid(a,b),color,{rotation:yRotation(a,b),roughness:.75})
}
function pointInLeafFrame(a,b,local) {
  const [rx,ry] = yRotation(a,b)
  const c=Math.cos(rx), s=Math.sin(rx), C=Math.cos(ry), S=Math.sin(ry)
  return plus(mid(a,b), [C*local[0]+S*s*local[1]+S*c*local[2],c*local[1]-s*local[2],-S*local[0]+C*s*local[1]+C*c*local[2]])
}
function leafWidth(t,maxHalfWidth) {
  return maxHalfWidth * Math.pow(Math.max(0,Math.sin(PI*t)),0.72) * (0.80 + 0.25*t)
}
function leafOutline(L,halfWidth,variation) {
  const left=[],right=[]
  for (let i=0;i<=22;i++) {
    const t=i/22, y=(t-0.5)*L
    const flutter=1+0.035*Math.sin(t*34+variation)+0.02*Math.sin(t*65+variation*1.7)
    const width=leafWidth(t,halfWidth)*flutter
    left.push([-width*(0.985+0.045*Math.sin(variation+i)),y])
    right.push([width,y])
  }
  return [...right, ...left.reverse()]
}
function makeLeaf(base,tip,halfWidth,leafColor,veinColor,index) {
  const len=length(sub(tip,base))
  const leaf = app.create('prim',{
    type:'extrude',
    profile:leafOutline(len,halfWidth,index*.61),
    depth:0.012,
    bevelEnabled:false,
    position:mid(base,tip),
    rotation:yRotation(base,tip),
    color:leafColor,
    doubleside:true,
    roughness:.53,
    metalness:0,
    castShadow:true,
    receiveShadow:true,
    physics:null,
  })
  app.add(leaf)
  // A pale raised midrib and diagonal branching veins are attached to each leaf.
  // Positive local Z is the outward-facing front of this leaf.
  const center0=pointInLeafFrame(base,tip,[0,(-0.50+.045)*len,.011])
  const center1=pointInLeafFrame(base,tip,[0,(0.50-.055)*len,.011])
  stem(center0,center1,.0045,veinColor)
  for (const t of [.31,.53,.74]) {
    for (const side of [-1,1]) {
      const y0=(t-0.5)*len
      const t1=Math.min(.965,t+.095)
      const w=leafWidth(t1,halfWidth)*.88*side
      const a=pointInLeafFrame(base,tip,[side*.004,y0,.014])
      const b=pointInLeafFrame(base,tip,[w,(t1-.5)*len,.012])
      stem(a,b,.0020,veinColor)
    }
  }
}

// TERRACOTTA: tapered pot, raised rolled lip, three molded bands, worn clay detailing.
cylinder(.204,.193,.045,[0,BASE_Y+.025,0],'#934930',{roughness:.95})
cylinder(.267,.196,.398,[0,BASE_Y+.248,0],'#ba724a',{roughness:1})
cylinder(.273,.251,.070,[0,BASE_Y+.419,0],'#bd744b',{roughness:1})
cylinder(.248,.248,.018,[0,SOIL_Y-.013,0],'#402f25',{roughness:1})
// Toruses start in XY and rotate into the horizontal XZ plane.
const horizontal={rotation:[PI/2,0,0],roughness:.96}
torus(.261,.025,[0,-.635,0],'#d49365',horizontal)
torus(.267,.016,[0,-.671,0],'#a75c38',horizontal)
torus(.225,.010,[0,-.795,0],'#d18d5f',horizontal)
torus(.201,.010,[0,-1.039,0],'#c17a4c',horizontal)
torus(.243,.006,[0,-.745,0],'#a96140',horizontal)
torus(.217,.007,[0,-.939,0],'#985131',horizontal)
// Stamped ornamental relief: two embossed rings of discrete clay beads and a chevron frieze.
for(let i=0;i<24;i++) {
  const th=TAU*i/24
  sphere(.011,[.241*Math.cos(th),-.827,.241*Math.sin(th)],'#cf8960',{scale:[.92,.84,.55],roughness:1})
}
for(let i=0;i<14;i++) {
  const th=TAU*i/14
  const r=.247
  const p=[r*Math.cos(th),-.902,r*Math.sin(th)]
  sphere(.010,p,'#a8603e',{scale:[.8,1.7,.8],roughness:1})
}
// Porous soil with scattered rounded river grit at the surface.
const pebbleColors=['#6b5340','#82644c','#66503b','#403930','#9a775b']
for(let i=0;i<14;i++) {
  const a=i*2.3999632, r=.052+Math.sqrt((i%19)/19)*.166
  sphere(.007+(i%4)*.002,[Math.cos(a)*r,SOIL_Y+.006,Math.sin(a)*r],pebbleColors[i%pebbleColors.length],{scale:[1,.48,.7],roughness:1})
}
// A few slender sheaths emerge from the soil, grounding the many stalks.
for(let i=0;i<4;i++) {
  const a=i*TAU/4
  const root=[.037*Math.cos(a),SOIL_Y+.002,.037*Math.sin(a)]
  const end=[.078*Math.cos(a),SOIL_Y+.26,.078*Math.sin(a)]
  stem(root,end,.022,'#365e35')
}

// The plant is organized by age: taller spear-shaped center leaves,
// mature mid-canopy leaves, and slightly drooping broad outer leaves.
const tiers=[
  {count:4, start:[.20,.36], rise:[.61,.72], radial:[.20,.30], halfWidth:[.127,.155]},
  {count:6, start:[.02,.23], rise:[.53,.68], radial:[.30,.38], halfWidth:[.131,.163]},
  {count:7, start:[-.23,.03], rise:[.42,.58], radial:[.32,.39], halfWidth:[.115,.149]},
]
let leafIndex=0
for(let tierIndex=0;tierIndex<tiers.length;tierIndex++) {
  const t=tiers[tierIndex]
  for(let i=0;i<t.count;i++) {
    const k=leafIndex++, a=k*2.3999632297+.48 + .14*Math.sin(k*4.1)
    const f=(Math.sin(k*7.13+1.5)+1)*.5
    const g=(Math.sin(k*13.9+.37)+1)*.5
    const bY=t.start[0]+(t.start[1]-t.start[0])*f
    const rise=t.rise[0]+(t.rise[1]-t.rise[0])*g
    const tipR=t.radial[0]+(t.radial[1]-t.radial[0])*(1-f*.7)
    const bladeBaseR=Math.min(tipR*.52,.19)
    const root=[.039*Math.cos(a+0.2),SOIL_Y+.011,.039*Math.sin(a+0.2)]
    const knee=[.065*Math.cos(a),SOIL_Y+.22,.065*Math.sin(a)]
    const bladeBase=[bladeBaseR*Math.cos(a),bY,bladeBaseR*Math.sin(a)]
    const bladeTip=[tipR*Math.cos(a+.042*Math.sin(k*2.8)),Math.min(1.064,bY+rise),tipR*Math.sin(a+.042*Math.sin(k*2.8))]
    const midStem=[(knee[0]+bladeBase[0])*.5, (knee[1]+bladeBase[1])*.5 + .055,(knee[2]+bladeBase[2])*.5]
    const green=k%4===0?'#457a44':'#356b3b'
    stem(root,knee,.013,green)
    stem(knee,midStem,.011,green)
    stem(midStem,bladeBase,.008,green)
    const width=t.halfWidth[0]+(t.halfWidth[1]-t.halfWidth[0])*((Math.cos(k*3.7)+1)*.5)
    makeLeaf(bladeBase,bladeTip,width,leafPalette[k%leafPalette.length],veinPalette[k%veinPalette.length],k)
  }
}
// Fresh, tightly emerging leaves add a bright young center to the mature foliage.
for(let i=0;i<2;i++) {
  const a=i*2.1+1.4
  const root=[.017*Math.cos(a),SOIL_Y+.016,.017*Math.sin(a)]
  const tip=[.067*Math.cos(a),.30+i*.12,.067*Math.sin(a)]
  stem(root,tip,.011,'#528d47')
  const small=[.073*Math.cos(a),.51+i*.13,.073*Math.sin(a)]
  makeLeaf(tip,small,.040,'#609e50','#a4c777',21+i)
}
