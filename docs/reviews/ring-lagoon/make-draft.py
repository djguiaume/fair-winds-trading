import json, math, sys
m = json.load(open('/home/user/fair-winds-trading/src/data/phase1-map.json'))
CX, CY, RO, RI, GAP = 0, -590, 125, 88, 14
m['boundsRadius'] = 780
def arc(a0, a1, step=10):
    outer = [(a, RO) for a in range(a0, a1 + 1, step)]
    inner = [(a, RI) for a in range(a1, a0 - 1, -step)]
    return [[round(CX + r * math.cos(math.radians(a))), round(CY + r * math.sin(math.radians(a)))] for a, r in outer + inner]
m['terrain'] += [
  {"id": "ring-north", "name": "North Arm", "kind": "island", "outline": arc(GAP, 180 - GAP), "look": {"trees": 14, "landmark": "ruins"}},
  {"id": "ring-south", "name": "South Arm", "kind": "island", "outline": arc(180 + GAP, 360 - GAP), "look": {"trees": 14, "landmark": "lighthouse"}},
]
face = sys.argv[1] if len(sys.argv) > 1 else 'in'
# port island sits on the north arm's inner shore (in) or outer shore (out)
py = CY + RI + 4 if face == 'in' else CY + RO - 4
m['islands'].append({"id": "ringhaven", "name": "Ringhaven", "x": CX, "y": py, "radius": 16, "look": {"dock": True, "houses": 5, "trees": 3, "kind": "fish"}})
wy = py - 45 if face == 'in' else py + 45
m['course'].append({"label": "Ringhaven", "x": CX, "y": wy})
m['ports'].append({"id": "ringhaven", "name": "Ringhaven", "islandId": "ringhaven", "produces": ["fish"], "wants": ["timber"], "level": 2})
json.dump(m, open(f'draft-{face}.json', 'w'))
