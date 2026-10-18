// Hyperfy primitive-only app: curved old biplane using native extrude primitives.
// Target runtime: Hyperfy v0.16.0 + native `extrude` prim extension.
// Coordinate system: +Y up, +X right, -Z forward.
// Note: this aircraft's nose points toward local +Z to preserve the existing app orientation.

app.resetOnMove = false

// Only major aircraft masses receive collision. Visual detail stays collision-free.
// Colliders are detached into world space so they continue to work while the app
// is selected/transformed in the builder. One shared update keeps the small set
// of colliders aligned with the app transform.
const physicsBindings = []

const PHYSICS_KEYS = [
  'mass',
  'linearDamping',
  'angularDamping',
  'staticFriction',
  'dynamicFriction',
  'restitution',
  'layer',
  'trigger',
  'tag',
  'onContactStart',
  'onContactEnd',
  'onTriggerEnter',
  'onTriggerLeave',
]

function pickPhysicsOptions(extra) {
  const out = {}
  for (const key of PHYSICS_KEYS) {
    if (extra[key] !== undefined) out[key] = extra[key]
  }
  return out
}

function exactWorldTransform(node) {
  const position = node.position.clone().multiply(app.scale).applyQuaternion(app.quaternion).add(app.position)
  const quaternion = app.quaternion.clone().multiply(node.quaternion)
  const scale = node.scale.clone().multiply(app.scale)
  return { position, quaternion, scale }
}

function attachMajorCollider(node, shapeConfig, physics, extra = {}) {
  const initial = exactWorldTransform(node)
  const collider = app.create('prim', {
    ...shapeConfig,
    position: initial.position.toArray(),
    quaternion: initial.quaternion.toArray(),
    scale: initial.scale.toArray(),
    opacity: 0,
    castShadow: false,
    receiveShadow: false,
    physics,
    ...pickPhysicsOptions(extra),
  })
  world.add(collider)
  physicsBindings.push({ node, collider, lastScale: initial.scale.clone() })
  return collider
}

function prim(type, size, position, color, rotation = [0, 0, 0], extra = {}) {
  const node = app.create('prim', {
    type,
    size,
    position,
    rotation,
    color,
    castShadow: true,
    receiveShadow: true,
    roughness: extra.roughness ?? 0.7,
    metalness: extra.metalness ?? 0.08,
    emissive: extra.emissive ?? null,
    emissiveIntensity: extra.emissiveIntensity ?? 0,
    opacity: extra.opacity,
    doubleside: extra.doubleside ?? false,
    physics: null,
  })
  app.add(node)
  if (extra.physics) attachMajorCollider(node, { type, size }, extra.physics, extra)
  return node
}

function extrude(profile, depth, position, color, rotation = [0, 0, 0], extra = {}) {
  const bevelEnabled = extra.bevelEnabled ?? true
  const bevelThickness = extra.bevelThickness ?? 0.025
  const bevelSize = extra.bevelSize ?? 0.025
  const bevelSegments = extra.bevelSegments ?? 3
  const curveSegments = extra.curveSegments ?? 8
  const node = app.create('prim', {
    type: 'extrude',
    profile,
    depth,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
    position,
    rotation,
    color,
    castShadow: true,
    receiveShadow: true,
    roughness: extra.roughness ?? 0.7,
    metalness: extra.metalness ?? 0.08,
    emissive: extra.emissive ?? null,
    emissiveIntensity: extra.emissiveIntensity ?? 0,
    opacity: extra.opacity,
    doubleside: extra.doubleside ?? false,
    physics: null,
  })
  app.add(node)
  if (extra.physics) {
    attachMajorCollider(node, {
      type: 'extrude',
      profile,
      depth,
      bevelEnabled,
      bevelThickness,
      bevelSize,
      bevelSegments,
      curveSegments,
    }, extra.physics, extra)
  }
  return node
}

const box = (size, pos, color, rot = [0, 0, 0], extra = {}) => prim('box', size, pos, color, rot, extra)
const sphere = (r, pos, color, extra = {}) => prim('sphere', [r], pos, color, [0, 0, 0], extra)
const cylinder = (rt, rb, h, pos, color, rot = [0, 0, 0], extra = {}) => prim('cylinder', [rt, rb, h], pos, color, rot, extra)
const cone = (r, h, pos, color, rot = [0, 0, 0], extra = {}) => prim('cone', [r, h], pos, color, rot, extra)
const torus = (r, tube, pos, color, rot = [0, 0, 0], extra = {}) => prim('torus', [r, tube], pos, color, rot, extra)

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

