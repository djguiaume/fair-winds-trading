import * as THREE from 'three';
import { TUNING } from '../../../data/tuning';
import type { IslandDesign, SculptDef } from '../../../data/islands';
import type { FieldColor } from '../../../render/models/fieldGround';
import { designColor } from '../../../render/models/highlandIslands';
import { type Stand, fieldStand } from '../../../render/models/townProps';
import { heightAt, sampleIndex } from '../../../sim/heightfield';
import type { IslandDef } from '../../../sim/map';
import { islandPoint } from '../../../sim/islandLayout';
import { ISLAND_SCALE } from '../../../sim/islandUnits';
import { type Region, keepMask } from '../../../sim/sculpt';
import { SculptSession } from '../../../sim/sculptSession';
import type { Preview, TopView } from '../scene';
import { type BrushSettings, defaultBrush, resized, sculptBrush } from './brush';
import { type TerrainWarning, terrainWarnings } from './warnings';
import { TerrainView, depthColor, shaded } from './terrainView';

/** What the terrain tools need from the island builder. */
export interface TerrainHost {
  readonly top: TopView;
  readonly preview: Preview;
  /** The island being built: radius in reference units, whether it has a harbour, level shown. */
  R(): number;
  harbour(): boolean;
  level(): number;
  /** Stores the island's terrain edits as one undo step, then rebuilds and rechecks the island. */
  save(sculpt: SculptDef | undefined): void;
  /** Rebuilds the props so they stand on the ground as it now is (the ground itself is kept). */
  restand(): void;
  /** Redraws the island's overlay (the brush footprint). */
  redraw(): void;
  /** Redraws the tool buttons and panel after a setting or the strokes changed. */
  refresh(): void;
}

export type TerrainViewMode = 'ground' | 'depth';

/** What the SVG overlay draws for the terrain tools. */
export interface TerrainMarks {
  at: [number, number] | null;
  brush: BrushSettings;
  /** The brush would touch protected town terraces. */
  blocked: boolean;
  /** A slope's two ends [x, z, height] while it is dragged. */
  slope: number[][] | null;
  warnings: TerrainWarning[];
}

const textOf = (sculpt: SculptDef | undefined) => JSON.stringify(sculpt ?? null);

/**
 * The island builder's terrain brushes (issue #271): a `SculptSession` on the island being built,
 * drawn through a `FieldSurface` in both views, painted by pointer strokes. A stroke repaints only
 * the samples it changes, and the props are re-stood on the ground a few times a second; the file
 * is saved, the island rebuilt and the checks run once, when the stroke ends. Undo and redo are
 * the builder's own: the session follows the design's `sculpt` to whichever state it is brought to.
 */
export class TerrainTool {
  brush = defaultBrush();
  view: TerrainViewMode = 'ground';
  /** The next tap on the ground takes its height as the target. */
  picking = false;
  warnings: TerrainWarning[] = [];
  private readonly drawn: TerrainView;
  private session: SculptSession | null = null;
  private island: IslandDef | null = null;
  private keep: Float32Array | null = null;
  private stand: Stand | undefined;
  private key = '';
  private warned = '';
  private exported = '';
  private at: [number, number] | null = null;
  private blocked = false;
  /** The drag being painted: the ground as it was (a slope's ends read it) and the slope ends. */
  private stroke: { ground: Float32Array | null; slope: number[][] } | null = null;
  private timer = 0;

  constructor(private readonly host: TerrainHost) {
    this.drawn = new TerrainView(host.top, host.preview);
  }

  /** Redraws the panel (a setting the panel shows changed). */
  refreshPanel() {
    this.host.refresh();
  }

  get stroking() {
    return !!this.stroke;
  }

  /** How many strokes the island file holds. */
  get strokes() {
    return this.session?.sculpt?.edits.length ?? 0;
  }

  /** World units of one radius unit: what the panel shows brush numbers in. */
  get unit() {
    return this.host.R() * ISLAND_SCALE;
  }

  /** The ground under the props as the tools draw it, or undefined where the classic tiers are. */
  get standing() {
    return this.stand;
  }

  // --- Following the design --------------------------------------------------------------------

