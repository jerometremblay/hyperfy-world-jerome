// Complex Primitive Cottage — pure Hyperfy primitives, no GLB.

const C = {
  lawn: '#a9bf86', lawn2: '#becf9d', path: '#a69f96', stone: '#8b8984', stone2: '#a4a19a',
  wall: '#eee8dc', wallShade: '#dfd6c7', trim: '#f4f1e9', trim2: '#d4d1c9',
  roof: '#242629', roofDark: '#121417', shutter: '#38475e', shutterDark: '#202a39', metal: '#747d87',
  door: '#8f3b2f', doorDark: '#6f2d25', glass: '#7294b3',
  wood: '#6a5238', woodLight: '#99785a', dark: '#25282d',
  green: '#476936', green2: '#587943', green3: '#36582a',
  flower1: '#d96d87', flower2: '#f0c85d', flower3: '#9b7bd2', flower4: '#f3f0e4',
}

function add(config) {
  const n = app.create('prim', { castShadow:true, receiveShadow:true, roughness:.88, metalness:.04, ...config })
  app.add(n)
  return n
}
function box(size,pos,color,rotation=[0,0,0],extra={}) { return add({type:'box',size,position:pos,rotation,color,...extra}) }
function sphere(r,pos,color,extra={}) { return add({type:'sphere',size:[r],position:pos,color,...extra}) }
function cylinder(rt,rb,h,pos,color,rotation=[0,0,0],extra={}) { return add({type:'cylinder',size:[rt,rb,h],position:pos,rotation,color,...extra}) }
function cone(r,h,pos,color,rotation=[0,0,0],extra={}) { return add({type:'cone',size:[r,h],position:pos,rotation,color,...extra}) }
function torus(r,t,pos,color,rotation=[0,0,0],extra={}) { return add({type:'torus',size:[r,t],position:pos,rotation,color,...extra}) }

const W=7.2, D=5.1, HW=W/2, HD=D/2
const eave=3.75, ridge=5.35, over=.42
const run=HW+over, rise=ridge-eave, pitch=Math.atan2(rise,run), slope=Math.hypot(run,rise), roofD=D+over*2


function bardageHorizontal(face, center, width, height, opts={}) {
  const color = opts.color || C.wall
  const exposedH = opts.exposedH || .20
  const overlap = opts.overlap || .045
  const thickness = opts.thickness || .035
  const tilt = opts.tilt || (7 * Math.PI / 180)

  // Optional integrated corner/edge covers.
  const coverStart = !!opts.coverStart
  const coverEnd = !!opts.coverEnd
  const coverColor = opts.coverColor || C.trim
  const coverSize = opts.coverSize || .14
  const coverDepth = opts.coverDepth || coverSize
  const coverStartShift = opts.coverStartShift || 0
  const coverEndShift = opts.coverEndShift || 0

  // Global reference for course alignment. All wall segments that use the same
  // anchor continue the same rows, even when interrupted by windows or doors.
  const anchorY = opts.anchorY !== undefined ? opts.anchorY : 0

  const boardH = exposedH + overlap
  const bottom = center[1] - height/2
  const top = center[1] + height/2

  // We place full-size boards on a global cadence, then clip only where a board
  // crosses the segment bottom/top. This avoids "tiny reflowed boards" in short
  // segments such as the areas above windows.
  const firstIndex = Math.floor((bottom - anchorY - boardH) / exposedH) - 1
  const lastIndex = Math.ceil((top - anchorY) / exposedH) + 1

  for (let i = firstIndex; i <= lastIndex; i++) {
    const boardBottom = anchorY + i * exposedH
    const boardTop = boardBottom + boardH

    const visibleBottom = Math.max(boardBottom, bottom)
    const visibleTop = Math.min(boardTop, top)
    const visibleH = visibleTop - visibleBottom

    if (visibleH <= 1e-5) continue

    const cy = (visibleBottom + visibleTop) / 2

    if (face === 'front') {
      box([width, visibleH, thickness], [center[0], cy, center[2]], color, [-tilt,0,0])
    } else if (face === 'back') {
      box([width, visibleH, thickness], [center[0], cy, center[2]], color, [tilt,0,0])
    } else if (face === 'right') {
      box([thickness, visibleH, width], [center[0], cy, center[2]], color, [0,0,tilt])
    } else if (face === 'left') {
      box([thickness, visibleH, width], [center[0], cy, center[2]], color, [0,0,-tilt])
    }
  }

  if (coverStart || coverEnd) {
    const y = center[1]
    if (face === 'front' || face === 'back') {
      const z = center[2]
      if (coverStart) box([coverSize, height, coverDepth], [center[0] - width/2 + coverSize/2 + coverStartShift, y, z], coverColor)
      if (coverEnd)   box([coverSize, height, coverDepth], [center[0] + width/2 - coverSize/2 + coverEndShift, y, z], coverColor)
    } else if (face === 'left' || face === 'right') {
      const x = center[0]
      if (coverStart) box([coverDepth, height, coverSize], [x, y, center[2] - width/2 + coverSize/2 + coverStartShift], coverColor)
      if (coverEnd)   box([coverDepth, height, coverSize], [x, y, center[2] + width/2 - coverSize/2 + coverEndShift], coverColor)
    }
  }
}

function bardageGableXZ(face, z, width=W, base=eave, height=rise, opts={}) {
  const color = opts.color || C.wall
  const exposedH = opts.exposedH || .20
  const overlap = opts.overlap || .045
  const thickness = opts.thickness || .035
  const tilt = opts.tilt || (7 * Math.PI / 180)
  const boardH = exposedH + overlap
  const top = base + height
  const courses = Math.ceil(height / exposedH)

  for (let i=0; i<courses; i++) {
    const visibleBottom = base + i * exposedH
    if (visibleBottom >= top) break

    let h = boardH
    let cy = visibleBottom + exposedH/2 + overlap/2
    const boardTop = cy + h/2
    if (boardTop > top + overlap) {
      const excess = boardTop - (top + overlap)
      h -= excess
      cy -= excess/2
    }

    const frac = Math.max(0, 1 - (cy - base) / height)
    const w = Math.max(.05, width * frac)
    const rot = face === 'front' ? [-tilt,0,0] : [tilt,0,0]
    box([w, h, thickness], [0, cy, z], color, rot)
  }
}

function bardageGableYZ(face, x, zCenter, width, base, height, opts={}) {
  const color = opts.color || C.wall
  const exposedH = opts.exposedH || .18
  const overlap = opts.overlap || .04
  const thickness = opts.thickness || .03
  const tilt = opts.tilt || (7 * Math.PI / 180)
  const boardH = exposedH + overlap
  const top = base + height
  const courses = Math.ceil(height / exposedH)

  for (let i=0; i<courses; i++) {
    const visibleBottom = base + i * exposedH
    if (visibleBottom >= top) break

    let h = boardH
    let cy = visibleBottom + exposedH/2 + overlap/2
    const boardTop = cy + h/2
    if (boardTop > top + overlap) {
      const excess = boardTop - (top + overlap)
      h -= excess
      cy -= excess/2
    }

    const frac = Math.max(0, 1 - (cy - base) / height)
    const w = Math.max(.04, width * frac)
    const rot = face === 'right' ? [0,0,tilt] : [0,0,-tilt]
    box([thickness, h, w], [x, cy, zCenter], color, rot)
  }
}

function gable(z,width=W,base=eave,height=rise,depth=.13,color=C.wall) {
  const face = z >= 0 ? 'front' : 'back'
  bardageGableXZ(face, z, width, base, height, { color, thickness: depth, exposedH: .20, overlap: .045, tilt: 7 * Math.PI / 180 })
  const sideLen = Math.hypot(width / 2, height)
  const ang = Math.atan2(height, width / 2)
  const edgeZ = z >= 0 ? z + depth * .06 : z - depth * .06
  box([sideLen, 0.075, depth + 0.02], [-width / 4, base + height / 2, edgeZ], C.trim2, [0, 0, ang])
  box([sideLen, 0.075, depth + 0.02], [ width / 4, base + height / 2, edgeZ], C.trim2, [0, 0, -ang])
}

