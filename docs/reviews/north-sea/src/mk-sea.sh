cd /home/user/fair-winds-trading
git checkout -q src/data/seas/grown.json; rm -f src/data/seas/north.json
sed -i "s/\"south\", \"north\"/\"south\"/; s/\"south\",\n *\"north\"/\"south\"/" src/data/seas/grown.json
python3 docs/reviews/north-sea/src/sea-steps.py >/dev/null && npm run -s sea -- --steps docs/reviews/north-sea/src/sea-steps.json >/dev/null 2>&1
python3 - <<'PY'
import json
p='src/data/seas/north.json'
d=json.load(open(p))
d['course'][1]={'label':'Snowberry Isle','x':-345,'y':736}
nd={'about':'The north sea, Rimewick (decisions 0137, 0147, 0170). Merged onto the Windward Ring by src/data/grownMap.ts; play it with ?map=phase4. Laid out with npm run sea and npm run island (steps in docs/reviews/north-sea/src).'}
nd.update(d)
json.dump(nd,open(p,'w'),indent=2)
PY
npm run -s sea -- set sea north --name Rimewick --warnings 2>&1 | tail -4 | cut -c1-200
