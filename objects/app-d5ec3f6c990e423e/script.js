// Photomaton rétro : cabine photo, séance de 5 photos, strip qui sort par la fente,
// maintenir (clic ou E) pour voir en grand, relâcher pour la laisser tomber.
// Repère : mètres, +Y haut, +X droite, -Z avant. Origine AU SOL, centrée sous l'ensemble (1,9 × 1,2 m).
// v3 (style années 60), vu de face : meuble de la machine à gauche (x > 0,15 : affiche + fente de sortie
// en façade), cabine ouverte à droite (x < 0,15), entrée par l'avant avec rideau tiré sur le côté.
// L'objectif est sur la paroi intérieure du meuble et regarde vers -X (de côté), face à la banquette.
// v2 : une « photo » = vraie image prise par world.capturePhoto depuis l'objectif de la cabine
// (un seul client photographe par photo). Les mannequins en bois figés dans la pose des joueurs
// (os lus au déclic) restent en secours si la capture ou l'envoi échoue.

// ---------- Livrée ----------
const WOOD_COLOR = '#8a6440'
const CHROME_COLOR = '#d8dde2'
const METAL_COLOR = '#b9bec4'
const WALL_COLOR = '#ece6da'
const CURTAIN_COLOR = '#a3161c'
const POSTER_COLOR = '#f2c230'
const BENCH_COLOR = '#3aa6b9'
const SIGN_FACE = '#f6f1e6'
const SIGN_TEXT = '#d9481c'
const PAPER_COLOR = '#f3eee2'
const SEPIA_BG = '#cfc3ab'
const SEPIA_INK = '#4a3626'
const SEPIA_HEAD = '#5a4330'

// ---------- Réglages ----------
const SHOTS = 5 // maximum (taille du pool) ; le nombre réel par strip est réglable : 3, 4 ou 5
const SHOT_CHOICES = ['3', '4', '5']
const SHOTS_DEFAULT = 4
const PEOPLE_MAX = 3
const SHOT_GAP = 3.6 // s par photo (décompte 3 s + pause)
const DEVELOP = 5 // s de développement
const EMERGE = 2.5 // s de sortie de la fente
const MAX_STRIPS = 5 // strips « libres » (fente, sol) ; celles épinglées aux tableaux ne comptent pas
// Tableaux en liège aux deux extrémités : face extérieure du meuble (+X) et de la cabine (-X)
const BOARD_SLOTS = 6 // strips par tableau
const BOARDS = [{ x: 0.986, dir: 1 }, { x: -0.986, dir: -1 }]
const BOARD_Y = 1.42
const pinPos = (b, k) => [BOARDS[b].x, BOARD_Y, (k - (BOARD_SLOTS - 1) / 2) * 0.13 * -BOARDS[b].dir]
// Assis : 3e personne au plus près (comme le zoom minimum du moteur : 0,3 m derrière, 0,3 m à droite).
// La caméra du moteur se cogne au mur du fond et finit dans la tête ; ici on la garde dans la cabine.
const SEAT_BACK = 0.3
const SEAT_RIGHT = 0.3
const SEAT_BOX = { x0: -0.86, x1: 0.08, y0: 0.3, y1: 2.0, z0: -0.52, z1: 0.52 } // intérieur de la cabine
const FLASH_LIGHT = 0.2 // intensité du flash par défaut (réglable dans les propriétés de l'app)
const FLASH_MAX = 1
const ROOM_LIGHT = 2 // lampe du plafond de la cabine
const PHOTO_MODES = { color: null, bw: 'grayscale', sepia: 'sepia' } // mode → filtre de capturePhoto

const HOLD_DIST = 0.36 // m devant la caméra en vue « en grand »
const KEY = 'photomaton:' + app.instanceId
// Objectif (repère app) : paroi intérieure du meuble, regarde vers -X (la banquette)
const CAM_POS = [0.08, 1.7, 0.05] // y = hauteur par défaut (réglable dans les propriétés de l'app)
const CAM_Y_MIN = 1.25 // bornes : l'objectif reste sur son panneau, au-dessus de l'écran
const CAM_Y_MAX = 1.7
const CAM_YAW = Math.PI / 2 // -Z (avant de la caméra) tourné vers -X
const CAM_PITCH = -0.15 // rad (négatif = vers le bas) : vise les têtes des personnes assises
const CAM_FOV = 65 // degrés, vertical, au zoom 1×
const ZOOMS = ['0.5', '0.75', '1', '1.25'] // 0,5× = grand angle (~104°), 1,25× = serré (~54°)
const ZOOM_DEFAULT = '0.75'
const PHOTO_PX = 512
const PHOTO_RE = /^asset:\/\/[0-9a-f]{64}\.jpg$/
// Décors du mur en face de l'objectif : un clic sur le mur passe au suivant
const DECORS = [
  { key: 'blanc', label: 'Blanc' },
  { key: 'gris', label: 'Gris foncé' },
  { key: 'montagnes', label: 'Montagnes', img: 'decorMontagnes' },
  { key: 'ville', label: 'Ville', img: 'decorVille' },
  { key: 'rideau', label: 'Rideau rouge' },
]
const DECOR_DEFAULT = 4 // rideau rouge
const PLAIN = { blanc: '#f4f4f2', gris: '#3a3a3e' }

