import math,random
def roughen(poly, seed, amt=0.05, rad=0.0):
    """Insert a jittered midpoint on every edge and nudge each vertex, so a regular outline turns ragged."""
    rnd=random.Random(seed); n=len(poly)
    cx=sum(p[0] for p in poly)/n; cz=sum(p[1] for p in poly)/n
    out=[]
    for i in range(n):
        a=poly[i]; b=poly[(i+1)%n]
        k=1+rnd.uniform(-rad,rad)
        out.append([round(cx+(a[0]-cx)*k,4),round(cz+(a[1]-cz)*k,4)])
        mx,mz=(a[0]+b[0])/2,(a[1]+b[1])/2
        L=math.dist(a,b) or 1
        nx,nz=(b[1]-a[1])/L,-(b[0]-a[0])/L
        o=rnd.uniform(-amt,amt)
        out.append([round(mx+nx*o,4),round(mz+nz*o,4)])
    return out
