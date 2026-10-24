import json, math, sys
# Staggered ring (Guillaume's tropical main island idea): two equal arcs whose centres sit d apart,
# each running OV degrees past the other's start, turned so both slanted entrances face east and west.
name, d, OV = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
R, W = 110, 30
m = json.load(open('/home/user/fair-winds-trading/src/data/phase1-map.json'))
CX, CY = 0, -620
m['boundsRadius'] = 900
PHI = float(sys.argv[4]) if len(sys.argv) > 4 else -(15 + OV / 2)
def rot(x, y, deg):
    a = math.radians(deg)
    return x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
def arm(side):  # side -1: north arm (centre west), +1: south arm (point-symmetric copy)
    a0, a1 = 15, 195 + OV
    ts = [a0 + i * (a1 - a0) / 36 for i in range(37)]
    pts = []
    for t, r in [(t, R + W / 2) for t in ts] + [(t, R - W / 2) for t in reversed(ts)]:
        x, y = -d + r * math.cos(math.radians(t)), r * math.sin(math.radians(t))
        if side > 0: x, y = -x, -y
        x, y = rot(x, y, PHI)
        pts.append([round(CX + x), round(CY + y)])
    return pts
north, south = arm(-1), arm(1)
m['terrain'] += [
  {"id": "ring-north", "name": "North Arm", "kind": "island", "outline": north, "look": {"trees": 14, "landmark": "lighthouse"}},
  {"id": "ring-south", "name": "South Arm", "kind": "island", "outline": south, "look": {"trees": 14, "landmark": "lighthouse"}},
]
inner = north[37:]
top = min((p for p in inner if p[1] > CY), key=lambda p: abs(p[0] - CX))
px, py = top[0], top[1] + 2
m['islands'].append({"id": "ringhaven", "name": "Ringhaven", "x": px, "y": py, "radius": 16, "look": {"dock": True, "houses": 5, "trees": 3, "kind": "fish"}})
m['course'].append({"label": "Ringhaven", "x": px, "y": py - 45})
m['ports'].append({"id": "ringhaven", "name": "Ringhaven", "islandId": "ringhaven", "produces": ["fish"], "wants": ["timber"], "level": 2})
json.dump(m, open(f'{name}.json', 'w'))
print(name, 'slot ~', round(2 * d * math.cos(math.radians(OV / 2)) - W), 'units')
