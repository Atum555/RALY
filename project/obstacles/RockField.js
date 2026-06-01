import { CGFobject } from "../../lib/CGF.js";
import { Rock } from "./Rock.js";
import { ShadowedTexturedMaterial } from "../core/ShadowedTexturedMaterial.js";

// -- Scatter tuning (all tunable) -------------------------------------------
// How many rocks to place. A heavy scatter that reads as a genuine rock field
// rather than the occasional boulder.
const ROCK_COUNT = 1500;
// Candidates are sampled in a square around the origin of this half-size
// (world units). Kept well inside the 10000-unit terrain: it covers the area
// the wagon actually drives through (where the path network lives) without
// spending placements on the distant mountains the player never reaches.
const ROCK_FIELD_HALF_EXTENT = 3000;
// Safety cap so rejection sampling can't spin forever if almost every
// candidate lands on the flat path or in the clearing.
const ROCK_MAX_ATTEMPTS = ROCK_COUNT * 60;
// Distinct Rock silhouettes reused across every placement. A wider pool keeps
// the dense field from looking like a few cloned shapes while keeping the
// buffer/draw-call count low.
const ROCK_POOL_SIZE = 8;
// Extra clear ring kept around the barn clearing (beyond its flat radius) so no
// rock crowds the central pad.
const ROCK_CLEARING_MARGIN = 60;
// Per-instance scale range (multiplier on the base Rock size). Larger boulders
// than before, with a wide spread so the field mixes pebbly stones and big rocks.
const ROCK_SCALE_MIN = 1.6;
const ROCK_SCALE_MAX = 5.0;
// Fraction of a rock's (scaled) radius to sink into the ground so its base
// isn't floating on a slope.
const ROCK_SINK_FRACTION = 0.35;

// -- Level of detail --------------------------------------------------------
// Each pooled rock is built at three resolutions sharing one silhouette (same
// per-axis stretch + the position-deterministic fbm), so a far rock is the same
// shape as a near one with far fewer triangles. LOD 0 is the close-up mesh, 2
// the cheapest; the shadow depth passes always use the cheap levels.
const ROCK_LODS = [
    { slices: 14, stacks: 14 }, // 0 - near, full detail
    { slices: 9, stacks: 8 },   // 1 - mid
    { slices: 6, stacks: 5 },   // 2 - far / shadow casts
];
// Main-pass LOD thresholds: horizontal distance from the camera (world units).
// Inside HIGH -> LOD 0, inside MED -> LOD 1, beyond -> LOD 2.
const ROCK_LOD_DIST_HIGH = 250;
const ROCK_LOD_DIST_MED = 750;

/**
 * RockField
 *
 * Scatters the Rock obstacle densely across the open ground: only on grass and
 * the dirt path *shoulders*, never on the flat drivable path centre and never on
 * the central barn clearing. Placements are generated once from a seeded RNG (so
 * they're stable within a run) by rejection-sampling candidates against the same
 * path-network / clearing math the terrain itself uses, and each surviving
 * candidate sits on the ground via terrain.getHeightAt(). A small pool of Rock
 * meshes -- each built at several LOD resolutions -- is reused for every
 * placement, drawn under a single shadow-aware material activation so the whole
 * field costs one shader switch (mirroring the hay-bale batching).
 *
 * The rocks both receive shadows (a textured, terrain/wagon-shadowed shader, the
 * same maps as the bales and wagon body) and cast them: the field emits its
 * geometry into the whole-terrain and near terrain shadow maps via displayDepth().
 *
 * @constructor
 * @param scene - Reference to the Scene object
 */
