// =====================================================================================
// Jukebox rétro — joue les mp3 listés dans un fichier playlist.m3u (dossier servi par Nginx).
// Repère : mètres, +Y haut, -Z = AVANT (face aux boutons), ORIGINE AU SOL, centrée en X/Z.
// Dimensions : ~0,84 (L) × 0,56 (P) × 1,74 (H).
// Contrôles (clic sur les boutons de la façade, ou E près du jukebox = lecture/pause) :
//   VOL − · PRÉC. · DÉBUT (recommencer la chanson) · LECTURE/PAUSE · SUIV. · VOL +
// Le serveur est l'autorité : il garde la liste, la piste, la position et le volume,
// et tous les clients jouent la même chose en synchro (horloge réseau world.getTime()).
// =====================================================================================

// ---- Réglages (modifiables aussi dans les champs de l'app) ----
const DEFAULT_MUSIC = 'https://rouynhyperfy.duckdns.org/musique'   // dossier des mp3, vu par les navigateurs (HTTPS)
const DEFAULT_MUSIC_SERVER = 'http://10.0.10.131:8097/musique'     // même dossier, vu par le serveur Hyperfy (Docker -> LXC)
const DEFAULT_PLAYLIST = 'playlist.m3u'
const VOL_STEP = 0.1
const VOL_DEFAULT = 0.7
const LIST_REFRESH_S = 900        // le serveur relit la bibliothèque aux 15 min
const MAX_TITLE = 26

// ---- Livrée ----
const WOOD = '#6e4426', WOOD_DARK = '#3d2314', PLINTH = '#2a1a10'
const CHROME = '#d8dde2', GLASS = '#0d1b2a', SCREEN_BG = '#0b1410'
const NEON_BASE = ['#ff3b30', '#ff4fa3', '#ff7a3d', '#27d3e6']   // couleurs au repos (rouge, rose, orange, cyan)

app.configure([
  { key: 'musicUrl', type: 'text', label: 'URL du dossier de musique (navigateurs)', initial: DEFAULT_MUSIC },
  { key: 'musicUrlServer', type: 'text', label: 'URL du dossier de musique (serveur Hyperfy)', initial: DEFAULT_MUSIC_SERVER },
  { key: 'playlist', type: 'text', label: 'Fichier playlist (.m3u)', initial: DEFAULT_PLAYLIST },
])
const trimSlash = s => String(s || '').replace(/\/+$/, '')
const musicBase = () => trimSlash(props.musicUrl || DEFAULT_MUSIC)
const musicServer = () => trimSlash(props.musicUrlServer || DEFAULT_MUSIC_SERVER)
const playlistName = () => String(props.playlist || DEFAULT_PLAYLIST).replace(/^\/+/, '')
// f = chemin relatif dans le dossier de musique (ou URL absolue) ; chaque segment est encodé (espaces, accents)
const fileUrl = (base, f) => (/^https?:\/\//i.test(f) ? f : base + '/' + f.split('/').map(encodeURIComponent).join('/'))
const clampN = (v, a, b) => Math.min(b, Math.max(a, v))
const net = () => world.getTime()                                  // secondes, horloge réseau partagée

// ---- État partagé (serveur = autorité) ----
// t0 = instant réseau où la position 0 de la piste est (ou aurait été) atteinte pendant la lecture
const st = app.state
if (world.isServer) {
  Object.assign(st, { rev: 0, i: 0, playing: false, vol: VOL_DEFAULT, t0: 0, pos: 0, err: 'Chargement de la playlist…', tracks: [] })
}
const posOf = s => (s.playing ? net() - s.t0 : s.pos)
const slim = s => ({ rev: s.rev, i: s.i, playing: s.playing, vol: s.vol, t0: s.t0, pos: s.pos, err: s.err })

// ---- Primitives ----
const rig = app.create('group')          // pivot de calage au sol
app.add(rig)
let PARENT = rig
function prim(type, size, position, mat, rotation, extra) {
  const n = app.create('prim', Object.assign({ type, size, position, rotation: rotation || [0, 0, 0],
    castShadow: true, receiveShadow: true, physics: null }, mat, extra || {}))
  PARENT.add(n); return n
}
const box = (s, p, m, r, e) => prim('box', s, p, m, r, e)
const cyl = (rt, rb, h, p, m, r, e) => prim('cylinder', [rt, rb, h], p, m, r, e)
const sph = (r, p, m, e) => prim('sphere', [r], p, m, null, e)
function yAxisRotationBetween(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], h = Math.hypot(dx, dz)
  return h === 0 ? [dy >= 0 ? 0 : Math.PI, 0, 0] : [Math.atan2(h, dy), Math.atan2(dx, dz), 0]
}
function cylBetween(a, b, r, m, e) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  return cyl(r, r, L, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], m, yAxisRotationBetween(a, b), e)
}
const LAY_Z = [Math.PI / 2, 0, 0]        // cylindre couché le long de Z (axe vers l'avant)
const wood = c => ({ color: c, metalness: 0.05, roughness: 0.7 })
const chrome = { color: CHROME, metalness: 0.9, roughness: 0.12 }
const deckMat = { color: '#cfd5da', metalness: 0.5, roughness: 0.35 }
const lamp = c => ({ color: c, emissive: c, emissiveIntensity: 1.6, metalness: 0, roughness: 0.3 })