function distance3(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

function yAxisRotationBetween(a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const horizontal = Math.hypot(dx, dz)
  if (horizontal === 0) return [dy >= 0 ? 0 : Math.PI, 0, 0]
  const rx = Math.atan2(horizontal, dy)
  const ry = Math.atan2(dx, dz)
  return [rx, ry, 0]
}

function beamBetween(a, b, thickness, color, extra = {}) {
  return box([thickness, distance3(a, b), thickness], midpoint(a, b), color, yAxisRotationBetween(a, b), extra)
}

function cylinderBetween(a, b, radius, color, extra = {}) {
  return cylinder(radius, radius, distance3(a, b), midpoint(a, b), color, yAxisRotationBetween(a, b), extra)
}

const C = {
  linen: '#e8ddc8',
  linenShade: '#d7c9ad',
  crimson: '#7a1f15',
  red: '#8e2f21',
  darkRed: '#58150f',
  wood: '#8a5a2d',
  woodLight: '#a8753f',
  woodDark: '#533318',
  metal: '#8f949a',
  metalDark: '#3f474f',
  gunmetal: '#272e35',
  black: '#17191b',
  tire: '#121212',
  axle: '#38404a',
  glass: '#8db9cb',
  leather: '#5b3a1e',
  brass: '#b18c4a',
  navGreen: '#397452',
  navRed: '#9b2c24',
  ivory: '#eee5d2',
}


const fuselageY = 2.16
const lowerWingY = 1.82
const upperWingY = 3.08

// -----------------------------------------------------------------------------
// Main curved surfaces
// -----------------------------------------------------------------------------

// Side silhouette. Rotating local Z onto world X makes extrusion depth the fuselage width.
const fuselageProfile = [
  [ 2.30,  0.18], [ 2.08,  0.34], [ 1.72,  0.45], [ 1.15,  0.49],
  [ 0.50,  0.51], [-0.18,  0.50], [-0.82,  0.47], [-1.45,  0.41],
  [-2.05,  0.34], [-2.62,  0.27], [-3.14,  0.20], [-3.63,  0.14],
  [-4.08,  0.08], [-4.12, -0.10], [-3.70, -0.17], [-3.10, -0.24],
  [-2.42, -0.31], [-1.66, -0.36], [-0.86, -0.39], [ 0.02, -0.40],
  [ 0.82, -0.38], [ 1.45, -0.33], [ 1.92, -0.26], [ 2.22, -0.13],
]
extrude(fuselageProfile, 0.84, [0, fuselageY, -0.91], C.red, [0, -Math.PI / 2, 0], {
  bevelThickness: 0.055,
  bevelSize: 0.055,
  bevelSegments: 4,
  curveSegments: 12,
  roughness: 0.72,
  physics: 'static',
})

// Dark upper decking gives the fuselage a layered fabric/wood appearance.
const deckingProfile = [
  [1.72, 0.43], [1.12, 0.52], [0.52, 0.55], [-0.16, 0.53],
  [-0.85, 0.47], [-1.40, 0.39], [-1.36, 0.31], [-0.70, 0.36],
  [0.02, 0.39], [0.76, 0.39], [1.38, 0.35], [1.72, 0.30],
]
extrude(deckingProfile, 0.72, [0, fuselageY + 0.01, 0.16], C.darkRed, [0, -Math.PI / 2, 0], {
  bevelThickness: 0.020,
  bevelSize: 0.018,
  bevelSegments: 2,
  curveSegments: 10,
})

function wingProfile(halfSpan, rootFront, rootRear, tipFront, tipRear) {
  return [
    [-halfSpan + 0.18, tipFront - 0.06],
    [-halfSpan, tipFront - 0.16],
    [-halfSpan - 0.06, (tipFront + tipRear) * 0.48],
    [-halfSpan - 0.02, tipRear + 0.12],
    [-halfSpan + 0.18, tipRear],
    [-halfSpan * 0.62, tipRear - 0.04],
    [0, rootRear],
    [halfSpan * 0.62, tipRear - 0.04],
    [halfSpan - 0.18, tipRear],
    [halfSpan + 0.02, tipRear + 0.12],
    [halfSpan + 0.06, (tipFront + tipRear) * 0.48],
    [halfSpan, tipFront - 0.16],
    [halfSpan - 0.18, tipFront - 0.06],
    [halfSpan * 0.62, tipFront + 0.02],
    [0, rootFront],
    [-halfSpan * 0.62, tipFront + 0.02],
  ]
}

// Local XY is the wing planform; +90° X rotation maps local Y to world +Z and depth to world Y.
const lowerWingProfile = wingProfile(4.66, 0.58, -0.70, 0.42, -0.62)
const upperWingProfile = wingProfile(4.52, 0.60, -0.69, 0.46, -0.60)
extrude(lowerWingProfile, 0.12, [0, lowerWingY, -0.08], C.linen, [Math.PI / 2, 0, 0], {
  bevelThickness: 0.045,
  bevelSize: 0.055,
  bevelSegments: 4,
  curveSegments: 12,
  physics: 'static',
})
extrude(upperWingProfile, 0.115, [0, upperWingY, -0.015], C.linen, [Math.PI / 2, 0, 0], {
  bevelThickness: 0.045,
  bevelSize: 0.055,
  bevelSegments: 4,
  curveSegments: 12,
  physics: 'static',
})

// Horizontal tail, now one smooth tapered surface instead of a rectangular slab.
const tailplaneProfile = [
  [-1.22, 0.28], [-1.34, 0.14], [-1.31, -0.27], [-1.12, -0.41],
  [-0.38, -0.34], [0, -0.30], [0.38, -0.34], [1.12, -0.41],
  [1.31, -0.27], [1.34, 0.14], [1.22, 0.28], [0.42, 0.34], [0, 0.36], [-0.42, 0.34],
]
extrude(tailplaneProfile, 0.095, [0, fuselageY + 0.14, -3.685], C.linen, [Math.PI / 2, 0, 0], {
  bevelThickness: 0.032,
  bevelSize: 0.038,
  bevelSegments: 3,
  physics: 'static',
})

// Vertical stabilizer profile. Rotation maps extrusion depth to world X.
// ExtrudeGeometry is centered on its profile bounds, so compensate by the
// profile's Y-center to keep the intended profile baseline on top of the tail.
const finProfile = [
  [-0.44, 0.03], [-0.34, 0.42], [-0.16, 0.82], [0.04, 1.08],
  [0.20, 1.13], [0.34, 0.95], [0.42, 0.56], [0.40, 0.12],
  [0.24, -0.02], [-0.08, -0.08],
]
const finProfileCenterY = (-0.08 + 1.13) / 2
extrude(finProfile, 0.12, [0, fuselageY + 0.11 + finProfileCenterY, -3.73], C.linen, [0, Math.PI / 2, 0], {
  bevelThickness: 0.025,
  bevelSize: 0.030,
  bevelSegments: 3,
  physics: 'static',
})

// Separate rudder gives a curved trailing edge.
const rudderProfile = [
  [-0.12, 0.07], [-0.05, 0.78], [0.08, 1.02], [0.23, 0.98],
  [0.33, 0.72], [0.36, 0.33], [0.30, 0.04], [0.16, -0.07],
]
const rudderProfileCenterY = (-0.07 + 1.02) / 2
extrude(rudderProfile, 0.10, [0, fuselageY + 0.11 + rudderProfileCenterY, -3.98], C.crimson, [0, Math.PI / 2, 0], {
  bevelThickness: 0.018,
  bevelSize: 0.022,
  bevelSegments: 2,
})

// Curved outer ailerons as native extrusions.
function addAileron(sign, y, spanCenter, scale = 1) {
  const p = [
    [-0.78, 0.08], [-0.86, -0.01], [-0.82, -0.18], [-0.70, -0.25],
    [0.68, -0.25], [0.80, -0.18], [0.82, 0.01], [0.72, 0.08],
  ].map(([x, z]) => [x * scale, z])
  extrude(p, 0.045, [sign * spanCenter, y + 0.055, -0.63], C.crimson, [Math.PI / 2, 0, 0], {
    bevelThickness: 0.012,
    bevelSize: 0.014,
    bevelSegments: 2,
  })
}
addAileron(-1, upperWingY, 3.55, 1)
addAileron(1, upperWingY, 3.55, 1)

// -----------------------------------------------------------------------------
// Engine and propeller
// -----------------------------------------------------------------------------

cone(0.47, 0.66, [0, fuselageY, 2.22], C.metal, [Math.PI / 2, 0, 0], { roughness: 0.34, metalness: 0.58, physics: 'static' })
cylinder(0.43, 0.43, 0.16, [0, fuselageY, 2.04], C.gunmetal, [Math.PI / 2, 0, 0], { roughness: 0.30, metalness: 0.62 })

for (const a of [-0.90, -0.46, 0, 0.46, 0.90]) {
  const x = Math.sin(a) * 0.32
  const y = fuselageY + Math.cos(a) * 0.31
  cylinder(0.085, 0.085, 0.42, [x, y, 1.90], C.metalDark, [Math.PI / 2, 0, 0], { roughness: 0.36, metalness: 0.60 })
  box([0.13, 0.18, 0.20], [x, y, 1.98], C.gunmetal)
  for (const dy of [-0.055, 0, 0.055]) {
    box([0.16, 0.018, 0.055], [x, y + dy, 2.02], C.metal)
  }
}

for (const x of [-0.31, 0.31]) {
  cylinder(0.035, 0.035, 0.38, [x, fuselageY - 0.10, 1.60], C.gunmetal, [Math.PI / 2, 0, 0])
  cone(0.045, 0.15, [x, fuselageY - 0.22, 1.43], C.gunmetal, [-0.72, 0, 0])
}

// A single extruded curved blade silhouette, duplicated by 180 degrees.
const propBladeProfile = [
  [-0.075, 0.08], [-0.105, 0.22], [-0.145, 0.44], [-0.165, 0.67],
  [-0.150, 0.87], [-0.110, 1.05], [-0.060, 1.19], [-0.010, 1.25],
  [ 0.038, 1.21], [ 0.082, 1.07], [ 0.112, 0.86], [ 0.120, 0.61],
  [ 0.108, 0.38], [ 0.082, 0.18], [ 0.055, 0.08],
]
const propBladeBoundsCenter = [-0.0225, 0.665]
// One authoritative parked propeller angle. Local +Y is the blade's long axis.
// -0.40 rad puts the blades about 23 degrees off vertical.
const propAngle = -0.40
for (const angle of [propAngle, propAngle + Math.PI]) {
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const px = propBladeBoundsCenter[0] * c - propBladeBoundsCenter[1] * sn
  const py = propBladeBoundsCenter[0] * sn + propBladeBoundsCenter[1] * c
  extrude(propBladeProfile, 0.075, [px, fuselageY + py, 2.62], C.woodLight, [0, 0, angle], {
    bevelThickness: 0.020,
    bevelSize: 0.024,
    bevelSegments: 4,
    curveSegments: 12,
    roughness: 0.68,
    metalness: 0.02,
  })
}

cylinder(0.18, 0.18, 0.16, [0, fuselageY, 2.56], C.gunmetal, [Math.PI / 2, 0, 0], { metalness: 0.62, roughness: 0.28 })
cylinder(0.145, 0.145, 0.12, [0, fuselageY, 2.65], C.brass, [Math.PI / 2, 0, 0], { metalness: 0.52, roughness: 0.30 })
sphere(0.08, [0, fuselageY, 2.76], C.axle, { metalness: 0.44, roughness: 0.34 })
for (const a of [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3]) {
  sphere(0.017, [Math.cos(a) * 0.11, fuselageY + Math.sin(a) * 0.11, 2.72], C.brass, { metalness: 0.50, roughness: 0.30 })
}

// -----------------------------------------------------------------------------
// Cockpit
// -----------------------------------------------------------------------------

// Leather coaming is built as two curved pieces so the cockpit remains an actual opening.
const cockpitCoamingLeft = [
  [-0.43, -0.28], [-0.45, -0.08], [-0.43, 0.14], [-0.36, 0.29],
  [-0.26, 0.37], [-0.18, 0.31], [-0.25, 0.19], [-0.29, 0.04],
  [-0.30, -0.18], [-0.28, -0.29],
]
const cockpitCoamingRight = cockpitCoamingLeft.map(([x, z]) => [-x, z]).reverse()
for (const profile of [cockpitCoamingLeft, cockpitCoamingRight]) {
  extrude(profile, 0.065, [0, fuselageY + 0.50, 0.01], C.leather, [Math.PI / 2, 0, 0], {
    bevelThickness: 0.014,
    bevelSize: 0.016,
    bevelSegments: 3,
    curveSegments: 10,
  })
}
box([0.42, 0.05, 0.48], [0, fuselageY + 0.25, -0.10], C.black)
box([0.30, 0.31, 0.05], [0, fuselageY + 0.52, 0.12], C.gunmetal, [0.55, 0, 0])
for (const x of [-0.10, 0, 0.10]) sphere(0.024, [x, fuselageY + 0.58, 0.17], C.brass, { metalness: 0.42 })
box([0.30, 0.30, 0.08], [0, fuselageY + 0.38, -0.34], C.leather)
cylinder(0.018, 0.018, 0.26, [0, fuselageY + 0.28, 0.02], C.gunmetal, [0.22, 0, 0])
box([0.18, 0.03, 0.03], [0, fuselageY + 0.17, -0.07], C.gunmetal)

// Windscreen and frame. The aircraft nose is local +Z, so the top of the
// windscreen must lean toward -Z (aft), not +Z (forward).
const windscreenTilt = -0.32
const windscreenCenterY = fuselageY + 0.65
const windscreenCenterZ = 0.38
const windscreenHalfHeight = 0.10
const windscreenTopY = windscreenCenterY + Math.cos(windscreenTilt) * windscreenHalfHeight
const windscreenTopZ = windscreenCenterZ + Math.sin(windscreenTilt) * windscreenHalfHeight
box([0.54, 0.20, 0.035], [0, windscreenCenterY, windscreenCenterZ], C.glass, [windscreenTilt, 0, 0], { opacity: 0.64, roughness: 0.10, metalness: 0.02 })
box([0.58, 0.025, 0.025], [0, windscreenTopY, windscreenTopZ], C.gunmetal, [windscreenTilt, 0, 0])
for (const x of [-0.26, 0.26]) box([0.025, 0.20, 0.025], [x, windscreenCenterY, windscreenCenterZ], C.gunmetal, [windscreenTilt, 0, 0])

// -----------------------------------------------------------------------------
// Struts and rigging
// -----------------------------------------------------------------------------

const cabane = [
  [[-0.25, fuselageY + 0.41, 0.46], [-0.58, upperWingY - 0.04, 0.20]],
  [[ 0.25, fuselageY + 0.41, 0.46], [ 0.58, upperWingY - 0.04, 0.20]],
  [[-0.22, fuselageY + 0.40,-0.39], [-0.52, upperWingY - 0.04,-0.18]],
  [[ 0.22, fuselageY + 0.40,-0.39], [ 0.52, upperWingY - 0.04,-0.18]],
]
for (const [a, b] of cabane) beamBetween(a, b, 0.075, C.wood)

for (const x of [-3.15, -1.52, 1.52, 3.15]) {
  const frontLower = [x, lowerWingY + 0.03, 0.28]
  const frontUpper = [x * 0.97, upperWingY - 0.03, 0.30]
  const rearLower = [x, lowerWingY + 0.03, -0.58]
  const rearUpper = [x * 0.97, upperWingY - 0.03, -0.53]
  beamBetween(frontLower, frontUpper, 0.082, C.wood)
  beamBetween(rearLower, rearUpper, 0.082, C.wood)
  cylinderBetween(frontLower, rearUpper, 0.014, C.gunmetal)
  cylinderBetween(rearLower, frontUpper, 0.014, C.gunmetal)
}

for (const x of [-3.82, -2.42, -0.90, 0.90, 2.42, 3.82]) {
  cylinderBetween([x, lowerWingY + 0.03, 0.08], [x * 0.97, upperWingY - 0.03, 0.14], 0.009, C.gunmetal)
  cylinderBetween([x, lowerWingY + 0.03, -0.49], [x * 0.97, upperWingY - 0.03, -0.44], 0.009, C.gunmetal)
}

// Wing rib and spar hints sit just above the curved extrusion.
for (const y of [lowerWingY, upperWingY]) {
  for (const x of [-4.0, -3.2, -2.4, -1.6, -0.8, 0.8, 1.6, 2.4, 3.2, 4.0]) {
    box([0.025, 0.025, 0.88], [x, y + 0.075, -0.08], C.woodDark)
  }
  box([8.30, 0.022, 0.035], [0, y + 0.075, 0.29], C.darkRed)
  box([8.15, 0.022, 0.030], [0, y + 0.075, -0.53], C.darkRed)
}

// -----------------------------------------------------------------------------
// Landing gear and wheels
// -----------------------------------------------------------------------------

// The wheel axle is the authoritative landing-gear anchor. The old version had
// the V-struts terminating well above the wheel centres, which made the wheels
// look detached and the axle/fairing float above them.
const wheelY = 0.44
const wheelZ = 0.64
const wheelX = 1.08
const gearLeftAxle = [-0.94, wheelY + 0.04, wheelZ]
const gearRightAxle = [0.94, wheelY + 0.04, wheelZ]

beamBetween([-0.42, fuselageY - 0.12, 1.00], gearLeftAxle, 0.085, C.wood)
beamBetween([-0.26, fuselageY - 0.14, 0.14], gearLeftAxle, 0.085, C.wood)
beamBetween([ 0.42, fuselageY - 0.12, 1.00], gearRightAxle, 0.085, C.wood)
beamBetween([ 0.26, fuselageY - 0.14, 0.14], gearRightAxle, 0.085, C.wood)

// Axle and bungee/cross bracing now pass through the wheel hubs.
cylinderBetween([-wheelX, wheelY, wheelZ], [wheelX, wheelY, wheelZ], 0.045, C.axle)
beamBetween(gearLeftAxle, [0, wheelY + 0.24, wheelZ + 0.05], 0.032, C.gunmetal)
beamBetween(gearRightAxle, [0, wheelY + 0.24, wheelZ + 0.05], 0.032, C.gunmetal)

for (const x of [-wheelX, wheelX]) {
  // Torus normal is local Z; +90° around Y puts the wheel plane in world YZ.
  torus(0.34, 0.10, [x, wheelY, wheelZ], C.tire, [0, Math.PI / 2, 0], { roughness: 0.96, metalness: 0.01, physics: 'static' })

  // Cylinder long axis is local Y, so rotate around Z to align the hub with X.
  cylinder(0.16, 0.16, 0.16, [x, wheelY, wheelZ], C.gunmetal, [0, 0, Math.PI / 2], { metalness: 0.35 })
  cylinder(0.075, 0.075, 0.21, [x, wheelY, wheelZ], C.metal, [0, 0, Math.PI / 2], { metalness: 0.46, roughness: 0.32 })

  // Radial spokes stay in the wheel's YZ plane.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4
    const dy = Math.cos(a) * 0.255
    const dz = Math.sin(a) * 0.255
    cylinderBetween([x, wheelY, wheelZ], [x, wheelY + dy, wheelZ + dz], 0.0065, C.metal)
  }
}

