// Futuristic rideable motorcycle for Hyperfy v0.16.
// Local coordinates: +Y up, +X right, -Z forward. App origin is the prompt-box center.

const RIDER_EMOTE = props.riderPose && props.riderPose.url
  ? props.riderPose.url
  : 'asset://88506687fb069c946049e1ba6f1bac97f52b01851ad83dca7f2516d9d7e44f74.glb'

const COLORS = {
  carbon: '#11151b',
  graphite: '#202a33',
  metal: '#56616c',
  darkMetal: '#303942',
  tire: '#090b0d',
  hub: '#7f8b95',
  cyan: '#38e8ff',
  cyanDark: '#0e7080',
  red: '#ff314d',
  glass: '#6ad8e8',
}

function prim(parent, type, size, position, color, rotation = [0, 0, 0], extra = {}) {
  const node = app.create('prim', {
    type,
    size,
    position,
    rotation,
    color,
    roughness: extra.roughness === undefined ? 0.35 : extra.roughness,
    metalness: extra.metalness === undefined ? 0.45 : extra.metalness,
    castShadow: true,
    receiveShadow: true,
    physics: null,
    ...extra,
  })
  parent.add(node)
  return node
}

function box(parent, size, position, color, rotation = [0, 0, 0], extra = {}) {
  return prim(parent, 'box', size, position, color, rotation, extra)
}

function cylinder(parent, radius, height, position, color, rotation = [0, 0, 0], extra = {}) {
  return prim(parent, 'cylinder', [radius, radius, height], position, color, rotation, extra)
}

function sphere(parent, radius, position, color, scale = [1, 1, 1], extra = {}) {
  return prim(parent, 'sphere', [radius], position, color, [0, 0, 0], { scale, ...extra })
}

function makeWheel(parent, id, position) {
  const spin = app.create('group', { id, position })
  parent.add(spin)

  prim(spin, 'torus', [0.49, 0.11], [0, 0, 0], COLORS.tire, [0, Math.PI / 2, 0], {
    roughness: 0.72,
    metalness: 0.02,
  })
  cylinder(spin, 0.22, 0.18, [0, 0, 0], COLORS.hub, [0, 0, Math.PI / 2], {
    roughness: 0.26,
    metalness: 0.85,
  })
  cylinder(spin, 0.075, 0.25, [0, 0, 0], COLORS.cyanDark, [0, 0, Math.PI / 2], {
    emissive: COLORS.cyan,
    emissiveIntensity: 1.3,
  })
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3
    const y = Math.cos(a) * 0.31
    const z = Math.sin(a) * 0.31
    box(spin, [0.035, 0.38, 0.035], [0, y * 0.5, z * 0.5], COLORS.darkMetal, [a, 0, 0], {
      roughness: 0.3,
      metalness: 0.8,
    })
  }
  return spin
}

// Server-authoritative physics body. The server simulates a dynamic rigidbody;
// clients follow it as a kinematic body so every rider sees the same collision result.
// Hyperfy grab mode places the app origin directly on the target surface.
// Rebase the complete physical motorcycle so Y=0 is the tire contact plane,
// exactly like the corrected coffee mug whose app origin is its physical base.
const PLACEMENT_BOTTOM_Y = -1.64
const PLACEMENT_TOP_Y = 0.48
const PLACEMENT_HEIGHT = PLACEMENT_TOP_Y - PLACEMENT_BOTTOM_Y

const body = app.create('rigidbody', {
  id: 'motorcycle-physics-body',
  position: [0, -PLACEMENT_BOTTOM_Y, 0],
  type: world.isServer ? 'dynamic' : 'kinematic',
  mass: 190,
  linearDamping: 0.16,
  angularDamping: 2.4,
  tag: 'motorcycle',
})

// A compact collision envelope covers the wheels, chassis and cockpit. It is a
// real physics collider, not a visual/raycast approximation, so walls and props
// stop the motorcycle instead of allowing scripted translation through them.
const chassisCollider = app.create('collider', {
  id: 'motorcycle-collider',
  type: 'box',
  width: 1.08,
  height: 2.08,
  depth: 3.56,
  position: [0, -0.60, -0.02],
  layer: 'prop',
  staticFriction: 0.92,
  dynamicFriction: 0.82,
  restitution: 0.02,
})
body.add(chassisCollider)
if (typeof body.setCenterOfMass === 'function' && typeof Vector3 !== 'undefined') {
  body.setCenterOfMass(new Vector3(0, -1.05, 0))
}
app.add(body)

