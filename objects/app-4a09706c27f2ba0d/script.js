// Photomaton rétro : cabine photo, séance de 5 photos, strip qui sort par la fente,
// maintenir (clic ou E) pour voir en grand, relâcher pour la laisser tomber.
// Repère : mètres, +Y haut, +X droite, -Z avant (entrée avec rideau). Origine AU SOL,
// centrée sous la cabine. Caméra + écran sur la paroi du fond (+Z), fente de sortie côté droit (+X).
// v2 : une « photo » = vraie image prise par world.capturePhoto depuis l'objectif de la cabine
// (un seul client photographe par photo). Les mannequins en bois figés dans la pose des joueurs
// (os lus au déclic) restent en secours si la capture ou l'envoi échoue.

// ---------- Livrée ----------
const BODY_COLOR = '#b3141b'
const CHROME_COLOR = '#d8dde2'
const CURTAIN_COLOR = '#6e0f1f'
const SIGN_FACE = '#f2e6c9'
const PAPER_COLOR = '#f3eee2'
const SEPIA_BG = '#cfc3ab'
const SEPIA_INK = '#4a3626'
const SEPIA_HEAD = '#5a4330'

// ---------- Réglages ----------
const SHOTS = 5
const PEOPLE_MAX = 3
const SHOT_GAP = 3.6 // s par photo (décompte 3 s + pause)
const DEVELOP = 5 // s de développement
const EMERGE = 2.5 // s de sortie de la fente
const MAX_STRIPS = 5
const HOLD_DIST = 0.36 // m devant la caméra en vue « en grand »
const KEY = 'photomaton:' + app.instanceId
// Objectif (repère app) : paroi du fond, regarde vers l'entrée (-Z), légèrement vers le bas
const CAM_POS = [0, 1.62, 0.64]
const CAM_PITCH = -0.12 // rad (négatif = vers le bas)
const CAM_FOV = 65 // degrés, vertical
const PHOTO_PX = 512
const PHOTO_RE = /^asset:\/\/[0-9a-f]{64}\.jpg$/

// Cabine 1,2 × 2,2 × 1,6 m ; volume « dans la cabine » (pieds du joueur, repère app)
const IN = { x0: -0.56, x1: 0.56, z0: -0.8, z1: 0.68, y0: -0.3, y1: 1.0 }
const inside = (v, m) => v.x > IN.x0 - m && v.x < IN.x1 + m && v.z > IN.z0 - m && v.z < IN.z1 + m && v.y > IN.y0 - m && v.y < IN.y1 + m

// Strip : 8 × 40 cm, 5 cases de 6,5 cm, étiquette en bas. Repère strip : +Z = face imprimée.
const STRIP_W = 0.08
const STRIP_H = 0.4
const CASE = 0.065
const caseY = i => STRIP_H / 2 - 0.01 - CASE / 2 - i * (CASE + 0.006)
// Cadrage de la caméra (repère cabine) : carré de 1,3 m, des hanches à la tête
const FR = { x0: -0.65, x1: 0.65, y0: 0.75, y1: 2.05 }
const FS = CASE / (FR.x1 - FR.x0)
const FY = (FR.y0 + FR.y1) / 2
const reliefZ = z => 0.0016 + clamp((z - IN.z0) / (IN.z1 - IN.z0), 0, 1) * 0.006

// Fente : la strip pend sous le capot chromé, face imprimée vers +X
const SLOT_X = 0.626
const SLOT_Z = 0.35
const SLOT_Y0 = 1.22 // cachée dans le capot
const SLOT_Y1 = 0.8 // pendue
const FLOOR_X = 0.95 // où tombe une strip oubliée dans la fente

