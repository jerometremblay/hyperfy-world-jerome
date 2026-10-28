# Agent Instructions

## Live world sync

Whenever this repository's world source, scene, or assets are changed, sync the resulting world to the live Hyperfy server at `monstre.duckdns.org:3333` and verify that the sync completed before reporting the update complete. A Git commit or push is not a live sync. Use the supported world sync or deployment workflow; do not invent one. The current `README.md` says live deployment is not implemented. If no supported sync path is available, report live sync as blocked, identify the missing capability, and do not claim the online world was updated.

## Object performance

Static objects must not poll or recopy their collider transforms every frame. Parent static colliders to the app with `app.add`, as for visible geometry, and let native transforms propagate actual movement. Use detached world nodes only when independent world-space behavior is required; update them only when their transform changes.

Run visual animation only on clients. Prefer in-place animation properties such as primitive emissive intensity and light intensity. Changing a primitive's opacity, geometry, roughness, metalness or physics rebuilds it; do not animate these every frame. Do not register update callbacks for objects with no ongoing work. Preserve real gameplay and animation when optimizing. Verify idle callback counts, collision ownership and profiler measurements after deployment.

For static interactions, use action/effect/trigger callbacks rather than frame polling. An unconditional `app.on('update', ...)` keeps the app in the active engine loop even when its body immediately returns; a client guard inside the callback does not remove server dispatch. Seat prompts must restore through `applyEffect({ onEnd })`, with no idle client or server frame callbacks. Verify cancellation and effect replacement against the current fork and compare fresh server profiler samples after deployment.
