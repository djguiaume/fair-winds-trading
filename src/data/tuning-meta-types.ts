/** The kinds of tuning meta entries and their helpers (decision 0094), shared by the meta files. */

/** A number, or a list of numbers that share one range (each element is checked). */
export interface NumberMeta {
  kind: 'number';
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  help: string;
}

/** A polar curve: [true wind angle 0..180°, fraction of top speed 0..1] points. */
export interface PolarMeta {
  kind: 'polar';
  label: string;
  help: string;
}

export interface ToggleMeta {
  kind: 'toggle';
  label: string;
  help: string;
}

/** Names, icons and ids: shown but not slid. */
export interface TextMeta {
  kind: 'text';
  label: string;
  help: string;
}

export type TuningMeta = NumberMeta | PolarMeta | ToggleMeta | TextMeta;

export const num = (
  label: string,
  min: number,
  max: number,
  step: number,
  unit: string | undefined,
  help: string,
): NumberMeta => ({ kind: 'number', label, min, max, step, ...(unit ? { unit } : {}), help });
export const text = (label: string, help: string): TextMeta => ({ kind: 'text', label, help });
export const toggle = (label: string, help: string): ToggleMeta => ({
  kind: 'toggle',
  label,
  help,
});