function frontWindow(x,y,z,w=1.12,h=1.42,shutters=true,flowerbox=false) {
  const t=.095
  const dir = z >= 0 ? 1 : -1
  const glassZ = z - dir*.16
  const frameZ = z + dir*.03
  const muntinZ = z + dir*.065
  const sillZ = z + dir*.02
  box([t,h,.11],[x-w/2+t/2,y,frameZ],C.trim)
  box([t,h,.11],[x+w/2-t/2,y,frameZ],C.trim)
  box([w,t,.11],[x,y+h/2-t/2,frameZ],C.trim)
  box([w,t,.11],[x,y-h/2+t/2,frameZ],C.trim)
  box([t*.7,h-.16,.12],[x,y,muntinZ],C.trim)
  box([w-.16,t*.7,.12],[x,y,muntinZ],C.trim)
  box([w+.18,.10,.22],[x,y-h/2-.07,sillZ],C.trim2)
  if(shutters){
    const sw=.19, gap=w/2+sw/2+.055
    box([sw,h-.02,.065],[x-gap,y,z+dir*.055],C.shutter)
    box([sw,h-.02,.065],[x+gap,y,z+dir*.055],C.shutter)
    for(const sx of [x-gap,x+gap]) for(let j=-2;j<=2;j++) box([sw-.035,.025,.075],[sx,y+j*.19,z+dir*.095],C.shutterDark)
  }
  if(flowerbox){
    box([w+.05,.18,.30],[x,y-h/2-.20,z+dir*.22],C.wood)
    for(let i=-2;i<=2;i++) sphere(.065,[x+i*.18,y-h/2-.05+(i%2)*.04,z+dir*.24],[C.flower1,C.flower2,C.flower3][(i+5)%3])
  }
}

function sideWindow(x,z,y,w=1.08,h=1.38,side=1,flowerbox=false) {
  const t=.095, sx=side
  const glassX = x - sx*.16
  const frameX = x + sx*.03
  const muntinX = x + sx*.065
  box([.11,h,t],[frameX,y,z-w/2+t/2],C.trim)
  box([.11,h,t],[frameX,y,z+w/2-t/2],C.trim)
  box([.11,t,w],[frameX,y+h/2-t/2,z],C.trim)
  box([.11,t,w],[frameX,y-h/2+t/2,z],C.trim)
  box([.12,h-.16,t*.7],[muntinX,y,z],C.trim)
  box([.12,t*.7,w-.16],[muntinX,y,z],C.trim)
  const gap=w/2+.14
  box([.065,h-.02,.20],[x+sx*.06,y,z-gap],C.shutter)
  box([.065,h-.02,.20],[x+sx*.06,y,z+gap],C.shutter)
  if(flowerbox) box([.26,.18,w+.02],[x+sx*.22,y-h/2-.18,z],C.wood)
}

function flowerCluster(x,z,n=7) {
  const cols=[C.flower1,C.flower2,C.flower3,C.flower4]
  for(let i=0;i<n;i++) {
    const a=i*2.399, rr=.10+.075*(i%3)
    const px=x+Math.cos(a)*rr, pz=z+Math.sin(a)*rr
    cylinder(.015,.018,.22,[px,.11,pz],C.green3)
    sphere(.045,[px,.24+(i%2)*.025,pz],cols[i%cols.length])
  }
}
function bush(x,z,r=.48,color=C.green) {
  sphere(r,[x,r*.76,z],color,{scale:[1.15,.86,1]})
  sphere(r*.7,[x+r*.42,r*.83,z+.08],color,{scale:[1,.9,1]})
  sphere(r*.64,[x-r*.4,r*.78,z-.10],color,{scale:[1,.9,1]})
}
function picket(x,z,rot=0,len=3.4) {
  const count=Math.floor(len/.28)
  for(let i=0;i<count;i++) {
    const along=-len/2+i*(len/(count-1))
    const px=x+Math.cos(rot)*along, pz=z+Math.sin(rot)*along
    box([.10,.92,.075],[px,.46,pz],C.trim,[0,-rot,0])
    cone(.085,.18,[px,1.01,pz],C.trim,[0,0,0])
  }
  // rails along local length
  box([len,.09,.08],[x,.36,z],C.trim,[0,-rot,0])
  box([len,.09,.08],[x,.72,z],C.trim,[0,-rot,0])
}

// Create one complete rectangular lattice panel.
// The frame corners are built flush, and the diagonal slats are clipped
// to an inset inner rectangle so they stay fully hidden under the frame.
//
// plane:
//   'front' => horizontal axis X, vertical axis Y, thickness along Z
//   'side'  => horizontal axis Z, vertical axis Y, thickness along X
function latticePanel(plane, center, width, height, opts={}) {
  const frameW = opts.frameW || .06
  const slatW = opts.slatW || .058
  const spacing = opts.spacing || .18
  const depth = opts.depth || .045
  const slatDepth = opts.slatDepth || depth * .25
  const frameColor = opts.frameColor || C.trim2
  const slatColor = opts.slatColor || C.trim

  const cx = center[0], cy = center[1], cz = center[2]

  // Flush frame: top/bottom span full width, verticals fit between them.
  if (plane === 'front') {
    box([width,frameW,depth],[cx,cy+height/2-frameW/2,cz],frameColor)
    box([width,frameW,depth],[cx,cy-height/2+frameW/2,cz],frameColor)
    box([frameW,height-frameW*2,depth],[cx-width/2+frameW/2,cy,cz],frameColor)
    box([frameW,height-frameW*2,depth],[cx+width/2-frameW/2,cy,cz],frameColor)
  } else {
    box([depth,frameW,width],[cx,cy+height/2-frameW/2,cz],frameColor)
    box([depth,frameW,width],[cx,cy-height/2+frameW/2,cz],frameColor)
    box([depth,height-frameW*2,frameW],[cx,cy,cz-width/2+frameW/2],frameColor)
    box([depth,height-frameW*2,frameW],[cx,cy,cz+width/2-frameW/2],frameColor)
  }

  // Slats should visually run into the frame far enough that their ends are
  // hidden. We therefore clip their centerlines to the MIDLINE of the frame,
  // not to the inner opening edge.
  const innerW = Math.max(.02, width - frameW)
  const innerH = Math.max(.02, height - frameW)

  function clippedSegment(offset, dir) {
    const hw = innerW/2
    const hh = innerH/2
    const pts = []

    function addPoint(u,v) {
      if (u < -hw-.0001 || u > hw+.0001 || v < -hh-.0001 || v > hh+.0001) return
      for (const p of pts) {
        if (Math.abs(p[0]-u) < .0001 && Math.abs(p[1]-v) < .0001) return
      }
      pts.push([u,v])
    }

    addPoint(-hw, dir*(-hw)+offset)
    addPoint( hw, dir*( hw)+offset)
    addPoint((-hh-offset)/dir, -hh)
    addPoint(( hh-offset)/dir,  hh)

    if (pts.length < 2) return null

    let bestA=pts[0], bestB=pts[1], bestD=-1
    for (let i=0;i<pts.length;i++) {
      for (let j=i+1;j<pts.length;j++) {
        const du=pts[j][0]-pts[i][0]
        const dv=pts[j][1]-pts[i][1]
        const d=du*du+dv*dv
        if (d>bestD) { bestD=d; bestA=pts[i]; bestB=pts[j] }
      }
    }
    return [bestA,bestB]
  }

  function addSlat(seg) {
    if (!seg) return
    const a=seg[0], b=seg[1]
    const u=(a[0]+b[0])/2
    const v=(a[1]+b[1])/2
    const du=b[0]-a[0]
    const dv=b[1]-a[1]
    const len=Math.hypot(du,dv)
    const ang=Math.atan2(dv,du)

    if (plane === 'front') {
      box([len,slatW,slatDepth],[cx+u,cy+v,cz],slatColor,[0,0,ang])
    } else {
      box([slatDepth,slatW,len],[cx,cy+v,cz+u],slatColor,[-ang,0,0])
    }
  }

  const extent = innerW/2 + innerH/2
  for (const dir of [-1,1]) {
    for (let offset=-extent; offset<=extent+.0001; offset+=spacing) {
      addSlat(clippedSegment(offset,dir))
    }
  }
}

