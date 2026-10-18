/*
 * MOTO VOLANTE X8 « RACER » : moto de course carénée style GP, propulsée par 8 rotors coaxiaux (Hyperfy 0.16, script-only)
 *
 * REPÈRE : mètres, +Y haut, +X droite, -Z AVANT, origine AU SOL sous la moto (patins sortis à y = 0).
 * Le root de l'app ne bouge jamais : `rig` porte position + cap, `tilt` le cabrage/roulis (pivot au centre de gravité),
 * `body` la vibration. Tout le modèle (y compris le pilote) est enfant de `body`.
 *
 * PILOTE : l'ancre de siège de Hyperfy impose une pose assise à l'avatar (elle passe après les emotes). Pendant le
 * pilotage, l'avatar du joueur est donc remplacé par un avatar VRM invisible (prop `ghostAvatar`) et le pilote visible
 * est un mannequin en primitives posé par cinématique inverse (mains sur les poignées, pieds sur les repose-pieds).
 * L'avatar normal revient à la descente.
 *
 * Contrôles (monté) : W/S avant-arrière · A/D latéral · ↑/↓ monter-descendre · ←/→ lacet
 *   Souris (pointeur verrouillé) : orbite caméra · molette : distance, à fond = 1re personne · V : 1re/3e personne
 *   Descendre : Espace, ou E maintenu (0,5 s), près du sol et à l'arrêt.
 */

// ============================== COULEURS (aucun logo, aucun numéro, aucun lettrage) ==============================
const BODY_COLOR = '#1f4e9c'          // bleu métallique (peinture laquée métallisée)
const ACCENT_COLOR = '#2b2e33'        // gris anthracite : bandes, menton, ailettes
const ACCENT_DARK = '#0e0f11'         // noir mat : bas de carénage, bout des ailettes
const SUIT_COLOR_MAIN = '#141518'     // combinaison : noir
const SUIT_COLOR_ACCENT = '#6c7178'   // panneaux gris (épaules, flancs, avant-bras, genoux)
const HELMET_COLOR = '#111214', VISOR_COLOR = '#1d2433'
// ============================== POUSSIÈRE FINE (décollage / atterrissage) ==============================
const DUST_COLOR_A = '#CBBFA8'        // beige sable
const DUST_COLOR_B = '#A8A8A8'        // gris clair
const DUST_SIZE = 0.02                // m : diamètre moyen d'une particule (1–3 cm)
const DUST_OPACITY = 0.4              // opacité de départ (fond jusqu'à 0)
const DUST_COUNT = 220                // taille du pool (voile continu + rafales)
const DUST_MAX_ALTITUDE = 6           // m : au-delà, aucune poussière (maximale sous 2 m)
// ============================== OPTIONS ==============================
const DEFAULT_RIDER_MODE = 'costume'  // mode à chaque montage : 'costume' (pilote modélisé) ou 'avatar' (ton avatar) ; K bascule
const OPTS = {
  retractGear: true,      // patins qui se replient au-dessus de gearUpAlt
  gearUpAlt: 1.5,         // m
}
// ============================== PHYSIQUE (tout se règle ici) ==============================
const CFG = {
  mass: 235,                 // kg, moto + carrosserie + pilote
  twr: 2.2,                  // poussée max / poids  -> poussée max = mass * g * twr
  g: 9.81,
  vMaxFwd: 20, vMaxBack: 10, vMaxSide: 12,   // m/s horizontal
  vMaxUp: 6, vMaxDown: 6,                    // m/s vertical
  maxTiltDeg: 20,            // inclinaison max (pitch/roll) -> accélération horizontale max = g*tan(tilt)
  dragLin: 0.03, dragQuad: 0.006,            // traînée : a = (lin + quad*|v|) * v
  velGain: 1.2,              // gain du suiveur de vitesse horizontale
  climbAccel: 4,             // m/s², accélération verticale max
  velGainV: 5,               // gain du suiveur de vitesse verticale
  altMax: 120,               // m au-dessus du sol
  yawRate: 1.6,              // rad/s
  aeroStab: 0.6,             // à vitesse max, turbulences et balancement réduits de 60 % (carénage)
  cgY: 0.68, cgZ: -0.05,     // centre de gravité (pivot de cabrage/roulis), abaissé avec la moto (sans roues)
  rideDrop: 0.12,            // la moto est posée 12 cm plus bas qu'avec les roues (patins plus courts)
  batteryMinutes: 10,        // autonomie en vol stationnaire
  batteryLow: 0.2,           // sous 20 % : performances réduites
  rechargeMinutes: 6,        // 0 -> 100 % à l'arrêt (calculé par le serveur au montage)
  minBatToMount: 0.05,
  rpmIdle: 0.3, rpmLift: 0.64,               // régime au sol / régime mini pour décoller
  spoolUp: 1.4, spoolDown: 2.0,              // constantes de temps du régime (s)
  groundEffectAlt: 1.5, groundEffectGain: 0.12,
  dismountAlt: 1.0, dismountSpeed: 1.5,      // conditions pour descendre
  propOmega: 75,             // rad/s affichés à régime 1.0
  blurRpm: 0.5,              // au-delà : disque flou à la place des pales
  poseHz: 12,                // fréquence d'envoi de la pose du pilote
  seatY: 0.975,              // dessus de la selle (ancre du joueur)
  camDist: 2.6, camHeight: 1.05, camPitch: -0.12,   // caméra 3e personne (plus basse et plus proche)
  camSpeedPull: 0.3,         // recul supplémentaire à vitesse max (sensation de vitesse, voir note FOV)
  fpEyeUp: 0.1, fpEyeBack: 0.15, fpPitch: -0.5,    // 1re personne : œil dans le casque (m), regard baissé (rad)
  postureRate: 5,            // vitesse des transitions de posture (1/s)
}
const GRAV = CFG.g
const MAX_THRUST = CFG.mass * GRAV * CFG.twr
const RPM_HOVER = Math.sqrt(1 / CFG.twr)
const MAX_TILT = CFG.maxTiltDeg * DEG2RAD
const A_MAX_H = GRAV * Math.tan(MAX_TILT)
const landSpeed = alt => Math.min(CFG.vMaxDown, 0.25 + Math.sqrt(4 * Math.max(0, alt)))   // vitesse de descente max à une hauteur donnée

// ============================== OUTILS ==============================
const isServer = world.isServer
const isClient = world.isClient
const PI = Math.PI
const TAU = PI * 2
let seed = 1234567
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const fin = v => (Number.isFinite(v) ? v : 0)
const r3 = v => Math.round(v * 1000) / 1000
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d }
const lerp = (a, b, t) => a + (b - a) * t
const hasV3 = typeof Vector3 === 'function'

const cleanPose = d => ({
  x: clamp(fin(d.x), -20000, 20000), y: clamp(fin(d.y), -2000, 20000), z: clamp(fin(d.z), -20000, 20000),
  yaw: fin(d.yaw), pitch: clamp(fin(d.pitch), -0.6, 0.6), roll: clamp(fin(d.roll), -0.6, 0.6),
  rpm: clamp(fin(d.rpm), 0, 1), gy: clamp(fin(d.gy), -2000, 20000),
})

// réglage facultatif dans l'inspecteur de l'app : ton fichier VRM (le même que ton avatar), pour le mode « Avatar du joueur »
app.configure([{ type: 'file', key: 'riderAvatar', label: 'Ton avatar (VRM) pour le mode avatar (K)', kind: 'avatar' }])
const RIDER_MODES = ['costume', 'avatar']
const riderUrl = () => (props && props.riderAvatar && props.riderAvatar.url) || null

// ============================== ÉTAT PARTAGÉ ==============================
const S = app.state
if (isServer && S.driver === undefined) {
  S.driver = null                       // id du joueur pilote
  S.bat = 1                             // batterie 0..1
  S.parkT = Date.now()                  // heure serveur de l'arrêt (pour la recharge)
  S.pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, rpm: 0, gy: 0 }
  S.mode = DEFAULT_RIDER_MODE           // 'costume' ou 'avatar' (synchronisé)
}

// ============================== SERVEUR ==============================
if (isServer) {
  const pidOf = nid => { const p = world.getPlayers().find(p => p.networkId === nid); return p ? p.id : null }
  const free = () => {
    S.driver = null
    S.parkT = Date.now()
    S.pose.y = S.pose.gy; S.pose.pitch = 0; S.pose.roll = 0; S.pose.rpm = 0
    app.send('hb:driver', { driver: null, pose: S.pose, bat: S.bat })
  }
  // L'ancre de siège impose une pose assise (elle passe après les emotes) SAUF si une pose de siège est enregistrée pour
  // (joueur, avatar, ancre). On enregistre une pose « neutre » (un seul os, sans effet visible) : l'emote de posture garde la main.
  // ponytail: dépend du format de stockage interne du fork (seatPose.js, version 1) ; à revoir si le fork change ce format
  const seatS = app.create('anchor', { id: 'seat' }); app.add(seatS)
  function neutralSeat(id) {
    const p = world.getPlayer(id), anchorId = seatS.anchorId
    if (!p || !anchorId || !world.set) return
    const user = p.userId || p.id, enc = v => encodeURIComponent(String(v))
    for (const url of [riderUrl(), 'asset://avatar.vrm']) if (url)
      world.set(`seatPose:${enc(user)}:${enc(url)}:${enc(anchorId)}`,
        { version: 1, anchorId, avatarUrl: url, offset: [0, 0, 0], rotation: [0, 0, 0, 1], pose: { leftEye: { rotation: [0, 0, 0, 1] } } })
  }
  app.on('hb:mount', (d, nid) => {
    const id = pidOf(nid)
    if (!id || S.driver) return
    S.bat = Math.min(1, S.bat + (Date.now() - S.parkT) / (CFG.rechargeMinutes * 60000))
    if (S.bat < CFG.minBatToMount) return
    S.driver = id
    S.mode = DEFAULT_RIDER_MODE
    neutralSeat(id)
    app.send('hb:driver', { driver: id, pose: S.pose, bat: S.bat, mode: S.mode })
  })
  app.on('hb:mode', (d, nid) => {
    if (!d || !S.driver || S.driver !== pidOf(nid) || !RIDER_MODES.includes(d.mode)) return
    S.mode = d.mode
    app.send('hb:mode', { mode: S.mode }, nid)
  })
  app.on('hb:pose', (d, nid) => {            // ponytail: aucune vérification de vitesse/téléportation (pas d'anti-triche)
    if (!d || !S.driver || S.driver !== pidOf(nid)) return
    S.pose = cleanPose(d)
    S.bat = clamp(fin(d.bat), 0, 1)
    app.send('hb:pose', Object.assign({ bat: S.bat }, S.pose), nid)
  })
  app.on('hb:dismount', (d, nid) => {
    if (!d || !S.driver || S.driver !== pidOf(nid)) return
    S.pose = cleanPose(d)
    S.bat = clamp(fin(d.bat), 0, 1)
    free()
  })
  world.on('leave', e => { if (e.playerId === S.driver) free() })   // pilote déconnecté : la moto se pose
}

