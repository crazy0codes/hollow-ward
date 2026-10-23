# Hollow Ward

A browser-based, first-person 3D horror game set in an abandoned hospital. Find three ward keys, manage your flashlight, avoid the stalker and unlock the north exit.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the local URL Vite prints (normally `http://localhost:5173`). `npm run dev` attempts to download the two licensed GLB models into `public/assets/` before the server starts. `npm run build` does the same before production compilation. Asset fetch failures are reported as warnings and the game has a fallback for a missing stalker model.

Useful commands:

```bash
npm run check
npm run build
npm run preview
```

## Controls

| Input | Action |
|---|---|
| `W A S D` | Walk |
| Mouse | Look around (click Start to lock the pointer) |
| `Shift` | Sprint; easier for the stalker to notice |
| `F` | Toggle flashlight |
| `E` | Pick up key, read the note, or use the exit |
| `Esc` | Pause and release pointer lock |

## Objective

Collect the **West Ward**, **Surgery**, and **Morgue** keys. The central nurse's note is optional but provides a warning. With all three keys, return to the north exit and press `E` to release the lock. Cross the threshold to escape. Contact with the Stalker ends the run. Restart is available after a win or loss.

The flashlight begins at 100%. It drains only when switched on, flickers at low charge, and stops at 0%. Turning it off saves charge but leaves most of the ward in darkness.

## Architecture

- **Three.js** — WebGL scene, first-person controls, lights/fog, GLTF loading and audio listener.
- **Rapier** — kinematic player controller and static collision geometry.
- **Yuka** — A* routing over the authored walkable-cell graph.
- **postprocessing** — low-intensity bloom, noise and vignette.
- **Vite** — dev server and production bundling.

The game is one scene with low draw-call count, no real-time shadow maps, seven local lamps, fog and a pixel-ratio cap. Enemy decision logic, level layout, keys, story and exit rules are game-specific code.

## Asset downloads and licences

See [`CREDITS.md`](./CREDITS.md) for full provenance. `scripts/fetch-assets.mjs` fetches a pinned CC0 animated stalker model from Three.js and a CC0 hospital corridor floor tile from 3DAssets.dev. The game-specific hospital furniture/environment still contains meshes assembled from Three.js primitives. Audio is synthesized in-browser; there is no external audio file in this revision.

## Validation status — read before treating this as shipped

This source was generated in a runtime where terminal DNS/network access was unavailable and npm modules were not preinstalled. JavaScript syntax checks pass, but dependency installation, the production build, local model download, Chromium/WebGL playtest, console-error check, and full win/lose/restart test could not be completed in this session. Do not treat the game as release-tested until you complete the steps in [`GAME_VALIDATION.md`](./GAME_VALIDATION.md) on a connected machine.

## Files

- `GAME_SCRIPT.md` — narrative, mechanics, pacing, libraries and build milestones.
- `GAME_VALIDATION.md` — validator's findings and honest test report.
- `CREDITS.md` — asset source URLs and licences.