  /**
   * Called as the builder rebuilds the island: with `show` the field is drawn (made, or brought
   * to the design's edits after an undo, a redo or a reset), else it is dropped. Returns where the
   * props stand.
   */
  prepare(design: IslandDesign, show: boolean): Stand | undefined {
    if (!show) {
      this.release();
      return undefined;
    }
    const key = JSON.stringify([
      this.host.R(),
      this.host.level(),
      this.host.harbour(),
      design.sculpt ? { ...design, sculpt: undefined } : design,
    ]);
    if (!this.session || key !== this.key) this.build(design, key);
    else this.follow(design);
    const text = textOf(design.sculpt);
    if (text !== this.warned) {
      this.warned = text;
      this.warnings = terrainWarnings(
        this.session!.field,
        this.island!,
        design,
        this.host.harbour(),
      );
    }
    return this.stand;
  }

  /** Lets go of the field when the terrain tools are not in use (and nothing is sculpted). */
  release() {
    if (!this.session) return;
    this.drawn.hide();
    this.session = null;
    this.stand = undefined;
    this.key = this.warned = '';
    this.warnings = [];
  }

  private build(design: IslandDesign, key: string) {
    const R = this.host.R();
    const island: IslandDef = {
      id: design.id,
      x: 0,
      y: 0,
      radius: R * ISLAND_SCALE,
      // Drawn with the harbour toward +z, as the builder's views are: a turn that changes nothing.
      look: { design: design.id, harbourBearing: Math.PI, dock: this.host.harbour() },
    };
    const session = new SculptSession(island, design, this.host.level());
    this.island = island;
    this.session = session;
    this.keep = keepMask(session.field, island, design);
    this.stand = fieldStand(island, session.field);
    this.key = key;
    this.warned = '';
    this.drawn.show(session.field, this.colors(design), this.reach(design, island));
  }

  /** Brings the session to the design's edits: one undo or redo when that is the difference. */
  private follow(design: IslandDesign) {
    const session = this.session!;
    const want = textOf(design.sculpt);
    if (textOf(session.sculpt) === want) return;
    for (const step of ['undo', 'redo'] as const) {
      if (!(step === 'undo' ? session.canUndo : session.canRedo)) continue;
      const region = session[step]();
      if (textOf(session.sculpt) === want) return this.drawn.update(region);
      session[step === 'undo' ? 'redo' : 'undo']();
    }
    this.build(design, this.key);
  }

  private colors(design: IslandDesign): FieldColor {
    const depth = depthColor();
    if (this.view === 'depth') return depth;
    const land = shaded(designColor(design.style));
    // Open water takes the sea's depth colours; land the island style's, lighter the higher.
    return (ground, steep, height) =>
      ground === '' ? depth(ground, steep, height) : land(ground, steep, height);
  }

  /** The island's extent in the scene, for framing the 3D view. */
  private reach(design: IslandDesign, island: IslandDef) {
    const points = design.coasts.flat();
    const xs = points.map((p) => p[0]),
      zs = points.map((p) => p[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2,
      z = (Math.min(...zs) + Math.max(...zs)) / 2;
    const r = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2;
    return new THREE.Sphere(
      new THREE.Vector3(x * island.radius, 0, z * island.radius),
      (r + 0.3) * island.radius,
    );
  }

  setView(view: TerrainViewMode, design: IslandDesign) {
    this.view = view;
    this.drawn.recolor(this.colors(design));
    this.host.refresh();
    this.host.redraw();
  }

  // --- Strokes ---------------------------------------------------------------------------------

  /** The ground height at a point of the file's frame (radius units), as the session has it. */
  private ground(x: number, z: number, heights?: Float32Array | null) {
    const island = this.island!;
    const p = islandPoint(island, x, z);
    const field = this.session!.field;
    return heightAt(heights ? { ...field, heights } : field, p.x, p.y) / island.radius;
  }

  /** Begins a stroke at a point (radius units), or takes the target height when picking. */
  begin(x: number, z: number): boolean {
    const session = this.session;
    if (!session) return false;
    if (this.picking) {
      this.brush = { ...this.brush, height: Number(this.ground(x, z).toFixed(4)) };
      this.picking = false;
      this.host.refresh();
      return false;
    }
    const brush = sculptBrush(this.brush);
    if (brush.op === 'flatten' && this.brush.height === null)
      brush.height = Number(this.ground(x, z).toFixed(4));
    try {
      session.begin(brush);
    } catch {
      return false;
    }
    const slope = brush.op === 'slope';
    this.stroke = { ground: slope ? session.field.heights.slice() : null, slope: [] };
    this.move(x, z);
    this.host.refresh();
    return true;
  }

  /** The pointer moves while a stroke is open. */
  move(x: number, z: number) {
    const stroke = this.stroke;
    if (!stroke) return;
    this.point(x, z);
    const slope = this.brush.tool === 'slope';
    let region: Region | null;
    if (slope) {
      const height = !stroke.slope.length
        ? this.ground(x, z, stroke.ground)
        : (this.brush.height ?? this.ground(x, z, stroke.ground));
      stroke.slope[stroke.slope.length ? 1 : 0] = [x, z, height];
      region = this.session!.dab(x, z, height);
    } else region = this.session!.dab(x, z);
    if (!region) return this.host.redraw();
    this.drawn.update(region);
    this.restandSoon();
    this.host.redraw();
  }

  /** Re-stands the props on the new ground at most every `placementMs` while a stroke goes on. */
  private restandSoon() {
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (this.stroke) this.host.restand();
    }, TUNING.terrain.sculpt.editor.placementMs);
  }

