import { Chrysantemum } from "./chrysantemum/Chrysantemum.js";
import { Tulip } from "./tulip/Tulip.js";
import { ValueNoise } from "../terrain/Noise.js";

// Procedural flower field scattered over the terrain's grass.
//
// Performance note: an L-system flower at full detail is hundreds of GL draws
// (a chrysanthemum at 4 iterations expands to ~120 draw symbols, and each
// flower symbol draws ten petals). One unique plant per scatter point is far
// too expensive, so the field keeps a tiny POOL of prototype flowers and reuses
// them at every point -- the matrix changes per draw, the geometry does not.
//
// Placement is deterministic: a cell grid is hashed so a given patch of ground
// always grows the same flowers, no popping or jitter as the wagon drives. A
// low-frequency value-noise density field gives the "some sparse, some in
// bunches" look -- high noise = dense clusters. A guaranteed base count per
// cell keeps the grass from ever going completely bare.
//
// There is no level-of-detail: every flower is drawn from the same single-tier
// prototype pool at a fixed geometry detail, so a flower never gains, sheds, or
// swaps detail as the wagon (and the chase camera that follows it) moves near.
// Flowers simply fade in/out at the draw radius; their look never changes.
export class FlowerField {
    constructor(scene, terrain) {
        this.scene = scene;
        this.terrain = terrain;

        this.enabled = true;

        // -- Scatter grid & density --
        // The field reads as broad flowering grass with denser bunches mixed in:
        // every grass cell grows at least base_per_cell flowers, and cells where
        // the density noise is high ramp up toward max_per_cell (a tight bunch).
        this.cell_size = 25; // world units per scatter cell
        this.base_per_cell = 4; // flowers every grass cell grows (broad coverage)
        this.max_per_cell = 12; // flowers a fully-saturated cell spawns (bunch density)
        this.density_scale = 0.004; // noise frequency: smaller = larger bunches
        this.density_bias = 0.45; // noise above this starts ramping toward a bunch
        this.grass_threshold = 0.85; // terrain path_dist above this counts as open grass

        // -- Draw reach (world units from the wagon) --
        // A single flat radius: every grass flower within it is drawn at full
        // detail, nothing beyond. No distance tiers, no distance thinning.
        this.draw_radius = 200;

        // Safety cap on flowers drawn per frame. Cells are visited nearest-first
        // so the cap, if ever hit, only trims the most distant flowers.
        this.draw_budget = 1200;

        // -- Size --
        this.base_scale = 1.7; // before per-flower jitter

        // Deterministic noise sources: one shapes the density patches, one drives
        // per-instance hashes (position jitter, rotation, scale, variant choice).
        this.density_noise = new ValueNoise(20260531);
        this.rng = new ValueNoise(1973);

        this.buildPrototypes();
    }

    // A small reused pool, built once at a single fixed detail. Every third
    // variant is a tulip, the rest chrysanthemums; each has its own colour.
    buildPrototypes() {
        this.POOL = 6;
        this.proto = [];
        for (let i = 0; i < this.POOL; i++) {
            this.proto.push(this.makeVariant(i));
        }
    }

    makeVariant(i) {
        const isTulip = i % 3 === 0;
        const f = isTulip ? new Tulip(this.scene) : new Chrysantemum(this.scene);
        f.iterations = 2;
        f.flower_petals = 8;
        if (!isTulip) f.flower_rings = 3;
        // At 2 iterations the L-system's internal scale (scaleFactor^(iter-1)) is
        // ~2.8x larger than at the showcase's 4 iterations, which would blow the
        // leaves up out of proportion with the bloom. Shrink them to compensate.
        f.leaf_scale = isTulip ? 1.2 : 0.8;
        f.init(); // rebuild the L-system + blooms at this detail
        return f;
    }

    // =====================================================
    // Normal visualization (delegated to every prototype)
    // =====================================================

    forEachProto(fn) {
        for (const f of this.proto) fn(f);
    }

    enableNormalViz() {
        this.forEachProto(f => f.enableNormalViz());
    }

