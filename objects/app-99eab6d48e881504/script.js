// Wall-mounted four-cue pool rack — +Y up, +X right, -Z forward.
// The prompt-box +Z direction points INTO the room at this wall.
// Each cue is 1.47 m long; rack and cues are in box-local meters.
// Cue ownership is server-authoritative. Press E/click a cue to take it,
// X on desktop (or left controller X in VR) to return it to its slot.

const FINISH = {
  mahogany: '#5a3022',
  walnut: '#342019',
  edges: '#b58249',
  brass: '#ba9456',
  darkBrass: '#5b4932',
  felt: '#183b30',
  rubber: '#18191c',
  ivory: '#efddbb',
  shaft: '#e8c78c',
}
const X_POS = [-0.186, -0.062, 0.062, 0.186]
const CUE_Y = -0.236
const CUE_Z = 0.170
const CUE_LENGTH = 1.47
const HOLD_TILT = -Math.PI * 0.44
const CUE_EVENT = 'billard:cues'
const POSE_EVENT = 'billard:cue-pose'
const aimPoses = new Map()
app.resetOnMove = false
const AIM_DATA_EVENT = 'billard:aim-data'
// Lunettes d'aide, touche V (vision) : lignes de projection vues seulement par le joueur qui tient la queue.
const GLASSES_OBJECT_LENGTH = 0.8   // m de ligne bille visée pour un contact plein
const GLASSES_TANGENT_LENGTH = 0.6  // m de ligne tangente pour un contact à 90°
const GLASSES_BOUNCES = 2           // rebonds de bande montrés avant le premier contact
let glassesOn = false
const glass = { nodes: [], path: [] }  // remplis côté client
const hideGlasses = () => { for (const n of glass.nodes) n.active = false }
// shortcut: géométrie pure (ghost-ball), sans effet/spin, friction de bande ni throw ; upgrader = rejouer la simulation de la table
function predictShot(cue, targets, angle, size, radius, bounces = GLASSES_BOUNCES) {
  const D = 2 * radius
  const hx = size.length / 2 - radius, hy = size.width / 2 - radius
  let p = [cue[0], cue[1]]
  const d = [Math.cos(angle), Math.sin(angle)]
  const out = { pts: [p], ghost: null, obj: null, tan: null }
  for (let i = 0; i <= bounces; i++) {
    const tx = d[0] > 1e-9 ? (hx - p[0]) / d[0] : d[0] < -1e-9 ? (-hx - p[0]) / d[0] : Infinity
    const ty = d[1] > 1e-9 ? (hy - p[1]) / d[1] : d[1] < -1e-9 ? (-hy - p[1]) / d[1] : Infinity
    const tw = Math.max(0, Math.min(tx, ty))
    let tb = Infinity, hit = null
    for (const b of targets) {
      const fx = b[0] - p[0], fy = b[1] - p[1]
      const proj = fx * d[0] + fy * d[1]
      if (proj <= 0) continue
      const perp2 = fx * fx + fy * fy - proj * proj
      if (perp2 >= D * D) continue
      const t = proj - Math.sqrt(D * D - perp2)
      if (t > -1e-3 && t < tb) { tb = Math.max(t, 0); hit = b }
    }
    if (hit && tb <= tw) {
      const g = [p[0] + d[0] * tb, p[1] + d[1] * tb]
      const nx = (hit[0] - g[0]) / D, ny = (hit[1] - g[1]) / D
      const dn = Math.max(0, d[0] * nx + d[1] * ny)
      const px = d[0] - dn * nx, py = d[1] - dn * ny
      out.pts.push(g)
      out.ghost = g
      out.obj = [[hit[0], hit[1]], [hit[0] + nx * GLASSES_OBJECT_LENGTH * dn, hit[1] + ny * GLASSES_OBJECT_LENGTH * dn]]
      if (Math.hypot(px, py) > 0.02) out.tan = [g, [g[0] + px * GLASSES_TANGENT_LENGTH, g[1] + py * GLASSES_TANGENT_LENGTH]]
      return out
    }
    const q = [p[0] + d[0] * tw, p[1] + d[1] * tw]
    out.pts.push(q)
    if (tx <= ty) d[0] = -d[0]
    else d[1] = -d[1]
    p = q
  }
  return out
}
// Les coordonnées de la table (x, y) deviennent (x, rayon, -y) dans le repère de la table.
function seg(node, a, b, radius) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy)
  node.active = len > 1e-4
  if (!node.active) return
  node.position.set((a[0] + b[0]) / 2, radius, -(a[1] + b[1]) / 2)
  node.rotation.y = Math.atan2(dy, dx)
  node.scale.x = len
}
function showGlasses(r, radius) {
  glass.path.forEach((n, i) => r.pts[i + 1] ? seg(n, r.pts[i], r.pts[i + 1], radius) : n.active = false)
  glass.ghost.active = !!r.ghost
  if (r.ghost) glass.ghost.position.set(r.ghost[0], radius, -r.ghost[1])
  r.obj ? seg(glass.obj, r.obj[0], r.obj[1], radius) : glass.obj.active = false
  r.tan ? seg(glass.tan, r.tan[0], r.tan[1], radius) : glass.tan.active = false
}

