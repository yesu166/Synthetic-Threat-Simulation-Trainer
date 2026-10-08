# SIH 26247 Final V3

This version focuses the prototype on adaptive training rather than passive drone animation.

Core demo:
1. Observe synthetic airspace.
2. Sensor evidence changes with scenario phase.
3. Q/E selects a contact.
4. 1/2/3 forces an explicit trainee classification.
5. Engine scores correctness, evidence confidence and reaction time.
6. Difficulty adapts after the scenario cycle.
7. F2 opens the after-action review.

Visual optimization:
- 256px generated procedural textures, shared across materials.
- Instanced vegetation.
- Fixed synthetic contact meshes.
- 1536 shadow map.
- 1.25 DPR cap.
- Automatic DPR reduction when FPS drops.
- No external image URLs.
- No runtime geometry rebuilding.