// Tail wheel assembly replaces the old tail skid / stick.
const tailWheelAnchor = [0, 1.93, -4.04]
const tailWheelPivot = [0, 1.66, -4.12]
const tailWheelCenter = [0, 1.48, -4.16]

cylinderBetween(tailWheelAnchor, tailWheelPivot, 0.024, C.woodDark)
box([0.06, 0.12, 0.18], [0, 1.78, -4.08], C.metalDark, [0.22, 0, 0], { metalness: 0.30, roughness: 0.55 })
// small fork
cylinderBetween([-0.06, tailWheelPivot[1], tailWheelPivot[2] - 0.01], [-0.03, tailWheelCenter[1] + 0.03, tailWheelCenter[2]], 0.010, C.gunmetal)
cylinderBetween([0.06, tailWheelPivot[1], tailWheelPivot[2] - 0.01], [0.03, tailWheelCenter[1] + 0.03, tailWheelCenter[2]], 0.010, C.gunmetal)
cylinderBetween([-0.04, tailWheelCenter[1] + 0.03, tailWheelCenter[2]], [0.04, tailWheelCenter[1] + 0.03, tailWheelCenter[2]], 0.008, C.gunmetal)
// tiny tail wheel
torus(0.095, 0.028, tailWheelCenter, C.tire, [0, Math.PI / 2, 0], { roughness: 0.96, metalness: 0.01 })
cylinder(0.040, 0.040, 0.08, tailWheelCenter, C.gunmetal, [0, 0, Math.PI / 2], { metalness: 0.42, roughness: 0.34 })

