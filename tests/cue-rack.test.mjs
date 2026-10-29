import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const fork = fileURLToPath(new URL('../../hyperfy/', import.meta.url))
const require = createRequire(fork + 'package.json')
const { build } = require('esbuild')
const { Vector3, Quaternion, Matrix4 } = await import(
  require.resolve('three').replace('/build/three.cjs', '/build/three.module.js')
)
const EventEmitter = require('eventemitter3')
const bundle = await build({
  stdin: { contents: `export { App } from './src/core/entities/App'`, resolveDir: fork },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { App } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
)
class FixtureApp extends App {
  build() {}
}
const source = await readFile(new URL('../objects/app-ad9a35e5852a2887/script.js', import.meta.url), 'utf8')

function fixture(client, initial = [null, null, null, null]) {
  const hot = new Set()
  const runtime = { network: { id: 'server' }, setHot: (app, active) => (active ? hot.add(app) : hot.delete(app)) }
  const entity = new FixtureApp(runtime, { id: 'rack' }, false)
  entity.script = true
  const events = new EventEmitter()
  const sent = [],
    nodes = [],
    detached = new Set(),
    controls = []
  const players = new Map()
  for (const id of ['local', 'remote'])
    players.set(id, {
      id,
      networkId: id + '-socket',
      position: new Vector3(1, 0, 0),
      quaternion: new Quaternion(),
      getBoneTransform: () => new Matrix4().makeTranslation(1, 2, 3),
    })
  const world = {
    isClient: client,
    isServer: !client,
    on: events.on.bind(events),
    getPlayer: id => players.get(id ?? (client ? 'local' : undefined)),
    getPlayers: () => [...players.values()],
    add: node => detached.add(node),
    remove: node => detached.delete(node),
  }
  const app = {
    state: { holders: initial.slice() },
    instanceId: 'rack',
    position: new Vector3(),
    create(type, data = {}) {
      const node = {
        type,
        ...data,
        position: new Vector3().fromArray(data.position || [0, 0, 0]),
        quaternion: new Quaternion(),
        add() {},
      }
      nodes.push(node)
      return node
    },
    add() {},
    remove() {},
    on: entity.on.bind(entity),
    off: entity.off.bind(entity),
    emit: events.emit.bind(events),
    send: (...args) => sent.push(args),
    control() {
      const control = {
        keyX: {},
        xrLeftBtn1: {},
        actions: [],
        releases: 0,
        setActions(actions) {
          this.actions = actions
        },
        release() {
          this.releases++
        },
      }
      controls.push(control)
      return control
    },
  }
  vm.runInNewContext(source, { app, world, props: {}, Vector3, Quaternion })
  return { entity, hot, app, events, sent, nodes, players, controls, detached }
}

test('server rack has no frame work even while a cue is held; leave returns it immediately', () => {
  const { entity, hot, app, events, sent, players } = fixture(false)
  assert.equal(hot.size, 0)
  entity.emit('take-cue', { slot: 0 }, 'local-socket')
  assert.deepEqual(Array.from(app.state.holders), ['local', null, null, null])
  assert.equal(hot.size, 0)
  events.emit('leave', { playerId: 'local' }) // Native leave fires before the entity is removed.
  assert.ok(players.has('local'))
  assert.deepEqual(Array.from(app.state.holders), [null, null, null, null])
  assert.deepEqual(Array.from(sent.at(-1)[1]), [null, null, null, null])
})

test('server return authorization and startup cleanup remain intact', () => {
  const { entity, app, hot } = fixture(false, ['missing', 'local', null, null])
  assert.deepEqual(Array.from(app.state.holders), [null, 'local', null, null])
  entity.emit('drop-cue', { slot: 1 }, 'remote-socket')
  assert.equal(app.state.holders[1], 'local')
  entity.emit('drop-cue', { slot: 1 }, 'local-socket')
  assert.equal(app.state.holders[1], null)
  assert.equal(hot.size, 0)
})

test('client attaches cues after avatar animation, follows hands and aim poses, then returns every cue', () => {
  const { entity, hot, nodes, controls, detached, events, sent } = fixture(true)
  assert.equal(hot.size, 0)
  entity.emit('cue-holders', ['local', 'remote', null, null])
  assert.equal(entity.hotEvents, 1)
  assert.equal(detached.size, 2)
  const held = [...detached]
  entity.update(1 / 60)
  assert.equal(held[0].position.y, -0.236, 'attachment waits for the completed avatar frame')
  entity.lateUpdate(1 / 60)
  assert.notEqual(held[0].position.y, -0.236)
  events.emit(events.eventNames().find(name => name.startsWith('billard:cue-pose')), {
    playerId: 'remote',
    tableId: 'table',
    position: [3, 4, 5],
    quaternion: [0, 0, 0, 1],
  })
  entity.lateUpdate(1 / 60)
  assert.deepEqual(held[1].position.toArray(), [3, 4, 5])
  entity.emit('cue-holders', ['local', 'remote', null, null])
  assert.equal(entity.hotEvents, 1)
  assert.equal(controls.length, 1)
  controls[0].keyX.onPress()
  assert.equal(sent.at(-1)[0], 'drop-cue')
  assert.equal(sent.at(-1)[1].slot, 0)
  entity.emit('cue-holders', [null, 'remote', null, null])
  assert.equal(hot.size, 1)
  assert.equal(controls[0].releases, 1)
  entity.emit('cue-holders', [null, null, null, null])
  assert.equal(hot.size, 0)
  assert.equal(entity.hotEvents, 0)
  assert.equal(detached.size, 0)
  assert.deepEqual(held[0].position.toArray(), [-0.186, -0.236, 0.17])
  assert.deepEqual(held[1].position.toArray(), [-0.062, -0.236, 0.17])
  assert.ok(nodes.filter(node => node.type === 'action').every(action => action.distance === 2.8))
})

test('client with an initial holder starts updates and stops them on destruction', () => {
  const { entity, hot, detached, controls } = fixture(true, ['local', null, null, null])
  assert.equal(hot.size, 1)
  assert.equal(detached.size, 1)
  entity.emit('destroy')
  assert.equal(hot.size, 0)
  assert.equal(detached.size, 0)
  assert.equal(controls[0].releases, 1)
})
