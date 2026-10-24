import json, math, sys
# Hand-shaped staggered ring: same layout as make-staggered.py, but the arms swell and pinch,
# with bays, a hill shoulder by the town and hooked headlands.
m = json.load(open('/home/user/fair-winds-trading/src/data/phase1-map.json'))
CX, CY, R, d, OV, PHI = 0, -620, 112, 46, 30, -14
m['boundsRadius'] = 900
def bump(t, c, w, h):  # smooth bump in degrees
    x = (t - c) / w
    return h * math.exp(-x * x)
# north arm, angles 15 .. 195+OV around centre (-d, 0); per-angle inner/outer offsets
def north_profile(t):
    out = 20 + bump(t, 95, 30, 20) + bump(t, 150, 18, 10) + bump(t, 40, 14, 9) - bump(t, 120, 8, 6) + 4 * math.sin(t / 7.0)
    inn = 18 + bump(t, 70, 25, 8) - bump(t, 95, 12, 6) + bump(t, 175, 15, 6) + 3 * math.sin(t / 5.0 + 1)
    tip = min(1, (t - 15) / 18, (195 + OV - t) / 22)  # taper to rounded headlands
    tip = math.sqrt(max(0.15, tip))
    return out * tip, inn * tip
def south_profile(t):
    out = 22 + bump(t, 80, 35, 14) + bump(t, 30, 14, 12) - bump(t, 130, 10, 7) + bump(t, 170, 20, 8) + 4 * math.sin(t / 6.0 + 2)
    inn = 17 + bump(t, 110, 30, 9) - bump(t, 60, 10, 7) + 3 * math.sin(t / 4.5)
    tip = min(1, (t - 15) / 22, (195 + OV - t) / 18)
    tip = math.sqrt(max(0.15, tip))
    return out * tip, inn * tip
def rot(x, y, deg):
    a = math.radians(deg)
    return x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
def arm(profile, flip):
    ts = [15 + i * (180 + OV) / 48 for i in range(49)]
    outer, inner = [], []
    for t in ts:
        o, i = profile(t)
        for lst, r in ((outer, R + o), (inner, R - i)):
            x, y = -d + r * math.cos(math.radians(t)), r * math.sin(math.radians(t))
            if flip: x, y = -x, -y
            x, y = rot(x, y, PHI)
            lst.append([round(CX + x), round(CY + y)])
    return outer + inner[::-1]
north, south = arm(north_profile, False), arm(south_profile, True)
m['terrain'] += [
  {"id": "ring-north", "name": "North Arm", "kind": "island", "outline": north, "look": {"trees": 40, "landmark": "lighthouse"}},
  {"id": "ring-south", "name": "South Arm", "kind": "island", "outline": south, "look": {"trees": 40, "landmark": "lighthouse"}},
]
inner = north[49:]
top = min((p for p in inner if p[1] > CY), key=lambda p: abs(p[0] - CX))
px, py = top[0], top[1] + 4
m['islands'].append({"id": "ringhaven", "name": "Ringhaven", "x": px, "y": py, "radius": 20, "look": {"dock": True, "houses": 8, "trees": 4, "kind": "fish"}})
m['course'].append({"label": "Ringhaven", "x": px, "y": py - 50})
m['ports'].append({"id": "ringhaven", "name": "Ringhaven", "islandId": "ringhaven", "produces": ["fish"], "wants": ["timber"], "level": 3})
json.dump(m, open(sys.argv[1], 'w'))