function stoneCourse(y,zSign=0) {
  const z = zSign===0 ? null : zSign*(HD+.035)
  if(z!==null) {
    for(let x=-3.25;x<=3.25;x+=.52) box([.46,.21,.10],[x+(Math.round(y*10)%2)*.12,y,z],(Math.round(x*10)%2)?C.stone:C.stone2)
  }
}

// SITE
box([23,.08,21],[0,-.06,0],C.lawn2,[0,0,0],{physics:'static',roughness:1,metalness:0})
box([15.5,.035,13.8],[0,-.012,.35],C.lawn,[0,0,0],{roughness:1,metalness:0})
// curved-ish stepping path via rotated rectangular pavers
for(let i=0;i<8;i++) {
  const z=3.35+i*.72, x=.20*Math.sin(i*.65), ang=.10*Math.sin(i*.7)
  box([1.00,.055,.48],[x,.025,z],i%2?C.stone:C.stone2,[0,ang,0],{physics:'static',roughness:1})
}

// FOUNDATION + SHELL
box([W+.55,.52,D+.55],[0,.26,0],C.stone,[0,0,0],{physics:'static',roughness:1})
for(let y=.14;y<=.48;y+=.22){stoneCourse(y,1);stoneCourse(y,-1)}
// Hollow wall shell instead of one solid block, so the front door can reveal
// a real opening when it swings open.
const wallH = 3.18
const wallY = 2.12
const wallT = .22
const frontZ = HD - wallT/2
const backZ = -HD + wallT/2
const doorOpeningW = 1.24
const doorOpeningBottom = .80
const doorOpeningTop = 3.08
const wallBottom = wallY - wallH/2
const wallTop = wallY + wallH/2
const doorHeaderH = wallTop - doorOpeningTop
const doorSillH = doorOpeningBottom - wallBottom

// Helpers to build wall planes with true rectangular openings.

function sortedUnique(vals) {
  return [...new Set(vals.map(v => +v.toFixed(5)))].sort((a,b)=>a-b)
}
function insideRect(h,v,r) {
  return h > r.minH + 1e-5 && h < r.maxH - 1e-5 && v > r.minV + 1e-5 && v < r.maxV - 1e-5
}
function rangesOverlap(aMin, aMax, bMin, bMax) {
  return aMax > bMin + 1e-5 && aMin < bMax - 1e-5
}
function mergeIntervals(intervals) {
  const arr = intervals
    .map(r => ({ min: Math.min(r.min, r.max), max: Math.max(r.min, r.max) }))
    .filter(r => r.max - r.min > 1e-5)
    .sort((a,b) => a.min - b.min)

  const merged = []
  for (const r of arr) {
    const last = merged[merged.length - 1]
    if (!last || r.min > last.max + 1e-5) {
      merged.push({ min: r.min, max: r.max })
    } else {
      last.max = Math.max(last.max, r.max)
    }
  }
  return merged
}
function subtractIntervals(minVal, maxVal, cuts=[]) {
  const mergedCuts = mergeIntervals(cuts)
  const out = []
  let cursor = minVal

  for (const cut of mergedCuts) {
    if (cut.max <= cursor + 1e-5) continue
    if (cut.min >= maxVal - 1e-5) break
    if (cut.min > cursor + 1e-5) out.push({ min: cursor, max: Math.min(cut.min, maxVal) })
    cursor = Math.max(cursor, cut.max)
    if (cursor >= maxVal - 1e-5) break
  }
  if (cursor < maxVal - 1e-5) out.push({ min: cursor, max: maxVal })
  return out.filter(r => r.max - r.min > .02)
}
function touchesIntervalEdge(value, intervals) {
  return intervals.some(r => Math.abs(value - r.min) < 1e-5 || Math.abs(value - r.max) < 1e-5)
}
function addBardageSegment(face, center, width, height, opts={}) {
  const color = opts.color || C.wall
  const thickness = opts.thickness || .035
  const tilt = opts.tilt || (7 * Math.PI / 180)

  if (face === 'front') {
    box([width, height, thickness], [center[0], center[1], center[2]], color, [-tilt,0,0])
  } else if (face === 'back') {
    box([width, height, thickness], [center[0], center[1], center[2]], color, [tilt,0,0])
  } else if (face === 'right') {
    box([thickness, height, width], [center[0], center[1], center[2]], color, [0,0,tilt])
  } else if (face === 'left') {
    box([thickness, height, width], [center[0], center[1], center[2]], color, [0,0,-tilt])
  }
}
function buildSidingCoursesXZ(face, zCenter, hMin, hMax, vMin, vMax, holes=[], opts={}) {
  const anchorY = opts.anchorY !== undefined ? opts.anchorY : 0
  const exposedH = opts.exposedH || .20
  const overlap = opts.overlap || .045
  const boardH = exposedH + overlap
  const hiddenBleedH = opts.hiddenBleedH !== undefined ? opts.hiddenBleedH : .10
  const hiddenBleedV = opts.hiddenBleedV !== undefined ? opts.hiddenBleedV : .10

  const firstIndex = Math.floor((vMin - anchorY - boardH) / exposedH) - 1
  const lastIndex = Math.ceil((vMax - anchorY) / exposedH) + 1

  for (let i = firstIndex; i <= lastIndex; i++) {
    const boardBottom = anchorY + i * exposedH
    const boardTop = boardBottom + boardH
    const visibleBottom = Math.max(boardBottom, vMin)
    const visibleTop = Math.min(boardTop, vMax)
    const visibleH = visibleTop - visibleBottom
    if (visibleH <= 1e-5) continue

    const courseCuts = holes
      .filter(r => rangesOverlap(visibleBottom, visibleTop, r.minV + hiddenBleedV, r.maxV - hiddenBleedV))
      .map(r => ({ min: r.minH, max: r.maxH }))

    const spans = subtractIntervals(hMin, hMax, courseCuts)
    for (const span of spans) {
      let segMin = span.min
      let segMax = span.max
      if (touchesIntervalEdge(segMin, courseCuts)) segMin -= hiddenBleedH
      if (touchesIntervalEdge(segMax, courseCuts)) segMax += hiddenBleedH
      const segW = segMax - segMin
      if (segW <= .02) continue
      addBardageSegment(face, [(segMin + segMax)/2, (visibleBottom + visibleTop)/2, zCenter], segW, visibleH, opts)
    }
  }
}
function buildSidingCoursesYZ(face, xCenter, hMin, hMax, vMin, vMax, holes=[], opts={}) {
  const anchorY = opts.anchorY !== undefined ? opts.anchorY : 0
  const exposedH = opts.exposedH || .20
  const overlap = opts.overlap || .045
  const boardH = exposedH + overlap
  const hiddenBleedH = opts.hiddenBleedH !== undefined ? opts.hiddenBleedH : .10
  const hiddenBleedV = opts.hiddenBleedV !== undefined ? opts.hiddenBleedV : .10

  const firstIndex = Math.floor((vMin - anchorY - boardH) / exposedH) - 1
  const lastIndex = Math.ceil((vMax - anchorY) / exposedH) + 1

  for (let i = firstIndex; i <= lastIndex; i++) {
    const boardBottom = anchorY + i * exposedH
    const boardTop = boardBottom + boardH
    const visibleBottom = Math.max(boardBottom, vMin)
    const visibleTop = Math.min(boardTop, vMax)
    const visibleH = visibleTop - visibleBottom
    if (visibleH <= 1e-5) continue

    const courseCuts = holes
      .filter(r => rangesOverlap(visibleBottom, visibleTop, r.minV + hiddenBleedV, r.maxV - hiddenBleedV))
      .map(r => ({ min: r.minH, max: r.maxH }))

    const spans = subtractIntervals(hMin, hMax, courseCuts)
    for (const span of spans) {
      let segMin = span.min
      let segMax = span.max
      if (touchesIntervalEdge(segMin, courseCuts)) segMin -= hiddenBleedH
      if (touchesIntervalEdge(segMax, courseCuts)) segMax += hiddenBleedH
      const segW = segMax - segMin
      if (segW <= .02) continue
      addBardageSegment(face, [xCenter, (visibleBottom + visibleTop)/2, (segMin + segMax)/2], segW, visibleH, opts)
    }
  }
}
function buildWallPlaneXZ(face, zCenter, hMin, hMax, vMin, vMax, holes=[], opts={}) {
  const hs = [hMin,hMax]
  const vs = [vMin,vMax]
  for (const r of holes) { hs.push(r.minH, r.maxH); vs.push(r.minV, r.maxV) }
  const H = sortedUnique(hs)
  const V = sortedUnique(vs)
  const cladZ = opts.cladCoord !== undefined ? opts.cladCoord : (face === 'front' ? HD + wallCladOffset : -HD - wallCladOffset)

  // Structural wall: split only enough to cut real openings.
  for (let i=0;i<H.length-1;i++) {
    for (let j=0;j<V.length-1;j++) {
      const a=H[i], b=H[i+1], c=V[j], d=V[j+1]
      const hc=(a+b)/2, vc=(c+d)/2
      if (holes.some(r => insideRect(hc,vc,r))) continue
      const w=b-a, h=d-c
      if (w < .02 || h < .02) continue
      box([w,h,wallT],[hc,vc,zCenter],C.wall,[0,0,0],{physics:'static',roughness:.98})
    }
  }

  // Visible siding: generate it by global clapboard courses across the whole
  // facade, then split each course only where it crosses openings. This keeps
  // the rows perfectly continuous from one wall section to the next.
  buildSidingCoursesXZ(face, cladZ, hMin, hMax, vMin, vMax, holes, siding)
}
function buildWallPlaneYZ(face, xCenter, hMin, hMax, vMin, vMax, holes=[], opts={}) {
  const hs = [hMin,hMax]
  const vs = [vMin,vMax]
  for (const r of holes) { hs.push(r.minH, r.maxH); vs.push(r.minV, r.maxV) }
  const H = sortedUnique(hs)
  const V = sortedUnique(vs)
  const cladX = opts.cladCoord !== undefined ? opts.cladCoord : (face === 'right' ? HW + wallCladOffset : -HW - wallCladOffset)

  // Structural wall: split only enough to cut real openings.
  for (let i=0;i<H.length-1;i++) {
    for (let j=0;j<V.length-1;j++) {
      const a=H[i], b=H[i+1], c=V[j], d=V[j+1]
      const hc=(a+b)/2, vc=(c+d)/2
      if (holes.some(r => insideRect(hc,vc,r))) continue
      const w=b-a, h=d-c
      if (w < .02 || h < .02) continue
      box([wallT,h,w],[xCenter,vc,hc],C.wall,[0,0,0],{physics:'static',roughness:.98})
    }
  }

  // Visible siding: generate it by global clapboard courses across the whole
  // facade, then split each course only where it crosses openings.
  buildSidingCoursesYZ(face, cladX, hMin, hMax, vMin, vMax, holes, siding)
}


