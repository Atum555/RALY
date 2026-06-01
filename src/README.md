# Source layout

All application code and runtime assets (shaders, textures, models) live under
`src/`. `index.html` stays at the repository root and loads `src/main.js` as an
ES module; everything else is reached through relative `import`s and
document-relative asset URLs.

```
src/
├── main.js              # Entry point: wires CGFapplication + Scene + UI
├── Scene.js             # Root CGFscene — owns the world, update/render loop
├── UI.js                # dat.GUI dashboard + camera/keyboard interface
├── utils.js             # Shared math/helpers
│
├── core/                # Engine glue (CGF patches, custom materials, FPS counter)
├── lib/                 # Vendored WebCGF library + dat.GUI (do not edit by hand)
│
├── terrain/             # Heightmap terrain, path overlay, noise, tiles, shaders
├── sky/                 # Sky hemisphere + procedural cloud shader
├── lighting/            # Directional "sun", shadow map, lighting constants
├── grass/               # Wind-animated grass patches/blades + shaders
├── flowers/             # Parametric flowers (tulip, chrysanthemum) + L-system
├── obstacles/           # Rocks & hay bales (fields, meshes, shaders, textures)
├── barn/                # Barn model + delivery zone (components, shaders, textures)
├── wagon/               # Covered wagon + horse team (components, shaders, models)
├── gameplay/            # Game state: HP loop, scoring, collisions, pickups
└── textures/            # Shared/loose textures
```

## Conventions

A self-contained feature (e.g. `barn/`, `wagon/`, `obstacles/`) is a folder that
groups its own code and assets:

```
<feature>/
├── <Feature>.js        # Public class assembled into the Scene
├── components/         # Sub-parts of a hierarchical model
├── shaders/            # GLSL paired *.vert / *.frag
└── textures/ | models/ # Assets loaded by this feature
```

### Adding a new feature — worked example

1. Create `src/<feature>/<Feature>.js` exporting a class with `constructor(scene)`,
   an `update(dt)` (if animated) and a `display()` method, following the pattern in
   [barn/Barn.js](barn/Barn.js).
2. Put its GLSL under `src/<feature>/shaders/` and any images/models under
   `src/<feature>/textures/` or `src/<feature>/models/`.
3. **Asset URLs are resolved relative to `index.html` (the repo root), _not_ to the
   JS module.** Always include the `src/` prefix, e.g.
   `new CGFshader(gl, "src/<feature>/shaders/x.vert", "src/<feature>/shaders/x.frag")`.
   Module `import`s, by contrast, stay relative (`./`, `../`).
4. Instantiate it in [Scene.js](Scene.js) and call its `update`/`display` from the
   scene loop; expose any tunables through [UI.js](UI.js).
