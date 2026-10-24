/* global URL, process, console, window, performance, requestAnimationFrame, navigator, localStorage */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { summarize } from './stats.mjs';

const config = JSON.parse(await readFile(new URL('./scenarios.json', import.meta.url), 'utf8'));
for (const key of ['repeats', 'warmupMs', 'durationMs', 'timeoutMs']) {
  if (!Number.isFinite(config[key]) || config[key] <= 0)
    throw new Error(`Invalid ${key} in scenarios.json`);
}
const supported = ['startup', 'sailing', 'storm', 'docking', 'townGrowth', 'qualityChange'];
if (!config.scenarios.length || config.scenarios.some((name) => !supported.includes(name)))
  throw new Error('Unknown or empty scenario list');
const url = new URL(process.argv[2] || 'http://localhost:5180/');
url.searchParams.set('debug', '');
const output = resolve(process.argv[3] || 'output/performance/report.json');
// Override is useful for managed runtimes; normal checkouts use the dev dependency.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright'
);
const browser = await chromium.launch({
  headless: !process.env.PERF_HEADED,
  executablePath: process.env.PERF_BROWSER_PATH,
});
const report = {
  at: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  url: url.href,
  browser: browser.version(),
  config,
  runs: [],
};
try {
  for (const scenario of config.scenarios) {
    for (let repeat = 0; repeat < config.repeats; repeat++) {
      const context = await browser.newContext({
        viewport: config.viewport,
        deviceScaleFactor: config.deviceScaleFactor,
      });
      const page = await context.newPage();
      await page.addInitScript(
        (settings) => localStorage.setItem('fwt.settings.v1', JSON.stringify(settings)),
        config.settings,
      );
      page.setDefaultTimeout(config.timeoutMs);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url.href);
      await page.waitForFunction(() => !!window.fwt);
      const startupMs = await page.evaluate(() => performance.now());
      await page.locator('#menu-play').click();
      if (await page.locator('#set-sail').isVisible()) await page.locator('#set-sail').click();
      if (await page.locator('#tutorial-free').isVisible())
        await page.locator('#tutorial-free').click();
      // Plain free play, not the prologue a skipped tutorial still plays (decision 0160).
      await page.evaluate(() => window.fwt?.freePlay?.());
      // A fresh browser context prevents settings, adaptive quality and saves leaking between runs.
      await page.waitForTimeout(config.warmupMs);
      await page.evaluate(() => {
        const renderer = window.fwt.view.renderer;
        const original = renderer.render.bind(renderer);
        window.perfSamples = [];
        let last = performance.now();
        renderer.render = (...args) => {
          const start = performance.now();
          original(...args);
          window.perfSamples.push({
            frameMs: start - last,
            renderCpuMs: performance.now() - start,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
          });
          last = start;
        };
      });
      const action = await page.evaluate(
        async ({ scenario, config }) => {
          const { world, input, trade } = window.fwt;
          const boat = world.boat;
          const frame = () => new Promise((r) => requestAnimationFrame(r));
          const start = performance.now();
          let selectedPort = null;
          const changes = [];
          if (scenario === 'qualityChange') {
            for (const level of config.qualityChange.levels) {
              const before = performance.now();
              window.fwt.view.setQuality(level);
              changes.push({ level, cpuMs: performance.now() - before });
              await frame();
            }
          }
          if (scenario === 'sailing' || scenario === 'storm') {
            boat.x = world.map.boundsRadius * config.sailing.radiusShare;
            boat.y = 0;
            boat.heading = world.wind.from + (config.sailing.headingOffsetDeg * Math.PI) / 180;
            world.trade.dockedAt = null;
            input.setSail(config.sailing.sailStep);
          }
          if (scenario === 'storm') {
            world.dynamicWeather = true;
            world.storms = true;
            world.steadyWind = false;
            world.stormHolds = [];
            world.stormsFrom = 0;
            let found = null;
            for (
              let t = config.storm.scanStepSec;
              t <= config.storm.scanLimitSec;
              t += config.storm.scanStepSec
            ) {
              world.time = t;
              await frame();
              found = world.weather.storms.find(
                (s) => s.intensity >= config.storm.minimumIntensity,
              );
              if (found) break;
            }
            if (!found) throw new Error('No mature storm found within configured scan window');
            boat.x = found.x;
            boat.y = found.y;
            await frame();
          }
          if (scenario === 'docking') {
            input.setSail(0);
            boat.speedKn = 0;
            boat.sail = 0;
            outer: for (const port of world.map.ports) {
              const island = world.map.islands.find((i) => i.id === port.islandId);
              if (!island) continue;
              for (const multiplier of config.docking.radiusMultipliers) {
                for (let j = 0; j < config.docking.radialSamples; j++) {
                  const angle = (j * Math.PI * 2) / config.docking.radialSamples;
                  const pos = {
                    x: island.x + Math.cos(angle) * island.radius * multiplier,
                    y: island.y + Math.sin(angle) * island.radius * multiplier,
                    heading: angle,
                  };
                  if (trade.portInRange(world.map, pos)?.id === port.id) {
                    Object.assign(boat, pos);
                    selectedPort = port.id;
                    break outer;
                  }
                }
              }
            }
            if (!selectedPort) throw new Error('No docking pose found in configured search');
          }
          if (scenario === 'townGrowth') {
            const entry = Object.entries(world.trade.settlements.byPort).find(
              ([, town]) => town.level < config.townGrowth.targetLevel,
            );
            if (!entry) throw new Error('No town below configured target level');
            selectedPort = entry[0];
            // Synthetic renderer workload: trigger the same level-change invalidation, without trading hundreds of goods.
            entry[1].level = Math.min(entry[1].level + 1, config.townGrowth.targetLevel);
            const levels = Object.fromEntries(
              Object.entries(world.trade.settlements.byPort).map(([id, town]) => [id, town.level]),
            );
            const before = performance.now();
            window.fwt.view.setSettlementLevels(levels);
            changes.push({
              portId: selectedPort,
              level: entry[1].level,
              cpuMs: performance.now() - before,
            });
          }
          await frame();
          await frame();
          if (scenario === 'docking' && world.trade.dockedAt !== selectedPort)
            throw new Error('Discovered docking pose did not actually dock');
          return {
            setupAndFirstFramesMs: performance.now() - start,
            setupFrames: window.perfSamples.length,
            selectedPort,
            changes,
            gameTime: world.time,
            storm: world.weather.storm,
            dockedAt: world.trade.dockedAt,
          };
        },
        { scenario, config },
      );
      await page.waitForTimeout(config.durationMs);
      const raw = await page.evaluate(() => {
        const renderer = window.fwt.view.renderer;
        const gl = renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          samples: window.perfSamples,
          environment: {
            userAgent: navigator.userAgent,
            gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
            pixelRatio: renderer.getPixelRatio(),
          },
        };
      });
      if (errors.length) throw new Error(errors.join('\n'));
      const steady = raw.samples.slice(Math.max(1, action.setupFrames));
      if (!steady.length) throw new Error('No steady frames collected');
      const metrics = Object.fromEntries(
        ['frameMs', 'renderCpuMs', 'calls', 'triangles', 'geometries', 'textures'].map((key) => [
          key,
          summarize(steady.map((s) => s[key])),
        ]),
      );
      const eventFrameMs = summarize(
        raw.samples.slice(0, action.setupFrames + 1).map((s) => s.frameMs),
      );
      const run = {
        scenario,
        repeat,
        startupMs,
        action,
        environment: raw.environment,
        metrics,
        eventFrameMs,
        framesOverBudget: steady.filter((s) => s.frameMs > config.reportingBudgets.frameMs).length,
      };
      report.runs.push(run);
      console.log(
        `${scenario} ${repeat + 1}: frame p95 ${metrics.frameMs.p95?.toFixed(2)}ms, max ${metrics.frameMs.max?.toFixed(2)}ms; calls ${metrics.calls.median}; triangles ${metrics.triangles.median}`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