// Build a complete rectangular exterior wall envelope from ONE set of corner
// coordinates. Every face derives its length from these same four coordinates,
// so front/back and side walls physically meet at exactly the same corners.
//
// bounds = { minX, maxX, minZ, maxZ }
// openings = { front:[], back:[], left:[], right:[] }
//
// The function also creates ONE shared vertical cover at each exterior corner.
function bardageRectangularShell(bounds, wallBottom, wallTop, wallT, openings={}, opts={}) {
  const finishOffset = opts.finishOffset || 0
  const cornerSize = opts.cornerSize || .14
  const cornerColor = opts.cornerColor || C.trim
  const wallH = wallTop - wallBottom
  const wallY = (wallTop + wallBottom) / 2

  // Structural wall center planes are derived from the same exterior bounds.
  const leftWallX  = bounds.minX + finishOffset + wallT/2
  const rightWallX = bounds.maxX - finishOffset - wallT/2
  const backWallZ  = bounds.minZ + finishOffset + wallT/2
  const frontWallZ = bounds.maxZ - finishOffset - wallT/2

  // Side walls use the exact same minZ/maxZ corner coordinates as front/back.
  buildWallPlaneYZ(
    'left',
    leftWallX,
    bounds.minZ,
    bounds.maxZ,
    wallBottom,
    wallTop,
    openings.left || [],
    { cladCoord: bounds.minX }
  )
  buildWallPlaneYZ(
    'right',
    rightWallX,
    bounds.minZ,
    bounds.maxZ,
    wallBottom,
    wallTop,
    openings.right || [],
    { cladCoord: bounds.maxX }
  )

  // Front/back walls use the exact same minX/maxX corner coordinates as sides.
  buildWallPlaneXZ(
    'back',
    backWallZ,
    bounds.minX,
    bounds.maxX,
    wallBottom,
    wallTop,
    openings.back || [],
    { cladCoord: bounds.minZ }
  )
  buildWallPlaneXZ(
    'front',
    frontWallZ,
    bounds.minX,
    bounds.maxX,
    wallBottom,
    wallTop,
    openings.front || [],
    { cladCoord: bounds.maxZ }
  )

  // One unique vertical cover per corner, shared by the two adjacent walls.
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const z of [bounds.minZ, bounds.maxZ]) {
      box(
        [cornerSize, wallH, cornerSize],
        [x, wallY, z],
        cornerColor
      )
    }
  }
}

// Exterior horizontal siding / clin on the main wall planes.
const siding = { color:C.wall, exposedH:.20, overlap:.045, thickness:.035, tilt:7*Math.PI/180, anchorY: wallBottom }
const cornerBoardW = .13
const cornerBoardDepth = .035
const wallCladOffset = wallT/2 + .03

// Opening definitions.
const frontWindowOpenings = [
  { minH:-2.25-.59, maxH:-2.25+.59, minV:2.07-.74, maxV:2.07+.74 },
  { minH: 2.25-.59, maxH: 2.25+.59, minV:2.07-.74, maxV:2.07+.74 },
  { minH:-doorOpeningW/2, maxH:doorOpeningW/2, minV:doorOpeningBottom, maxV:doorOpeningTop },
]
const backDoorW = 1.18
const backWindowOpenings = [
  { minH:-2.25-.525, maxH:-2.25+.525, minV:2.00-.67, maxV:2.00+.67 },
  { minH: 2.25-.525, maxH: 2.25+.525, minV:2.00-.67, maxV:2.00+.67 },
  { minH:-backDoorW/2, maxH:backDoorW/2, minV:.80, maxV:3.08 },
]
const sideWindowOpenings = [
  { minH:-1.30-.55, maxH:-1.30+.55, minV:2.02-.69, maxV:2.02+.69 },
  { minH: 1.15-.55, maxH: 1.15+.55, minV:2.02-.69, maxV:2.02+.69 },
]

// Main exterior wall envelope.
// The unique corner coordinates are now the source of truth for ALL four walls.
const houseWallCorners = {
  minX: -(HW + wallCladOffset),
  maxX:  (HW + wallCladOffset),
  minZ: -(HD + wallCladOffset),
  maxZ:  (HD + wallCladOffset),
}

bardageRectangularShell(
  houseWallCorners,
  wallBottom,
  wallTop,
  wallT,
  {
    front: frontWindowOpenings,
    back: backWindowOpenings,
    left: sideWindowOpenings,
    right: sideWindowOpenings,
  },
  {
    finishOffset: wallCladOffset,
    cornerSize: cornerBoardW + .01,
    cornerColor: C.trim,
  }
)