function piece(parent, type, size, position, color, extra = {}) {
  const n = app.create('prim', {
    type, size, position, color,
    roughness: 0.55, metalness: 0.07,
    castShadow: true, receiveShadow: true,
    physics: null, ...extra,
  })
  parent.add(n)
  return n
}
function box(parent, size, position, color, extra) {
  return piece(parent, 'box', size, position, color, extra)
}
function cyl(parent, top, bottom, len, position, color, extra) {
  return piece(parent, 'cylinder', [top, bottom, len], position, color, extra)
}
function torus(parent, r, tube, position, color, extra) {
  return piece(parent, 'torus', [r, tube], position, color, {
    rotation: [Math.PI / 2, 0, 0], ...extra,
  })
}

// Invisible prims remain raycast targets. Fill the frame's gaps so native
// actions pick the closest available cue even when pointing between slots.
box(app, [0.620, 1.560, 0.200], [0, -0.288, 0.130], FINISH.mahogany, {
  opacity: 0, castShadow: false, receiveShadow: false,
})

// Wall-facing polished hardwood uprights; rear edges sit against the logs.
for (const x of [-0.285, 0.285]) {
  box(app, [0.050, 1.55, 0.064], [x, -0.293, 0.067], FINISH.mahogany)
  box(app, [0.016, 1.54, 0.068], [x, -0.293, 0.103], FINISH.edges)
}
// Horizontal stained mounting rails with chamfer-like brass accent strips.
for (const y of [-1.010, 0.377]) {
  box(app, [0.610, 0.076, 0.074], [0, y, 0.082], FINISH.walnut)
  box(app, [0.596, 0.010, 0.078], [0, y + 0.032, 0.084], FINISH.edges)
  box(app, [0.608, 0.010, 0.018], [0, y - 0.033, 0.124], FINISH.brass,
      { metalness: 0.73, roughness: 0.32 })
}
// The middle stretcher gives the rack a genuinely wall-fixed furniture look.
box(app, [0.56, 0.036, 0.046], [0, -0.20, 0.066], FINISH.mahogany)
for (const x of [-0.266, 0.266]) for (const y of [-1.010, 0.377]) {
  cyl(app, 0.008, 0.008, 0.005, [x, y, 0.128], FINISH.brass,
      { rotation: [Math.PI / 2, 0, 0], metalness: 0.82, roughness: 0.22 })
}

// Individual bottom cups support the butts; upper collars keep cues vertical.
for (const x of X_POS) {
  const z = CUE_Z
  box(app, [0.080, 0.042, 0.128], [x, -1.027, 0.129], FINISH.mahogany)
  cyl(app, 0.032, 0.032, 0.017, [x, -0.993, z], FINISH.felt,
      { roughness: 0.95 })
  torus(app, 0.032, 0.008, [x, -0.985, z], FINISH.brass,
        { metalness: 0.77, roughness: 0.29 })
  box(app, [0.070, 0.055, 0.060], [x, 0.303, 0.125], FINISH.mahogany)
  torus(app, 0.028, 0.007, [x, 0.303, z], FINISH.darkBrass,
        { metalness: 0.72, roughness: 0.30 })
  box(app, [0.010, 0.028, 0.036], [x + 0.036, 0.303, 0.150], FINISH.brass,
      { metalness: 0.72, roughness: 0.30 })
}

