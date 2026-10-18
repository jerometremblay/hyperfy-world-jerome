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

const bike = app.create('group', { id: 'bike-root', position: [0, 0, 0] })
app.add(bike)
const lean = app.create('group', { id: 'bike-lean' })
bike.add(lean)

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

// Rider anchor. The proven seated animation supplies bent legs and forward forearms;
// the handle grips are placed at the corresponding forward hand height.
const seatAnchor = app.create('anchor', {
  id: 'motorcycle-seat',
  position: [0, -0.18, 0.28],
  rotation: [0, 0, 0],
})
lean.add(seatAnchor)

let rideAction = app.create('action', {
  id: 'motorcycle-ride-action',
  label: 'Ride',
  distance: 3,
  duration: 0,
  position: [0, -0.02, 0.22],
  onTrigger: () => requestRide(),
})
lean.add(rideAction)
let actionMounted = true

function hideRideAction() {
  if (!actionMounted) return
  lean.remove(rideAction)
  actionMounted = false
}
function showRideAction() {
  if (actionMounted) return
  lean.add(rideAction)
  actionMounted = true
}

let localRiding = false
let pendingClaim = false
let effect = null
let control = null
let exitArmed = false
let speed = 0
let wheelSpin = 0
let steerVisual = 0
let sendAccumulator = 0
const MAX_SPEED = 18
const MAX_REVERSE = 4.5
const WHEEL_RADIUS = 0.60

function applyBikeState(state) {
  if (!state) return
  if (typeof state.x === 'number') bike.position.x = state.x
  if (typeof state.z === 'number') bike.position.z = state.z
  if (typeof state.yaw === 'number') bike.rotation.y = state.yaw
  if (typeof state.spin === 'number') {
    wheelSpin = state.spin
    rearWheel.rotation.x = wheelSpin
    frontWheel.rotation.x = wheelSpin
  }
  if (typeof state.steer === 'number') {
    steerVisual = state.steer
    frontSteer.rotation.y = steerVisual
  }
  if (typeof state.lean === 'number') lean.rotation.z = state.lean
}

if (app.state && app.state.bike) applyBikeState(app.state.bike)

function requestRide() {
  if (!world.isClient || localRiding || pendingClaim || typeof world.getPlayer !== 'function') return
  pendingClaim = true
  app.send('bike:claim', {})
}

function beginRide() {
  if (localRiding || typeof world.getPlayer !== 'function' || typeof app.control !== 'function') return
  const player = world.getPlayer()
  if (!player) return

  localRiding = true
  pendingClaim = false
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

  app.on('update', updateRide)
}

function stopRide(cancelEffect) {
  if (!localRiding) return
  localRiding = false
  pendingClaim = false
  app.off('update', updateRide)

  const player = typeof world.getPlayer === 'function' ? world.getPlayer() : null
  const oldEffect = effect
  effect = null
  if (cancelEffect && oldEffect && typeof oldEffect.cancel === 'function') oldEffect.cancel()

  if (control) {
    control.release()
    control = null
  }
  showRideAction()
  speed = 0
  steerVisual = 0
  frontSteer.rotation.y = 0
  lean.rotation.z = 0
  app.send('bike:release', {})

  // Put the rider just to the right of the motorcycle instead of inside its body.
  if (player && player.position && player.quaternion && typeof player.teleport === 'function' && typeof Vector3 !== 'undefined') {
    const exit = player.position.clone()
    const side = new Vector3(0.95, 0.08, 0).applyQuaternion(player.quaternion)
    exit.add(side)
    player.teleport(exit)
  }
}

function updateRide(delta) {
  if (!localRiding || !control) return
  const dt = Math.min(delta, 0.05)
  const throttle = (control.keyW && control.keyW.down ? 1 : 0) - (control.keyS && control.keyS.down ? 1 : 0)
  const steer = (control.keyA && control.keyA.down ? 1 : 0) - (control.keyD && control.keyD.down ? 1 : 0)

  if (throttle > 0) speed += 12.5 * dt
  else if (throttle < 0) speed -= 15 * dt
  else speed *= Math.max(0, 1 - 1.8 * dt)
  if (speed > MAX_SPEED) speed = MAX_SPEED
  if (speed < -MAX_REVERSE) speed = -MAX_REVERSE
  if (Math.abs(speed) < 0.015 && throttle === 0) speed = 0

  const speedRatio = Math.min(1, Math.abs(speed) / MAX_SPEED)
  const turnRate = (0.38 + speedRatio * 1.25) * (speed >= 0 ? 1 : -1)
  bike.rotation.y += steer * turnRate * dt

  const yaw = bike.rotation.y
  bike.position.x += -Math.sin(yaw) * speed * dt
  bike.position.z += -Math.cos(yaw) * speed * dt

  wheelSpin -= speed * dt / WHEEL_RADIUS
  rearWheel.rotation.x = wheelSpin
  frontWheel.rotation.x = wheelSpin

  const targetSteer = steer * 0.42
  steerVisual += (targetSteer - steerVisual) * Math.min(1, 9 * dt)
  frontSteer.rotation.y = steerVisual
  const targetLean = steer * speedRatio * 0.18
  lean.rotation.z += (targetLean - lean.rotation.z) * Math.min(1, 6 * dt)

  sendAccumulator += dt
  if (sendAccumulator >= 0.08) {
    sendAccumulator = 0
    app.send('bike:state', {
      x: bike.position.x,
      z: bike.position.z,
      yaw: bike.rotation.y,
      spin: wheelSpin,
      steer: steerVisual,
      lean: lean.rotation.z,
    })
  }
}

if (world.isServer) {
  if (!app.state.bike) app.state.bike = { x: 0, z: 0, yaw: 0, spin: 0, steer: 0, lean: 0 }
  let driverNetworkId = null
  let driverSilence = 0

  app.on('bike:claim', (data, networkId) => {
    const accepted = !driverNetworkId || driverNetworkId === networkId
    if (accepted) {
      driverNetworkId = networkId
      driverSilence = 0
    }
    app.send('bike:claimResult', { networkId, accepted })
  })

  app.on('bike:state', (state, networkId) => {
    if (!driverNetworkId || networkId !== driverNetworkId || !state) return
    driverSilence = 0
    app.state.bike = state
    app.send('bike:state', state, networkId)
  })

  app.on('bike:release', (data, networkId) => {
    if (networkId !== driverNetworkId) return
    driverNetworkId = null
    driverSilence = 0
    app.send('bike:released', {})
  })

  const leaseUpdate = delta => {
    if (!driverNetworkId) return
    driverSilence += delta
    if (driverSilence > 3) {
      driverNetworkId = null
      driverSilence = 0
      app.send('bike:released', {})
    }
  }
  app.on('update', leaseUpdate)
}

if (world.isClient) {
  app.on('bike:claimResult', result => {
    if (!result || result.networkId !== world.networkId) return
    pendingClaim = false
    if (result.accepted) beginRide()
  })
  app.on('bike:state', state => {
    if (!localRiding) applyBikeState(state)
  })
}

app.on('destroy', () => {
  if (localRiding) stopRide(true)
})
