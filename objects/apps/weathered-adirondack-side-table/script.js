// Small weathered Adirondack side table, matched to the chair.
app.resetOnMove = false

const WOOD = ['#6b5239', '#765b3f', '#806447', '#5f4934', '#70563c']
const DARK = '#49382a'
const groundY = -0.5

// Keep colliders in the app hierarchy so only actual app movement updates them.
function attachCollider(node, type, size) {
  const collider = app.create('prim', {
    type,
    size,
    position: node.position.toArray(),
    quaternion: node.quaternion.toArray(),
    scale: node.scale.toArray(),
    opacity: 0,
    castShadow: false,
    receiveShadow: false,
    physics: 'static',
    staticFriction: 0.72,
    dynamicFriction: 0.62,
  })
  app.add(collider)
}

function addBox(size, position, color, rotation = [0, 0, 0], collidable = false, extra = {}) {
  const node = app.create('prim', {
    type: 'box',
    size,
    position,
    rotation,
    color,
    roughness: 0.95,
    metalness: 0,
    castShadow: true,
    receiveShadow: true,
    physics: null,
    ...extra,
  })
  app.add(node)
  if (collidable) attachCollider(node, 'box', size)
  return node
}

// Four-plank top, about 70 cm square and 55 cm high.
const topY = groundY + 0.55
const topXs = [-0.255, -0.085, 0.085, 0.255]
for (let i = 0; i < topXs.length; i++) {
  addBox([0.155, 0.055, 0.70], [topXs[i], topY - 0.0275, 0], WOOD[i], [0, 0, 0], true)
}

// Legs splay very slightly outward for an Adirondack look.
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    const x = sx * 0.26
    const z = sz * 0.26
    addBox([0.085, 0.49, 0.085], [x, groundY + 0.245, z], WOOD[(sx + sz + 4) % WOOD.length], [sz * 0.035, 0, -sx * 0.035], true)
  }
}

// Aprons below the top and a low shelf-like brace.
addBox([0.56, 0.085, 0.06], [0, groundY + 0.47, -0.285], DARK, [0, 0, 0], true)
addBox([0.56, 0.085, 0.06], [0, groundY + 0.47, 0.285], DARK, [0, 0, 0], true)
addBox([0.06, 0.085, 0.56], [-0.285, groundY + 0.47, 0], DARK, [0, 0, 0], true)
addBox([0.06, 0.085, 0.56], [0.285, groundY + 0.47, 0], DARK, [0, 0, 0], true)

addBox([0.48, 0.04, 0.11], [0, groundY + 0.18, 0], WOOD[3])
addBox([0.11, 0.04, 0.48], [0, groundY + 0.18, 0], WOOD[4])

// Faint worn bands across the top surface.
for (let i = 0; i < 3; i++) {
  addBox([0.60, 0.006, 0.018], [0, groundY + 0.553, -0.20 + i * 0.20], '#4f3d2e', [0, 0, 0], false, { opacity: 0.22 })
}
