# Runtime-fetched assets

`npm run dev` and `npm run build` attempt to fetch licensed GLB assets here using `scripts/fetch-assets.mjs`.

- `RobotExpressive.glb`: CC0 1.0 animated rig from the Three.js examples repository, pinned to a source commit.
- `corridor-floor-tile.glb`: CC0 1.0 hospital corridor floor tile from 3DAssets.dev.

Downloads are verified as binary glTF. The stalker uses a non-box humanoid procedural fallback when its GLB is unavailable; the tile is optional. See `CREDITS.md` for source and licence records.
