// Hyperfy primitive app: standalone animated hearth fire with iron grate.
// Inspired by the provided fire reference. Coordinates in metres.
// Origin is the center of the grate at floor level.

app.resetOnMove = false

// Lighting controls. Sliders use fractional steps; editing a setting rebuilds the app.
app.configure([
  { type: 'section', label: 'Fire sound' },
  { type: 'file', key: 'fireSound', label: 'Fireplace recording', kind: 'audio' },
  { type: 'range', key: 'soundVolume', label: 'Sound volume (%)', initial: 8, min: 0, max: 100, step: 1, hint: 'Quiet by default; 0 mutes the fire' },
  { type: 'section', label: 'Occasional crackles' },
  { type: 'range', key: 'crackleVolume', label: 'Crackle volume (%)', initial: 12, min: 0, max: 100, step: 1, hint: 'Independent of the steady fire sound; 0 disables occasional crackles' },
  { type: 'range', key: 'crackleMinInterval', label: 'Minimum interval (s)', initial: 8, min: 1, max: 120, step: 1 },
  { type: 'range', key: 'crackleMaxInterval', label: 'Maximum interval (s)', initial: 25, min: 1, max: 120, step: 1, hint: 'Each crackle waits a random interval between these two settings' },
  { type: 'section', label: 'Fire lighting' },
  { type: 'range', key: 'lightIntensity', label: 'Light intensity', initial: 125, min: 0, max: 300, step: 0.5, hint: 'Brightness of the point light' },
  { type: 'range', key: 'lightRange', label: 'Light range (m)', initial: 8, min: 0.5, max: 20, step: 0.1, hint: 'How far the fire illuminates nearby surfaces' },
  { type: 'range', key: 'lightDecay', label: 'Light decay', initial: 2, min: 0, max: 4, step: 0.05, hint: 'Light falloff, 2 is inverse-square' },
  { type: 'range', key: 'flickerAmount', label: 'Flicker strength', initial: 0.24, min: 0, max: 1, step: 0.01, hint: 'Relative variation in intensity' },
  { type: 'range', key: 'flickerSpeed', label: 'Flicker speed', initial: 1, min: 0, max: 3, step: 0.05, hint: '0 is steady, 1 matches original' },
  { type: 'range', key: 'lightHeight', label: 'Light height (m)', initial: 0.65, min: 0, max: 2, step: 0.01, hint: 'Height above the base of the grate' },
  { type: 'range', key: 'lightX', label: 'Light X offset (m)', initial: 0, min: -1, max: 1, step: 0.01, hint: 'Left or right from the fire center' },
  { type: 'range', key: 'lightZ', label: 'Light Z offset (m)', initial: 0.02, min: -1, max: 1, step: 0.01, hint: 'Front or back from the fire center' },
  { type: 'toggle', key: 'lightShadows', label: 'Fire light casts shadows', initial: true, hint: 'Illuminated objects cast shadows (expensive on standalone VR headsets)' },
])

const C = {
  iron: '#2f3032',
  iron2: '#474747',
  bark: '#33241d',
  wood: '#7b5232',
  wood2: '#946540',
  coalDark: '#413029',
  ash: '#bbb0a6',
  ember1: '#ff5e1e',
  ember2: '#ff8c2f',
  ember3: '#ffd463',
}

let seed = 17
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
function pick(a) {
  return a[Math.floor(rnd() * a.length)]
}

function prim(type, size, position, color, extra = {}) {
  const n = app.create('prim', {
    type,
    size,
    position,
    color,
    castShadow: true,
    receiveShadow: true,
    roughness: 0.84,
    metalness: 0.03,
    physics: null,
    ...extra,
  })
  app.add(n)
  return n
}
function box(size, position, color, extra = {}) {
  return prim('box', size, position, color, extra)
}
function sphere(radius, position, color, extra = {}) {
  return prim('sphere', [radius], position, color, extra)
}
function cyl(r, h, position, color, extra = {}) {
  return prim('cylinder', [r, r, h], position, color, extra)
}