const bike = app.create('group', { id: 'bike-root', position: [0, 0, 0] })
body.add(bike)
// Bank around the rider seat instead of the prompt-box origin. This keeps the
// anchored rider/camera from tracing a lateral arc while the bike leans.
const leanPivot = app.create('group', { id: 'bike-lean-pivot', position: [0, -0.18, 0.28] })
bike.add(leanPivot)
const lean = app.create('group', { id: 'bike-lean', position: [0, 0.18, -0.28] })
leanPivot.add(lean)

const rearWheel = makeWheel(lean, 'rear-wheel-spin', [0, -1.04, 1.20])
const frontSteer = app.create('group', { id: 'front-steer', position: [0, -1.04, -1.24] })
lean.add(frontSteer)
const frontWheel = makeWheel(frontSteer, 'front-wheel-spin', [0, 0, 0])

// Main monocoque and power unit.
box(lean, [0.42, 0.30, 1.72], [0, -0.74, 0.05], COLORS.carbon, [-0.04, 0, 0], { roughness: 0.3, metalness: 0.7 })
box(lean, [0.58, 0.34, 0.88], [0, -0.55, -0.34], COLORS.graphite, [-0.16, 0, 0], { roughness: 0.26, metalness: 0.68 })
box(lean, [0.46, 0.25, 0.82], [0, -0.55, 0.63], COLORS.graphite, [0.12, 0, 0], { roughness: 0.29, metalness: 0.6 })
sphere(lean, 0.39, [0, -0.54, -0.24], COLORS.graphite, [1.0, 0.62, 1.42], { roughness: 0.25, metalness: 0.72 })

// Angular side fairings.
for (const side of [-1, 1]) {
  box(lean, [0.12, 0.55, 1.30], [side * 0.31, -0.53, -0.05], COLORS.carbon, [-0.13, 0, side * -0.10], { roughness: 0.24, metalness: 0.72 })
  box(lean, [0.045, 0.08, 1.02], [side * 0.375, -0.48, -0.11], COLORS.cyan, [-0.08, 0, 0], {
    roughness: 0.16,
    metalness: 0.25,
    emissive: COLORS.cyan,
    emissiveIntensity: 2.8,
  })
  box(lean, [0.055, 0.10, 0.55], [side * 0.34, -0.76, 0.66], COLORS.cyanDark, [0.13, 0, 0], {
    emissive: COLORS.cyan,
    emissiveIntensity: 1.6,
  })
}

// Rear swing arm and frame spars.
for (const side of [-1, 1]) {
  box(lean, [0.07, 0.10, 1.18], [side * 0.22, -0.93, 0.62], COLORS.metal, [-0.18, 0, 0], { metalness: 0.9, roughness: 0.22 })
  box(lean, [0.065, 1.04, 0.065], [side * 0.23, -0.62, -0.94], COLORS.metal, [0.58, 0, 0], { metalness: 0.9, roughness: 0.2 })
}

// Front fork follows steering.
for (const side of [-1, 1]) {
  box(frontSteer, [0.065, 1.05, 0.065], [side * 0.19, 0.43, 0.29], COLORS.hub, [0.58, 0, 0], { metalness: 0.92, roughness: 0.18 })
}

// Seat, tail and rider contact geometry.
box(lean, [0.56, 0.14, 0.76], [0, -0.28, 0.34], '#182128', [-0.08, 0, 0], { roughness: 0.78, metalness: 0.05 })
box(lean, [0.38, 0.15, 0.58], [0, -0.20, 0.80], COLORS.carbon, [0.13, 0, 0], { roughness: 0.3, metalness: 0.6 })
box(lean, [0.28, 0.08, 0.26], [0, -0.17, 1.12], COLORS.red, [0.08, 0, 0], {
  emissive: COLORS.red,
  emissiveIntensity: 3.5,
  roughness: 0.18,
  metalness: 0.18,
})

// Cockpit, bars and transparent windscreen.
box(lean, [0.78, 0.055, 0.055], [0, 0.15, -0.67], COLORS.metal, [0, 0, 0], { metalness: 0.9, roughness: 0.2 })
for (const side of [-1, 1]) {
  cylinder(lean, 0.055, 0.24, [side * 0.44, 0.15, -0.67], COLORS.tire, [0, 0, Math.PI / 2], { roughness: 0.75, metalness: 0.05 })
  cylinder(lean, 0.035, 0.34, [side * 0.23, 0.04, -0.59], COLORS.hub, [0.28, 0, side * 0.52], { metalness: 0.86, roughness: 0.22 })
}
box(lean, [0.68, 0.42, 0.045], [0, 0.27, -0.82], COLORS.glass, [-0.25, 0, 0], {
  opacity: 0.26,
  roughness: 0.08,
  metalness: 0.05,
  doubleside: true,
})
box(lean, [0.46, 0.10, 0.08], [0, -0.05, -0.98], COLORS.cyan, [-0.12, 0, 0], {
  emissive: COLORS.cyan,
  emissiveIntensity: 4.2,
  roughness: 0.1,
  metalness: 0.2,
})