box([W-wallT*2-.06,.10,D-wallT*2-.06],[0,.62,0],C.trim2)
box([W+.14,.11,D+.14],[0,3.63,0],C.trim)
gable(HD-.065); gable(-HD+.065)

// House corner covers are generated once by bardageRectangularShell.

// ROOF
box([slope,.20,roofD],[ run/2,(ridge+eave)/2,0],C.roof,[0,0,-pitch],{physics:'static',roughness:.72,metalness:.10})
box([slope,.20,roofD],[-run/2,(ridge+eave)/2,0],C.roof,[0,0, pitch],{physics:'static',roughness:.72,metalness:.10})
box([.24,.17,roofD+.07],[0,ridge+.08,0],C.roofDark)
box([.16,.22,roofD],[ HW+over,eave-.04,0],C.roofDark)
box([.16,.22,roofD],[-HW-over,eave-.04,0],C.roofDark)
// subtle shingle battens
for(let z=-2.45;z<=2.45;z+=.39) {
  box([slope-.10,.022,.032],[ run/2,(ridge+eave)/2+.07,z],C.roofDark,[0,0,-pitch])
  box([slope-.10,.022,.032],[-run/2,(ridge+eave)/2+.07,z],C.roofDark,[0,0, pitch])
}

// CHIMNEY with bands and cap
box([.78,1.58,.82],[1.72,4.97,-.82],C.stone2,[0,0,0],{physics:'static'})
for(let y=4.38;y<5.65;y+=.25) box([.84,.045,.88],[1.72,y,-.82],C.stone)
box([.98,.18,1.02],[1.72,5.80,-.82],C.roofDark)
box([.50,.28,.52],[1.72,6.00,-.82],C.dark)

// FRONT PORCH PLATFORM — restyled after the reference porch
const porchW = 4.75, porchD = 3.18, porchZ = HD + 1.10
box([porchW,.20,porchD],[0,.78,porchZ],C.woodLight,[0,0,0],{physics:'static'})
for(const z of [porchZ-1.30, porchZ-.62, porchZ+.06, porchZ+.74, porchZ+1.42]) box([porchW+.16,.10,.11],[0,.64,z],C.wood)

// centered wooden stairs, deeper and a bit more finished
const stairW1 = 2.00, stairW2 = 1.70, stairW3 = 1.40
const stairZ1 = porchZ + porchD/2 + .70
const stairZ2 = porchZ + porchD/2 + .32
const stairZ3 = porchZ + porchD/2 - .06
box([stairW1,.18,.50],[0,.09,stairZ1],C.woodLight,[0,0,0],{physics:'static'})
box([stairW2,.18,.50],[0,.27,stairZ2],C.wood,[0,0,0],{physics:'static'})
box([stairW3,.18,.50],[0,.45,stairZ3],C.woodLight,[0,0,0],{physics:'static'})

// square painted porch columns with base and cap blocks
const columnY = 1.97
const columnH = 2.34
const frontColumnZ = porchZ + porchD/2 - .16
const sideColumnZ  = porchZ - porchD/2 + .24
const outerColumnX = porchW/2 - .10
const innerColumnX = .78
function porchColumn(x,z) {
  box([.17,columnH,.17],[x,columnY,z],C.trim,[0,0,0],{physics:'static'})
  box([.28,.10,.28],[x,.87,z],C.trim2)
  box([.22,.06,.22],[x,.95,z],C.trim)
  box([.24,.08,.24],[x,3.05,z],C.trim)
  box([.30,.10,.30],[x,3.13,z],C.trim2)
}
for (const x of [-outerColumnX,-innerColumnX,innerColumnX,outerColumnX]) porchColumn(x,frontColumnZ)
for (const x of [-outerColumnX, outerColumnX]) porchColumn(x,sideColumnZ)

// porch railings inspired by the reference image: move the handrail to the very top
// of the porch fence so it caps the balusters/posts.
const railTopY = 1.58, railBottomY = .92, balusterBaseY = .97, balusterH = .62
const frontRailZ = porchZ + porchD/2 - .16
const openingW = 1.56
const sectionW = (porchW - openingW) / 2
function turnedBalusterFront(x,z) {
  cylinder(.033,.033,.08,[x,balusterBaseY+.04,z],C.trim)
  cylinder(.020,.020,.16,[x,balusterBaseY+.16,z],C.trim)
  cylinder(.048,.048,.14,[x,balusterBaseY+.31,z],C.trim)
  cylinder(.024,.024,.14,[x,balusterBaseY+.45,z],C.trim)
  cylinder(.035,.035,.10,[x,balusterBaseY+.57,z],C.trim)
}
function turnedBalusterSide(x,z) {
  cylinder(.033,.033,.08,[x,balusterBaseY+.04,z],C.trim)
  cylinder(.020,.020,.16,[x,balusterBaseY+.16,z],C.trim)
  cylinder(.048,.048,.14,[x,balusterBaseY+.31,z],C.trim)
  cylinder(.024,.024,.14,[x,balusterBaseY+.45,z],C.trim)
  cylinder(.035,.035,.10,[x,balusterBaseY+.57,z],C.trim)
}

function turnedBalusterStair(x, yBase, z, h=.44) {
  // Same turned-baluster vocabulary as the porch railings, but scaled to fit
  // the stair rail opening.
  const scale = h / balusterH
  const segs = [
    [.033, .08, .04],
    [.020, .16, .16],
    [.048, .14, .31],
    [.024, .14, .45],
    [.035, .10, .57],
  ]
  for (const [r, sh, sy] of segs) {
    cylinder(r * scale, r * scale, sh * scale, [x, yBase + sy * scale, z], C.trim)
  }
}
// front rails split around the stair opening
box([sectionW,.10,.10],[-(openingW/2 + sectionW/2),railTopY,frontRailZ],C.trim)
box([sectionW,.10,.10],[ +(openingW/2 + sectionW/2),railTopY,frontRailZ],C.trim)
box([sectionW,.09,.10],[-(openingW/2 + sectionW/2),railBottomY,frontRailZ],C.trim)
box([sectionW,.09,.10],[ +(openingW/2 + sectionW/2),railBottomY,frontRailZ],C.trim)
for (let x = -porchW/2 + .28; x <= -openingW/2 - .15; x += .17) turnedBalusterFront(x, frontRailZ)
for (let x =  openingW/2 + .15; x <=  porchW/2 - .28; x += .17) turnedBalusterFront(x, frontRailZ)

// side railings with matching balusters
const sideRailX = porchW/2 - .10
const sideRailBackZ = porchZ - .85
const sideRailFrontZ = frontRailZ
const sideRailLen = sideRailFrontZ - sideRailBackZ
const sideRailCenterZ = (sideRailFrontZ + sideRailBackZ) / 2
for (const sx of [-1,1]) {
  box([.10,.10,sideRailLen],[sx*sideRailX,railTopY,sideRailCenterZ],C.trim)
  box([.09,.09,sideRailLen],[sx*sideRailX,railBottomY,sideRailCenterZ],C.trim)

  // Only the back side post remains distinct; the front corner is now carried
  // by the gallery column itself.
  const sideBackPostZ = sideRailBackZ + .10
  box([.08,.98,.08],[sx*sideRailX,1.13,sideBackPostZ],C.trim)

  for (let z = sideRailBackZ + .24; z <= sideRailFrontZ - .24; z += .17) {
    turnedBalusterSide(sx*sideRailX, z)
  }
}

