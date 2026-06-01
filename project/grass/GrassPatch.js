import { CGFshader } from "../../lib/CGF.js";
import { GrassBlade } from "./GrassBlade.js";
import { GrassCellMesh } from "./GrassCellMesh.js";
import { ValueNoise } from "../terrain/Noise.js";
import { TERRAIN_NEAR_SHADOW_RADIUS } from "../lighting/constants.js";

// Procedural grass scattered over the terrain's open grass, following the wagon.
//
// The field scatters small CLUMPS (a tuft of a few blades) gathered into BUNCHES:
// each cell seeds a couple of bunch centres and packs a hashed number of tufts
// tightly around each, denser in the core and thinning at the rim, so the meadow
// reads as "a bunch here, a bunch there" over bare ground rather than an even lawn
// of lone tufts. Bunches vary in size and density (the radius and tuft count are
// hashed per bunch).
//
// Performance: a tuft is tiny, but the field wants thousands of them, and one GL
// draw (plus a per-tuft uniform upload and a per-tuft terrain sample) per tuft
// every frame is the bottleneck. So a whole scatter CELL's tufts are baked once
// into a single merged world-space mesh and cached (GrassCellMesh): the meadow
// then costs one draw per populated cell -- a couple of hundred -- instead of one
// per tuft, and the scatter/terrain-sampling work happens once per cell as it
// first comes into reach, not every frame. The nearest-first tuft budget is kept
// at the cell level, so the lawn still fills the same nearest-tufts area as a
// per-tuft budget would, just drawn cell by cell. Cached cells the wagon has
// driven away from are evicted (their GL buffers freed) so memory stays bounded.
//
// Placement is deterministic, like the flower field: a fixed cell grid is hashed
// so a given patch of ground always grows the same bunches (no popping as the
// wagon drives), and each tuft sits at its own sampled terrain height with a
// random yaw. Coverage is limited to open grass with a soft edge: a tuft's
// keep-chance ramps from 0 on the path/dirt up to 1 out on open grass, so the
// lawn sparses off along path shoulders instead of stopping at a line.
//
// The grass shader receives the sun/moon and all three shadow maps (terrain,
// near, wagon), so the blades are shadowed by the terrain, the wagon and every
// other caster around them. The blades also cast into the near map (and only
// that one -- it follows the wagon, and the whole-terrain map is far too coarse
// to resolve a blade), via a depth pass with its own wind-bent depth shader, so
// the field drops crisp contact shadows on the ground and on itself.
export class GrassPatch {
    constructor(scene, terrain) {
        this.scene = scene;
        this.terrain = terrain;

        // -- Wind (exposed in the UI) --
        // The bend phase rides along uWindDir across the world, so the whole field
        // sways as one travelling wave. windSpatialFreq sets the wavelength: small
        // values (~0.08 -> ~80-unit waves) read as broad gusts rolling over the
        // meadow rather than fine ripples.
        this.windEnabled = true;
        this.windStrength = 0.5;
        this.windSpeed = 2.6;
        this.windSpatialFreq = 0.05;
        this.windDir = [0.944, 0.330]; // normalized world wind direction (XZ)
        this.windTime = 0;

        // -- Scatter grid: bunches of tufts --
        // Each cell seeds bunches_per_cell bunch centres at hashed positions, and
        // each bunch packs a hashed number of tufts (bunch_clumps_min..max) inside
        // a hashed radius (bunch_radius_min..max). Tufts cluster toward the bunch
        // core and thin at the rim, leaving bare ground between bunches.
        this.cell_size = 20;          // world units per scatter cell
        this.bunches_per_cell = 7;    // bunch centres a fully-grass cell seeds
        this.bunch_radius_min = 1.5;  // tight little bunch
        this.bunch_radius_max = 5.5;  // broad sprawling bunch
        this.bunch_clumps_min = 5;    // sparse bunch
        this.bunch_clumps_max = 25;   // dense bunch
        this.base_scale = 0.65;        // before per-tuft size jitter

        // -- Soft grass edge (terrain path_dist) --
        // path_dist is 0 on a path centerline and 1 out on open grass. A clump's
        // keep-chance ramps from 0 at grass_min (still essentially dirt) to 1 at
        // grass_full (open grass), so the field fades out across the shoulder
        // instead of ending in a hard block.
        this.grass_min = 0.45;
        this.grass_full = 0.85;

        // -- Draw reach (world units from the wagon) --
        // draw_radius is the search bound; draw_budget caps the tufts drawn per
        // frame. Cells are visited nearest-first, so the budget fills the nearest
        // cells solid and trims the most distant ones -- the grass stays dense
        // around the wagon and fades out at the budget frontier.
        this.draw_radius = 600;
        this.draw_budget = 150000;

        // Cap on cached cell meshes kept resident. The active set (cells inside the
        // budget frontier) is only a couple of hundred; the rest are cells the
        // wagon has driven past. When the cache outgrows this, the farthest cells
        // are evicted and their GL buffers freed.
        this.max_cached_cells = 3500;

        // (cx,cz) -> { mesh: GrassCellMesh|null, tufts, cx, cz }. mesh is null for a
        // cell that baked no tufts (all dirt/path), cached so it isn't re-scattered.
        this.cellCache = new Map();
        this._normalViz = false;

        // Set by ShadowMap.castGrass while the field is being rendered into the
        // near shadow map: display() then swaps in the depth shader below instead
        // of the lit one and emits only the bent silhouette.
        this._depth_pass = false;

        // Deterministic noise for per-clump hashes (position, yaw, scale, variant,
        // and the keep-chance dither at the grass edge).
        this.rng = new ValueNoise(80511);

        // Shadow-aware, wind-bent shader the grass is lit with. It receives the
        // sun/moon + all three shadow maps exactly like the terrain/flower shaders.
        this.shader = new CGFshader(scene.gl, "grass/shaders/grass.vert", "grass/shaders/grass.frag");
        this.shader.setUniformsValues({
            uTime: 0,
            uWindEnabled: 0,
            uWindStrength: this.windStrength,
            uWindSpeed: this.windSpeed,
            uWindSpatialFreq: this.windSpatialFreq,
            uWindDir: this.windDir,
        });

        // Depth-only twin of the lit shader, used when the field casts into the
        // near shadow map. It reproduces the same wind bend so the cast shadow
        // sways with the blade; it takes the same aBase attribute and wind uniforms
        // but writes no colour (the map captures hardware depth).
        this.depthShader = new CGFshader(scene.gl, "grass/shaders/grass_depth.vert", "grass/shaders/grass_depth.frag");
        this.depthShader.setUniformsValues({
            uTime: 0,
            uWindEnabled: 0,
            uWindStrength: this.windStrength,
            uWindSpeed: this.windSpeed,
            uWindSpatialFreq: this.windSpatialFreq,
            uWindDir: this.windDir,
        });

        this.buildClumps();
    }

