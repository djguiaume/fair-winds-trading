import { PHASE1_MAP } from '../data/maps';
import { formatNumber, shipName, t } from '../i18n';
import { type SaveData, type SaveStorage, serializeWorld } from '../sim/save';
import {
  type TransferResult,
  type VoyageSummary,
  encodeSaveCode,
  readSaveCode,
  readSaveFile,
  saveFileName,
  saveFileText,
  storeSave,
  summarize,
  transferLink,
} from '../sim/saveTransfer';
import { SHIP_CLASSES } from '../sim/ship';
import type { World } from '../sim/world';
import { qrSvg } from './qr';
import { QrScanner, canScan } from './qrScanner';
import { type TransferView, buildTransfer } from './screens/transferView';

/** The ring alone (decision 0198): codes written before the grown sea was the game's still read. */
const EARLIER_MAPS = [PHASE1_MAP];

/**
 * "Move your voyage" (decision 0066): Send shows the voyage as a QR code, with copy and file
 * export; Receive scans, takes a pasted code or opens a file. Anything that comes in is checked
 * first, then the captain compares both voyages before this device's one is replaced.
 */
export class TransferPanel {
  /** Called once an incoming voyage is stored: the game reloads into it. */
  onReplaced: () => void = () => {};
  onClose: () => void = () => {};

  readonly root: HTMLElement;
  private readonly v: TransferView;
  private readonly scanner: QrScanner;
  private incoming: SaveData | null = null;
  private code = '';
  private copiedTimer = 0;

  constructor(
    private readonly world: World,
    private readonly storage: SaveStorage | null,
    private readonly gameUrl: () => string,
  ) {
    const v = (this.v = buildTransfer(
      () => this.close(),
      (tab) => this.show(tab),
    ));
    this.root = v.root;
    this.scanner = new QrScanner(v.video);
    v.copy.addEventListener('click', () => void this.copy());
    v.download.addEventListener('click', () => this.download());
    v.scanStart.addEventListener('click', () => void this.startScan());
    v.scanStop.addEventListener('click', () => this.stopScan());
    v.load.addEventListener('click', () =>
      this.take(readSaveCode(v.paste.value, this.world, EARLIER_MAPS)),
    );
    v.openFile.addEventListener('click', () => v.file.click());
    v.file.addEventListener('change', () => {
      const f = v.file.files?.[0];
      v.file.value = '';
      if (f) void f.text().then((text) => this.take(readSaveFile(text, this.world)));
    });
    v.keep.addEventListener('click', () => {
      this.incoming = null;
      this.show('receive');
    });
    v.replace.addEventListener('click', () => this.replace());
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(tab: 'send' | 'receive' = 'send') {
    this.root.hidden = false;
    this.show(tab);
  }

  /** A code that arrived in the page address (scanned by a camera app): straight to confirm. */
  openWithCode(text: string) {
    this.root.hidden = false;
    this.show('receive');
    this.take(readSaveCode(text, this.world, EARLIER_MAPS));
  }

  close() {
    this.stopScan();
    this.root.hidden = true;
    this.incoming = null;
    this.onClose();
  }

  private show(tab: 'send' | 'receive' | 'confirm') {
    if (tab !== 'receive') this.stopScan();
    const { panes, tabs } = this.v;
    for (const [id, pane] of Object.entries(panes)) pane.hidden = id !== tab;
    tabs.root.hidden = tab === 'confirm';
    if (tab !== 'confirm') tabs.select(tab, false);
    if (tab === 'send') this.renderCode();
    if (tab === 'receive') this.error(null);
  }

  /** A fresh code every time Send opens: the voyage as it is now. */
  private renderCode() {
    this.code = encodeSaveCode(serializeWorld(this.world), this.world.map);
    this.v.qr.innerHTML = qrSvg(transferLink(this.gameUrl(), this.code), 'M').svg;
    window.clearTimeout(this.copiedTimer);
    this.v.copyLabel.textContent = t('transfer.copy');
  }

  private async copy() {
    const link = transferLink(this.gameUrl(), this.code);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Older Safari or no permission: fall back to a selected text field.
      const area = document.createElement('textarea');
      area.value = link;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    const label = this.v.copyLabel;
    label.textContent = t('transfer.copied');
    window.clearTimeout(this.copiedTimer);
    this.copiedTimer = window.setTimeout(() => (label.textContent = t('transfer.copy')), 2000);
  }

  private download() {
    const now = new Date();
    const blob = new Blob([saveFileText(serializeWorld(this.world), now)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = saveFileName(now);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  private async startScan() {
    this.error(null);
    this.v.scanView.hidden = false;
    this.v.scanStart.hidden = true;
    this.v.scanStop.hidden = false;
    try {
      await this.scanner.start((text) => {
        const result = readSaveCode(text, this.world, EARLIER_MAPS);
        // Someone else's QR code in view: keep looking.
        if (!result.ok && result.problem === 'unreadable') return false;
        this.take(result);
        return true;
      });
    } catch {
      this.stopScan();
      this.error(t('transfer.noCamera'));
    }
  }

  private stopScan() {
    this.scanner.stop();
    this.v.scanView.hidden = true;
    this.v.scanStart.hidden = !canScan();
    this.v.scanStop.hidden = true;
  }

  private take(result: TransferResult) {
    if (!result.ok) {
      this.show('receive');
      this.error(t(`transfer.${result.problem}`));
      return;
    }
    this.incoming = result.save;
    this.fill(this.v.here, summarize(serializeWorld(this.world)));
    this.fill(this.v.incoming, summarize(result.save));
    this.show('confirm');
    this.v.keep.focus({ preventScroll: true });
  }

  private fill(dl: HTMLElement, v: VoyageSummary) {
    const played =
      v.minutes >= 60
        ? t('transfer.hours', { h: String(Math.floor(v.minutes / 60)), m: String(v.minutes % 60) })
        : t('transfer.minutes', { n: String(v.minutes) });
    const rows: [string, string][] = [
      [t('transfer.gold'), formatNumber(v.gold)],
      [t('transfer.ship'), shipName(SHIP_CLASSES[v.ship]!)],
      [t('transfer.fleet'), String(v.fleet)],
      [t('transfer.cargo'), String(v.cargo)],
      [t('transfer.played'), played],
    ];
    dl.replaceChildren();
    for (const [k, val] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = val;
      dl.append(dt, dd);
    }
  }

  private replace() {
    if (!this.incoming) return;
    if (!this.storage || !storeSave(this.storage, this.incoming)) {
      this.show('receive');
      this.error(t('transfer.saveFailed'));
      return;
    }
    this.incoming = null;
    this.onReplaced();
  }

  private error(text: string | null) {
    this.v.error.hidden = !text;
    this.v.error.textContent = text ?? '';
  }
}
