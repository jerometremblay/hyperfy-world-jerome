// Classical horizontal solar clock / sundial, for Hyperfy v0.16 custom fork.
// World geographic location controls the gnomon and its hour lines.
// The geometry is held fixed to geographic axes (+X east, -Z true north),
// independently of the app object's rotation. +Y stays vertical.
// A real directional-light shadow of the polar gnomon reads apparent solar time.
// No scripted shadow, simulated sun, animation, light source, or clock.
// Contact plane: Y=0, so the sundial stands on the placement surface.

app.configure([
  { type: 'color', key: 'stone', label: 'Pedestal stone', initial: '#a69b83' },
  { type: 'color', key: 'dialColor', label: 'Dial bronze', initial: '#bba06b' },
  { type: 'toggle', key: 'castShadows', label: 'Gnomon casts shadow', initial: true },
  { type: 'toggle', key: 'receiveShadows', label: 'Dial receives shadow', initial: true },
])

app.resetOnMove = false

const PI = Math.PI
// Latitude determines the inclination of the polar gnomon and the hour lines.
// Longitude is already accounted for by the world's simulated sun; applying
// it as another angular offset here would rotate the dial incorrectly.
function getGeoLatitude() {
  if (typeof world.getLocation !== 'function') {
    throw new Error('[sundial] This world must expose world.getLocation()')
  }
  const { latitude, longitude } = world.getLocation()
  const lat = Number(latitude)
  if (!Number.isFinite(lat)) {
    throw new Error('[sundial] world.getLocation().latitude must be a finite number')
  }
  // Prevent geometric degeneracy exactly at the poles or equator.
  return Math.max(-89.9, Math.min(89.9, lat))
}
let latitudeDegrees = getGeoLatitude()
let latitude = Math.max(0.01, Math.abs(latitudeDegrees)) * PI / 180
let hemisphere = latitudeDegrees < 0 ? -1 : 1

// A user can rotate the root while placing or editing it. Counter-rotate the
// entire clock locally, so the gnomon and XII line always remain at true north.
// Rotations of the root and the northGroup multiply to identity in world space.
const northGroup = app.create('group')
app.add(northGroup)
let geometryGroup = northGroup
let previousQuaternion = [NaN, NaN, NaN, NaN]
function alignToWorldNorth() {
  const q = app.quaternion
  // Do not dirty hundreds of instanced primitives on every rendered frame
  // when the user has not changed the app's orientation.
  if (q.x === previousQuaternion[0] && q.y === previousQuaternion[1] &&
      q.z === previousQuaternion[2] && q.w === previousQuaternion[3]) return
  previousQuaternion[0] = q.x
  previousQuaternion[1] = q.y
  previousQuaternion[2] = q.z
  previousQuaternion[3] = q.w
  northGroup.quaternion.copy(q).invert()
}
alignToWorldNorth()
const cast = props.castShadows !== false
const receive = props.receiveShadows !== false
const sandstone = props.stone || '#a69b83'
const stoneDark = '#776c58'
const stoneLight = '#c5b89b'
const bronze = props.dialColor || '#bba06b'
const bronzeLight = '#e6ca88'
const bronzeDark = '#54412b'
const patina = '#26382f'
const ink = '#292b29'

function prim(type, params) {
  const node = app.create('prim', {
    type,
    physics: null,
    color: bronze,
    metalness: 0.08,
    roughness: 0.65,
    castShadow: cast,
    receiveShadow: receive,
    ...params,
  })
  geometryGroup.add(node)
  return node
}
function box(w,h,d,x,y,z,color,extra={}) {
  return prim('box', {size:[w,h,d], position:[x,y,z],color,...extra})
}
function cyl(radius,height,x,y,z,color,extra={}) {
  return prim('cylinder',{size:[radius,radius,height],position:[x,y,z],color,...extra})
}
function sphere(radius,x,y,z,color,extra={}) {
  return prim('sphere',{size:[radius],position:[x,y,z],color,...extra})
}
function ring(radius,tube,x,y,z,color,extra={}) {
  return prim('torus',{size:[radius,tube],position:[x,y,z],rotation:[PI/2,0,0],color,...extra})
}
// A slender flat inlaid bronze stroke on top of the dial, between two XZ points.
function stroke(ax,az,bx,bz,y,width,color,extra={}) {
  const dx=bx-ax, dz=bz-az
  const len=Math.hypot(dx,dz)
  if (len < 0.00001) return
  const angle=Math.atan2(dx,dz) // long box local +Z aligned with the stroke
  box(width,0.0032,len,(ax+bx)/2,y,(az+bz)/2,color,
      {rotation:[0,angle,0],metalness:0.68,roughness:0.32,castShadow:false,...extra})
}