// -----------------------------------------------------------------------------
// Tail braces, controls, and small exterior fittings
// -----------------------------------------------------------------------------

// Structural tailplane braces: each side is defined from a lower fuselage anchor
// to the underside of the stabilizer. These replace the old diagonal members
// that terminated above/forward of the tail and read as backwards braces.
for (const sign of [-1, 1]) {
  const root = [sign * 0.16, fuselageY - 0.18, -3.10]
  const tip = [sign * 1.03, fuselageY + 0.07, -3.70]
  beamBetween(root, tip, 0.040, C.woodDark)

  // Upper bracing wire from fin post to stabilizer tip.
  cylinderBetween([0, fuselageY + 0.88, -3.82], [sign * 1.04, fuselageY + 0.20, -3.72], 0.007, C.gunmetal)
}
for (const z of [0.92, 0.28, -0.34, -0.98, -1.62, -2.20]) {
  sphere(0.015, [ 0.43, fuselageY + 0.02, z], C.brass)
  sphere(0.015, [-0.43, fuselageY + 0.02, z], C.brass)
}

// Small step and grab handle.
box([0.05, 0.20, 0.05], [0.44, fuselageY - 0.05, -0.95], C.gunmetal)
beamBetween([0.44, fuselageY - 0.15, -0.95], [0.72, 1.24, -0.50], 0.016, C.gunmetal)
box([0.25, 0.045, 0.035], [0.31, fuselageY + 0.55, 0.92], C.gunmetal, [0.10, 0, 0.18])


