# Task List - Modular Sonar Architecture Refactoring

- [x] Initial GitHub repository, project board, and tracking issue setup
- [x] Switch to feature branch `feature/modular-sonar-architecture`
- [x] Implement central state store and event emitter (`src/state/simState.js`, `src/state/palettes.js`)
- [x] Implement acoustic engine and target stores (`src/physics/acousticEngine.js`, `src/physics/targets.js`)
- [x] Implement lake renderers (`src/renderers/lake3D.js`, `src/renderers/lake2D.js`)
- [x] Implement sonar suite renderers (`src/renderers/liveScope.js`, `src/renderers/sideVu.js`, `src/renderers/clearVu.js`, `src/renderers/chirp2D.js`, `src/renderers/sonarSuite.js`)
- [x] Implement UI components (`src/ui/telemetryHud.js`, `src/ui/helmDock.js`, `src/ui/angleDrawers.js`, `src/ui/targetTray.js`, `src/ui/modals.js`)
- [x] Implement application entrypoint (`src/main.js`, `src/styles/main.css`, `index.html`)
- [x] Author unit tests in `tests/test_acoustics.py` and verify 100% pass rate
- [x] Fix drop jig animation and rendering in 2D lake view (`src/renderers/lake2D.js`, `src/main.js`, `index.html`) - [Issue #2](https://github.com/wizofoz244/fishing_sonar_trainer/issues/2)
- [x] Enforce acoustic cone math for LiveScope MFD targets (jig and structures) (`src/renderers/liveScope.js`) - [Issue #3](https://github.com/wizofoz244/fishing_sonar_trainer/issues/3)
- [x] Enforce physical acoustic beam bounds across all remaining MFDs (2D CHIRP, ClearVü, SideVü) and sample pings for lure (`src/renderers/chirp2D.js`, `src/renderers/clearVu.js`, `src/renderers/sideVu.js`, `src/renderers/sonarSuite.js`) - [Issue #3](https://github.com/wizofoz244/fishing_sonar_trainer/issues/3)
- [x] Author comprehensive acoustic reach unit tests in `tests/test_acoustics.py` (8/8 passing)
- [x] Render ClearVü DownScan volumetric acoustic beam wedge through water column in 3D lake view (`src/renderers/lake3D.js`, `tests/test_acoustics.py`) - [Issue #4](https://github.com/wizofoz244/fishing_sonar_trainer/issues/4)
- [x] Render LiveScope as 3D volumetric phased-array wedge with bottom intersection footprint and clamp beams to never breach water surface in 2D and 3D (`src/renderers/lake3D.js`, `src/renderers/lake2D.js`, `tests/test_acoustics.py`) - [Issue #5](https://github.com/wizofoz244/fishing_sonar_trainer/issues/5)
- [x] Implement LiveScope Forward, Down, and Perspective directional modes with beam azimuth rotation relative to boat travel (`src/state/simState.js`, `src/physics/acousticEngine.js`, `src/renderers/liveScope.js`, `src/renderers/lake3D.js`, `src/renderers/lake2D.js`, `src/ui/angleDrawers.js`, `src/ui/modals.js`, `index.html`, `tests/test_acoustics.py`) - [Issue #6](https://github.com/wizofoz244/fishing_sonar_trainer/issues/6)
- [x] Verify functionality via automated checks (10/10 unit tests passing)
- [x] Align 3D lure with bow transducer and expand perspective elevation coverage (`src/renderers/lake3D.js`, `tests/test_acoustics.py`) - [Issue #7](https://github.com/wizofoz244/fishing_sonar_trainer/issues/7)
- [x] Render realistic bottom-anchored acoustic boulders and sonar shadows (`src/renderers/liveScope.js`, `src/physics/targets.js`, `tests/test_acoustics.py`) - [Issue #8](https://github.com/wizofoz244/fishing_sonar_trainer/issues/8)
- [x] Add responsive top disclaimer notice banner with direct GitHub issue submission link (`index.html`, `tests/test_acoustics.py`) - [Issue #9](https://github.com/wizofoz244/fishing_sonar_trainer/issues/9)
- [x] Merge all feature branches into default branch `main` and close all tracking issues

