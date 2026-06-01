import { CGFobject, CGFappearance } from "../lib/CGF.js";

// A downward-pointing arrow marker that hovers over a hay bale when the wagon
// gets close. Modelled in local space pointing down -y: the cone tip sits at
// y = 0 and the shaft rises to +y, so a caller places the tip at the desired
// hover point. Drawn with an emissive look so it reads as a UI marker whatever
// the sun is doing, and with face culling off (see HayBaleField.displayArrows)
// so the thin shaft is solid from any angle without fussing over winding.
export class Arrow extends CGFobject {
    constructor(scene) {
        super(scene);

        this.slices = 16; // cone facets
        this.head_radius = 0.5; // cone base radius
        this.head_height = 0.9; // tip at y = 0, base ring at y = head_height
        this.shaft_half = 0.16; // half-width of the square shaft
        this.shaft_top = 2.1; // shaft rises from the cone base to here

        this.initBuffers();
        this.initMaterials();
    }

    initMaterials() {
        // Self-lit amber: emission carries the colour (the scene's surfaces run
        // their own shaders, so the default CGF lights may contribute nothing),
        // while the diffuse/ambient terms add a little shading if lights are on.
        this.material = new CGFappearance(this.scene);
        this.material.setAmbient(0.25, 0.18, 0.0, 1);
        this.material.setDiffuse(0.95, 0.72, 0.06, 1);
        this.material.setSpecular(0.2, 0.2, 0.1, 1);
        this.material.setShininess(20.0);
        this.material.setEmission(0.95, 0.7, 0.05, 1);
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        const R = this.head_radius;
        const yb = this.head_height;

        // Cone-surface normal: outward in the horizontal and tilted downward by the
        // slope, normalized once and reused per slice direction (tip is at y = 0).
        const m = yb / R;
        const nlen = Math.hypot(m, 1) || 1;
        const nh = m / nlen; // horizontal weight
        const ny = -1 / nlen; // (downward) vertical weight

        let idx = 0;

        // --- Cone head: a fan of facets from the tip up to the base ring. ---
        for (let i = 0; i < this.slices; i++) {
            const a0 = (i / this.slices) * 2 * Math.PI;
            const a1 = ((i + 1) / this.slices) * 2 * Math.PI;
            const am = (a0 + a1) / 2; // tip-vertex normal direction
            const c0 = Math.cos(a0);
            const s0 = Math.sin(a0);
            const c1 = Math.cos(a1);
            const s1 = Math.sin(a1);

            this.vertices.push(0, 0, 0);
            this.normals.push(nh * Math.cos(am), ny, nh * Math.sin(am));
            this.texCoords.push(0.5, 1);

            this.vertices.push(R * c0, yb, R * s0);
            this.normals.push(nh * c0, ny, nh * s0);
            this.texCoords.push(i / this.slices, 0);

            this.vertices.push(R * c1, yb, R * s1);
            this.normals.push(nh * c1, ny, nh * s1);
            this.texCoords.push((i + 1) / this.slices, 0);

            this.indices.push(idx, idx + 1, idx + 2);
            idx += 3;
        }

        // --- Cone base cap (faces up, closes the head under the shaft). ---
        const capCenter = idx;
        this.vertices.push(0, yb, 0);
        this.normals.push(0, 1, 0);
        this.texCoords.push(0.5, 0.5);
        idx++;
        for (let i = 0; i <= this.slices; i++) {
            const a = (i / this.slices) * 2 * Math.PI;
            this.vertices.push(R * Math.cos(a), yb, R * Math.sin(a));
            this.normals.push(0, 1, 0);
            this.texCoords.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
            idx++;
            if (i > 0) this.indices.push(capCenter, idx - 2, idx - 1);
        }

        // --- Shaft: a square column from the cone base up to shaft_top. ---
        const h = this.shaft_half;
        const addQuad = (p0, p1, p2, p3, nx, nyy, nz) => {
            const base = idx;
            for (const p of [p0, p1, p2, p3]) {
                this.vertices.push(p[0], p[1], p[2]);
                this.normals.push(nx, nyy, nz);
            }
            this.texCoords.push(0, 0, 1, 0, 1, 1, 0, 1);
            this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            idx += 4;
        };

        const y0 = yb;
        const y1 = this.shaft_top;
        addQuad([-h, y0, h], [h, y0, h], [h, y1, h], [-h, y1, h], 0, 0, 1); // +z
        addQuad([h, y0, -h], [-h, y0, -h], [-h, y1, -h], [h, y1, -h], 0, 0, -1); // -z
        addQuad([h, y0, h], [h, y0, -h], [h, y1, -h], [h, y1, h], 1, 0, 0); // +x
        addQuad([-h, y0, -h], [-h, y0, h], [-h, y1, h], [-h, y1, -h], -1, 0, 0); // -x
        addQuad([-h, y1, h], [h, y1, h], [h, y1, -h], [-h, y1, -h], 0, 1, 0); // top cap

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    // Emit the arrow geometry under whatever shader/material is currently active.
    // Pairs with a one-time material.apply() in HayBaleField so a whole cluster of
    // markers draws under a single activation.
    displayShape() {
        super.display();
    }
}
