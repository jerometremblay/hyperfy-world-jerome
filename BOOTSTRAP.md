# Local world bootstrap

- Source: a read-only SQLite backup of the saved local `world/db.sqlite` plus content-addressed files under `world/assets/`.
- Blueprint definitions: 41.
- Ordinary app placements in the scene: 49.
- Saved app entities including the separate environment singleton: 50.
- Verified unique content-addressed assets: 66.
- Total referenced asset payload bytes: 4843641.
- External URLs detected in blueprint/script content: 5 (not fetched; review portability).
- Database integrity check: passed before export.
- Source DB, user table, runtime storage file, credentials, and local backup are not included.

The generated logical keys are initial review suggestions. Runtime UUIDs remain in the ignored `.worldsync/bootstrap-map.json`, not in scene source. Confirm object and instance keys, settings, and source fidelity before committing this snapshot. Compare against a coherent running-world snapshot before any deployment; the saved SQLite database may lag in-memory changes.