export class RockField extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        this.terrain = scene.terrain;

        // Pool of distinct rock silhouettes, each as an array of LOD meshes that
        // share one shape (sx/sy/sz fixed per pool entry, passed into every level).
        this.rocks = [];
        for (let i = 0; i < ROCK_POOL_SIZE; i++) {
            const sx = 1.0 + Math.random() * 0.5;
            const sy = 1.0 + Math.random() * 0.5;
            const sz = 1.0 + Math.random() * 0.5;
            const lods = ROCK_LODS.map((lod) =>
                new Rock(scene, { slices: lod.slices, stacks: lod.stacks, sx, sy, sz, skipMaterial: true }),
            );
            this.rocks.push(lods);
        }
        // Any LOD mesh's radius stands in (all are 1) for the ground-sink math.
        this.radius = this.rocks[0][0].radius;

        // Textured, shadow-aware appearance shared by the whole field: its
        // u_rock_texture sampler reads unit 0, and apply() feeds the shader the
        // scene's sun + shadow-map uniforms (same maps as the bales/wagon body).
        this.material = new ShadowedTexturedMaterial(
            scene,
            "obstacles/textures/rock.jpg",
            "obstacles/shaders/rock.vert",
            "obstacles/shaders/rock.frag",
            "u_rock_texture",
        );

        this.generatePlacements();
    }

    // =====================================================
    // Placement generation
    // =====================================================

    // Rejection-sample world positions until ROCK_COUNT are kept or the attempt
    // cap is hit. A candidate is kept only where the ground is grass or a path
    // shoulder (never the flat path centre) and clear of the barn clearing. Each
    // kept placement records its world (x, z), a pooled silhouette index, a
    // per-instance scale and a yaw, so display() is a cheap replay.
    generatePlacements() {
        const terrain = this.terrain;

        // Seed off the path seed so the scatter is deterministic within a run and
        // reshuffles when the terrain/paths are regenerated. A distinct mix keeps
        // it independent of the path network's own RNG stream.
        const rand = mulberry32((terrain.terrain_path_seed ^ 0x52ad1e1d) >>> 0);

        // The dirt/grass split the terrain shader and clearing use: path_dist
        // below this is the flat drivable strip (reject), at or above it is the
        // shoulder/grass blend (keep).
        const dirt_edge =
            terrain.terrain_path_width / (terrain.terrain_path_width + terrain.terrain_path_shoulder);
        const path_reach = terrain.path_network.reach || 1;

        // Keep candidates clear of the central barn clearing (its flat pad plus a
        // margin), measured from the origin in world space.
        const clear_radius = terrain.terrain_clearing_flat_radius + ROCK_CLEARING_MARGIN;
        const clear_radius2 = clear_radius * clear_radius;

        // Don't sample past the actual terrain edge.
        const reach = Math.min(ROCK_FIELD_HALF_EXTENT, terrain.half_extent);

        this.placements = [];
        let attempts = 0;
        while (this.placements.length < ROCK_COUNT && attempts < ROCK_MAX_ATTEMPTS) {
            attempts++;

            const x = (rand() * 2 - 1) * reach;
            const z = (rand() * 2 - 1) * reach;

            // Skip the barn clearing (and its margin) entirely.
            if (x * x + z * z < clear_radius2) continue;

            // Classify against the path network in model space: world x -> model
            // x, world z -> -model y, matching getHeightAt's frame.
            const q = terrain.path_network.query(x, -z);
            const path_dist = Math.min(1, q.dist / path_reach);

            // Reject the flat drivable path centre; keep shoulder + open grass.
            if (path_dist < dirt_edge) continue;

            this.placements.push({
                x,
                z,
                // The ground is static, so snap onto it once here rather than
                // calling getHeightAt for every rock in every (lit + depth) pass.
                y: terrain.getHeightAt(x, z),
                mesh_index: (rand() * ROCK_POOL_SIZE) | 0,
                scale: ROCK_SCALE_MIN + rand() * (ROCK_SCALE_MAX - ROCK_SCALE_MIN),
                rot_y: rand() * Math.PI * 2,
            });
        }
    }

    // =====================================================
    // Display
    // =====================================================

    // Draw every placement (main pass). Rocks are drawn in world space (the
    // terrain's -90deg X rotation has already been popped by the caller), so each
    // one is positioned at world (x, getHeightAt(x, z), z), spun about the world
    // up axis and uniformly scaled. The shared shadow-aware material is activated
    // once up front and each instance's geometry is emitted under it, so the whole
    // field costs a single shader/appearance switch. Each instance picks a LOD by
    // its distance to the camera, so far rocks use far fewer triangles.
    display() {
        // Activate the shadowed rock shader + bind the rock texture once for the
        // batch (uploads the sun/shadow uniforms too).
        this.material.apply();
        this.emit(null, null);
    }

    // Emit the field's geometry into the currently bound depth map, under the
    // active depth shader and light camera. No material activation (the depth
    // shader stands). `lod` forces a single LOD level (the cheap levels for the
    // casts); `cull` ({ x, z, r }) skips rocks whose horizontal distance from
    // (x, z) exceeds r, so the wagon-following near map only draws nearby rocks.
    displayDepth(cull, lod) {
        this.emit(cull, lod);
    }

    // Shared replay used by both the lit pass and the depth passes. With
    // `force_lod` null the LOD is chosen per instance from the camera distance;
    // otherwise every instance is drawn at `force_lod`. `cull` optionally skips
    // distant instances (see displayDepth).
    emit(cull, force_lod) {
        const scene = this.scene;
        const cam = scene.camera ? scene.camera.position : null;
        const cull_r2 = cull ? cull.r * cull.r : 0;

        for (let p = 0; p < this.placements.length; p++) {
            const placement = this.placements[p];

            if (cull) {
                const dx = placement.x - cull.x;
                const dz = placement.z - cull.z;
                if (dx * dx + dz * dz > cull_r2) continue;
            }

            // Pick the LOD: forced for the depth passes, else by camera distance.
            let lod = force_lod;
            if (lod == null) {
                lod = 2;
                if (cam) {
                    const dx = placement.x - cam[0];
                    const dz = placement.z - cam[2];
                    const d2 = dx * dx + dz * dz;
                    if (d2 < ROCK_LOD_DIST_HIGH * ROCK_LOD_DIST_HIGH) lod = 0;
                    else if (d2 < ROCK_LOD_DIST_MED * ROCK_LOD_DIST_MED) lod = 1;
                }
            }
            const rock = this.rocks[placement.mesh_index][lod];

            // Sink the base slightly so the rock beds into the ground instead of
            // perching on it. Rock's radius is 1, so the sink is a fraction of the
            // scaled radius.
            const sink = this.radius * placement.scale * ROCK_SINK_FRACTION;

            scene.pushMatrix();
            scene.translate(placement.x, placement.y - sink, placement.z);
            scene.rotate(placement.rot_y, 0, 1, 0);
            scene.scale(placement.scale, placement.scale, placement.scale);
            // Emit just the geometry under the already-active shader, the way
            // HayBale.displayShape() does for a batch of bales.
            CGFobject.prototype.display.call(rock);
            scene.popMatrix();
        }
    }

    // =====================================================
    // Normal visualization
    // =====================================================

    enableNormalViz() {
        for (const lods of this.rocks) for (const rock of lods) rock.enableNormalViz();
    }

    disableNormalViz() {
        for (const lods of this.rocks) for (const rock of lods) rock.disableNormalViz();
    }
}

// Small, fast seeded PRNG (mulberry32) -> a deterministic scatter per seed,
// matching the generator the path network uses.
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