// stair rails in the same white porch style, using the same turned balusters
// as the porch railings. The stair rails now connect directly to the gallery
// fence at the top, both for the handrail and the lower rail, and the top
// corner posts sit exactly at that contact point.
const stairPostX = openingW/2
const stairBottomPostX = stairPostX
const stairTopZ = frontRailZ
const stairBottomZ = stairZ1 + .18
for (const sx of [-1,1]) {
  const dz = stairBottomZ - stairTopZ

  const topRailThickness = .10
  const bottomRailThickness = .09

  // Match the existing porch fence heights at the top landing.
  const topRailCenterStart = railTopY
  const bottomRailCenterStart = railBottomY

  // Keep a similar stair slope while making the top connection exact.
  const railCenterDrop = .34
  const topRailCenterEnd = topRailCenterStart - railCenterDrop
  const bottomRailCenterEnd = bottomRailCenterStart - railCenterDrop

  const topRailMidY = (topRailCenterStart + topRailCenterEnd) / 2
  const bottomRailMidY = (bottomRailCenterStart + bottomRailCenterEnd) / 2
  const railDy = topRailCenterEnd - topRailCenterStart
  const len = Math.hypot(dz, railDy)
  const ang = -Math.atan2(railDy, dz)

  // Top and bottom posts, aligned to the actual contact geometry.
  // No separate top stair post here: the gallery column now occupies the corner.

  const bottomPostBaseY = 0.0
  const bottomPostH = (topRailCenterEnd + topRailThickness/2) - bottomPostBaseY
  const bottomPostY = bottomPostBaseY + bottomPostH/2
  box([.09,bottomPostH,.09],[sx*stairBottomPostX,bottomPostY,stairBottomZ],C.trim)

  // Rails that truly meet the gallery fence at the upper contact.
  box([.09,topRailThickness,len],[sx*(stairPostX + stairBottomPostX)/2,topRailMidY,stairTopZ + dz/2],C.trim,[ang,0,0])
  box([.08,bottomRailThickness,len],[sx*(stairPostX + stairBottomPostX)/2,bottomRailMidY,stairTopZ + dz/2],C.trim,[ang,0,0])

  // Turned balusters between the lower rail top and the handrail underside.
  const bottomRailTopAtStart = bottomRailCenterStart + bottomRailThickness/2
  const bottomRailTopAtEnd = bottomRailCenterEnd + bottomRailThickness/2
  const topRailBottomAtStart = topRailCenterStart - topRailThickness/2
  const topRailBottomAtEnd = topRailCenterEnd - topRailThickness/2
  const balH = topRailBottomAtStart - bottomRailTopAtStart

  for (let t=.17; t<.87; t+=.15) {
    const z = stairTopZ + dz*t
    const x = sx*(stairPostX + (stairBottomPostX - stairPostX)*t)
    const yBase = bottomRailTopAtStart + (bottomRailTopAtEnd - bottomRailTopAtStart)*t
    turnedBalusterStair(x, yBase, z, balH)
  }
}

// treillis / lattice skirt under the porch
const skirtTopY = .60
const skirtBottomY = .03
const skirtMidY = (skirtTopY + skirtBottomY) / 2
const skirtH = skirtTopY - skirtBottomY
const stairOpeningW2 = 1.92
const frontSkirtZ = porchZ + porchD/2 - .22
const frontPanelW = (porchW - stairOpeningW2) / 2 - .06

// Two complete front panels, leaving only the centered stair opening.
latticePanel(
  'front',
  [-(stairOpeningW2/2 + frontPanelW/2), skirtMidY, frontSkirtZ],
  frontPanelW,
  skirtH,
  { frameW:.065, slatW:.058, slatDepth:.016, spacing:.18, depth:.05 }
)
latticePanel(
  'front',
  [ +(stairOpeningW2/2 + frontPanelW/2), skirtMidY, frontSkirtZ],
  frontPanelW,
  skirtH,
  { frameW:.065, slatW:.058, slatDepth:.016, spacing:.18, depth:.05 }
)

// One complete panel along each exposed side of the gallery.
const sideSkirtX = porchW/2 - .12
const sideSkirtLen = porchD - .34
const sideSkirtCenterZ = porchZ
latticePanel(
  'side',
  [-sideSkirtX, skirtMidY, sideSkirtCenterZ],
  sideSkirtLen,
  skirtH,
  { frameW:.065, slatW:.058, slatDepth:.016, spacing:.18, depth:.05 }
)
latticePanel(
  'side',
  [ sideSkirtX, skirtMidY, sideSkirtCenterZ],
  sideSkirtLen,
  skirtH,
  { frameW:.065, slatW:.058, slatDepth:.016, spacing:.18, depth:.05 }
)

// Porch canopy — low-pitch, broad roof in the style of the reference porch.
const canopyW = porchW + .36
const canopyD = porchD + .40
const canopyZ = porchZ + .08
const canopyY = 3.18
box([canopyW,.15,canopyD],[0,canopyY,canopyZ],C.trim2)
box([canopyW+.08,.08,.18],[0,canopyY+.11,canopyZ+canopyD/2-.09],C.trim)
box([.18,.08,canopyD],[canopyW/2-.09,canopyY+.11,canopyZ],C.trim)
box([.18,.08,canopyD],[-canopyW/2+.09,canopyY+.11,canopyZ],C.trim)
box([canopyW,.05,canopyD],[0,canopyY-.10,canopyZ],C.trim)
// shallow dark roof cap
box([canopyW+.10,.07,canopyD+.10],[0,canopyY+.21,canopyZ+.05],C.roof,[.06,0,0])

// FRONT DOOR
// True open door frame: side jambs + head jamb only, so the opening remains
// visibly open when the door swings away.
const frameOuterW = 1.34
const frameOuterH = 2.44
const frameDepth = .11
const jambW = .12
const headH = .12
const frameZ = HD + .065
const frameCenterY = 2.00

// side jambs
box([jambW,frameOuterH,frameDepth],
    [-(frameOuterW/2 - jambW/2),frameCenterY,frameZ],
    C.trim)
box([jambW,frameOuterH,frameDepth],
    [ +(frameOuterW/2 - jambW/2),frameCenterY,frameZ],
    C.trim)

// head jamb
box([frameOuterW,headH,frameDepth],
    [0,frameCenterY + frameOuterH/2 - headH/2,frameZ],
    C.trim)

// a thin exterior stop/trim layer around the opening, still leaving the opening free
box([jambW+.03,frameOuterH+.08,.045],
    [-(frameOuterW/2 - jambW/2),frameCenterY,frameZ+.045],
    C.trim2)
box([jambW+.03,frameOuterH+.08,.045],
    [ +(frameOuterW/2 - jambW/2),frameCenterY,frameZ+.045],
    C.trim2)
box([frameOuterW+.06,headH+.03,.045],
    [0,frameCenterY + frameOuterH/2 - headH/2,frameZ+.045],
    C.trim2)

const doorW = 1.06
const doorH = 2.17
const doorHingeX = -doorW/2
const doorZ = HD+.14
const doorGroup = app.create('group')
doorGroup.position.set(doorHingeX,0,doorZ)
app.add(doorGroup)

function doorPrim(config) {
  const n = app.create('prim', {
    castShadow: true,
    receiveShadow: true,
    roughness: .88,
    metalness: .04,
    ...config,
  })
  doorGroup.add(n)
  return n
}

// Door slab and decorative panels are local to the hinge pivot.
doorPrim({
  type:'box',
  size:[doorW,doorH,.13],
  position:[doorW/2,1.91,0],
  color:C.door,
  physics:'kinematic',
})
doorPrim({
  type:'box',
  size:[.78,.48,.035],
  position:[doorW/2,2.52,.08],
  color:C.doorDark,
})
doorPrim({
  type:'box',
  size:[.78,.63,.035],
  position:[doorW/2,1.72,.08],
  color:C.doorDark,
})
// door glazing removed so the opening remains see-through
doorPrim({
  type:'box',
  size:[.035,.32,.055],
  position:[doorW/2,2.55,.13],
  color:C.trim,
})

// Clickable doorknob. Positive Y rotation swings the door inward.
// Time-based easing avoids overshoot/oscillation at the end of the movement.
let doorOpen = false
let doorCurrentAngle = 0
let doorAnimFrom = 0
let doorAnimTo = 0
let doorAnimStart = 0
let doorAnimToken = 0

const DOOR_OPEN_ANGLE = 100 * DEG2RAD
const DOOR_ANIM_MS = 520

