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

/** The ring alone (decision 0190): codes written before the grown sea was the game's still read. */
const EARLIER_MAPS = [PHASE1_MAP];

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, id: string) =>
  root.querySelector<T>(`#${id}`)!;

/**
 * "Move your voyage" (decision 0066): Send shows the voyage as a QR code, with copy and file
 * export; Receive scans, takes a pasted code or opens a file. Anything that comes in is checked
 * first, then the captain compares both voyages before this device's one is replaced.
 */
export class TransferPanel {
  /** Called once an incoming voyage is stored: the game reloads into it. */
  onReplaced: () => void = () => {};
  onClose: () => void = () => {};

  private readonly scanner: QrScanner;
  private incoming: SaveData | null = null;
  private code = '';
  private copiedTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly world: World,
    private readonly storage: SaveStorage | null,
    private readonly gameUrl: () => string,
  ) {
    this.scanner = new QrScanner($<HTMLVideoElement>(root, 'scan-video'));
    $(root, 'transfer-tab-send').addEventListener('click', () => this.show('send'));
    $(root, 'transfer-tab-receive').addEventListener('click', () => this.show('receive'));
    $(root, 'close-transfer').addEventListener('click', () => this.close());
    $(root, 'transfer-copy').addEventListener('click', () => void this.copy());
    $(root, 'transfer-download').addEventListener('click', () => this.download());
    $(root, 'scan-start').addEventListener('click', () => void this.startScan());
    $(root, 'scan-stop').addEventListener('click', () => this.stopScan());
    $(root, 'transfer-load').addEventListener('click', () =>
      this.take(
        readSaveCode(
          $<HTMLTextAreaElement>(root, 'transfer-paste').value,
          this.world,
          EARLIER_MAPS,
        ),
      ),
    );
    const file = $<HTMLInputElement>(root, 'transfer-file');
    $(root, 'transfer-open-file').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      file.value = '';
      if (f) void f.text().then((text) => this.take(readSaveFile(text, this.world)));
    });
    $(root, 'transfer-keep').addEventListener('click', () => {
      this.incoming = null;
      this.show('receive');
    });
    $(root, 'transfer-replace').addEventListener('click', () => this.replace());
    $(root, 'scan-start').hidden = !canScan();
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
    $(this.root, 'transfer-send').hidden = tab !== 'send';
    $(this.root, 'transfer-receive').hidden = tab !== 'receive';
    $(this.root, 'transfer-confirm').hidden = tab !== 'confirm';
    $(this.root, 'transfer-tabs').hidden = tab === 'confirm';
    for (const [id, on] of [
      ['transfer-tab-send', tab === 'send'],
      ['transfer-tab-receive', tab === 'receive'],
    ] as const) {
      $(this.root, id).setAttribute('aria-selected', String(on));
      $(this.root, id).setAttribute('aria-pressed', String(on));
    }
    if (tab === 'send') this.renderCode();
    if (tab === 'receive') this.error(null);
  }

  /** A fresh code every time Send opens: the voyage as it is now. */
  private renderCode() {
    this.code = encodeSaveCode(serializeWorld(this.world), this.world.map);
    $(this.root, 'transfer-qr').innerHTML = qrSvg(transferLink(this.gameUrl(), this.code), 'M').svg;
    window.clearTimeout(this.copiedTimer);
    $(this.root, 'transfer-copy-label').textContent = t('transfer.copy');
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
    const label = $(this.root, 'transfer-copy-label');
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
    $(this.root, 'scan-view').hidden = false;
    $(this.root, 'scan-start').hidden = true;
    $(this.root, 'scan-stop').hidden = false;
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
    $(this.root, 'scan-view').hidden = true;
    $(this.root, 'scan-start').hidden = !canScan();
    $(this.root, 'scan-stop').hidden = true;
  }

  private take(result: TransferResult) {
    if (!result.ok) {
      this.show('receive');
      this.error(t(`transfer.${result.problem}`));
      return;
    }
    this.incoming = result.save;
    this.fill('voyage-here', summarize(serializeWorld(this.world)));
    this.fill('voyage-incoming', summarize(result.save));
    this.show('confirm');
    $(this.root, 'transfer-keep').focus({ preventScroll: true });
  }

  private fill(id: string, v: VoyageSummary) {
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
    const dl = $(this.root, id);
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
    const el = $(this.root, 'transfer-error');
    el.hidden = !text;
    el.textContent = text ?? '';
  }
}