// Foot pegs positioned for the seated pose.
for (const side of [-1, 1]) {
  cylinder(lean, 0.045, 0.30, [side * 0.29, -0.93, -0.02], COLORS.hub, [0, 0, Math.PI / 2], { metalness: 0.88, roughness: 0.24 })
}

// Coffee-mug-style bounds helper. After the body rebase, visible geometry spans
// app-space Y=0..PLACEMENT_HEIGHT. This narrow invisible probe spans the matching
// negative range -PLACEMENT_HEIGHT..0, so bounds-centered tools also resolve Y=0.
prim(body, 'box', [0.018, PLACEMENT_HEIGHT, 0.018],
  [0, PLACEMENT_BOTTOM_Y - PLACEMENT_HEIGHT / 2, 0], COLORS.carbon, [0, 0, 0], {
    opacity: 0,
    castShadow: false,
    receiveShadow: false,
  })

// Rider anchor. The proven seated animation supplies bent legs and forward forearms;
// the handle grips are placed at the corresponding forward hand height.
const seatAnchor = app.create('anchor', {
  id: 'motorcycle-seat',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
})
leanPivot.add(seatAnchor)

let rideAction = app.create('action', {
  id: 'motorcycle-ride-action',
  label: 'Ride',
  distance: 3,
  // Short hold: fast enough to feel immediate while remaining valid for Hyperfy's action renderer.
  duration: 0.25,
  position: [0, 0.16, -0.06],
  onTrigger: ({ playerId } = {}) => requestRide(playerId),
})
leanPivot.add(rideAction)
let actionMounted = true

function hideRideAction() {
  if (!actionMounted) return
  leanPivot.remove(rideAction)
  actionMounted = false
}
function showRideAction() {
  if (actionMounted) return
  leanPivot.add(rideAction)
  actionMounted = true
}

let localRiding = false
let pendingClaim = null
let claimToken = 0
let claimTimeout = null
let effect = null
let control = null
let exitArmed = false
let inputAccumulator = 0
let lastThrottle = 99
let lastSteer = 99
let wheelSpin = 0
let steerVisual = 0
let leanAngle = 0
const MAX_SPEED = 16
const MAX_REVERSE = 4.5
const WHEEL_RADIUS = 0.60

function applyBikeState(state) {
  if (!state) return

  // Physics state is world-space. Kinematic targets let PhysX interpolate the
  // remote/server motion instead of snapping nested visual transforms each frame.
  if (
    typeof state.px === 'number' &&
    typeof body.setKinematicTarget === 'function' &&
    typeof Vector3 !== 'undefined' &&
    typeof Quaternion !== 'undefined'
  ) {
    body.setKinematicTarget(
      new Vector3(state.px, state.py, state.pz),
      new Quaternion(state.qx, state.qy, state.qz, state.qw)
    )
  }

  if (typeof state.spin === 'number') {
    wheelSpin = state.spin
    rearWheel.rotation.x = wheelSpin
    frontWheel.rotation.x = wheelSpin
  }
  if (typeof state.steer === 'number') {
    steerVisual = state.steer
    frontSteer.rotation.y = steerVisual
  }
  if (typeof state.lean === 'number') {
    leanAngle = state.lean
    leanPivot.rotation.z = leanAngle
  }
}

if (app.state && app.state.bike) applyBikeState(app.state.bike)

function requestRide(triggerPlayerId) {
  if (!world.isClient || localRiding || pendingClaim || typeof world.getPlayer !== 'function') return
  const player = world.getPlayer()
  if (!player) return
  if (triggerPlayerId && triggerPlayerId !== player.id) return

  const token = ++claimToken
  pendingClaim = { token, playerId: player.id }

  // Seat locally as soon as the action completes. The server claim runs in parallel
  // and remains authoritative for driving/occupancy. A rejection cancels the local ride.
  beginRide()
  if (!localRiding) {
    pendingClaim = null
    return
  }
  app.send('bike:claim', { token, playerId: player.id })

  // If ownership cannot be confirmed, cancel rather than leaving a seated but undriveable rider.
  if (claimTimeout) clearTimeout(claimTimeout)
  claimTimeout = setTimeout(() => {
    if (pendingClaim && pendingClaim.token === token) {
      pendingClaim = null
      if (localRiding) stopRide(true)
    }
    claimTimeout = null
  }, 3000)
}