// ---------- Propriétés de l'app ----------
app.configure([
  { type: 'range', key: 'flash', label: 'Flash (intensité)', min: 0, max: FLASH_MAX, step: 0.2, initial: FLASH_LIGHT },
  { type: 'toggle', key: 'lightOff', label: 'Éteindre la lumière pendant les photos', trueLabel: 'Oui', falseLabel: 'Non', initial: false },
  { type: 'range', key: 'camHeight', label: 'Hauteur de la caméra (m)', min: CAM_Y_MIN, max: CAM_Y_MAX, step: 0.01, initial: CAM_POS[1] },
  { type: 'switch', key: 'zoom', label: 'Grand angle', options: ZOOMS.map(z => ({ label: z.replace('.', ',') + '×', value: z })), initial: ZOOM_DEFAULT },
  { type: 'switch', key: 'shots', label: 'Photos par strip', options: SHOT_CHOICES.map(v => ({ label: v, value: v })), initial: String(SHOTS_DEFAULT) },
  { type: 'switch', key: 'photoMode', label: 'Photos', options: [{ label: 'Couleur', value: 'color' }, { label: 'Noir et blanc', value: 'bw' }, { label: 'Sépia', value: 'sepia' }], initial: 'color' },
])
const flashLevel = () => (typeof props.flash === 'number' && Number.isFinite(props.flash) ? clamp(props.flash, 0, FLASH_MAX) : FLASH_LIGHT)
// FOV équivalent au zoom : même cadre qu'un objectif 1× agrandi/réduit (perspective rectiligne)
const camFov = () => { const z = Number(ZOOMS.includes(props.zoom) ? props.zoom : ZOOM_DEFAULT); return (2 * Math.atan(Math.tan((CAM_FOV / 2) * Math.PI / 180) / z) * 180) / Math.PI }
const camY = () => (typeof props.camHeight === 'number' && Number.isFinite(props.camHeight) ? clamp(props.camHeight, CAM_Y_MIN, CAM_Y_MAX) : CAM_POS[1])
const shotsN = () => (SHOT_CHOICES.includes(String(props.shots)) ? Number(props.shots) : SHOTS_DEFAULT)
const photoFilter = () => (PHOTO_MODES.hasOwnProperty(props.photoMode) ? PHOTO_MODES[props.photoMode] : null)

// Volume « dans la cabine » (pieds du joueur, repère app) : x -0,95 → 0,15
const IN = { x0: -0.9, x1: 0.1, z0: -0.56, z1: 0.56, y0: -0.3, y1: 1.0 }
const inside = (v, m) => v.x > IN.x0 - m && v.x < IN.x1 + m && v.z > IN.z0 - m && v.z < IN.z1 + m && v.y > IN.y0 - m && v.y < IN.y1 + m

// Strip : 8 cm de large, 5 cases de 6,5 cm (40 cm de haut ; plus courte à 3 ou 4 photos, le haut reste fixe).
// Repère strip : +Z = face imprimée.
const STRIP_W = 0.08
const STRIP_H = 0.4
const CASE = 0.065
const caseY = i => STRIP_H / 2 - 0.01 - CASE / 2 - i * (CASE + 0.006)
const stripH = n => STRIP_H - (SHOTS - n) * (CASE + 0.006)
// Mannequins de secours, repère caméra : [h horizontal, y, d profondeur vers la caméra]
const FR = { x0: -0.65, x1: 0.65, y0: 0.75, y1: 2.05 }
const FS = CASE / (FR.x1 - FR.x0)
const FY = (FR.y0 + FR.y1) / 2
const reliefZ = d => 0.0016 + clamp((d + 1.0) / 1.8, 0, 1) * 0.006 // plus près de l'objectif = plus en relief

