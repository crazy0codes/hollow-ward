# Hollow Ward — Game Script and Build Plan

## One-line pitch

You wake in St. Agnes Hospital after the emergency lights have failed. Three ward keys are scattered across connected wards. Something that used to be a patient is moving through the building. The north exit is the only way out.

## Player-facing story

The game starts beside a damaged patient chart. The nurse's note at the central desk says: “If you hear it running, stay quiet. If the lights turn red, do not look behind you.” The player learns through level dressing, key tags and the stalker's behavior that the ward was sealed from the outside during an unexplained night-shift incident. The game does not stop for long cutscenes; details are discovered while the player is vulnerable.

### Story beats

1. **Wake-up / orientation (0:00–1:00):** The player gains control in the recovery wing. A distant impact and unstable lights establish the hospital's scale. The north exit is visible early but cannot open.
2. **First search (1:00–4:00):** The western and eastern wards teach the key interaction. A note at the central nurse station is optional. The stalker initially patrols rather than sprinting directly at the player.
3. **Pressure rise (4:00–8:00):** Looking toward the stalker or approaching too closely can trigger a chase. Sprinting makes more noise and drains player control options, so hiding behind corners and breaking line of sight are useful.
4. **Resource squeeze (8:00–12:00):** The last key and the lowest battery force a route choice. The light flickers near depletion; turning the flashlight off preserves remaining charge but makes exploration harder.
5. **Exit sprint (final minute):** With all keys collected, the player must interact with the north door, then cross its threshold before the stalker closes in.

Expected playtime is about 10–15 minutes for cautious exploration. This has not been established by a playtest in this environment; a speed-run or early death will be shorter.

## Scene / level plan

One 3D scene: **St. Agnes — Recovery Wing**. It is built around one walkable-cell layout, with connected west ward, central desk/corridor, surgery ward, and lower recovery/morgue rooms. The north edge contains the locked exit. Curtains, beds, trolleys, a damaged terminal, floor stains, sparse ceiling lamps and fog provide silhouettes and orientation.

- Player spawn: south end of the recovery wing.
- West Ward Key: western side room.
- Surgery Key: eastern side room.
- Morgue Key: lower west side room.
- Optional clue: nurse's note at the central desk.
- Exit: north end, centered on the main corridor.
- Enemy start: eastern ward; it does not spawn directly in front of the player.

## Player mechanics

- First-person camera; mouse look uses pointer lock.
- `W/A/S/D`: walk. `Shift`: sprint. `F`: toggle flashlight. `E`: interact. `Esc`: pause/unlock mouse.
- Rapier's kinematic character controller resolves player movement against static wall/floor colliders. There is no jump mechanic because it adds little to this single-floor layout.
- The flashlight begins at 100% and consumes about 0.105 percentage points per second while switched on (roughly 16 minutes of continuous use). It becomes unstable below 16% and shuts off at 0%.
- Keys are found through a central-screen interaction ray and a small proximity fallback for dark rooms.
- The north exit cannot be opened until all three keys are collected. Interact again to unlock it; walk through the doorway to win.

## Enemy: The Stalker

One persistent hunter uses four gameplay states:

- **Lurk:** patrol between authored walkable cells; approach pressure rises as it gets closer.
- **Chase:** starts if it has a clear line of sight and is within its sensing range; sprinting extends the range. It replans its route periodically.
- **Search:** after losing line of sight, move toward the last-known player location and search briefly.
- **Reset to Lurk:** return to patrol after the search expires or the last-known location is reached.

The state machine and target-selection are game-specific code. Yuka provides the grid graph/A* path search. Walls block the visual ray. Running is intentionally not a safe default: it travels faster but gives the stalker an easier cue. A close stalker can be slowed briefly by facing it with the working flashlight; light does not kill it. Contact ends the run. Staying around corners and breaking line of sight is the escape tactic.

## Scare and pacing plan

