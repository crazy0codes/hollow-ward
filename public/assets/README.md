# Runtime assets

The build script fetches the pinned CC0 RobotExpressive fallback when network access is available. The optional corridor tile may fail to download and is not required.

For the current Hollow Ward model update, place these user-supplied files in this directory:

- `the_human_deer.glb` — primary animated hunter (contains one 6.25-second clip).
- `Meshy_AI_Character_output.glb` — secondary rigged apparition (no embedded clips; animated procedurally by the game).

The application will try the deer, then Meshy, then RobotExpressive, then a primitive hunter fallback. The GLB binaries themselves are supplied separately and are not checked into this repository yet. Keep their filenames exactly as shown for the loader paths to match.
