import { HayBale } from "./HayBale.js";
import { Arrow } from "./Arrow.js";

// A scatter of hay bales strewn along the procedural dirt paths, acting as
// loose obstacles on the trails. Placement is baked once at construction:
// positions are sampled along the path network's segment soup (model space),
// lifted onto the terrain, and given a random heading. Drawing reuses a single
// HayBale mesh, batched so the whole field costs one shader activation.
export class HayBaleField {
    constructor(scene, terrain, opts = {}) {
        this.scene = scene;
        this.terrain = terrain;

        this.seed = (opts.seed ?? 1337) >>> 0;
        this.scale = opts.scale ?? 2.0; // uniform size of each bale
        this.spacing = opts.spacing ?? 200; // average path length between bales
        this.max_count = opts.max_count ?? 250; // hard cap so big terrains stay cheap
        this.clear_radius = opts.clear_radius ?? 230; // keep the barn clearing free

        // Shared mesh; the cross-section bottom sits at y = -1 (radius 1), so a
        // bale rests on the ground when lifted by its scale.
        this.bale = new HayBale(scene);
        this.lift = this.scale;

        // Proximity marker: a single shared arrow drawn hovering over any bale the
        // wagon gets near, bobbing up and down. One mesh, instanced per visible
        // bale (see displayArrows). All distances are world units.
        this.arrow = new Arrow(scene);
        this.arrow_distance = opts.arrow_distance ?? 400; // show within this range of the wagon
        this.arrow_scale = opts.arrow_scale ?? 1.6; // size of the marker
        this.arrow_gap = opts.arrow_gap ?? 1.2; // clearance between the bale top and the arrow tip
        this.arrow_bob_amp = opts.arrow_bob_amp ?? 0.6; // vertical bob amplitude
        this.arrow_bob_speed = opts.arrow_bob_speed ?? 3.0; // bob rate (rad/s)
        this.time = 0; // accumulated seconds, drives the bob

        // Set by the wagon's shadow bake if it ever drives the field; harmless
        // otherwise. Kept here so display() can mirror it onto the shared mesh.
        this._depth_pass = false;

        this.placements = []; // { x, y, z, yaw }
        this.scatter();
    }

    // Walk the path network's flattened segments, pick points uniformly along
    // their combined length, nudge each off the centerline, and drop it onto the
    // terrain. All path data is model space (mx, my); world is (mx, height, -my).
    scatter() {
        const net = this.terrain.path_network;
        const seg = net && net.seg;
        if (!seg || seg.ax.length === 0) return;

        const n = seg.ax.length;
        const cum = new Float32Array(n + 1); // cumulative segment length
        for (let i = 0; i < n; i++) {
            const dx = seg.bx[i] - seg.ax[i];
            const dy = seg.by[i] - seg.ay[i];
            cum[i + 1] = cum[i] + Math.hypot(dx, dy);
        }
        const total = cum[n];
        if (total <= 0) return;

        const count = Math.min(this.max_count, Math.max(1, Math.round(total / this.spacing)));
        const rand = mulberry32(this.seed);
        const half_width = (net.half_width || 8) * 0.6; // stay inside the flat strip

        for (let b = 0; b < count; b++) {
            // Locate a random arc-length position within a segment.
            const target = rand() * total;
            let lo = 0;
            let hi = n;
            while (lo + 1 < hi) {
                const mid = (lo + hi) >> 1;
                if (cum[mid] <= target) lo = mid;
                else hi = mid;
            }
            const seg_len = cum[lo + 1] - cum[lo] || 1;
            const t = (target - cum[lo]) / seg_len;

            const dx = seg.bx[lo] - seg.ax[lo];
            const dy = seg.by[lo] - seg.ay[lo];
            const len = Math.hypot(dx, dy) || 1;

            // Point on the centerline plus a perpendicular nudge so bales don't
            // sit in a dead-straight line down the middle of the trail.
            const off = (rand() * 2 - 1) * half_width;
            const px = seg.ax[lo] + dx * t + (-dy / len) * off;
            const py = seg.ay[lo] + dy * t + (dx / len) * off;

            if (Math.hypot(px, py) < this.clear_radius) continue; // skip the barn pad

            // Model -> world, then snap onto the rendered ground.
            const wx = px;
            const wz = -py;
            const wy = this.terrain.getHeightAt(wx, wz);

            this.placements.push({ x: wx, y: wy, z: wz, yaw: rand() * Math.PI * 2 });
        }
    }

