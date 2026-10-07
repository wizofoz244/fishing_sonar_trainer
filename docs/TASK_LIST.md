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
- [x] Fix drop jig animation and rendering in 2D lake view (`src/renderers/lake2D.js`, `src/main.js`, `index.html`)
- [x] Enforce acoustic cone math for LiveScope MFD targets (jig and structures) (`src/renderers/liveScope.js`)
- [x] Enforce physical acoustic beam bounds across all remaining MFDs (2D CHIRP, ClearVü, SideVü) and sample pings for lure (`src/renderers/chirp2D.js`, `src/renderers/clearVu.js`, `src/renderers/sideVu.js`, `src/renderers/sonarSuite.js`)
- [x] Author comprehensive acoustic reach unit tests in `tests/test_acoustics.py` (7/7 passing)
- [x] Verify functionality via automated checks
- [ ] Automatically commit and push to remote `origin/feature/modular-sonar-architecture`
