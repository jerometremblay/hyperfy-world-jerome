// Minwax / American Woodworker Adirondack chair, rebuilt from the published woodworking plan.
// Coordinate system: +Y up, +X right, -Z forward. Plan dimensions are preserved proportionally.
// The 30 in plan width is uniformly scaled to the 1.0 m prompt-box width.
app.resetOnMove = false

const U = 1 / 30 // meters per plan inch after uniform fit: 30 in overall width -> 1.0 m
const groundY = -1.4873829250300101 / 2
const DEG = Math.PI / 180
const WOOD = ['#6b5239', '#765b3f', '#806447', '#5f4934', '#70563c', '#86694a']
const DARK = '#49382a'
const sitEmote = props.sitEmote?.url

function m(inches) {
  return inches * U
}

function pos(x, y, z) {
  return [m(x), groundY + m(y), m(z)]
}

function addBox(sizeIn, positionIn, color, rotation = [0, 0, 0], extra = {}) {
  const node = app.create('prim', {
    type: 'box',
    size: sizeIn.map(m),
    position: pos(positionIn[0], positionIn[1], positionIn[2]),
    rotation,
    color,
    roughness: 0.96,
    metalness: 0,
    castShadow: true,
    receiveShadow: true,
    physics: null,
    ...extra,
  })
  app.add(node)
  return node
}

function addExtrude(profileIn, depthIn, positionIn, rotation, color, extra = {}) {
  const node = app.create('prim', {
    type: 'extrude',
    profile: profileIn.map(p => [m(p[0]), m(p[1])]),
    depth: m(depthIn),
    position: pos(positionIn[0], positionIn[1], positionIn[2]),
    rotation,
    color,
    roughness: 0.96,
    metalness: 0,
    castShadow: true,
    receiveShadow: true,
    physics: null,
    bevelEnabled: true,
    bevelThickness: m(0.07),
    bevelSize: m(0.07),
    bevelSegments: 2,
    curveSegments: 8,
    ...extra,
  })
  app.add(node)
  return node
}

function addCollider(sizeIn, positionIn, rotation = [0, 0, 0]) {
  const node = app.create('prim', {
    type: 'box',
    size: sizeIn.map(m),
    position: pos(positionIn[0], positionIn[1], positionIn[2]),
    rotation,
    opacity: 0,
    castShadow: false,
    receiveShadow: false,
    physics: 'static',
    staticFriction: 0.75,
    dynamicFriction: 0.62,
  })
  app.add(node)
  return node
}

function mirrorX(profile) {
  return profile.map(p => [-p[0], p[1]])
}

function arcPoints(cx, cy, r, a0, a1, segments) {
  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = a0 + (a1 - a0) * (i / segments)
    points.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r])
  }
  return points
}

// -----------------------------------------------------------------------------
// Published Minwax plan parts A-D. Profile-cut parts are modeled as actual
// extrusions instead of generic boxes. Side profiles extrude through board
// thickness; arms use their top-view template and extrude vertically.
// -----------------------------------------------------------------------------

// B - back leg, 1 x 7 x 37-1/2 in blank. The outline follows Fig. 3's curved
// rear foot, rising seat rail and stepped front joinery area.
const backLegProfile = [
  [0.0, 0.0], [2.0, 0.15], [4.0, 0.65], [7.0, 1.8], [10.0, 3.0],
  [15.0, 4.2], [20.0, 5.5], [26.0, 7.0], [31.5, 8.7],
  [33.2, 9.2], [33.2, 9.9], [34.15, 9.9], [34.15, 10.9],
  [34.625, 10.9], [34.625, 14.1], [33.6, 14.5], [30.0, 13.8],
  [25.0, 13.0], [20.0, 12.2], [15.0, 11.1], [10.0, 10.0],
  [6.0, 8.6], [3.0, 6.8], [1.0, 5.1], [0.0, 4.0],
]
for (const sx of [-1, 1]) {
  addExtrude(backLegProfile, 1, [sx * 11.0, 7.25, 0], [0, 90 * DEG, 0], WOOD[sx < 0 ? 3 : 4])
}

// A - front leg, 1 x 5-1/2 x 20-3/8 in. Fig. 3 uses a tapered side with the
// characteristic 1 in step 7-1/4 in above the bottom.
const frontLegProfile = [
  [-3.25, 0], [-0.25, 0], [-0.25, 7.25], [0.75, 7.25],
  [2.25, 20.375], [-2.25, 20.375],
]
for (const sx of [-1, 1]) {
  addExtrude(frontLegProfile, 1, [sx * 11.0, 10.1875, -11.75], [0, 90 * DEG, 0], WOOD[sx < 0 ? 0 : 1])
}

