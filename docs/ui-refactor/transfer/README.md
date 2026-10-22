# Move your voyage: built screens

Screens of Menu → Move your voyage ([decision 0066](../../decisions/0066-move-voyage-between-devices.md)), captured from the real game by `capture.cjs` (run `node docs/ui-refactor/transfer/capture.cjs` from the repo root). The script also checks the whole path: device B scans device A's QR through a fake camera, confirms, and reloads into A's voyage.

| | Landscape phone | Portrait phone | Desktop |
| --- | --- | --- | --- |
| Menu row | ![](built/01-menu-landscape.png) | ![](built/01-menu-portrait.png) (FR) | ![](built/01-menu-desktop.png) |
| Send (QR) | ![](built/02-send-landscape.png) | ![](built/02-send-portrait.png) (FR) | ![](built/02-send-desktop.png) |
| Receive, bad code | ![](built/03-receive-error-landscape.png) | ![](built/03-receive-error-portrait.png) (FR) | ![](built/03-receive-error-desktop.png) |
| Replace? (after scanning) | ![](built/04-confirm-landscape.png) (FR) | ![](built/04-confirm-portrait.png) | ![](built/04-confirm-desktop.png) |
| Opened from a camera-app link | ![](built/05-camera-app-link-landscape.png) | | |