// -----------------------------------------------------------------------------
// Additional refinement pass: curved fittings, controls, panels, and hardware
// -----------------------------------------------------------------------------

// Curved engine-side inspection cheeks, one on each side of the nose.
const engineCheekProfile = [
  [-0.52, -0.25], [-0.46, 0.15], [-0.30, 0.31], [0.12, 0.34],
  [0.46, 0.24], [0.55, 0.05], [0.50, -0.22], [0.27, -0.31], [-0.24, -0.31],
]
for (const x of [-0.455, 0.455]) {
  extrude(engineCheekProfile, 0.035, [x, fuselageY + 0.01, 1.33], C.darkRed, [0, -Math.PI / 2, 0], {
    bevelThickness: 0.010,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 10,
    roughness: 0.65,
  })

  // Raised cooling louvers use small rounded extrusion profiles rather than boxes.
  for (const [z, y] of [[1.16, 0.20], [1.36, 0.18], [1.56, 0.15], [1.75, 0.10]]) {
    const louver = [
      [-0.105, -0.022], [-0.086, 0.024], [0.072, 0.028], [0.108, 0.004],
      [0.079, -0.028], [-0.082, -0.028],
    ]
    extrude(louver, 0.025, [x + Math.sign(x) * 0.018, fuselageY + y, z], C.gunmetal, [0, -Math.PI / 2, 0], {
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
      roughness: 0.34,
      metalness: 0.62,
    })
  }
}

// Individual exhaust stubs feed downward and aft from the exposed engine cylinders.
for (const a of [-0.90, -0.46, 0, 0.46, 0.90]) {
  const x = Math.sin(a) * 0.32
  const y = fuselageY + Math.cos(a) * 0.31
  const side = x === 0 ? 1 : Math.sign(x)
  cylinderBetween([x, y - 0.02, 1.83], [x + side * 0.08, y - 0.24, 1.58], 0.026, C.gunmetal)
  cylinderBetween([x + side * 0.08, y - 0.24, 1.58], [x + side * 0.12, y - 0.28, 1.42], 0.023, C.gunmetal)
}

// Propeller laminations: curved inset strips follow each blade silhouette.
const propInlayProfile = [
  [-0.052, 0.16], [-0.078, 0.36], [-0.086, 0.60], [-0.074, 0.82],
  [-0.045, 1.02], [-0.014, 1.15], [0.018, 1.10], [0.036, 0.92],
  [0.040, 0.68], [0.032, 0.44], [0.014, 0.22],
]
const propInlayBoundsCenter = [-0.023, 0.655]
for (const angle of [propAngle, propAngle + Math.PI]) {
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const px = propInlayBoundsCenter[0] * c - propInlayBoundsCenter[1] * sn
  const py = propInlayBoundsCenter[0] * sn + propInlayBoundsCenter[1] * c
  extrude(propInlayProfile, 0.014, [px, fuselageY + py, 2.666], C.woodDark, [0, 0, angle], {
    bevelEnabled: false,
    roughness: 0.74,
    metalness: 0.01,
  })
}

