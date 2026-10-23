import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// This world uses the sibling Hyperfy fork; exercise its actual effect and hot-loop paths.
const fork = fileURLToPath(new URL("../../hyperfy/", import.meta.url));
const { build } = createRequire(fork + "package.json")("esbuild");
const bundle = await build({
  stdin: {
    contents: `export { App } from './src/core/entities/App'; export { PlayerLocal } from './src/core/entities/PlayerLocal'; export { createPlayerProxy } from './src/core/extras/createPlayerProxy';`,
    resolveDir: fork,
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { App, PlayerLocal, createPlayerProxy } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);
class FixtureApp extends App {
  build() {}
}
const objects = new URL("../objects/apps/", import.meta.url);
const names = (await readdir(objects)).filter((name) =>
  name.startsWith("cognac-"),
);

function fixture(source, client) {
  const hot = new Set();
  const world = {
    network: { isClient: client, isServer: !client, id: "local", send() {} },
    setHot: (app, active) => (active ? hot.add(app) : hot.delete(app)),
    emit() {},
  };
  const entity = new FixtureApp(world, { id: "seat" }, false);
  entity.script = true;
  const player = {
    world,
    data: { id: "local" },
    applySeatPose() {},
    setEffect(effect, onEnd) {
      PlayerLocal.prototype.setEffect.call(this, effect, onEnd);
    },
  };
  const proxy = createPlayerProxy(entity, player);
  const actions = [];
  const app = {
    configure() {},
    add() {},
    create(type, data) {
      const node = { ...data, anchorId: data.id, active: true, add() {} };
      if (type === "action") actions.push(node);
      return node;
    },
    on: entity.on.bind(entity),
    off: entity.off.bind(entity),
  };
  vm.runInNewContext(source, {
    app,
    world: {
      isClient: client,
      isServer: !client,
      getPlayer: () => (client ? proxy : null),
    },
    props: {},
  });
  return { hot, entity, player, proxy, actions, world };
}

for (const name of names) {
  const source = await readFile(new URL(name + "/script.js", objects), "utf8");
  for (const client of [false, true]) {
    test(`${name}: no frame callbacks while idle on ${client ? "client" : "server"}`, () => {
      const { hot, entity } = fixture(source, client);
      assert.equal(entity.hotEvents, 0);
      assert.equal(hot.size, 0);
      let updates = 0;
      const emit = entity.emit.bind(entity);
      entity.emit = (event, ...args) => {
        if (event === "update") updates++;
        return emit(event, ...args);
      };
      for (let tick = 0; tick < 600; tick++)
        for (const app of hot) app.update(1 / 60);
      assert.equal(updates, 0);
    });
  }
  test(`${name}: all prompts restore on exit and another app replacing the seat effect`, () => {
    const { actions, player, proxy, hot, world } = fixture(source, true);
    actions[0].onTrigger();
    assert.ok(player.data.effect.anchorId);
    assert.ok(actions.every((action) => action.active === false));
    const firstEffect = player.data.effect;
    actions.at(-1).onTrigger();
    assert.equal(player.data.effect, firstEffect);
    player.setEffect(null);
    assert.ok(actions.every((action) => action.active));
    actions.at(-1).onTrigger();
    assert.ok(actions.every((action) => action.active === false));
    const other = createPlayerProxy(
      { data: { id: "other-app" }, world },
      player,
    );
    other.applyEffect({ snare: 0.5 });
    assert.ok(actions.every((action) => action.active));
    assert.equal(proxy.hasEffect(), true);
    assert.equal(player.data.effect.snare, 0.5);
    assert.equal(hot.size, 0);
  });
}