    // =====================================================
    // Display
    // =====================================================

    // Draw every bale (main pass) or emit their geometry into the active depth
    // map (when _depth_pass is set). `cull`, if given as { x, z, r }, skips bales
    // whose horizontal distance from (x, z) exceeds r -- used by the shadow pass
    // to draw only the bales near the wagon-following near map, since the field
    // is scattered across the whole terrain.
    display(cull = null) {
        if (this.placements.length === 0) return;

        const bale = this.bale;
        const s = this.scene;
        bale._depth_pass = this._depth_pass;
        const r2 = cull ? cull.r * cull.r : 0;

        // One material activation (and shadow-uniform upload) for the whole field;
        // a no-op in the depth pass, where the active depth shader stands.
        bale.beginBatch();
        for (const p of this.placements) {
            if (p.collected) continue; // picked up by the wagon — hide it
            if (cull) {
                const dx = p.x - cull.x;
                const dz = p.z - cull.z;
                if (dx * dx + dz * dz > r2) continue;
            }
            s.pushMatrix();
            s.translate(p.x, p.y + this.lift, p.z);
            s.rotate(p.yaw, 0, 1, 0);
            s.scale(this.scale, this.scale, this.scale);
            s.translate(0, 0, -1.5); // centre the 0..3 length on the sample point
            bale.displayShape();
            s.popMatrix();
        }
    }

    // =====================================================
    // Proximity arrows
    // =====================================================

    // Advance the bob animation. Called once per frame from the scene update.
    update(dt) {
        this.time += dt;
    }

    // Draw a bobbing arrow over every bale within arrow_distance of the wagon.
    // Main pass only (the depth pass calls display(), not this), so the markers
    // never cast shadows. The arrows are self-lit, so they're switched onto the
    // scene's default lit shader (the bale shader is still active here) and drawn
    // with culling off, then both are restored.
    displayArrows() {
        const wagon = this.scene.wagon;
        if (!wagon || this.placements.length === 0) return;

        const wx = wagon.position_x;
        const wz = wagon.position_z;
        const r2 = this.arrow_distance * this.arrow_distance;

        // Skip touching any GL state if no bale is in range this frame.
        let any = false;
        for (const p of this.placements) {
            if (p.collected) continue;
            const dx = p.x - wx;
            const dz = p.z - wz;
            if (dx * dx + dz * dz <= r2) {
                any = true;
                break;
            }
        }
        if (!any) return;

        const s = this.scene;
        const gl = s.gl;
        const prev_shader = s.activeShader;
        s.setActiveShader(s.defaultShader);
        gl.disable(gl.CULL_FACE);
        this.arrow.material.apply();

        for (let i = 0; i < this.placements.length; i++) {
            const p = this.placements[i];
            if (p.collected) continue; // no arrow over an already-collected bale
            const dx = p.x - wx;
            const dz = p.z - wz;
            if (dx * dx + dz * dz > r2) continue;

            // bob in [0, 2*amp] so the tip never dips below the gap above the bale.
            // Phase by index so neighbouring markers don't bob in lockstep.
            const bale_top = p.y + this.lift + this.scale;
            const bob = this.arrow_bob_amp * (1 + Math.sin(this.time * this.arrow_bob_speed + i * 1.7));
            const tip_y = bale_top + this.arrow_gap + bob;

            s.pushMatrix();
            s.translate(p.x, tip_y, p.z);
            s.scale(this.arrow_scale, this.arrow_scale, this.arrow_scale);
            this.arrow.displayShape();
            s.popMatrix();
        }

        gl.enable(gl.CULL_FACE);
        s.setActiveShader(prev_shader);
    }

    // Normal visualization toggles the shared mesh: every instance is drawn
    // through displayShape() -> CGFobject.display(), which emits the normal lines
    // (under the scene's normals shader) whenever the mesh has it enabled.
    enableNormalViz() {
        this.bale.enableNormalViz();
    }

    disableNormalViz() {
        this.bale.disableNormalViz();
    }
}

// Small seeded PRNG (mulberry32) so the scatter is deterministic per seed.
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