function segment(a, b, w, color, round = true, depth = w, extra = {}) {
  let d = b.map((v, i) => v - a[i])
  const L = Math.hypot(d[0], d[1], d[2])
  d = d.map(v => v / L)
  let q = d[1] < -0.999999 ? [1, 0, 0, 0] : [d[2], 0, -d[0], 1 + d[1]]
  const m = Math.hypot(q[0], q[1], q[2], q[3])
  q = q.map(v => v / m)
  return prim(round ? 'cylinder' : 'box', round ? [w, w, L] : [w, L, depth], a.map((v, i) => (v + b[i]) / 2), color, {
    quaternion: q,
    ...extra,
  })
}
function timber(a, b, r, color) {
  return segment(a, b, r, color, true)
}
function beam(a, b, w, color, d = w) {
  return segment(a, b, w, color, false, d)
}

// Iron grate
beam([-0.56, 0.14, 0.20], [0.56, 0.14, 0.20], 0.05, C.iron, 0.05)
beam([-0.56, 0.34, -0.03], [0.56, 0.34, -0.03], 0.05, C.iron, 0.05)
for (let i = 0; i < 6; i++) {
  const x = -0.42 + i * 0.168
  beam([x, 0.12, 0.15], [x, 0.36, -0.04], 0.035, i % 2 ? C.iron : C.iron2, 0.035)
}
for (const s of [-1, 1]) {
  beam([s * 0.46, 0.02, 0.27], [s * 0.34, 0.14, 0.20], 0.05, C.iron2, 0.05)
  beam([s * 0.46, 0.02, -0.10], [s * 0.34, 0.14, 0.03], 0.05, C.iron2, 0.05)
  cyl(0.028, 0.38, [s * 0.46, 0.14, 0.085], C.iron, { rotation: [Math.PI / 2, 0, 0], roughness: 0.72, metalness: 0.35 })
}
beam([-0.62, 0.03, 0.28], [0.62, 0.03, 0.28], 0.03, C.iron, 0.03)
beam([-0.62, 0.03, -0.12], [0.62, 0.03, -0.12], 0.03, C.iron, 0.03)

// Logs behind and above the grate
for (let x = -0.5; x < 0.62; x += 0.23) {
  timber([x - 0.08, 0.18, -0.18], [x + 0.10, 0.22, 0.18], 0.055, '#37271f')
}
timber([-0.45, 0.28, -0.11], [0.05, 0.38, 0.20], 0.11, C.wood)
timber([0.12, 0.24, -0.12], [0.50, 0.32, 0.16], 0.095, C.wood2)
timber([-0.10, 0.39, -0.06], [0.31, 0.51, 0.09], 0.085, C.wood)
timber([-0.54, 0.43, 0.02], [-0.19, 0.56, -0.07], 0.075, C.wood2)
for (const pos of [[-0.59, 0.44, 0.03], [0.55, 0.32, 0.15], [0.35, 0.51, 0.10]]) {
  sphere(0.05, pos, C.bark, { roughness: 1, metalness: 0 })
}

// Ember bed and ash
for (let i = 0; i < 44; i++) {
  const x = -0.52 + (i % 11) * 0.10 + (i % 2) * 0.008
  const z = -0.18 + ((i * 3) % 7) * 0.055
  const y = 0.04 + (i % 3) * 0.016
  const color = i % 3 === 0 ? C.ember1 : i % 3 === 1 ? C.ember2 : C.ember3
  sphere(0.024 + (i % 4) * 0.004, [x, y, z], color, {
    emissive: color,
    emissiveIntensity: 2.1,
    roughness: 0.9,
    metalness: 0,
  })
}
for (let i = 0; i < 24; i++) {
  const x = -0.56 + (i % 12) * 0.10
  const z = -0.21 + ((i * 5) % 6) * 0.06
  box([0.05, 0.018, 0.04], [x, 0.012, z], C.ash, {
    rotation: [0, (i % 6) * 0.2, (i % 5) * 0.08],
    roughness: 1,
    metalness: 0,
  })
}

// Animated fire inspired by the reference flame structure.
const fireLicks = []
const fireSparks = []
function firePrim(type, size, position, color, extra = {}) {
  const n = app.create('prim', {
    type,
    size,
    position,
    color,
    castShadow: false,
    receiveShadow: false,
    roughness: 0.28,
    metalness: 0,
    physics: null,
    ...extra,
  })
  app.add(n)
  return n
}

