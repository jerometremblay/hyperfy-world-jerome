# Jerome's Hyperfy World

This repository contains the source-first Git representation of Jerome's local Hyperfy world. `objects/**/object.json` and the per-object source files are authoritative; `scenes/local-world/scene.json` records independent placements. Runtime databases, player records, generated bundles, and credentials do not belong here.

## Bootstrap state

The initial source tree was exported from a read-only SQLite backup of the saved local `world/db.sqlite` snapshot. It contains the 41 saved blueprint definitions and 49 ordinary app placements (the environment singleton is represented separately), plus verified content-addressed assets referenced by blueprints and scripts. User records were not read or copied. World latitude, longitude, time zone, avatar defaults, voice, ranks, and other private settings were excluded.

This is a saved-database bootstrap, not an atomic snapshot from a running Agent API. Review it against the running world before treating it as deployable. The companion `.worldsync/bootstrap-map.json` stores the initial runtime ID mapping locally and is ignored by Git; do not lose it before adopting these keys into the engine's managed-resource map.

The reusable CLI lives in the separate `hyperfy-worldkit` repository. Its implementation is currently a scaffold, so this repository is source data only and is not yet safe to deploy.
