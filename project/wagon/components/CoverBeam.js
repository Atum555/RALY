import { CGFobject } from "../../../lib/CGF.js";
import { WagonWoodMaterial } from "../materials/WagonWoodMaterial.js";

export class CoverBeam extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, thickness, slices) {
        super(scene);
        this.thickness = thickness;
        this.slices = slices;
        this.material = new WagonWoodMaterial(scene);
        this.initBuffers();
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.material.apply();
        super.display();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        const alpha = (11 * Math.PI) / 24;
        const boardLength = 4;
        const halfWidth = 2.1;

        const cosAlpha = Math.cos(alpha);
        const sinAlpha = Math.sin(alpha);

        const topX = halfWidth + boardLength * cosAlpha;
        const topY = boardLength * sinAlpha;
        const radius = topX;

        let path = [];

        // first half (straight piece)
        path.push({ x: -halfWidth, y: 0, nx: -sinAlpha, ny: cosAlpha });
        path.push({ x: -topX, y: topY, nx: -sinAlpha, ny: cosAlpha });

        // Curved arch piece (Semicircle from Pi to 0)
        for (let i = 1; i < this.slices; i++) {
            let angle = Math.PI - (i * Math.PI) / this.slices;
            let cx = radius * Math.cos(angle);
            let cy = radius * Math.sin(angle) + topY; // Shift arch so it sits on top of boards
            let nx = Math.cos(angle);
            let ny = Math.sin(angle);
            path.push({ x: cx, y: cy, nx: nx, ny: ny });
        }

        // second half (straight piece)
        path.push({ x: topX, y: topY, nx: sinAlpha, ny: cosAlpha });
        path.push({ x: halfWidth, y: 0, nx: sinAlpha, ny: cosAlpha });

        // Extrude a 4-point square profile along the calculated path
        const profileOffsets = [
            { dx: -this.thickness, dz: this.thickness }, // Point 0
            { dx: -this.thickness, dz: -this.thickness }, // Point 1
            { dx: this.thickness, dz: -this.thickness }, // Point 2
            { dx: this.thickness, dz: this.thickness }, // Point 3
        ];

        // Generate Vertices, Normals, and Textures Coords
        for (let p = 0; p < path.length; p++) {
            let point = path[p];

            for (let i = 0; i < 4; i++) {
                let offset = profileOffsets[i];

                // We shift along the beam's path normal to give the beam its thickness in the XY plane
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

        // Indices
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
}