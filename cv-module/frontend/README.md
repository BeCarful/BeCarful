# BeCarful — 3D Car Viewer (frontend)

A simple full-screen viewer showing a white Suzuki XL7 in 3D.

- Drag to orbit, scroll to zoom
- **Auto-rotate** on/off
- **Reset view** returns to the starting camera
- **Open / close doors** swings the front doors

Built with Next.js 16 (App Router, Turbopack), three.js through React Three Fiber, and Vitest.

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run lint
npm run format
npm run build
```

## Project layout

```
src/
├── app/                        # layout, page, global styles
├── components/car-viewer/
│   ├── car-viewer.tsx          # page shell: loads the 3D scene client-side + controls
│   ├── car-scene.tsx           # canvas, lighting, shadow, orbit camera
│   ├── car-model.tsx           # real .glb if configured, else the procedural car
│   ├── procedural-car.tsx      # body, cabin, glass, doors, wheels
│   ├── car-details.tsx         # lights, grille, mirrors, roof rails, cladding
│   ├── car-door.tsx            # animated front door
│   ├── car-wheel.tsx           # tire + rim
│   └── viewer-controls.tsx     # the three buttons
├── hooks/use-viewer-state.ts   # shared UI state
└── lib/car/                    # dimensions, materials, geometry builders
```

## Using a real car model

The car is currently built from three.js shapes using the real XL7's dimensions. To use a real model:

1. Put a `.glb` file in `public/models/`, for example `public/models/car.glb`. Check that its license allows your use.
2. In `src/lib/car/car-config.ts`, set `CAR_MODEL_URL = "/models/car.glb"`.

The loader scales the model to the XL7's length and stands it on the ground. It repaints the body white: first any material named like `paint` or `body`, otherwise the largest mesh. The **Open doors** button only works with the procedural car.

## Data

This frontend has no database. Data will come from the backend API in `cv-module/` once it's connected.
