import { CGFobject } from "../../../lib/CGF.js";
import { buildArchProfile } from "./CoverUtils.js";

export class CoverBeam extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, thickness, slices) {
        super(scene);
        this.thickness = thickness;
        this.slices = slices;
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        let path = buildArchProfile(2.1, this.slices, 0);

        const profileOffsets = [
            { dx: -this.thickness, dz: this.thickness },
            { dx: -this.thickness, dz: -this.thickness },
            { dx: this.thickness, dz: -this.thickness },
            { dx: this.thickness, dz: this.thickness },
        ];

        for (let p = 0; p < path.length; p++) {
            let point = path[p];

            for (let i = 0; i < 4; i++) {
                let offset = profileOffsets[i];

                let vx = point.x + offset.dx * point.nx;
                let vy = point.y + offset.dx * point.ny;
                let vz = offset.dz;

                this.vertices.push(vx, vy, vz);

                let signX = Math.sign(offset.dx);
                let signZ = Math.sign(offset.dz);

                let nx = point.nx * signX;
                let ny = point.ny * signX;
                let nz = signZ;

                this.normals.push(nx, ny, nz);

                this.texCoords.push(i / 3, p / (path.length - 1));
            }
        }

        for (let p = 0; p < path.length - 1; p++) {
            let currentRing = p * 4;
            let nextRing = (p + 1) * 4;

            for (let i = 0; i < 4; i++) {
                let nextSide = (i + 1) % 4;

                let quad0 = currentRing + i;
                let quad1 = currentRing + nextSide;
                let quad2 = nextRing + i;
                let quad3 = nextRing + nextSide;

                this.indices.push(quad0, quad1, quad2);
                this.indices.push(quad1, quad3, quad2);
            }
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