// Streamlined axle fairing: a long native extrusion with an airfoil-like cross-section.
const axleFairingProfile = [
  [-0.39, -0.01], [-0.30, 0.085], [-0.02, 0.115], [0.24, 0.085],
  [0.39, 0.015], [0.26, -0.075], [-0.04, -0.105], [-0.30, -0.075],
]
extrude(axleFairingProfile, 1.88, [0, wheelY + 0.04, wheelZ], C.red, [0, -Math.PI / 2, 0], {
  bevelThickness: 0.024,
  bevelSize: 0.028,
  bevelSegments: 3,
  curveSegments: 10,
})

// Shaped instrument panel and individual bezel rings.
const instrumentPanelProfile = [
  [-0.29, -0.15], [-0.29, 0.06], [-0.23, 0.18], [-0.11, 0.25],
  [0.11, 0.25], [0.23, 0.18], [0.29, 0.06], [0.29, -0.15],
]
extrude(instrumentPanelProfile, 0.045, [0, fuselageY + 0.50, 0.145], C.gunmetal, [0, 0, 0], {
  bevelThickness: 0.009,
  bevelSize: 0.010,
  bevelSegments: 2,
  metalness: 0.44,
  roughness: 0.42,
})
for (const [x, y, r] of [[-0.12, 0.57, 0.052], [0.02, 0.60, 0.046], [0.14, 0.54, 0.041], [-0.01, 0.46, 0.035]]) {
  torus(r, 0.008, [x, fuselageY + y - 0.50, 0.174], C.brass, [0, 0, 0], { metalness: 0.52, roughness: 0.30 })
  cylinder(r * 0.72, r * 0.72, 0.010, [x, fuselageY + y - 0.50, 0.166], C.black, [Math.PI / 2, 0, 0])
}

// Curved seat shell and simple leather harness.
const seatBackProfile = [
  [-0.24, -0.20], [-0.26, 0.10], [-0.20, 0.27], [-0.10, 0.34],
  [0.10, 0.34], [0.20, 0.27], [0.26, 0.10], [0.24, -0.20],
]
extrude(seatBackProfile, 0.075, [0, fuselageY + 0.35, -0.38], C.leather, [0, 0, 0], {
  bevelThickness: 0.015,
  bevelSize: 0.017,
  bevelSegments: 3,
})
for (const x of [-0.09, 0.09]) {
  box([0.035, 0.34, 0.022], [x, fuselageY + 0.42, -0.335], C.woodLight, [0, 0, x < 0 ? -0.14 : 0.14])
}
box([0.22, 0.035, 0.022], [0, fuselageY + 0.33, -0.330], C.brass)

// Separate curved elevator halves make the tail read as a functional control surface.
const elevatorProfile = [
  [-0.60, 0.10], [-0.67, 0.02], [-0.65, -0.17], [-0.54, -0.27],
  [0.48, -0.24], [0.60, -0.15], [0.61, 0.07], [0.48, 0.11],
]
for (const x of [-0.64, 0.64]) {
  extrude(elevatorProfile, 0.042, [x, fuselageY + 0.205, -3.91], C.crimson, [Math.PI / 2, 0, 0], {
    bevelThickness: 0.010,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 8,
  })
  for (const hx of [-0.34, 0.30]) sphere(0.022, [x + hx, fuselageY + 0.225, -3.80], C.gunmetal, { metalness: 0.55 })
}

// Tail control horns and cables follow the fuselage longitudinally instead of
// cutting diagonally across the tail surfaces.
for (const sign of [-1, 1]) {
  const horn = [sign * 0.76, fuselageY + 0.27, -3.93]
  box([0.035, 0.17, 0.028], horn, C.gunmetal)
  cylinderBetween([sign * 0.30, fuselageY + 0.24, -2.92], [sign * 0.70, fuselageY + 0.30, -3.86], 0.006, C.gunmetal)
}
// Rudder pull-pull cables.
for (const sign of [-1, 1]) {
  cylinderBetween([sign * 0.22, fuselageY + 0.28, -2.96], [sign * 0.10, fuselageY + 0.52, -4.02], 0.006, C.gunmetal)
}

// Wing-root inspection plates use a rounded irregular extrusion.
const inspectionPlateProfile = [
  [-0.18, -0.12], [-0.10, -0.19], [0.10, -0.19], [0.18, -0.10],
  [0.17, 0.09], [0.08, 0.17], [-0.10, 0.16], [-0.18, 0.08],
]
for (const y of [lowerWingY, upperWingY]) {
  for (const x of [-0.72, 0.72]) {
    extrude(inspectionPlateProfile, 0.022, [x, y + 0.075, -0.15], C.red, [Math.PI / 2, 0, 0], {
      bevelThickness: 0.005,
      bevelSize: 0.006,
      bevelSegments: 2,
    })
    sphere(0.010, [x - 0.10, y + 0.090, -0.15], C.brass)
    sphere(0.010, [x + 0.10, y + 0.090, -0.15], C.brass)
  }
}

// Navigation lights and a small pitot tube on the upper wing.
sphere(0.055, [-4.47, upperWingY + 0.08, 0.14], C.navRed, { emissive: C.navRed, emissiveIntensity: 0.35 })
sphere(0.055, [ 4.47, upperWingY + 0.08, 0.14], C.navGreen, { emissive: C.navGreen, emissiveIntensity: 0.35 })
cylinderBetween([-3.95, upperWingY + 0.04, 0.40], [-4.22, upperWingY + 0.05, 0.74], 0.012, C.gunmetal)
cylinderBetween([-4.22, upperWingY + 0.05, 0.74], [-4.22, upperWingY + 0.05, 0.88], 0.008, C.metal)