const BONES = ['hips', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot']
// segments [os a, os b, rayon m]
const SEGS = [[0, 1, 0.11], [1, 2, 0.05], [2, 3, 0.045], [1, 4, 0.05], [4, 5, 0.045], [5, 6, 0.04], [1, 7, 0.05], [7, 8, 0.045], [8, 9, 0.04], [0, 10, 0.06], [10, 11, 0.06], [11, 12, 0.05], [0, 13, 0.06], [13, 14, 0.06], [14, 15, 0.05]]

const TAU = Math.PI * 2
let seed = (Date.now() >>> 0) || 1234567
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const r3 = v => Math.round(v * 1000) / 1000
let dead = false
app.on('destroy', () => { dead = true })

// ---------- Primitives ----------
let PARENT = app
function prim(type, size, position, mat, rotation, extra) {
  const n = app.create('prim', Object.assign({ type, size, position, rotation: rotation || [0, 0, 0], castShadow: true, receiveShadow: true, physics: null }, mat, extra || {}))
  PARENT.add(n)
  return n
}
const box = (s, p, m, r, e) => prim('box', s, p, m, r, e)
const cyl = (rt, rb, h, p, m, r, e) => prim('cylinder', [rt, rb, h], p, m, r, e)
const sph = (r, p, m, e) => prim('sphere', [r], p, m, null, e)
function yAxisRotationBetween(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], h = Math.hypot(dx, dz)
  return h === 0 ? [dy >= 0 ? 0 : Math.PI, 0, 0] : [Math.atan2(h, dy), Math.atan2(dx, dz), 0]
}
const SOLID = { physics: 'static' }
const M = {
  body: { color: BODY_COLOR, metalness: 0.5, roughness: 0.23 },
  chrome: { color: CHROME_COLOR, metalness: 1, roughness: 0.08 },
  dark: { color: '#1b1b1f', metalness: 0.2, roughness: 0.6 },
  floor: { color: '#2a2a2e', metalness: 0, roughness: 0.85 },
  curtain: { color: CURTAIN_COLOR, metalness: 0, roughness: 0.9 },
  sign: { color: SIGN_FACE, metalness: 0, roughness: 0.6 },
  glass: { color: '#0a0c10', metalness: 0.9, roughness: 0.05 },
  bulb: { color: '#fff3d6', emissive: '#ffcc77', emissiveIntensity: 2, metalness: 0, roughness: 0.4 },
  paper: { color: PAPER_COLOR, metalness: 0, roughness: 0.9 },
  bg: { color: SEPIA_BG, metalness: 0, roughness: 0.9 },
  ink: { color: SEPIA_INK, metalness: 0, roughness: 0.8 },
  head: { color: SEPIA_HEAD, metalness: 0, roughness: 0.8 },
}
function uiPanel(pos, rotY, w, h, size, bg) {
  const ui = app.create('ui', { space: 'world', width: w, height: h, size, position: pos, rotation: [0, rotY, 0], backgroundColor: bg || 'transparent', pointerEvents: false, lit: false, justifyContent: 'center', alignItems: 'center' })
  PARENT.add(ui)
  return ui
}
function uiText(ui, value, fontSize, color, weight) {
  const t = app.create('uitext', { value, fontSize, color, fontWeight: weight || 400, textAlign: 'center' })
  ui.add(t)
  return t
}
const set = (n, k, v) => { if (n[k] !== v) n[k] = v }

// ---------- Cabine (serveur et clients : les colliders servent au sol des raycasts) ----------
box([1.24, 0.08, 1.64], [0, 0.04, 0], M.chrome, null, SOLID) // socle chromé
box([1.12, 0.02, 1.52], [0, 0.09, 0], M.floor, null, SOLID) // plancher intérieur
box([0.04, 2.0, 1.6], [-0.58, 1.1, 0], M.body, null, SOLID)
box([0.04, 2.0, 1.6], [0.58, 1.1, 0], M.body, null, SOLID)
box([1.2, 2.0, 0.08], [0, 1.1, 0.76], M.body, null, SOLID)
box([1.24, 0.1, 1.64], [0, 2.15, 0], M.body, null, SOLID) // toit
box([1.2, 0.25, 0.04], [0, 1.975, -0.78], M.body) // linteau avant
for (const x of [-0.6, 0.6]) for (const z of [-0.8, 0.8]) cyl(0.022, 0.022, 2.12, [x, 1.14, z], M.chrome)
for (const x of [-0.6025, 0.6025]) {
  box([0.005, 0.1, 1.6], [x, 0.14, 0], M.chrome)
  box([0.005, 0.03, 1.6], [x, 1.02, 0], M.chrome)
}
box([1.2, 0.03, 0.005], [0, 1.02, 0.8025], M.chrome)
// rideau à demi tiré (côté gauche), tringle chromée
cyl(0.012, 0.012, 1.12, [0, 1.84, -0.74], M.chrome, [0, 0, Math.PI / 2])
for (let i = 0; i < 8; i++) box([0.075, 1.7, 0.015], [-0.53 + i * 0.062, 0.98, -0.74], M.curtain, [0, i % 2 ? -0.5 : 0.5, 0], { castShadow: false })
// enseigne lumineuse
box([1.0, 0.3, 0.06], [0, 2.35, -0.7], M.sign)
for (const y of [2.22, 2.48]) for (let i = 0; i < 9; i++) sph(0.014, [-0.44 + i * 0.11, y, -0.735], M.bulb, { castShadow: false })
// paroi du fond : caméra, flash, écran
box([0.5, 0.62, 0.03], [0, 1.45, 0.705], M.dark)
cyl(0.055, 0.055, 0.04, [0, 1.62, 0.68], M.chrome, [Math.PI / 2, 0, 0])
cyl(0.04, 0.04, 0.045, [0, 1.62, 0.678], M.glass, [Math.PI / 2, 0, 0])
const flashPanel = box([0.4, 0.08, 0.02], [0, 1.92, 0.71], { color: '#f4f4f4', emissive: '#ffffff', emissiveIntensity: 0.15, metalness: 0, roughness: 0.3 })
// fente de sortie (côté droit) : capot chromé + voyant
box([0.05, 0.5, 0.14], [SLOT_X, 1.22, SLOT_Z], M.chrome)
box([0.004, 0.006, 0.1], [0.6525, 0.972, SLOT_Z], M.dark) // lèvre de la fente
const led = sph(0.012, [0.652, 1.42, SLOT_Z + 0.045], { color: '#2bd46a', emissive: '#2bd46a', emissiveIntensity: 0.2, metalness: 0, roughness: 0.4 }, { castShadow: false })

