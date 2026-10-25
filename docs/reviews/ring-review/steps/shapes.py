"""The ring's small islands lose their stacked octagons and straight ridges (decision 0215).
Each coast gets ragged midpoints (outward only), each raised ground ragged points and a small
seeded offset that grows with its height, so tiers no longer sit in perfect rings. A prop the new
edges leave on a cliff is nudged off it (scenery: pines and boulders are dropped instead). Run once
on the shipped files; each file is then written by `npm run island -- <id> tidy`; later changes
go through `npm run island`."""
import json, math, random, re, subprocess, sys, os
sys.path.insert(0, os.path.dirname(__file__)); from rough import roughen

ISLANDS = {  # id: (seed, coast amount, tier amount, tier shift, passes)
    'abbey-head': (31, 0.08, 0.05, 0.06, 1),
    'watchman-key': (32, 0.08, 0.05, 0.06, 1),
    'lantern-rock': (33, 0.08, 0.05, 0.05, 1),
    'bell-rock': (34, 0.08, 0.05, 0.05, 1),
    'greyback-ridge': (35, 0.12, 0.08, 0.08, 2),
    'gull-hook': (36, 0.12, 0.08, 0.08, 2),
}
SCENERY = {'pine', 'boulder'}

def shaped(d, seed, coast, tier, shift, passes, k=1.0):
    tier, shift = tier * k, shift * k
    d = json.loads(json.dumps(d))
    rnd = random.Random(seed)
    for _ in range(passes):
        d['coasts'][0] = roughen(d['coasts'][0], rnd.randint(0, 9999), coast, 0, out=True)
    a = rnd.uniform(0, math.tau)
    for g in d['ground']:
        if 'outline' not in g: continue
        o = g['outline']
        for _ in range(passes):
            o = roughen(o, rnd.randint(0, 9999), tier, 0.03 * k)
        s = shift * min(1, g.get('height', 0.3) / 0.5)
        g['outline'] = [[round(x + math.cos(a) * s, 4), round(z + math.sin(a) * s, 4)] for x, z in o]
    return d

def problems(iid):
    r = subprocess.run(['npm', 'run', '-s', 'island', '--', iid, 'tidy', '--warnings'], capture_output=True, text=True)
    return r.stdout, re.findall(r'✗ cliff: (\S+) \((-?[\d.]+), (-?[\d.]+)\) is on a cliff edge: move it ([\d.]+)', r.stdout)

for iid, args in ISLANDS.items():
    p = f'src/data/islands/{iid}.json'
    orig = json.load(open(p))
    # Raised ground must stay inside the coast: gentler tiers until it does.
    for k in (1, 0.6, 0.3, 0):
        d = shaped(orig, *args, k)
        json.dump(d, open(p, 'w'))
        if 'reaches past the coast' not in problems(iid)[0]: break
    for _ in range(12):
        out, bad = problems(iid)
        if not bad: break
        d = json.load(open(p))
        t, x, z, m = bad[0]; x, z, m = float(x), float(z), float(m)
        i = min(range(len(d['props'])), key=lambda i: math.hypot(d['props'][i]['x'] - x, d['props'][i]['z'] - z))
        if t in SCENERY:
            d['props'].pop(i)
        else:
            q = d['props'][i]; best = None
            for k in range(8):
                ang = k * math.pi / 4; step = m + 0.04
                q2 = dict(q, x=round(x + math.cos(ang) * step, 3), z=round(z + math.sin(ang) * step, 3))
                d['props'][i] = q2; json.dump(d, open(p, 'w'))
                _, b2 = problems(iid)
                if not any(abs(float(bx) - q2['x']) < 0.006 and abs(float(bz) - q2['z']) < 0.006 for _, bx, bz, _ in b2):
                    best = q2; break
            d['props'][i] = best or q
        json.dump(d, open(p, 'w'))
    print(iid, out.strip().splitlines()[0][:170])
