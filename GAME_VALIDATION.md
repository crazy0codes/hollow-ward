# Hollow Ward — Validation Report

## Current scope

Hollow Ward is a browser-based first-person horror prototype using Three.js, Rapier, Yuka, and Vite. The current source replaces the key hunt with three echo relays and a central inversion receiver. It attempts to load the user-supplied Backrooms environment, deer hunter, secondary apparition, and modular-house finale, with a procedural level fallback if the environment asset is missing.

## Implemented source changes

- Replaced key collection with three interactive signal relays. Activating a relay changes its light state and raises threat; activating all three makes the hunter more aggressive.
- Added an ECHO inversion receiver. It rejects partial activation and triggers a short finale when all three relays are active.
- Added a loader for psx_-_backroom.glb and creates Rapier triangle-mesh colliders from its meshes.
- Added a loader for modular_kit_horror_house_104_pieces.glb and attempts to play its Front door open animation during the finale.
- Added a loader for the_human_deer.glb as the preferred hunter and Meshy_AI_Character_output.glb as a separate procedural-lunge apparition.
- Updated title UI, interaction labels, story bible, README, level-check goals, and asset placement instructions.
- Retained the prior procedural level and hunter as fallbacks.

## Verification status

The latest previously completed green browser movement test is [GitHub Actions run 40085061728](https://github.com/crazy0codes/hollow-ward/actions/runs/40085061728). It verified forward/right movement in Chromium on an earlier source revision. The Backrooms/relay changes have their own workflow run at [GitHub Actions](https://github.com/crazy0codes/hollow-ward/actions); check the latest commit's run before treating this revision as validated.

The following are not yet verified end-to-end:
- Scale and alignment of the imported Backrooms environment in the running browser.
- Walkable/collidable relay locations within that real layout.
- Hunter route-finding around the Backrooms walls; its current path graph is still based on the former grid and needs refinement against the imported layout.
- Whether the modular house loads at an appropriate scale/framing and its door animation is visible to the player.
- All start/pause/restart and terminal-state paths after the new finale.
- The live Netlify deployment's current commit and custom-model availability.

## Binary asset installation

The four uploaded GLBs are packaged in the downloadable asset bundle from this conversation. They are not yet committed to the remote Git tree, because the available GitHub file-editing actions can change text files but cannot transmit these local binary files directly. Extract the four GLBs into public/assets/ and commit them:

- public/assets/psx_-_backroom.glb
- public/assets/modular_kit_horror_house_104_pieces.glb
- public/assets/the_human_deer.glb
- public/assets/Meshy_AI_Character_output.glb

Then run npm install, npm run check, npm run build, and npm run test:browser. Play the level and verify collisions, relay positions, pursuit behaviour, and the house-door finale. Only after that should the uploaded models be considered integrated into the live deployment.

## Release verdict

**Source updated; gameplay and asset integration are still in validation.** Do not describe this as the completed multi-chapter game: the full conspiracy story, recorded voice acting, authored environmental scare sequences, branching endings, and end-to-end playthrough are not finished.