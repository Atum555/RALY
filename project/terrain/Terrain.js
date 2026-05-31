import { CGFshader, CGFtexture } from "../../lib/CGF.js";
import { ValueNoise } from "./Noise.js";
import { PathNetwork } from "./Path.js";
import { TerrainTile } from "./TerrainTile.js";
import { CGFGroup } from "../core/CGFGroup.js";
import { ShadowMap } from "./ShadowMap.js";
import { hexToRGB } from "../utils.js";
import {
    MAX_COMPONENT_SUBDIVISIONS,
    MAX_PATH_NODES,
    LOD_MIN_SPLIT_FACTOR,
    LOD_OFF_DEPTH,
    MIN_NODE_CACHE,
    TEX_REPEAT,
    PARALLAX_SCALE,
    PARALLAX_NEAR,
    PARALLAX_FAR,
} from "./constants.js";

export class Terrain extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        // -- Target terrain extent --
        // The actual ("effective") extent is rounded up from this to
        // the nearest power-of-two multiple of the tile size so a
        // single quadtree root can cover it; see initHeightField.
        this.terrain_size = 10000;

        // -- Procedural height field (the single source of truth) --
        // The vertical scale of the peaks ramps with distance from the world
        // origin across three levels: gentle near the centre (where the wagon
        // starts), a mid level halfway out, and tallest at the terrain edge, so
        // distant mountains loom while the start area stays calm. The two
        // segments (origin->mid, mid->edge) are interpolated linearly. See
        // height_scale_at in initHeightField.
        this.terrain_noise_seed = Math.floor(Math.random() * 9999) + 1; // random terrain each run (1–9999)
        this.terrain_min_height = 10; // peak scale at the world origin, in world units
        this.terrain_mid_height = 75; // peak scale at the mid radius
        this.terrain_max_height = 1200; // peak scale at the terrain edge
        this.terrain_mid_radius = 0.35; // fraction of the half-extent at which terrain_mid_height is reached
        this.terrain_noise_scale = 0.0025; // smaller = larger, smoother features
        this.terrain_noise_octaves = 12; // layers of detail summed by the fBm

        // -- Level of detail (LODs - quadtree) --
        // A single quadtree root splits toward the wagon: coarse far away, fine
        // near it. terrain_lod_tile_size sets the leaf size; terrain_lod_detail_density
        // sets mesh resolution (vertices per 100 world units, capped Uint16-safe). LOD depth is derived
        // so the root covers the target size. Nodes build on demand, so only the
        // wagon's neighborhood holds fine meshes.
        this.terrain_lod_enabled = true;
        this.terrain_lod_tile_size = 100; // world units; side of the leaf tiles
        this.terrain_lod_detail_density = 40; // mesh vertices per 100 world units across a leaf tile
        this.terrain_lod_split_factor = 2.2; // larger = fine detail reaches further from the wagon

        // -- Procedural dirt paths --
        // A trail network is carved into the height field: scattered points of
        // interest are connected by A* routes that hug gentle grades, then the
        // ground is flattened along them. Because paths edit the shared height
        // field, the rendered mesh and collision (getHeightAt) agree, so the
        // wagon drives on them automatically.
        this.terrain_paths_enabled = true;
        this.terrain_path_seed = Math.floor(Math.random() * 9999) + 1; // random path each run (1–9999)
        this.terrain_path_node_density = 3; // POIs per 1,000,000 world units^2
        this.terrain_path_width = 12; // half-width of the fully-flat strip, world units
        this.terrain_path_shoulder = 25; // falloff width blending back to natural ground
        this.terrain_path_smoothing = 9; // centerline smoothing window (vertices each side)
        this.terrain_path_slope_weight = 45; // how strongly paths avoid slopes (higher = flatter, windier)

        // -- Central clearing --
        // A levelled, dirt-covered circular pad at the world origin so a structure
        // placed there (the barn) rests on calm, drivable ground covered in the
        // path material. The flatness and the dirt texture have *independent* radii:
        // inside terrain_clearing_flat_radius the natural height variation is scaled
        // down toward the pad's centre height by terrain_clearing_flatness (0 = dead
        // flat, 1 = untouched), so the ground gently settles rather than becoming a
        // pancake; inside terrain_clearing_texture_radius the surface is rendered as
        // full dirt. Each effect blends back to the natural ground across
        // terrain_clearing_shoulder. Because the clearing edits the same shared
        // height field as the paths, collision (getHeightAt) and the rendered mesh
        // agree, exactly like the paths.
        this.terrain_clearing_enabled = true;
        this.terrain_clearing_flat_radius = 150; // radius of the levelled zone, world units
        this.terrain_clearing_texture_radius = 200; // radius of the full-dirt zone, world units
        this.terrain_clearing_flatness = 0.4; // height-variation scale inside the flat zone (0 = flat, 1 = natural)
        this.terrain_clearing_shoulder = 200; // falloff width blending each effect back to natural ground

        // -- Distance fog --
        // Distant terrain fades into the sky's horizon colour over the
        // fog_start..fog_end band (view-space distance, in terrain units). The fog
        // colour is not stored here: it is read each frame from the SkySphere so
        // it tracks the day/night cycle (see display()).
        this.fog_enabled = true;
        this.fog_start = 0; // no fog nearer than this
        this.fog_end = 6500; // terrain fully dissolved into the horizon beyond this

        // Derived from the above in initHeightField, exposed read-only in the UI:
        this.lod_levels = 1; // number of LOD tile sizes (doublings from leaf to root)
        this.effective_size = this.terrain_size; // actual extent the single root tile spans
        this.effective_tile_subdivisions = 1; // per-node grid from terrain_lod_detail_density + terrain_lod_tile_size
        this.effective_path_count = 0; // POI count from terrain_path_node_density + terrain area

        // -- Sun-cast shadows --
        // Only the terrain casts and receives shadows, only from the abstract sun
        // (the same SUN_WORLD_DIR the shader lights with -- not the CGF Sun/Moon
        // lights). Cascaded shadow maps centred on the wagon give the sharpest
        // shadows where the wagon is and coarser ones toward the horizon.
        this.shadows_enabled = true;

        this.initHeightField();
        this.initTextures();
        this.initShaders();
    }

    initHeightField() {
        // -- Derive the quadtree shape from the direct controls --
        // A leaf tile is terrain_lod_tile_size across; detail_density gives its
        // subdivision count as vertices per 100 world units. Every node reuses
        // that count. lod_levels is derived below so the root tile grows to cover
        // the requested terrain_size; everything downstream uses that effective
        // extent. Nodes are meshed lazily in display(), not here.
        const leaf_size = Math.max(1, this.terrain_lod_tile_size);

        // Forced even so each edge has a midpoint vertex: edge stitching keeps a
        // fine tile's shared edge aligned with its coarser neighbor by dropping
        // every other vertex, which only lands cleanly on an even grid.
        let leaf_subdivisions = Math.round((leaf_size * this.terrain_lod_detail_density) / 100);
        leaf_subdivisions -= leaf_subdivisions % 2;
        this.effective_tile_subdivisions = Math.max(
            2,
            Math.min(MAX_COMPONENT_SUBDIVISIONS - (MAX_COMPONENT_SUBDIVISIONS % 2), leaf_subdivisions),
        );

        this.max_depth = Math.max(0, Math.ceil(Math.log2(Math.max(1, this.terrain_size) / leaf_size)));
        this.lod_levels = this.max_depth + 1;
        this.effective_size = leaf_size * Math.pow(2, this.max_depth);

        // A single quadtree root, centred on the origin, spans the effective
        // terrain.
        this.half_extent = this.effective_size / 2.0;

        // Finest patch (= terrain_lod_tile_size / effective_tile_subdivisions), so getHeightAt's
        // bilinear sampling matches the finest rendered surface the wagon drives on.
        this.patch = leaf_size / this.effective_tile_subdivisions;
        this.effective_subdivisions = Math.round(this.effective_size / this.patch);

        // Reseed so UI changes to seed/scale/etc. take effect on rebuild.
        this.noise = new ValueNoise(this.terrain_noise_seed);

        // Peak scale as a function of position, across three levels: terrain_min_height at
        // the origin, terrain_mid_height at the mid radius (terrain_mid_radius * the half-extent),
        // and terrain_max_height at the terrain edge (the half-extent), held there for the
        // corners beyond it. The two segments are interpolated linearly, joining
        // continuously at the mid radius.
        this.height_scale_at = (mx, my) => {
            const t = Math.min(1, Math.hypot(mx, my) / this.half_extent);
            const r = Math.min(Math.max(this.terrain_mid_radius, 0.01), 0.99);
            return t < r
                ? this.terrain_min_height + (this.terrain_mid_height - this.terrain_min_height) * (t / r)
                : this.terrain_mid_height + (this.terrain_max_height - this.terrain_mid_height) * ((t - r) / (1 - r));
        };

        // Raw, un-pathed terrain elevation. The path network samples this to
        // decide what height to flatten each path toward.
        this.natural_height_at_model = (mx, my) =>
            this.noise.fbm(mx * this.terrain_noise_scale, my * this.terrain_noise_scale, this.terrain_noise_octaves) *
            this.height_scale_at(mx, my);

        // Points of interest scale with the terrain area to hold trail spacing
        // constant: density is per 1,000,000 world units^2, capped for A* cost.
        this.effective_path_count = Math.min(
            MAX_PATH_NODES,
            Math.round((this.terrain_path_node_density * this.effective_size * this.effective_size) / 1e6),
        );

        // (Re)build the procedural path network from the current natural ground.
        this.path_network = new PathNetwork({
            size: this.effective_size,
            seed: this.terrain_path_seed,
            num_nodes: this.terrain_paths_enabled ? this.effective_path_count : 0,
            half_width: this.terrain_path_width,
            shoulder: this.terrain_path_shoulder,
            smoothing: this.terrain_path_smoothing,
            slope_weight: this.terrain_path_slope_weight,
            natural_height_at: this.natural_height_at_model,
        });

        // Central clearing: a levelled dirt pad at the world origin, with separate
        // radii for its flatness and its dirt texture. clearing_at returns a flatten
        // influence (1 inside the flat radius, smoothstep down across the shoulder, 0
        // beyond) used to scale the height variation toward the pad's centre height,
        // plus a normalized path distance (mapped through the same dirt/grass edge the
        // shader uses for trails, u_path_dirt_edge) so the texture radius reads as full
        // dirt and its shoulder fades into grass. The two effects are independent.
        const c_shoulder = Math.max(1e-3, this.terrain_clearing_shoulder);
        const c_flat_radius = Math.max(0, this.terrain_clearing_flat_radius);
        const c_tex_radius = Math.max(0, this.terrain_clearing_texture_radius);
        const c_flatness = Math.min(Math.max(this.terrain_clearing_flatness, 0), 1);
        const c_enabled = this.terrain_clearing_enabled;
        const dirt_edge = this.terrain_path_width / (this.terrain_path_width + this.terrain_path_shoulder);
        this.clearing_height = this.natural_height_at_model(0, 0);
        const clearing = { flat_influence: 0, path_dist: 1 };
        this.clearing_at = (mx, my) => {
            clearing.flat_influence = 0;
            clearing.path_dist = 1;
            if (!c_enabled) return clearing;
            const d = Math.hypot(mx, my);

            // Flatness: 1 inside the flat radius, smoothstep down across the shoulder.
            if (c_flat_radius > 0 && d < c_flat_radius + c_shoulder) {
                if (d <= c_flat_radius) {
                    clearing.flat_influence = 1;
                } else {
                    const x = (d - c_flat_radius) / c_shoulder; // 0..1 across the shoulder
                    clearing.flat_influence = 1 - x * x * (3 - 2 * x); // smoothstep down
                }
            }

            // Dirt texture: full dirt inside the texture radius, fading to grass.
            if (c_tex_radius > 0 && d < c_tex_radius + c_shoulder) {
                if (d <= c_tex_radius) {
                    clearing.path_dist = (d / c_tex_radius) * dirt_edge; // full dirt within the radius
                } else {
                    const x = (d - c_tex_radius) / c_shoulder; // 0..1 across the shoulder
                    clearing.path_dist = dirt_edge + (1 - dirt_edge) * x; // dirt -> grass
                }
            }
            return clearing;
        };

        // Pull a pathed height toward the clearing's settled surface: inside the flat
        // zone the variation around the pad's centre height is scaled by c_flatness
        // (0 = dead flat, 1 = untouched), eased out by the flatten influence.
        this.apply_clearing_height = (h, c) => {
            if (c.flat_influence <= 0) return h;
            const target = this.clearing_height + (h - this.clearing_height) * c_flatness;
            return h + (target - h) * c.flat_influence;
        };

        // The height field is the single source of truth, sampled at absolute
        // model coordinates. getHeightAt() (collision) uses this; the tile meshes
        // use sample_at_model below, which returns the same height plus the path
        // distance from a single query, so the rendered surface and the collision
        // surface always agree. Near a path the natural height is pulled toward the
        // path's smoothed centerline, and the central clearing overrides both,
        // pulling the ground to its single flat height.
        this.height_at_model = (mx, my) => {
            const natural = this.natural_height_at_model(mx, my);
            const q = this.path_network.query(mx, my);
            let h = q.influence > 0 ? natural + (q.target_height - natural) * q.influence : natural;
            return this.apply_clearing_height(h, this.clearing_at(mx, my));
        };

        // Combined per-vertex sample for the tile meshes: the pathed height plus
        // the normalized distance to the nearest path (0 at the centerline, 1
        // at/beyond the transition's outer edge, baked per vertex so the grass/dirt
        // edge inherits the mesh's LOD resolution). Both are derived from one
        // path_network.query() -- the network's hot path -- so meshing a tile
        // queries it once per vertex instead of once for height and again for path
        // distance. Returns a reused scratch object: consume both fields before the
        // next call. query().dist is already clamped to reach; the divide maps it
        // into [0, 1].
        const path_reach = this.path_network.reach || 1;
        const sample = { height: 0, path_dist: 0 };
        this.sample_at_model = (mx, my) => {
            const natural = this.natural_height_at_model(mx, my);
            const q = this.path_network.query(mx, my);
            const h = q.influence > 0 ? natural + (q.target_height - natural) * q.influence : natural;
            const pd = Math.min(1, q.dist / path_reach);
            // The central clearing levels the ground and paints dirt over it,
            // overriding the paths where the two overlap (nearer-to-dirt wins).
            const c = this.clearing_at(mx, my);
            sample.height = this.apply_clearing_height(h, c);
            sample.path_dist = Math.min(pd, c.path_dist);
            return sample;
        };

        // Node mesh cache, built on demand and LRU-evicted. Free any previous
        // build's GL buffers before resetting. The budget holds the near-field
        // fan-out so driving doesn't thrash it.
        this.disposeNodeCache();
        this.node_cache = new Map(); // key "depth:ix:iy" -> { tile, used }
        this.frame_stamp = 0;
        this.node_cache_budget = MIN_NODE_CACHE;

        // The terrain changed, so the once-baked terrain shadow map is stale.
        // (Created in initShaders, which runs after the first initHeightField.)
        if (this.shadow_map) this.shadow_map.invalidateTerrain();
    }

    initTextures() {
        // Open ground: rocky terrain. Dirt paths: gravelly sand. Each is a PBR set
        // (albedo + normal + packed ARM + displacement).
        this.rock_diffuse_map = new CGFtexture(this.scene, "terrain/textures/rocky_terrain_02_diff_1k.png");
        this.rock_normal_map = new CGFtexture(this.scene, "terrain/textures/rocky_terrain_02_nor_gl_1k.png");
        this.rock_arm_map = new CGFtexture(this.scene, "terrain/textures/rocky_terrain_02_arm_1k.png");
        this.rock_disp_map = new CGFtexture(this.scene, "terrain/textures/rocky_terrain_02_disp_1k.png");
        this.path_diffuse_map = new CGFtexture(this.scene, "terrain/textures/gravelly_sand_diff_1k.png");
        this.path_normal_map = new CGFtexture(this.scene, "terrain/textures/gravelly_sand_nor_gl_1k.png");
        this.path_arm_map = new CGFtexture(this.scene, "terrain/textures/gravelly_sand_arm_1k.png");
        this.path_disp_map = new CGFtexture(this.scene, "terrain/textures/gravelly_sand_disp_1k.png");

        // CGFtexture uploads with only a LINEAR min filter (no mip chain), so the
        // tiled ground aliases badly when minified into the distance.
        // Mipmaps (and anisotropy) are built once the images have loaded; see configureTextureFiltering.
        this.pbr_textures = [
            this.rock_diffuse_map,
            this.rock_normal_map,
            this.rock_arm_map,
            this.rock_disp_map,
            this.path_diffuse_map,
            this.path_normal_map,
            this.path_arm_map,
            this.path_disp_map,
        ];
        this.texture_filtering_ready = false;
    }

    initShaders() {
        // Terrain shader: blends two tiled PBR materials (rocky ground, gravelly-sand
        // paths) under one directional sun, then fades into the sky with distance fog.
        this.shader = new CGFshader(this.scene.gl, "terrain/shaders/terrain.vert", "terrain/shaders/terrain.frag");

        this.shader.setUniformsValues({
            u_tex_repeat: TEX_REPEAT,
            u_path_dirt_edge: this.terrain_path_width / (this.terrain_path_width + this.terrain_path_shoulder),
            u_parallax_scale: PARALLAX_SCALE,
            u_parallax_near: PARALLAX_NEAR,
            u_parallax_far: PARALLAX_FAR,
            u_rock_diffuse_map: 0,
            u_rock_normal_map: 1,
            u_rock_arm_map: 2,
            u_rock_disp_map: 3,
            u_diffuse_map: 4,
            u_normal_map: 5,
            u_arm_map: 6,
            u_disp_map: 7,
        });

        // Cascaded shadow maps for the sun. Built once; the cascades refit to the
        // wagon every frame in display().
        this.shadow_map = new ShadowMap(this.scene);
    }

    // =====================================================
    // Height field & collision
    // =====================================================

    // Terrain height at a world-space (x, z) position, via bilinear
    // interpolation of the height field. Coordinates are in the terrain's
    // own (pre-scene-scale) space, the same space the wagon and obstacles are
    // modelled in. Accounts for the -90deg X rotation Scene applies before
    // drawing the terrain: world x -> model x, world z -> -model y, and the
    // stored height already is the world-up value.
    //
    // Because both the mesh and this query interpolate the same grid samples,
    // an object placed at getHeightAt(x, z) sits exactly on the visible ground.
    getHeightAt(world_x, world_z) {
        const n = this.effective_subdivisions;
        const half = this.half_extent;
        const patch = this.patch;

        // Map world position to fractional grid indices, clamped to the mesh.
        let fi = (world_x + half) / patch;
        let fj = (half + world_z) / patch;
        fi = Math.min(Math.max(fi, 0), n);
        fj = Math.min(Math.max(fj, 0), n);

        const i0 = Math.floor(fi);
        const j0 = Math.floor(fj);
        const i1 = Math.min(i0 + 1, n);
        const j1 = Math.min(j0 + 1, n);
        const tx = fi - i0;
        const tz = fj - j0;

        // Evaluate the height field at the four surrounding global grid points;
        // bilinear interpolation reproduces the triangle-strip surface exactly.
        const mx0 = -half + i0 * patch;
        const mx1 = -half + i1 * patch;
        const my0 = half - j0 * patch;
        const my1 = half - j1 * patch;
        const h00 = this.height_at_model(mx0, my0);
        const h10 = this.height_at_model(mx1, my0);
        const h01 = this.height_at_model(mx0, my1);
        const h11 = this.height_at_model(mx1, my1);
        const a = h00 * (1 - tx) + h10 * tx;
        const b = h01 * (1 - tx) + h11 * tx;
        return a * (1 - tz) + b * tz;
    }

    // =====================================================
    // Node mesh cache
    // =====================================================

    // Fetch (or build and cache) the node mesh for a region, keyed by its place
    // in the tree and its per-edge tessellation (so a tile re-stitches when a
    // neighbor's LOD changes). Stamps the entry as used this frame for LRU
    // eviction.
    getNode(cx, cy, s, depth, edge_steps) {
        const ix = Math.round((cx + this.half_extent) / s);
        const iy = Math.round((this.half_extent - cy) / s);
        const es = edge_steps || { top: 1, bottom: 1, left: 1, right: 1 };
        const key = depth + ":" + ix + ":" + iy + ":" + es.top + es.bottom + es.left + es.right;
        let entry = this.node_cache.get(key);
        if (!entry) {
            const tile = new TerrainTile(this.scene, {
                subdivisions: this.effective_tile_subdivisions,
                tile_size: s,
                corner_x: cx,
                corner_y: cy,
                half: this.half_extent,
                size: this.effective_size,
                // Per-edge step: 2 collapses that edge onto a coarser neighbor's
                // samples; 1 leaves it at full resolution.
                edge_steps: es,
                sample_at: this.sample_at_model,
            });
            entry = { tile, used: 0 };
            this.node_cache.set(key, entry);
        }
        entry.used = this.frame_stamp;
        return entry.tile;
    }

    // Evict the least-recently-used cached nodes once over budget, leaving those
    // drawn this frame untouched.
    evictNodeCache() {
        if (this.node_cache.size <= this.node_cache_budget) return;
        const entries = [...this.node_cache.entries()].sort((a, b) => a[1].used - b[1].used);
        let to_remove = this.node_cache.size - this.node_cache_budget;
        for (const [key, entry] of entries) {
            if (to_remove <= 0) break;
            if (entry.used === this.frame_stamp) continue; // visible this frame
            entry.tile.dispose();
            this.node_cache.delete(key);
            to_remove--;
        }
    }

    // Drop every cached node mesh and its GL buffers (on rebuild).
    disposeNodeCache() {
        if (!this.node_cache) return;
        for (const entry of this.node_cache.values()) entry.tile.dispose();
        this.node_cache.clear();
    }

    // =====================================================
    // Level of detail (quadtree)
    // =====================================================

    // Distance from the wagon to the nearest point of a node's footprint (the
    // box x in [cx, cx+s], y in [cy-s, cy]); 0 when the wagon is over the node.
    boxDistance(cx, cy, s, wmx, wmy) {
        const nx = Math.min(Math.max(wmx, cx), cx + s);
        const ny = Math.min(Math.max(wmy, cy - s), cy);
        return Math.hypot(wmx - nx, wmy - ny);
    }

    // The split factor actually used, floored so the quadtree stays 2:1-balanced
    // (see LOD_MIN_SPLIT_FACTOR) and edge stitching can connect every seam.
    splitFactor() {
        return Math.max(this.terrain_lod_split_factor, LOD_MIN_SPLIT_FACTOR);
    }

    // Whether a node at (cx, cy) spanning s and sitting at this depth should be
    // subdivided rather than drawn. Shared by drawQuad (which draws) and
    // leafDepthAt (which only resolves depths), so both agree on the tree shape.
    shouldSplit(cx, cy, s, depth) {
        return this.terrain_lod_enabled
            ? depth < this.max_depth && this.boxDistance(cx, cy, s, this._wmx, this._wmy) < s * this.splitFactor()
            : depth < Math.min(this.max_depth, LOD_OFF_DEPTH);
    }

    // Depth at which the quadtree draws the leaf containing model point (px, py),
    // by descending from the root with the same split rule drawQuad uses. Points
    // outside the terrain have no neighbor, so they report the finest depth and
    // never trigger edge decimation (the outer rim's edges stay at full resolution).
    leafDepthAt(px, py) {
        const half = this.half_extent;
        if (px < -half || px > half || py < -half || py > half) return this.max_depth;
        let cx = -half;
        let cy = half;
        let s = this.effective_size;
        let depth = 0;
        while (this.shouldSplit(cx, cy, s, depth)) {
            const h = s / 2;
            if (px >= cx + h) cx += h;
            if (py <= cy - h) cy -= h;
            s = h;
            depth++;
        }
        return depth;
    }

    // For a leaf at (cx, cy) spanning s, decide how each of its four edges must be
    // tessellated to meet its neighbor. A neighbor one LOD level coarser samples
    // the shared edge at every other vertex, so the leaf must drop that edge to
    // step 2 (collapsing its in-between vertices onto the coarse edge); equal or
    // finer neighbors need no change (step 1). The 2:1 balance guarantees the
    // gap is never more than one level, so step 2 always suffices. A point just
    // across each edge midpoint resolves the neighbor's drawn depth.
    edgeStepsFor(cx, cy, s, depth) {
        const e = this.patch * 0.5; // smaller than any tile: lands just inside the neighbor
        const coarser = (px, py) => (this.leafDepthAt(px, py) < depth ? 2 : 1);
        return {
            top: coarser(cx + s / 2, cy + e),
            bottom: coarser(cx + s / 2, cy - s - e),
            left: coarser(cx - e, cy - s / 2),
            right: coarser(cx + s + e, cy - s / 2),
        };
    }

    // Recursively walk the quadtree. A node at (cornerX, cornerY) spanning s
    // splits into its four children when it is too coarse for how close it is to
    // the wagon -- i.e. while it is nearer than s * splitFactor and deeper detail
    // is still available. Otherwise it is drawn at this depth. With LOD off, the
    // tree is drawn uniformly at a fixed (cheap) depth.
    drawQuad(cx, cy, s, depth) {
        if (this.shouldSplit(cx, cy, s, depth)) {
            const h = s / 2;
            this.drawQuad(cx, cy, h, depth + 1);
            this.drawQuad(cx + h, cy, h, depth + 1);
            this.drawQuad(cx, cy - h, h, depth + 1);
            this.drawQuad(cx + h, cy - h, h, depth + 1);
            return;
        }

        const tile = this.getNode(cx, cy, s, depth, this.edgeStepsFor(cx, cy, s, depth));
        if (this._normal_viz && !tile.normalVizEnabled) tile.enableNormalViz();
        else if (!this._normal_viz && tile.normalVizEnabled) tile.disableNormalViz();

        this.scene.pushMatrix();
        this.scene.translate(cx, cy, 0);
        tile.display();
        this.scene.popMatrix();
    }

    // Depth-only quadtree walk for the shadow pass: the same tree shape and node
    // meshes as drawQuad (so tiles are shared, not rebuilt), but with no
    // material/normal-viz work -- only the position is drawn, into the active
    // cascade's depth texture under the light camera the ShadowMap set up. Uses
    // the same wagon-driven LOD, which conveniently makes the near cascade finest.
    // box: optional model-space AABB to cull subtrees against. uniform_depth: when
    // set, split to that fixed depth everywhere (a uniform grid for the once-baked
    // terrain shadow map) instead of the wagon-centred LOD; uniform tiles share a
    // depth, so their edges need no stitching.
    drawQuadDepth(cx, cy, s, depth, box, uniform_depth) {
        // Cull whole subtrees whose footprint (x in [cx, cx+s], y in [cy-s, cy])
        // falls outside the requested model-space box.
        if (box && (cx + s < box.minx || cx > box.maxx || cy < box.miny || cy - s > box.maxy)) return;

        const split = uniform_depth != null ? depth < uniform_depth : this.shouldSplit(cx, cy, s, depth);
        if (split) {
            const h = s / 2;
            this.drawQuadDepth(cx, cy, h, depth + 1, box, uniform_depth);
            this.drawQuadDepth(cx + h, cy, h, depth + 1, box, uniform_depth);
            this.drawQuadDepth(cx, cy - h, h, depth + 1, box, uniform_depth);
            this.drawQuadDepth(cx + h, cy - h, h, depth + 1, box, uniform_depth);
            return;
        }

        const es = uniform_depth != null ? { top: 1, bottom: 1, left: 1, right: 1 } : this.edgeStepsFor(cx, cy, s, depth);
        const tile = this.getNode(cx, cy, s, depth, es);
        this.scene.pushMatrix();
        this.scene.translate(cx, cy, 0);
        tile.display();
        this.scene.popMatrix();
    }

    // =====================================================
    // Normal visualization
    // =====================================================

    // Normal-viz is a per-frame flag applied to whichever nodes are drawn (the
    // quadtree has no fixed parts for CGFGroup to delegate to).
    enableNormalViz() {
        this._normal_viz = true;
    }

    disableNormalViz() {
        this._normal_viz = false;
    }

    // =====================================================
    // Textures
    // =====================================================

    // Build mipmaps for the PBR textures so distant texels stop shimmering.
    // CGFtexture loads asynchronously, so this runs lazily from display() and bails
    // until every map has its GL texture. The maps are power-of-two, so trilinear
    // filtering, max anisotropy, and REPEAT wrap are all valid.
    configureTextureFiltering() {
        if (this.texture_filtering_ready) return;
        const gl = this.scene.gl;
        if (this.pbr_textures.some(t => t.texID === -1)) return;

        const aniso =
            gl.getExtension("EXT_texture_filter_anisotropic") ||
            gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
            gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
        const maxAniso = aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;

        for (const t of this.pbr_textures) {
            gl.bindTexture(gl.TEXTURE_2D, t.texID);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.texture_filtering_ready = true;
    }

    // =====================================================
    // Fog
    // =====================================================

    // Fog colour to fade distant terrain into. The sky's fragment shader puts
    // colour2 at the horizon (elevation 0): mix(night_colour2, day_colour2,
    // day_factor). We reproduce exactly that here so the terrain dissolves into
    // the same colour the sky shows just above it, across the day/night cycle.
    fogColor() {
        const sky = this.scene.sky_sphere;
        if (!sky) return [0.6, 0.7, 0.85];
        const day = hexToRGB(sky.sky_colors.sky_day_colour_2, false);
        const night = hexToRGB(sky.sky_colors.sky_night_colour_2, false);
        const t = sky.day_factor;
        return [
            night[0] + (day[0] - night[0]) * t,
            night[1] + (day[1] - night[1]) * t,
            night[2] + (day[2] - night[2]) * t,
        ];
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        // Wagon position in model space (world x -> model x, world z -> -model
        // y, matching getHeightAt's frame), stored so the quadtree refinement and
        // the neighbor-depth queries (leafDepthAt) both see the same frame. Set
        // before either pass walks the tree.
        const wagon = this.scene.wagon;
        this._wmx = wagon ? wagon.position_x : 0;
        this._wmy = wagon ? -wagon.position_z : 0;

        // One frame stamp shared by both passes so tiles touched by the shadow
        // walk and the main walk are kept by the same eviction sweep.
        this.frame_stamp++;

        // --- Shadow depth pass ---
        // Render the terrain's depth from the sun into the wagon-centred cascades
        // first; it self-contains its camera/framebuffer/matrix changes.
        if (this.shadows_enabled) this.shadow_map.render(this);

        // --- Main pass ---
        this.scene.setActiveShader(this.shader);
        // The depth pass swapped the projection to the light ortho; restore the
        // camera's perspective for the visible draw.
        if (this.shadows_enabled) this.scene.updateProjectionMatrix();
        this.configureTextureFiltering();

        const fog = this.fogColor();
        this.shader.setUniformsValues({
            u_fog_enabled: this.fog_enabled,
            u_fog_color: fog,
            u_fog_near: this.fog_start,
            u_fog_far: this.fog_end,
        });

        // Bind both materials to the sampler units the shader expects.
        this.rock_diffuse_map.bind(0);
        this.rock_normal_map.bind(1);
        this.rock_arm_map.bind(2);
        this.rock_disp_map.bind(3);
        this.path_diffuse_map.bind(4);
        this.path_normal_map.bind(5);
        this.path_arm_map.bind(6);
        this.path_disp_map.bind(7);

        // Bind the cascade depth textures (units 8+) and their matrices, so each
        // fragment can test itself against the sun's shadow maps.
        if (this.shadows_enabled) this.shadow_map.applyUniforms(this.shader);
        else this.shadow_map.disable(this.shader);

        // Walk the single quadtree root, drawing every region at the depth its
        // distance to the wagon calls for, then retire node meshes that have
        // drifted out of use. The root is centred on the origin; its top-left
        // corner is (-half_extent, +half_extent).
        this.drawQuad(-this.half_extent, this.half_extent, this.effective_size, 0);
        this.evictNodeCache();

        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
