# Final integration verification

These captures use the current per-ship factory on main, including native square-rig bracing and furling, the hoy's leeboards, and the Indiaman's broad hull and gunports. The earlier sibling folders document the iterative art review before this integration.

Final additions preserve the continuous quarterdecks beneath both rear masts, raised aft booms, orderly fluyt cargo, immersed stern-following rudders, and muted night windows on High and Low quality. The smaller boats retain their characteristic hulls and rigs with the authored deck fittings.

Fully upgraded triangles / meshes: sloop 743 / 6; cutter 827 / 7; schooner 1071 / 9; clipper 1359 / 11; hoy 999 / 6; fluyt 1699 / 11; Indiaman 2167 / 12.

Validation: 504 tests across 51 files pass, including independent ship upgrades, rig attachments, cargo clearance, rear-mast deck support, rudder submersion and glazing. TypeScript, ESLint, formatting and production build pass. Screenshots use software WebGL and do not measure device performance.

Run the capture script with a development server on port 5185. PLAYWRIGHT_PATH and CHROMIUM_PATH can select the local browser tools.
