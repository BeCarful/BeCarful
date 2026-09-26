# BeCarful — 3D Car Viewer (frontend)

A simple full-screen viewer showing a white Suzuki XL7 in 3D, with damaged parts colored by severity.

- Drag to orbit, scroll to zoom
- Damaged parts are colored on a green → dark red scale; undamaged parts stay white
- Click a part on the car, or in the **Damage** list, to highlight it with a blue outline
- **Auto-rotate** on/off, **Reset view**, **Open / close doors** (all four doors)

Built with Next.js 16 (App Router, Turbopack), three.js through React Three Fiber, and Vitest.

> The damage shown now is **sample data** (marked with a badge in the UI) until the damage model exists.

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run lint
npm run format
npm run build
```

## Car parts

The 30 part IDs are the same as `PartId` in the backend (`cv-module/src/cv_module/domain/enums.py`). A unit test (`car-parts.test.ts`) fails if the two lists drift apart. The list and display names are in `src/lib/car/car-parts.ts`.

| Area                         | Part IDs                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Front                        | `front_bumper`, `grille`, `hood`, `headlight_left`, `headlight_right`, `windshield`                                                 |
| Sides (× `_left` / `_right`) | `fender_front_*`, `door_front_*`, `door_rear_*`, `fender_rear_*` (rear quarter panel), `side_skirt_*`, `mirror_*`, `window_front_*` |
| Wheels                       | `wheel_front_left`, `wheel_front_right`, `wheel_rear_left`, `wheel_rear_right`                                                      |
| Rear                         | `rear_bumper`, `trunk` (shown as "Tailgate"), `rear_window`, `taillight_left`, `taillight_right`                                    |
| Top                          | `roof`                                                                                                                              |

**Left and right** mean the driver's left and right, sitting in the car facing forward. They are not the viewer's left and right.

## Damage data

The viewer takes a report with one entry per damaged part:

```json
{
  "parts": [
    { "partId": "front_bumper", "score": 0.92 },
    { "partId": "hood", "score": 0.45 }
  ]
}
```

- `partId` is one of the IDs above, and `score` runs from 0 (least damage) to 1 (most).
- Parts that aren't listed are treated as undamaged and stay white.
- `parseDamageReport` (`src/lib/damage/damage-report.ts`) checks incoming data. It throws a clear error for an unknown part, a score outside 0–1, or a part listed twice.
- The sample report is in `src/lib/damage/sample-damage-report.ts`.

## Damage scale

The scale is defined in `src/lib/damage/damage-scale.ts`:

- There are 6 levels, from green (level 1, lowest) to dark red (level 6, highest).
- The 0–1 score range is split into equal bands. With 6 levels, 0–0.167 is level 1, 0.167–0.333 is level 2, and so on.
- **To change the number of levels**, change `DAMAGE_LEVEL_COUNT`. The colors are spread evenly from green to dark red, and the legend updates automatically.
- To change the colors themselves, edit `DAMAGE_SCALE_ANCHORS`.

Only damage uses color. Undamaged parts keep neutral tones: white paint, dark glass and grey taillight lenses. That way nothing on an undamaged car can be mistaken for a damage level.

## Project layout

```
src/
├── app/                          # layout, page, global styles
├── components/car-viewer/
│   ├── car-viewer.tsx            # page shell: 3D scene, damage panel, controls
│   ├── car-scene.tsx             # canvas, lighting, shadow, orbit camera
│   ├── car-model.tsx             # real .glb if configured, else the procedural car
│   ├── procedural-car.tsx        # white shell + all the parts below
│   ├── car-body-panels.tsx       # hood, roof, tailgate, bumpers, fenders, glass
│   ├── car-details.tsx           # grille, lights, mirrors, side skirts, trim
│   ├── car-door.tsx              # animated door (×4)
│   ├── car-wheel.tsx             # tire + rim (×4)
│   ├── car-part.tsx              # makes a mesh clickable; seam + selection outline
│   ├── damage-context.tsx        # shares damage + selection with the 3D parts
│   ├── damage-panel.tsx          # legend + list of damaged parts
│   └── viewer-controls.tsx       # the three buttons
├── hooks/use-viewer-state.ts     # shared UI state (camera, doors, selected part)
└── lib/
    ├── car/                      # part IDs, dimensions, materials, geometry
    └── damage/                   # damage scale, report parsing, sample data
```

## Using a real car model

The car is currently built from three.js shapes using the real XL7's dimensions. To use a real model:

1. Put a `.glb` file in `public/models/`, for example `public/models/car.glb`. Check that its license allows your use.
2. In `src/lib/car/car-config.ts`, set `CAR_MODEL_URL = "/models/car.glb"`.

The loader scales the model to the XL7's length and stands it on the ground. It repaints the body white: first any material named like `paint` or `body`, otherwise the largest mesh.

With a real model, **damage colors, part selection and opening doors do not work yet**. That needs a model split into separate meshes named after the part IDs.

## Data

This frontend has no database. Damage reports will come from the backend API in `cv-module/` once it's connected.
