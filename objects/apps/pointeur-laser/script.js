// Pointeur laser — Hyperfy (fork jerometremblay/hyperfy 0.16), app « script-only ».
// Repère : unités en mètres, +Y haut, -Z avant. Aucune géométrie propre : les rayons sont créés
// dans le monde (world.add), donc l'app peut être posée n'importe où (origine/rotation ignorées).
//
// Utilisation : MAINTENIR LASER_KEY (G). Le rayon part de la main droite et se termine EXACTEMENT
// sous le point blanc (réticule = centre de l'écran, pointeur verrouillé). Il s'arrête sur ce que
// touche world.raycast (colliders physiques seulement) et tous les joueurs le voient.

const LASER_KEY = 'keyG'          // touche maintenue = laser actif
const HAND_BONE = 'rightHand'     // os d'où part le rayon (VRM)
const COLOR_KEY = 'keyH'          // touche : change de couleur (cycle)
const COLORS = [                  // id = valeur du champ de config ; hex = couleur du rayon et du point
  { id: 'vert',  label: 'Vert fluo',   hex: '#39ff14' },
  { id: 'rouge', label: 'Rouge laser', hex: '#ff2a2a' },
  { id: 'bleu',  label: 'Bleu fluo',   hex: '#2f7bff' },
  { id: 'mauve', label: 'Mauve',       hex: '#b44cff' },
]
const DEFAULT_COLOR = 'rouge'     // couleur de départ si le champ de config n'est pas touché
const EMISSIVE = 3                // intensité du glow
const MAX_RANGE = 80              // portée max (m) quand rien n'est touché
const SEND_HZ = 15                // fréquence d'envoi réseau de la cible
const MAX_SLOTS = 12              // lasers simultanés max (pool créé une fois)
const STALE_S = 0.6               // un laser distant sans nouvelles disparaît après (s)
const SMOOTH = 18                 // lissage du point côté observateurs (1/s)
const CHIP_MS = 1600              // durée d'affichage de l'étiquette « Laser : couleur »

app.configure([{
  key: 'color', type: 'switch', label: 'Couleur de départ (H pour changer en jeu)',
  options: COLORS.map(c => ({ label: c.label, value: c.id })), initial: DEFAULT_COLOR,
}])

const isClient = world.isClient
const isServer = world.isServer

// ---------- Serveur : relais validé ----------
if (isServer) {
  const num = n => typeof n === 'number' && isFinite(n) && Math.abs(n) < 1e5
  app.on('aim', (d, networkId) => {
    if (!d || typeof d.id !== 'string') return
    const pl = world.getPlayer(d.id)
    if (!pl || pl.networkId !== networkId) return            // l'expéditeur doit être le joueur
    if (d.on) {
      if (!Array.isArray(d.p) || d.p.length !== 3 || !d.p.every(num)) return
      const c = Number.isInteger(d.c) && d.c >= 0 && d.c < COLORS.length ? d.c : 1
      app.send('aim', { id: d.id, on: 1, p: d.p, h: d.h ? 1 : 0, c }, networkId)
    } else {
      app.send('aim', { id: d.id, on: 0 }, networkId)
    }
  })
  world.on('leave', e => app.send('aim', { id: e.playerId, on: 0 }))
}