// ============================== CLIENT ==============================
if (isClient) {
  // ---------- matériaux ----------
  const leather = c => ({ color: c, metalness: 0.05, roughness: 0.55 })
  const M = {
    main: { color: BODY_COLOR, metalness: 0.8, roughness: 0.25 },             // bleu métallisé (pas de clearcoat dans les prims)
    accent: { color: ACCENT_COLOR, metalness: 0.55, roughness: 0.35 },
    dark: { color: ACCENT_DARK, metalness: 0.05, roughness: 0.85 },
    carbon: { color: '#17191c', metalness: 0.3, roughness: 0.6 },              // carbone mat
    alu: { color: '#b8bec6', metalness: 0.92, roughness: 0.4 },                 // métal brossé
    aluDark: { color: '#6d727a', metalness: 0.9, roughness: 0.45 },
    rubber: { color: '#0b0b0c', metalness: 0, roughness: 0.92 },
    black: { color: '#121315', metalness: 0.1, roughness: 0.6 },
    hole: { color: '#050506', metalness: 0, roughness: 1 },
    white: { color: '#f2f2f0', metalness: 0.05, roughness: 0.45 },
    glass: { color: '#6f8fb0', metalness: 0.3, roughness: 0.05 },             // fumé bleuté
    visor: { color: VISOR_COLOR, metalness: 0.6, roughness: 0.08 },
    suit: leather(SUIT_COLOR_MAIN), suit2: leather(SUIT_COLOR_ACCENT), suitDark: leather('#0b0c0e'), slider: leather('#3a3d42'),
    helmet: { color: HELMET_COLOR, metalness: 0.1, roughness: 0.8 },        // noir mat
  }
  const glow = (color, k) => ({ color, emissive: color, emissiveIntensity: k || 2, metalness: 0, roughness: 0.5 })

  // ---------- primitives ----------
  let PARENT = app
  function prim(type, size, position, mat, rotation, extra) {
    const n = app.create('prim', Object.assign({ type, size, position, rotation: rotation || [0, 0, 0],
      castShadow: true, receiveShadow: true, physics: null }, mat, extra || {}))
    PARENT.add(n); return n
  }
  const box = (s, p, m, r, e) => prim('box', s, p, m, r, e)
  const cyl = (rt, rb, h, p, m, r, e) => prim('cylinder', [rt, rb, h], p, m, r, e)
  const sph = (r, p, m, e) => prim('sphere', [r], p, m, null, e)
  const ell = (rad, p, m, rot, e) => { const n = prim('sphere', [1], p, m, rot, e); n.scale.set(rad[0], rad[1], rad[2]); return n }  // ellipsoïde
  function yRot(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], h = Math.hypot(dx, dz)
    return h === 0 ? [dy >= 0 ? 0 : PI, 0, 0] : [Math.atan2(h, dy), Math.atan2(dx, dz), 0]
  }
  function cylBetween(a, b, r, m, e) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    return cyl(r, r, L, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], m, yRot(a, b), e)
  }
  function tube(pts, r, m, e) {
    for (let i = 0; i < pts.length - 1; i++) cylBetween(pts[i], pts[i + 1], r, m, e)
    for (let i = 1; i < pts.length - 1; i++) sph(r, pts[i], m, e)
  }
  const AXLE_X = [0, 0, -PI / 2]
  const small = { castShadow: false }

  // ---------- hiérarchie : rig (pos + cap) > tilt (pivot au centre de gravité) > body (vibration) ----------
  const AY = 0.62                         // hauteur des bras et des moteurs
  const PX = 1.0, PZ = 0.85, PROP_R = 0.6 // centres des rotors (±PX, ±PZ), rayon des hélices
  const rig = app.create('group'); app.add(rig)
  const tilt = app.create('group'); tilt.position.set(0, CFG.cgY, CFG.cgZ); rig.add(tilt)
  const body = app.create('group'); body.position.set(0, -CFG.cgY - CFG.rideDrop, -CFG.cgZ); tilt.add(body)
  // repère du modèle (`body`) : le sol est à y = rideDrop (les cotes ci-dessous datent de la version à roues)
  const GY = CFG.rideDrop
  PARENT = body

  // ---------- carrosserie : coque, nez, sous-carénage, réservoir, queue ----------
  ell([0.19, 0.15, 0.56], [0, 0.56, -0.12], M.dark)                       // sous-carénage noir mat (cache les batteries)
  ell([0.22, 0.24, 0.62], [0, 0.74, -0.32], M.main)                       // coque latérale enveloppante
  ell([0.225, 0.02, 0.6], [0, 0.80, -0.32], M.accent, null, small)        // bande anthracite (ceinture de carénage)
  ell([0.227, 0.016, 0.62], [0, 0.76, -0.32], M.dark, null, small)        // bande noir mat
  ell([0.21, 0.13, 0.3], [0, 0.92, -0.52], M.main)                        // épaule de carénage (sous la bulle)
  ell([0.17, 0.14, 0.36], [0, 0.86, -0.8], M.main)                        // nez pointu
  ell([0.14, 0.10, 0.24], [0, 0.74, -0.86], M.accent)                     // menton anthracite
  ell([0.075, 0.05, 0.05], [0, 0.78, -1.085], M.black)                    // prise d'air centrale
  ell([0.055, 0.034, 0.03], [0, 0.78, -1.115], M.hole, null, small)
  box([0.15, 0.012, 0.012], [0, 0.905, -1.13], glow('#ffffff', 3), [0.5, 0, 0], small)       // phare LED étroit
  for (const sx of [-1, 1]) box([0.05, 0.01, 0.01], [sx * 0.085, 0.885, -1.115], glow('#ffffff', 3), [0.4, sx * 0.5, 0], small)
  // pare-brise bulle relevé (~35 %) : bord d'attaque effilé à la base du nez, s'élève et file vers l'arrière au-dessus du casque en tuck
  const WS = { c: [0, 0.99, -0.69], r: [0.165, 0.135, 0.3], rx: -0.36 }
  const bubble = ell(WS.r, WS.c, M.glass, [WS.rx, 0, 0], { transparent: true, opacity: 0.32, castShadow: false })
  ell([0.21, 0.12, 0.31], [0, 0.96, -0.1], M.main)                         // faux réservoir (capot de batteries)
  ell([0.12, 0.03, 0.13], [0, 1.065, 0.02], M.carbon, null, small)        // creux d'appui du torse
  for (const sx of [-1, 1]) box([0.02, 0.09, 0.17], [sx * 0.2, 0.93, -0.02], M.carbon, [0, -sx * 0.15, 0], small)  // grip de genoux
  box([0.24, 0.05, 0.26], [0, 0.95, 0.27], M.black)                       // selle
  ell([0.15, 0.12, 0.36], [0, 1.02, 0.56], M.main)                        // queue de course relevée
  ell([0.04, 0.123, 0.362], [0, 1.02, 0.56], M.accent, null, small)       // bande centrale de queue
  box([0.2, 0.1, 0.05], [0, 1.02, 0.41], M.main, [0.35, 0, 0])            // bosse de selle
  ell([0.12, 0.08, 0.3], [0, 0.9, 0.52], M.black)                         // sous-queue
  box([0.1, 0.022, 0.012], [0, 1.02, 0.915], glow('#ff1a1a', 2.5), null, small)            // feu arrière LED
  ell([0.21, 0.13, 0.22], [0, 0.66, 0.34], M.main)                        // flancs arrière (fixations des bras arrière)
  for (let i = -1; i <= 1; i++) box([0.012, 0.014, 0.15], [-(0.21 * Math.sqrt(1 - (i * 0.04 / 0.13) ** 2) - 0.003), 0.66 + i * 0.04, 0.34], M.accent, null, small)   // grille de ventilation affleurante (arrière gauche)
  for (const sx of [-1, 1]) {
    box([0.035, 0.1, 0.5], [sx * 0.165, 0.86, -0.1], M.alu)                                // longeron de cadre alu
    box([0.03, 0.1, 0.24], [sx * 0.21, 0.69, -0.3], M.hole, [0, sx * 0.12, 0], small)      // ouïe de refroidissement
    for (let i = 0; i < 3; i++) box([0.034, 0.012, 0.22], [sx * 0.212, 0.66 + i * 0.03, -0.3], M.accent, [0, sx * 0.12, 0], small)
    for (const y of [0.86, 0.81]) {                                                          // winglets anthracite, bouts noir mat
      box([0.12, 0.012, 0.09], [sx * 0.23, y, -0.82], M.accent, [-0.12, 0, sx * 0.1], small)
      box([0.03, 0.013, 0.09], [sx * 0.302, y + sx * 0.0, -0.82], M.dark, [-0.12, 0, sx * 0.1], small)
    }
    box([0.006, 0.09, 0.11], [sx * 0.318, 0.835, -0.82], M.dark, null, small)              // dérive de winglet
  }
  // ---------- tableau de bord (jauge de batterie) et guidons bracelets sous le nez ----------
  box([0.16, 0.012, 0.08], [0, 1.04, -0.47], M.black, [0.35, 0, 0], small)
  const gauge = []
  for (let i = 0; i < 5; i++) gauge.push(box([0.022, 0.006, 0.03], [-0.05 + i * 0.025, 1.048, -0.47], glow('#3ddc84', 2), [0.35, 0, 0], small))
  const GRIP = [0.27, 0.927, -0.515]                                       // centre des poignées (cible des mains)
  for (const sx of [-1, 1]) {
    cylBetween([sx * 0.09, 0.95, -0.56], [sx * 0.2, 0.935, -0.535], 0.014, M.alu)
    cylBetween([sx * 0.2, 0.935, -0.535], [sx * 0.34, 0.92, -0.495], 0.019, M.rubber)   // poignée
    box([0.12, 0.008, 0.016], [sx * 0.29, 0.94, -0.56], M.alu, [0, sx * 0.25, 0], small)    // levier
  }

  // ---------- repose-pieds hauts et reculés ----------
  const PEG = [0.21, 0.66, 0.2]
  for (const sx of [-1, 1]) {
    box([0.02, 0.12, 0.16], [sx * 0.17, 0.7, 0.17], M.alu, [0.3, 0, 0])                     // platine
    cylBetween([sx * 0.18, PEG[1], PEG[2]], [sx * 0.26, PEG[1], PEG[2]], 0.012, M.alu)       // repose-pied
    box([0.07, 0.008, 0.03], [sx * 0.2, PEG[1] - 0.01, PEG[2] - 0.08], M.aluDark, null, small)  // sélecteur / frein
  }

  // ---------- train d'atterrissage rétractable : patins rectangulaires ----------
  const gearG = app.create('group'); body.add(gearG); PARENT = gearG
  const GR = 0.026, GX = 0.3, SK = GY + GR                                // patins posés au sol
  for (const sx of [-1, 1]) {
    cylBetween([sx * GX, SK, -0.55], [sx * GX, SK, 0.55], GR, M.black)
    cylBetween([sx * GX, SK, -0.55], [sx * GX, SK + 0.07, -0.64], GR, M.black)
    cylBetween([sx * GX, SK, 0.55], [sx * GX, SK + 0.07, 0.64], GR, M.black)
    for (const sz of [-1, 1]) cylBetween([sx * GX, SK, sz * 0.4], [sx * 0.11, 0.48, sz * 0.3], 0.022, M.black)
  }
  PARENT = body
  const GEAR_UP = 0.385 - SK                                               // course de rétraction (patins plaqués sous le ventre)

  // ---------- 4 bras carbone (2 avant, 2 arrière), 8 moteurs coaxiaux, 8 hélices ----------
  const rotors = []                        // { g, blades, disc, dir }
  const leds = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = [sx * 0.16, AY, sz < 0 ? -0.5 : 0.38], b = [sx * PX, AY, sz * PZ]
    const dx = b[0] - a[0], dz = b[2] - a[2]
    cylBetween(a, b, 0.04, M.carbon).scale.set(1.7, 1, 0.5)                                     // bras aplati (profil)
    box([0.06, 0.1, 0.12], a, M.aluDark, [0, Math.atan2(dx, dz), 0], small)                      // fixation discrète
    cyl(0.032, 0.032, 0.26, [b[0], AY, b[2]], M.alu)                                            // fût moteur
    box([0.08, 0.045, 0.14], [a[0] + dx * 0.55, AY + 0.045, a[2] + dz * 0.55], M.accent, [0, Math.atan2(dx, dz), 0], small) // ESC
    const front = sz < 0
    const led = box([0.03, 0.015, 0.25], [a[0] + dx * 0.5, AY - 0.04, a[2] + dz * 0.5], glow(front ? '#ff2a2a' : '#2aff6a', 2.2), [0, Math.atan2(dx, dz), 0], small)
    leds.push({ node: led, front })
    for (const top of [true, false]) {
      cyl(0.045, 0.045, 0.09, [b[0], AY + (top ? 1 : -1) * 0.07, b[2]], M.carbon)               // moteur brushless
      const g = app.create('group'); g.position.set(b[0], AY + (top ? 1 : -1) * 0.13, b[2]); body.add(g)
      PARENT = g
      prim('cone', [0.04, 0.09], [0, (top ? 1 : -1) * 0.045, 0], M.alu, top ? [0, 0, 0] : [PI, 0, 0], small)   // ogive
      const blades = app.create('group'); g.add(blades); PARENT = blades
      box([2 * PROP_R, 0.008, 0.075], [0, 0, 0], M.carbon, [0, 0, 0], small)                    // pale bipale 1,2 m
      for (const t of [-1, 1]) box([0.06, 0.009, 0.077], [t * (PROP_R - 0.03), 0, 0], M.alu, null, small)
      PARENT = g
      const disc = cyl(PROP_R, PROP_R, 0.004, [0, 0, 0], { color: '#cfd8e3', metalness: 0, roughness: 1 }, null, { transparent: true, opacity: 0.12, castShadow: false })
      disc.active = false
      rotors.push({ g, blades, disc, dir: (sx * sz > 0 ? 1 : -1) * (top ? 1 : -1) })
      PARENT = body
    }
  }

  // ---------- pilote en primitives (combinaison, casque), posé par IK chaque image ----------
  const riderG = app.create('group'); body.add(riderG); PARENT = riderG
  const P0 = [0, 0, 0]
  const part = (bone, node, off) => ({ bone, node, off })
  const parts = []
  const addPart = (bone, n, off) => { parts.push(part(bone, n, off)); return n }
  // bassin, torse (noir), panneaux gris aux flancs et aux épaules, bosse dorsale noire à bande grise
  addPart('pelvis', ell([0.14, 0.1, 0.13], P0, M.suit), [0, 0, 0])
  addPart('torso', ell([0.18, 0.29, 0.125], P0, M.suit), [0, 0.27, 0])
  addPart('torso', ell([0.186, 0.15, 0.08], P0, M.suit2, null, small), [0, 0.3, 0.01])       // flancs gris
  addPart('torso', ell([0.182, 0.045, 0.128], P0, M.suitDark, null, small), [0, 0.1, 0])      // ceinture
  for (const sx of [-1, 1]) addPart('torso', ell([0.075, 0.07, 0.085], P0, M.suit2, null, small), [sx * 0.165, 0.45, 0])   // épaules grises
  addPart('torso', ell([0.1, 0.15, 0.08], P0, M.suit), [0, 0.38, 0.1])                        // bosse aérodynamique
  addPart('torso', ell([0.035, 0.12, 0.05], P0, M.suit2, null, small), [0, 0.38, 0.165])
  // casque intégral noir mat, bande grise, visière fumée
  const headParts = [
    addPart('head', ell([0.145, 0.15, 0.165], P0, M.helmet), [0, 0, 0]),
    addPart('head', ell([0.035, 0.152, 0.167], P0, M.suit2, null, small), [0, 0, 0]),         // bande grise
    addPart('head', ell([0.118, 0.055, 0.07], P0, M.visor, null, small), [0, 0.01, -0.11]),   // visière fumée
    addPart('head', ell([0.1, 0.06, 0.07], P0, M.helmet, null, small), [0, -0.075, -0.1]),    // mentonnière
    addPart('head', box([0.12, 0.02, 0.06], P0, M.helmet, null, small), [0, 0.07, 0.14]),      // becquet
  ]
  // membres (segments mis à jour chaque image)
  const segNode = (r, m, e) => cyl(r, r, 1, P0, m, null, e)
  const limb = {}
  for (const s of ['L', 'R']) {
    limb[s] = {
      uArm: segNode(0.055, M.suit), elbow: sph(0.058, P0, M.suit, small), fArm: segNode(0.05, M.suit2),
      glove: box([0.085, 0.11, 0.045], P0, M.suitDark), knuckle: box([0.06, 0.04, 0.02], P0, M.suit2, null, small),
      thigh: segNode(0.08, M.suit), knee: sph(0.072, P0, M.suit2, small), slider: segNode(0.045, M.slider, small),
      shin: segNode(0.06, M.suit), boot: box([0.1, 0.09, 0.28], P0, M.suitDark), bootTop: box([0.102, 0.03, 0.2], P0, M.suit, null, small),
      neck: s === 'L' ? segNode(0.05, M.suitDark, small) : null,
    }
  }
  headParts.push(limb.L.neck)                            // le cou aussi est masqué en 1re personne
  PARENT = body
  riderG.active = false

  // ---------- ancre du joueur, action « Monter » ----------
  const seat = app.create('anchor', { id: 'seat' })
  seat.position.set(0, CFG.seatY, 0.27)
  body.add(seat)
  const action = app.create('action', {
    label: 'Monter', distance: 2.6, duration: 0.4,
    onTrigger: () => { if (!S.driver && !drv) app.send('hb:mount', {}) },
  })
  action.position.set(-0.7, 1.0, 0); body.add(action)

  // ---------- poussière fine (pool fixe de petites sphères, en coordonnées app) ----------
  // ponytail : le fork n'expose ni depthWrite ni blending sur les prims -> translucidité par paliers d'opacité (4 matériaux × 2)
  const dustRoot = app.create('group'); app.add(dustRoot)
  PARENT = dustRoot
  const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const dustPal = []
  for (let i = 0; i < 12; i++) {
    const k = rnd(), j = 0.92 + rnd() * 0.16, A = hexRGB(DUST_COLOR_A), B = hexRGB(DUST_COLOR_B)
    dustPal.push('#' + [0, 1, 2].map(c => Math.round(Math.min(255, (A[c] + (B[c] - A[c]) * k) * j)).toString(16).padStart(2, '0')).join(''))
  }
  const DUST_FADE = [1, 0.62, 0.32, 0.1]                   // paliers d'opacité au fil de la vie
  const dust = []
  for (let i = 0; i < DUST_COUNT; i++) {
    const n = sph(0.5, [0, 0, 0], { color: dustPal[0], metalness: 0, roughness: 1, opacity: DUST_OPACITY, transparent: true }, { castShadow: false, receiveShadow: false })
    n.active = false; dust.push({ n, t: 0, life: 0, vx: 0, vy: 0, vz: 0, s: 1, o: 1, b: 0, gy: 0, cx: 0, cz: 0, w: 0, col: dustPal[0] })
  }
  PARENT = app
  let dustAlive = 0, dustAcc = 0, dustAir = false

  // ---------- sons ----------
  const snd = k => (props && props[k] && props[k].url) || null
  let rotorA = null, beepA = null, rotorOn = false, rotorVol = -1
  if (snd('rotorSound')) {
    rotorA = app.create('audio', { src: snd('rotorSound'), loop: true, spatial: true, group: 'sfx', volume: 0,
      distanceModel: 'inverse', refDistance: 5, maxDistance: 120, rolloffFactor: 1.8 })
    body.add(rotorA)
  }
  if (snd('beepSound')) { beepA = app.create('audio', { src: snd('beepSound'), loop: false, spatial: false, group: 'sfx', volume: 0.6 }); app.add(beepA) }

  // ---------- HUD (pilote seulement) : tableau de bord à 5 cadrans ----------
  const HELP_TEXT = 'W/S avant-arrière · A/D latéral · ↑/↓ altitude · ←/→ lacet · souris : orbite · molette / V : 1re personne · K : pilote costume / avatar · Espace / E (maintenir) : descendre'
  const DASH = { ALT_MAX: 100, SPD_MAX: 120, DIGITS: true }
  const RED = '#ff5a4d', AMB = '#ffb020', GRN = '#3ddc84'
  function createDashboard(app, helpText) {
    const set = (n, k, v) => { if (n[k] !== v) n[k] = v }
    const dot = (parent, size, color, x, y) => {             // tout est créé une seule fois ; seuls left/top bougent ensuite
      const d = app.create('uiview', { absolute: true, width: size, height: size, borderRadius: size / 2, backgroundColor: color, left: x - size / 2, top: y - size / 2 })
      parent.add(d); return d
    }
    const label = (parent, text, size, color, w, x, y, h = size + 4) => {
      const box = app.create('uiview', { absolute: true, width: w, height: h, left: x - w / 2, top: y - h / 2, alignItems: 'center', justifyContent: 'center' })
      const t = app.create('uitext', { value: text, fontSize: size, color, textAlign: 'center' })
      box.add(t); parent.add(box); return { t, box }
    }
    const root = app.create('ui', { space: 'screen', width: 520, height: 172, pivot: 'bottom-center', position: [0.5, 1, 0], offset: [0, -20, 0],
      backgroundColor: 'rgba(8,14,12,0.82)', borderRadius: 14, padding: 8, gap: 4, alignItems: 'center', pointerEvents: false })
    const row = app.create('uiview', { flexDirection: 'row', gap: 12, alignItems: 'flex-start' })
    root.add(row)
    const R = 40, rad = a => a * DEG2RAD
    const polar = (r, deg) => [R + r * Math.sin(rad(deg)), R - r * Math.cos(rad(deg))]
    function dial(name) {
      const col = app.create('uiview', { alignItems: 'center', gap: 2 })
      const bezel = app.create('uiview', { width: 84, height: 84, borderRadius: 42, backgroundColor: '#4a525a', padding: 2 })
      const face = app.create('uiview', { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0b0f12' })
      bezel.add(face); col.add(bezel)
      col.add(app.create('uitext', { value: name, fontSize: 10, color: '#8a9096', textAlign: 'center' }))
      row.add(col)
      return face
    }
    function needleDial(name, max, zone, fmt) {
      const face = dial(name)
      for (let i = 0; i < 25; i++) { const [x, y] = polar(33, -120 + i * 10); dot(face, i % 6 === 0 ? 5 : 3, zone(i / 24), x, y) }
      const nd = [6, 11, 16, 21, 26].map((r, i) => dot(face, i === 4 ? 5 : 4, i === 4 ? '#ff8a3d' : '#ffffff', R, R))
      dot(face, 9, '#c9d0d6', R, R)
      const val = DASH.DIGITS ? label(face, '0', 11, '#ffffff', 40, R, R + 20).t : null
      let ang = NaN, txt = ''
      return v => {
        const a = Math.round(-120 + 240 * clamp(v / max, 0, 1))
        if (a !== ang) { ang = a; [6, 11, 16, 21, 26].forEach((r, i) => { const [x, y] = polar(r, a), h = nd[i].width / 2; set(nd[i], 'left', x - h); set(nd[i], 'top', y - h) }) }
        if (val) { const t = fmt(v); if (t !== txt) { txt = t; val.value = t } }
      }
    }
    const zAlt = () => '#4aa3df'
    const zSpd = f => (f < 0.85 ? '#ffffff' : RED)
    const zBat = f => (f * 100 < 20 ? RED : f * 100 < 35 ? AMB : GRN)
    const zMot = f => (f * 100 < 80 ? GRN : f * 100 < 95 ? AMB : RED)
    const dAlt = needleDial('ALT m', DASH.ALT_MAX, zAlt, v => v.toFixed(0))
    const dSpd = needleDial('VIT km/h', DASH.SPD_MAX, zSpd, v => v.toFixed(0))
    const dBat = needleDial('BAT %', 100, zBat, v => v.toFixed(0))
    const dMot = needleDial('MOT %', 100, zMot, v => v.toFixed(0))
    // CAP : repère fixe en haut, rose des vents mobile (points repositionnés à (relèvement − cap))
    const fc = dial('CAP')
    dot(fc, 6, '#ff8a3d', R, 4)
    const rose = []
    for (let b = 0; b < 360; b += 30) {
      const L = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' }[b]
      rose.push({ b, n: L ? label(fc, L, 11, b === 0 ? '#ff8a3d' : '#ffffff', 14, R, R, 14).box : dot(fc, 3, '#9aa3ab', R, R), r: L ? 25 : 33, w: L ? 7 : 1.5, text: !!L })
    }
    const hdgT = label(fc, '0°', 11, '#ffffff', 34, R, R, 14).t
    let hd = NaN
    const setHdg = h => {
      const hr = Math.round(h / 2) * 2 % 360
      if (hr === hd) return; hd = hr
      for (const e of rose) { const [x, y] = polar(e.r, e.b - hr); set(e.n, 'left', x - e.w); set(e.n, 'top', y - (e.text ? 7 : 1.5)) }
      hdgT.value = `${hr}°`
    }
    setHdg(0)
    const status = app.create('uitext', { value: '', fontSize: 13, color: '#7fd3ff', textAlign: 'center' })
    const help = app.create('uitext', { value: helpText, fontSize: 10, color: '#8a9096', textAlign: 'center' })
    root.add(status); root.add(help)
    return {
      root,
      set({ alt, spd, bat, mot, hdg, status: st, statusColor }) {
        dAlt(alt); dSpd(spd); dBat(bat); dMot(mot); setHdg(hdg)
        set(status, 'value', st || ''); set(status, 'color', statusColor || '#7fd3ff')
      },
    }
  }
  const dash = createDashboard(app, HELP_TEXT)
  const hud = dash.root
  hud.active = false; app.add(hud)
  const setP = (node, key, val) => { if (node[key] !== val) node[key] = val }   // évite de redessiner le canvas

  // ============================== ÉTAT VISUEL ET PILOTE ==============================
  const V = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, rpm: 0, gy: 0 }       // ce qui est affiché
  const Tg = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, rpm: 0, gy: 0 }      // cible reçue du pilote distant
  let drv = null                      // état physique du pilote local (null si on ne pilote pas)
  let ctrl = null, fx = null
  let T = 0, hudT = 0, poseT = 0, beepT = 0, msgT = 0, msgText = ''
  let eHold = 0, ledState = ''
  let gaugeN = -1
  const KEYS = ['keyW', 'keyA', 'keyS', 'keyD', 'keyE', 'keyV', 'keyK', 'arrowUp', 'arrowDown', 'arrowLeft', 'arrowRight', 'space']
  const ground = hasV3 ? world.createLayerMask('environment') : 0
  const vA = hasV3 ? new Vector3() : null, vB = hasV3 ? new Vector3() : null, vC = hasV3 ? new Vector3() : null
  const mInv = hasV3 ? new Matrix4() : null
  const qA = hasV3 ? new Quaternion() : null, qB = hasV3 ? new Quaternion() : null, eA = hasV3 ? new Euler(0, 0, 0, 'YXZ') : null
  const myId = () => { const p = world.getPlayer(); return p ? p.id : null }
  const ghostUrl = snd('ghostAvatar')
  let avCls = null, avCand = null, avCandT = 0, sizeCls = 100, curAvatar, poseFailT = 0, poseHint = false
  const seatOff = [0, 0, 0]

  Object.assign(V, S.pose || {}); Object.assign(Tg, V)
  if (!S.driver) { V.rpm = 0; V.pitch = 0; V.roll = 0 }
  if (hasV3 && !S.driver) { const g = groundAt(V.x, V.y + 3, V.z); if (g !== null) { V.y = V.gy = Tg.y = Tg.gy = g } }

  // ---------- sol et obstacles (raycasts en coordonnées locales de l'app) ----------
  function groundAt(x, y, z) {
    if (!hasV3) return null
    vA.set(x, y, z).applyMatrix4(app.matrixWorld)
    vB.set(0, -1, 0).transformDirection(app.matrixWorld)
    const h = world.raycast(vA, vB, 600, ground)
    return h ? y - h.distance : null
  }
  const FOOT = [[0, 0], [GX, 0.55], [-GX, 0.55], [GX, -0.55], [-GX, -0.55]]
  // points de contrôle des obstacles : bouts d'hélices, nez, queue, à hauteur d'hélices et de casque
  const CPTS = [[1.6, -0.85], [-1.6, -0.85], [1.6, 0.85], [-1.6, 0.85], [1, -1.45], [-1, -1.45], [1, 1.45], [-1, 1.45], [0, -1.2], [0, 1.0]]
  const CH = [0.4, 1.3]
  const sc = (yaw) => [Math.cos(yaw), Math.sin(yaw)]

  // ---------- visuels ----------
  function show(v) {
    rig.position.set(v.x, v.y, v.z)
    rig.rotation.y = v.yaw
    tilt.rotation.x = v.pitch
    tilt.rotation.z = v.roll
  }
  function setLeds(state) {
    if (state === ledState) return
    ledState = state
    for (const l of leds) {
      const c = state === 'off' ? '#2a2c30' : state === 'low' ? '#ffb020' : l.front ? '#ff2a2a' : '#2aff6a'
      l.node.color = c; l.node.emissive = state === 'off' ? '#000000' : c
    }
  }
  function setGauge(bat) {
    const n = Math.ceil(clamp(bat, 0, 1) * 5 - 1e-6)
    if (n === gaugeN) return
    gaugeN = n
    gauge.forEach((g, i) => { g.active = i < n })
  }

  // ============================== PILOTE EN PRIMITIVES : POSTURE + IK ==============================
  // vecteurs [x,y,z] (sans Vector3 : la posture reste calculable partout, aperçu compris)
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const len = a => Math.hypot(a[0], a[1], a[2])
  const nrm = a => scl(a, 1 / (len(a) || 1))
  const mad = (o, ...terms) => { let r = o; for (let i = 0; i < terms.length; i += 2) r = add(r, scl(terms[i], terms[i + 1])); return r }
  function setQuatBasis(node, x, y, z) {               // quaternion d'une base orthonormée (colonnes x, y, z)
    const t = x[0] + y[1] + z[2]
    let qx, qy, qz, qw
    if (t > 0) { const s = 0.5 / Math.sqrt(t + 1); qw = 0.25 / s; qx = (y[2] - z[1]) * s; qy = (z[0] - x[2]) * s; qz = (x[1] - y[0]) * s }
    else if (x[0] > y[1] && x[0] > z[2]) { const s = 2 * Math.sqrt(1 + x[0] - y[1] - z[2]); qw = (y[2] - z[1]) / s; qx = 0.25 * s; qy = (y[0] + x[1]) / s; qz = (z[0] + x[2]) / s }
    else if (y[1] > z[2]) { const s = 2 * Math.sqrt(1 + y[1] - x[0] - z[2]); qw = (z[0] - x[2]) / s; qx = (y[0] + x[1]) / s; qy = 0.25 * s; qz = (z[1] + y[2]) / s }
    else { const s = 2 * Math.sqrt(1 + z[2] - x[0] - y[1]); qw = (x[1] - y[0]) / s; qx = (z[0] + x[2]) / s; qy = (z[1] + y[2]) / s; qz = 0.25 * s }
    node.quaternion.set(qx, qy, qz, qw)
  }
  function frameFrom(yAxis, xHint) {                     // base (x, y, z) avec y imposé et x au plus près de xHint
    const y = nrm(yAxis)
    let x = sub(xHint, scl(y, dot(xHint, y)))
    if (len(x) < 1e-4) x = sub([0, 0, 1], scl(y, y[2]))
    x = nrm(x)
    return [x, y, cross(x, y)]
  }
  function seg(node, a, b) {                             // cylindre de hauteur 1 étiré de a à b
    const d = sub(b, a), L = len(d) || 1e-4
    node.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    const f = frameFrom(d, [1, 0, 0]); setQuatBasis(node, f[0], f[1], f[2])
    node.scale.set(1, L, 1)
  }
  function place(node, origin, f, off) {
    node.position.set(...mad(origin, f[0], off[0], f[1], off[1], f[2], off[2]))
    setQuatBasis(node, f[0], f[1], f[2])
  }
  // IK analytique à 2 os : racine a, cible t, longueurs l1/l2, pôle (direction préférée de l'articulation)
  function ik2(a, t, l1, l2, pole) {
    const d0 = sub(t, a), D = len(d0) || 1e-4, dir = scl(d0, 1 / D)
    const d = clamp(D, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4)
    const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca))
    const perp = nrm(sub(pole, scl(dir, dot(pole, dir))))
    return { joint: mad(a, dir, l1 * ca, perp, l1 * sa), end: mad(a, dir, d) }
  }
  const LEN = { spine: 0.5, sh: 0.19, uArm: 0.29, fArm: 0.27, hip: 0.095, thigh: 0.44, shin: 0.43 }
  const Pz = { r: 1, t: 0, b: 0, h: 0 }                  // posture lissée : repos, tuck (vitesse), freinage, hang-off (-1..1)
  const RP = {}                                          // dernière posture calculée (tête, mains, genoux…) pour la caméra et les tests
  if (props && props.__test) Object.assign(props.__test, { dash: () => dashLast, RP, Pz, cam: null, gear: () => gearT, WS,      // banc d'essai / générateur d'emotes
    pose: p => { Object.assign(Pz, p); poseRider(); return RP }, seat0: () => [0, CFG.seatY, 0.27] })
  function poseRider() {
    const r = Pz.r, t = Pz.t * (1 - r), b = Pz.b * (1 - r), h = Pz.h * (1 - r)
    const H = [h * 0.11, 1.01 - 0.015 * Math.abs(h) - 0.012 * t, 0.26 + 0.03 * t - 0.035 * b]        // hanches (fesses en arrière en tuck)
    const lean = lerp(55 + 9 * t - 9 * b, 45, r) * DEG2RAD                                          // inclinaison du torse depuis la verticale
    const phi = h * 0.25, psi = h * 0.35                                                              // torse penché vers l'intérieur, épaule extérieure avancée
    const up = nrm([Math.sin(phi), Math.cos(lean) * Math.cos(phi), -Math.sin(lean) * Math.cos(phi)])
    const torso = frameFrom(up, [Math.cos(psi), 0, Math.sin(psi)])
    const pelvis = frameFrom([Math.sin(phi * 0.5), 1, 0], [1, 0, 0])
    const N = mad(H, up, LEN.spine)                                                                   // base du cou
    const head = add(mad(N, up, 0.06), [h * 0.06, lerp(0.09 - 0.03 * t + 0.02 * b, 0.13, r), lerp(-0.1, -0.03, r)])
    const hf = frameFrom([h * 0.35, 1, lerp(0.22, 0, r)], [1, 0, 0])                                  // casque face à l'avant, penché dans le virage
    RP.head = head; RP.hf = hf; RP.H = H; RP.torso = torso; RP.pelvis = pelvis; RP.b = b; RP.h = h
    for (const p of parts) place(p.node, p.bone === 'head' ? head : H, p.bone === 'torso' ? torso : p.bone === 'head' ? hf : pelvis, p.off)
    seg(limb.L.neck, mad(N, up, -0.02), mad(head, hf[1], -0.1))
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const Lm = limb[s]
      // bras : épaule -> poignet (poignée), coudes écartés vers l'extérieur
      const sh = mad(N, torso[0], sx * LEN.sh, up, -0.04)
      const wrist = [sx * GRIP[0], GRIP[1] + 0.018, GRIP[2] + 0.06]
      const a = ik2(sh, wrist, LEN.uArm, LEN.fArm, [sx, -0.35 + 0.3 * b, 0.45])
      seg(Lm.uArm, sh, a.joint); Lm.elbow.position.set(...a.joint); seg(Lm.fArm, a.joint, a.end)
      const gf = frameFrom(sub(a.end, a.joint), [sx, 0, 0])
      place(Lm.glove, a.end, gf, [0, 0.035, 0]); place(Lm.knuckle, a.end, gf, [0, 0.05, -0.025])
      // jambes : hanche -> cheville (pointe du pied sur le repose-pied, talon levé), genou intérieur sorti en virage
      const hip = mad(H, pelvis[0], sx * LEN.hip, pelvis[1], -0.03)
      const ankle = [sx * PEG[0], PEG[1] + 0.065, PEG[2] + 0.075]
      const toe = [sx * (PEG[0] - 0.015), PEG[1] - 0.015, PEG[2] - 0.11]
      const inside = Math.max(0, sx * h)
      const l = ik2(hip, ankle, LEN.thigh, LEN.shin, [sx * (0.12 + 1.1 * inside), 0.2, -1])
      seg(Lm.thigh, hip, l.joint); Lm.knee.position.set(...l.joint); seg(Lm.shin, l.joint, l.end)
      const out = nrm([sx, 0, 0.15])
      seg(Lm.slider, mad(l.joint, out, 0.055), mad(l.joint, out, 0.085))
      const bz = nrm(sub(l.end, toe)), bx = nrm(sub([1, 0, 0], scl(bz, bz[0])))   // botte : z = du bout vers le talon
      const foot = [bx, cross(bz, bx), bz]
      place(Lm.boot, scl(add(l.end, toe), 0.5), foot, [0, -0.01, 0]); place(Lm.bootTop, scl(add(l.end, toe), 0.5), foot, [0, 0.035, 0.02])
      RP[s] = { wrist, hand: a.end, elbow: a.joint, knee: l.joint, ankle, toe, foot: l.end, sh, hip }
    }
  }
  function stepPosture(dt, sf, alt) {
    const k = 1 - Math.exp(-dt * CFG.postureRate)
    const flying = alt > 0.4
    Pz.r += (clamp(1 - (alt - 0.12) / 0.5, 0, 1) - Pz.r) * k                     // au sol : torse relevé
    Pz.t += (clamp((sf - 6) / 10, 0, 1) - Pz.t) * k                             // haute vitesse : tuck
    Pz.b += ((flying ? clamp(V.pitch / 0.12, 0, 1) : 0) - Pz.b) * k             // nez qui se lève = freinage : se redresse
    Pz.h += (clamp(-V.roll / 0.22, -1, 1) - Pz.h) * k                           // roulis : hang-off côté intérieur
  }

  // ---------- train rétractable, roues ----------
  let gearT = 0                                           // 0 = sorti, 1 = rentré
  function stepGear(dt, alt, vy) {
    if (!OPTS.retractGear) return
    const up = alt > OPTS.gearUpAlt && !(vy < 0 && alt + vy * 1.5 < OPTS.gearUpAlt)   // ressort assez tôt pour être sorti au toucher
    gearT = clamp(gearT + (up ? dt : -dt) / 1.2, 0, 1)
    const e = gearT * gearT * (3 - 2 * gearT)
    gearG.position.y = e * GEAR_UP
    gearG.scale.x = 1 - 0.18 * e                           // les patins se resserrent sous le ventre
  }

  // ============================== CAMÉRA (pilote seulement) ==============================
  const cam = { yaw: 0, offYaw: 0, offPitch: 0, idle: 9, dist: CFG.camDist, fp: false }
  if (props && props.__test) props.__test.cam = cam
  function bodyToWorld(p, out) {                          // point du repère `body` -> monde (cabrage/roulis compris)
    eA.set(V.pitch, 0, V.roll, 'YXZ')
    out.set(p[0], p[1] - CFG.cgY - CFG.rideDrop, p[2] - CFG.cgZ).applyEuler(eA)
    out.y += CFG.cgY; out.z += CFG.cgZ
    eA.set(0, V.yaw, 0, 'YXZ'); out.applyEuler(eA)
    out.x += V.x; out.y += V.y; out.z += V.z
    return out.applyMatrix4(app.matrixWorld)
  }
  function stepCamera(dt, sf) {
    const c = ctrl.camera, p = ctrl.pointer
    if (!c || !hasV3) return
    c.write = true
    if (p && p.locked && (p.delta.x || p.delta.y)) {
      cam.offYaw -= p.delta.x * 0.003; cam.offPitch = clamp(cam.offPitch - p.delta.y * 0.003, -0.5, 0.45); cam.idle = 0
    } else cam.idle += dt
    if (cam.idle > 1.5 && sf > 2) { const k = Math.exp(-dt * 2); cam.offYaw *= k; cam.offPitch *= k }   // revient derrière la moto en roulant
    const sv = ctrl.scrollDelta ? ctrl.scrollDelta.value : 0
    if (sv) {
      if (cam.fp) { if (sv < 0) { cam.fp = false; cam.dist = 1.6 } }
      else { cam.dist = clamp(cam.dist - sv * 2 * dt, 0.9, 8); if (cam.dist < 1.2) cam.fp = true }
    }
    if (ctrl.keyV.pressed) { cam.fp = !cam.fp; if (!cam.fp) cam.dist = Math.max(cam.dist, 1.6) }
    for (const n of headParts) if (n.active === cam.fp) n.active = !cam.fp       // casque masqué pour soi en 1re personne
    cam.yaw += angDiff(cam.yaw, V.yaw) * (1 - Math.exp(-dt * 4))
    app.matrixWorld.decompose(vA, qA, vB)
    const spd = clamp(sf / CFG.vMaxFwd, 0, 1)
    if (cam.fp) {                                          // dans le casque, derrière la bulle
      if (S.mode === 'avatar') bodyToWorld(mad(RP.head, RP.hf[1], 0.04, RP.hf[2], -0.13), vC)   // devant le visage de l'avatar (pas de casque)
      else bodyToWorld(mad(RP.head, RP.hf[1], CFG.fpEyeUp, RP.hf[2], CFG.fpEyeBack), vC)   // haut/arrière du casque : mains et carénage dans le champ
      c.position.copy(vC)
      eA.set(V.pitch * 0.5 + CFG.fpPitch + cam.offPitch, V.yaw + cam.offYaw, V.roll * 0.7, 'YXZ')    // regard baissé de pilote couché
      c.zoom = 0
    } else {                                               // 3e personne : basse, proche, recule un peu avec la vitesse
      const shake = spd * spd * 0.004
      vC.set(V.x, V.y + CFG.camHeight - 0.1 * spd, V.z).applyMatrix4(app.matrixWorld)
      c.position.copy(vC)
      eA.set(CFG.camPitch + cam.offPitch + Math.sin(T * 23) * shake, cam.yaw + cam.offYaw + Math.sin(T * 19 + 1) * shake, 0, 'YXZ')
      c.zoom = cam.dist * (1 + CFG.camSpeedPull * spd)
    }
    qB.setFromEuler(eA); c.quaternion.copy(qA).multiply(qB)
  }

  // ---------- pilote : démarrage / arrêt ----------
  function startPilot() {
    const player = world.getPlayer()
    if (!player || drv) return
    ctrl = app.control()
    for (const k of KEYS) ctrl[k].capture = true
    if (ctrl.scrollDelta) ctrl.scrollDelta.capture = true
    sizeCls = sizeClass(player)                        // mesuré debout, avant de masquer l'avatar
    curAvatar = undefined; poseHint = false
    drv = { x: V.x, y: V.y, z: V.z, yaw: V.yaw, pitch: 0, roll: 0, rpm: V.rpm, gy: V.gy,
      vx: 0, vy: 0, vz: 0, yawV: 0, bat: S.bat, onGround: true, altHold: V.y, holdAlt: false,
      holdXZ: false, hx: 0, hz: 0 }
    eHold = 0; poseT = 0; beepT = 0
    Object.assign(cam, { yaw: V.yaw, offYaw: 0, offPitch: 0, idle: 9, dist: CFG.camDist, fp: false })
    applyRider()
    hud.active = true
    wake()
  }
  function restoreAvatar(player) {
    if (player && player.setSessionAvatar && curAvatar !== undefined) player.setSessionAvatar(null)
    curAvatar = undefined
  }

  // ---------- touche K : pilote en costume (mannequin + avatar invisible) / avatar du joueur (emotes de posture) ----------
  const postureOf = () => Pz.r > 0.5 ? 'rest' : Math.abs(Pz.h) > 0.45 ? (Pz.h > 0 ? 'hangR' : 'hangL') : Pz.b > 0.45 ? 'brake' : Pz.t > 0.5 ? 'tuck' : 'race'
  const emoteUrl = c => snd(`emo_${c}_${sizeCls}`)
  function setAvatar(player, url) { if (curAvatar === url || !player.setSessionAvatar) return; curAvatar = url; player.setSessionAvatar(url) }
  function setEffect(player, emote) {                    // même ancre : rappeler applyEffect remplace l'effet sans déclencher onEnd
    fx = player.applyEffect(Object.assign({ anchor: seat, onEnd: () => { if (drv) dismount(true) } }, emote ? { emote } : {}))
  }
  function applyRider() {
    const player = world.getPlayer()
    if (!player) return
    if (S.mode === 'avatar') { setAvatar(player, riderUrl()); avCls = avCand = postureOf(); setEffect(player, emoteUrl(avCls)) }
    else { setAvatar(player, ghostUrl || null); avCls = null; setEffect(player, null) }
    poseFailT = 0
  }
  function stepAvatarPosture(dt) {                       // change d'emote quand la posture dominante change (hystérésis 0,25 s, fondu 0,15 s)
    const c = postureOf()
    if (c === avCls) { avCand = c; avCandT = 0; return }
    if (c !== avCand) { avCand = c; avCandT = 0 }
    if ((avCandT += dt) >= 0.25) { avCls = c; setEffect(world.getPlayer(), emoteUrl(c)) }
  }
  function sizeClass(player) {                           // classe d'emotes d'après la hauteur de hanches debout (référence 0,90 m)
    let k = 1
    const m = hasV3 && player.getBoneTransform ? player.getBoneTransform('hips') : null
    if (m) { vA.setFromMatrixPosition(m); const hh = vA.y - player.position.y; if (hh > 0.4 && hh < 1.6) k = hh / 0.9 }
    else if (player.height > 0.5) k = player.height / 1.7
    return k < 0.95 ? 90 : k > 1.05 ? 110 : 100
  }
  // calage : décale l'ancre pour que les mains et les pieds de l'avatar tombent sur les poignées et les repose-pieds
  // (corrige les proportions propres à chaque avatar ; mesuré sur tous les clients à basse vitesse)
  const mBW = hasV3 ? new Matrix4() : null, mT = hasV3 ? new Matrix4() : null
  const CAL = [['leftHand', [-GRIP[0], GRIP[1] + 0.018, GRIP[2] + 0.06], 0.3], ['rightHand', [GRIP[0], GRIP[1] + 0.018, GRIP[2] + 0.06], 0.3],
    ['leftFoot', [-PEG[0], PEG[1] + 0.065, PEG[2] + 0.075], 0.2], ['rightFoot', [PEG[0], PEG[1] + 0.065, PEG[2] + 0.075], 0.2]]
  function calibrate(dt, spd, mine) {
    const p = world.getPlayer(mine ? undefined : S.driver)
    if (!p || !p.getBoneTransform || !hasV3) return
    mBW.copy(app.matrixWorld).multiply(mT.makeTranslation(V.x, V.y, V.z)).multiply(mT.makeRotationY(V.yaw))
      .multiply(mT.makeTranslation(0, CFG.cgY, CFG.cgZ)).multiply(mT.makeRotationFromEuler(eA.set(V.pitch, 0, V.roll, 'YXZ')))
      .multiply(mT.makeTranslation(0, -CFG.cgY - CFG.rideDrop, -CFG.cgZ)).invert()
    let ex = 0, ey = 0, ez = 0, err = 0
    for (const [bone, t, w] of CAL) {
      const m = p.getBoneTransform(bone)
      if (!m) return
      vA.setFromMatrixPosition(m).applyMatrix4(mBW)
      ex += w * (t[0] - vA.x); ey += w * (t[1] - vA.y); ez += w * (t[2] - vA.z)
      err += w * Math.hypot(t[0] - vA.x, t[1] - vA.y, t[2] - vA.z)      // écart moyen main/poignée, pied/repose-pied
    }
    if (mine) {                                           // pose assise forcée = l'avatar n'est pas reconnu : conseil dans le HUD
      poseFailT = err > 0.2 ? poseFailT + dt : 0
      if (poseFailT > 2 && !poseHint) { poseHint = true; msgText = 'Posture avatar indisponible : choisis ton VRM dans les réglages de l\'app'; msgT = 6 }
    }
    if (spd > 2 || err > 0.3) return                      // en mouvement, la pose des os a une image de retard : on n'apprend qu'au calme
    const k = Math.min(1, dt * 2.5)
    seatOff[0] = clamp(seatOff[0] + ex * k, -0.06, 0.06); seatOff[1] = clamp(seatOff[1] + ey * k, -0.12, 0.12); seatOff[2] = clamp(seatOff[2] + ez * k, -0.15, 0.15)
    seat.position.set(seatOff[0], CFG.seatY + seatOff[1], 0.27 + seatOff[2])
  }
  function dismount(external) {
    const L = drv
    if (!L) return
    drv = null
    if (ctrl) { ctrl.release(); ctrl = null }
    for (const n of headParts) n.active = true
    hud.active = false
    const pose = poseOf(L); pose.bat = r3(L.bat)
    Object.assign(V, pose); Object.assign(Tg, pose)
    S.driver = null; S.pose = pose; S.bat = L.bat
    app.send('hb:dismount', pose)
    const player = world.getPlayer()
    restoreAvatar(player)
    const f = fx; fx = null
    if (f) f.cancel()
    if (player && hasV3 && !external) {                // le pilote se pose à gauche, hors des hélices
      const lx = L.x - 1.15 * Math.cos(L.yaw), lz = L.z + 1.15 * Math.sin(L.yaw)
      const g = groundAt(lx, L.y + 2, lz)
      vC.set(lx, g === null ? L.gy : g, lz).applyMatrix4(app.matrixWorld)
      app.matrixWorld.decompose(vA, qA, vB); eA.setFromQuaternion(qA)
      player.teleport(vC, eA.y + L.yaw)
    }
    refreshAction(); wake()
  }
  function poseOf(L) {
    return { x: r3(L.x), y: r3(L.y), z: r3(L.z), yaw: r3(L.yaw), pitch: r3(L.pitch), roll: r3(L.roll), rpm: r3(L.rpm), gy: r3(L.gy) }
  }
  function refreshAction() { const a = !S.driver && !drv && V.rpm < 0.12 && V.y - V.gy < 0.1; if (action.active !== a) action.active = a }

  // ---------- physique du pilote ----------
  function stepPilot(dt) {
    const L = drv, k = ctrl
    const forced = L.bat <= 0
    const perf = L.bat > CFG.batteryLow ? 1 : 0.55 + 0.45 * Math.max(0, L.bat) / CFG.batteryLow
    let f = (k.keyW.down ? 1 : 0) - (k.keyS.down ? 1 : 0)
    let s = (k.keyD.down ? 1 : 0) - (k.keyA.down ? 1 : 0)
    let c = (k.arrowUp.down ? 1 : 0) - (k.arrowDown.down ? 1 : 0)
    const alt = L.y - L.gy
    const hsp = Math.hypot(L.vx, L.vz)
    const canLand = alt <= CFG.dismountAlt && hsp <= CFG.dismountSpeed && Math.abs(L.vy) <= 1.5
    eHold = k.keyE.down ? eHold + dt : 0
    if (k.keyK.pressed) {                                // bascule costume / avatar, synchronisée
      S.mode = S.mode === 'avatar' ? 'costume' : 'avatar'
      app.send('hb:mode', { mode: S.mode })
      applyRider()
      msgText = S.mode === 'avatar' ? 'Pilote : avatar' : 'Pilote : costume'; msgT = 1.5
    }
    let yawIn = (k.arrowLeft.down ? 1 : 0) - (k.arrowRight.down ? 1 : 0)
    if (forced) { f = s = c = 0; yawIn = 0 }

    // --- descendre de la moto ---
    if (k.space.pressed || eHold >= 0.5) {
      if (canLand) { dismount(false); return }
      if (k.space.pressed) { msgText = 'Trop haut pour descendre'; msgT = 1.5 }
    }

    const flying = alt > 0.4
    const spooled = L.rpm >= CFG.rpmLift
    const yaw = L.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw)
    const Fx = -sn, Fz = -cs, Rx = cs, Rz = -sn

    // --- vitesse horizontale cible (repère moto), diagonales plafonnées ---
    let vf = f > 0 ? f * CFG.vMaxFwd : f * CFG.vMaxBack, vs = s * CFG.vMaxSide
    const m = Math.hypot(vf, vs)
    if (m > CFG.vMaxFwd) { vf *= CFG.vMaxFwd / m; vs *= CFG.vMaxFwd / m }
    vf *= perf; vs *= perf
    let tx = Fx * vf + Rx * vs, tz = Fz * vf + Rz * vs
    const hasIn = f !== 0 || s !== 0
    if (!flying) { tx = tz = 0 }
    else if (hasIn) L.holdXZ = false
    else {                                               // maintien de position doux
      if (!L.holdXZ && hsp < 0.6) { L.holdXZ = true; L.hx = L.x; L.hz = L.z }
      if (L.holdXZ) {
        tx = clamp((L.hx - L.x) * 0.6, -1.2, 1.2); tz = clamp((L.hz - L.z) * 0.6, -1.2, 1.2)
      }
    }
    const sp = Math.hypot(L.vx, L.vz)
    const dl = CFG.dragLin + CFG.dragQuad * sp
    let ax = CFG.velGain * (tx - L.vx) + (hasIn ? dl * L.vx : 0)
    let az = CFG.velGain * (tz - L.vz) + (hasIn ? dl * L.vz : 0)
    const aN = Math.hypot(ax, az), aCap = A_MAX_H * perf
    if (aN > aCap) { ax *= aCap / aN; az *= aCap / aN }
    const gust = flying ? 0.25 * (1 - CFG.aeroStab * Math.min(1, sp / CFG.vMaxFwd)) : 0   // micro-turbulences, atténuées par le carénage
    const gx = gust * (Math.sin(T * 1.7) + 0.6 * Math.sin(T * 4.3 + 1)), gz = gust * (Math.sin(T * 1.3 + 2) + 0.6 * Math.sin(T * 3.7))
    L.vx += (ax - dl * L.vx + gx) * dt
    L.vz += (az - dl * L.vz + gz) * dt
    if (!flying && L.onGround) { const fr = Math.exp(-6 * dt); L.vx *= fr; L.vz *= fr }

    // --- vertical : collectif, maintien d'altitude, plafond, atterrissage doux ---
    let vzT
    if (forced) vzT = alt > 0.02 ? -3 : 0
    else if (c !== 0) { L.holdAlt = false; vzT = spooled ? (c > 0 ? c * CFG.vMaxUp * perf : c * CFG.vMaxDown) : 0 }
    else {
      if (!L.holdAlt) { L.holdAlt = true; L.altHold = L.onGround ? L.y : L.y + L.vy * Math.abs(L.vy) / (2 * CFG.climbAccel) }
      vzT = clamp((L.altHold - L.y) * 0.8, -1, 1)
    }
    if (vzT > 0) vzT *= clamp((CFG.altMax - alt) / 10, 0, 1)
    let aff = 0                                           // anticipation : le profil d'atterrissage ralentit à mesure qu'on approche du sol
    if (vzT < 0) { const cap = -landSpeed(alt); if (vzT <= cap) { vzT = cap; aff = Math.max(0, -L.vy) / Math.sqrt(Math.max(alt, 0.05)) } }
    const aV = clamp(CFG.velGainV * (vzT - L.vy) + aff, -CFG.climbAccel, CFG.climbAccel)
    L.vy += aV * dt

    // --- inclinaison proportionnelle à l'accélération (nez bas = accélération avant) ---
    const aF = ax * Fx + az * Fz, aR = ax * Rx + az * Rz
    const tk = clamp((alt - 0.1) / 0.7, 0, 1)
    const pT = clamp(-Math.atan2(aF, GRAV), -MAX_TILT, MAX_TILT) * tk
    const rT = clamp(-Math.atan2(aR, GRAV), -MAX_TILT, MAX_TILT) * tk
    const kt = Math.min(1, dt * 5)
    L.pitch += (pT - L.pitch) * kt
    L.roll += (rT - L.roll) * kt
    L.yawV += (yawIn * CFG.yawRate - L.yawV) * Math.min(1, dt * 4)
    L.yaw += L.yawV * dt

    // --- régime moteur : poussée ∝ rpm² ---
    const ge = alt < CFG.groundEffectAlt ? CFG.groundEffectGain * (1 - alt / CFG.groundEffectAlt) : 0
    let rpmT
    if (L.onGround && !(c > 0 && !forced)) rpmT = CFG.rpmIdle
    else if (L.onGround) rpmT = 0.9
    else {
      const need = CFG.mass * Math.hypot(Math.hypot(ax, az), GRAV + aV)
      rpmT = clamp(Math.sqrt(need / MAX_THRUST) * (1 - ge), CFG.rpmIdle, 1)
    }
    L.rpm += (rpmT - L.rpm) * (1 - Math.exp(-dt / (rpmT > L.rpm ? CFG.spoolUp : CFG.spoolDown)))

    // --- batterie : puissance ∝ rpm³ ---
    L.bat = Math.max(0, L.bat - dt / (CFG.batteryMinutes * 60) * Math.pow(L.rpm / RPM_HOVER, 3))
    if (L.bat < CFG.batteryLow && L.bat > 0) {
      beepT -= dt
      if (beepT <= 0) { beepT = L.bat < 0.1 ? 1.5 : 3; if (beepA) beepA.play(true) }
    }

    // --- intégration + collisions ---
    integrate(L, dt)
  }

  function integrate(L, dt) {
    let dx = L.vx * dt, dz = L.vz * dt, dy = L.vy * dt
    mInv.copy(app.matrixWorld).invert()
    const len = Math.hypot(dx, dz)
    if (len > 1e-5 && L.y - L.gy > 0.4) {                // balayage horizontal des points de contrôle
      const dxn = dx / len, dzn = dz / len
      vB.set(dxn, 0, dzn).transformDirection(app.matrixWorld)
      const [c, s] = sc(L.yaw)
      let best = len, nx = 0, nz = 0, hit = false
      for (const p of CPTS) for (const h of CH) {
        vA.set(L.x + p[0] * c + p[1] * s, L.y + h, L.z - p[0] * s + p[1] * c).applyMatrix4(app.matrixWorld)
        const r = world.raycast(vA, vB, len + 0.05, ground)
        if (r && r.distance > 0 && r.distance - 0.05 < best) {
          vC.copy(r.normal).transformDirection(mInv)
          if (Math.hypot(vC.x, vC.z) > 0.2) { best = Math.max(0, r.distance - 0.05); nx = vC.x; nz = vC.z; hit = true }
        }
      }
      if (hit) {
        const nn = Math.hypot(nx, nz); nx /= nn; nz /= nn
        const vn = L.vx * nx + L.vz * nz
        if (vn < 0) { L.vx -= 1.15 * vn * nx; L.vz -= 1.15 * vn * nz }   // glisse le long du mur, petit rebond
        dx = dxn * best; dz = dzn * best
      }
    }
    if (dy > 0) {                                          // plafond
      vA.set(L.x, L.y + 1.5, L.z).applyMatrix4(app.matrixWorld); vB.set(0, 1, 0).transformDirection(app.matrixWorld)
      const r = world.raycast(vA, vB, dy + 0.05, ground)
      if (r && r.distance > 0) { dy = Math.max(0, r.distance - 0.05); L.vy = -0.15 * L.vy }
    }
    L.x += dx; L.z += dz; L.y += dy
    // sol : max des 5 points d'appui, y compris pente
    const [c, s] = sc(L.yaw)
    let gy = null
    for (const f of FOOT) {
      const g = groundAt(L.x + f[0] * c + f[1] * s, L.y + 1.2, L.z - f[0] * s + f[1] * c)
      if (g !== null && (gy === null || g > gy)) gy = g
    }
    if (gy !== null) L.gy = gy
    // ponytail: pas de collision de lacet (la rotation peut traverser un mur) ; ajouter un balayage de rotation si besoin
    if (L.y <= L.gy + 0.001) { L.y = L.gy; if (L.vy < 0) L.vy = 0; L.onGround = true }
    else L.onGround = L.y - L.gy < 0.03 && L.vy <= 0
    if (L.y - L.gy > CFG.altMax) { L.y = L.gy + CFG.altMax; if (L.vy > 0) L.vy = 0 }
  }

  // ---------- HUD ----------
  let dashLast = null
  function refreshHud(L, dt) {
    msgT -= dt
    app.matrixWorld.decompose(vA, qA, vB); eA.setFromQuaternion(qA)
    let hdg = (-(eA.y + L.yaw) * RAD2DEG) % 360; if (hdg < 0) hdg += 360
    const alt = L.y - L.gy, sp = Math.hypot(L.vx, L.vz)
    let msg, col = '#9ad7ff'
    const canLand = alt <= CFG.dismountAlt && sp <= CFG.dismountSpeed
    if (L.bat <= 0) { msg = 'Batterie vide : atterrissage forcé'; col = '#ff5a4d' }
    else if (msgT > 0) { msg = msgText; col = '#ffb020' }
    else if (L.bat < CFG.batteryLow) { msg = 'Batterie faible : performances réduites'; col = '#ffb020' }
    else if (L.onGround && L.rpm < CFG.rpmLift) msg = 'Moteurs en chauffe…'
    else if (L.onGround) msg = 'Prêt : ↑ pour décoller · Espace ou E (maintenir) pour descendre'
    else if (canLand) msg = 'Stationnaire près du sol : Espace ou E (maintenir) pour descendre'
    else msg = (sp < 0.8 && Math.abs(L.vy) < 0.3 ? 'Vol stationnaire' : 'En vol') + (gearT > 0.99 ? ' · train rentré' : '')
    dashLast = { alt, spd: sp * 3.6, bat: L.bat * 100, mot: L.rpm * 100, hdg, status: msg }
    dash.set(Object.assign({ statusColor: col }, dashLast))
  }

  // ---------- poussière ----------
  function dustOne(v, k) {                                  // k : intensité 0..1 (altitude × régime)
    const d = dust.find(p => p.life <= 0); if (!d) return false
    const a = rnd() * TAU, r = 0.25 + rnd() * 0.75, [c, s] = sc(v.yaw), ox = Math.cos(a) * r * PX, oz = Math.sin(a) * r * PZ
    d.cx = v.x + ox * c + oz * s; d.cz = v.z - ox * s + oz * c; d.gy = v.gy
    d.n.position.set(d.cx, d.gy + 0.02, d.cz)
    const out = (1.2 + rnd() * 2.3) * (0.5 + 0.5 * k)       // souffle radial des rotors
    d.vx = Math.cos(a) * out; d.vz = Math.sin(a) * out; d.vy = 0.15 + rnd() * 0.5
    d.w = (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd())            // spirale : composante tangentielle
    d.life = d.t = 0.8 + rnd() * 0.7
    d.s = DUST_SIZE * (0.5 + rnd()); d.o = rnd() < 0.5 ? 0.7 : 1; d.b = 0
    const col = dustPal[(rnd() * dustPal.length) | 0]; if (col !== d.col) { d.col = col; d.n.color = col }
    d.n.opacity = DUST_OPACITY * d.o
    d.n.scale.setScalar(d.s); d.n.active = true; dustAlive++; return true
  }
  function spawnDust(rate, dt, v, k) {
    dustAcc += rate * dt
    while (dustAcc >= 1) { dustAcc -= 1; if (!dustOne(v, k)) { dustAcc = 0; break } }
  }
  function stepDust(dt) {
    const f = Math.exp(-1.8 * dt)
    for (const d of dust) {
      if (d.life <= 0) continue
      d.life -= dt
      if (d.life <= 0) { d.n.active = false; dustAlive--; continue }
      const x = 1 - d.life / d.t
      // spirale : la vitesse radiale tourne doucement ; montée légère puis chute
      const rot = d.w * dt, cr = Math.cos(rot), sr = Math.sin(rot), vx = d.vx * cr - d.vz * sr, vz = d.vx * sr + d.vz * cr
      d.vx = vx * f; d.vz = vz * f; d.vy = d.vy * f - 0.45 * dt
      const p = d.n.position
      p.x += d.vx * dt; p.z += d.vz * dt; p.y = Math.max(d.gy + 0.01, p.y + d.vy * dt)
      d.n.scale.setScalar(d.s * (1 + 0.3 * x))
      const b = Math.min(3, (x * 4) | 0)
      if (b !== d.b) { d.b = b; d.n.opacity = DUST_OPACITY * d.o * DUST_FADE[b] }
    }
  }

  // ============================== BOUCLE ==============================
  let awake = false
  function wake() { if (!awake) { awake = true; app.on('update', tick) } }
  function sleep() { if (awake) { awake = false; app.off('update', tick) } }
  const prev = { x: 0, y: 0, z: 0, yaw: 0 }
  let sfS = 0, vyS = 0                                     // vitesse avant et verticale lissées (dérivées de V : identiques sur tous les clients)

  const copyPose = (to, from) => { to.x = from.x; to.y = from.y; to.z = from.z; to.yaw = from.yaw; to.pitch = from.pitch; to.roll = from.roll; to.rpm = from.rpm; to.gy = from.gy }
  const wPrev = hasV3 ? new Vector3() : null, wNow = hasV3 ? new Vector3() : null
  let wPrevOk = false

  function tick(dt) {
    dt = Math.min(dt, 0.05); T += dt
    if (drv) {
      stepPilot(dt)
      if (drv) {
        copyPose(V, drv)
        poseT -= dt
        if (poseT <= 0) { poseT = 1 / CFG.poseHz; app.send('hb:pose', Object.assign(poseOf(drv), { bat: r3(drv.bat) })) }
        hudT -= dt; if (hudT <= 0) { hudT = 0.1; refreshHud(drv, 0.1) }
      }
    }
    const mine = !!drv                                       // après stepPilot : la descente a pu vider drv
    if (!mine && S.driver) {                                 // pilote distant : interpolation
      const k = 1 - Math.exp(-dt * 10)
      V.x += (Tg.x - V.x) * k; V.y += (Tg.y - V.y) * k; V.z += (Tg.z - V.z) * k
      V.yaw += angDiff(V.yaw, Tg.yaw) * k; V.pitch += (Tg.pitch - V.pitch) * k; V.roll += (Tg.roll - V.roll) * k
      V.rpm += (Tg.rpm - V.rpm) * Math.min(1, dt * 6); V.gy = Tg.gy
    } else if (!mine) {                                      // à l'arrêt : se pose, hélices ralentissent
      const k = 1 - Math.exp(-dt * 10)
      V.x += (Tg.x - V.x) * k; V.z += (Tg.z - V.z) * k; V.yaw += angDiff(V.yaw, Tg.yaw) * k
      V.y = Math.max(Tg.gy, V.y - landSpeed(V.y - Tg.gy) * dt); V.gy = Tg.gy
      V.pitch *= Math.exp(-4 * dt); V.roll *= Math.exp(-4 * dt)
      V.rpm = V.rpm < 0.01 ? 0 : V.rpm * Math.exp(-dt / CFG.spoolDown)
    }
    show(V)

    // vitesses dérivées (pour posture, train, caméra, vibration)
    const ivd = 1 / Math.max(dt, 1e-3)
    const dxw = (V.x - prev.x) * ivd, dzw = (V.z - prev.z) * ivd
    const kv = 1 - Math.exp(-dt * 6)
    sfS += ((-Math.sin(V.yaw) * dxw - Math.cos(V.yaw) * dzw) - sfS) * kv
    vyS += ((V.y - prev.y) * ivd - vyS) * kv
    const spd = Math.hypot(dxw, dzw)
    const altV = V.y - V.gy

    // hélices, flou de mouvement, vibration
    const spin = V.rpm * CFG.propOmega * dt
    const blur = V.rpm > CFG.blurRpm
    const disc = V.rpm > 0.35
    for (const p of rotors) {
      if (spin > 0) p.g.rotation.y += p.dir * spin
      if (p.blades.active === blur) p.blades.active = !blur
      if (p.disc.active !== disc) p.disc.active = disc
    }
    const vib = V.rpm * (0.0025 + 0.004 * Math.min(1, spd / CFG.vMaxFwd))
    body.position.set(Math.sin(T * 37) * vib, -CFG.cgY - CFG.rideDrop + Math.sin(T * 29 + 1) * vib, -CFG.cgZ + Math.sin(T * 41 + 2) * vib)
    if (V.rpm > 0.01) {                                      // balancement de vol stationnaire, atténué à haute vitesse
      const sway = 0.004 * V.rpm * (1 - CFG.aeroStab * Math.min(1, spd / CFG.vMaxFwd))
      tilt.rotation.x = V.pitch + Math.sin(T * 2.1) * sway
      tilt.rotation.z = V.roll + Math.sin(T * 1.7 + 1) * sway
    }
    stepGear(dt, altV, vyS)
    const flut = clamp((spd / CFG.vMaxFwd - 0.6) / 0.4, 0, 1)                   // frémissement de la bulle à haute vitesse
    if (flut > 0 || bubble.rotation.x !== WS.rx) bubble.rotation.x = WS.rx + Math.sin(T * 47) * 0.004 * flut

    // pilote visible (tous les clients)
    const riding = !!(S.driver || mine)
    const costume = riding && S.mode !== 'avatar'
    if (riderG.active !== costume) riderG.active = costume
    if (riding) { stepPosture(dt, sfS, altV); poseRider() }
    if (mine && S.mode === 'avatar') stepAvatarPosture(dt)
    if (riding && S.mode === 'avatar') calibrate(dt, spd, mine)
    else if (seatOff[0] || seatOff[1] || seatOff[2]) { seatOff.fill(0); seat.position.set(0, CFG.seatY, 0.27) }
    if (mine) stepCamera(dt, sfS)

    // état visuel : LED, jauge, poussière
    const batNow = mine ? drv.bat : S.bat
    setLeds(V.rpm < 0.02 && !S.driver && !mine ? 'off' : batNow < CFG.batteryLow ? 'low' : 'ok')
    setGauge(batNow)
    // poussière : intensité = altitude (max < 2 m, nulle à DUST_MAX_ALTITUDE) × régime ; mêmes déclencheurs sur tous les clients (dérivés de V)
    const dk = (altV <= 2 ? 1 : clamp(1 - (altV - 2) / (DUST_MAX_ALTITUDE - 2), 0, 1)) * clamp((V.rpm - 0.4) / 0.4, 0, 1)
    if (dk > 0) spawnDust(DUST_COUNT / 1.15 * 0.7 * dk * (mine ? 1 : 0.6), dt, V, dk)
    if (!dustAir && altV > 0.4) { dustAir = true; if (dk > 0) for (let i = 0; i < DUST_COUNT * 0.3; i++) dustOne(V, dk) }      // rafale au décollage
    else if (dustAir && altV < 0.15) { dustAir = false; if (V.rpm > 0.3) for (let i = 0; i < DUST_COUNT * 0.25; i++) dustOne(V, Math.max(dk, 0.6)) }   // rafale à l'atterrissage
    stepDust(dt)

    // son : pitch et volume suivent le régime ; Doppler pour les autres joueurs
    if (rotorA) {
      if (V.rpm > 0.02 && !rotorOn) { rotorA.play(); rotorOn = true }
      else if (V.rpm <= 0.02 && rotorOn) { rotorA.stop(); rotorOn = false }
      if (rotorOn) {
        const vol = (mine ? 0.5 : 1) * (0.12 + 0.88 * V.rpm)
        if (Math.abs(vol - rotorVol) > 0.01) { rotorVol = vol; rotorA.volume = vol }
        let rate = 0.45 + 1.1 * V.rpm
        const me = hasV3 ? world.getPlayer() : null
        if (hasV3) {
          wNow.set(V.x, V.y + 1, V.z).applyMatrix4(app.matrixWorld)
          if (!mine && me && wPrevOk && dt > 0) {
            vB.copy(wNow).sub(wPrev).multiplyScalar(1 / dt)       // vitesse monde de la moto
            vC.copy(wNow).sub(me.position); const dist = vC.length() || 1
            const vr = vB.dot(vC) / dist                          // > 0 : la moto s'éloigne
            rate *= clamp(343 / (343 + vr), 0.85, 1.15)
          }
          wPrev.copy(wNow); wPrevOk = true
        }
        rotorA.setPlaybackRate(rate)
      }
    }
    prev.x = V.x; prev.y = V.y; prev.z = V.z

    refreshAction()
    if (!drv && !S.driver && V.rpm === 0 && V.y <= Tg.gy + 1e-3 && dustAlive === 0 && !rotorOn && gearT === 0) sleep()
  }

  // ============================== RÉSEAU (client) ==============================
  app.on('hb:driver', d => {
    S.driver = d.driver; S.pose = d.pose; S.bat = d.bat; S.mode = d.mode || DEFAULT_RIDER_MODE
    Object.assign(Tg, d.pose)
    if (d.driver) { if (d.driver !== myId()) Object.assign(V, d.pose) }
    if (d.driver && d.driver === myId() && !drv) startPilot()
    else if (!d.driver && drv) { drv.bat = S.bat; dismount(true) }
    refreshAction(); wake()
  })
  app.on('hb:pose', d => { if (!drv) { Object.assign(Tg, d); S.bat = d.bat } })
  app.on('hb:mode', d => { if (!drv && RIDER_MODES.includes(d.mode)) S.mode = d.mode })
  app.on('destroy', () => { if (drv) { restoreAvatar(world.getPlayer()); if (fx) fx.cancel() } })   // app supprimée en plein vol

  const snap = () => {
    if (S.driver || drv || !hasV3) return
    const g = groundAt(V.x, V.y + 3, V.z)
    if (g !== null) { V.y = V.gy = Tg.y = Tg.gy = g; show(V) }
  }
  show(V); setGauge(S.bat); setLeds('off'); refreshAction()
  Object.assign(prev, { x: V.x, y: V.y, z: V.z })
  if (S.driver) { Pz.r = 0; poseRider() } else poseRider()
  setTimeout(snap, 1500); setTimeout(snap, 5000)
  if (S.driver) wake()
}
