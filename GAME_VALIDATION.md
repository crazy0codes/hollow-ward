# Validator Report — Hollow Ward

Role: senior 3D-game release review. Scope: feasibility, external asset provenance, dependency choice, performance, and loop completeness. This is a code/doc review, not a claim of a tested release.

## Round 1 — Findings

1. **Scope risk: 3D gameplay systems could swallow the schedule.** A home-built engine, full navmesh generation, dynamic shadows, or networked assets would be unnecessary for a single-floor, low-poly game.
2. **Rendering risk: draw-call inflation.** Individual floor/ceiling cells can multiply draw calls, and scanning the entire scene for line-of-sight every frame scales poorly.
3. **Movement risk: input direction and collision integration need review.** A kinematic controller must apply the computed translation, not teleport through walls.
4. **Asset risk: model downloads and licences were not yet verified by a local file inspection.** A URL alone is not evidence that bytes arrived or load. The first connectivity pass also exposed that the second key and stalker spawn were positioned on a wall cell.
5. **Loop gaps to inspect:** pause/unlock, key reset, exit collider removal/recreation, flashlight depletion, and restarting after win/lose.
6. **Audio scope:** finding/copying multiple samples would expand the asset dependency surface; a short synthesized sound layer is an acceptable development fallback but deviates from the preference for internet assets.

## Changes made after review

- Kept the game to one cell-based floor plan and one hunter; avoided a custom engine and a runtime navmesh bake.
- Used Three.js `PointerLockControls`, `GLTFLoader`, `AudioListener`, and the official `BufferGeometryUtils.mergeGeometries` addon; used Rapier's character-controller API and Yuka BFS over a small authored grid.
- Batched floor and ceiling geometry; disabled real-time shadow maps; capped device pixel ratio at 1.5; used seven restrained point lights with local flicker rather than many shadowed lights.
- Cached structural wall meshes for line-of-sight tests rather than traversing the full scene on every frame.
- Fixed the horizontal right-vector sign so `D` moves right. Corrected the east-ward map cell so the second key and stalker spawn are on walkable floor.
- Added `scripts/fetch-assets.mjs`, which downloads the two CC0 GLBs on first `npm run dev` / `npm run build`, validates binary glTF headers and sizes, and checks the pinned stalker-model hash. Missing assets are handled with a model fallback instead of stopping startup.
- The gameplay loop includes key reset, flashlight reset, exit collider re-creation, pointer-lock pause, restart, win and loss UI states in source.

## Round 2 — Final audit

### Feasibility

The designed scope is reasonable for a small browser horror game. Dependencies cover rendering, movement/collision, path search, model loading, audio foundation and postprocessing. The game-specific code remains mostly level and rule logic.

### Asset audit

- **Source verified online:** RobotExpressive model/readme; its upstream README says CC0 1.0 Universal. The download script pins an upstream commit and a SHA-256.
- **Source verified online:** 3DAssets.dev corridor tile page gives the direct GLB URL and CC0 1.0 Universal licence.
- **RobotExpressive GLB:** successfully fetched on the GitHub Actions runner (453.1 KiB) and passed the download script's binary-header, size and pinned SHA-256 checks. It is not committed to the repository; first-run setup fetches it again.
- **Corridor tile GLB:** the configured URL failed during the hosted CI build. It remains optional, and the game continues without it. The URL needs replacing or repairing before counting it as a delivered asset.
- **Authored geometry remains:** hospital walls, floor base, bed/trolley shapes, key meshes, door and stains are assembled as low-poly Three.js primitives for the game-specific layout. These are not fake “placeholder boxes” standing in for failed GLB loads, but they do not meet the strictest reading of “assets come from the internet.” This is a remaining limitation of the current build.
- **Audio:** generated short tones/drone through browser Web Audio; no licensed audio file is bundled. Another explicit deviation from the original request.

### Performance assessment

Expected to be modest for a normal laptop: roughly one merged floor mesh, one merged ceiling mesh, no real-time shadow maps, low geometry counts, a capped pixel ratio, and a handful of small-range point lights. This is an architectural estimate; no FPS profile was possible here.

### Verification status

- `npm run check`: passed. This includes syntax checks for the game and both scripts, plus an automated map BFS that verifies all walkable cells, player spawn, three key locations and north exit are connected. It reports 66 walkable cells in an 11×11 layout.
- Original isolated workspace attempts: asset fetches and `npm install` failed because its terminal DNS was unavailable; that environment had no preinstalled Vite, so its local build attempt could not run.
- Hosted GitHub Actions verification: `npm install`, `npm run check`, and `npm run build` all passed on Node.js 22. The stalker GLB was fetched and hash-verified; the corridor tile URL failed but is optional.
- No browser/WebGL playtest was run. Passing a production build does not prove the full gameplay loop or a clean browser console.
- Chromium gameplay, WebGL, pointer-lock, Rapier runtime, A* runtime and complete win/lose/restart: **not tested**.
- No claim of “zero console errors” or tested 10–15 minute balance is made. The successful automated workflow is available at https://github.com/crazy0codes/hollow-ward/actions/runs/39910209099.

## Release verdict

**Prototype source is assembled; release validation is incomplete.** On a connected machine, run `npm install`, then `npm run check`, `npm run build`, and `npm run dev`. Test first-run asset downloads, both D/W movement directions, wall collision, key pickup, line-of-sight chase, flashlight at 0%, exit unlock, pause/resume, win, lose and restart before describing this as shipped/complete.
