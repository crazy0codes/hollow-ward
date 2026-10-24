# Hollow Ward

A browser-based first-person horror prototype in an abandoned hospital. The old key hunt has been replaced with a darker objective: recover three incident tapes about a secret containment experiment, then try the north security override while a hostile entity hunts the player.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the local Vite URL (normally `http://localhost:5173`). The setup script attempts to fetch a pinned CC0 animated fallback model and an optional corridor tile. Missing downloads do not intentionally block startup.

Useful checks:

```bash
npm run check
npm run build
npm run preview
npm run test:browser
```

## Controls

| Input | Action |
|---|---|
| `W A S D` | Walk |
| Mouse | Look around; click Start to lock the pointer |
| `Shift` | Sprint, but it makes the hunter more likely to notice you |
| `F` | Toggle flashlight |
| `E` | Play an incident tape, read the note, or use the north security door |
| `Esc` | Pause and release pointer lock |

## Current playable slice

You wake at St. Agnes at 2:17 AM. The disconnected intercom uses your voice to announce a containment breach. Find and play three incident tapes in the ward, learn what the staff created, and activate the north door override. The hunter patrols, chases when it sees you, and searches your last known location. A separate apparition can lunge into view as a sudden scare. Contact with the hunter ends the run.

The ending deliberately does not provide a clean escape: the terminal reports that Subject 09 has left containment, then the intercom repeats the opening announcement in the player's voice.

## Uploaded GLB models

Put these exact files in `public/assets/` to load the models supplied for this update:

- `the_human_deer.glb` — rigged horror creature with one embedded 6.25-second animation clip. It is preferred for the active hunter and the animation is sped up during a chase.
- `Meshy_AI_Character_output.glb` — rigged model with no embedded animation clip. It is used for the sudden apparition, with procedural lunge/scale movement.

The source code now looks for these file names first, but the uploaded GLB binaries have **not yet been committed into this GitHub repository**. Until they are present under `public/assets/`, the app uses its included fallback model and cannot display the custom deer/apparition models on the live site. Copy both files into that folder and commit them to enable the custom models in the deployment.

## Architecture

- **Three.js** — 3D scene, first-person controls, GLTF animation, lights, fog, and audio listener.
- **Rapier** — kinematic player controller and collision geometry.
- **Yuka** — shortest-path routing over the authored walkable-cell graph.
- **Vite** — development server and production bundling.
- CSS film grain and vignette preserve the atmosphere without costly full-screen post-processing in the default render path.

The environment is still a single prototype level, with many hospital fixtures built from primitive geometry. The full multi-chapter conspiracy story, polished cinematics, and all endings are not implemented yet.

## Asset credits and validation

See [`CREDITS.md`](./CREDITS.md) for the pinned fallback assets and their sources. The previous successful CI browser smoke test verified that W and D input move the player body without browser errors: [GitHub Actions run](https://github.com/crazy0codes/hollow-ward/actions/runs/39912075858). This latest update triggers a new build and movement test; that result should be checked before treating this commit as verified. A complete playthrough, actual deployment state, custom-model loading, and the win/lose/restart loop still need end-to-end testing.

See [`GAME_SCRIPT.md`](./GAME_SCRIPT.md) for the story and [`GAME_VALIDATION.md`](./GAME_VALIDATION.md) for release caveats.
