cd /home/user/fair-winds-trading
npm run -s island -- new snowberry-isle --name "Snowberry Isle" --style ice --seed 5203 --force --blob r=1,points=13,rough=0.18,stretch=1.15 --radius 26 >/dev/null 2>&1
npm run -s island -- snowberry-isle --steps docs/reviews/north-sea/src/snowberry.json --radius 26 >/dev/null 2>&1
python3 - <<'PY'
import json
p='src/data/islands/snowberry-isle.json'
d=json.load(open(p))
for pr in d['props']:
    if pr['type'] in ('warm-spring','cloudberry-patch','weather-station-shut','snow-rock','snow-fir','seal'): pr['from']=0
json.dump(d,open(p,'w'))
PY
npm run -s island -- snowberry-isle tidy --radius 26 --warnings 2>&1 | tail -8 | cut -c1-200