// ---- Corps ----
const FZ = -0.25                          // plan de la façade
box([0.86, 0.1, 0.58], [0, 0.05, 0], wood(PLINTH), null, { physics: 'static' })
box([0.78, 1.15, 0.5], [0, 0.675, 0], wood(WOOD), null, { physics: 'static' })
cyl(0.39, 0.39, 0.5, [0, 1.25, 0], wood(WOOD), LAY_Z, { physics: 'static' })
for (const sx of [-1, 1]) {
  cyl(0.055, 0.065, 0.4, [sx * 0.385, 0.2, -0.17], wood(WOOD_DARK))         // colonnes de pied
  for (const y of [1.0, 1.07, 1.14]) box([0.045, 0.03, 0.52], [sx * 0.4, y, 0], chrome)   // nervures chromées
}
// crête chromée
box([0.26, 0.05, 0.07], [0, 1.655, FZ + 0.02], chrome)
sph(0.045, [0, 1.7, FZ + 0.02], chrome)
cylBetween([-0.04, 1.68, FZ + 0.02], [-0.24, 1.58, FZ + 0.02], 0.016, chrome)
cylBetween([0.04, 1.68, FZ + 0.02], [0.24, 1.58, FZ + 0.02], 0.016, chrome)

// ---- Néons (couleur animée pendant la lecture) ----
const neon = []                           // { n, k } k = position 0..1 pour décaler la teinte
function addNeon(n, k) { neon.push({ n, k }) }
{
  const R = 0.33, cy = 1.25, z = FZ - 0.012, N = 12
  const pts = []
  for (let j = 0; j <= N; j++) { const a = Math.PI - (j / N) * Math.PI; pts.push([R * Math.cos(a), cy + R * Math.sin(a), z]) }
  pts.forEach((p, j) => { addNeon(sph(0.037, p, lamp(NEON_BASE[0])), j / N * 0.5) })
  for (let j = 0; j < N; j++) addNeon(cylBetween(pts[j], pts[j + 1], 0.035, lamp(NEON_BASE[0])), (j + 0.5) / N * 0.5)
  for (const sx of [-1, 1]) {            // montants latéraux
    const top = [sx * R, cy, z], bot = [sx * R, 0.3, z]
    addNeon(cylBetween(top, bot, 0.035, lamp(NEON_BASE[1])), sx < 0 ? 0.5 : 0.0)
    addNeon(sph(0.037, bot, lamp(NEON_BASE[1])), sx < 0 ? 0.55 : 0.05)
  }
  // « U » central
  const ur = 0.17, ucx = 0, ucy = 0.36, uz = FZ - 0.012, M = 8, up = []
  for (let j = 0; j <= M; j++) { const a = Math.PI + (j / M) * Math.PI; up.push([ucx + ur * Math.cos(a), ucy + ur * Math.sin(a), uz]) }
  for (const sx of [-1, 1]) addNeon(cylBetween([sx * ur, 0.6, uz], [sx * ur, ucy, uz], 0.032, lamp(NEON_BASE[3])), 0.75)
  up.forEach(p => addNeon(sph(0.034, p, lamp(NEON_BASE[3])), 0.75))
  for (let j = 0; j < M; j++) addNeon(cylBetween(up[j], up[j + 1], 0.032, lamp(NEON_BASE[3])), 0.75)
}
// grille de haut-parleur dans le « U »
box([0.3, 0.4, 0.012], [0, 0.42, FZ - 0.004], wood('#15110d'))
for (let j = 0; j < 4; j++) {
  const y0 = 0.27 + j * 0.07
  cylBetween([-0.14, y0, FZ - 0.012], [0.14, y0 + 0.14, FZ - 0.012], 0.006, chrome)
  cylBetween([0.14, y0, FZ - 0.012], [-0.14, y0 + 0.14, FZ - 0.012], 0.006, chrome)
}

