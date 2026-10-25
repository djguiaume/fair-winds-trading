cd /home/user/fair-winds-trading
npm run -s island -- new whitefell --name Whitefell --style ice --seed 6301 --force --blob r=1,points=12,rough=0.2,stretch=1.2,turn=0.4 --radius 40 >/dev/null 2>&1
npm run -s island -- whitefell --steps docs/reviews/north-sea/src/whitefell.json --radius 40 --no-harbour --warnings 2>&1 | tail -5 | cut -c1-160
npm run -s island -- new lead-rock --name "Lead Rock" --style ice --seed 6411 --force --blob r=1,points=9,rough=0.25 --radius 9 >/dev/null 2>&1
npm run -s island -- lead-rock --steps '[{"do":"plateau","at":[0,0],"size":[0.72,0.66],"height":0.25,"material":"rock"},{"do":"prop","type":"lead-cairn-tumbled","at":[0,0],"size":0.75,"level":1,"tags":["before:rimewick-jam"]},{"do":"prop","type":"lead-cairn","at":[0,0],"size":0.75,"level":1,"tags":["after:rimewick-jam"]}]' --radius 9 --no-harbour --warnings 2>&1 | tail -5 | cut -c1-160
npm run -s island -- new cairn-holm --name "Cairn Holm" --style ice --seed 6521 --force --blob r=1,points=10,rough=0.25,stretch=1.3 --radius 12 >/dev/null 2>&1
npm run -s island -- cairn-holm --steps '[{"do":"plateau","at":[0.05,0.05],"size":[0.62,0.5],"height":0.2,"material":"slate"},{"do":"prop","type":"cairn","at":[0.05,0.05],"size":1.1,"level":1}]' --radius 12 --no-harbour --warnings 2>&1 | tail -5 | cut -c1-160
npm run -s island -- new seal-rocks --name "Seal Rocks" --style ice --seed 6633 --force --blob r=1,points=9,rough=0.3,stretch=1.5 --radius 14 >/dev/null 2>&1
npm run -s island -- seal-rocks --steps '[{"do":"plateau","at":[0,-0.1],"size":[0.5,0.35],"height":0.15,"material":"rock"},{"do":"prop","type":"seal","at":[[0.3,0.5],[-0.35,0.45],[0.6,0.1]],"size":1.4,"turn":40,"level":1},{"do":"prop","type":"seal","at":[[-0.1,0.6]],"size":1.2,"turn":-70,"variant":1,"level":1}]' --radius 14 --no-harbour --warnings 2>&1 | tail -5 | cut -c1-160
npm run -s island -- seal-rocks --steps '[{"do":"prop","type":"iceberg","at":[-2.3,-0.5],"size":0.8,"variant":1,"level":1}]' --radius 14 >/dev/null 2>&1