    disableNormalViz() {
        this.forEachProto(f => f.disableNormalViz());
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        if (!this.enabled) return;

        const scene = this.scene;
        // Flowers are CGFappearance-based: draw them under the default shader with
        // the scene's flower light (set up in Scene.initFlowers).
        scene.setActiveShader(scene.defaultShader);
        scene.lights[0].update();

        // Centre the field on the wagon, like the terrain (the chase camera
        // follows it). World XZ; the terrain's model frame is (x, -z).
        const wx = scene.wagon ? scene.wagon.position_x : 0;
        const wz = scene.wagon ? scene.wagon.position_z : 0;

        const cs = this.cell_size;
        const reach = Math.ceil(this.draw_radius / cs);
        const wcx = Math.round(wx / cs);
        const wcz = Math.round(wz / cs);

        const count = { n: 0 };

        // Visit cells nearest-first (cached order) so the budget cap, when hit,
        // trims its most distant flowers rather than its nearest.
        const cells = this.cellOrder(reach);
        for (const [dx, dz] of cells) {
            if (count.n >= this.draw_budget) break;
            this.drawCell(wcx + dx, wcz + dz, wx, wz, count);
        }
    }

    // Offsets (dx, dz) of every cell within `reach`, sorted by distance from the
    // centre cell. Cached per reach value.
    cellOrder(reach) {
        if (this._cell_order_reach === reach) return this._cell_order;
        const cells = [];
        for (let dz = -reach; dz <= reach; dz++) {
            for (let dx = -reach; dx <= reach; dx++) cells.push([dx, dz]);
        }
        cells.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
        this._cell_order = cells;
        this._cell_order_reach = reach;
        return cells;
    }

    // Scatter and draw one cell's flowers, accumulating the global draw count
    // (mutated in place) against the per-frame budget.
    drawCell(cx, cz, wx, wz, count) {
        const cs = this.cell_size;
        const cell_x = cx * cs;
        const cell_z = cz * cs;

        // Density patch for this cell: low-frequency fBm. Every cell grows the
        // base count; above the bias the count ramps up toward max_per_cell so
        // some patches read as tight bunches.
        const dens = this.density_noise.fbm(cell_x * this.density_scale, cell_z * this.density_scale, 4);
        const strength = dens - this.density_bias;
        const denom = Math.max(0.05, 0.85 - this.density_bias);
        const extra = strength > 0
            ? Math.ceil((this.max_per_cell - this.base_per_cell) * Math.min(1, strength / denom))
            : 0;
        const count_in_cell = this.base_per_cell + extra;

        const terrain = this.terrain;
        const scene = this.scene;
        const half = terrain.half_extent;
        const H = this.rng;

        for (let k = 0; k < count_in_cell; k++) {
            if (count.n >= this.draw_budget) return;

            // Deterministic per-instance hashes in [0, 1].
            const hx = H.hash(cx * 7 + k * 101, cz * 13 + k * 131);
            const hz = H.hash(cx * 17 + k * 53, cz * 19 - k * 97);
            const hr = H.hash(cx * 23 - k * 61, cz * 29 + k * 89);
            const hs = H.hash(cx * 31 + k * 43, cz * 37 - k * 71);
            const hv = H.hash(cx * 41 - k * 59, cz * 43 + k * 67);

            const px = cell_x + (hx - 0.5) * cs;
            const pz = cell_z + (hz - 0.5) * cs;

            // Flat draw reach: cull anything past the radius, same detail inside.
            const dist = Math.hypot(px - wx, pz - wz);
            if (dist > this.draw_radius) continue;

            // Stay on the terrain and only on open grass (skip paths/clearing dirt).
            if (px < -half || px > half || pz < -half || pz > half) continue;
            const sample = terrain.sample_at_model(px, -pz); // reused scratch: read immediately
            if (sample.path_dist < this.grass_threshold) continue;

            const variant = Math.min(this.POOL - 1, (hv * this.POOL) | 0);
            const proto = this.proto[variant];
            const y = terrain.getHeightAt(px, pz);
            const scl = this.base_scale * (0.75 + hs * 0.6);

            scene.pushMatrix();
            scene.translate(px, y, pz);
            scene.rotate(hr * Math.PI * 2, 0, 1, 0);
            scene.scale(scl, scl, scl);
            proto.display();
            scene.popMatrix();

            count.n++;
        }
    }
}
