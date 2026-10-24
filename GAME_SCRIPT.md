# Hollow Ward — Story and Gameplay Bible

## Creative direction

Extremely dark supernatural survival horror. The creature does not want sympathy, the room is not a safe puzzle box, and sudden effects should punctuate long periods of quiet. The central human conspiracy created an opening for something that now uses memory, architecture and familiar voices to hunt.

## Premise: The room is learning your voice

At 2:17 AM, the protagonist wakes in a yellow, decaying backroom. The speakers have been removed, yet an emergency announcement repeats in the protagonist's exact voice. The room's geometry seems to subtly disagree with itself: corridors end where they should continue, lights hum in dead patterns, and a front door appears in a wall that was blank a moment earlier.

Seventeen years earlier, Project ECHO tried to reconstruct human memory from neurological recordings. The researchers believed they were making a controllable copy of a mind. They had unknowingly built a receiver for something that had learned to imitate the dead. Staff used the term The Attendant because it spoke in a nurse's voice to draw people into sealed rooms.

The experiment's last subject, Subject 09, survived a failed attempt to bind the entity to a living nervous system. Their memory was erased. The player believes the goal is to understand the backroom; the truth is that they are the experiment's missing component.

The entity is not a tortured human. It is an inhuman predator that uses voices and familiar spaces to lure its victims. The human conspiracy explains how it entered; it does not excuse what it is.

## The playable loop: synchronize, provoke, invert

The game does not use key hunting. Its current loop is based on manipulating the room:

1. Explore the backroom. Learn the main routes by sight, sound, flicker and the presence of the creature.
2. Synchronize three Echo Relays. Each station modifies the environment's signal. Activating one updates its light state and raises threat; after all three, the hunter becomes more aggressive.
3. Survive the change. The entity patrols, chases when it sees the player, and searches the last-known location. A separate apparition can lunge suddenly into view.
4. Invert the signal. Return to the central ECHO receiver. It rejects partial activation and begins the finale when all relays are live.
5. Face the false home. The modular house GLB is intended to appear in front of the player. Its embedded Front door open animation starts as the signal inversion completes. The house is the entity's imitation of a safe place, not a safe exit.

## Relays and narrative function

- West Echo Relay — Local Memory. When activated, the hum briefly matches a remembered childhood sound, then breaks into a voice calling from behind the player.
- North Echo Relay — Live Voice. Its monitor displays the player's current words before they are spoken. The entity begins to follow more confidently.
- Lower Echo Relay — Subject 09. The relay reveals that the room knows the player's identity. Once it activates, the hunter switches to its most aggressive state.
- ECHO Inversion Receiver. A central console that only accepts all three phases. It triggers the house-door reveal and the ending.

## Sudden effects and pacing

Do not use a predictable scare timer. Let the player explore in uneasy quiet. Use sudden light extinction, a metallic impact behind the camera, a familiar voice from the wrong direction, a figure visible for a moment at a distant end, or the apparition lunge. Some events can be false alarms so the player cannot simply learn a rhythm.

The player must understand the rules enough to make decisions, but the rules should not make the entity feel safe or kind.

## The Attendant

The uploaded deer-like model is the preferred hunter. It has an embedded animation clip; the game scales the clip speed up while chasing. The hunter uses lurk/patrol, chase, and search states. The second Meshy character is a separate apparition with procedural forward lunge and scale change because it contains no embedded clip.

The imported Backrooms meshes are intended to supply static collision triangles. The navigation graph is still a simple authored grid, so real pathfinding alignment within the imported environment requires manual playtesting and refinement.

## Final twist

At the receiver, the room goes silent. A normal-looking house appears out of place. Its front door opens. The terminal reads:

SUBJECT 09 HAS BEEN COPIED.

The intercom then speaks from behind the player in their own voice: WELCOME HOME.

The twist is not that the monster was trying to escape. It has been using the experiment to learn how to reproduce the player. The house is the first place it wants to enter with that copy.

## Implementation status

Implemented in the current prototype source: a single-level scene loader with procedural fallback, three interactable echo relays, relay-state lights, an ECHO inversion receiver, the hunter state machine, the timed apparition lunge, and a finale that attempts to load the modular house model and play its door animation.

Not yet verified end-to-end: positioning/collision on the imported Backrooms GLB, pathfinding through that imported layout, each relay location, actual display of uploaded GLBs on Netlify, framing of the house model and its opening animation, and all start/pause/restart/ending paths. The full multi-chapter story, recorded voice acting, and branching endings are not implemented yet.