// Four real-length 58-inch cues: turned wood, wrap, tapered ash/maple shaft,
// joint rings, ferrule and chalk-blue leather tip. Each gets its own node group.
const cues = []
const slotPositions = []
const buttColors = ['#67402b', '#83492f', '#573c29', '#693f31']
const wrapColors = ['#1b2328', '#49322b', '#243d42', '#352f39']
for (let i = 0; i < 4; i++) {
  const p = [X_POS[i], CUE_Y, CUE_Z]
  const cue = app.create('group', { position: p })
  app.add(cue)
  slotPositions.push(p)
  cues.push(cue)

  // Cue local Y ranges from -0.735 to +0.735 = 1.470 metres.
  cyl(cue, 0.0146, 0.0154, 0.024, [0, -0.723, 0], FINISH.rubber, { roughness: 0.88 })
  cyl(cue, 0.0146, 0.0149, 0.015, [0, -0.704, 0], FINISH.brass,
      { metalness: 0.72, roughness: 0.33 })
  cyl(cue, 0.0140, 0.0148, 0.270, [0, -0.565, 0], wrapColors[i], { roughness: 0.87 })
  // Slim wrap borders and six restrained grip bands.
  for (const y of [-0.699, -0.429]) {
    cyl(cue, 0.0153, 0.0153, 0.009, [0, y, 0], FINISH.brass,
        { metalness: 0.74, roughness: 0.32 })
  }
  for (let j = 0; j < 6; j++) {
    cyl(cue, 0.0142, 0.0142, 0.003, [0, -0.664 + j * 0.041, 0], '#645c4c',
        { metalness: 0.18, roughness: 0.8 })
  }
  cyl(cue, 0.0118, 0.0141, 0.408, [0, -0.224, 0], buttColors[i], { roughness: 0.40 })
  cyl(cue, 0.0112, 0.0118, 0.015, [0, -0.015, 0], FINISH.brass,
      { metalness: 0.82, roughness: 0.22 })
  cyl(cue, 0.0063, 0.0112, 0.680, [0, 0.333, 0], FINISH.shaft, { roughness: 0.44 })
  cyl(cue, 0.0063, 0.0063, 0.036, [0, 0.691, 0], FINISH.ivory, { roughness: 0.45 })
  cyl(cue, 0.0061, 0.0063, 0.026, [0, 0.722, 0], '#32639b', { roughness: 0.88 })
}

const holders = Array.isArray(app.state?.holders) && app.state.holders.length === 4
  ? app.state.holders.slice() : [null, null, null, null]
const attached = [false, false, false, false]
const actions = []
let localControls = null
let localHeld = -1
const rackHolders = new Map()
const heldAnywhere = id => [...rackHolders.values()].some(ids => ids.includes(id))
const publishHolders = () => app.emit(CUE_EVENT, { rackId: app.instanceId, holders: holders.slice() })
const refreshActions = () => {
  const holding = world.isClient && heldAnywhere(world.getPlayer()?.id)
  for (let i = 0; i < actions.length; i++) actions[i].distance = holders[i] || holding ? 0 : 2.8
}
world.on(CUE_EVENT, data => {
  if (!data || typeof data.rackId !== 'string' || !Array.isArray(data.holders)) return
  if (data.holders.length) rackHolders.set(data.rackId, data.holders.filter(id => typeof id === 'string'))
  else rackHolders.delete(data.rackId)
  refreshActions()
})

// Held cues follow hands or table aim poses; returned cues need no frame work.
function updateHeldCues() {
  for (let i = 0; i < 4; i++) {
    if (!attached[i] || !holders[i]) continue
    const player = world.getPlayer(holders[i])
    if (!player) continue
    const pose = aimPoses.get(holders[i])
    if (pose) {
      cues[i].position.fromArray(pose.position)
      cues[i].quaternion.fromArray(pose.quaternion)
      continue
    }
    const handMatrix = player.getBoneTransform?.('rightHand')
    const bodyQuat = player.quaternion
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), HOLD_TILT)
    const cueQuat = bodyQuat.clone().multiply(tilt)
    let handPos
    if (handMatrix) {
      handPos = new Vector3().setFromMatrixPosition(handMatrix)
    } else {
      handPos = player.position.clone().add(
        new Vector3(0.35, 1.13, -0.35).applyQuaternion(bodyQuat)
      )
    }
    // The local lower third of the cue aligns with the player's right hand.
    const gripToCenter = new Vector3(0, 0.38, 0).applyQuaternion(cueQuat)
    cues[i].position.copy(handPos.add(gripToCenter))
    cues[i].quaternion.copy(cueQuat)
  }
}