function beginRide() {
  if (localRiding || typeof world.getPlayer !== 'function' || typeof app.control !== 'function') return
  const player = world.getPlayer()
  if (!player) return

  localRiding = true
  hideRideAction()
  control = app.control()
  for (const button of [control.keyW, control.keyA, control.keyS, control.keyD, control.keyE, control.space]) {
    if (button) button.capture = true
  }
  exitArmed = false
  if (control.keyE) {
    control.keyE.onRelease = () => { exitArmed = true }
    control.keyE.onPress = () => { if (exitArmed) stopRide(true) }
  }
  if (control.space) control.space.onPress = () => stopRide(true)

  effect = player.applyEffect({
    anchor: seatAnchor,
    emote: RIDER_EMOTE,
    freeze: true,
    cancellable: false,
    onEnd: () => stopRide(false),
  })

  inputAccumulator = 1
  lastThrottle = 99
  lastSteer = 99
  app.on('update', updateRideInput)
}

function stopRide(cancelEffect) {
  if (!localRiding) return
  localRiding = false
  pendingClaim = null
  app.off('update', updateRideInput)

  const player = typeof world.getPlayer === 'function' ? world.getPlayer() : null
  const oldEffect = effect
  effect = null
  if (cancelEffect && oldEffect && typeof oldEffect.cancel === 'function') oldEffect.cancel()

  if (control) {
    control.release()
    control = null
  }
  showRideAction()
  app.send('bike:input', { throttle: 0, steer: 0 })
  app.send('bike:release', {})

  // Put the rider to the motorcycle's right side after dismounting.
  if (player && player.position && player.quaternion && typeof player.teleport === 'function' && typeof Vector3 !== 'undefined') {
    const exit = player.position.clone()
    const side = new Vector3(0.95, 0.08, 0).applyQuaternion(player.quaternion)
    exit.add(side)
    player.teleport(exit)
  }
}

function updateRideInput(delta) {
  if (!localRiding || !control) return
  const throttle = (control.keyW && control.keyW.down ? 1 : 0) - (control.keyS && control.keyS.down ? 1 : 0)
  const steer = (control.keyA && control.keyA.down ? 1 : 0) - (control.keyD && control.keyD.down ? 1 : 0)
  inputAccumulator += Math.min(delta, 0.05)
  if (inputAccumulator >= 0.05 || throttle !== lastThrottle || steer !== lastSteer) {
    inputAccumulator = 0
    lastThrottle = throttle
    lastSteer = steer
    app.send('bike:input', { throttle, steer })
  }
}

