# Runtime assets

The build script fetches the pinned CC0 RobotExpressive fallback when network access is available. The optional corridor tile is not required.

Extract the user-supplied GLBs into this directory with exact filenames:

- psx_-_backroom.glb — primary environment.
- modular_kit_horror_house_104_pieces.glb — false-home finale; includes a front-door animation.
- the_human_deer.glb — main animated hunter.
- Meshy_AI_Character_output.glb — secondary apparition, procedurally lunged by the code.

These binaries are provided separately in the asset ZIP; they are not committed in this Git tree yet. The source uses fallbacks if a model is unavailable.