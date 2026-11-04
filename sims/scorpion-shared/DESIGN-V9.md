# SC-8 v9 design language (original redesign, shared by all modules)

The user lifted every constraint: no longer chasing 图二, no envelope or proportion limits. Goal: an original SC-8 scorpion in a biomimetic-tech style matching the official MV look (matte ivory armour, graphite frame, orange-red joint rings, product-render finish), at the highest design level.

## Character
- A premium industrial-design product (Teenage Engineering x Boston Dynamics x a Japanese mecha studio), not a pile of parts. Silhouette first, then hierarchy, then detail.
- Biomimetic: the anatomy reads as a real scorpion (prosoma + 7-segment mesosoma + 5-segment metasoma + telson bulb + aculeus; pedipalp chelae; 4 pairs of walking legs), every segment translated into an engineered part.
- Big-medium-small rhythm: a few large clean ivory surfaces, medium graphite structure, small orange accents. Orange is at most ~6% of the visible area, only on rotary joint rings, the sting tip glow and a few warning stripes.
- Surfaces: ivory shells are smooth, softly cambered and fully bevelled (no raw boxes); panel lines are thin dark grooves; graphite parts show machined faces. Avoid noise and random greebles: every detail must explain a function (bolt circles around actuators, cable runs along links, vents over heat sources).

## Proportions (metres, x forward, y up, z left)
- Body: prosoma + mesosoma about 0.95 long, 0.62 wide, crown about 0.62. Seen from above it is a tapered teardrop: wide at the shoulders, narrowing to the tail root.
- Carapace: one large sculpted prosoma shield (head + front legs), then 6-7 overlapping tergite plates that shrink toward the rear, each plate a cambered ivory shell over a graphite hoop, with 8-15 mm gaps showing the black frame.
- Legs: stance radius about 0.62; knees rise 0.12-0.18 above the carapace edge; tibias angle outward 15-25 degrees from vertical. Front legs sweep forward, rear legs sweep back.
- Tail: the interface keeps 7 links + end mount + stinger (kin TAIL.seg has 7 entries, J1..J8), but it should read visually as a natural scorpion metasoma tapering to a telson bulb; sections taper from 0.20 to 0.12; rest pose is a classic scorpion S-curve raised over the back, with the aculeus pointing forward and down above the prosoma.
- Claws: large and threatening, chela palm about 0.30 long, fingers 0.22, held forward and slightly raised in front of the head.

## Materials (use the existing material keys only)
ivory/white (main shells), graphite/dark (frame, links, actuators), orange (#ee5a24 joint rings and accents), smoke (translucent covers), lamp (emissive eyes / sting glow), steel (bolts, shafts), copper (sparing, only on exposed windings).

## Hard engineering rules (cannot be broken)
- Keep every module's exported interface, anchors, joints, userData tags {sys, mat, internal, order, explode, cut} and the jointCut / act.cut windows. robot.js, show.js, console.js and film.js are unchanged and depend on them.
- Geometry: closed and watertight, no z-fighting, no floating parts; every part is physically attached to its parent.
- Performance: live must stay above 50 fps at tier 0; prefer merged geometry per material inside each explode unit; avoid >200k triangles in total.
- Edit only your own files. Read a file before writing it. Use edit/write, never PowerShell Set-Content.
