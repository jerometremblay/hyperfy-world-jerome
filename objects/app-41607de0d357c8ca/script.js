// Hyperfy four-circuit wall switches: +Y up, +X right, -Z forward; metres.
// Existing root is retained by prompt-box replacement. The plate assembly is
// rotated -5 degrees relative to the root to sit flush on the house's front wall.
// Circuit hints are the circuit names; every switch has an independent action.
app.configure([
  { type: 'text', key: 'channel', label: 'Billiards channel', initial: 'billiards-main', hint: 'Must match the pool-light fixture' },
  { type: 'toggle', key: 'initialOn', label: 'Initially on', initial: true },
  { type: 'color', key: 'plateColor', label: 'Wallplate metal', initial: '#c7bca1' },
])
const poolChannel = String(props.channel || 'billiards-main').trim()
const onAtStart = props.initialOn !== false
const metal = props.plateColor || '#c7bca1'
const dark = '#393936'
const circuits = [
  { key: poolChannel, label: 'Billiards lights', isPool: true },
  { key: 'house-exterior', label: 'Exterior lights' },
  { key: 'house-interior-lower', label: 'Downstairs lights' },
  { key: 'house-interior-upper', label: 'Upstairs lights' },
]
// Original wall switch is at house-local X=5.3416, Z=-7.33; its 5-degree
// yaw error is removed here. Assembly center = house-local X~5.14, Z=-7.33.
// At Y=1.71, the backings touch the INSIDE of the front log wall, with every
// plate between the frame post at X=4.6 and the window starting at X=5.925.
const assembly = app.create('group', {
  position: [-0.20085, 0, -0.01757],
  rotation: [0, -5 * Math.PI / 180, 0],
})
app.add(assembly)
function shape(type, size, position, color, extra = {}) {
  const n = app.create('prim', {
    type, size, position, color, physics: null, castShadow: true, receiveShadow: true,
    metalness: 0.6, roughness: 0.3, ...extra,
  })
  assembly.add(n)
  return n
}
function plateBox(size, pos, color, extra = {}) { return shape('box', size, pos, color, extra) }
function ledOrb(radius, pos, color, extra = {}) { return shape('sphere', [radius], pos, color, extra) }

let switchState = {}
const stored = app.state || {}
for (const circuit of circuits) {
  switchState[circuit.key] = circuit.isPool
    ? (typeof stored.on === 'boolean' ? stored.on : onAtStart)
    : (typeof stored.circuits?.[circuit.key] === 'boolean' ? stored.circuits[circuit.key] : onAtStart)
}
const controls = {}
const debounce = {}
function setSwitch(channel, on) {
  if (!controls[channel]) return
  const { led, lever } = controls[channel]
  switchState[channel] = !!on
  led.color = on ? '#a6ffc0' : '#3a513f'
  led.emissiveIntensity = on ? 3.5 : 0
  lever.rotation.x = on ? -0.19 : 0.19
}
function toggle(circuit) {
  if (!world.isClient) return
  const now = Date.now()
  if (now - (debounce[circuit.key] || 0) < 250) return
  debounce[circuit.key] = now
  if (circuit.isPool) app.send('billiards-wall-switch-toggle', {})
  else app.send('larch-house-wall-switch-toggle', { channel: circuit.key })
}

// Four individual 165mm brushed-metal plates, matched to the existing switch.
// 215mm pitch gives enough space for the actions and avoids the nearby window.
for (let i = 0; i < circuits.length; i++) {
  const circuit = circuits[i]
  const x = (i - 1.5) * 0.215
  plateBox([0.165, 0.280, 0.025], [x, 0, 0.017], dark, { metalness: 0.4, roughness: 0.45 })
  const face = plateBox([0.150, 0.265, 0.012], [x, 0, 0.034], metal, { metalness: 0.72, roughness: 0.23 })
  for (const dx of [-0.057, 0.057]) for (const y of [-0.116, 0.116]) {
    shape('cylinder', [0.007, 0.007, 0.004], [x + dx, y, 0.043], '#554d42', {
      rotation: [Math.PI / 2, 0, 0], metalness: 0.72, roughness: 0.32,
    })
  }
  plateBox([0.079, 0.125, 0.018], [x, 0.008, 0.048], dark, { metalness: 0.25, roughness: 0.42 })
  const lever = plateBox([0.050, 0.095, 0.034], [x, 0.007, 0.075], metal, {
    metalness: 0.72, roughness: 0.25,
  })
  const led = ledOrb(0.014, [x, -0.084, 0.051], '#b2ffac', {
    emissive: '#79ff79', emissiveIntensity: 3.5, metalness: 0, roughness: 0.45, castShadow: false,
  })
  // The action's hint is *only* the circuit name (not a generic 'Toggle').
  const action = app.create('action', {
    position: [x, 0, 0.11],
    label: circuit.label,
    distance: 2.5,
    duration: 0.12,
    onTrigger: () => toggle(circuit),
  })
  assembly.add(action)
  face.onPointerDown = () => toggle(circuit)
  lever.onPointerDown = () => toggle(circuit)
  controls[circuit.key] = { led, lever }
  setSwitch(circuit.key, switchState[circuit.key])
}

if (world.isServer) {
  // Preserve the old billiards on/off state, while persisting the three new
  // circuits as independent booleans for server restarts and late joiners.
  const prior = app.state || {}
  const saved = {}
  for (const c of circuits) if (!c.isPool) saved[c.key] = switchState[c.key]
  app.state = { ...prior, on: switchState[poolChannel], circuits: saved }

  function poolReport() {
    app.emit('billiards-light-command', { channel: poolChannel, on: app.state.on })
    app.send('billiards-wall-switch-state', { on: app.state.on })
  }
  function houseReport() {
    for (const c of circuits) if (!c.isPool) {
      app.emit('larch-house-light-command', { channel: c.key, on: app.state.circuits[c.key] })
    }
    app.send('larch-house-switch-state', { circuits: app.state.circuits })
  }
  app.on('billiards-wall-switch-toggle', () => {
    const on = !app.state.on
    app.state = { ...app.state, on }
    poolReport()
  })
  app.on('larch-house-wall-switch-toggle', message => {
    const channel = message?.channel
    if (!circuits.some(c => !c.isPool && c.key === channel)) return
    const on = !app.state.circuits[channel]
    app.state = { ...app.state, circuits: { ...app.state.circuits, [channel]: on } }
    app.emit('larch-house-light-command', { channel, on })
    app.send('larch-house-switch-state', { circuits: app.state.circuits })
  })
  app.on('billiards-wall-switch-query', poolReport)
  app.on('larch-house-wall-switch-query', () => { poolReport(); houseReport() })
  world.on('billiards-light-request', message => {
    if (message && String(message.channel || '').trim() === poolChannel) poolReport()
  })
  // The house requests these values at startup, regardless of which app starts first.
  world.on('larch-house-light-request', houseReport)
  poolReport()
  houseReport()
}
if (world.isClient) {
  app.on('billiards-wall-switch-state', message => {
    if (typeof message?.on === 'boolean') setSwitch(poolChannel, message.on)
  })
  app.on('larch-house-switch-state', message => {
    for (const c of circuits) if (!c.isPool && typeof message?.circuits?.[c.key] === 'boolean') {
      setSwitch(c.key, message.circuits[c.key])
    }
  })
  app.send('larch-house-wall-switch-query', {})
}
