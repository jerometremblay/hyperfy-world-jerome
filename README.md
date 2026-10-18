# Jerome's Hyperfy World

This repository contains the source-first Git representation of Jerome's local Hyperfy world. `objects/**/object.json` and the per-object source files are authoritative; `scenes/local-world/scene.json` records independent placements. Runtime databases, player records, generated bundles, and credentials do not belong here.

## Bootstrap state

The initial source tree was exported from a read-only SQLite backup of the saved local `world/db.sqlite` snapshot. It contains 41 saved blueprint definitions and 49 ordinary app placements (the environment singleton is represented separately), plus verified content-addressed assets referenced by blueprints and scripts. User records were not read or copied. World latitude, longitude, time zone, avatar defaults, voice, ranks, and other private settings were excluded.

This is a saved-database bootstrap, not an atomic snapshot from a running Agent API. Review it against the running world before treating it as deployable. The companion `.worldsync/bootstrap-map.json` stores the initial runtime ID mapping locally and is ignored by Git; keep it until the engine's managed-resource mapping is available.

## Tooling

The offline `worldsync` compiler lives in the Hyperfy fork under `tools/worldsync`. Use it to validate source and build or verify a deterministic `.hworld` bundle. The current snapshot has two external script references, so its bundle requires the explicit `--allow-external` option and is marked nonportable. Live inventory, deployment, capture, and the in-world Git worker are not implemented yet.
