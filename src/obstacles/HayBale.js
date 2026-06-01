import { CGFobject } from "../lib/CGF.js";
import { ShadowedTexturedMaterial } from "../core/ShadowedTexturedMaterial.js";

export class HayBale extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        this.slices = 25;
        this.stacks = 3;

        // Rounded end caps: a smooth dome swept from the wall edge to a pole, so
        // the ends blend into the long edges instead of meeting them at a hard
        // rim. cap_stacks is the dome's ring resolution; cap_depth is how far it
        // bulges out along the bale's axis (per end).
        this.cap_stacks = 4;
        this.cap_depth = 0.3;

        this.initBuffers();
        this.initMaterials();

        // Set by the wagon while it bakes its shadow map: in the depth pass the
        // bale emits plain geometry under the active depth shader instead of
        // switching to its own lit shader.
        this._depth_pass = false;
    }

    initMaterials() {
        // Textured + shadow-aware appearance (its u_hay_texture sampler reads
        // unit 0), shared with the wagon's horses. Owns the texture and builds a
        // mip chain like the terrain materials.
        this.material = new ShadowedTexturedMaterial(
            this.scene,
            "src/obstacles/textures/hay2.jpg",
            "src/obstacles/shaders/haybale.vert",
            "src/obstacles/shaders/haybale.frag",
            "u_hay_texture",
        );
    }

    // =====================================================
    // Geometry
    // =====================================================

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        const alphaAng = (2 * Math.PI) / this.slices;
        const stackZ = 3 / this.stacks;
        const z_end = stackZ * this.stacks; // far end of the straight wall
        const n = 4;

        // Lamé-curve (squircle) cross-section: vertex position (px, py) and the
        // unit radial direction the surface normal points along at that slice.
        // Shared by the wall and both caps so their normals line up at the seam.
        const px = [];
        const py = [];
        const nrx = [];
        const nry = [];
        for (let i = 0; i <= this.slices; i++) {
            const ang = i * alphaAng;
            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);
            const x = Math.pow(Math.abs(cosA), 2 / n) * Math.sign(cosA);
            const y = Math.pow(Math.abs(sinA), 2 / n) * Math.sign(sinA);
            px.push(x);
            py.push(-y);
            const len = Math.hypot(x, y) || 1;
            nrx.push(x / len);
            nry.push(-y / len);
        }

        const ringStride = this.slices + 1;

        // --- Side wall: the straight body, rings of the cross-section along z ---
        for (let j = 0; j <= this.stacks; j++) {
            const z = j * stackZ;
            for (let i = 0; i <= this.slices; i++) {
                this.vertices.push(px[i], py[i], z);
                this.normals.push(nrx[i], nry[i], 0);
                this.texCoords.push(i / this.slices, j / this.stacks);
            }
            if (j < this.stacks) {
                for (let i = 0; i < this.slices; i++) {
                    const current = j * ringStride + i;
                    const next = current + 1;
                    const bottom = (j + 1) * ringStride + i;
                    const bottomNext = bottom + 1;
                    this.indices.push(current, bottom, next);
                    this.indices.push(next, bottom, bottomNext);
                }
            }
        }

        // --- Rounded end cap ---------------------------------------------------
        // Sweep the cross-section from the wall edge (phi = 0, full size, flush
        // with the wall normal) to a pole (phi = 90deg), scaling the radius by
        // cos(phi) and bulging out by cap_depth*sin(phi). The normal blends from
        // the wall's radial normal to the axis, so the rim has no hard crease.
        // `dir` is +1 for the far end (bulges to +z) and -1 for the near end.
        const buildCap = (z_base, dir) => {
            const base = this.vertices.length / 3;

            for (let k = 0; k <= this.cap_stacks; k++) {
                const phi = (k / this.cap_stacks) * (Math.PI / 2);
                const c = Math.cos(phi);
                const s = Math.sin(phi);
                const z = z_base + dir * this.cap_depth * s;
                for (let i = 0; i <= this.slices; i++) {
                    this.vertices.push(px[i] * c, py[i] * c, z);
                    this.normals.push(nrx[i] * c, nry[i] * c, dir * s);
                    // Circular layout of the texture across the cap face.
                    this.texCoords.push(0.5 + px[i] * c * 0.5, 0.5 + py[i] * c * 0.5);
                }
            }

            // Stitch consecutive rings. The far cap keeps the wall's winding; the
            // near cap is mirrored in z, so its winding is flipped to stay
            // outward-facing under back-face culling.
            for (let k = 0; k < this.cap_stacks; k++) {
                for (let i = 0; i < this.slices; i++) {
                    const current = base + k * ringStride + i;
                    const next = current + 1;
                    const inner = base + (k + 1) * ringStride + i;
                    const innerNext = inner + 1;
                    if (dir > 0) {
                        this.indices.push(current, inner, next);
                        this.indices.push(next, inner, innerNext);
                    } else {
                        this.indices.push(current, next, inner);
                        this.indices.push(next, innerNext, inner);
                    }
                }
            }
        };

        buildCap(z_end, 1); // far end
        buildCap(0, -1); // near end

        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        // Depth pass: just emit geometry into the active depth shader so the bale
        // casts into the wagon shadow map (don't swap in the lit shader).
        if (this._depth_pass) {
            super.display();
            return;
        }

        this.material.apply();
        super.display();
    }

    // Activate the lit shader + bind the texture once, so a caller drawing several
    // bales can do it before the loop and then emit each bale's geometry with
    // displayShape() — no per-bale shader switch or shadow-uniform re-upload. In
    // the depth pass there's nothing to set up (the active depth shader stands).
    beginBatch() {
        if (!this._depth_pass) this.material.apply();
    }

    // Emit just the bale geometry under whatever shader is currently active.
    // Pairs with beginBatch() for drawing multiple bales under one activation.
    displayShape() {
        super.display();
    }
}