function applyHolders(next) {
  if (!Array.isArray(next) || next.length !== 4) return
  for (let i = 0; i < 4; i++) {
    holders[i] = typeof next[i] === 'string' ? next[i] : null
    if (actions[i]) actions[i].distance = holders[i] ? 0 : 2.8
    if (!world.isClient || typeof world.getPlayer !== 'function') continue
    if (holders[i] && !attached[i]) {
      app.remove(cues[i])
      world.add(cues[i])
      attached[i] = true
    } else if (!holders[i] && attached[i]) {
      world.remove(cues[i])
      app.add(cues[i])
      cues[i].position.set(...slotPositions[i])
      cues[i].quaternion.set(0, 0, 0, 1)
      attached[i] = false
    }
  }
  for (const id of aimPoses.keys()) if (!holders.includes(id)) aimPoses.delete(id)
  publishHolders()
  if (!world.isClient || typeof world.getPlayer !== 'function') return
  if (holders.some(Boolean)) app.on('update', updateHeldCues)
  else app.off('update', updateHeldCues)
  const me = world.getPlayer()
  const nextHeld = me ? holders.findIndex(id => id === me.id) : -1
  if (nextHeld === localHeld) return
  localHeld = nextHeld
  hideGlasses()
  if (localControls) {
    localControls.setActions([])
    localControls.release()
    localControls = null
  }
  if (localHeld !== -1 && typeof app.control === 'function') {
    localControls = app.control()
    localControls.setActions([{ type: 'keyX', label: 'Put the cue away', position: 'bottom-left', opacity: 0.5 }])
    const drop = () => {
      const player = world.getPlayer()
      if (player && localHeld !== -1) app.send('drop-cue', { slot: localHeld })
    }
    if (localControls.keyX) {
      localControls.keyX.onPress = drop
      localControls.keyX.capture = true
    }
    if (localControls.keyV) {
      localControls.keyV.onPress = () => {
        glassesOn = !glassesOn
        if (!glassesOn) hideGlasses()
      }
      localControls.keyV.capture = true
    }
    if (localControls.xrLeftBtn1) {
      localControls.xrLeftBtn1.onPress = drop
      localControls.xrLeftBtn1.capture = true
    }
  }
}

// Actions are independent: player points at the desired cue and presses E.
for (let i = 0; i < 4; i++) {
  const action = app.create('action', {
    label: `Take pool cue ${i + 1}`,
    position: [X_POS[i], -0.22, CUE_Z + 0.03],
    distance: holders[i] ? 0 : 2.8,
    duration: 0.15,
    onTrigger: () => {
      if (!world.isClient || typeof world.getPlayer !== 'function' || holders[i]) return
      const me = world.getPlayer()
      if (me && !heldAnywhere(me.id)) app.send('take-cue', { slot: i })
    },
  })
  app.add(action)
  actions.push(action)
}

if (world.isServer) {
  // App state may survive a rebuild; disconnected holders must not keep cues.
  for (let i = 0; i < holders.length; i++) if (holders[i] && !world.getPlayer(holders[i])) holders[i] = null
  app.state.holders = holders.slice()
  const valid = (slot, playerId) => Number.isInteger(slot) && slot >= 0 && slot < 4 &&
    typeof playerId === 'string' && playerId.length > 0 && !!world.getPlayer(playerId)
  const publish = () => {
    app.state.holders = holders.slice()
    app.send('cue-holders', holders.slice())
    publishHolders()
  }
  const playerFor = sender => world.getPlayers().find(player => player.networkId === sender)
  app.on('take-cue', ({ slot } = {}, sender) => {
    const player = playerFor(sender)
    const playerId = player?.id
    app.emit(`${CUE_EVENT}:request`)
    if (!valid(slot, playerId) || holders[slot] || heldAnywhere(playerId)) return
    if (player.position.distanceTo(app.position) > 3.4) return
    holders[slot] = playerId
    publish()
  })
  app.on('drop-cue', ({ slot } = {}, sender) => {
    const playerId = playerFor(sender)?.id
    if (!valid(slot, playerId) || holders[slot] !== playerId) return
    holders[slot] = null
    publish()
  })
  app.on('request-cues', () => publish())
  world.on(`${CUE_EVENT}:request`, publishHolders)
  app.on('destroy', () => {
    holders.fill(null)
    app.emit(CUE_EVENT, { rackId: app.instanceId, holders: [] })
  })
  publish()
  // Native leave fires before player removal; use its ID instead of polling getPlayer.
  world.on('leave', ({ playerId }) => {
    let changed = false
    for (let i = 0; i < 4; i++) {
      if (holders[i] === playerId) {
        holders[i] = null
        changed = true
      }
    }
    if (changed) publish()
  })
}

