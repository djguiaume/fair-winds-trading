/* global console, btoa, Buffer */
// `npm run sound` (decision 0209): plays the game's sounds into files, with the game's own
// synthesisers, sea beds and composer, rendered offline in Chromium. Any sound of
// `src/data/audio.json`, or of an edited copy (`--file`, a Sounds page export).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, startVite } from './lib.mjs';

const HELP = `npm run sound -- <what> [options]
  list                         every effect, sea bed, music track and event
  check                        the sound list's checks (also in npm run check)
  effect <id> [--pitch 1.2]    one effect (also: bell <port|island>, the dock bell at its pitch)
  sea <id> [--secs 30]         a sea's bed: --wind 12 --speed 5 --luff --rain 0.8 --storm --docked
                               --far (no call's place is near: only the calls heard anywhere)
  mix <sea> [--secs 40]        a sea with its theme over it, at the default Sounds and Music volumes
  music <track> [--secs 60]    a music track, --seed n for another tune
  tour                         every sea (20 s), every effect and every theme (30 s): the review set
  --file audio.json            an edited sound list instead of src/data/audio.json
  --out dir                    where the files go (default shots/sounds)
  --wav                        keep WAV files (default MP3 through ffmpeg)`;

const num = (v, d) => (v === undefined || v === true ? d : Number(v));

function plan(args, data) {
  const [what, id] = args._;
  const secs = (d) => num(args.secs, d);
  const state = {
    here: {
      windKn: num(args.wind, 12),
      speedKn: num(args.speed, 5),
      luffing: !!args.luff,
      rain: num(args.rain === true ? 0.8 : args.rain, 0),
      docked: !!args.docked,
      calm: 1,
    },
    near: !args.far,
    storm: !!args.storm,
  };
  if (what === 'effect')
    return [{ name: `effect-${id}`, job: { kind: 'effect', id, pitch: num(args.pitch, 1), secs: num(args.secs, 4) } }];
  if (what === 'bell') {
    const pitch = data.events.dock.pitch?.[id] ?? 1;
    return [{ name: `bell-${id}`, job: { kind: 'effect', id: data.events.dock.effect, pitch } }];
  }
  if (what === 'sea')
    return [{ name: `sea-${id}`, job: { kind: 'sea', sea: id, secs: secs(30), state } }];
  if (what === 'mix')
    return [
      {
        name: `mix-${id}`,
        job: { kind: 'mix', sea: id, secs: secs(40), state, seed: num(args.seed, 1) },
      },
    ];
  if (what === 'music')
    return [
      {
        name: `music-${id}`,
        job: { kind: 'music', track: id, secs: secs(60), seed: num(args.seed, 1) },
      },
    ];
  if (what === 'tour') {
    const jobs = [];
    for (const sea of Object.keys(data.seas))
      jobs.push({ name: `sea-${sea}`, job: { kind: 'sea', sea, secs: secs(20), state } });
    for (const [e, def] of Object.entries(data.effects))
      if ('synth' in def) jobs.push({ name: `effect-${e}`, job: { kind: 'effect', id: e } });
    for (const [port, pitch] of Object.entries(data.events.dock.pitch ?? {}))
      jobs.push({
        name: `bell-${port}`,
        job: { kind: 'effect', id: data.events.dock.effect, pitch },
      });
    for (const [track, def] of Object.entries(data.music))
      if ('theme' in def)
        jobs.push({
          name: `music-${track}`,
          job: { kind: 'music', track, secs: secs(30), seed: 1 },
        });
    return jobs;
  }
  return null;
}

export async function run(args) {
  const [what] = args._;
  if (args.help || !what) {
    console.log(HELP);
    return what ? 0 : 1;
  }
  const file = typeof args.file === 'string' ? args.file : join(ROOT, 'src/data/audio.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));

  if (what === 'list') {
    const effects = Object.entries(data.effects).map(
      ([id, e]) =>
        `${id}${'synth' in e && e.synth !== id ? `(${e.synth}${e.pitch ? ` ×${e.pitch}` : ''})` : ''}`,
    );
    console.log(`effects (${effects.length}): ${effects.join(', ')}`);
    for (const [sea, bed] of Object.entries(data.seas))
      console.log(
        `sea ${sea}: music ${bed.music ?? 'sea'}; calls ${(bed.calls ?? []).map((c) => c.effect + (c.near ? '*' : c.away ? '°' : c.when ? `!${c.when}` : '')).join(', ')}`,
      );
    console.log(`music: ${Object.keys(data.music).join(', ')}`);
    console.log(
      `events: ${Object.entries(data.events)
        .map(([k, v]) => `${k}→${v.effect}`)
        .join(', ')}; ${Object.keys(data.events.dock.pitch ?? {}).length} port bells`,
    );
    console.log('(* only near a place, ° only away from one, ! only when)');
    return 0;
  }

  if (what === 'check') {
    const server = await startVite();
    try {
      const { audioProblems } = await server.ssrLoadModule('/src/audio/catalog.ts');
      const { existsSync } = await import('node:fs');
      const problems = audioProblems((f) => existsSync(join(ROOT, 'public', f)), data);
      console.log(problems.length ? problems.map((p) => `✕ ${p}`).join('\n') : 'audio ok');
      return problems.length ? 1 : 0;
    } finally {
      await server.close();
    }
  }

  const jobs = plan(args, data);
  if (!jobs) {
    console.log(`sound: no "${what}" (try --help)`);
    return 1;
  }
  const out = typeof args.out === 'string' ? args.out : join(ROOT, 'shots/sounds');
  mkdirSync(out, { recursive: true });
  const { chromium } = await import('playwright');
  const server = await startVite(true);
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  try {
    const page = await browser.newPage();
    // Any small page of the server will do: the desk is imported through Vite.
    await page.goto(`${base}/favicon.svg`);
    for (const { name, job } of jobs) {
      const result = await page.evaluate(
        async ({ data, job }) => {
          const desk = await import('/src/audio/desk.ts');
          try {
            const samples = await desk.renderJob(data, job);
            const bytes = desk.wavBytes(samples);
            let text = '';
            for (let i = 0; i < bytes.length; i += 0x8000)
              text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return { wav: btoa(text), peak: desk.peak(samples), secs: samples.length / 44100 };
          } catch (e) {
            return { error: String(e?.message ?? e) };
          }
        },
        { data, job },
      );
      if (result.error) {
        console.log(`✕ ${name}: ${result.error}`);
        failed++;
        continue;
      }
      const wav = join(out, `${name}.wav`);
      writeFileSync(wav, Buffer.from(result.wav, 'base64'));
      let path = wav;
      if (!args.wav) {
        path = join(out, `${name}.mp3`);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '96k', path]);
        execFileSync('rm', [wav]);
      }
      const level = result.peak > 0.99 ? ' CLIPS' : result.peak < 0.01 ? ' near silent' : '';
      console.log(`${path} (${result.secs.toFixed(1)} s, peak ${result.peak.toFixed(2)}${level})`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return failed ? 1 : 0;
}