for (let i = 0; i < 18; i++) {
  const x = -0.55 + rnd() * 1.10
  const z = -0.20 + rnd() * 0.38
  const r = 0.07 + rnd() * 0.08
  const phase = rnd() * Math.PI * 2
  const speed = 4.2 + rnd() * 3.4
  const outer = firePrim('sphere', [r], [x, 0.52 + rnd() * 0.12, z], '#ff641c', {
    emissive: '#ff4c0c',
    emissiveIntensity: 4.2,
    opacity: 0.78,
    scale: [0.9, 2.2, 0.66],
  })
  const inner = firePrim('sphere', [r * 0.58], [x + (rnd() - 0.5) * 0.04, 0.51 + rnd() * 0.10, z + 0.02], '#ffd66b', {
    emissive: '#ffb128',
    emissiveIntensity: 6.8,
    opacity: 0.88,
    scale: [0.72, 2.1, 0.52],
  })
  fireLicks.push({
    outer,
    inner,
    x,
    z,
    phase,
    speed,
    outerY: 1.9 + rnd() * 0.55,
    innerY: 1.7 + rnd() * 0.42,
    lean: (rnd() - 0.5) * 0.11,
  })
}

const fireLightCore = firePrim('sphere', [0.22], [0, 0.55, 0.0], '#ffd47a', {
  emissive: '#ff821f',
  emissiveIntensity: 5.6,
  opacity: 0.16,
  scale: [2.2, 0.85, 0.90],
})
const fireLightHalo = firePrim('sphere', [0.28], [0, 0.63, 0.02], '#ff9b35', {
  emissive: '#ff6a18',
  emissiveIntensity: 1.2,
  opacity: 0.016,
  scale: [2.55, 1.32, 0.92],
})

// Dynamic illumination, positioned just above the burning logs.
// Emissive flames glow visually; this point light illuminates nearby objects.
const firePointLight = app.create('light', {
  type: 'point',
  position: [props.lightX, props.lightHeight, props.lightZ],
  color: '#ff9846',
  intensity: props.lightIntensity,
  distance: props.lightRange,
  decay: props.lightDecay,
  castShadow: props.lightShadows,
  shadowNear: 0.05,
})
app.add(firePointLight)

for (let i = 0; i < 18; i++) {
  const x = -0.53 + rnd() * 1.06
  const z = -0.18 + rnd() * 0.33
  const r = 0.010 + rnd() * 0.016
  const warm = i % 3 ? '#f08a24' : '#ffd05b'
  const emissive = i % 3 ? '#ff6818' : '#ffc74a'
  const node = firePrim('sphere', [r], [x, 0.42, z], warm, {
    emissive,
    emissiveIntensity: 6.3,
    opacity: 0.88,
  })
  fireSparks.push({ node, x, z, phase: rnd(), speed: 0.22 + rnd() * 0.26, drift: (rnd() - 0.5) * 0.42, wobble: 4 + rnd() * 5 })
}

