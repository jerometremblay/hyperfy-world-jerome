import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const fork = fileURLToPath(new URL('../../hyperfy/', import.meta.url))
const require = createRequire(fork + 'package.json')
const { build } = require('esbuild')
const EventEmitter = require('eventemitter3')
const bundle = await build({
  stdin: {
    contents: `export { App } from './src/core/entities/App'; export { Node } from './src/core/nodes/Node'; export { Settings } from './src/core/systems/Settings';`,
    resolveDir: fork,
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { App, Node, Settings } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)
const source = await readFile(new URL('../objects/apps/polar-gnomon-solar-clock/script.js', import.meta.url), 'utf8')
class FixtureApp extends App {
  build() {}
}

function fixture(client) {
  const world = { events: new EventEmitter(), stage: { dirtyNodes: new Set() }, hot: new Set() }
  world.setHot = (app, active) => (active ? world.hot.add(app) : world.hot.delete(app))
  world.settings = new Settings(world)
  const entity = new FixtureApp(world, { id: 'clock' }, false)
  entity.root.activate({ world, entity })
  let creates = 0
  const app = {
    configure() {},
    get quaternion() {
      return entity.root.quaternion
    },
    create(_type, data) {
      creates++
      return new Node(data)
    },
    add: node => entity.root.add(node),
    on: entity.on.bind(entity),
    off: entity.off.bind(entity),
  }
  vm.runInNewContext(source, {
    app,
    props: {},
    world: {
      isClient: client,
      isServer: !client,
      getLocation: () => ({ latitude: world.settings.latitude, longitude: world.settings.longitude }),
      on: entity.onWorldEvent.bind(entity),
      off: entity.offWorldEvent.bind(entity),
    },
  })
  const flush = () => {
    for (const node of world.stage.dirtyNodes) node.clean()
    world.stage.dirtyNodes.clear()
  }
  flush()
  return { world, entity, north: entity.root.children[0], flush, creates: () => creates }
}

for (const client of [false, true]) {
  test(`solar clock has no idle callbacks on ${client ? 'client' : 'server'} and stays north during rotation`, () => {
    const { world, entity, north, flush, creates } = fixture(client)
    assert.equal(entity.hotEvents, 0)
    assert.equal(world.hot.size, 0)
    const count = creates()
    entity.root.quaternion.set(0, Math.sin(0.6), 0, Math.cos(0.6))
    flush()
    assert.ok(Math.abs(north.matrixWorld.elements[0] - 1) < 1e-10)
    assert.ok(Math.abs(north.matrixWorld.elements[8]) < 1e-10)
    assert.equal(creates(), count)
    entity.root.position.set(2, 3, 4)
    flush()
    assert.deepEqual(north.matrixWorld.elements.slice(12, 15), [2, 3, 4])
    assert.equal(creates(), count)
    assert.equal(world.hot.size, 0)
  })
}

test('latitude events rebuild the calibrated geometry once; longitude and repeated coordinates do not', () => {
  const { world, entity, north, flush, creates } = fixture(true)
  const count = creates()
  const dial = north.children.at(-1)
  world.settings.set('longitude', world.settings.longitude + 1)
  world.settings.preFixedUpdate()
  flush()
  assert.equal(creates(), count)
  world.settings.set('latitude', -world.settings.latitude)
  world.settings.preFixedUpdate()
  flush()
  assert.ok(creates() > count)
  assert.notEqual(north.children.at(-1), dial)
  assert.equal(dial.mounted, false)
  const calibratedCount = creates()
  world.settings.set('latitude', world.settings.latitude)
  world.settings.preFixedUpdate()
  assert.equal(creates(), calibratedCount)
  assert.equal(entity.hotEvents, 0)
  entity.clearEventListeners()
  assert.equal(world.events.listenerCount('location'), 0)
})
