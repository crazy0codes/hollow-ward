# Asset and dependency credits

## User-supplied GLB models

The following four models were supplied by the user in this conversation. Their binaries are packaged in the accompanying HollowWard_Backrooms_Assets.zip bundle, but are not yet committed to the repository itself.

- psx_-_backroom.glb — primary environment. The source reads this file as the preferred playable environment.
- modular_kit_horror_house_104_pieces.glb — optional finale environment; metadata lists an animation named Front door open.
- the_human_deer.glb — preferred hunter; metadata lists an embedded animation named Take 001.
- Meshy_AI_Character_output.glb — secondary apparition; no embedded animation clips were found, so the prototype animates the scare procedurally.

These assets are user-provided. Their original author/source and distribution licences were not supplied in this conversation and have not been independently verified. Confirm the licences before public redistribution.

## RobotExpressive.glb fallback

- Direct file: https://raw.githubusercontent.com/mrdoob/three.js/eba30de865cfbf31ac736f792defd9a60ff28d57/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- Upstream model notes: https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/RobotExpressive/README.md
- Model by Tomás Laulhé; modifications by Don McCurdy as described in the upstream README.
- Licence: CC0 1.0 Universal, per upstream README.
- The build helper downloads the pinned file and verifies its SHA-256 if network access is available.

## Optional corridor floor tile

- Direct file: https://cdn.3dassets.dev/assets/23660/v1/model.glb
- Asset page: https://3dassets.dev/assets/hospital-wards-and-clinic-operations-corridor-floor-ti-6eaa09ac
- Licence: CC0 1.0 Universal, as stated on the asset page.
- This asset is optional; its download failed on an earlier hosted build.

## Audio

No external audio file is distributed in this revision. Ambient drone, footsteps, heartbeat and short stingers are synthesized through browser Web Audio. Recorded voices and a full horror soundscape remain future work.

## Libraries

- Three.js — MIT: https://github.com/mrdoob/three.js/blob/dev/LICENSE
- Rapier (@dimforge/rapier3d-compat) — Apache-2.0: https://github.com/dimforge/rapier.js
- Yuka — MIT: https://github.com/Mugen87/yuka
- postprocessing — MIT: https://github.com/pmndrs/postprocessing
- Vite — MIT: https://github.com/vitejs/vite