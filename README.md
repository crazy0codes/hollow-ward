# Hollow Ward

A first-person browser horror prototype moving beyond key hunting. The current gameplay loop asks players to synchronize three echo relays inside an impossible Backrooms environment. Each relay makes the hostile entity more certain of the player's location. The final receiver inverts the signal and triggers a false-home reveal.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

    npm install
    npm run dev

Open the Vite URL (normally http://localhost:5173). The dev server and production build attempt to fetch the pinned CC0 fallback model. Optional user-supplied GLBs should be copied into public/assets/ as described below.

Useful checks: npm run check, npm run build, npm run preview, and npm run test:browser.

## Controls

| Input | Action |
|---|---|
| W A S D | Walk |
| Mouse | Look around; click Start to lock the pointer |
| Shift | Sprint; the hunter is more likely to notice |
| F | Toggle flashlight |
| E | Synchronize a relay or activate the receiver |
| Esc | Pause and release pointer lock |

## Current gameplay loop

Explore the space and find three Echo Relays. Synchronizing a relay changes its lights, raises threat, and updates the anomaly's awareness. After all three relays are live, the hunter becomes aggressive. Return to the ECHO Inversion Receiver and interact with it. The receiver triggers a short finale in which the modular house's front-door animation is intended to play. The final message reveals that Subject 09 has been copied and that the entity knows the player's home.

No keys are required. Progress is made by interacting with the environment and escalating the entity, not by collecting items and opening a door.

## User-supplied 3D assets

The source checks for these exact filenames:

- public/assets/psx_-_backroom.glb — preferred main environment.
- public/assets/modular_kit_horror_house_104_pieces.glb — optional false-home finale; includes a Front door open animation.
- public/assets/the_human_deer.glb — preferred hunter; includes an embedded 6.25-second animation clip.
- public/assets/Meshy_AI_Character_output.glb — secondary apparition; no embedded animation, so the lunge is procedural.

If the Backrooms model is absent, the game falls back to the existing procedural level. If the deer model is missing, it tries the Meshy model, the CC0 RobotExpressive fallback, and then a procedural hunter. The house model is optional for the finale.

Important: the uploaded binary models are not yet committed to this GitHub repository. The available GitHub file-editing route can update source text but cannot transfer the local binary files directly. Download the asset bundle from this conversation, extract all four GLBs into public/assets/, commit them to main, and let Netlify rebuild. Until then the live site cannot display these custom GLBs.

## Architecture

- Three.js — level scene, first-person controls, GLB loading and animation, fog, lighting and Web Audio.
- Rapier — player movement/collision and imported Backrooms mesh collision.
- Yuka — hunter path-search prototype over the authored walkable grid.
- Vite — development server and production build.

## Validation

The deterministic Chromium movement smoke test passed on GitHub Actions run 40085061728: https://github.com/crazy0codes/hollow-ward/actions/runs/40085061728. The Backrooms/relay changes trigger new checks; check https://github.com/crazy0codes/hollow-ward/actions for their latest status.

Still needs hands-on playtesting: real scale/alignment of the imported environment, relay interaction locations, hunter movement through the imported maze, house animation framing, pause/restart, and the full finale. The binaries must be committed before their loading can be verified on Netlify.

The full multi-chapter story remains a design direction, not completed gameplay. See GAME_SCRIPT.md and GAME_VALIDATION.md.