// Square, stepped footing and a chamfered-looking column. Main foundation
// is physical; filigree, dial markings, and gnomon remain visual-only.
box(0.78,0.115,0.78,0,0.0575,0,sandstone,{physics:'static'})
box(0.71,0.056,0.71,0,0.143,0,stoneLight)
box(0.59,0.070,0.59,0,0.206,0,stoneDark)
cyl(0.26,0.665,0,0.5685,0,sandstone,{physics:'static'})
for (let y of [0.28,0.34,0.79,0.85]) {
  ring(0.260,0.013,0,y,0,stoneLight,{castShadow:false,metalness:0,roughness:0.74})
}
cyl(0.315,0.082,0,0.939,0,stoneDark)
cyl(0.335,0.072,0,1.015,0,stoneLight)
cyl(0.41,0.075,0,1.088,0,sandstone)

// The heavy circular tray (outer surface), bronze dial, and polished rims.
cyl(0.935,0.090,0,1.166,0,sandstone,{physics:'static'})
cyl(0.892,0.046,0,1.231,0,stoneDark)
cyl(0.864,0.020,0,1.259,0,bronze,{metalness:0.7,roughness:0.35})
cyl(0.821,0.006,0,1.273,0,'#bda46c',
    {metalness:0.63,roughness:0.40,castShadow:false})
const faceY = 1.276
const detailY = faceY + 0.0033
ring(0.873,0.017,0,1.273,0,bronzeLight,{metalness:0.8,roughness:0.28})
ring(0.803,0.006,0,1.279,0,bronzeDark,{castShadow:false,metalness:0.68})
ring(0.685,0.0042,0,1.279,0,bronzeDark,{castShadow:false,metalness:0.68})
ring(0.510,0.0026,0,1.2785,0,bronzeDark,{castShadow:false,metalness:0.5})
ring(0.076,0.009,0,1.283,0,bronzeDark,{metalness:0.65})

// Correct hourly angles for a horizontal sundial: tan(theta) = sin(lat)*tan(H).
// theta measured East-positive from the true-North noon line.
function dialAngle(hour) {
  if (hour <= 6) return -PI/2
  if (hour >= 18) return PI/2
  const H = (hour-12)*PI/12
  return Math.atan(Math.sin(latitude)*Math.tan(H))
}
function radialPoint(theta,r) { return [r*Math.sin(theta), -hemisphere*r*Math.cos(theta)] }
function drawRadial(theta, r0, r1, width, color) {
  const a=radialPoint(theta,r0), b=radialPoint(theta,r1)
  stroke(a[0],a[1],b[0],b[1],detailY,width,color)
}

