import { CGFobject } from "../lib/CGF.js";

// One quadtree node mesh: a triangle-strip height grid.
//
// Terrain draws a quadtree -- coarse nodes far from the wagon, fine nodes near
// it. Every node is a fixed (subdivisions x subdivisions) grid; near nodes span
// less ground, so the same vertices pack denser.
//
// Built locally in [0, tile_size] x [0, -tile_size]; Terrain translates it.
// Heights come from the shared global height function sampled at absolute model
// coordinates, so edges match neighbors and texturing stays continuous.
//
// Neighbors at different depths sample a shared edge at different densities, so
// seams would crack. Instead of skirts, nodes are stitched: the quadtree stays
// 2:1-balanced and a fine edge facing a coarser neighbor drops to step 2,
// collapsing its in-between vertices onto the neighbor's segment (see
// decimateEdge). opts.edge_steps gives the per-edge step ({top, bottom, left,
// right}, each 1 or 2).
export class TerrainTile extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, opts) {
        super(scene);
        this.subdivisions = opts.subdivisions;
        this.tile_size = opts.tile_size;
        this.corner_x = opts.corner_x;
        this.corner_y = opts.corner_y;
        this.edge_steps = opts.edge_steps || { top: 1, bottom: 1, left: 1, right: 1 };
        // (mx, my) -> { height, path_dist }: terrain height plus normalized
        // distance to the nearest path (0 = centerline, 1 = transition end), from
        // one query. path_dist is baked per vertex so the grass/dirt edge rides
        // the mesh at its LOD resolution.
        this.sample_at = opts.sample_at;
        // half/size = terrain half/full extent; only feed a_terrain_uv below.
        this.initBuffers(opts.half, opts.size);
    }

    // =====================================================
    // Mesh build
    // =====================================================

    initBuffers(half, size) {
        const n = this.subdivisions;
        const patch = this.tile_size / n;

        // Bordered height grid: indices run -1 .. n+1 so edge central differences
        // read into neighboring ground. Same pass caches path distance for the
        // drawn vertices in PD, so each point is queried once.
        const stride = n + 3;
        const H = new Float32Array(stride * stride);
        const PD = new Float32Array((n + 1) * (n + 1));
        for (let bj = -1; bj <= n + 1; bj++) {
            const my = this.corner_y - bj * patch;
            for (let bi = -1; bi <= n + 1; bi++) {
                const mx = this.corner_x + bi * patch;
                const s = this.sample_at(mx, my);
                H[(bj + 1) * stride + (bi + 1)] = s.height;
                if (bi >= 0 && bi <= n && bj >= 0 && bj <= n) PD[bj * (n + 1) + bi] = s.path_dist;
            }
        }

        this.vertices = [];
        this.normals = [];
        this.tangents = [];
        // Custom per-vertex attributes for the terrain shader (beyond WebCGF's
        // position/normal): a_terrain_uv, normalized position across the whole
        // terrain, driving grass noise and dirt tiling continuously across seams
        // and LODs; a_path_dist, distance to the nearest path, for dirt on trails;
        // and a tangent (below) for the dirt normal map.
        this.terrain_uv = [];
        this.path_dist = [];
        for (let j = 0; j <= n; j++) {
            for (let i = 0; i <= n; i++) {
                const h = H[(j + 1) * stride + (i + 1)];
                this.vertices.push(i * patch, -j * patch, h);

                const mx = this.corner_x + i * patch;
                const my = this.corner_y - j * patch;
                this.terrain_uv.push((mx + half) / size, (half - my) / size);
                this.path_dist.push(PD[j * (n + 1) + i]);

                // Normal via central differences: z = h(x, y), normal =
                // normalize(-dh/dx, -dh/dy, 1). Model y decreases as j rises,
                // hence the sign on dh_dy.
                const hl = H[(j + 1) * stride + i];
                const hr = H[(j + 1) * stride + (i + 2)];
                const hu = H[j * stride + (i + 1)];
                const hd = H[(j + 2) * stride + (i + 1)];
                const dh_dx = (hr - hl) / (2 * patch);
                const dh_dy = (hd - hu) / (-2 * patch);
                const nx = -dh_dx;
                const ny = -dh_dy;
                const nz = 1.0;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                this.normals.push(nx / len, ny / len, nz / len);

                // Tangent along +U (rises with local x): surface derivative
                // d(x, y, h)/dx = (1, 0, dh/dx). The shader rebuilds the
                // bitangent, so only this vector is uploaded.
                const t_len = Math.sqrt(1.0 + dh_dx * dh_dx);
                this.tangents.push(1.0 / t_len, 0.0, dh_dx / t_len);
            }
        }

        this.indices = [];
        let ind = 0;
        for (let j = 0; j < n; j++) {
            for (let i = 0; i <= n; i++) {
                this.indices.push(ind);
                this.indices.push(ind + n + 1);
                ind++;
            }
            if (j + 1 < n) {
                this.indices.push(ind + n);
                this.indices.push(ind);
            }
        }

        // Stitch each edge facing a coarser neighbor down to its resolution, so
        // shared edges coincide instead of cracking.
        const N = n + 1;
        const idx = (i, j) => j * N + i;
        const top = [],
            bottom = [],
            left = [],
            right = [];
        for (let i = 0; i <= n; i++) {
            top.push(idx(i, 0));
            bottom.push(idx(i, n));
        }
        for (let j = 0; j <= n; j++) {
            left.push(idx(0, j));
            right.push(idx(n, j));
        }
        this.decimateEdge(top, this.edge_steps.top);
        this.decimateEdge(bottom, this.edge_steps.bottom);
        this.decimateEdge(left, this.edge_steps.left);
        this.decimateEdge(right, this.edge_steps.right);

        this.primitiveType = this.scene.gl.TRIANGLE_STRIP;
        this.initGLBuffers();

        // These custom attributes aren't WebCGF standard, so upload each into its
        // own buffer; display() binds them by hand.
        const gl = this.scene.gl;
        this.terrain_uv_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.terrain_uv_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.terrain_uv), gl.STATIC_DRAW);
        this.path_dist_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.path_dist_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.path_dist), gl.STATIC_DRAW);
        this.tangent_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangent_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.tangents), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // =====================================================
    // Edge stitching
    // =====================================================

    // Collapse an edge onto a coarser neighbor's tessellation. Given the edge's
    // vertex indices in order and a step k, every vertex not a multiple of k is
    // moved (height only) onto the straight line between the kept neighbors --
    // the segment the coarse neighbor draws. Normal and tangent are interpolated
    // the same way and renormalized, so shading stays crease-free along the seam.
    // Endpoints are always kept. k <= 1 is a no-op. Attributes are snapshotted
    // first so interpolation uses originals.
    decimateEdge(edge, k) {
        if (k <= 1) return;
        const len = edge.length;
        const z = edge.map(vi => this.vertices[vi * 3 + 2]);
        const nrm = edge.map(vi => this.normals.slice(vi * 3, vi * 3 + 3));
        const tan = edge.map(vi => this.tangents.slice(vi * 3, vi * 3 + 3));
        for (let p = 0; p < len; p++) {
            if (p % k === 0) continue;
            const lo = p - (p % k);
            const hi = Math.min(lo + k, len - 1);
            const t = (p - lo) / (hi - lo);
            const vi = edge[p];
            this.vertices[vi * 3 + 2] = z[lo] * (1 - t) + z[hi] * t;
            this.lerpUnit(this.normals, vi, nrm[lo], nrm[hi], t);
            this.lerpUnit(this.tangents, vi, tan[lo], tan[hi], t);
        }
    }

    // Write into out[vi*3 .. vi*3+2] the normalized linear blend (1-t)*a + t*b of
    // two 3-vectors, falling back to a if the blend is degenerate (zero length).
    lerpUnit(out, vi, a, b, t) {
        const x = a[0] * (1 - t) + b[0] * t;
        const y = a[1] * (1 - t) + b[1] * t;
        const z = a[2] * (1 - t) + b[2] * t;
        const len = Math.hypot(x, y, z);
        const o = vi * 3;
        if (len === 0) {
            out[o] = a[0];
            out[o + 1] = a[1];
            out[o + 2] = a[2];
            return;
        }
        out[o] = x / len;
        out[o + 1] = y / len;
        out[o + 2] = z / len;
    }

    // =====================================================
    // Dispose
    // =====================================================

    // Release GL buffers when evicted from the cache.
    dispose() {
        const gl = this.scene.gl;
        for (const b of [
            this.vertsBuffer,
            this.normsBuffer,
            this.indicesBuffer,
            this.terrain_uv_buffer,
            this.path_dist_buffer,
            this.tangent_buffer,
        ]) {
            if (b) gl.deleteBuffer(b);
        }
    }

    // =====================================================
    // Display
    // =====================================================

    // Bind our custom attributes (when the active shader declares them), draw,
    // then disable them so they don't leak into the next object's draw.
    display() {
        const gl = this.scene.gl;
        const attrs = this.scene.activeShader?.attributes;
        const uv_loc = attrs?.a_terrain_uv;
        const dist_loc = attrs?.a_path_dist;
        const tan_loc = attrs?.a_vertex_tangent;
        const has_uv = uv_loc !== undefined && uv_loc !== -1;
        const has_dist = dist_loc !== undefined && dist_loc !== -1;
        const has_tan = tan_loc !== undefined && tan_loc !== -1;
        if (has_uv) {
            gl.enableVertexAttribArray(uv_loc);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.terrain_uv_buffer);
            gl.vertexAttribPointer(uv_loc, 2, gl.FLOAT, false, 0, 0);
        }
        if (has_dist) {
            gl.enableVertexAttribArray(dist_loc);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.path_dist_buffer);
            gl.vertexAttribPointer(dist_loc, 1, gl.FLOAT, false, 0, 0);
        }
        if (has_tan) {
            gl.enableVertexAttribArray(tan_loc);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.tangent_buffer);
            gl.vertexAttribPointer(tan_loc, 3, gl.FLOAT, false, 0, 0);
        }
        super.display();
        if (has_uv) gl.disableVertexAttribArray(uv_loc);
        if (has_dist) gl.disableVertexAttribArray(dist_loc);
        if (has_tan) gl.disableVertexAttribArray(tan_loc);
    }
}
