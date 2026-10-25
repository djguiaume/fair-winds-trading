"""Port Calda's ring pass (decision 0216): lamp posts along its lanes, from level 2 (the town
already has woods, a lake and its mountain). A lamp the checks refuse is left out. Run once on the
shipped file; later changes go through `npm run island`."""
import json, math, re, subprocess
p = 'src/data/islands/calda.json'
d = json.load(open(p))
lamps = []
for lane in d['lanes']:
    pts = lane['points']; acc = 0.1
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a[:2], b[:2]); t = acc
        while t < L:
            x = a[0] + (b[0] - a[0]) * t / L; z = a[1] + (b[1] - a[1]) * t / L
            nx, nz = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
            lamps.append([round(x + nx * 0.05, 3), round(z + nz * 0.05, 3)])
            t += 0.26
        acc = t - L
for x, z in lamps: d['props'].append({"type": "lamp-post", "x": x, "z": z, "size": 1.3, "from": 2})
json.dump(d, open(p, 'w'))
for _ in range(len(lamps)):
    r = subprocess.run(['npm', 'run', '-s', 'island', '--', 'calda', 'tidy', '--warnings'], capture_output=True, text=True).stdout
    bad = re.findall(r'✗ \w+: lamp-post \((-?[\d.]+), (-?[\d.]+)\)', r)
    if not bad: break
    d = json.load(open(p))
    bx, bz = map(float, bad[0])
    d['props'] = [q for q in d['props'] if not (q['type'] == 'lamp-post' and q.get('from') == 2 and abs(q['x'] - bx) < 0.006 and abs(q['z'] - bz) < 0.006)]
    json.dump(d, open(p, 'w'))
print(r.strip().splitlines()[0][:170])