// D - arm, 3/4 x 5 x 30-3/8 in. This is the plan's top-view outline: narrow
// at the rear, widening along the curved inner edge, with a 2-1/2 in radius nose.
const rightArmProfile = [
  [2.5, 0.0],
  [2.5, 27.875],
  ...arcPoints(0, 27.875, 2.5, 0, Math.PI, 8).slice(1),
  [-2.35, 25.0], [-2.1, 21.0], [-1.75, 17.0], [-1.35, 13.0],
  [-0.85, 9.0], [-0.25, 5.0], [0.30, 2.0], [0.50, 0.75],
  [1.20, 0.10],
]
addExtrude(rightArmProfile, 0.75, [12.5, 20.0, -1.8125], [-90 * DEG, 0, 0], WOOD[1])
addExtrude(mirrorX(rightArmProfile), 0.75, [-12.5, 20.0, -1.8125], [-90 * DEG, 0, 0], WOOD[2])

// C - stretcher, 1 x 4-1/2 x 19-3/4 in.
const backAngle = 18 * DEG
addBox([19.75, 4.5, 1], [0, 8.0, 8.1], DARK, [backAngle, 0, 0])

// J - back rail, 3/4 x 3-3/8 x 23 in, following the back plane.
addBox([23, 3.375, 0.75], [0, 18.1, 11.2], WOOD[4], [backAngle, 0, 0])

// -----------------------------------------------------------------------------
// H - eight 3/4 x 3 x 21 in seat slats, exactly as the cut list specifies.
// They run left/right across the chair and are spaced 1/8 in front-to-back.
// -----------------------------------------------------------------------------
const seatCount = 8
const seatStep = 3.125
const seatFrontCenterZ = -14.5
const seatRearCenterZ = seatFrontCenterZ + (seatCount - 1) * seatStep
const seatFrontY = 14.5
const seatRearY = 11.0
const seatAngle = Math.atan2(seatFrontY - seatRearY, seatRearCenterZ - seatFrontCenterZ)
for (let i = 0; i < seatCount; i++) {
  const t = i / (seatCount - 1)
  const z = seatFrontCenterZ + i * seatStep
  const y = seatFrontY + (seatRearY - seatFrontY) * t
  addBox([21, 0.75, 3], [0, y, z], WOOD[(i + 1) % WOOD.length], [seatAngle, 0, 0])
}

// -----------------------------------------------------------------------------
// E/F/G - five back slats from Fig. 2, including the different curved crowns.
// The slats follow the plan's 4-1/4 + 4 + 4 + 4 + 4-1/4 in layout with 1/8 in gaps.
// -----------------------------------------------------------------------------
function centerSlatProfile() {
  const p = [[-2, 0], [-2, 31.657]]
  for (let i = 0; i <= 6; i++) {
    const x = -2 + (4 * i / 6)
    const y = 26 + Math.sqrt(Math.max(0, 36 - x * x))
    p.push([x, y])
  }
  p.push([2, 0])
  return p
}

const fLeft = [
  [-2, 0], [-2, 30.15], [-1.7, 30.45], [-1.2, 30.85], [-0.6, 31.25],
  [0.0, 31.55], [0.8, 31.82], [1.45, 31.97], [2, 32], [2, 0],
]
const gLeft = [
  [-2.125, 0], [-2.125, 21.5], [-1.95, 22.7], [-1.55, 23.9], [-0.9, 24.9],
  [-0.1, 25.55], [0.8, 25.9], [1.5, 26.0], [2.125, 26.0], [2.125, 0],
]
const eProfile = centerSlatProfile()
const backBottomY = 5.6
const backBottomZ = 7.0

function addBackSlat(profile, height, x, color) {
  const cy = backBottomY + Math.cos(backAngle) * height / 2
  const cz = backBottomZ + Math.sin(backAngle) * height / 2
  addExtrude(profile, 0.75, [x, cy, cz], [backAngle, 0, 0], color)
}

addBackSlat(gLeft, 26, -8.375, WOOD[4])
addBackSlat(fLeft, 32, -4.125, WOOD[1])
addBackSlat(eProfile, 32, 0, WOOD[2])
addBackSlat(mirrorX(fLeft), 32, 4.125, WOOD[0])
addBackSlat(mirrorX(gLeft), 26, 8.375, WOOD[5])

// Small dowel/screw-plug details at the two arms, matching the visible plugged joinery.
for (const sx of [-1, 1]) {
  for (const z of [-12.5, 10.8]) {
    const plug = app.create('prim', {
      type: 'cylinder',
      size: [m(0.19), m(0.19), m(0.12)],
      position: pos(sx * 12.5, 20.42, z),
      color: '#4f3d2e',
      roughness: 1,
      metalness: 0,
      physics: null,
    })
    app.add(plug)
  }
}