if (world.isClient && typeof world.getPlayer === 'function') {
  world.on(`${CUE_EVENT}:request`, publishHolders)
  world.on(POSE_EVENT, pose => {
    if (!pose || !holders.includes(pose.playerId)) return
    if (pose.clear) {
      if (aimPoses.get(pose.playerId)?.tableId === pose.tableId) aimPoses.delete(pose.playerId)
      return
    }
    if (Array.isArray(pose.position) && pose.position.length === 3 && pose.position.every(Number.isFinite) &&
        Array.isArray(pose.quaternion) && pose.quaternion.length === 4 && pose.quaternion.every(Number.isFinite)) {
      aimPoses.set(pose.playerId, pose)
      // The table moves its camera in update; apply its cue pose in that same
      // frame even when this rack's update has already run.
      const slot = holders.indexOf(pose.playerId)
      if (attached[slot]) {
        cues[slot].position.fromArray(pose.position)
        cues[slot].quaternion.fromArray(pose.quaternion)
      }
    }
  })
  // Lignes créées une fois, dans le monde (comme les queues tenues) ; la table fournit repère et billes.
  const glassRoot = app.create('group')
  app.add(glassRoot)
  app.remove(glassRoot)
  world.add(glassRoot)
  const glassLine = (color, width) => {
    const n = app.create('prim', {
      type: 'box', size: [1, 0.002, width], color, emissive: color, emissiveIntensity: 1.5, opacity: 0.85,
      physics: null, castShadow: false, receiveShadow: false,
    })
    n.active = false
    glassRoot.add(n)
    glass.nodes.push(n)
    return n
  }
  for (let i = 0; i <= GLASSES_BOUNCES; i++) glass.path.push(glassLine('#ffffff', 0.006))
  glass.obj = glassLine('#ffb020', 0.008)
  glass.tan = glassLine('#35d0ff', 0.006)
  glass.ghost = app.create('prim', {
    type: 'sphere', size: [0.028575], color: '#ffffff', opacity: 0.3,
    physics: null, castShadow: false, receiveShadow: false,
  })
  glass.ghost.active = false
  glassRoot.add(glass.ghost)
  glass.nodes.push(glass.ghost)
  world.on(AIM_DATA_EVENT, data => {
    if (!data || data.playerId !== world.getPlayer()?.id) return
    if (data.clear || !glassesOn || localHeld === -1) return hideGlasses()
    if (!Array.isArray(data.cue) || !Array.isArray(data.targets) || !data.size || !Number.isFinite(data.angle) ||
        !(data.radius > 0) || !Array.isArray(data.position) || !Array.isArray(data.quaternion) || !Array.isArray(data.scale)) return
    glassRoot.position.fromArray(data.position)
    glassRoot.quaternion.fromArray(data.quaternion)
    glassRoot.scale.set(data.scale[0], data.scale[1], data.scale[2])
    showGlasses(predictShot(data.cue, data.targets, data.angle, data.size, data.radius), data.radius)
  })
  app.on('cue-holders', next => applyHolders(next))
  applyHolders(holders)
  app.send('request-cues')
  app.emit(`${CUE_EVENT}:request`)

  app.on('destroy', () => {
    app.off('update', updateHeldCues)
    if (localControls) localControls.release()
    holders.fill(null)
    app.emit(CUE_EVENT, { rackId: app.instanceId, holders: [] })
    for (let i = 0; i < 4; i++) if (attached[i]) world.remove(cues[i])
    world.remove(glassRoot)
  })
}