// ---------- Client ----------
if (isClient && typeof Vector3 === 'function') {
  const UP = new Vector3(0, 1, 0)
  const slots = []
  const matBeam = { color: COLORS[1].hex, emissive: COLORS[1].hex, emissiveIntensity: EMISSIVE, metalness: 0, roughness: 1 }
  const base = { castShadow: false, receiveShadow: false, physics: null, ...matBeam }

  // pool créé UNE fois (jamais de nœud créé dans update)
  for (let i = 0; i < MAX_SLOTS; i++) {
    const beam = app.create('prim', { type: 'cylinder', size: [1, 1, 1], ...base })
    const dot = app.create('prim', { type: 'sphere', size: [1], ...base })
    beam.active = false
    dot.active = false
    world.add(beam)
    world.add(dot)
    slots.push({ id: null, beam, dot, cur: new Vector3(), tgt: new Vector3(), hit: false, on: false, last: 0, init: false, c: 1, cc: -1 })
  }

  const slotFor = id => {
    let s = slots.find(s => s.id === id)
    if (s) return s
    s = slots.find(s => !s.on) // libre ou éteint
    if (!s) return null
    s.id = id
    s.init = false
    return s
  }
  const hide = s => {
    s.on = false
    s.beam.active = false
    s.dot.active = false
  }

  const o = new Vector3(), d = new Vector3(), a = new Vector3(), b = new Vector3()
  const hand = new Vector3(), mid = new Vector3(), dir = new Vector3()
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x)
  const clampN = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x)

  // position de la main (monde) d'un joueur ; repli = poitrine
  function handPos(pl, out) {
    const m = pl.getBoneTransform?.(HAND_BONE)
    if (m) return out.setFromMatrixPosition(m)
    out.copy(pl.position)
    out.y += (pl.height || 1.6) * 0.7
    return out
  }

  // dessine le rayon d'un slot de la main vers s.cur
  function draw(s, pl) {
    handPos(pl, hand)
    dir.copy(s.cur).sub(hand)
    const len = Math.max(dir.length(), 0.01)
    dir.multiplyScalar(1 / len)
    mid.copy(hand).addScaledVector(dir, len / 2)
    const r = clampN(len * 0.0012, 0.006, 0.03)            // un peu plus épais au loin
    s.beam.position.copy(mid)
    s.beam.quaternion.setFromUnitVectors(UP, dir)
    s.beam.scale.set(r, len, r)
    s.beam.active = true
    if (s.cc !== s.c) {                       // couleur par instance : pas de reconstruction
      s.cc = s.c
      const hex = COLORS[s.c].hex
      s.beam.color = hex; s.beam.emissive = hex
      s.dot.color = hex; s.dot.emissive = hex
    }
    if (s.hit) {
      const dr = clampN(len * 0.005, 0.02, 0.12)
      s.dot.position.copy(s.cur)
      s.dot.scale.set(dr, dr, dr)
      s.dot.active = true
    } else {
      s.dot.active = false
    }
  }

  // ----- aim local : rayon de la caméra = exactement le point blanc -----
  const ctrl = app.control()
  const mask = world.createLayerMask('environment', 'prop', 'player')
  let holding = false
  let myColor = COLORS.findIndex(c => c.id === props.color)                 // départ = champ de config
  if (myColor < 0) myColor = COLORS.findIndex(c => c.id === DEFAULT_COLOR)
  let sendT = 0
  let wasHolding = false

  function aimLocal(me) {
    const cam = ctrl.camera
    // rayon centre d'écran : part de la tête (rig), même droite que la vraie caméra (qui est reculée de zoom)
    o.copy(cam.position)
    d.set(0, 0, -1).applyQuaternion(cam.quaternion)
    let h = world.raycast(o, d, MAX_RANGE, mask)
    // la tête/épaule peut frôler notre propre capsule : on la traverse (max 3 fois), sans jamais s'arrêter dessus
    for (let i = 0; i < 3 && h && h.playerId === me.id; i++) {
      a.copy(h.point).addScaledVector(d, 0.35)     // 0.35 > rayon de la capsule
      h = world.raycast(a, d, MAX_RANGE, mask)
    }
    if (h && h.playerId === me.id) h = null
    if (h) { b.copy(h.point); return true }
    b.copy(o).addScaledVector(d, MAX_RANGE)
    return false
  }

  function tick(dt) {
    const now = Date.now()
    const me = world.getPlayer()
    // local
    if (holding && me) {
      const hit = aimLocal(me)
      const s = slotFor(me.id)
      if (s) {
        s.cur.copy(b); s.hit = hit; s.on = true; s.last = now; s.init = true; s.c = myColor
        draw(s, me)
      }
      sendT += dt
      if (sendT >= 1 / SEND_HZ) {
        sendT = 0
        app.send('aim', { id: me.id, on: 1, p: [+b.x.toFixed(3), +b.y.toFixed(3), +b.z.toFixed(3)], h: hit ? 1 : 0, c: myColor })
      }
    }
    if (wasHolding && !holding && me) {
      app.send('aim', { id: me.id, on: 0 })
      const s = slots.find(s => s.id === me.id)
      if (s) hide(s)
    }
    wasHolding = holding
    // distants : lissage + expiration
    let alive = holding
    const k = clamp01(dt * SMOOTH)
    for (const s of slots) {
      if (!s.on || (me && s.id === me.id)) continue
      if (now - s.last > STALE_S * 1000) { hide(s); continue }
      const pl = world.getPlayer(s.id)
      if (!pl) { hide(s); continue }
      if (!s.init) { s.cur.copy(s.tgt); s.init = true } else s.cur.lerp(s.tgt, k)
      draw(s, pl)
      alive = true
    }
    if (!alive) sleep()
  }

  let awake = false
  function wake() { if (!awake) { awake = true; app.on('lateUpdate', tick) } }
  function sleep() { if (awake) { awake = false; app.off('lateUpdate', tick) } }

  // lateUpdate : la caméra du joueur est mise à jour dans son propre lateUpdate → le point reste collé au réticule
  const key = ctrl[LASER_KEY]
  key.onPress = () => { holding = true; sendT = 1; wake() }
  key.onRelease = () => { holding = false; wake() }               // un dernier tick envoie « off »

  // étiquette écran (créée une fois), visible CHIP_MS après un changement de couleur
  const chip = app.create('ui', {
    space: 'screen', pivot: 'bottom-center', position: [0.5, 1, 0], offset: [0, -110, 0],
    width: 240, height: 40, backgroundColor: 'rgba(8,14,12,0.82)', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', pointerEvents: false,
  })
  const chipText = app.create('uitext', { value: '', fontSize: 18, fontWeight: 800, color: '#ffffff' })
  chip.add(chipText)
  chip.active = false
  app.add(chip)
  let chipTok = 0
  ctrl[COLOR_KEY].onPress = () => {
    myColor = (myColor + 1) % COLORS.length
    chipText.value = `Laser : ${COLORS[myColor].label}`
    chipText.color = COLORS[myColor].hex
    chip.active = true
    const tok = ++chipTok
    setTimeout(() => { if (tok === chipTok) chip.active = false }, CHIP_MS)
  }

  app.on('aim', d => {
    if (!d || typeof d.id !== 'string') return
    const me = world.getPlayer()
    if (me && d.id === me.id) return
    if (!d.on) {
      const s = slots.find(s => s.id === d.id)
      if (s) hide(s)
      return
    }
    const s = slotFor(d.id)
    if (!s || !Array.isArray(d.p)) return
    s.tgt.set(d.p[0], d.p[1], d.p[2])
    s.hit = !!d.h
    if (Number.isInteger(d.c) && d.c >= 0 && d.c < COLORS.length) s.c = d.c
    s.last = Date.now()
    s.on = true
    wake()
  })

  app.on('destroy', () => {
    ctrl.release()
    sleep()
  })

  // hook de test (simulation) ; sans effet dans le vrai monde
  props.__test = { slots, chip, chipText, get holding() { return holding }, get myColor() { return myColor } }
}