// Fente : sur la façade du meuble, la strip pend sous le capot chromé, face imprimée vers l'avant (-Z)
const SLOT_X = 0.6
const SLOT_Z = -0.628
const SLOT_Y0 = 1.17 // cachée dans le capot
const SLOT_Y1 = 0.76 // pendue
const FLOOR_P = [0.6, -0.95] // x, z où tombe une strip oubliée dans la fente

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
  body: { color: WOOD_COLOR, metalness: 0, roughness: 0.55 },
  metal: { color: METAL_COLOR, metalness: 0.8, roughness: 0.35 },
  wall: { color: WALL_COLOR, metalness: 0, roughness: 0.85 },
  poster: { color: POSTER_COLOR, metalness: 0, roughness: 0.7 },
  bench: { color: BENCH_COLOR, metalness: 0.1, roughness: 0.55 },
  tileB: { color: '#1c1c1e', metalness: 0, roughness: 0.5 },
  tileW: { color: '#efefe8', metalness: 0, roughness: 0.5 },
  chrome: { color: CHROME_COLOR, metalness: 1, roughness: 0.08 },
  dark: { color: '#1b1b1f', metalness: 0.2, roughness: 0.6 },
  curtain: { color: CURTAIN_COLOR, metalness: 0, roughness: 0.9 },
  glass: { color: '#0a0c10', metalness: 0.9, roughness: 0.05 },
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
const AXLE_X = [0, 0, -Math.PI / 2] // cylindre couché le long de X
// meuble de la machine (à gauche vu de face = +X)
box([0.8, 0.2, 1.2], [0.55, 0.1, 0], M.metal, null, SOLID) // socle métal
box([0.8, 1.9, 1.2], [0.55, 1.15, 0], M.body, null, SOLID) // caisse en bois
box([0.8, 0.012, 0.006], [0.55, 1.545, -0.603], M.chrome) // filet chromé
box([0.012, 1.9, 0.006], [0.948, 1.15, -0.603], M.chrome)
box([0.012, 2.1, 0.006], [0.152, 1.05, -0.603], M.chrome)
box([0.66, 0.46, 0.012], [0.55, 1.8, -0.606], M.dark) // cadre de l'affiche
box([0.62, 0.42, 0.014], [0.55, 1.8, -0.608], M.poster)
for (const x of [0.8, 0.76, 0.34, 0.3]) for (let r = 0; r < shotsN(); r++) box([0.03, 0.04, 0.004], [x, 1.8 + ((shotsN() - 1) / 2 - r) * 0.05, -0.616], M.dark, null, { castShadow: false }) // une mini-photo par pose
// fente de sortie : capot chromé, plaque orange, voyant
box([0.13, 0.42, 0.05], [SLOT_X, 1.17, -0.625], M.chrome)
box([0.1, 0.12, 0.004], [SLOT_X, 1.29, -0.652], { color: '#e2572b', metalness: 0, roughness: 0.6 })
box([0.1, 0.006, 0.004], [SLOT_X, 0.963, -0.652], M.dark) // lèvre de la fente
const led = sph(0.012, [SLOT_X, 1.19, -0.652], { color: '#2bd46a', emissive: '#2bd46a', emissiveIntensity: 0.2, metalness: 0, roughness: 0.4 }, { castShadow: false })
// cabine (à droite vu de face = -X) : plancher en damier, murs, rideaux
box([1.1, 0.04, 1.2], [-0.4, 0.02, 0], M.metal, null, SOLID)
for (let i = 0; i < 8; i++) for (let k = 0; k < 8; k++) box([0.1375, 0.004, 0.15], [0.08125 - i * 0.1375, 0.042, -0.525 + k * 0.15], (i + k) % 2 ? M.tileB : M.tileW, null, { castShadow: false })
box([1.1, 2.06, 0.04], [-0.4, 1.07, 0.58], M.wall, null, SOLID) // fond
box([0.04, 2.06, 1.2], [-0.93, 1.07, 0], M.wall, null, SOLID) // côté
box([1.92, 0.05, 1.22], [0, 2.125, 0], M.metal, null, SOLID) // toit
for (const [x, z] of [[-0.93, -0.585], [-0.93, 0.585]]) cyl(0.018, 0.018, 2.1, [x, 1.05, z], M.chrome)
box([1.1, 0.04, 0.03], [-0.4, 2.08, -0.585], M.chrome) // traverse avant
// décors du mur en face de l'objectif (un seul visible à la fois)
const decorCurtain = app.create('group')
app.add(decorCurtain)
PARENT = decorCurtain
for (let i = 0; i < 11; i++) box([0.015, 1.25, 0.075], [-0.895, 1.33, -0.42 + i * 0.085], M.curtain, [0, i % 2 ? -0.5 : 0.5, 0], { castShadow: false }) // rideau rouge
PARENT = app
const decorPlain = box([0.01, 1.5, 1.12], [-0.905, 1.3, 0], { color: PLAIN.blanc, metalness: 0, roughness: 0.9 }, null, { castShadow: false, active: false })
const decorImg = app.create('image', { src: null, width: 1.12, height: 1.5, fit: 'cover', position: [-0.899, 1.3, 0], rotation: [0, Math.PI / 2, 0], lit: false, doubleside: false, castShadow: false, receiveShadow: false, active: false })
app.add(decorImg)
const decorIndex = v => (Number.isInteger(v) && v >= 0 && v < DECORS.length ? v : DECOR_DEFAULT)
function applyDecor(i) {
  const d = DECORS[decorIndex(i)]
  const url = d.img && props[d.img] && props[d.img].url
  decorCurtain.active = d.key === 'rideau'
  decorPlain.active = !!PLAIN[d.key]
  if (PLAIN[d.key]) decorPlain.color = PLAIN[d.key]
  decorImg.active = !!url
  decorImg.src = url || null
  return d
}
applyDecor(app.state.decor)
cyl(0.01, 0.01, 1.04, [-0.4, 1.98, -0.57], M.chrome, AXLE_X) // tringle avant
// rideau de la porte : plis qui glissent sur la tringle (tiré sur le côté = libre, fermé = occupé)
const DOOR_N = 14
const doorPleats = []
for (let i = 0; i < DOOR_N; i++) doorPleats.push(box([0.085, 1.86, 0.015], [0, 1.04, -0.57], M.curtain, null, { castShadow: false }))
function setDoor(t) { // 0 = ouvert, 1 = fermé
  doorPleats.forEach((n, i) => {
    const xo = -0.9 + i * 0.019 // plis serrés côté extérieur
    const xc = -0.88 + (i * 0.98) / (DOOR_N - 1) // étalés sur toute l'ouverture
    n.position.x = xo + (xc - xo) * t
    n.rotation.y = (i % 2 ? -1 : 1) * (0.75 - 0.4 * t)
  })
}
setDoor(0)
// paroi de la caméra (intérieur du meuble, face à -X) : panneau, objectif, flash
box([0.03, 0.83, 0.5], [0.135, 1.355, 0.05], M.dark) // panneau : écran en bas, objectif réglable jusqu'à 1,70 m
cyl(0.055, 0.055, 0.04, [0.11, camY(), 0.05], M.chrome, AXLE_X)
cyl(0.044, 0.044, 0.004, [0.087, camY(), 0.05], { color: '#ffffff', metalness: 0, roughness: 0.35 }, AXLE_X) // mince contour blanc
cyl(0.04, 0.04, 0.045, [0.105, camY(), 0.05], M.glass, AXLE_X)
const flashPanel = box([0.02, 0.08, 0.4], [0.14, 1.86, 0.05], { color: '#f4f4f4', emissive: '#ffffff', emissiveIntensity: 0.15, metalness: 0, roughness: 0.3 })
// banquette 2 places adossée au rideau du fond (assises à ~0,7 m de l'objectif)
const BENCH_X = -0.64 // centre de l'assise
const SEAT_Z = [-0.17, 0.27] // deux places, centrées sur l'objectif (z 0,05)
box([0.36, 0.36, 0.9], [BENCH_X, 0.22, 0.05], M.metal) // socle
box([0.42, 0.08, 0.92], [BENCH_X, 0.44, 0.05], M.bench) // coussin d'assise
box([0.08, 0.36, 0.92], [BENCH_X - 0.2, 0.68, 0.05], M.bench) // dossier
box([0.4, 0.004, 0.006], [BENCH_X, 0.481, 0.05], M.dark) // couture entre les places
const seats = SEAT_Z.map((z, i) => {
  const a = app.create('anchor', { id: 'banquette-' + (i + 1), position: [BENCH_X + 0.02, 0.48, z], rotation: [0, -Math.PI / 2, 0] }) // assis face à l'objectif (+X)
  app.add(a)
  return a
})
// tableaux en liège aux deux extrémités (on y épingle les strips)
for (const B of BOARDS) {
  box([0.03, 0.74, 0.92], [B.dir * 0.965, BOARD_Y, 0], { color: '#5b3d24', metalness: 0, roughness: 0.6 }) // cadre
  box([0.004, 0.68, 0.86], [B.dir * 0.982, BOARD_Y, 0], { color: '#b98a5a', metalness: 0, roughness: 0.95 }, null, { castShadow: false }) // liège
}
// enseigne lumineuse posée sur le toit (au ras de la façade)
const SIGN_Y = 2.33
box([1.5, 0.36, 0.08], [0, SIGN_Y, -0.52], { color: SIGN_FACE, emissive: '#fff6e0', emissiveIntensity: 0.35, metalness: 0, roughness: 0.6 })
box([1.52, 0.38, 0.06], [0, SIGN_Y, -0.508], M.chrome)