const RAF = (typeof requestAnimationFrame === 'function')
  ? requestAnimationFrame.bind(globalThis)
  : (fn) => setTimeout(
      () => fn((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()),
      16
    )

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now()
}

function setDoorAngle(angle) {
  doorCurrentAngle = angle
  doorGroup.rotation.y = angle
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function animateDoorTo(targetAngle) {
  const token = ++doorAnimToken
  doorAnimFrom = doorCurrentAngle
  doorAnimTo = targetAngle
  doorAnimStart = nowMs()

  function frame(timestamp) {
    if (token !== doorAnimToken) return

    const elapsed = Math.max(0, timestamp - doorAnimStart)
    const t = Math.min(1, elapsed / DOOR_ANIM_MS)
    const eased = easeInOutCubic(t)
    setDoorAngle(doorAnimFrom + (doorAnimTo - doorAnimFrom) * eased)

    if (t < 1) {
      RAF(frame)
    } else {
      setDoorAngle(doorAnimTo)
    }
  }

  RAF(frame)
}

const knob = doorPrim({
  type:'sphere',
  size:[.065],
  position:[doorW/2+.39,1.93,.10],
  color:C.dark,
  metalness:.5,
  roughness:.3,
})
knob.onPointerDown = () => {
  doorOpen = !doorOpen
  animateDoorTo(doorOpen ? DOOR_OPEN_ANGLE : 0)
}
// porch lights
for(const x of [-.92,.92]) {
  box([.16,.36,.15],[x,2.45,HD+.16],C.dark)
  sphere(.105,[x,2.45,HD+.27],C.flower2,{emissive:'#ffd59a',emissiveIntensity:.22,roughness:.35})
}
// doormat
box([.88,.025,.46],[0,.91,HD+1.06],C.wood)

// FRONT WINDOWS
frontWindow(-2.25,2.07,HD+wallCladOffset+.02,1.18,1.48,true,true)
frontWindow( 2.25,2.07,HD+wallCladOffset+.02,1.18,1.48,true,true)
// Small round attic window above the porch roof/ceiling.
const atticWindowY = 4.62
const atticWindowZ = HD + wallCladOffset + .07

// recessed round glass removed so the opening remains see-through

// round outer trim ring
torus(.31,.045,[0,atticWindowY,atticWindowZ+.045],C.trim,[Math.PI/2,0,0])

// simple cross muntins
box([.045,.46,.055],[0,atticWindowY,atticWindowZ+.075],C.trim)
box([.46,.045,.055],[0,atticWindowY,atticWindowZ+.075],C.trim)

// SIDES
for(const z of [-1.30,1.15]) sideWindow(HW+wallCladOffset+.02,z,2.02,1.10,1.38,1,z>0)
for(const z of [-1.30,1.15]) sideWindow(-HW-wallCladOffset-.02,z,2.02,1.10,1.38,-1,z<0)
// side trim bands
box([.08,.12,D-.45],[HW+wallCladOffset+.05,1.04,0],C.trim2)
box([.08,.12,D-.45],[-HW-wallCladOffset-.05,1.04,0],C.trim2)

// BACK DOOR + WINDOWS
frontWindow(-2.25,2.00,-HD-wallCladOffset-.02,1.05,1.34,false,false)
frontWindow( 2.25,2.00,-HD-wallCladOffset-.02,1.05,1.34,false,false)
box([1.18,2.28,.11],[0,1.94,-HD-wallCladOffset-.05],C.trim)
box([.92,2.00,.13],[0,1.88,-HD-wallCladOffset-.12],C.door)
box([1.32,.16,.72],[0,.80,-HD-.48],C.stone2,[0,0,0],{physics:'static'})

// DORMER / TOP WINDOW
// Clean rebuild of the dormer:
// - identical horizontal siding on front + both side walls
// - true rectangular window opening in the front wall
// - clean exterior corner boards
// - roof/ridge extends far enough back to intersect the main roof
const dormerFaceX = 3.28
const dormerZ = 1.36
const dormerW = 1.58
const dormerD = 1.82
const dormerWallH = .92
const dormerBaseY = 3.94
const dormerEaveY = dormerBaseY + dormerWallH
const dormerRise = .48
const dormerWallT = .15
const dormerCladT = .03
const dormerCornerW = .14
const dormerCornerD = .035
const dormerBackX = dormerFaceX - dormerD
const dormerCenterX = (dormerBackX + dormerFaceX) / 2
const dormerSideOffset = dormerWallT/2 + dormerCladT/2
const dormerFrontOffset = dormerWallT/2 + dormerCladT/2
const dormerSideMinZ = dormerZ - dormerW/2
const dormerSideMaxZ = dormerZ + dormerW/2
const dormerFrontWallX = dormerFaceX - dormerWallT/2
const dormerFaceCladX = dormerFaceX + dormerFrontOffset
// front-most outside edge of the dormer face cladding / corner treatment
const dormerOuterFrontX = dormerFaceCladX + dormerCladT/2 + dormerCornerD

const dormerSiding = {
  color:C.wall,
  exposedH:.16,
  overlap:.035,
  thickness:dormerCladT,
  tilt:7*Math.PI/180,
  anchorY: wallBottom,
}

// Base trim
box([dormerD+.04,.09,dormerW+.08],
    [dormerCenterX,dormerBaseY+.045,dormerZ],
    C.trim2)

// Physical side walls and back wall
box([dormerD,dormerWallH,dormerWallT],
    [dormerCenterX,dormerBaseY+dormerWallH/2,dormerSideMinZ+dormerWallT/2],
    C.wall)
box([dormerD,dormerWallH,dormerWallT],
    [dormerCenterX,dormerBaseY+dormerWallH/2,dormerSideMaxZ-dormerWallT/2],
    C.wall)
box([dormerWallT,dormerWallH,dormerW],
    [dormerBackX+dormerWallT/2,dormerBaseY+dormerWallH/2,dormerZ],
    C.wall)

// Side siding. It stops before the front corner boards rather than protruding
// through the facade.
const dormerSideCladBackX = dormerBackX + .03
// let the side siding come almost all the way forward; the vertical cover trim
// will hide the junction and close the corner cleanly
const dormerSideCladFrontX = dormerOuterFrontX - dormerCornerW + .01
const dormerSideCladDepth = dormerSideCladFrontX - dormerSideCladBackX
const dormerSideCladCenterX = (dormerSideCladFrontX + dormerSideCladBackX)/2

bardageHorizontal(
  'back',
  [dormerSideCladCenterX,
   dormerBaseY+dormerWallH/2,
   dormerSideMinZ-dormerSideOffset],
  dormerSideCladDepth,
  dormerWallH,
  dormerSiding
)
bardageHorizontal(
  'front',
  [dormerSideCladCenterX,
   dormerBaseY+dormerWallH/2,
   dormerSideMaxZ+dormerSideOffset],
  dormerSideCladDepth,
  dormerWallH,
  dormerSiding
)

// True front-wall opening
const dormerWindowW = .70
const dormerWindowH = .56
const dormerWindowY = dormerBaseY + .45
const dormerWindowZ = dormerZ
const dormerWindowBottom = dormerWindowY - dormerWindowH/2
const dormerWindowTop = dormerWindowY + dormerWindowH/2
const dormerWindowLeft = dormerWindowZ - dormerWindowW/2
const dormerWindowRight = dormerWindowZ + dormerWindowW/2
const dormerFaceBottom = dormerBaseY
const dormerFaceTop = dormerBaseY + dormerWallH
const dormerFaceLeft = dormerSideMinZ + dormerCornerW
const dormerFaceRight = dormerSideMaxZ - dormerCornerW

// Physical front wall segmented around the opening
box([dormerWallT,dormerWindowBottom-dormerFaceBottom,dormerFaceRight-dormerFaceLeft],
    [dormerFrontWallX,
     dormerFaceBottom+(dormerWindowBottom-dormerFaceBottom)/2,
     dormerZ], C.wall)
box([dormerWallT,dormerFaceTop-dormerWindowTop,dormerFaceRight-dormerFaceLeft],
    [dormerFrontWallX,
     dormerWindowTop+(dormerFaceTop-dormerWindowTop)/2,
     dormerZ], C.wall)
box([dormerWallT,dormerWindowH,dormerWindowLeft-dormerFaceLeft],
    [dormerFrontWallX,
     dormerWindowY,
     dormerFaceLeft+(dormerWindowLeft-dormerFaceLeft)/2], C.wall)
box([dormerWallT,dormerWindowH,dormerFaceRight-dormerWindowRight],
    [dormerFrontWallX,
     dormerWindowY,
     dormerWindowRight+(dormerFaceRight-dormerWindowRight)/2], C.wall)

// Matching front siding, also segmented around the window hole.
// Nothing is placed behind the glass.
bardageHorizontal(
  'right',
  [dormerFaceCladX,
   dormerFaceBottom+(dormerWindowBottom-dormerFaceBottom)/2,
   dormerZ],
  dormerFaceRight-dormerFaceLeft,
  dormerWindowBottom-dormerFaceBottom,
  dormerSiding
)
bardageHorizontal(
  'right',
  [dormerFaceCladX,
   dormerWindowTop+(dormerFaceTop-dormerWindowTop)/2,
   dormerZ],
  dormerFaceRight-dormerFaceLeft,
  dormerFaceTop-dormerWindowTop,
  dormerSiding
)
bardageHorizontal(
  'right',
  [dormerFaceCladX,
   dormerWindowY,
   dormerFaceLeft+(dormerWindowLeft-dormerFaceLeft)/2],
  dormerWindowLeft-dormerFaceLeft,
  dormerWindowH,
  dormerSiding
)
bardageHorizontal(
  'right',
  [dormerFaceCladX,
   dormerWindowY,
   dormerWindowRight+(dormerFaceRight-dormerWindowRight)/2],
  dormerFaceRight-dormerWindowRight,
  dormerWindowH,
  dormerSiding
)

// Clean exterior corner covers. Use a single square vertical cover piece at
// each front corner so the joint is fully closed from the side all the way to
// the front edge.
for (const s of [-1,1]) {
  const outerSideZ = dormerZ + s*(dormerW/2 + dormerSideOffset + dormerCladT/2)
  box(
    [dormerCornerW,dormerWallH,dormerCornerW],
    [dormerOuterFrontX - dormerCornerW/2,
     dormerBaseY+dormerWallH/2,
     outerSideZ - s*dormerCornerW/2],
    C.trim
  )
}

// Window assembly sits in front of the cladding; wall behind it is genuinely open.
sideWindow(
  dormerFaceX+dormerFrontOffset+.04,
  dormerZ,
  dormerWindowY,
  .86,
  .74,
  1,
  false
)
box([.12,.10,.98],
    [dormerFaceX+dormerFrontOffset+.03,dormerBaseY-.02,dormerZ],
    C.trim2)

// Gable siding
bardageGableYZ(
  'right',
  dormerFaceX+dormerFrontOffset+.03,
  dormerZ,
  dormerW,
  dormerEaveY,
  dormerRise,
  {
    color:C.wall,
    exposedH:.15,
    overlap:.03,
    thickness:dormerCladT,
    tilt:7*Math.PI/180,
  }
)

// Rake trim: long dimension is along local Z, then rotated around X to follow
// the two slopes. This fixes the huge "crooked sticks" from v30.
const dSideLen = Math.hypot(dormerW/2,dormerRise)
const dAng = Math.atan2(dormerRise,dormerW/2)
box(
  [.10,.08,dSideLen],
  [dormerFaceX+dormerFrontOffset+.055,
   dormerEaveY+dormerRise/2,
   dormerZ-dormerW/4],
  C.trim2,
  [-dAng,0,0]
)
box(
  [.10,.08,dSideLen],
  [dormerFaceX+dormerFrontOffset+.055,
   dormerEaveY+dormerRise/2,
   dormerZ+dormerW/4],
  C.trim2,
  [dAng,0,0]
)

// Roof extends farther back so the ridge penetrates the main roof.
// The geometry intentionally overlaps the main roof rather than ending at its face.
const dRun = dormerW/2 + .10
const dPitch = Math.atan2(dormerRise,dRun)
const dSlope = Math.hypot(dRun,dormerRise)
const dRoofFrontX = dormerFaceX + .26
const dRoofBackX = -.18
const dRoofDepth = dRoofFrontX-dRoofBackX
const dRoofCenterX = (dRoofFrontX+dRoofBackX)/2
const dRoofY = dormerEaveY+dormerRise/2

box([dRoofDepth,.13,dSlope],
    [dRoofCenterX,dRoofY,dormerZ+dRun/2],
    C.roof,[dPitch,0,0])
box([dRoofDepth,.13,dSlope],
    [dRoofCenterX,dRoofY,dormerZ-dRun/2],
    C.roof,[-dPitch,0,0])

// Front eave / fascia so the roof clearly projects beyond the dormer face.
const dRoofFrontEdgeX = dRoofFrontX - .02
box([.08,.10,dRun*2 + .04],
    [dRoofFrontEdgeX,dormerEaveY-.01,dormerZ],
    C.roofDark)

box([dRoofDepth+.02,.10,.13],
    [dRoofCenterX,dormerEaveY+dormerRise+.03,dormerZ],
    C.roofDark)

// GUTTERS + DOWNSPOUTS
for(const x of [-HW-over+.02,HW+over-.02]) cylinder(.045,.045,roofD-.16,[x,eave-.11,0],C.metal,[Math.PI/2,0,0])
// Downspouts removed on request.

// BENCH left front
box([1.55,.12,.42],[-4.15,.48,2.15],C.wood)
box([1.55,.12,.16],[-4.15,.92,2.34],C.wood,[.18,0,0])
for(const x of [-4.75,-3.55]) {
  box([.10,.46,.10],[x,.24,2.15],C.dark)
  box([.10,.48,.10],[x,.66,2.32],C.dark,[.16,0,0])
}

// PICKET FENCE sections with front opening
picket(-4.10,6.55,0,4.5); picket(4.10,6.55,0,4.5)
picket(-6.35,2.15,Math.PI/2,8.9); picket(6.35,2.15,Math.PI/2,8.9)

// MAILBOX — outside the front fence
const mailboxX = 2.15
const mailboxZ = 7.05
cylinder(.055,.065,1.05,[mailboxX,.53,mailboxZ],C.dark)
box([.54,.34,.34],[mailboxX,1.12,mailboxZ],C.roof)
box([.04,.30,.06],[mailboxX+.29,1.26,mailboxZ],C.door)

// LANDSCAPING BEDS
bush(-3.0,2.85,.50,C.green); bush(3.0,2.85,.52,C.green2)
bush(-3.25,-2.55,.46,C.green2); bush(3.20,-2.55,.44,C.green)
bush(-4.7,.7,.42,C.green3); bush(4.7,.7,.42,C.green3)
for(const p of [[-2.7,3.20],[2.65,3.18],[-3.45,2.45],[3.45,2.45],[-3.30,-2.80],[3.30,-2.80]]) flowerCluster(p[0],p[1],8)
// edging stones
for(let x=-3.4;x<=3.4;x+=.45) box([.35,.13,.22],[x,.065,3.35],C.stone2)

// TREE right rear
cylinder(.20,.27,2.65,[4.75,1.33,-3.65],C.wood,[0,0,0],{roughness:1})
for(const p of [[4.75,3.15,-3.65],[4.25,2.85,-3.55],[5.22,2.85,-3.50],[4.70,2.75,-4.15],[4.80,3.55,-3.65]]) sphere(.88,p,C.green2,{scale:[1.12,.85,1.05]})

// small birdbath
cylinder(.10,.14,.72,[-4.15,.36,-2.85],C.stone2)
cylinder(.42,.24,.14,[-4.15,.78,-2.85],C.stone2)
sphere(.10,[-4.15,.88,-2.85],C.glass,{roughness:.15})