    // =====================================================
    // Clump geometry
    // =====================================================

    // The blade prototypes a clump draws from. Taller and a touch wider than a
    // mown lawn so the sparse tufts still read as grass: GrassBlade(scene, slices,
    // height, width, depth, leanX, leanZ).
    buildBladePool() {
        const s = this.scene;
        return [
            new GrassBlade(s, 3, 1.6, 0.08, 0.04,  0.11,  0.04),
            new GrassBlade(s, 3, 2.0, 0.10, 0.05, -0.15,  0.07),
            new GrassBlade(s, 3, 2.7, 0.12, 0.06,  0.22, -0.11),
            new GrassBlade(s, 3, 3.5, 0.14, 0.07, -0.27,  0.14),
            new GrassBlade(s, 3, 4.2, 0.16, 0.08,  0.31,  0.18),
            new GrassBlade(s, 3, 2.7, 0.12, 0.06, -0.35,  0.04),
            new GrassBlade(s, 3, 3.5, 0.14, 0.07,  0.11, -0.22),
        ];
    }

    // One tuft layout per variant: how many blades, how wide the bunch, and which
    // blade prototypes fill it (mixing short and tall blades).
    static CLUMP_TYPES = [
        { count: 5, radius: 0.10, blades: [0, 1, 2, 2, 3] },
        { count: 6, radius: 0.12, blades: [1, 2, 3, 3, 4, 4] },
        { count: 7, radius: 0.13, blades: [0, 1, 2, 3, 3, 4, 5] },
        { count: 6, radius: 0.11, blades: [2, 3, 4, 4, 5, 6] },
        { count: 8, radius: 0.14, blades: [1, 2, 3, 4, 4, 5, 6, 6] },
    ];

    // Bake each clump variant once into raw vertex/normal/index arrays in local
    // space (blades grow up +Y, tuft centred on the origin). These are the
    // prototypes the cell baker stamps into world space at each scatter point; the
    // randomness here only shapes the variant, which one a point uses is hashed
    // deterministically, so the meadow never pops as the wagon moves.
    buildClumps() {
        this.bladePool = this.buildBladePool();
        this.POOL = GrassPatch.CLUMP_TYPES.length;
        this.clumpGeom = GrassPatch.CLUMP_TYPES.map((type) => this.buildClumpGeometry(type));
    }