// ---- Hublot + vinyle qui tourne ----
const VZ = FZ - 0.012
const VY = 1.28
prim('torus', [0.22, 0.013], [0, VY, VZ], chrome)
cyl(0.215, 0.215, 0.008, [0, VY, VZ + 0.004], wood(GLASS), LAY_Z)
const vinyl = app.create('group', { position: [0, VY, VZ - 0.005] })
PARENT.add(vinyl)
{
  const keep = PARENT; PARENT = vinyl
  cyl(0.18, 0.18, 0.008, [0, 0, 0], wood('#0b0b0d'), LAY_Z)
  cyl(0.135, 0.135, 0.009, [0, 0, -0.001], wood('#1b1b20'), LAY_Z)
  cyl(0.055, 0.055, 0.011, [0, 0, -0.002], wood('#c0392b'), LAY_Z)
  box([0.02, 0.045, 0.012], [0.1, 0, -0.003], wood('#eceff1'))    // repère pour voir la rotation
  PARENT = keep
}

// ---- Écran (face avant) + pupitre de boutons ----
box([0.56, 0.2, 0.04], [0, 0.92, FZ - 0.01], wood('#222a26'))
box([0.58, 0.15, 0.09], [0, 0.7, FZ - 0.035], deckMat)
const BZ = FZ - 0.08                     // face des boutons
// x négatif = côté droit de qui regarde le jukebox (il est face à +Z, donc sa droite est -X)
const BTN = [
  { act: 'voldown', x: 0.215, col: '#d9a441', sym: '−', txt: 'VOL −' },
  { act: 'prev', x: 0.129, col: '#c0392b', sym: '|◄', txt: 'PRÉC.' },
  { act: 'restart', x: 0.043, col: '#2e86c1', sym: '↺', txt: 'DÉBUT' },
  { act: 'toggle', x: -0.043, col: '#27ae60', sym: '► ❚❚', txt: 'LECT.' },
  { act: 'next', x: -0.129, col: '#c0392b', sym: '►|', txt: 'SUIV.' },
  { act: 'volup', x: -0.215, col: '#d9a441', sym: '+', txt: 'VOL +' },
]
function request(act) { app.send('req', { act }) }
function press(b) {
  request(b.act)
  if (!b.node) return
  b.node.position.z = BZ - 0.012       // enfoncé
  setTimeout(() => { b.node.position.z = BZ }, 120)
}
for (const b of BTN) {
  b.node = cyl(0.032, 0.032, 0.03, [b.x, 0.725, BZ], { color: b.col, emissive: b.col, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.35 }, LAY_Z,
    { physics: 'static', onPointerDown: () => press(b) })
}