let fireTime = rnd() * 20
function animateFire(delta) {
  fireTime += (delta || 0.016) * 0.58
  for (const f of fireLicks) {
    const a = fireTime * f.speed + f.phase
    const b = fireTime * (f.speed * 0.61) + f.phase * 1.73
    const flicker = 0.86 + 0.16 * Math.sin(a) + 0.08 * Math.sin(b)
    const sway = Math.sin(a * 0.73) * 0.05 + f.lean
    f.outer.position.x = f.x + sway
    f.outer.position.y = 0.54 + 0.06 * Math.sin(a * 0.91)
    f.outer.position.z = f.z + 0.025 * Math.sin(b)
    f.outer.scale.set(0.82 + 0.13 * Math.sin(b), f.outerY * flicker, 0.58 + 0.08 * Math.cos(a))
    f.outer.emissiveIntensity = 3.7 + 1.2 * (0.5 + 0.5 * Math.sin(a * 1.17))

    f.inner.position.x = f.x + sway * 0.65
    f.inner.position.y = 0.51 + 0.05 * Math.sin(a * 1.11 + 0.8)
    f.inner.position.z = f.z + 0.035
    f.inner.scale.set(0.62 + 0.09 * Math.sin(b + 0.5), f.innerY * (0.9 + 0.14 * Math.sin(a + 0.7)), 0.46 + 0.06 * Math.cos(b))
    f.inner.emissiveIntensity = 6.1 + 1.8 * (0.5 + 0.5 * Math.sin(a * 1.31 + 0.4))
  }
  for (const s of fireSparks) {
    const t = (fireTime * s.speed + s.phase) % 1
    const fade = 1 - t
    s.node.position.x = s.x + s.drift * t + 0.04 * Math.sin(fireTime * s.wobble + s.phase * 12)
    s.node.position.y = 0.42 + t * 1.35
    s.node.position.z = s.z + 0.03 * Math.sin(fireTime * 3.7 + s.phase * 9)
    const q = 0.34 + fade * 0.9
    s.node.scale.set(q, q, q)
    s.node.emissiveIntensity = 3.8 + 4.2 * fade
  }
  const flicker = 0.5 + 0.5 * Math.sin(fireTime * 11.3) + 0.22 * Math.sin(fireTime * 17.7)
  fireLightCore.emissiveIntensity = 4.8 + 0.9 * flicker
  fireLightCore.scale.set(2.12 + 0.16 * flicker, 0.82 + 0.06 * flicker, 0.88 + 0.04 * flicker)
  fireLightHalo.emissiveIntensity = 0.85 + 0.28 * flicker
  fireLightHalo.scale.set(2.45 + 0.18 * flicker, 1.28 + 0.10 * flicker, 0.90 + 0.04 * flicker)
  // Modulate the configurable base intensity; strength 0 means steady light.
  // At default settings this reproduces the original 110 + 30 * flicker.
  const lightFlicker = 0.5 + 0.5 * Math.sin(fireTime * 11.3 * props.flickerSpeed) +
    0.22 * Math.sin(fireTime * 17.7 * props.flickerSpeed)
  firePointLight.intensity = Math.max(0,
    props.lightIntensity * (1 + props.flickerAmount * (lightFlicker - 0.5)))
}

if (world.isClient) app.on('update', animateFire)

// Native positional audio follows the grate and stops automatically on unmount.
if (world.isClient && props.fireSound?.url && props.soundVolume > 0) {
  const fireAudio = app.create('audio', {
    src: props.fireSound.url,
    position: [0, 0.35, 0],
    loop: true,
    group: 'sfx',
    volume: props.soundVolume / 100,
    spatial: true,
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: 12,
    rolloffFactor: 2,
  })
  app.add(fireAudio)
  fireAudio.play()
}

// App-scoped timers are invalidated by Hyperfy when the app is rebuilt or destroyed.
if (world.isClient && props.crackleVolume > 0) {
  const crackles = [props.crackle1, props.crackle2, props.crackle3]
    .filter(sound => sound?.url)
    .map(sound => {
      const audio = app.create('audio', {
        src: sound.url,
        position: [0, 0.35, 0],
        loop: false,
        group: 'sfx',
        volume: props.crackleVolume / 100,
        spatial: true,
        distanceModel: 'inverse',
        refDistance: 1,
        maxDistance: 12,
        rolloffFactor: 2,
      })
      app.add(audio)
      return audio
    })
  if (crackles.length) {
    const minimum = Math.max(1, Math.min(props.crackleMinInterval, props.crackleMaxInterval))
    const maximum = Math.max(minimum, props.crackleMinInterval, props.crackleMaxInterval)
    let previous = -1
    function scheduleCrackle() {
      setTimeout(() => {
        // Choose a different recording each time, with a little natural loudness variation.
        const choices = crackles.map((audio, index) => index).filter(index => index !== previous)
        previous = choices.length ? choices[Math.floor(Math.random() * choices.length)] : 0
        const audio = crackles[previous]
        audio.volume = props.crackleVolume / 100 * (0.75 + Math.random() * 0.25)
        audio.play(true)
        scheduleCrackle()
      }, (minimum + Math.random() * (maximum - minimum)) * 1000)
    }
    scheduleCrackle()
  }
}