const control = world.isClient ? app.control() : null

// ---------- Sol (raycast vers le bas, repère app) ----------
function groundY(x, fromY, z, fallback) {
  const o = new Vector3(x, fromY, z).applyMatrix4(app.matrixWorld)
  const hit = world.raycast(o, new Vector3(0, -1, 0), 6, world.createLayerMask('environment'))
  if (!hit) return fallback
  const p = new Vector3().copy(hit.point).applyMatrix4(new Matrix4().copy(app.matrixWorld).invert())
  return p.y
}
const SLOT_Q = new Quaternion().setFromEuler(new Euler(0, Math.PI, 0, 'YXZ'))
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
  const floorSpot = () => [FLOOR_P[0], r3(groundY(FLOOR_P[0], 1.0, FLOOR_P[1], 0)), FLOOR_P[1]]
  const save = () => world.set(KEY, { strips: st.strips, decor: st.decor })
  const broadcast = ev => app.send('state', { phase: st.phase, strips: st.strips, ev: ev || null })
  const fin = (v, lim) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim
  const vec = (a, lim) => Array.isArray(a) && a.length === 3 && a.every(v => fin(v, lim)) ? a.map(r3) : null
  const quat = a => Array.isArray(a) && a.length === 4 && a.every(v => fin(v, 1.01)) ? a : null

  const saved = world.get(KEY)
  st.phase = 'idle'
  const all = saved && Array.isArray(saved.strips) ? saved.strips : []
  const taken = new Set()
  const pinnedOk = all.filter(s => s.mode === 'pinned' && (s.board === 0 || s.board === 1) && Number.isInteger(s.slot) && s.slot >= 0 && s.slot < BOARD_SLOTS && !taken.has(s.board + ':' + s.slot) && taken.add(s.board + ':' + s.slot))
  const looseOk = all.filter(s => s.mode !== 'pinned').slice(-MAX_STRIPS)
  st.strips = all.filter(s => pinnedOk.includes(s) || looseOk.includes(s))
  st.decor = decorIndex(saved && saved.decor)
  applyDecor(st.decor)
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
    const n = shotsN() // lu au départ : un changement de réglage en cours de séance attend la suivante
    st.phase = 'session'
    sid++
    photos = []
    shotPids = []
    names = []
    urls = []
    shooters = []
    starter = pid
    curStrip = null
    for (let i = 0; i < n; i++) { photos.push([]); shotPids.push([]); urls.push(null); shooters.push(null) }
    broadcast()
    const my = sid
    for (let i = 0; i < n; i++) {
      const b = 1 + i * SHOT_GAP
      for (let c = 3; c >= 1; c--) later(b + 3 - c, () => app.send('tick', { i, n: c, of: n }))
      later(b + 3, () => { shot = i; shooters[i] = pickShooter(); app.send('shoot', { sid: my, i, cam: shooters[i] }) })
      later(b + SHOT_GAP, () => { if (shot === i) shot = -1 })
    }
    const end = 1 + n * SHOT_GAP + 0.2
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
    for (;;) { // la plus vieille strip libre disparaît ; les strips épinglées restent
      const loose = st.strips.filter(s => s.mode !== 'pinned')
      const old = loose.length > MAX_STRIPS && loose.find(s => s.mode !== 'held')
      if (!old) break
      st.strips.splice(st.strips.indexOf(old), 1)
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
  app.on('decor', (d, nid) => {
    const p = owner(d, nid)
    if (!p || !inside(localOf(p), 1.5)) return // près de la cabine seulement
    st.decor = (st.decor + 1) % DECORS.length
    save()
    app.send('decor', { decor: st.decor })
  })
  app.on('photo', (d, nid) => {
    const p = owner(d, nid)
    if (!p || !urls || d.sid !== sid || !Number.isInteger(d.i) || d.i < 0 || d.i >= urls.length) return
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
    const at = new Vector3().fromArray(s.mode === 'slot' ? [SLOT_X, SLOT_Y1, SLOT_Z] : s.mode === 'pinned' ? pinPos(s.board, s.slot) : s.pos)
    if (localOf(p).distanceTo(at) > 4) return
    Object.assign(s, { mode: 'held', holder: p.id })
    save()
    broadcast()
  })
  const fromOf = (d, pl) => {
    const fp = vec(d.from && d.from.p, 50)
    const fq = quat(d.from && d.from.q)
    return fp && fq ? { p: fp, q: fq } : { p: [pl.x, pl.y + 1.3, pl.z], q: [0, 0, 0, 1] }
  }
  app.on('drop', (d, nid) => {
    const p = owner(d, nid)
    const s = p && byId(d.id)
    if (!s || s.holder !== p.id) return
    const pl = localOf(p)
    let to = vec(d.to, 50)
    if (!to || Math.hypot(to[0] - pl.x, to[2] - pl.z) > 3 || Math.abs(to[1] - pl.y) > 3) to = [r3(pl.x), r3(pl.y), r3(pl.z)]
    Object.assign(s, { mode: 'floor', holder: null, pos: to, yaw: fin(d.yaw, 10) ? d.yaw : 0 })
    save()
    broadcast([{ t: 'fall', id: s.id, from: fromOf(d, pl), by: p.id }])
  })
  app.on('pin', (d, nid) => {
    const p = owner(d, nid)
    const s = p && byId(d.id)
    if (!s || s.holder !== p.id) return
    const pl = localOf(p)
    const b = d.board
    const B = (b === 0 || b === 1) && BOARDS[b]
    const ahead = B && (pl.x - B.x) * B.dir
    const near = B && ahead > -0.2 && ahead < 2.5 && Math.abs(pl.z) < 2 // devant le tableau
    const used = st.strips.filter(x => x.mode === 'pinned' && x.board === b).map(x => x.slot)
    const free = near ? [...Array(BOARD_SLOTS).keys()].filter(k => !used.includes(k)) : []
    if (!free.length) { // tableau plein ou trop loin : la strip tombe à ses pieds
      Object.assign(s, { mode: 'floor', holder: null, pos: [r3(pl.x), r3(groundY(pl.x, pl.y + 0.5, pl.z, pl.y)), r3(pl.z)], yaw: rnd() * TAU })
    } else {
      const zWant = fin(d.z, 5) ? d.z : 0
      free.sort((a, c) => Math.abs(pinPos(b, a)[2] - zWant) - Math.abs(pinPos(b, c)[2] - zWant))
      Object.assign(s, { mode: 'pinned', holder: null, board: b, slot: free[0], tilt: r3((rnd() - 0.5) * 0.12), pos: null })
    }
    save()
    broadcast([{ t: 'fall', id: s.id, from: fromOf(d, pl) }])
  })
  world.on('leave', e => {
    const held = st.strips.filter(s => s.holder === e.playerId)
    if (!held.length) return
    const p = world.getPlayer(e.playerId)
    const pl = p ? localOf(p) : new Vector3(FLOOR_P[0], 0, FLOOR_P[1])
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
  const roomLight = app.create('light', { type: 'point', color: '#ffe2b8', intensity: ROOM_LIGHT, distance: 3, position: [-0.45, 1.95, 0] })
  app.add(roomLight)
  const flashLight = app.create('light', { type: 'point', color: '#ffffff', intensity: 0, distance: 4, position: [-0.25, 1.65, 0.05] })
  app.add(flashLight)
  const screenUi = uiPanel([0.118, 1.08, 0.05], -Math.PI / 2, 240, 170, 0.0015, '#0b0f12')
  screenUi.flexDirection = 'column'
  const big = uiText(screenUi, 'PRÊT', 72, '#ffd27a', 800)
  const small = uiText(screenUi, 'Appuie sur E', 20, '#c9ced4', 400)
  const signUi = uiPanel([0, SIGN_Y, -0.562], Math.PI, 560, 130, 0.0025)
  signUi.flexDirection = 'column'
  uiText(signUi, 'PHOTOS', 92, SIGN_TEXT, 800)
  uiText(signUi, 'ÉCLAIRAGE ÉLECTRONIQUE  ·  PHOTOS NETTES ET CLAIRES', 17, '#3a3a3a', 700)
  const posterUi = uiPanel([0.55, 1.8, -0.616], Math.PI, 300, 200, 0.0014)
  posterUi.flexDirection = 'column'
  uiText(posterUi, 'PRENEZ VOS', 20, '#2a2118', 800)
  uiText(posterUi, 'PHOTOS', 46, '#2a2118', 800)
  uiText(posterUi, String(shotsN()), 54, '#2a2118', 800)
  uiText(posterUi, 'POSES DIFFÉRENTES', 16, '#2a2118', 700)
  const busyUi = uiPanel([-0.4, 2.02, -0.602], Math.PI, 300, 60, 0.002, '#1b1b1f')
  const busy = uiText(busyUi, 'LIBRE', 40, '#3ddc84', 800)
  const outUi = uiPanel([SLOT_X, 1.29, -0.6545], Math.PI, 200, 120, 0.0005)
  outUi.flexDirection = 'column'
  uiText(outUi, 'PHOTOS', 34, '#ffffff', 800)
  uiText(outUi, 'ICI', 34, '#ffffff', 800)
  const action = app.create('action', { label: 'Prendre les photos', distance: 1.6, duration: 0.4, position: [0.1, 1.08, 0.05], onTrigger: () => { const p = me(); if (p) app.send('start', { pid: p.id }) } })
  app.add(action)
  // shortcut: les places ne sont pas réservées (deux joueurs peuvent prendre la même), à synchroniser si ça gêne
  // décor : un clic SUR le décor (pas une action de proximité, qui se déclenchait aussi depuis le tableau en liège)
  const nextDecor = e => { const p = me(); if (p) app.send('decor', { pid: p.id }); if (e && e.stopPropagation) e.stopPropagation() }
  for (const n of [decorCurtain, decorPlain, decorImg]) { n.onPointerDown = nextDecor; n.cursor = 'pointer' }
  applyDecor(app.state.decor)
  app.on('decor', d => { applyDecor(d.decor) })
  seats.forEach((seat, i) => {
    app.add(app.create('action', { label: "S'asseoir", distance: 1.6, duration: 0.3, position: [BENCH_X, 0.5, SEAT_Z[i]], onTrigger: () => sitOn(seat) }))
  })

  // assis : caméra 3e personne au plus près, gardée dans la cabine (sinon le mur du fond la pousse dans la tête)
  let seatCam = false
  let seatYaw = -Math.PI / 2, seatPitch = -0.1 // repère app : face à l'objectif (+X)
  function sitOn(seat) {
    const p = me()
    if (!p) return
    p.applyEffect({ anchor: seat, cancellable: true, onEnd: endSeatCam })
    seatCam = true
    seatYaw = -Math.PI / 2
    seatPitch = -0.1
    control.camera.write = true
    wake()
  }
  function endSeatCam() {
    if (!seatCam) return
    seatCam = false
    control.camera.write = false
  }
  // assis = le moteur place le joueur sur l'ancre ; debout près de la banquette ne compte pas
  const seatedHere = p => { const v = new Vector3().copy(p.position).applyMatrix4(inv()); return seats.some(a => v.distanceTo(a.position) < 0.15) }
  function seatCamera(p, dt) {
    const ptr = control.pointer
    if (ptr && ptr.locked) { // même réglage que la vue normale du moteur (POINTER_LOOK_SPEED 0,1)
      seatYaw -= ptr.delta.x * 0.1 * dt
      seatPitch = clamp(seatPitch - ptr.delta.y * 0.1 * dt, -1.4, 1.4)
    }
    const qL = new Quaternion().setFromEuler(new Euler(seatPitch, seatYaw, 0, 'YXZ'))
    const im = inv()
    const head = p.getBoneTransform('head')
    const c = head ? new Vector3().setFromMatrixPosition(head).applyMatrix4(im) : new Vector3().copy(p.position).applyMatrix4(im).add(new Vector3(0, 0.75, 0))
    const f = new Vector3(0, 0, -1).applyQuaternion(qL)
    const r = new Vector3().crossVectors(f, up).normalize()
    c.addScaledVector(r, SEAT_RIGHT).addScaledVector(f, -SEAT_BACK)
    c.set(clamp(c.x, SEAT_BOX.x0, SEAT_BOX.x1), clamp(c.y, SEAT_BOX.y0, SEAT_BOX.y1), clamp(c.z, SEAT_BOX.z0, SEAT_BOX.z1))
    control.camera.position.copy(c.applyMatrix4(app.matrixWorld))
    control.camera.quaternion.copy(appQ()).multiply(qL)
    control.camera.zoom = 0 // le moteur recule la caméra de `zoom` derrière la position écrite (sinon : écran noir)
  }

  // sons
  const snd = (prop, pos, volume) => { const a = app.create('audio', { src: props[prop] && props[prop].url, volume, group: 'sfx', spatial: true, position: pos }); app.add(a); return a }
  const sBip = snd('sndBip', [0.1, 1.08, 0.05], 0.6)
  const sClic = snd('sndClic', [0.1, camY(), 0.05], 0.9)
  const sMoteur = snd('sndMoteur', [SLOT_X, 1.17, SLOT_Z], 0.7)
  const sPapier = snd('sndPapier', [0, 1, 0], 0.8)

  // ----- pool de strips (créé à la demande hors update, réutilisé ensuite) -----
  const slots = []
  function makeSlot() {
    const g = app.create('group')
    app.add(g)
    PARENT = g
    const paper = box([STRIP_W, 1, 0.002], [0, 0, 0], M.paper, null, { castShadow: false, scale: [1, STRIP_H, 1] })
    const pin = sph(0.007, [0, STRIP_H / 2 - 0.012, 0.004], { color: '#d0262a', metalness: 0.2, roughness: 0.4 }, { castShadow: false, active: false }) // punaise
    const men = []
    const imgs = []
    const bgs = []
    for (let i = 0; i < SHOTS; i++) {
      bgs.push(box([CASE, CASE, 0.0006], [0, caseY(i), 0.0013], M.bg, null, { castShadow: false }))
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
    const slot = { g, paper, pin, label, bgs, men, imgs, names, date, id: null, sig: null, act: null }
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
    const n = clamp(Array.isArray(s.photos) ? s.photos.length : SHOTS, 1, SHOTS)
    slot.paper.scale.y = stripH(n)
    slot.paper.position.y = STRIP_H / 2 - stripH(n) / 2 // le haut de la strip reste au même endroit
    slot.label.position.y = -0.18 + (SHOTS - n) * (CASE + 0.006)
    for (let i = 0; i < SHOTS; i++) {
      const list = (i < n && s.photos && s.photos[i]) || []
      const url = (i < n && urls[i]) || null
      slot.bgs[i].active = i < n
      slot.imgs[i].active = i < n
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
    if (s.mode === 'pinned' && BOARDS[s.board]) return { p: new Vector3().fromArray(pinPos(s.board, s.slot)), q: new Quaternion().setFromEuler(new Euler(0, (BOARDS[s.board].dir * Math.PI) / 2, s.tilt || 0, 'YXZ')) }
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
      sl.pin.active = s.mode === 'pinned'
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
  const DOOR_TIME = 0.8 // s pour fermer/ouvrir le rideau
  let doorT = 0, doorTarget = 0
  function phaseUI(prev) {
    doorTarget = S.phase === 'idle' ? 0 : 1 // rideau fermé tant que la cabine est OCCUPÉE
    if (prev === null) { doorT = doorTarget; setDoor(doorT) } // arrivée en cours de séance : pas d'animation

    set(busy, 'value', S.phase === 'idle' ? 'LIBRE' : 'OCCUPÉ')
    set(busy, 'color', S.phase === 'idle' ? '#3ddc84' : '#ff4d4d')
    action.active = S.phase === 'idle'
    roomLight.intensity = S.phase === 'session' && props.lightOff === true ? 0 : ROOM_LIGHT // éteinte seulement pendant les 5 déclics
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
  app.on('tick', d => { set(big, 'value', String(d.n)); set(small, 'value', 'Photo ' + (d.i + 1) + '/' + (d.of || SHOTS)); sBip.play(true) })
  app.on('shoot', d => {
    set(big, 'value', 'CLIC !')
    sClic.play(true)
    flashT = 0.15
    flashPanel.emissiveIntensity = 8
    flashLight.intensity = flashLevel()
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
      pts.push(r3(-v.z), r3(v.y), r3(v.x)) // repère caméra : l'objectif regarde vers -X, sa droite est -Z
    }
    app.send('pose', { pid: p.id, sid: d.sid, i: d.i, p: pts })
  })

  // ----- vraie photo depuis l'objectif (seul le photographe désigné par le serveur) -----
  let warnedFilter = false
  function takePhoto(d, p) {
    if (typeof world.capturePhoto !== 'function') return // ancien moteur : mannequins seulement
    const position = new Vector3(CAM_POS[0], camY(), CAM_POS[2]).applyMatrix4(app.matrixWorld)
    const quaternion = appQ().multiply(new Quaternion().setFromEuler(new Euler(CAM_PITCH, CAM_YAW, 0, 'YXZ')))
    const sl = hold && slotOf(hold.id)
    const pid = p.id
    const opts = { position, quaternion, fov: camFov(), width: PHOTO_PX, height: PHOTO_PX, quality: 0.85, hide: sl ? [sl.g] : [] }
    const filter = photoFilter()
    if (filter) opts.filter = filter // shortcut: ignoré tant que le moteur n'a pas l'option `filter` (demande à Jérôme) → photo en couleur
    let req
    try {
      req = world.capturePhoto(opts)
    } catch (e) { console.warn('[photomaton] capture :', e && e.message); return }
    req.then(r => {
      if (opts.filter && r.filter !== opts.filter && !warnedFilter) { warnedFilter = true; console.warn('[photomaton] filtre « ' + opts.filter + ' » non pris en charge par ce moteur : photo en couleur') }
      app.send('photo', { pid, sid: d.sid, i: d.i, url: r.url })
    })
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
    const b = facingBoard(pl)
    if (b >= 0) { // face à un tableau : on y épingle la strip (le serveur choisit la place)
      app.send('pin', { pid: me().id, id: h.id, board: b, z: r3(p0.z), from: { p: p0.toArray(), q: q0.toArray() } })
      return
    }
    const y = groundY(p0.x, p0.y + 0.05, p0.z, pl.y)
    const yaw = rnd() * TAU
    const to = [r3(p0.x), r3(y), r3(p0.z)]
    app.send('drop', { pid: me().id, id: h.id, from: { p: p0.toArray(), q: q0.toArray() }, to, yaw })
    startFall(h.id, p0, q0, new Vector3(to[0], to[1] + 0.001, to[2]), floorQ(yaw))
  }

  // tableau devant lequel je me tiens et que je regarde (-1 sinon)
  function facingBoard(pl) {
    const look = new Vector3(0, 0, -1).applyQuaternion(control.camera.quaternion).applyQuaternion(appQ().invert())
    for (let b = 0; b < BOARDS.length; b++) {
      const B = BOARDS[b]
      const ahead = (pl.x - B.x) * B.dir
      if (ahead > 0 && ahead < 1.8 && Math.abs(pl.z) < 1.2 && look.x * B.dir < -0.4) return b
    }
    return -1
  }

  // ----- boucle (réveillée seulement quand quelque chose bouge) -----
  const tv = new Vector3(), tq = new Quaternion(), fwd = new Vector3(), up = new Vector3(0, 1, 0)
  function needsUpdate() {
    return !!hold || seatCam || anims.size > 0 || flashT > 0 || doorT !== doorTarget || S.phase === 'develop' || S.strips.some(s => s.mode === 'held')
  }
  function wake() { if (!awake && needsUpdate()) { awake = true; app.on('update', update) } }
  function sleep() { awake = false; app.off('update', update) }
  function update(dt) {
    clock += dt
    if (doorT !== doorTarget) {
      doorT = doorTarget > doorT ? Math.min(doorTarget, doorT + dt / DOOR_TIME) : Math.max(doorTarget, doorT - dt / DOOR_TIME)
      setDoor(doorT * doorT * (3 - 2 * doorT))
    }
    if (flashT > 0) {
      flashT -= dt
      if (flashT <= 0) { flashPanel.emissiveIntensity = 0.15; flashLight.intensity = 0 }
    }
    if (seatCam) {
      const p = me()
      if (!p || !seatedHere(p)) endSeatCam() // effet remplacé ailleurs sans onEnd : on rend la caméra
      else seatCamera(p, dt)
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
          // vraie caméra = pivot reculé de `zoom` (3e personne) ; la strip se place devant elle
          tv.copy(control.camera.position).addScaledVector(fwd, HOLD_DIST - (control.camera.zoom || 0)).applyMatrix4(inv())
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
  app.on('destroy', () => { endSeatCam(); control.release() })

  // crochet de test (banc de simulation)
  props.__test = { slots, anims, get hold() { return hold }, get awake() { return awake }, get seatCam() { return seatCam }, get S() { return S }, screen: () => [big.value, small.value, busy.value] }
}
