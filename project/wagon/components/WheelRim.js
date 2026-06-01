import { CGFobject } from "../../../lib/CGF.js";

export class WheelRim extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, radius, thickness, width, slices) {
        super(scene);
        this.radius = radius;
        this.thickness = thickness;
        this.width = width;
        this.slices = slices;

        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        const profileOffsets = [
            { dr: 0, dz: -this.width / 2 },
            { dr: 0, dz: this.width / 2 },
            { dr: this.thickness, dz: -this.width / 2 },
            { dr: this.thickness, dz: this.width / 2 },
        ];

        let angle = 0;
        let step = (2 * Math.PI) / this.slices;
        for (let s = 0; s <= this.slices; s++) {
            let cosA = Math.cos(angle);
            let sinA = Math.sin(angle);

            for (let i = 0; i < 8; i++) {
                let offset = profileOffsets[i % 4];
                let currentRadius = this.radius + offset.dr;

                let x = currentRadius * cosA;
                let y = currentRadius * sinA;
                let z = offset.dz;
                this.vertices.push(x, y, z);

                // Inner faces inward, outer faces outward
                let normalSign = offset.dr === 0 ? -1 : 1;
                let nx = i <= 3 ? cosA * normalSign : 0;
                let ny = i <= 3 ? sinA * normalSign : 0;
                let nz = i <= 3 ? 0 : 1 * Math.sign(offset.dz);

                this.normals.push(nx, ny, nz);

                let u = s / this.slices;
                let v = i / 3;
                this.texCoords.push(u, v);
            }

            angle += step;
        }

        for (let s = 0; s < this.slices; s++) {
            let currentRing = s * 8;
            let nextRing = (s + 1) * 8;

            // outer edge
            let o0 = currentRing,
                o1 = currentRing + 1,
                o2 = nextRing,
                o3 = nextRing + 1;
            // inner edge
            let i0 = currentRing + 2,
                i1 = currentRing + 3,
                i2 = nextRing + 2,
                i3 = nextRing + 3;
            // left edge
            let l0 = currentRing + 4,
                l1 = currentRing + 6,
                l2 = nextRing + 4,
                l3 = nextRing + 6;
            // right edge
            let r0 = currentRing + 5,
                r1 = currentRing + 7,
                r2 = nextRing + 5,
                r3 = nextRing + 7;

            this.indices.push(o0, o1, o2);
            this.indices.push(o1, o3, o2);
            this.indices.push(i0, i2, i1);
            this.indices.push(i1, i2, i3);
            this.indices.push(l0, l2, l1);
            this.indices.push(l1, l2, l3);
            this.indices.push(r0, r1, r2);
            this.indices.push(r1, r3, r2);
        }
        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    // =====================================================
    // Display
    // =====================================================
    // Display is inherited from CGFobject; rendering runs under the body shader
    // (set by Wagon.applyBodyShader), which provides the wood texture + shadows.
}