// Latitude-dependent geometry is rebuilt if the world's geographical
// location changes while the sundial remains in the world.
let calibratedGroup = null
function rebuildCalibratedDial() {
  if (calibratedGroup) northGroup.remove(calibratedGroup)
  calibratedGroup = app.create('group')
  northGroup.add(calibratedGroup)
  geometryGroup = calibratedGroup

// Full hour lines, fractional half-hour divisions, and quarter-hour ticks.
// The numbers are raised only 3 mm so they do not create distracting shadows.
for (let h=6; h<=18; h++) {
  const theta=dialAngle(h)
  drawRadial(theta,0.505,0.683,h===12?0.011:0.008,ink)
  const [x,z] = radialPoint(theta,0.695)
  sphere(0.007,x,detailY,z,bronzeDark,{castShadow:false})
}
for (let h=6.25; h<18; h+=0.25) {
  if (Math.abs(h-Math.round(h))<0.001) continue
  const half=Math.abs(h*2-Math.round(h*2))<0.001
  const theta=dialAngle(h)
  drawRadial(theta,half?0.645:0.661,0.679,half?0.0045:0.0027,bronzeDark)
}

// Inlaid Roman hour numerals, generated from line strokes rather than textures.
// Each letter has 2D local coordinates: horizontal tangent u, radial outward v.
function romanNumeral(hour) {
  const mapping={6:'VI',7:'VII',8:'VIII',9:'IX',10:'X',11:'XI',12:'XII',13:'I',14:'II',15:'III',16:'IV',17:'V',18:'VI'}
  return mapping[hour]
}
function drawNumeral(hour) {
  const theta=dialAngle(hour)
  const text=romanNumeral(hour)
  const charW=0.034, gap=0.013, glyphH=0.058
  const total=text.length*charW+(text.length-1)*gap
  const center=radialPoint(theta,0.744)
  function line(u0,v0,u1,v1) {
    const du=Math.cos(theta), dz=hemisphere*Math.sin(theta)
    const ru=Math.sin(theta), rz=-hemisphere*Math.cos(theta)
    const ax=center[0]+du*u0+ru*v0, az=center[1]+dz*u0+rz*v0
    const bx=center[0]+du*u1+ru*v1, bz=center[1]+dz*u1+rz*v1
    stroke(ax,az,bx,bz,detailY+0.0004,0.0058,ink)
  }
  for (let i=0;i<text.length;i++) {
    const ch=text[i], mid=-total/2 + i*(charW+gap)+charW/2
    const x0=mid-charW/2, x1=mid+charW/2
    if(ch==='I') {
      line(mid,-glyphH/2,mid,glyphH/2)
      line(mid-0.009,-glyphH/2,mid+0.009,-glyphH/2)
      line(mid-0.009,glyphH/2,mid+0.009,glyphH/2)
    } else if(ch==='V') {
      line(x0,glyphH/2,mid,-glyphH/2)
      line(mid,-glyphH/2,x1,glyphH/2)
    } else if(ch==='X') {
      line(x0,-glyphH/2,x1,glyphH/2)
      line(x0,glyphH/2,x1,-glyphH/2)
    }
  }
}
for(let hour=6;hour<=18;hour++)drawNumeral(hour)

// Gnomon: polar edge points to the elevated celestial pole.
// North in the northern hemisphere, south in the southern hemisphere.
// The shadow of the *actual metal triangle* falls on the receiving dial.
// Extrude profile is centered by the Hyperfy extrusion implementation.
const polarLength = 0.54
const northRun = polarLength * Math.cos(latitude)
const tipRise = polarLength * Math.sin(latitude)
const footY=faceY+0.010
prim('extrude',{
  profile:[[0,0],[northRun,0],[northRun,tipRise]],
  depth:0.020,
  bevelEnabled:true, bevelThickness:0.003, bevelSize:0.004, bevelSegments:2,
  smooth:false,
  position:[0,footY+tipRise/2,-hemisphere*northRun/2],
  rotation:[0,hemisphere*PI/2,0],
  color:bronzeDark, metalness:0.8,roughness:0.29,
  castShadow:cast,receiveShadow:receive,
})
// Thin polished polar edge to make the hour-line shadow well defined.
// A cylinder along local Y is tipped north (negative Z) from the gnomon foot.
cyl(0.007,polarLength,0,footY+tipRise/2,-hemisphere*northRun/2,bronzeLight,{
  rotation:[-hemisphere*Math.atan2(northRun,tipRise),0,0],
  metalness:0.84,roughness:0.22,castShadow:cast,
})
sphere(0.014,0,footY+tipRise,-hemisphere*northRun,bronzeLight,{metalness:0.78,roughness:0.28})
cyl(0.056,0.025,0,faceY+0.0125,0,bronzeDark,{metalness:0.76,roughness:0.3})
ring(0.063,0.006,0,faceY+0.025,0,bronzeLight,{metalness:0.75,roughness:0.35})

// Discrete compass rose at the south side of the dial, to aid real-world
// alignment. -Z in local coordinates is true north and noon (XII).
const compassZ=hemisphere*0.402
stroke(-0.060,compassZ,0.060,compassZ,detailY,0.005,bronzeDark)
stroke(0,compassZ-0.063,0,compassZ+0.063,detailY,0.005,bronzeDark)
for(const t of [-1,1]) {
  const x=t*0.05
  stroke(0,compassZ-0.063,x,compassZ+0.032,detailY,0.0025,bronzeDark)
}

  geometryGroup = northGroup
}

rebuildCalibratedDial()

// Native root-transform notifications keep the clock at true north in the same
// transform commit, without registering a client or server frame callback.
app.on('transform', changed => {
  if (changed.rotation) alignToWorldNorth()
})

// Only latitude changes alter the geometry; longitude affects the world's sun.
world.on('location', () => {
  const newLatitude = getGeoLatitude()
  if (Math.abs(newLatitude - latitudeDegrees) > 0.00001) {
    latitudeDegrees = newLatitude
    latitude = Math.max(0.01, Math.abs(newLatitude)) * PI / 180
    hemisphere = newLatitude < 0 ? -1 : 1
    rebuildCalibratedDial()
  }
})
