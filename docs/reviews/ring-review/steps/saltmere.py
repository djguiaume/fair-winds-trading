"""Saltmere's ring pass (decision 0214): run once on the shipped file, then `npm run island -- saltmere tidy`.
Kept for the record; later changes go through `npm run island` or the builder."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from rough import roughen
p = 'src/data/islands/saltmere.json'
d = json.load(open(p))
# Islets and hill: ragged instead of a decagon and an octagon.
d['coasts'][1] = roughen(d['coasts'][1], 11, 0.04, 0)
d['coasts'][2] = roughen(d['coasts'][2], 12, 0.05, 0.1)
d['ground'][1]['outline'] = roughen(d['ground'][1]['outline'], 13, 0.03, 0)
S, B = 'after:saltmere-shoals', 'before:saltmere-shoals'
new = []
for q in d['props']:
    if q['type'] == 'drying-rack':
        q.setdefault('tags', []).append(S)
        e = {k: v for k, v in q.items() if k != 'tags'}; e['type'] = 'empty-rack'; e['tags'] = [B]; new.append(e)
d['props'] += new
P = d['props']
def add(t, x, z, frm=1, **k): P.append({"type": t, "x": x, "z": z, **k, "from": frm})
# The smokehouse row on the east quay, smoking once the fish come back.
for (x, z) in [(0.9, -0.28), (0.92, 0.38)]:
    add('smokehouse', x, z, 1, size=1.3)
    add('chimney-smoke', x, z, 1, size=1.3, tags=[S])
add('chimney-smoke', 0.85, 0.06, 1, size=1.45, to=2, tags=[S])
add('chimney-smoke', 0.85, 0.06, 3, size=2.1, tags=[S])
# Nets drying on the green above the quay.
for i, (x, z) in enumerate([(-1.1, 0.64), (-0.9, 0.74), (-0.7, 0.78)]): add('net-rack', x, z, 1, variant=i, turn=8)
# Rook's harbour office, facing the quay.
add('harbour-office', -0.45, 0.64, 1)
# Boats pulled up on the shore until the shoals are charted.
for (x, z, t) in [(-1.4, 0.5, -60), (-1.33, 0.1, -80)]: add('beached-boat', x, z, 1, turn=t, tags=[B])
# Lamps on the lanes.
for (x, z, l) in [(-1.0, 0.45, 1), (-0.6, 0.45, 1), (-0.1, 0.3, 1), (0.35, 0.35, 1), (0.7, 0.15, 1),
                  (-0.95, -0.05, 2), (-0.5, -0.3, 2), (0.0, -0.55, 2), (0.5, -0.48, 2), (-0.08, 0.15, 2)]:
    add('lamp-post', x, z, l, size=1.3)
# Higher coast, so the sandstone bands show as a cliff ring.
d['ground'][0]['height'] = 0.13
d['ground'][3]['height'] = 0.13
d['ground'][2]['height'] = 0.18
# Woods in four clumps instead of lone trees.
d['woods'].update(spacing=0.12, tries=1400, areas=[[-0.95, -0.55, 0.32], [0.55, -0.62, 0.25], [-1.3, -0.2, 0.18], [0.95, -0.5, 0.18]])
json.dump(d, open(p, 'w'))
