# Implementation Plan - Modular Sonar Architecture Refactoring

## 1. Overview
Migrate the monolithic 1,400+ line Garmin GPSMAP® Multi-Sonar & 3D Lake Simulator into a modular, decoupled ES architecture.

## 2. Directory Structure
```
fishing_sonar_trainer/
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── TASK_LIST.md
│   └── WALKTHROUGH.md
├── src/
│   ├── state/
│   │   ├── simState.js
│   │   └── palettes.js
│   ├── physics/
│   │   ├── acousticEngine.js
│   │   └── targets.js
│   ├── renderers/
│   │   ├── lake3D.js
│   │   ├── lake2D.js
│   │   ├── liveScope.js
│   │   ├── sideVu.js
│   │   ├── clearVu.js
│   │   ├── chirp2D.js
│   │   └── sonarSuite.js
│   ├── ui/
│   │   ├── telemetryHud.js
│   │   ├── helmDock.js
│   │   ├── angleDrawers.js
│   │   ├── targetTray.js
│   │   └── modals.js
│   ├── styles/
│   │   └── main.css
│   └── main.js
├── tests/
│   └── test_acoustics.py
├── index.html
├── package.json
└── README.md
```

## 3. Module Responsibilities
- `src/state/simState.js`: Central state machine and event emitter.
- `src/state/palettes.js`: Palette color calculations for waterfall and sonar feeds.
- `src/physics/acousticEngine.js`: Bathymetry calculations ($getDepthAt$), trigonometric cone checks ($2 \cdot D \cdot \tan(\theta/2)$), LiveScope raycasting, ClearVü and SideVü beam coverage.
- `src/physics/targets.js`: Fish and structure collections, kinematic updates, lure state.
- `src/renderers/lake3D.js`: Pure HTML5 2D canvas isometric projection/unprojection, bass boat, bathymetry mesh, acoustic wedges, swimming bass, and target badges.
- `src/renderers/lake2D.js`: Lateral cross-section renderer with transducer mounts, beam envelopes, and targets.
- `src/renderers/liveScope.js`: 20 FPS phased-array fan MFD with boulder domes, timber branching, torpedo fish blips, and jig tracking.
- `src/renderers/sideVu.js`: Bilateral waterfall buffer, keel pinch, outward shadows, channel swap.
- `src/renderers/clearVu.js`: DownScan slice buffer with dome boulders, tree limbs, and rice grains.
- `src/renderers/chirp2D.js`: Conical CHIRP buffer with hyperbolic arches dynamically scaling with cone angle.
- `src/renderers/sonarSuite.js`: MFD coordinator, ping sampling, layout and standby screens.
- `src/ui/`: Helm dock, drawers, target tray, cross-screen telemetry indicator, modals.

## 4. User Feedback & Issue Reporting Integration
- Direct header button (`#btn-feedback`) linking to Google Forms issue tracker: `https://forms.gle/FGJarxj8KERkqvux5`.
- Top notice banner (`#banner-disclaimer`) direct feedback survey link (`#banner-feedback-link`) alongside GitHub issues chooser.
- Credits modal integration linking to feedback survey form and GitHub issues.
- Community feedback documentation in `README.md`.
- Automated regression test suite (`tests/test_acoustics.py`).

## 5. Licensing & Legal Protections
- **License**: GNU Affero General Public License v3.0 (AGPLv3) (`LICENSE`).
- **Attribution Policy**: Explicitly requires downstream distributions and derivatives to maintain copyright notice (`Copyright (C) 2026 wizofoz244`) and prominent author credit.
- **Network Copyleft**: Any party running a modified version over a network/web service is legally obligated to provide the full corresponding source code to users under the AGPLv3.
- **In-App Modal Attribution**: Displayed in `#drawer-credits` modal with live link to `LICENSE`.

## 6. Release Versioning & Build Metadata
- **Version Identifier**: `v1.0.0`
- **Build Date**: `2026-10-07`
- **Display Locations**:
  - Header badge in navigation bar (`index.html`)
  - Credits and attribution modal (`index.html`, `#drawer-credits`)
  - Package manifest metadata (`package.json`)
  - Project documentation & status badges (`README.md`)
- **Release Tagging**: Annotated Git tag `v1.0.0` pointing to production release on `main`.


