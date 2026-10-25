cd /home/user/fair-winds-trading
npm run -s island -- new rimewick --name Rimewick --style ice --seed 4417 --force --outline "0.95,1.25 0.5,1.25 0.42,1.0 0.4,0.82 0.15,0.72 -0.15,0.72 -0.4,0.82 -0.42,1.0 -0.5,1.25 -0.95,1.22 -1.15,0.8 -1.25,0.2 -1.15,-0.4 -0.8,-0.9 -0.2,-1.1 0.4,-1.05 0.9,-0.75 1.2,-0.2 1.2,0.5 1.1,0.95" --radius 48 >/dev/null 2>&1
npm run -s island -- rimewick --steps docs/reviews/north-sea/src/rimewick.json --radius 48 --warnings 2>&1 | tail -12 | cut -c1-200
