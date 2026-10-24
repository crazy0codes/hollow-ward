# Hollow Ward — Validation Report

## Current scope

Hollow Ward is a browser-based first-person horror prototype built with Three.js, Rapier, Yuka, and Vite. The current playable slice is one connected hospital wing, three incident-tape interactions, a roaming hunter with patrol/chase/search states, a flashlight, and a security-door ending. It is not yet the complete multi-chapter game in the story bible.

## Recent code changes

- Replaced the three-key hunt with three incident tapes documenting Project ECHO and Subject 09.
- Added loading paths for the user-provided `the_human_deer.glb` (preferred animated hunter) and `Meshy_AI_Character_output.glb` (secondary procedural-lunge apparition).
- Uses the deer model's embedded 6.25-second animation clip; the same clip plays faster while the hunter is chasing.
- Added a timed apparition lunge. If the hunter is too close, the scare is postponed briefly instead of continually pushing its trigger farther into the future.
- Retained the included RobotExpressive model and primitive hunter as fallbacks.

## Build and movement checks

The latest completed green browser test at the time of writing is [GitHub Actions run 40085061728](https://github.com/crazy0codes/hollow-ward/actions/runs/40085061728). On that commit, `npm run check`, the Vite production build, and a Chromium smoke test completed successfully. The smoke test reported movement on both axes and no captured page errors. Later test-harness-only and apparition-timer updates trigger additional workflow runs; check the Actions page for their latest state.

Passing a smoke test is not the same as a complete playtest. These remain unverified:
- A full 10–15 minute run and balanced scare frequency.
- Wall collision and all routes during real interactive play.
- Every win/lose/restart path with the new evidence objective.
- Custom GLB rendering in the deployed site.
- The precise commit currently served by Netlify.

## Custom GLB deployment requirement

The two uploaded binary models are **not yet committed to this repository**, because the available GitHub file editing route used for the source does not accept local binary uploads. Download the prepared asset archive from this conversation, extract the two GLBs into `public/assets/`, then commit/push them to `main`:

- `public/assets/the_human_deer.glb`
- `public/assets/Meshy_AI_Character_output.glb`

Until those files are present at those exact paths, the source falls back to the included model and the custom creature/apparition will not appear. Once they are committed, allow Netlify to rebuild and verify the live page manually.

## Release verdict

**Prototype updated; end-to-end validation is incomplete.** The source changes are in the GitHub repository, but the uploaded binaries still need to be added. Do not describe the multi-chapter story, polished cinematic scenes, voice acting, or multiple branching endings as implemented yet.
