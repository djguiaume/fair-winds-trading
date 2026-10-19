"""Reproduce exact game geometry first, then overlay proposal-only coastlines.
Run: node docs/maps/src/export-geometry.mjs /tmp/fwt-geometry.json
     python docs/maps/src/render.py /tmp/fwt-geometry.json
"""
import json, sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from matplotlib.patches import Polygon, Circle

root=Path(__file__).resolve().parents[1]
data=json.load(open(sys.argv[1])); base=data['map']
v=np.array(data['positions']).reshape(-1,3,3)
c=np.array(data['colors']).reshape(-1,3,3).mean(axis=1)
c=np.where(c<=.0031308,c*12.92,1.055*np.power(c,1/2.4)-.055)
# Height-sorted orthographic triangle rasterization of the actual game mesh.
order=np.argsort(v[:,:,1].mean(axis=1));xy=v[:,:,[0,2]].copy();xy[:,:,1]*=-1

def crescent(cx,cy,r,inner,start,end):
 a=np.radians(np.linspace(start,end,32));return np.vstack([np.c_[cx+r*np.cos(a),cy+r*np.sin(a)],np.c_[cx+inner*np.cos(a[::-1]),cy+inner*np.sin(a[::-1])]]).tolist()

options={
 'A':{'title':'Crescent & southern shoals','features':[
  ('island',crescent(-25,-12,61,38,60,195)),
  ('island',crescent(-25,-12,61,38,222,325)),
  ('bank',[[-111,-128],[-86,-115],[-53,-119],[-34,-130],[-43,-141],[-76,-139],[-106,-144]]),
  ('bank',[[-10,57],[4,58],[18,71],[13,79],[0,72]])],
 'labels':[(-35,-5,'INNER PASSAGE'),(72,-12,'NE ENTRANCE'),(-75,-98,'TIGHTER LANE'),(-73,-169,'WIDER DETOUR')],
 'notes':'Split crescent: a tight southwest gap connects to the northeast entrance.\nSouthern shoal: interrupt the direct crossing; choose north or south.\nEastern sea: space to build speed and for later combat.'},
 'B':{'title':'Staggered passages','features':[
 ('island',[[-83,84],[-63,98],[-39,92],[-17,65],[6,47],[7,35],[-8,34],[-29,51],[-48,69],[-73,68]]),
 ('island',[[-49,-43],[-40,-33],[-14,-39],[7,-61],[30,-66],[53,-57],[62,-63],[48,-81],[21,-85],[-8,-73],[-29,-54]]),
 ('bank',[[-108,-115],[-96,-98],[-83,-91],[-71,-94],[-76,-105],[-91,-121]]),
 ('bank',[[0,-154],[8,-141],[18,-135],[23,-141],[17,-157],[5,-168]])],
 'labels':[(-37,22,'WINDING INNER ROUTE'),(-100,126,'NORTHERN BYPASS'),(-57,-122,'SOUTHERN LANE')],
 'notes':'Staggered barriers: short passages need changing headings and careful turns.\nOpen bypasses: longer distances with more room to tack and hold speed.\nThe best outward route may differ from the best return route.'}
}

def text(ax,x,y,s,color='#f2edcd',size=10):
 ax.text(x,y,s,ha='center',va='center',color=color,fontsize=size,fontweight='semibold',bbox=dict(boxstyle='round,pad=.4',facecolor='#153f49',edgecolor='#72a8a6',alpha=.95),zorder=30)

selected = bool(base.get('terrain'))
if selected:
 options={'selected': {'title':'Staggered passages — selected map','features':[],
 'labels':options['B']['labels'],
 'notes':'Existing main islands and artwork preserved. Stronger southern hook.\nInner passages trade distance against wind angle and turning room.\nEastern sea retained for speed and later combat; save progress migrates.'}}
for key,o in options.items():
 fig=plt.figure(figsize=(12,13),dpi=140,facecolor='#103a46')
 ax=fig.add_axes([.025,.22,.95,.70]);ax.set_aspect('equal');ax.set_xlim(-270,270);ax.set_ylim(-270,270);ax.set_facecolor('#288e99');ax.set_xticks([]);ax.set_yticks([])
 for sp in ax.spines.values():sp.set_visible(False)
 # Subtle water facets, with the exact original coast halos.
 rng=np.random.default_rng(7)
 for _ in range(300):
  x,y=rng.uniform([-270,-220],[270,250]);ax.plot([x,x+3],[y,y+.5],color='#64b9bd',alpha=.16,lw=.7,zorder=0)
 for i in base['islands']:
  for d,alpha in [(11,.12),(7,.18),(3,.35)]:ax.add_patch(Circle((i['x'],i['y']),i['radius']+d,fc='#8de5d0',ec='none',alpha=alpha,zorder=1))
 # Exact existing mesh, all original indices/seeds preserved.
 ax.add_collection(PolyCollection(xy[order],facecolors=np.clip(c[order],0,1),edgecolors='none',zorder=3))
 for kind,p in o['features']:
  p=np.array(p);center=p.mean(axis=0)
  ax.add_patch(Polygon((p-center)*1.12+center,fc='#76d6c0',ec='none',alpha=.45,zorder=4))
  ax.add_patch(Polygon(p,fc='#dfca8e',ec='#ffe8ae',lw=.8,zorder=5))
  if kind=='island':ax.add_patch(Polygon((p-center)*.88+center,fc='#7fae59',ec='#a3c26c',lw=.5,zorder=6))
 ax.add_patch(Circle((0,0),260,fill=False,ec='#b3e0d7',lw=.8,ls=(0,(4,6)),alpha=.5,zorder=2))
 for i in base['islands']:
  if i['id'] in ['calda','saltmere','westholm','south-cay']:
   text(ax,i['x'],i['y']-i['radius']-13,i['name'],size=11)
 for x,y,s in o['labels']:text(ax,x,y,s,color='#ffe4a0',size=9)
 text(ax,175,45,'OPEN OCEAN',color='#b9e9e6',size=12)
 ax.annotate('',xy=(192,145),xytext=(220,173),arrowprops=dict(arrowstyle='->',lw=2,color='#d8eee9'))
 ax.text(202,189,'NE wind',ha='center',fontsize=11,color='#d8eee9')
 ax.text(-252,226,'N ↑',color='#d8eee9',fontsize=12)
 fig.text(.05,.962,o['title'] if selected else f'{key}  /  {o["title"]}',fontsize=25,color='#fff1ce',weight='bold')
 fig.text(.05,.935,'Built from actual game geometry • selected layout' if selected else 'Existing islands preserved exactly • proposed additions in gold / light green',fontsize=11,color='#b8d9d4')
 fig.text(.05,.14,o['notes'],fontsize=12,color='#e8edda',linespacing=1.8)
 fig.text(.05,.038,'PHASE 1 MAP  •  Solid above-water sandbanks; no new depth or damage rules.\nProduction roles remain provisional. Later map unlocks are planned separately.' if selected else 'MAP CONCEPT ONLY  •  Port roles remain open. No gameplay changes.\nSandbank rules, passage widths and travel times need validation after selection.',fontsize=10,color='#a4c9c5',linespacing=1.7)
 fig.savefig(root/f'proposal-{key.lower()}.png',facecolor=fig.get_facecolor());plt.close(fig)
if not selected: (root/'proposal-overlays.json').write_text(json.dumps(options,indent=2)+'\n')