  /** Ends the stroke: the edit joins the file as one undo step. */
  end() {
    const session = this.session;
    if (!this.stroke || !session) return;
    this.stroke = null;
    clearTimeout(this.timer);
    this.timer = 0;
    const before = textOf(session.sculpt);
    session.commit();
    if (textOf(session.sculpt) !== before) this.host.save(session.sculpt);
    else this.host.restand();
  }

  /** Drops the stroke and puts the ground back. */
  cancel() {
    if (!this.stroke) return;
    this.stroke = null;
    clearTimeout(this.timer);
    this.timer = 0;
    this.drawn.update(this.session!.cancel());
    this.host.restand();
    this.host.refresh();
  }

  // --- Footprint and settings ----------------------------------------------------------------

  /** The pointer over the island without a stroke, or a stroke's latest point. */
  point(x: number, z: number) {
    this.at = [x, z];
    this.blocked = !this.brush.override && this.touchesProtected(x, z);
  }

  leave() {
    this.at = null;
    this.host.redraw();
  }

  /** Whether any of the brush's footprint lies on protected town terraces. */
  private touchesProtected(x: number, z: number) {
    const keep = this.keep;
    if (!keep || !this.session) return false;
    const { radius } = this.brush;
    for (const ring of [0, 0.5, 1])
      for (let k = 0; k < (ring ? 8 : 1); k++) {
        const a = (k * Math.PI) / 4;
        const p = islandPoint(
          this.island!,
          x + Math.cos(a) * ring * radius,
          z + Math.sin(a) * ring * radius,
        );
        const i = sampleIndex(this.session.field, p.x, p.y);
        if (i >= 0 && keep[i]! < 0.99) return true;
      }
    return false;
  }

  set(settings: Partial<BrushSettings>) {
    this.brush = { ...this.brush, ...settings };
    if (this.at) this.point(...this.at);
    this.host.redraw();
  }

  /** The bracket keys: a bigger or smaller brush. */
  resize(factor: number) {
    this.brush = resized(this.brush, factor);
    if (this.at) this.point(...this.at);
    this.host.refresh();
    this.host.redraw();
  }

  marks(): TerrainMarks {
    const slope = this.stroke?.slope;
    return {
      at: this.at,
      brush: this.brush,
      blocked: this.blocked,
      slope: slope?.length === 2 ? slope : null,
      warnings: this.warnings,
    };
  }

  // --- Unsaved terrain edits -------------------------------------------------------------------

  /** Called as the island opens, and after it is exported: the edits so far are the saved ones. */
  markExported(design: IslandDesign) {
    this.exported = textOf(design.sculpt);
  }

  /** Terrain edits kept in this browser but not exported yet. */
  unexported(design: IslandDesign) {
    return textOf(design.sculpt) !== this.exported;
  }
}
