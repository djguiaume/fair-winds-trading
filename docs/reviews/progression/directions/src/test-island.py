# Mockup only (docs/reviews/progression/directions): writes a bigger test Lantern Rock in stages 1-3
# into a scratch copy of the repo. Usage: python3 test-island.py <stage>; paths below are that scratch copy.
import json, math, sys
stage = int(sys.argv[1])
coast = [[round(math.cos(a)*r*1.0,4), round(math.sin(a)*r*0.85,4)] for a, r in
         [(i*2*math.pi/16, [1.05,1.0,0.95,1.0,1.08,1.0,0.92,0.98,1.05,1.1,1.0,0.95,1.0,1.04,0.97,1.02][i]) for i in range(16)]]
ground = [{"coast": 0, "height": 0.08, "material": "grass"},
          {"outline": [[-0.75,-0.55],[-0.2,-0.7],[0.35,-0.62],[0.6,-0.35],[0.1,-0.25],[-0.5,-0.2]], "height": 0.28, "material": "grass", "slope": 0.18}]
P = lambda t,x,z,turn=0,size=1.0,variant=0,**k: dict(type=t,x=x,z=z,turn=turn,size=size,variant=variant,shape=0.5,**k)
props = [P('cabin',0.05,0.25,10,1.1,2), P('ruins',-0.45,0.15,30,0.9), P('wreck',0.75,0.72,40,0.8), P('boulder',0.5,0.1,0,0.9), P('boulder',-0.65,0.42,0,0.7), P('crates',0.22,0.48,0,0.8,1)]
piers = []
if stage >= 2:
    props += [P('warehouse',0.42,0.35,-15,1.0,1), P('cutting-shed',-0.25,0.42,20,1.0), P('lumber',-0.05,0.58,80,0.8), P('lamp-post',0.18,0.62), P('crates',0.6,0.52,0,0.8,2), P('cabin',-0.55,-0.02,-30,1.0,4)]
    props = [p for p in props if p['type'] not in ('ruins',)]
    piers = [{"x": 0.05, "z": 0.86, "length": 0.32, "from": 1}]
if stage >= 3:
    props += [P('lighthouse',0.62,-0.42,0,1.0), P('yard-house',-0.35,-0.42,15,1.0,2, y=0.28), P('market-hall',0.15,0.05,0,0.9), P('moored-boat',-0.35,0.98,90,1.0), P('slipway',-0.75,0.62,-40,0.9), P('lamp-post',-0.15,0.2), P('field',-0.1,-0.45,10,0.9,1)]
    props = [p for p in props if p['type'] != 'wreck']
    piers += [{"x": 0.55, "z": 0.8, "length": 0.26, "from": 1}]
d = {"id":"lantern-rock","name":"Lantern Rock","style":"timber","seed":7008,"coasts":[coast],"ground":ground,"lanes":[{"kind":"path","points":[[0.05,0.8],[0.08,0.4],[0.0,0.0],[-0.2,-0.3]]}] if stage>=2 else [],"piers":piers,"props":props,
     "woods":{"tree":"woodland-pine","tries":260,"area":[-1,-1,1,0.3],"size":1.1,"margin":0.08,"spacing":0.2,"clear":[[0,0.3,0.45]] }}
json.dump(d, open('/tmp/claude-0/deck/wt/src/data/islands/lantern-rock.json','w'), indent=1)
m = json.load(open('/home/user/fair-winds-trading/src/data/phase1-map.json'))
for i in m['islands']:
    if i['id']=='lantern-rock': i['radius']=20
json.dump(m, open('/tmp/claude-0/deck/wt/src/data/phase1-map.json','w'), indent=1)