const control = world.isClient ? app.control() : null

// ---------- Sol (raycast vers le bas, repère app) ----------
function groundY(x, fromY, z, fallback) {
  const o = new Vector3(x, fromY, z).applyMatrix4(app.matrixWorld)
  const hit = world.raycast(o, new Vector3(0, -1, 0), 6, world.createLayerMask('environment'))
  if (!hit) return fallback
  const p = new Vector3().copy(hit.point).applyMatrix4(new Matrix4().copy(app.matrixWorld).invert())
  return p.y
}
const SLOT_Q = new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0, 'YXZ'))
const slotFinal = () => ({ p: [SLOT_X, SLOT_Y1, SLOT_Z], q: SLOT_Q.toArray() })

// =====================================================================
// SERVEUR : autorité (séance, strips, prise/chute, persistance)
// =====================================================================
if (world.isServer) {
  const st = app.state
  const later = (s, fn) => setTimeout(() => { if (!dead) fn() }, s * 1000)
  const inv = () => new Matrix4().copy(app.matrixWorld).invert()
  const localOf = p => new Vector3().copy(p.position).applyMatrix4(inv())
  const owner = (d, nid) => { const p = d && typeof d.pid === 'string' && world.getPlayer(d.pid); return p && p.networkId === nid ? p : null }
  const byId = id => st.strips.find(s => s.id === id)
  const floorSpot = () => [FLOOR_X, r3(groundY(FLOOR_X, 1.0, SLOT_Z, 0)), SLOT_Z]
  const save = () => world.set(KEY, { strips: st.strips })
  const broadcast = ev => app.send('state', { phase: st.phase, strips: st.strips, ev: ev || null })
  const fin = (v, lim) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim
  const vec = (a, lim) => Array.isArray(a) && a.length === 3 && a.every(v => fin(v, lim)) ? a.map(r3) : null
  const quat = a => Array.isArray(a) && a.length === 4 && a.every(v => fin(v, 1.01)) ? a : null

  const saved = world.get(KEY)
  st.phase = 'idle'
  st.strips = (saved && Array.isArray(saved.strips) ? saved.strips : []).slice(-MAX_STRIPS)
  for (const s of st.strips) if (s.mode === 'held') Object.assign(s, { mode: 'floor', holder: null, pos: floorSpot(), yaw: rnd() * TAU })

  let sid = 0, shot = -1, photos = null, shotPids = null, names = []
  let urls = null, shooters = null, starter = null, curStrip = null
  // photographe : celui qui a lancé la séance s'il est encore connecté, sinon un joueur dans la cabine
  function pickShooter() {
    if (starter && world.getPlayer(starter)) return starter
    const p = world.getPlayers().find(x => inside(localOf(x), 0))
    return p ? p.id : null
  }
  function startSession(pid) {
    st.phase = 'session'
    sid++
    photos = []
    shotPids = []
    names = []
    urls = []
    shooters = []
    starter = pid
    curStrip = null
    for (let i = 0; i < SHOTS; i++) { photos.push([]); shotPids.push([]); urls.push(null); shooters.push(null) }
    broadcast()
    const my = sid
    for (let i = 0; i < SHOTS; i++) {
      const b = 1 + i * SHOT_GAP
      for (let n = 3; n >= 1; n--) later(b + 3 - n, () => app.send('tick', { i, n }))
      later(b + 3, () => { shot = i; shooters[i] = pickShooter(); app.send('shoot', { sid: my, i, cam: shooters[i] }) })
      later(b + SHOT_GAP, () => { if (shot === i) shot = -1 })
    }
    const end = 1 + SHOTS * SHOT_GAP + 0.2
    later(end, () => { st.phase = 'develop'; broadcast() })
    later(end + DEVELOP, finish)
  }
  function finish() {
    const ev = []
    const old = st.strips.find(s => s.mode === 'slot')
    if (old) {
      Object.assign(old, { mode: 'floor', pos: floorSpot(), yaw: rnd() * TAU })
      ev.push({ t: 'fall', id: old.id, from: slotFinal() })
    }
    const strip = { id: uuid(), photos, urls, names: names.join(' · '), date: world.getTimestamp('YYYY-MM-DD'), mode: 'slot', holder: null, pos: null, yaw: 0 }
    curStrip = strip // urls partagé par référence : une photo en retard complète la strip
    st.strips.push(strip)
    while (st.strips.length > MAX_STRIPS) {
      const k = st.strips.findIndex(s => s.mode !== 'held')
      st.strips.splice(k < 0 ? 0 : k, 1)
    }
    ev.push({ t: 'emerge', id: strip.id })
    st.phase = 'idle'
    save()
    broadcast(ev)
  }

  app.on('start', (d, nid) => {
    const p = owner(d, nid)
    if (!p || st.phase !== 'idle' || !inside(localOf(p), 0.25)) return
    startSession(p.id)
  })
  app.on('photo', (d, nid) => {
    const p = owner(d, nid)
    if (!p || !urls || d.sid !== sid || !Number.isInteger(d.i) || d.i < 0 || d.i >= SHOTS) return
    if (shooters[d.i] !== p.id || urls[d.i] || typeof d.url !== 'string' || !PHOTO_RE.test(d.url)) return
    urls[d.i] = d.url
    if (curStrip && st.strips.includes(curStrip)) { save(); broadcast() }
  })
  app.on('pose', (d, nid) => {
    const p = owner(d, nid)
    if (!p || d.sid !== sid || d.i !== shot || shot < 0) return
    if (photos[shot].length >= PEOPLE_MAX || shotPids[shot].includes(p.id) || !inside(localOf(p), 0.4)) return
    const pts = d.p
    if (!Array.isArray(pts) || pts.length !== BONES.length * 3) return
    for (let k = 0; k < pts.length; k += 3) {
      if (!fin(pts[k], 1.2) || !fin(pts[k + 1], 3) || pts[k + 1] < -0.5 || !fin(pts[k + 2], 1.4)) return
    }
    shotPids[shot].push(p.id)
    photos[shot].push({ p: pts.map(r3) })
    if (!names.includes(p.name)) names.push(String(p.name || 'Invité').slice(0, 24))
  })
  app.on('grab', (d, nid) => {
    const p = owner(d, nid)
    const s = p && byId(d.id)
    if (!s || s.mode === 'held') return
    const at = s.mode === 'slot' ? new Vector3(SLOT_X, SLOT_Y1, SLOT_Z) : new Vector3().fromArray(s.pos)
    if (localOf(p).distanceTo(at) > 4) return
    Object.assign(s, { mode: 'held', holder: p.id })
    save()
    broadcast()
  })
  app.on('drop', (d, nid) => {
    const p = owner(d, nid)
    const s = p && byId(d.id)
    if (!s || s.holder !== p.id) return
    const pl = localOf(p)
    let to = vec(d.to, 50)
    if (!to || Math.hypot(to[0] - pl.x, to[2] - pl.z) > 3 || Math.abs(to[1] - pl.y) > 3) to = [r3(pl.x), r3(pl.y), r3(pl.z)]
    const fp = vec(d.from && d.from.p, 50)
    const fq = quat(d.from && d.from.q)
    const from = fp && fq ? { p: fp, q: fq } : { p: [pl.x, pl.y + 1.3, pl.z], q: [0, 0, 0, 1] }
    Object.assign(s, { mode: 'floor', holder: null, pos: to, yaw: fin(d.yaw, 10) ? d.yaw : 0 })
    save()
    broadcast([{ t: 'fall', id: s.id, from, by: p.id }])
  })
  world.on('leave', e => {
    const held = st.strips.filter(s => s.holder === e.playerId)
    if (!held.length) return
    const p = world.getPlayer(e.playerId)
    const pl = p ? localOf(p) : new Vector3(FLOOR_X, 0, SLOT_Z)
    const ev = held.map(s => {
      Object.assign(s, { mode: 'floor', holder: null, pos: [r3(pl.x), r3(groundY(pl.x, pl.y + 0.5, pl.z, pl.y)), r3(pl.z)], yaw: rnd() * TAU })
      return { t: 'fall', id: s.id, from: { p: [pl.x, pl.y + 1.3, pl.z], q: [0, 0, 0, 1] } }
    })
    save()
    broadcast(ev)
  })
}

