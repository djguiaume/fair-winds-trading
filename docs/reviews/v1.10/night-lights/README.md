# v1.10 night lights: review sheets

Build part 2 of v1.10 (milestone 12): dark windows #525, the Ultra moon #526, lamp halos #543.

## #525 Every house shows a lit window

[windows-525.jpg](windows-525.jpg): Port Calda (ring sea, town level 4), Fogwatch, Sunreach and Emberhold at night on High, before and after, same camera (`npm run shots -- --night --quality high --zoom 0.5`).

Why houses were dark:
- the seeded dark panes could leave a whole wall unlit (Calda's cabins seen from one side);
- windows sat high on the wall, under eaves the sea camera looks over (Sunreach's beach houses showed none, Fogwatch's turf houses and the rich cabins almost none);
- rich doors, the stone house's door frame and the turf cottage's front wall covered panes.

Fix: every wall keeps one lit pane (`windowPanes`), windows lowered on the cabin, farmhouse, stone, yard, turf and beach houses, rich doors moved or narrowed, the turf cottage's panes moved beside its door. `tests/lit-windows.test.ts` ray-casts each home (plain and rich, 12 variants) from the four corners at the camera's pitch.

Left for the art director: houses at the very bottom of the screen are seen steeper than the camera's pitch, and the deep rich eaves still hide most of their glass there. A soft light spill on the ground under lit windows would read from straight above.
