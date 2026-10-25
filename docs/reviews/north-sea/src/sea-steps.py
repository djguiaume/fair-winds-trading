import json, math
R=lambda v: round(v,1)
def pol(b, r, cx=0, cy=0):  # compass bearing deg, radius
    a=math.radians(b); return [R(cx+r*math.sin(a)), R(cy+r*math.cos(a))]
def band(b0,b1,r0,r1,step=3,cx=0,cy=0,jit=0):
    n=max(2,int(abs(b1-b0)/step)+1)
    j=lambda i,k: jit*math.sin(i*2.3+k*1.7+b0)*(0 if i in (0,n-1) else 1)
    outer=[pol(b0+(b1-b0)*i/(n-1),r1+j(i,1),cx,cy) for i in range(n)]
    inner=[pol(b1-(b1-b0)*i/(n-1),r0+j(i,2),cx,cy) for i in range(n)]
    return outer+inner
def ellipse(cx,cy,rx,ry,n=12,rot=0):
    out=[]
    for k in range(n):
        a=2*math.pi*k/n
        x,y=rx*math.cos(a),ry*math.sin(a)
        c,s=math.cos(rot),math.sin(rot)
        out.append([R(cx+x*c-y*s),R(cy+x*s+y*c)])
    return out
S='north'; steps=[{"do":"new","sea":S,"name":"Rimewick"}]
add=lambda what,**k: steps.append({"do":"add","what":what,"sea":S,**k})
# The Floe Line: grounded floes and bergs from -58 to 58 degrees, the Rime Gate from 3 to 12.
pieces=[(-44,-30),(-30.5,-16),(-16.5,3),(12,28),(27.5,44)]
for i,(b0,b1) in enumerate(pieces):
    f={"id":f"floe-line-{i+1}"}
    if i==2: f["name"]="The Floe Line"
    add("ice",at=pol((b0+b1)/2,528),outline=band(b0,b1,516,541,2.5,jit=5),fields=f)
gate_r=528
add("mark",at=pol(3.8,gate_r),fields={"type":"buoy-red","chart":True})
add("mark",at=pol(11.2,gate_r),fields={"type":"buoy-green","chart":True})
add("mark",at=pol(7.5,gate_r),fields={"type":"light","name":"The Rime Gate","chart":True})
# Islands
isl=[("rimewick","Rimewick",-130,760,48,True),("snowberry-isle","Snowberry Isle",-400,740,26,True),
     ("whitefell","Whitefell",250,800,40,False),("lead-rock","Lead Rock",-282,736,9,False),
     ("cairn-holm","Cairn Holm",390,600,12,False),("seal-rocks","Seal Rocks",-330,590,14,False)]
for iid,name,x,y,r,dock in isl:
    look={"design":iid}
    if dock: look["dock"]=True
    else: look["harbourBearing"]=3.1416
    add("island",at=[x,y],fields={"id":iid,"name":name,"radius":r,"look":look})
# Snowberry's shelf of grounded ice, and the pack that locks the cove mouth until rimewick-jam.
SX,SY=-400,740
add("ice",at=pol(270,46,SX,SY),outline=band(140,400,33,60,8,SX,SY,jit=6),fields={"id":"snowberry-shelf"})
add("ice",at=pol(90,44,SX,SY),outline=band(34,146,31,58,8,SX,SY,jit=4),fields={"id":"snowberry-pack","name":"Snowberry Pack","tags":["before:rimewick-jam"]})
add("mark",at=[-262,700],fields={"type":"light","name":"Nell's Lead","chart":True,"tags":["after:rimewick-jam"]})
# The Calving Grounds below Whitefell: drifting bergs.
add("bergs",at=[215,650],outline=ellipse(215,650,160,90,16,0.1),fields={"id":"calving-grounds","name":"The Calving Grounds","count":9,"loops":2,"size":[5,9]})
# The Whistle: cold gales off the glacier.
add("zone",at=[80,880],outline=[[-20,820],[110,770],[200,830],[195,935],[60,970],[-45,915]],fields={"id":"the-whistle","name":"The Whistle","kind":"cold-gale","headingDeg":20})
# The Cold Sea: the north's dark, cold water past the Floe Line (a tint, no wind change).
add("zone",at=pol(0,720),outline=[pol(a,480) for a in range(-46,47,8)]+[pol(a,960) for a in range(46,-47,-8)],fields={"id":"the-cold-sea","name":"The Cold Sea","kind":"cold-sea"})
# Ports
add("port",island="rimewick",fields={"id":"rimewick","name":"Rimewick","produces":[],"wants":["cloudberries"],"wantsMade":["lampOil","bread","planks"],"level":3,"levelProduces":{"3":["cloudberryJam"]}})
add("port",island="snowberry-isle",fields={"id":"snowberry-isle","name":"Snowberry Isle","site":True,"produces":["cloudberries"],"wants":["timber"],"wantsMade":["bread","planks"],"level":1,"maxLevel":3})
# Chart areas (fog of war).
add("area",at=pol(0,500),outline=band(-45,45,440,560,3),fields={"id":"floe-line","name":"The Floe Line"})
add("area",at=pol(-25,750),outline=band(-45,15,560,985,3),fields={"id":"rimewick-fjord","name":"Rimewick Fjord"})
add("area",at=pol(38,750),outline=band(15,45,560,985,3),fields={"id":"calving-grounds","name":"The Calving Grounds"})
json.dump(steps,open('/tmp/claude-0/north/sea-steps.json','w'))
print(len(steps))