// =====================================================================
// CLIENT : visuels, séance, capture des os, strips, vue en grand
// =====================================================================
if (world.isClient && typeof Vector3 === 'function') {
  let S = { phase: app.state.phase || 'idle', strips: app.state.strips || [] }
  const me = () => world.getPlayer()
  const inv = () => new Matrix4().copy(app.matrixWorld).invert()
  const appQ = () => { const p = new Vector3(), q = new Quaternion(), s = new Vector3(); app.matrixWorld.decompose(p, q, s); return q }

  // éclairage, flash, écran, enseignes
  const roomLight = app.create('light', { type: 'point', color: '#ffe2b8', intensity: 2, distance: 3, position: [0, 2.0, 0.1] })
  app.add(roomLight)
  const flashLight = app.create('light', { type: 'point', color: '#ffffff', intensity: 0, distance: 4, position: [0, 1.8, 0.45] })
  app.add(flashLight)
  const screenUi = uiPanel([0, 1.27, 0.688], Math.PI, 240, 170, 0.0015, '#0b0f12')
  screenUi.flexDirection = 'column'
  const big = uiText(screenUi, 'PRÊT', 72, '#ffd27a', 800)
  const small = uiText(screenUi, 'Appuie sur E', 20, '#c9ced4', 400)
  const signUi = uiPanel([0, 2.35, -0.732], Math.PI, 400, 120, 0.0025)
  uiText(signUi, 'PHOTOS', 84, '#c8102e', 800)
  const busyUi = uiPanel([0, 1.975, -0.802], Math.PI, 300, 60, 0.0025)
  const busy = uiText(busyUi, 'LIBRE', 40, '#3ddc84', 800)
  const outUi = uiPanel([0.603, 1.6, SLOT_Z], Math.PI / 2, 240, 40, 0.0015)
  uiText(outUi, 'VOS PHOTOS', 24, '#f4f4f4', 800)
  const action = app.create('action', { label: 'Prendre les photos', distance: 1.6, duration: 0.4, position: [0, 1.27, 0.66], onTrigger: () => { const p = me(); if (p) app.send('start', { pid: p.id }) } })
  app.add(action)

  // sons
  const snd = (prop, pos, volume) => { const a = app.create('audio', { src: props[prop] && props[prop].url, volume, group: 'sfx', spatial: true, position: pos }); app.add(a); return a }
  const sBip = snd('sndBip', [0, 1.4, 0.6], 0.6)
  const sClic = snd('sndClic', [0, 1.8, 0.6], 0.9)
  const sMoteur = snd('sndMoteur', [SLOT_X, 1.2, SLOT_Z], 0.7)
  const sPapier = snd('sndPapier', [0, 1, 0], 0.8)

  // ----- pool de strips (créé à la demande hors update, réutilisé ensuite) -----
  const slots = []
  function makeSlot() {
    const g = app.create('group')
    app.add(g)
    PARENT = g
    box([STRIP_W, STRIP_H, 0.002], [0, 0, 0], M.paper, null, { castShadow: false })
    const men = []
    const imgs = []
    for (let i = 0; i < SHOTS; i++) {
      box([CASE, CASE, 0.0006], [0, caseY(i), 0.0013], M.bg, null, { castShadow: false })
      const img = app.create('image', { src: null, width: CASE, height: CASE, fit: 'cover', position: [0, caseY(i), 0.0018], lit: false, doubleside: false, castShadow: false, receiveShadow: false })
      g.add(img)
      imgs.push(img)
      const row = []
      for (let k = 0; k < PEOPLE_MAX; k++) {
        const segs = SEGS.map(() => cyl(1, 1, 1, [0, 0, 0], M.ink, null, { castShadow: false, active: false }))
        const head = sph(1, [0, 0, 0], M.head, { castShadow: false, active: false })
        row.push({ segs, head })
      }
      men.push(row)
    }
    const label = uiPanel([0, -0.18, 0.0016], 0, 200, 90, 0.0004)
    label.flexDirection = 'column'
    const names = uiText(label, '', 15, '#3b2b1e', 700)
    const date = uiText(label, '', 12, '#6b5a48', 400)
    PARENT = app
    const slot = { g, men, imgs, names, date, id: null, sig: null, act: null }
    slot.act = app.create('action', { label: 'Voir les photos (maintenir)', distance: 2.6, duration: 0.25, position: [0, 0, 0.01], onTrigger: () => grab(slot) })
    g.add(slot.act)
    slots.push(slot)
    return slot
  }

  // ----- mannequin figé dans une case -----
  const mapPt = (pts, j, cy) => [pts[j * 3] * FS, cy + (pts[j * 3 + 1] - FY) * FS, reliefZ(pts[j * 3 + 2])]
  function clip2D(a, b) { // Liang-Barsky dans le cadre (repère cabine) ; renvoie [t0, t1] ou null
    let t0 = 0, t1 = 1
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const tests = [[-dx, a[0] - FR.x0], [dx, FR.x1 - a[0]], [-dy, a[1] - FR.y0], [dy, FR.y1 - a[1]]]
    for (const [p, q] of tests) {
      if (p === 0) { if (q < 0) return null; continue }
      const r = q / p
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r } else { if (r < t0) return null; if (r < t1) t1 = r }
    }
    return t1 - t0 > 1e-4 ? [t0, t1] : null
  }
  function poseMan(man, pts, cy) {
    const P = j => [pts[j * 3], pts[j * 3 + 1], pts[j * 3 + 2]]
    SEGS.forEach(([a, b, r], k) => {
      const n = man.segs[k]
      const A = P(a), B = P(b)
      const c = clip2D(A, B)
      if (!c) { n.active = false; return }
      const lerp = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]
      const a2 = lerp(c[0]), b2 = lerp(c[1])
      const pa = [a2[0] * FS, cy + (a2[1] - FY) * FS, reliefZ(a2[2])]
      const pb = [b2[0] * FS, cy + (b2[1] - FY) * FS, reliefZ(b2[2])]
      const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2])
      if (L < 1e-5) { n.active = false; return }
      const rot = yAxisRotationBetween(pa, pb)
      n.position.set((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2)
      n.rotation.set(rot[0], rot[1], 0)
      n.scale.set(r * FS, L, r * FS * 0.6)
      n.active = true
    })
    const H = P(3), N = P(2)
    const d = Math.hypot(H[0] - N[0], H[1] - N[1], H[2] - N[2]) || 1
    const C = [0, 1, 2].map(k => H[k] + (H[k] - N[k]) / d * 0.09)
    const h = man.head
    if (C[0] < FR.x0 || C[0] > FR.x1 || C[1] < FR.y0 || C[1] > FR.y1) { h.active = false; return }
    h.position.set(C[0] * FS, cy + (C[1] - FY) * FS, reliefZ(C[2]))
    h.scale.set(0.11 * FS, 0.12 * FS, 0.11 * FS * 0.6)
    h.active = true
  }
  const urlsOf = s => (s.urls || []).map(u => (typeof u === 'string' && PHOTO_RE.test(u) ? u : null))
  const sigOf = s => urlsOf(s).join('|')
  function fillSlot(slot, s) {
    const urls = urlsOf(s)
    for (let i = 0; i < SHOTS; i++) {
      const list = (s.photos && s.photos[i]) || []
      const url = urls[i] || null
      set(slot.imgs[i], 'src', url)
      for (let k = 0; k < PEOPLE_MAX; k++) {
        const man = slot.men[i][k]
        if (!url && k < list.length) poseMan(man, list[k].p, caseY(i)) // secours : mannequins
        else { man.segs.forEach(n => { n.active = false }); man.head.active = false }
      }
    }
    set(slot.names, 'value', s.names || '')
    set(slot.date, 'value', s.date || '')
    slot.id = s.id
    slot.sig = sigOf(s)
  }

  // ----- poses de strip -----
  const floorQ = yaw => new Quaternion().setFromEuler(new Euler(-Math.PI / 2, yaw, 0, 'YXZ'))
  function restPose(s) {
    if (s.mode === 'slot') return { p: new Vector3(SLOT_X, SLOT_Y1, SLOT_Z), q: SLOT_Q.clone() }
    if (s.mode === 'floor' && s.pos) return { p: new Vector3(s.pos[0], s.pos[1] + 0.001, s.pos[2]), q: floorQ(s.yaw || 0) }
    return null
  }
  const place = (slot, p, q) => { slot.g.position.copy(p); slot.g.quaternion.copy(q) }
  const byId = id => S.strips.find(s => s.id === id)
  const slotOf = id => slots.find(sl => sl.id === id)

  // ----- état local -----
  let hold = null // { id } : strip tenue par moi (optimiste)
  const anims = new Map() // id -> { type, t, ... }
  let flashT = 0, clock = 0, awake = false

  function render() {
    const ids = S.strips.map(s => s.id)
    for (const sl of slots) if (sl.id && !ids.includes(sl.id)) { anims.delete(sl.id); sl.id = null; sl.g.active = false }
    if (hold && !ids.includes(hold.id)) release(false)
    const myId = me() && me().id
    for (const s of S.strips) {
      let sl = slotOf(s.id)
      if (!sl) { sl = slots.find(x => !x.id) || makeSlot(); fillSlot(sl, s) }
      else if (sl.sig !== sigOf(s)) fillSlot(sl, s) // photo arrivée après la sortie de la strip
      sl.g.active = true
      if (hold && hold.id === s.id && s.holder && s.holder !== myId) release(false) // perdu au serveur
      const mine = hold && hold.id === s.id
      sl.act.active = !mine && s.mode !== 'held'
      const r = restPose(s)
      if (r && !mine && !anims.has(s.id)) place(sl, r.p, r.q)
    }
    wake()
  }
  function onEvent(ev) {
    const s = byId(ev.id)
    if (!s) return
    if (ev.t === 'emerge') anims.set(s.id, { type: 'emerge', t: 0 })
    if (ev.t === 'fall') {
      if (ev.by && me() && ev.by === me().id && anims.has(s.id)) return // déjà animée localement
      const r = restPose(s)
      if (!r) return
      startFall(s.id, new Vector3().fromArray(ev.from.p), new Quaternion().fromArray(ev.from.q), r.p, r.q)
    }
  }
  function startFall(id, p0, q0, p1, q1) {
    const h = Math.max(0.05, p0.y - p1.y)
    anims.set(id, { type: 'fall', t: 0, T: clamp(Math.sqrt(2 * h / 3), 0.4, 1.6), p0, q0, p1, q1, side: rnd() < 0.5 ? -1 : 1 })
    sPapier.position.copy(p0)
    sPapier.play(true)
  }
  function phaseUI(prev) {
    set(busy, 'value', S.phase === 'idle' ? 'LIBRE' : 'OCCUPÉ')
    set(busy, 'color', S.phase === 'idle' ? '#3ddc84' : '#ff4d4d')
    action.active = S.phase === 'idle'
    if (S.phase === 'idle') { set(big, 'value', 'PRÊT'); set(small, 'value', 'Appuie sur E') }
    if (S.phase === 'session' && prev !== 'session') { set(big, 'value', '…'); set(small, 'value', 'Séance en cours') }
    if (S.phase === 'develop') { set(big, 'value', '…'); set(small, 'value', 'Développement'); if (prev !== 'develop') sMoteur.play(true) }
  }

  app.on('state', d => {
    const prev = S.phase
    S = { phase: d.phase, strips: d.strips || [] }
    render()
    if (d.ev) d.ev.forEach(onEvent)
    phaseUI(prev)
    wake()
  })
  app.on('tick', d => { set(big, 'value', String(d.n)); set(small, 'value', 'Photo ' + (d.i + 1) + '/' + SHOTS); sBip.play(true) })
  app.on('shoot', d => {
    set(big, 'value', 'CLIC !')
    sClic.play(true)
    flashT = 0.15
    flashPanel.emissiveIntensity = 8
    flashLight.intensity = 40
    wake()
    const p = me()
    if (!p) return
    if (d.cam === p.id) takePhoto(d, p)
    const im = inv()
    if (!inside(new Vector3().copy(p.position).applyMatrix4(im), 0)) return
    const pts = []
    const v = new Vector3()
    for (const b of BONES) {
      const m = p.getBoneTransform(b)
      if (!m) return
      v.setFromMatrixPosition(m).applyMatrix4(im)
      pts.push(r3(v.x), r3(v.y), r3(v.z))
    }
    app.send('pose', { pid: p.id, sid: d.sid, i: d.i, p: pts })
  })

  // ----- vraie photo depuis l'objectif (seul le photographe désigné par le serveur) -----
  function takePhoto(d, p) {
    if (typeof world.capturePhoto !== 'function') return // ancien moteur : mannequins seulement
    const position = new Vector3(CAM_POS[0], CAM_POS[1], CAM_POS[2]).applyMatrix4(app.matrixWorld)
    const quaternion = appQ().multiply(new Quaternion().setFromEuler(new Euler(CAM_PITCH, 0, 0, 'YXZ')))
    const sl = hold && slotOf(hold.id)
    const pid = p.id
    let req
    try {
      req = world.capturePhoto({ position, quaternion, fov: CAM_FOV, width: PHOTO_PX, height: PHOTO_PX, quality: 0.85, hide: sl ? [sl.g] : [] })
    } catch (e) { console.warn('[photomaton] capture :', e && e.message); return }
    req.then(r => app.send('photo', { pid, sid: d.sid, i: d.i, url: r.url }))
      .catch(e => console.warn('[photomaton] capture :', e && e.message)) // la case garde ses mannequins
  }

  // ----- prendre / lâcher -----
  function grab(slot) {
    const p = me()
    const s = slot.id && byId(slot.id)
    if (!p || hold || !s || s.mode === 'held') return
    hold = { id: s.id }
    anims.delete(s.id)
    slot.act.active = false
    control.keyE.capture = true
    control.mouseLeft.capture = true
    app.send('grab', { pid: p.id, id: s.id })
    sPapier.position.copy(slot.g.position)
    sPapier.play(true)
    wake()
  }
  function release(drop) {
    const h = hold
    hold = null
    control.keyE.capture = false
    control.mouseLeft.capture = false
    const sl = h && slotOf(h.id)
    if (!drop || !sl) return
    const p0 = sl.g.position.clone(), q0 = sl.g.quaternion.clone()
    if (!me()) return
    const pl = new Vector3().copy(me().position).applyMatrix4(inv())
    const y = groundY(p0.x, p0.y + 0.05, p0.z, pl.y)
    const yaw = rnd() * TAU
    const to = [r3(p0.x), r3(y), r3(p0.z)]
    app.send('drop', { pid: me().id, id: h.id, from: { p: p0.toArray(), q: q0.toArray() }, to, yaw })
    startFall(h.id, p0, q0, new Vector3(to[0], to[1] + 0.001, to[2]), floorQ(yaw))
  }

  // ----- boucle (réveillée seulement quand quelque chose bouge) -----
  const tv = new Vector3(), tq = new Quaternion(), fwd = new Vector3(), up = new Vector3(0, 1, 0)
  function needsUpdate() {
    return !!hold || anims.size > 0 || flashT > 0 || S.phase === 'develop' || S.strips.some(s => s.mode === 'held')
  }
  function wake() { if (!awake && needsUpdate()) { awake = true; app.on('update', update) } }
  function sleep() { awake = false; app.off('update', update) }
  function update(dt) {
    clock += dt
    if (flashT > 0) {
      flashT -= dt
      if (flashT <= 0) { flashPanel.emissiveIntensity = 0.15; flashLight.intensity = 0 }
    }
    const blink = S.phase === 'develop' ? (Math.floor(clock * 4) % 2 ? 3 : 0.2) : 0.2
    set(led, 'emissiveIntensity', blink)
    // ma strip : en grand devant la caméra tant que clic/E est maintenu
    if (hold) {
      if (!control.keyE.down && !control.mouseLeft.down) release(true)
      else {
        const sl = slotOf(hold.id)
        if (sl) {
          fwd.set(0, 0, -1).applyQuaternion(control.camera.quaternion)
          tv.copy(control.camera.position).addScaledVector(fwd, HOLD_DIST).applyMatrix4(inv())
          tq.copy(appQ()).invert().multiply(control.camera.quaternion)
          place(sl, tv, tq)
        }
      }
    }
    for (const s of S.strips) {
      const sl = slotOf(s.id)
      if (!sl || (hold && hold.id === s.id)) continue
      const a = anims.get(s.id)
      if (a) {
        a.t += dt
        if (a.type === 'emerge') {
          const e = Math.min(1, a.t / EMERGE)
          tv.set(SLOT_X, SLOT_Y0 + (SLOT_Y1 - SLOT_Y0) * (e * e * (3 - 2 * e)), SLOT_Z)
          place(sl, tv, SLOT_Q)
          if (e >= 1) anims.delete(s.id)
        } else {
          const e = Math.min(1, a.t / a.T)
          const k = 1 - e
          tv.lerpVectors(a.p0, a.p1, e)
          tv.y = a.p0.y + (a.p1.y - a.p0.y) * Math.pow(e, 1.3)
          tv.x += Math.sin(a.t * 6) * 0.08 * k * a.side
          tv.z += Math.cos(a.t * 5) * 0.05 * k
          tq.slerpQuaternions(a.q0, a.q1, e * e * (3 - 2 * e))
          const wob = new Quaternion().setFromEuler(new Euler(Math.sin(a.t * 7) * 0.5 * k, 0, Math.sin(a.t * 9) * 0.6 * k, 'YXZ'))
          tq.multiply(wob)
          place(sl, tv, tq)
          if (e >= 1) { anims.delete(s.id); place(sl, a.p1, a.q1) }
        }
        continue
      }
      if (s.mode === 'held') { // tenue par un autre : dans sa main droite
        const p = world.getPlayer(s.holder)
        if (!p) continue
        const m = p.getBoneTransform('rightHand')
        if (m) tv.setFromMatrixPosition(m).addScaledVector(up, 0.12)
        else tv.copy(p.position).addScaledVector(up, 1.2)
        tv.applyMatrix4(inv())
        tq.copy(appQ()).invert().multiply(p.quaternion)
        place(sl, tv, tq)
      }
    }
    if (!needsUpdate()) {
      set(led, 'emissiveIntensity', 0.2)
      sleep()
    }
  }

  render()
  phaseUI(null)
  app.on('destroy', () => { control.release() })

  // crochet de test (banc de simulation)
  props.__test = { slots, anims, get hold() { return hold }, get awake() { return awake }, get S() { return S }, screen: () => [big.value, small.value, busy.value] }
}
