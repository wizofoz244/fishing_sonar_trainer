# Garmin GPSMAP® Multi-Sonar & 3D Lake Simulator

An interactive, high-fidelity marine acoustics and multi-frequency sonar simulator modeling real-world physics, beam geometry, bathymetric contours, and marine electronics displays (Panoptix LiveScope™, SideVü™ UHD, ClearVü™ DownScan, and Traditional 2D CHIRP).

## SDLC Documentation Index
| Document | Description |
| :--- | :--- |
| [IMPLEMENTATION_PLAN.md](file:///Users/oz/Develop/fishing_sonar_trainer/docs/IMPLEMENTATION_PLAN.md) | Architectural roadmap, module design, and refactoring plan |
| [TASK_LIST.md](file:///Users/oz/Develop/fishing_sonar_trainer/docs/TASK_LIST.md) | Progress checklist tracking implementation milestones |
| [WALKTHROUGH.md](file:///Users/oz/Develop/fishing_sonar_trainer/docs/WALKTHROUGH.md) | Walkthrough and verification guide |

## Architecture Overview
- **State (`src/state/`)**: Centralized reactive simulator state machine and color palettes.
- **Physics (`src/physics/`)**: Acoustic beam cones, raycasting, swath slicing, and target kinematics.
- **Renderers (`src/renderers/`)**: Pure HTML5 2D canvas isometric lake renderer, 2D cross-section, and 4 Garmin MFD displays.
- **UI (`src/ui/`)**: Modular helm controls, drawers, telemetry HUD, drag-and-drop tray, and modals.

## Community Feedback & Issue Reporting
We welcome feedback from anglers, marine electronics enthusiasts, and acoustics researchers:
- **[Feedback & Issue Survey Form](https://forms.gle/FGJarxj8KERkqvux5)**: Submit acoustic feedback, bug reports, or feature requests.
- **[GitHub Issue Tracker](https://github.com/wizofoz244/fishing_sonar_trainer/issues/new/choose)**: Open a tracked GitHub issue using our Bug Report or Feature Request templates.

