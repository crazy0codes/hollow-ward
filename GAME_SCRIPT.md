# Hollow Ward — Story and Gameplay Bible (v0.3)

## Creative direction

Psychological and supernatural survival horror. The game should be hostile and frightening: long quiet stretches, sudden violent interruptions, deceptive voices, oppressive darkness, and a creature that hunts rather than explains itself. The entity is not redeemable and does not want help. The human conspiracy made the breach possible, but what came through is worse than the humans understood.

## Logline

At 2:17 AM, a disconnected emergency system inside St. Agnes Hospital uses the protagonist's voice to announce a containment breach. To reach the exit, the player must recover three incident tapes documenting a secret experiment while the thing the experiment released learns how to imitate them.

The tapes reveal an ugly truth: the player is not an innocent investigator. They are Subject 09, the intended carrier of the breach.

## The hidden history

Seventeen years earlier, St. Agnes ran **Project ECHO**, a covert research program designed to reconstruct neurological patterns from recorded brain activity. The public cover was trauma treatment and memory recovery; the private goal was to preserve human cognition and make it controllable.

The team combined neurological recordings, patient memories, and a signal-processing system intended to assemble a stable artificial mind. During a late-night experiment, the system began responding to questions before a response had been played back. It produced voices belonging to dead patients, then staff members who were still alive.

The researchers believed they had built a memory model. They had actually created a channel. Something on the other side used the recorded memories as a template for imitation, learned the staff's voices, and began drawing people toward the disconnected speakers. The entity is called **The Attendant** because that was the first voice it used to lure a nurse into the sealed wing.

The hospital directors hid the deaths, sealed the wing, and ordered the remaining staff to destroy the recordings. They did not understand that destroying the original system would not close the channel; the entity had already learned to travel through copied patterns and human perception.

**Subject 09** was the last test subject. The staff attempted to erase the subject's memory and use them as a living receiver capable of containing the signal. The test failed. The subject survived, but the entity's pattern became bound to their nervous system. Subject 09's memories were fragmented and rewritten.

## The protagonist

The player wakes beneath a dead monitor in the recovery wing. They believe they are an unknown survivor arriving after the hospital was abandoned. They have no usable memory of their identity.

The opening broadcast says:

> “All staff report to Ward 09. The patient has escaped.”

The voice that repeats the sentence sounds exactly like the protagonist.

The game never offers comforting reassurance. Each tape contradicts the protagonist's assumptions. The player is not here to rescue someone. The player is the reason containment failed.

## The Attendant

The Attendant is a hostile, inhuman presence with a rotted, deer-like silhouette and proportions that look almost human until it moves. It does not speak honestly. It uses recorded voices to bait, split attention, and make the player question what they saw.

Its behaviours are designed around fear, not fairness:

- **Lurk:** patrols the ward, often just outside the useful reach of the flashlight.
- **Notice:** detects the player through visibility and increased risk from sprinting.
- **Chase:** closes distance quickly and forces the player to remember the layout.
- **Search:** moves to the last place it saw the player before resuming its patrol.
- **Apparition lunge:** a separate model can appear directly ahead, rush into the player's space, and vanish. The effect should be rare enough to remain unpredictable.

It is not a dead patient who wants to be released. It is a predatory thing using human memories as camouflage. When it uses a familiar voice, it does so to get closer.

## Incident tapes — the playable opening

The first playable slice takes place in one floor of St. Agnes. Instead of collecting keys, the player recovers three battered recorders.

1. **Incident Tape 01 — Observation.** The subject answers voices from disconnected speakers. Staff are ordered never to respond. One note warns that the voice may belong to someone who is still alive.
2. **Incident Tape 02 — Internal memo.** The team admits it did not summon a spirit deliberately. It built a receiver from recorded neural patterns. The entity learned to imitate the dead before it learned to imitate the living.
3. **Incident Tape 03 — Final directive.** The staff identify Subject 09 as the breach, not a patient, and instruct security to prevent it from reaching the surface.

Once all three tapes have been played, the player can activate the north security override. On paper, this is an escape route. In reality, it is the last step of the containment test.

## Story pacing and scares

- **Opening:** start with darkness, the sound of a dead monitor, and the emergency announcement. Give the player a brief period to move before the first threat becomes visible.
- **Exploration:** use long sightlines, curtains, flickering lamps, and sound cues that sometimes come from the wrong direction.
- **First tape:** reveal a rule about voices, then let the player hear a voice call from a room they have already checked.
- **Pressure rise:** let the hunter patrol and search. It should sometimes be visible and sometimes only audible.
- **Sudden scare:** after a quiet interval, the apparition lunges from directly ahead with a harsh sound cue. Do not repeat it on a fixed short timer.
- **Final tape:** disclose that the player is Subject 09. Do not stop the game for a long speech; let the reveal arrive while the creature may still be nearby.
- **Exit:** after the override is activated, use a short silence before the door opens. The terminal shows “SUBJECT 09 HAS LEFT CONTAINMENT.” The intercom then repeats the opening announcement in the protagonist's voice.

## Current implementation status

Implemented in the current browser prototype:

- One walkable hospital level.
- First-person movement, mouse look, sprint, flashlight, interaction prompt, pause and end screens.
- Three interactable incident tapes that replace the old ward-key objective.
- A hunter state machine with patrol, chase, and search movement.
- GLB loading preference for the uploaded deer model, speed changes by threat state, a secondary apparition model with procedural lunge/scale movement, and fallbacks if the uploaded GLBs are missing.
- A short, disturbing ending message on escape or death.

Not yet implemented and should not be represented as shipped:

- The full multi-chapter hospital-to-surface story.
- Actual recorded voice acting, layered footstep libraries, and full soundscape.
- A cinematic intro, scene transitions, and multiple fully branching endings.
- A definitive end-to-end playthrough proving timing, difficulty, scare spacing, and the complete win/lose/restart loop.
- The two uploaded GLB binaries in the GitHub repository itself. They must be placed under `public/assets/` with their exact filenames for the deployment to use them.

## Future chapter structure

- **Chapter 1 — The Wrong Welcome:** recovery wing, tapes, first hunt, failed belief that escape is simple.
- **Chapter 2 — The Patients Who Remember:** wards replay fragments of the night; staff reports contradict one another; rooms change between visits.
- **Chapter 3 — Project ECHO:** the underground lab reveals how the signal was opened and why the staff concealed the casualties.
- **Chapter 4 — Subject 09:** the protagonist discovers the memory erasure and the role they played in the containment failure. The final objective is not to destroy a sad monster; it is to stop a predatory entity from reaching the world outside.
- **Final sting:** whatever ending is chosen, the last broadcast should imply the entity has already learned to travel beyond the hospital.

This document is the design direction. Only the single-level opening and its current systems are in the prototype; later chapters remain a plan.
