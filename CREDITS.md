# Asset and dependency credits

## External 3D assets

### RobotExpressive.glb

- Direct file: <https://raw.githubusercontent.com/mrdoob/three.js/eba30de865cfbf31ac736f792defd9a60ff28d57/examples/models/gltf/RobotExpressive/RobotExpressive.glb>
- Upstream project/model notes: <https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/RobotExpressive/README.md>
- Model by Tomás Laulhé; modifications by Don McCurdy as described in the upstream README.
- Licence: CC0 1.0 Universal, per upstream README.
- Download status: fetched and SHA-256-verified on the hosted GitHub Actions runner during the production build (453.1 KiB). The binary is not committed; `scripts/fetch-assets.mjs` downloads the pinned file and verifies SHA-256 `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319` on first run.

### Corridor floor tile

- Direct file: <https://cdn.3dassets.dev/assets/23660/v1/model.glb>
- Asset page: <https://3dassets.dev/assets/hospital-wards-and-clinic-operations-corridor-floor-ti-6eaa09ac>
- Licence: CC0 1.0 Universal, as stated on the asset page.
- Download status: failed on the hosted GitHub Actions runner with a fetch error from the configured URL. The game treats it as optional; the URL should be repaired before relying on this asset.

## Audio

No external audio file is distributed in this revision. Ambient drone, footsteps, pickup tones, heartbeat and stingers are synthesized by browser Web Audio through Three.js `AudioListener`. This keeps the build from referencing unverified or inaccessible audio files, but is a documented deviation from the original internet-asset preference.

## Project-specific geometry

Walls, floors, keys, nurse desk, beds, trolleys, door, curtains and stains are game-specific low-poly meshes composed from Three.js geometry. They are not external asset-pack files. The imported corridor tile is an optional floor detail; the imported CC0 rig is the preferred stalker model when the asset download succeeds. If the rig is missing, the game falls back to a non-box humanoid made from capsules and spheres.

## Libraries

- Three.js — MIT: <https://github.com/mrdoob/three.js/blob/dev/LICENSE>
- Rapier (`@dimforge/rapier3d-compat`) — Apache-2.0: <https://github.com/dimforge/rapier.js>
- Yuka — MIT: <https://github.com/Mugen87/yuka>
- postprocessing — MIT: <https://github.com/pmndrs/postprocessing>
- Vite — MIT: <https://github.com/vitejs/vite>