if (world.isServer) {
  let driverNetworkId = null
  let driverPlayerId = null
  const identifyPlayer = networkId => world.getPlayers().find(player => player.networkId === networkId)
  let driverSilence = 0
  let driverInput = { throttle: 0, steer: 0 }
  let stateAccumulator = 0
  let serverWheelSpin = 0
  let serverSteerVisual = 0
  let serverLean = 0

  app.on('bike:claim', (data, networkId) => {
    if (!data || typeof data.token !== 'number') return
    const player = identifyPlayer(networkId)
    const claimedPlayerId = typeof data.playerId === 'string' ? data.playerId : null
    if (player && claimedPlayerId && player.id !== claimedPlayerId) return
    const playerId = player ? player.id : claimedPlayerId
    if (!playerId) return

    const accepted = !driverNetworkId || driverNetworkId === networkId
    if (accepted) {
      driverNetworkId = networkId
      driverPlayerId = playerId
      driverSilence = 0
      driverInput = { throttle: 0, steer: 0 }
    }
    // Socket identity remains authoritative for controls; playerId is echoed so only
    // the triggering client consumes this broadcast claim result.
    app.send('bike:claimResult', { playerId, token: data.token, accepted })
  })

  app.on('bike:input', (input, networkId) => {
    if (!driverNetworkId || networkId !== driverNetworkId || !input) return
    driverSilence = 0
    driverInput = {
      throttle: Math.max(-1, Math.min(1, Number(input.throttle) || 0)),
      steer: Math.max(-1, Math.min(1, Number(input.steer) || 0)),
    }
  })

  app.on('bike:release', (data, networkId) => {
    if (networkId !== driverNetworkId) return
    driverNetworkId = null
    driverPlayerId = null
    driverSilence = 0
    driverInput = { throttle: 0, steer: 0 }
    app.send('bike:released', {})
  })

  app.on('fixedUpdate', delta => {
    if (
      typeof Vector3 === 'undefined' ||
      typeof body.getLinearVelocity !== 'function' ||
      typeof body.getQuaternion !== 'function'
    ) return

    const dt = Math.min(delta, 0.05)
    const velocity = body.getLinearVelocity(new Vector3())
    const quaternion = body.getQuaternion()
    const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion)
    forward.y = 0
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1)
    else forward.normalize()
    const right = new Vector3(1, 0, 0).applyQuaternion(quaternion)
    right.y = 0
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0)
    else right.normalize()

    let forwardSpeed = velocity.dot(forward)
    let lateralSpeed = velocity.dot(right)
    const throttle = driverNetworkId ? driverInput.throttle : 0
    const steer = driverNetworkId ? driverInput.steer : 0

    if (throttle > 0) forwardSpeed += 11.5 * dt
    else if (throttle < 0) forwardSpeed -= 13.5 * dt
    else forwardSpeed *= Math.exp(-1.45 * dt)
    forwardSpeed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, forwardSpeed))

    // Motorcycle tire grip: strongly shed sideways velocity, while preserving
    // vertical velocity so gravity, bumps and collision responses remain physical.
    lateralSpeed *= Math.exp(-9.5 * dt)
    const driveVelocity = forward.clone().multiplyScalar(forwardSpeed)
    driveVelocity.add(right.clone().multiplyScalar(lateralSpeed))
    driveVelocity.y = velocity.y
    body.setLinearVelocity(driveVelocity)

    const speedRatio = Math.min(1, Math.abs(forwardSpeed) / MAX_SPEED)
    const direction = forwardSpeed < -0.05 ? -1 : 1
    const yawRate = steer * direction * (0.32 + speedRatio * 1.18)
    // Hyperfy v0.16 RigidBody proxy bug: getAngularVelocity(vec3) does not
    // return the vector. Reading angular.x crashes the server physics loop.
    // Keep the known-working Ride/control lifecycle and set yaw directly.
    body.setAngularVelocity(new Vector3(0, yawRate, 0))

    // Low-COM upright stabilization keeps the physical chassis controllable
    // without replacing collision response with manual transforms.
    if (typeof body.addTorque === 'function') {
      const up = new Vector3(0, 1, 0).applyQuaternion(quaternion)
      const correction = new Vector3().crossVectors(up, new Vector3(0, 1, 0)).multiplyScalar(18)
      body.addTorque(correction, 'acceleration')
    }

    serverWheelSpin -= forwardSpeed * dt / WHEEL_RADIUS
    const targetSteer = steer * 0.42
    serverSteerVisual += (targetSteer - serverSteerVisual) * (1 - Math.exp(-9 * dt))
    const steerForLean = serverSteerVisual / 0.42
    const targetLean = steerForLean * direction * speedRatio * 0.18
    serverLean += (targetLean - serverLean) * (1 - Math.exp(-5 * dt))

    if (driverNetworkId) {
      driverSilence += dt
      if (driverSilence > 3) {
        driverNetworkId = null
        driverPlayerId = null
        driverSilence = 0
        driverInput = { throttle: 0, steer: 0 }
        app.send('bike:released', {})
      }
    }

    stateAccumulator += dt
    if (stateAccumulator >= 0.05 && typeof body.getPosition === 'function') {
      stateAccumulator = 0
      const p = body.getPosition(new Vector3())
      const q = body.getQuaternion()
      const state = {
        px: p.x, py: p.y, pz: p.z,
        qx: q.x, qy: q.y, qz: q.z, qw: q.w,
        spin: serverWheelSpin,
        steer: serverSteerVisual,
        lean: serverLean,
        speed: forwardSpeed,
      }
      app.state.bike = state
      app.send('bike:state', state)
    }
  })
}

if (world.isClient) {
  app.on('bike:claimResult', result => {
    if (!result || typeof world.getPlayer !== 'function') return
    const player = world.getPlayer()
    if (!player || result.playerId !== player.id) return
    if (!pendingClaim || result.token !== pendingClaim.token) return
    pendingClaim = null
    if (claimTimeout) { clearTimeout(claimTimeout); claimTimeout = null }
    if (!result.accepted && localRiding) stopRide(true)
  })
  app.on('bike:state', state => {
    applyBikeState(state)
  })
  app.on('bike:released', () => {
    if (!localRiding) showRideAction()
  })
}

app.on('destroy', () => {
  if (claimTimeout) clearTimeout(claimTimeout)
  claimTimeout = null
  pendingClaim = null
  if (localRiding) stopRide(true)
})