// Sparse, slightly darker wear strips keep the old-wood finish without changing part geometry.
for (let i = 0; i < 4; i++) {
  addBox([18.5, 0.05, 0.18], [0, 14.92 - i * 0.48, -13.5 + i * 5.8], '#4f3d2e', [seatAngle, 0, 0], {
    opacity: 0.18,
    castShadow: false,
    receiveShadow: false,
  })
}

// -----------------------------------------------------------------------------
// Physics: a compact structural approximation rather than one collider per board.
// -----------------------------------------------------------------------------
addCollider([21.8, 1.2, 24.9], [0, 12.75, -3.56], [seatAngle, 0, 0])
const backColliderHeight = 29
addCollider(
  [21.5, backColliderHeight, 1.3],
  [0, backBottomY + Math.cos(backAngle) * backColliderHeight / 2, backBottomZ + Math.sin(backAngle) * backColliderHeight / 2],
  [backAngle, 0, 0]
)
for (const sx of [-1, 1]) {
  addCollider([1.2, 19.5, 5.0], [sx * 11.0, 9.75, -11.75])
  addCollider([4.6, 1.1, 29.5], [sx * 12.5, 20.0, -1.8])
}

// One stable sitting place. Back is +Z, so rotation 0 faces outward toward -Z.
const anchor = app.create('anchor', { id: 'adirondack-seat-0' })
anchor.position.set(0, groundY + m(14.0), m(-1.5))
anchor.rotation.y = 0
app.add(anchor)

const action = app.create('action', {
  label: 'Sit',
  distance: 2.6,
  duration: 0.25,
})
action.position.set(0, groundY + m(19.0), m(-18.0))
app.add(action)

const EXIT_LOCAL = [0, groundY + m(1.5), m(-21.0)]
function localToWorld(local) {
  return app.position.clone().set(local[0], local[1], local[2]).multiply(app.scale).applyQuaternion(app.quaternion).add(app.position)
}

if (world.isServer && app.state && app.send) {
  if (app.state.occupant === undefined) app.state.occupant = null

  app.on('requestSeat', playerId => {
    if (!playerId) return
    if (!app.state.occupant) {
      app.state.occupant = playerId
      app.send('seatState', { occupant: playerId })
    } else if (app.state.occupant === playerId) {
      app.send('seatState', { occupant: playerId })
    } else if (app.sendTo) {
      app.sendTo(playerId, 'seatRejected', { seatId: 'adirondack-seat-0' })
    }
  })

  app.on('releaseSeat', playerId => {
    if (app.state.occupant !== playerId) return
    app.state.occupant = null
    app.send('seatState', { occupant: null })
  })

  if (world.on) {
    world.on('leave', event => {
      if (event?.playerId !== app.state.occupant) return
      app.state.occupant = null
      app.send('seatState', { occupant: null })
    })
  }
}

if (world.isClient && world.getPlayer && app.send) {
  const player = world.getPlayer()
  let occupant = app.state?.occupant || null
  let pending = false
  let destroyed = false
  let activeEntry = null

  function refreshAction() {
    action.active = !destroyed && !pending && !activeEntry && !occupant
  }

  function finishSit(entry, releaseSeat, teleportOut) {
    if (activeEntry !== entry) return
    activeEntry = null
    entry.control?.release?.()
    if (releaseSeat && occupant === player.id) app.send('releaseSeat', player.id)
    if (!destroyed && teleportOut && player.teleport) player.teleport(localToWorld(EXIT_LOCAL))
    refreshAction()
  }

  function startSit() {
    if (activeEntry || destroyed) return
    const entry = { control: app.control ? app.control() : null, effect: null }
    activeEntry = entry
    pending = false
    refreshAction()
    entry.effect = player.applyEffect({
      anchor,
      emote: sitEmote,
      cancellable: true,
      onEnd: () => finishSit(entry, true, true),
    })
  }

  action.onTrigger = () => {
    if (destroyed || pending || activeEntry || occupant) return
    pending = true
    refreshAction()
    app.send('requestSeat', player.id)
  }

  app.on('seatState', data => {
    occupant = data?.occupant || null
    pending = false
    if (occupant === player.id) {
      startSit()
    } else if (activeEntry) {
      const entry = activeEntry
      if (entry.effect?.active) entry.effect.cancel()
      else finishSit(entry, false, false)
    }
    refreshAction()
  })

  app.on('seatRejected', () => {
    pending = false
    refreshAction()
  })

  app.on('destroy', () => {
    destroyed = true
    action.active = false
    const entry = activeEntry
    if (!entry) return
    activeEntry = null
    entry.control?.release?.()
    if (occupant === player.id) app.send('releaseSeat', player.id)
    if (entry.effect?.active) entry.effect.cancel()
  })

  refreshAction()
}