    buildClumpGeometry(type) {
        const verts = [];
        const idxs = [];
        const norms = [];
        let vertexOffset = 0;

        const angleOffset = Math.random() * Math.PI * 2;

        for (let bladeIdx = 0; bladeIdx < type.count; bladeIdx++) {
            const angle = angleOffset + (bladeIdx / type.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const radius = type.radius + (Math.random() - 0.5) * 0.03;
            const poolIdx = type.blades[bladeIdx % type.blades.length];
            const bunchX = Math.cos(angle) * radius;
            const bunchZ = Math.sin(angle) * radius;
            const bladeRot = (Math.random() - 0.5) * 0.5;
            const cosB = Math.cos(bladeRot), sinB = Math.sin(bladeRot);

            const blade = this.bladePool[poolIdx];

            for (let v = 0; v < blade.vertices.length; v += 3) {
                const px = blade.vertices[v], py = blade.vertices[v + 1], pz = blade.vertices[v + 2];
                const rx = px * cosB - pz * sinB;
                const rz = px * sinB + pz * cosB;
                verts.push(rx + bunchX, py, rz + bunchZ);
            }

            for (let n = 0; n < blade.normals.length; n += 3) {
                const nx = blade.normals[n], ny = blade.normals[n + 1], nz = blade.normals[n + 2];
                const rnx = nx * cosB - nz * sinB;
                const rnz = nx * sinB + nz * cosB;
                norms.push(rnx, ny, rnz);
            }

            for (let i = 0; i < blade.indices.length; i++) {
                idxs.push(blade.indices[i] + vertexOffset);
            }

            vertexOffset += blade.vertices.length / 3;
        }

        return { vertices: verts, normals: norms, indices: idxs };
    }

    // =====================================================
    // Cell baking (deterministic; independent of the wagon)
    // =====================================================

    cellKey(cx, cz) {
        return cx + "," + cz;
    }

    // Get a cell's baked mesh from the cache, baking and caching it on first reach.
    getCell(cx, cz) {
        const key = this.cellKey(cx, cz);
        let entry = this.cellCache.get(key);
        if (entry === undefined) {
            entry = this.buildCell(cx, cz);
            this.cellCache.set(key, entry);
            if (entry.mesh && this._normalViz) entry.mesh.enableNormalViz();
        }
        return entry;
    }

    // Scatter one cell's bunches deterministically and merge every surviving tuft
    // into a single world-space mesh. This is purely a function of (cx, cz) -- it
    // never reads the wagon -- so a cell is baked once and reused for the life of
    // the cache. Returns { mesh, tufts, cx, cz } (mesh null if the cell is bare).
    buildCell(cx, cz) {
        const cs = this.cell_size;
        const cell_x = cx * cs;
        const cell_z = cz * cs;

        const terrain = this.terrain;
        const half = terrain.half_extent;
        const H = this.rng;
        const fade = this.grass_full - this.grass_min || 1;

        const verts = [];
        const norms = [];
        const idxs = [];
        const bases = [];
        let vertexOffset = 0;
        let tufts = 0;

        for (let b = 0; b < this.bunches_per_cell; b++) {
            // Per-bunch hashes: where the bunch sits in the cell, how wide it
            // spreads and how many tufts pack into it -- so some bunches come out
            // big and dense, others small and sparse, with bare ground between.
            const bhx = H.hash(cx * 71 + b * 911, cz * 87 - b * 277);
            const bhz = H.hash(cx * 53 - b * 613, cz * 97 + b * 401);
            const bhr = H.hash(cx * 113 + b * 197, cz * 131 + b * 509);
            const bhn = H.hash(cx * 149 - b * 331, cz * 167 + b * 233);

            const bcx = cell_x + (bhx - 0.5) * cs;
            const bcz = cell_z + (bhz - 0.5) * cs;
            const radius = this.bunch_radius_min + bhr * (this.bunch_radius_max - this.bunch_radius_min);
            const nclumps = this.bunch_clumps_min + ((bhn * (this.bunch_clumps_max - this.bunch_clumps_min + 1)) | 0);

            for (let k = 0; k < nclumps; k++) {
                // Per-tuft hashes within the bunch.
                const ha = H.hash(cx * 7 + b * 31 + k * 101, cz * 13 - b * 29 + k * 131);
                const hd = H.hash(cx * 17 - b * 37 + k * 53, cz * 19 + b * 41 + k * 97);
                const hr = H.hash(cx * 23 + b * 43 + k * 61, cz * 29 - b * 47 + k * 89);
                const hs = H.hash(cx * 31 - b * 53 + k * 43, cz * 37 + b * 59 + k * 71);
                const hv = H.hash(cx * 41 + b * 61 + k * 59, cz * 43 - b * 67 + k * 67);

                // Cluster tufts toward the bunch core: squaring the radius fraction
                // packs more of them near the centre and feathers the rim.
                const ang = ha * Math.PI * 2;
                const rr = hd * hd * radius;
                const px = bcx + Math.cos(ang) * rr;
                const pz = bcz + Math.sin(ang) * rr;

                // Stay on the terrain.
                if (px < -half || px > half || pz < -half || pz > half) continue;

                // Soft grass edge: keep-chance ramps 0 -> 1 across the shoulder, so
                // the grass thins out grain by grain toward a path, not in blocks.
                const sample = terrain.sample_at_model(px, -pz); // reused scratch: read immediately
                const keep = (sample.path_dist - this.grass_min) / fade;
                if (keep <= 0 || hd > keep) continue;

                const variant = Math.min(this.POOL - 1, (hv * this.POOL) | 0);
                const y = terrain.getHeightAt(px, pz);
                const scl = this.base_scale * (0.8 + hs * 0.5);
                const yaw = hr * Math.PI * 2;

                vertexOffset = this.stampTuft(variant, px, pz, y, scl, yaw, verts, norms, idxs, bases, vertexOffset);
                tufts++;
            }
        }

        if (idxs.length === 0) return { mesh: null, tufts: 0, cx, cz };
        const mesh = new GrassCellMesh(this.scene, verts, norms, idxs, bases);
        return { mesh, tufts, cx, cz };
    }

    // Stamp one tuft (a clump-variant prototype) into the cell's merged arrays in
    // WORLD space: scale, yaw and world offset are baked into the positions; the
    // vertex Y stays the LOCAL blade height (so the shader can drive the wind bend
    // and root shading), and the tuft's ground height goes into the parallel bases
    // array (added back as aBase in the shader). Returns the new vertex offset.
    stampTuft(variant, px, pz, groundY, scl, yaw, verts, norms, idxs, bases, vertexOffset) {
        const g = this.clumpGeom[variant];
        const v = g.vertices, n = g.normals, ix = g.indices;
        const cosY = Math.cos(yaw), sinY = Math.sin(yaw);

        for (let i = 0; i < v.length; i += 3) {
            const lx = v[i] * scl, ly = v[i + 1] * scl, lz = v[i + 2] * scl;
            const rx = lx * cosY - lz * sinY;
            const rz = lx * sinY + lz * cosY;
            verts.push(px + rx, ly, pz + rz); // world XZ; Y = scaled local blade height
            bases.push(groundY);
        }

        for (let i = 0; i < n.length; i += 3) {
            const nx = n[i], ny = n[i + 1], nz = n[i + 2];
            const rnx = nx * cosY - nz * sinY;
            const rnz = nx * sinY + nz * cosY;
            norms.push(rnx, ny, rnz); // uniform scale leaves the (yaw-rotated) normal unit-length
        }

        for (let i = 0; i < ix.length; i++) idxs.push(ix[i] + vertexOffset);
        return vertexOffset + v.length / 3;
    }

    // =====================================================
    // Normal visualization (delegated to the live cell meshes)
    // =====================================================

    enableNormalViz() {
        this._normalViz = true;
        for (const entry of this.cellCache.values()) if (entry.mesh) entry.mesh.enableNormalViz();
    }

    disableNormalViz() {
        this._normalViz = false;
        for (const entry of this.cellCache.values()) if (entry.mesh) entry.mesh.disableNormalViz();
    }

    // =====================================================
    // Update / Display
    // =====================================================

    update(deltaTime) {
        if (this.windEnabled) {
            this.windTime += deltaTime * 0.001;
        }
    }

    display() {
        const scene = this.scene;
        const depth = this._depth_pass;

        // Depth pass (ShadowMap.castGrass): swap in the depth-only twin and feed it
        // this frame's wind state so the cast shadow bends with the blade. No
        // shadow-map uniforms -- the grass only casts here, it does not receive.
        // Main pass: bind the lit grass shader and feed it the wind state plus the
        // scene's sun/moon + shadow-map uniforms. Either way the uniforms are
        // identical for every cell, so they're set once here; the cell meshes carry
        // their own world geometry, so there are no per-cell uniforms in the loop.
        const shader = depth ? this.depthShader : this.shader;
        scene.setActiveShader(shader);
        shader.setUniformsValues({
            uTime: this.windTime,
            uWindEnabled: this.windEnabled ? 1 : 0,
            uWindStrength: this.windStrength,
            uWindSpeed: this.windSpeed,
            uWindSpatialFreq: this.windSpatialFreq,
            uWindDir: this.windDir,
        });
        if (!depth) {
            const sm = scene.shadow_map;
            if (sm) {
                if (sm.enabled) sm.applyUniforms(this.shader);
                else sm.disable(this.shader);
            }
        }

        // Centre the grid on the wagon, like the terrain and the flower field (the
        // chase camera follows it). World XZ; the terrain's model frame is (x, -z).
        const wx = scene.wagon ? scene.wagon.position_x : 0;
        const wz = scene.wagon ? scene.wagon.position_z : 0;

        // The depth pass only needs the cells that can drop a shadow onto the near
        // map's footprint, so it draws a tighter ring (the near radius plus a margin
        // for the short shadows a blade just outside the edge casts inward); the lit
        // pass draws out to the full visible reach.
        const cs = this.cell_size;
        const draw_radius = depth ? TERRAIN_NEAR_SHADOW_RADIUS + 4 * cs : this.draw_radius;
        const reach = Math.ceil(draw_radius / cs);
        const wcx = Math.round(wx / cs);
        const wcz = Math.round(wz / cs);
        const radius2 = draw_radius * draw_radius;

        // Visit cells nearest-first (cached order) and draw whole cells until the
        // tuft budget is spent, so the nearest cells fill solid and the field fades
        // out at the budget frontier -- the same nearest-tufts coverage a per-tuft
        // budget gave, now one draw per cell instead of one per tuft.
        let drawn = 0;
        const cells = this.cellOrder(reach);
        for (const [dx, dz] of cells) {
            if (drawn >= this.draw_budget) break;
            const cx = wcx + dx, cz = wcz + dz;

            // Search bound: skip cells whose centre is past the draw radius.
            const ddx = cx * cs - wx, ddz = cz * cs - wz;
            if (ddx * ddx + ddz * ddz > radius2) continue;

            const entry = this.getCell(cx, cz);
            if (entry.mesh) {
                entry.mesh.display();
                drawn += entry.tufts;
            }
        }

        // The depth pass leaves the active shader for ShadowMap.castGrass to restore
        // (more casters follow it into the same map); only the main pass resets to
        // the default shader and ages out distant cached cells.
        if (!depth) {
            scene.setActiveShader(scene.defaultShader);
            this.evictDistantCells(wx, wz);
        }
    }

    // Keep the cache bounded: once it outgrows max_cached_cells, drop the cells
    // farthest from the wagon (freeing their GL buffers) back down to the cap.
    // Only fires when the cap is exceeded, so a stationary wagon never re-bakes.
    evictDistantCells(wx, wz) {
        if (this.cellCache.size <= this.max_cached_cells) return;
        const cs = this.cell_size;
        const scored = [];
        for (const [key, entry] of this.cellCache) {
            const dx = entry.cx * cs - wx, dz = entry.cz * cs - wz;
            scored.push([key, entry, dx * dx + dz * dz]);
        }
        scored.sort((a, b) => b[2] - a[2]); // farthest first
        const target = Math.floor(this.max_cached_cells * 0.8);
        for (let i = 0; i < scored.length && this.cellCache.size > target; i++) {
            const [key, entry] = scored[i];
            if (entry.mesh) entry.mesh.dispose();
            this.cellCache.delete(key);
        }
    }

    // Offsets (dx, dz) of every cell within `reach`, sorted by distance from the
    // centre cell. Cached per reach value: the depth pass (near footprint) and the
    // lit pass (full draw reach) ask for different reaches every frame, so both are
    // kept rather than recomputed and re-sorted as the two passes alternate.
    cellOrder(reach) {
        if (!this._cell_order) this._cell_order = new Map();
        let cells = this._cell_order.get(reach);
        if (cells) return cells;
        cells = [];
        for (let dz = -reach; dz <= reach; dz++) {
            for (let dx = -reach; dx <= reach; dx++) cells.push([dx, dz]);
        }
        cells.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
        this._cell_order.set(reach, cells);
        return cells;
    }
}
