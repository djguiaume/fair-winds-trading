# Mockup only (docs/reviews/home-island): writes a test home island on Skerry (radius 18 instead of 11)
# into a scratch worktree. Usage: python3 home-island.py <stage 0|1|2> <worktree>
#   0 = first arrival, six empty spots; 3 = first arc done; 1 = two arcs done; 2 = every spot built.
import json, math, sys
stage, wt = int(sys.argv[1]), sys.argv[2]
coast = [[round(math.cos(a)*r*1.0,4), round(math.sin(a)*r*0.85,4)] for a, r in
         [(i*2*math.pi/16, [1.05,1.0,0.95,1.0,1.08,1.0,0.92,0.98,1.05,1.1,1.0,0.95,1.0,1.04,0.97,1.02][i]) for i in range(16)]]
ground = [{"coast": 0, "height": 0.08, "material": "grass"},
          {"outline": [[-0.75,-0.55],[-0.2,-0.72],[0.35,-0.66],[0.68,-0.42],[0.25,-0.3],[-0.45,-0.28]], "height": 0.28, "material": "grass", "slope": 0.18}]
P = lambda t,x,z,turn=0,size=1.0,variant=0,**k: dict(type=t,x=x,z=z,turn=turn,size=size,variant=variant,shape=0.5,**k)
# The six fixed build spots (x, z, y): 1-4 one per community arc, 5-6 open for a building you passed on.
SPOTS = [(-0.45,0.4,0),(0.42,0.38,0),(0.0,0.05,0),(0.62,-0.08,0),(-0.64,-0.02,0),(-0.2,-0.5,0.28)]
# Buildings from the arcs draft (PR #101): Workshop, Warehouse, Pilot house, Lookout; Bakehouse bought back on a spare spot.
BUILT = {3: {0: ('cutting-shed',20)}, 1: {0: ('cutting-shed',20), 1: ('warehouse',-15)},
         2: {0: ('cutting-shed',20), 1: ('warehouse',-15), 2: ('stone-house',-10), 3: ('keep',30), 4: ('bakery',-25)}}.get(stage, {})
props = [P('pine',-0.35,-0.15,0,1.0), P('pine',0.3,-0.2,0,0.9), P('pine',-0.8,-0.25,0,1.0), P('pine',0.78,0.15,0,0.9), P('pine',-0.62,-0.62,0,1.0,y=0.28), P('pine',0.1,-0.62,0,1.0,y=0.28), P('beacon',0.42,-0.52,0,1.0, y=0.28), P('cabin',-0.12,0.42,10,1.0,2), P('boulder',0.75,0.45,0,0.8), P('boulder',-0.8,0.35,0,0.7), P('crates',0.12,0.62,0,0.8,1)]
if stage == 0: props += [P('ruins',-0.27,0.15,30,0.65), P('wreck',0.8,0.7,40,0.8)]
for i,(t,turn) in BUILT.items():
    x,z,y = SPOTS[i]
    props.append(P(t,x,z,turn,0.75 if t=='keep' else 1.0,1, **({'y':y} if y else {})))
if stage >= 1: props += [P('lamp-post',0.08,0.3), P('lumber',-0.22,0.6,80,0.8), P('moored-boat',-0.35,0.98,90,1.0)]
if stage >= 2: props += [P('lamp-post',-0.2,0.0), P('crates',0.5,0.55,0,0.8,2), P('field',-0.5,-0.42,10,0.7,1, y=0.28)]
piers = []
lanes = [{"kind":"path","points":[[0.05,0.8],[0.05,0.4],[0.0,0.05],[-0.2,-0.25]]}] if stage >= 1 else []
clear = [[x,z,0.2] for x,z,_ in SPOTS] + [[0.05,0.6,0.25]]
d = {"id":"skerry","name":"Skerry","style":"timber","seed":7010,"coasts":[coast],"ground":ground,"lanes":lanes,"piers":piers,"props":props,
     "woods":{"tree":"woodland-pine","tries":260,"area":[-1,-1,1,0.5],"size":1.0,"margin":0.1,"spacing":0.22,"clear":clear}}
json.dump(d, open(f'{wt}/src/data/islands/skerry.json','w'), indent=1)
m = json.load(open(f'{wt}/src/data/phase1-map.json'))
for i in m['islands']:
    if i['id']=='skerry': i['radius']=18; i['look']['harbourBearing']=3.141592653589793; i['look']['dock']=True
json.dump(m, open(f'{wt}/src/data/phase1-map.json','w'), indent=1)
print(json.dumps([[-60+x*18, -150-z*18] for x,z,_ in SPOTS]))