// ---- Interface (client seulement) ----
let vid = null, scr = null
if (world.isClient) {
  const txt = (value, o) => { const t = app.create('uitext', Object.assign({ value, color: '#ffffff', fontSize: 16 }, o)); return t }
  // libellés sous les boutons
  for (const b of BTN) {
    const u = app.create('ui', { width: 84, height: 46, size: 0.001, lit: false, pointerEvents: false, backgroundColor: null,
      flexDirection: 'column', alignItems: 'center', gap: 0, position: [b.x, 0.655, FZ - 0.0815], rotation: [0, Math.PI, 0] })
    u.add(txt(b.sym, { fontSize: 20, fontWeight: 700, color: '#10151a', textAlign: 'center' }))
    u.add(txt(b.txt, { fontSize: 13, fontWeight: 700, color: '#10151a', textAlign: 'center' }))
    PARENT.add(u)
  }
  // écran
  const ui = app.create('ui', { width: 520, height: 170, size: 0.001, lit: false, pointerEvents: false,
    backgroundColor: SCREEN_BG, borderRadius: 10, padding: 10, flexDirection: 'column', gap: 6,
    position: [0, 0.92, FZ - 0.0315], rotation: [0, Math.PI, 0] })
  scr = {
    title: txt('', { fontSize: 30, fontWeight: 700, color: '#ffd54a' }),
    artist: txt('', { fontSize: 22, color: '#9be7a8' }),
    barBg: app.create('uiview', { width: 500, height: 8, backgroundColor: '#1e2b24', borderRadius: 4 }),
    barFill: app.create('uiview', { width: 0, height: 8, backgroundColor: '#ffb300', borderRadius: 4 }),
    row: app.create('uiview', { width: 500, height: 28, flexDirection: 'row', justifyContent: 'space-between' }),
    left: txt('', { fontSize: 20, color: '#cfd8dc' }),
    right: txt('', { fontSize: 20, color: '#cfd8dc' }),
  }
  scr.barBg.add(scr.barFill); scr.row.add(scr.left); scr.row.add(scr.right)
  ui.add(scr.title); ui.add(scr.artist); ui.add(scr.barBg); ui.add(scr.row)
  PARENT.add(ui)
  // lecteur audio : nœud video invisible (lecture en continu, pas de décodage complet en mémoire)
  vid = app.create('video', { src: null, visible: false, group: 'music', spatial: true,
    refDistance: 2, maxDistance: 30, rolloffFactor: 2, volume: 0, position: [0, 1.1, -0.2] })
  PARENT.add(vid)
  // E près du jukebox = lecture / pause
  const act = app.create('action', { label: 'Lecture / Pause', distance: 2.2, duration: 0.3, position: [0, 0.9, -0.5],
    onTrigger: () => request('toggle') })
  PARENT.add(act)
}
const setP = (n, k, v) => { if (n[k] !== v) n[k] = v }

// ---- Utilitaires ----
const hex2 = v => Math.round(clampN(v, 0, 1) * 255).toString(16).padStart(2, '0')
function hsl(h, s, l) {
  h = ((h % 1) + 1) % 1
  const f = n => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return '#' + hex2(f(0)) + hex2(f(8)) + hex2(f(4))
}
const mmss = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
const cut = s => (s.length > MAX_TITLE ? s.slice(0, MAX_TITLE - 1) + '…' : s)
const gain = v => v * v                  // courbe de volume plus naturelle que linéaire

