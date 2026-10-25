"""Stonehaven's ring pass (decision 0214): run once on the shipped files, then `npm run island -- south-cay tidy`
and `npm run island -- teeth-rock tidy`. Kept for the record; later changes go through `npm run island`."""
import json, math, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from rough import roughen
p = 'src/data/islands/south-cay.json'
d = json.load(open(p))
# A ragged coast instead of a nonagon (the islet is a sea stack, its peak on its coast).
d['coasts'][0] = roughen(d['coasts'][0], 21, 0.08, 0, out=True)
P = d['props']
def add(t, x, z, frm=1, **k): P.append({"type": t, "x": x, "z": z, **k, "from": frm})
# Before the light: the quarry idle, uncut blocks stacked on the quay where the derrick will load.
for (x, z, v) in [(-0.45, 0.66, 1), (-0.15, 0.7, 2)]:
    add('stone-blocks', x, z, 1, size=1.3, variant=v, fit=0.025, tags=['before:stonehaven-light'])
# Lamps along the town lanes (from level 2) and the quay path (from level 1).
lamps = []
for lane in d['lanes'][:3]:
    pts = lane['points']; acc = 0.1
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a[:2], b[:2]); t = acc
        while t < L:
            x = a[0] + (b[0] - a[0]) * t / L; z = a[1] + (b[1] - a[1]) * t / L
            nx, nz = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
            lamps.append((round(x + nx * 0.05, 3), round(z + nz * 0.05, 3)))
            t += 0.26
        acc = t - L
# Off the cliff edges and out of the harbour approach.
lamps = [l for l in lamps if min(math.dist(l, q) for q in [(-0.4, -0.1), (-0.12, -0.11), (0.11, 0.59)]) > 0.02]
for (x, z) in lamps: add('lamp-post', x, z, 2, size=1.3)
json.dump(d, open(p, 'w'))

# The Teeth: ragged rock; the old hull on the reef is a sea mark (`npm run sea -- add mark --type wreck`).
p = 'src/data/islands/teeth-rock.json'
t = json.load(open(p))
t['coasts'][0] = roughen(t['coasts'][0], 23, 0.05, 0, out=True)
json.dump(t, open(p, 'w'))