- **Quiet:** low mechanical drone, distant room tone, stable dark spaces, no immediate threat at spawn.
- **Tension:** uneven fluorescent flicker, distant footsteps, progressively stronger edge vignette and heartbeat as the stalker approaches.
- **Payoff:** spotting the stalker's silhouette in the beam; chase cue and brighter threat indicator; key pickup and door sounds.
- **Aftermath:** the escape screen is brief and quiet. Failure uses a hard cut to the incident-report screen rather than repeatedly stacking jump scares.

Audio currently uses Three.js's `AudioListener` and browser Web Audio for a synthesized drone, steps, pickup cue, heartbeat, and short stings. No standalone audio asset is shipped because binary audio downloads were not reachable during this build session. This is a documented deviation from the original asset-download brief, not a claim that downloaded audio exists.

## Win / lose / restart

- **Win:** collect all keys, interact with the north exit, cross the threshold.
- **Lose:** touch the stalker.
- **Pause:** `Esc` releases pointer lock and pauses the simulation.
- **Restart:** use Restart / Play Again on the appropriate overlay; keys, battery, state machine, player spawn and door lock reset.

## Chosen libraries and their jobs

| Concern | Library | Intended use |
|---|---|---|
| Browser build/dev server | Vite | Local development and production build |
| 3D rendering / scene / lights / model loading | Three.js | Renderer, GLTFLoader, PointerLockControls, fog, spotlight and built-in audio listener |
| Collision and player movement | `@dimforge/rapier3d-compat` | Static world colliders and kinematic character controller |
| Enemy navigation | Yuka | `Graph`, `Node`, `Edge`, A* pathfinding |
| Grain / vignette / restrained bloom | `postprocessing` | Effect composer; no real-time shadow maps |
| Audio lifecycle/spatial audio base | Three.js `AudioListener` + browser Web Audio | Low-cost ambient layer and local effect tones |

Custom code is restricted to the hospital layout, clue/key/exit rules, stalker senses/state transitions, UI, and game pacing. Environment set dressing that is not an imported model is currently low-poly geometry authored for this specific layout; see the validation report for the asset limitation.

## Asset plan and verified source URLs

All downloads are optional-at-startup and written to `public/assets/` by `scripts/fetch-assets.mjs`. The script checks the GLB magic bytes and size; the stalker rig also has a pinned upstream SHA-256. It reports a clear warning and keeps the fallback if a download is unavailable.

1. **Animated stalker source model — RobotExpressive.glb**
   - Direct model: `https://raw.githubusercontent.com/mrdoob/three.js/eba30de865cfbf31ac736f792defd9a60ff28d57/examples/models/gltf/RobotExpressive/RobotExpressive.glb`
   - Source/readme: `https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/RobotExpressive/README.md`
   - Licence: CC0 1.0 Universal. The upstream README identifies the model author and CC0 status.
2. **Hospital corridor floor tile**
   - Direct model: `https://cdn.3dassets.dev/assets/23660/v1/model.glb`
   - Asset page: `https://3dassets.dev/assets/hospital-wards-and-clinic-operations-corridor-floor-ti-6eaa09ac`
   - Licence: CC0 1.0 Universal, according to the source asset page; plain GLB, no extra decoder.
3. **Audio:** no external binary in this build; generated through Three.js AudioListener/Web Audio at runtime.

The two source pages and licence statements were inspected online. The current terminal cannot resolve external hosts, so neither GLB could be fetched and inspected locally during this run. The first-run script is provided to perform those actual downloads on a connected machine. No unlicensed or paywalled asset is included.

## Build milestones

1. Renderer, pointer-lock controls, hospital layout and camera.
2. Rapier colliders and collision-resolved player movement.
3. Darkness, restricted fluorescent lighting, flashlight, fog, bloom, grain and vignette.
4. Keys, nurse note, interaction prompt and locked exit.
5. Yuka navigation, stalker states, line of sight and chase loop.
6. Ambient/tension audio and HUD overlays.
7. Win/lose/pause/restart reset path.
8. Validate JS syntax, dependency build, asset download, runtime/browser console and a full win/lose loop.

Milestones 1–7 are represented in source; only syntax/static checks are possible here. The production build and live browser test remain unverified due the environment's missing external network/dependencies, as recorded in `GAME_VALIDATION.md`.