// =====================================================================================
// SERVEUR : liste, piste courante, fin de piste, requêtes
// =====================================================================================
if (world.isServer) {
  let timerSeq = 0
  let lastReq = 0
  const dur = () => (st.tracks[st.i] ? st.tracks[st.i].d : 0)
  const pub = () => app.send('state', slim(st))

  function schedule() {
    const id = ++timerSeq
    if (!st.playing || !dur()) return
    const wait = Math.max(0.3, dur() - posOf(st)) + 0.6
    setTimeout(() => {
      if (id !== timerSeq || !st.playing) return
      if (dur() - posOf(st) > 0.3) return schedule()   // fin repoussée (pause/reprise)
      setTrack(st.i + 1, true)
    }, wait * 1000)
  }
  function setTrack(i, playing) {
    const n = st.tracks.length
    if (!n) return
    st.i = ((i % n) + n) % n
    st.rev++
    st.playing = playing
    st.t0 = net()
    st.pos = 0
    if (st.err) st.err = ''
    pub(); schedule()
  }
  function toggle() {
    if (!st.tracks.length) return
    if (st.playing) { st.pos = posOf(st); st.playing = false; pub(); schedule(); return }
    if (st.rev === 0) return setTrack(st.i, true)       // toute première lecture
    st.playing = true; st.t0 = net() - st.pos
    pub(); schedule()
  }
  const ACTS = {
    toggle,
    next: () => setTrack(st.i + 1, true),
    prev: () => setTrack(st.i - 1, true),
    restart: () => setTrack(st.i, true),
    volup: () => { st.vol = clampN(Math.round((st.vol + VOL_STEP) * 10) / 10, 0, 1); pub() },
    voldown: () => { st.vol = clampN(Math.round((st.vol - VOL_STEP) * 10) / 10, 0, 1); pub() },
  }
  let fails = 0
  app.on('req', d => {
    const act = d && typeof d.act === 'string' ? d.act : ''
    const t = net()
    if (!Object.hasOwn(ACTS, act) || t - lastReq < 0.15) return   // liste blanche + anti-mitraillage
    lastReq = t; fails = 0
    ACTS[act]()
  })
  // un client signale la fin / l'échec de la piste : on ne le croit que si le serveur le confirme
  app.on('ended', d => {
    if (!d || d.rev !== st.rev || !st.playing) return
    if (dur() && posOf(st) < dur() - 2) return
    if (!dur() && posOf(st) < 5) return
    fails = 0
    setTrack(st.i + 1, true)
  })
  app.on('failed', async d => {
    if (!d || d.rev !== st.rev || !st.playing || !st.tracks[st.i]) return
    const rev = st.rev
    const r = await fetch(fileUrl(musicServer(), st.tracks[st.i].f), { method: 'HEAD' })
    if (r && r.ok) return                              // le fichier existe bien : le souci est local à ce client
    if (rev !== st.rev || !st.playing) return          // quelqu'un a déjà changé de piste
    if (++fails > 5) { fails = 0; st.playing = false; st.err = 'Lecture impossible (fichier introuvable)'; pub(); return }
    setTrack(st.i + 1, true)
  })

  // #EXTINF:<secondes>,<Artiste - Titre> précède chaque fichier ; sans EXTINF le titre vient du nom de fichier
  function parseM3U(text) {
    const out = []
    let meta = null
    for (let line of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
      line = line.trim()
      if (!line) continue
      if (line.startsWith('#')) {
        const m = /^#EXTINF:\s*(-?\d+)[^,]*,(.*)$/.exec(line)
        if (m) meta = { d: Math.max(0, Number(m[1])), label: m[2].trim() }
        continue
      }
      const f = line.replace(/\\/g, '/').replace(/^\.\//, '')
      let label = meta && meta.label
      if (!label) label = f.split('/').pop().replace(/\.[^.]+$/, '').replace(/_/g, ' ')
      const k = label.indexOf(' - ')
      out.push({ f, d: meta ? meta.d : 0, a: k > 0 ? label.slice(0, k) : '', t: k > 0 ? label.slice(k + 3) : label })
      meta = null
    }
    return out
  }
  async function loadList() {
    let list = null
    for (const base of [musicServer(), musicBase()]) {
      const r = await fetch(base + '/' + playlistName())
      if (r && r.ok) { try { list = parseM3U(await r.text()) } catch (e) { list = null } }
      if (list) break
    }
    if (!list || !list.length) {
      st.err = list ? 'Playlist vide' : 'Playlist introuvable'
      pub(); setTimeout(() => loadList(), 30000); return
    }
    const curF = st.tracks[st.i] && st.tracks[st.i].f
    st.tracks = list
    const keep = st.tracks.findIndex(t => t.f === curF)
    st.i = keep >= 0 ? keep : 0
    if (keep < 0 && st.playing) { st.playing = false; st.pos = 0 }
    st.err = ''
    app.send('list', { tracks: st.tracks })
    pub()
    setTimeout(() => loadList(), LIST_REFRESH_S * 1000)
  }
  loadList()
}

// =====================================================================================
// CLIENT : lecture synchronisée, écran, animations
// =====================================================================================
if (world.isClient) {
  let T = []                              // liste des morceaux
  let S = null                            // dernier état reçu
  let cur = { rev: -1 }                   // piste actuellement chargée dans le lecteur
  let everPlayed = false, loadAt = 0, lastPlayTry = 0, lastSeek = 0, reported = ''
  let awake = false, accHue = 0, accScr = 1, hue = 0, lastKey = ''

  const urlOf = i => fileUrl(musicBase(), T[i].f)

  function render() {                     // écran : n'écrit que ce qui change
    if (!scr) return
    let title = 'JUKEBOX', artist = '', left = '', right = '', frac = 0
    if (!S) { left = 'Connexion…' }
    else {
      const trk = T[S.i]
      right = 'VOL ' + Math.round(S.vol * 100) + ' %'
      if (S.err && !T.length) left = S.err
      else if (trk) {
        title = cut(trk.t || '?'); artist = cut(trk.a || '')
        const p = Math.max(0, posOf(S))
        const d = trk.d
        if (!S.playing) left = S.rev === 0 ? 'Appuie sur ► pour lancer' : 'Pause  ' + mmss(S.pos) + (d ? ' / ' + mmss(d) : '')
        else if (!everPlayed && cur.rev === S.rev) left = 'Chargement…'
        else left = mmss(p) + (d ? ' / ' + mmss(d) : '')
        frac = d ? clampN((S.playing ? p : S.pos) / d, 0, 1) : 0
      }
      if (S.err && T.length) left = S.err
    }
    setP(scr.title, 'value', title); setP(scr.artist, 'value', artist)
    setP(scr.left, 'value', left); setP(scr.right, 'value', right)
    setP(scr.barFill, 'width', Math.round(frac * 500 / 4) * 4)       // pas de 4 px : peu de redessins
  }

  function colorNeon(playing) {
    for (const { n, k } of neon) {
      const c = playing ? hsl(hue + k, 0.95, 0.55) : null
      if (c) { n.color = c; n.emissive = c }
    }
  }
  function neonRest() {
    for (const { n, k } of neon) {
      const c = k >= 0.7 ? NEON_BASE[3] : (k < 0.3 ? NEON_BASE[1] : NEON_BASE[0])
      n.color = c; n.emissive = c
    }
  }

  function apply(s) {
    S = s
    if (!vid) return
    setP(vid, 'volume', gain(s.vol))
    if (!s.playing) { try { vid.pause() } catch (e) {} }
    else if (T.length && s.rev !== cur.rev) {                       // nouvelle piste (ou « début »)
      const sameUrl = vid.src === urlOf(s.i)
      cur = { rev: s.rev, i: s.i }
      everPlayed = false; reported = ''; loadAt = net(); lastSeek = 0
      if (sameUrl) { try { vid.currentTime = 0 } catch (e) {} } else vid.src = urlOf(s.i)
    }
    if (s.playing) wake(); else { neonRest(); render(); sleep() }
    render()
  }

  function onUpdate(dt) {
    if (!S || !S.playing) return sleep()
    vinylSpin(dt)
    accHue += dt
    if (accHue >= 0.1) { hue += accHue * 0.07; accHue = 0; colorNeon(true) }
    // lecture : relancer, caler la position, détecter fin / échec
    const t = net()
    const playing = vid.isPlaying
    if (!playing) {
      if (t - lastPlayTry > 1) { lastPlayTry = t; try { vid.play() } catch (e) {} }
      if (everPlayed && reported !== 'e' + cur.rev) {                    // a joué puis s'est arrêté : fin de piste ?
        const d = T[S.i] ? T[S.i].d : 0
        if (posOf(S) > Math.max(3, d - 2)) { reported = 'e' + cur.rev; app.send('ended', { rev: cur.rev }) }
      }
      if (!everPlayed && reported !== 'f' + cur.rev && t - loadAt > 45) { reported = 'f' + cur.rev; app.send('failed', { rev: cur.rev }) }
    } else {
      everPlayed = true
      const want = posOf(S)
      if (Math.abs(vid.currentTime - want) > 1.2 && t - lastSeek > 3) { lastSeek = t; try { vid.currentTime = want } catch (e) {} }
    }
    accScr += dt
    if (accScr >= 1) { accScr = 0; render() }
  }
  function vinylSpin(dt) { vinyl.rotation.z -= dt * 3.2 }
  function wake() { if (!awake) { awake = true; app.on('update', onUpdate) } }
  function sleep() { if (awake) { awake = false; app.off('update', onUpdate) } }

  app.on('list', d => { T = (d && d.tracks) || []; if (S) apply(S) })
  app.on('state', d => apply(d))
  if (st && st.tracks) T = st.tracks                                  // arrivée tardive : instantané du serveur
  apply(slim(st))
  neonRest()

  // calage au sol réel (recale le groupe rig, pas la racine de l'app)
  if (typeof Vector3 === 'function') {
    setTimeout(() => {
      try {
        const o = new Vector3().setFromMatrixPosition(app.matrixWorld)
        const hit = world.raycast(new Vector3(o.x, o.y + 0.6, o.z), new Vector3(0, -1, 0), 2, world.createLayerMask('environment'))
        if (hit && Math.abs(hit.point.y - o.y) < 0.8) rig.position.y = hit.point.y - o.y
      } catch (e) { /* pas de sol détecté : on garde l'origine telle quelle */ }
    }, 1000)
  }

  if (props && props.__test) props.__test.hook = { get S() { return S }, get T() { return T }, get cur() { return cur }, vid, scr, BTN, neon, vinyl, press, get awake() { return awake } }
}
