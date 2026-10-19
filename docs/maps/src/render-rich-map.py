"""Orthographic review renders from the actual merged game mesh (not browser screenshots).
node docs/maps/src/export-geometry.mjs /tmp/fwt-rich-map.json phase1-map.json
python docs/maps/src/render-rich-map.py /tmp/fwt-rich-map.json
"""
import json,sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from matplotlib.patches import Circle,Polygon
from PIL import Image

root=Path(__file__).resolve().parents[1]
data=json.load(open(sys.argv[1])); world=data['map']
v=np.array(data['positions']).reshape(-1,3,3)
c=np.array(data['colors']).reshape(-1,3,3).mean(axis=1)
c=np.where(c<=.0031308,c*12.92,1.055*np.power(c,1/2.4)-.055)
# CPU lighting, just enough to distinguish the faces of generated props.
n=np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
light=np.array([-.4,.85,.3]);light/=np.linalg.norm(light)
c=np.clip(c*(.76+.24*np.maximum(0,n@light))[:,None],0,1)

def axes(ax):
 ax.set_facecolor('#278b96');ax.set_aspect('equal');ax.set_xticks([]);ax.set_yticks([])
 for s in ax.spines.values():s.set_visible(False)
def draw(ax,tilt=False):
 angle=np.radians(55)
 xy=np.stack([v[:,:,0],-v[:,:,2]*(np.sin(angle) if tilt else 1)+v[:,:,1]*(np.cos(angle) if tilt else 0)],axis=2)
 depth=v[:,:,1]*(np.sin(angle) if tilt else 1)+v[:,:,2]*(np.cos(angle) if tilt else 0)
 xmin,xmax=ax.get_xlim();ymin,ymax=ax.get_ylim()
 width,height=(650,450) if tilt else (1300,1300)
 screen=xy.copy();screen[:,:,0]=(screen[:,:,0]-xmin)/(xmax-xmin)*(width-1);screen[:,:,1]=(ymax-screen[:,:,1])/(ymax-ymin)*(height-1)
 buffer=np.full((height,width),-np.inf);pixels=np.zeros((height,width,4),dtype=np.uint8)
 # True per-pixel depth avoids painter-order artifacts on large terrain cap triangles.
 for tri,z,color in zip(screen,depth,c):
  x0=max(0,int(np.floor(tri[:,0].min())));x1=min(width-1,int(np.ceil(tri[:,0].max())))
  y0=max(0,int(np.floor(tri[:,1].min())));y1=min(height-1,int(np.ceil(tri[:,1].max())))
  if x0>x1 or y0>y1:continue
  aa,bb,cc=tri
  den=(bb[1]-cc[1])*(aa[0]-cc[0])+(cc[0]-bb[0])*(aa[1]-cc[1])
  if abs(den)<1e-8:continue
  yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
  u=((bb[1]-cc[1])*(xx-cc[0])+(cc[0]-bb[0])*(yy-cc[1]))/den
  w=((cc[1]-aa[1])*(xx-cc[0])+(aa[0]-cc[0])*(yy-cc[1]))/den
  t=1-u-w;zz=u*z[0]+w*z[1]+t*z[2]
  target=buffer[y0:y1+1,x0:x1+1]
  mask=(u>=-1e-7)&(w>=-1e-7)&(t>=-1e-7)&(zz>target)
  target[mask]=zz[mask];region=pixels[y0:y1+1,x0:x1+1];region[mask,:3]=(color*255).astype(np.uint8);region[mask,3]=255
 ax.imshow(pixels,extent=[xmin,xmax,ymin,ymax],origin='upper',interpolation='nearest',zorder=3)

def label(ax,x,y,s,size=10):
 ax.text(x,y,s,ha='center',va='center',color='#f5ebce',fontsize=size,bbox={'boxstyle':'round,pad=.35','fc':'#123c48','ec':'#739fa0','alpha':.96},zorder=5)
def save(fig,name):
 p=root/name;fig.savefig(p,facecolor=fig.get_facecolor(),dpi=140);plt.close(fig)
 im=Image.open(p).convert('RGB').quantize(colors=160,method=Image.Quantize.MEDIANCUT);im.save(p,optimize=True)

fig=plt.figure(figsize=(12,13),facecolor='#123b47');ax=fig.add_axes([.035,.18,.93,.74]);axes(ax)
r=world['boundsRadius'];ax.set_xlim(-r-20,r+20);ax.set_ylim(-r-20,r+20)
for island in world['islands']:
 for halo,alpha in [(13,.12),(8,.2),(3,.3)]:ax.add_patch(Circle((island['x'],island['y']),island['radius']+halo,fc='#91ddce',ec='none',alpha=alpha,zorder=1))
for t in world.get('terrain',[]):
 ax.add_patch(Polygon(t['outline'],fill=False,ec='#76d1c4',lw=9,alpha=.35,zorder=1,joinstyle='round'))
ax.add_patch(Circle((0,0),r,fill=False,ec='#b9e3d6',lw=.8,ls=(0,(4,6)),alpha=.65,zorder=2))
ax.add_patch(Circle((0,0),260,fill=False,ec='#b9e3d6',lw=.7,ls=(0,(3,8)),alpha=.4,zorder=2))
draw(ax)
for island in world['islands']:
 if island.get('name'):label(ax,island['x'],island['y']-island['radius']-18,island['name'],10)
label(ax,240,-5,'OPEN SAILING WATER',10)
ax.text(-425,405,'N ↑',color='#d1e6dd',fontsize=12)
fig.text(.055,.958,'A larger sea, with recognizable coastlines',color='#fff0cb',fontsize=24,weight='bold')
fig.text(.055,.931,'Actual game geometry • four trading islands preserved • scenery added throughout',color='#b6d6ce',fontsize=11)
fig.text(.055,.12,'440 radius · 69% wider · 2.86× the sea area\nThe faint inner circle marks the previous boundary for comparison only.\nOuter islands are landmarks, not additional trading ports.',color='#dfebdf',fontsize=12,linespacing=1.7)
save(fig,'expanded-overview.png')

regions=[
 ('Ruined ridge and pine groves',(-40,65),140),
 ('Rocky southern hook and beacon',(28,-62),165),
 ('Wreckage and driftwood on the sandbanks',(-57,-125),150),
 ('Lantern Isle',(330,100),95),
 ('Abbey Head',(-260,250),95),
 ('Wrecker’s Rest',(-300,-200),105),
]
fig,axs=plt.subplots(2,3,figsize=(15,9.8),facecolor='#123b47')
for ax,(title,(x,y),width) in zip(axs.flat,regions):
 axes(ax);cy=y*np.sin(np.radians(55));ax.set_xlim(x-width/2,x+width/2);ax.set_ylim(cy-width*.29,cy+width*.4);draw(ax,True)
 ax.set_title(title,color='#f4e9c9',fontsize=12,pad=12)
fig.suptitle('Coastal details • oblique views of the actual merged models',color='#fff0cb',fontsize=20,y=.98)
fig.subplots_adjust(left=.025,right=.975,bottom=.07,top=.9,wspace=.07,hspace=.22)
fig.text(.04,.025,'No added textures or runtime assets · all scenery stays in the existing single island draw call',color='#b6d6ce',fontsize=11)
save(fig,'coastal-details.png')