// Fuel filler and cap on the upper decking.
cylinder(0.075, 0.075, 0.050, [0, fuselageY + 0.52, 0.76], C.brass, [0, 0, 0], { metalness: 0.54, roughness: 0.28 })
torus(0.066, 0.010, [0, fuselageY + 0.55, 0.76], C.gunmetal, [Math.PI / 2, 0, 0], { metalness: 0.52 })

// Strut attachment fittings and turnbuckle-like rigging hardware.
for (const x of [-3.15, -1.52, 1.52, 3.15]) {
  for (const [y, z] of [[lowerWingY + 0.04, 0.28], [lowerWingY + 0.04, -0.58], [upperWingY - 0.03, 0.30], [upperWingY - 0.03, -0.53]]) {
    sphere(0.030, [x * (y > 2.5 ? 0.97 : 1), y, z], C.brass, { metalness: 0.48, roughness: 0.34 })
  }
}

// -----------------------------------------------------------------------------
// Detail pass: engine plumbing, cockpit controls, hinges, hatches, and hardware
// -----------------------------------------------------------------------------

// Radial-engine ignition ring and spark-plug leads.
torus(0.275, 0.014, [0, fuselageY, 1.765], C.brass, [Math.PI / 2, 0, 0], {
  roughness: 0.34,
  metalness: 0.48,
})
for (const a of [-0.90, -0.46, 0, 0.46, 0.90]) {
  const x = Math.sin(a) * 0.32
  const y = fuselageY + Math.cos(a) * 0.31
  const ring = [Math.sin(a) * 0.275, fuselageY + Math.cos(a) * 0.275, 1.765]
  const plug = [x, y + 0.015, 1.90]
  cylinderBetween(ring, plug, 0.007, C.black)
  sphere(0.016, plug, C.brass, { metalness: 0.50, roughness: 0.30 })
}

// Intake manifold runners behind the engine.
for (const a of [-0.74, -0.36, 0.36, 0.74]) {
  const x = Math.sin(a) * 0.27
  const y = fuselageY + Math.cos(a) * 0.24
  cylinderBetween([x, y, 1.80], [x * 0.72, fuselageY - 0.03, 1.52], 0.018, C.metalDark)
}
box([0.46, 0.075, 0.11], [0, fuselageY - 0.05, 1.50], C.gunmetal, [0, 0, 0], { metalness: 0.42, roughness: 0.38 })

// Curved oil tank / reservoir tucked behind the engine on the starboard side.
const oilTankProfile = [
  [-0.20, -0.14], [-0.24, 0.02], [-0.18, 0.16], [-0.07, 0.23],
  [0.10, 0.22], [0.22, 0.12], [0.24, -0.04], [0.17, -0.16], [-0.03, -0.20],
]
extrude(oilTankProfile, 0.22, [0.34, fuselageY + 0.17, 1.28], C.brass, [0, -Math.PI / 2, 0], {
  bevelThickness: 0.016,
  bevelSize: 0.020,
  bevelSegments: 3,
  metalness: 0.46,
  roughness: 0.38,
})
cylinder(0.035, 0.035, 0.10, [0.34, fuselageY + 0.39, 1.28], C.gunmetal, [0, 0, 0])

// Wing-root fairings: curved fillets visually blend lower wing into fuselage.
const wingRootFairingProfile = [
  [-0.38, -0.17], [-0.29, -0.27], [-0.05, -0.31], [0.21, -0.26],
  [0.38, -0.12], [0.31, 0.04], [0.10, 0.12], [-0.20, 0.10], [-0.35, 0.02],
]
for (const sign of [-1, 1]) {
  extrude(wingRootFairingProfile, 0.22, [sign * 0.47, lowerWingY + 0.04, -0.04], C.red, [Math.PI / 2, 0, sign < 0 ? Math.PI : 0], {
    bevelThickness: 0.018,
    bevelSize: 0.020,
    bevelSegments: 3,
    roughness: 0.70,
  })
}

// Fuselage side service hatches with raised lips and latches.
const serviceHatchProfile = [
  [-0.34, -0.19], [-0.28, -0.27], [0.22, -0.27], [0.34, -0.16],
  [0.34, 0.15], [0.24, 0.25], [-0.25, 0.25], [-0.34, 0.16],
]
for (const sign of [-1, 1]) {
  extrude(serviceHatchProfile, 0.025, [sign * 0.438, fuselageY + 0.02, -1.06], C.darkRed, [0, -Math.PI / 2, 0], {
    bevelThickness: 0.007,
    bevelSize: 0.008,
    bevelSegments: 2,
    roughness: 0.64,
  })
  box([0.022, 0.11, 0.035], [sign * 0.458, fuselageY + 0.01, -0.81], C.brass, [0, 0, 0], { metalness: 0.48, roughness: 0.32 })
  sphere(0.015, [sign * 0.462, fuselageY + 0.15, -1.06], C.brass, { metalness: 0.48, roughness: 0.32 })
  sphere(0.015, [sign * 0.462, fuselageY - 0.11, -1.06], C.brass, { metalness: 0.48, roughness: 0.32 })
}

// Cockpit floorboards, rudder pedals, throttle quadrant, and compass.
for (const x of [-0.15, 0.15]) {
  box([0.12, 0.025, 0.62], [x, fuselageY + 0.06, -0.02], C.woodDark, [0, 0, 0], { roughness: 0.82, metalness: 0.01 })
}
for (const x of [-0.12, 0.12]) {
  box([0.12, 0.035, 0.07], [x, fuselageY + 0.12, 0.18], C.gunmetal, [0.12, 0, 0], { metalness: 0.45, roughness: 0.38 })
  cylinderBetween([x, fuselageY + 0.12, 0.17], [x, fuselageY + 0.20, 0.05], 0.010, C.metalDark)
}
const throttleProfile = [
  [-0.08, -0.11], [-0.08, 0.10], [-0.02, 0.17], [0.06, 0.15],
  [0.09, 0.04], [0.06, -0.10],
]
extrude(throttleProfile, 0.035, [-0.31, fuselageY + 0.42, -0.02], C.gunmetal, [0, 0, 0], {
  bevelThickness: 0.006,
  bevelSize: 0.006,
  bevelSegments: 2,
  metalness: 0.46,
  roughness: 0.36,
})
cylinderBetween([-0.30, fuselageY + 0.45, 0.00], [-0.30, fuselageY + 0.61, 0.03], 0.010, C.brass)
sphere(0.025, [-0.30, fuselageY + 0.62, 0.03], C.black)
torus(0.055, 0.009, [0.18, fuselageY + 0.40, -0.13], C.brass, [Math.PI / 2, 0, 0], { metalness: 0.48, roughness: 0.30 })
cylinder(0.043, 0.043, 0.018, [0.18, fuselageY + 0.40, -0.13], C.black, [Math.PI / 2, 0, 0])

// Leather cockpit edge stitching: small light fasteners along the coaming.
for (const sign of [-1, 1]) {
  for (const z of [-0.22, -0.08, 0.06, 0.20]) {
    sphere(0.010, [sign * 0.30, fuselageY + 0.57, z], C.brass, { metalness: 0.35, roughness: 0.42 })
  }
}

// Aileron hinge knuckles and control horns.
for (const sign of [-1, 1]) {
  const x0 = sign * 3.55
  for (const dx of [-0.48, 0, 0.48]) {
    cylinder(0.022, 0.022, 0.10, [x0 + sign * dx, upperWingY + 0.055, -0.50], C.gunmetal, [0, 0, Math.PI / 2], { metalness: 0.50, roughness: 0.36 })
  }
  box([0.035, 0.16, 0.030], [sign * 3.22, upperWingY + 0.09, -0.72], C.gunmetal)
  cylinderBetween([sign * 3.22, upperWingY + 0.17, -0.72], [sign * 2.68, lowerWingY + 0.16, -0.54], 0.006, C.gunmetal)
}

// Elevator hinge knuckles across the tailplane trailing edge.
for (const x of [-0.92, -0.52, 0.52, 0.92]) {
  cylinder(0.018, 0.018, 0.11, [x, fuselageY + 0.20, -3.79], C.gunmetal, [0, 0, Math.PI / 2], { metalness: 0.48, roughness: 0.36 })
}

// Rudder hinge line: short metal knuckles stacked vertically.
for (const y of [fuselageY + 0.34, fuselageY + 0.63, fuselageY + 0.90]) {
  cylinder(0.018, 0.018, 0.10, [0, y, -3.84], C.gunmetal, [0, 0, Math.PI / 2], { metalness: 0.48, roughness: 0.36 })
}

// Landing-gear bungee wraps and axle retaining collars.
for (const sign of [-1, 1]) {
  const x = sign * 0.90
  for (const dz of [-0.055, 0, 0.055]) {
    torus(0.075, 0.012, [x, wheelY + 0.08, wheelZ + dz], C.leather, [0, Math.PI / 2, 0], { roughness: 0.88, metalness: 0.01 })
  }
  cylinder(0.065, 0.065, 0.055, [sign * 1.00, wheelY, wheelZ], C.gunmetal, [0, 0, Math.PI / 2], { metalness: 0.50, roughness: 0.34 })
}

// Tail wheel leaf spring / mount plate.
const tailSpringProfile = [
  [-0.12, -0.025], [0.10, -0.030], [0.16, -0.010], [0.12, 0.022],
  [-0.08, 0.030], [-0.14, 0.010],
]
extrude(tailSpringProfile, 0.045, [0, 1.84, -4.06], C.metalDark, [Math.PI / 2, 0, 0], {
  bevelThickness: 0.006,
  bevelSize: 0.007,
  bevelSegments: 1,
  metalness: 0.52,
  roughness: 0.40,
})

// Small triangular reinforcement plates at the cabane-strut feet.
const gussetProfile = [
  [-0.10, -0.08], [0.11, -0.08], [0.02, 0.13],
]
for (const sign of [-1, 1]) {
  for (const z of [0.43, -0.37]) {
    extrude(gussetProfile, 0.025, [sign * 0.25, fuselageY + 0.42, z], C.brass, [0, -Math.PI / 2, 0], {
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 1,
      metalness: 0.45,
      roughness: 0.34,
    })
  }
}

// Fabric inspection patches near the outer lower-wing panels.
const patchProfile = [
  [-0.17, -0.11], [-0.09, -0.17], [0.09, -0.17], [0.17, -0.09],
  [0.17, 0.09], [0.08, 0.17], [-0.09, 0.17], [-0.17, 0.09],
]
for (const x of [-3.52, 3.52]) {
  extrude(patchProfile, 0.016, [x, lowerWingY + 0.073, -0.12], C.linenShade, [Math.PI / 2, 0, 0], {
    bevelEnabled: false,
    roughness: 0.86,
    metalness: 0.00,
  })
  sphere(0.009, [x - 0.09, lowerWingY + 0.086, -0.12], C.brass)
  sphere(0.009, [x + 0.09, lowerWingY + 0.086, -0.12], C.brass)
}


// Keep the small set of detached structural colliders synchronized with the app.
function syncMajorColliders() {
  for (const binding of physicsBindings) {
    const t = exactWorldTransform(binding.node)
    const scaleChanged = !binding.lastScale.equals(t.scale)

    binding.collider.position.copy(t.position)
    binding.collider.quaternion.copy(t.quaternion)
    binding.collider.scale.copy(t.scale)

    if (scaleChanged) {
      binding.lastScale.copy(t.scale)
      const physics = binding.collider.physics
      binding.collider.physics = null
      binding.collider.physics = physics
    }
  }
}

if (physicsBindings.length) {
  app.on('update', syncMajorColliders)
  app.on('destroy', () => {
    for (const binding of physicsBindings) world.remove(binding.collider)
  })
}
