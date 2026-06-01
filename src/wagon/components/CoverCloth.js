import { CGFobject } from "../../lib/CGF.js";
import { ShadowedTexturedMaterial } from "../../core/ShadowedTexturedMaterial.js";
import { buildArchProfile, getBeamZPositions } from "./CoverUtils.js";

export class CoverCloth extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, thickness, slices, nBeams, length, sagFactor) {
        super(scene);
        this.thickness = thickness;
        this.slices = slices;
        this.numBeams = nBeams;
        this.totalLength = length;
        this.sagFactor = sagFactor;
        this.zSegmentsPerInterval = 6;
        this._depth_pass = false;

        this.material = new ShadowedTexturedMaterial(
            this.scene,
            "src/wagon/textures/fabric.jpg",
            "src/wagon/shaders/wagon.vert",
            "src/wagon/shaders/wagon.frag",
            "u_wagon_texture",
        );

        this.initBuffers();
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        if (this._depth_pass) {
            super.display();
            return;
        }
        this.material.apply();
        super.display();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        let archProfile = buildArchProfile(2.13, this.slices, 1.3);
        let beamZPositions = getBeamZPositions(this.numBeams, this.totalLength);

        let totalZLines = 0;

        // Beam intervals
        for (let b = 0; b < this.numBeams - 1; b++) {
            let zStart = beamZPositions[b];
            let zEnd = beamZPositions[b + 1];

            // Extra step on last interval to cap the end
            let steps = this.zSegmentsPerInterval;
            if (b === this.numBeams - 2) steps += 1;

            for (let s = 0; s < steps; s++) {
                let t = s / this.zSegmentsPerInterval;
                let currentZ = zStart + t * (zEnd - zStart);

                // Parabolic sag curve (max at t=0.5)
                let sagCurve = 4 * t * (1 - t);
                let currentMaxSag = 0.15;

                totalZLines++;

                for (let p = 0; p < archProfile.length; p++) {
                    let pathPoint = archProfile[p];

                    // Offset by beam thickness + sag displacement
                    let baseX = pathPoint.x + this.thickness * pathPoint.nx;
                    let baseY = pathPoint.y + this.thickness * pathPoint.ny;
                    let baseZ = currentZ;

                    let pullDirectionX = pathPoint.x > 0 ? -0.2 : 0.2;
                    if (Math.abs(pathPoint.x) < 0.1) pullDirectionX = 0;

                    let sagX = pullDirectionX * currentMaxSag * sagCurve * this.sagFactor;
                    let sagY = -1.0 * currentMaxSag * sagCurve * this.sagFactor;

                    let finalX = baseX + sagX;
                    let finalY = baseY + sagY;
                    let finalZ = baseZ;

                    this.vertices.push(finalX, finalY, finalZ);

                    let u = p / (archProfile.length - 1);
                    let v = (currentZ + this.totalLength / 2) / this.totalLength;
                    this.texCoords.push(u, v);
                }
            }
        }

        let numXVertices = archProfile.length;
        for (let z = 0; z < totalZLines; z++) {
            for (let x = 0; x < numXVertices; x++) {
                let idx = (z * numXVertices + x) * 3;

                // Clamped neighbor indices
                let xNext = x < numXVertices - 1 ? x + 1 : x;
                let xPrev = x > 0 ? x - 1 : x;
                let zNext = z < totalZLines - 1 ? z + 1 : z;
                let zPrev = z > 0 ? z - 1 : z;

                let idxXNext = (z * numXVertices + xNext) * 3;
                let idxXPrev = (z * numXVertices + xPrev) * 3;
                let idxZNext = (zNext * numXVertices + x) * 3;
                let idxZPrev = (zPrev * numXVertices + x) * 3;

                let tx = [
                    this.vertices[idxXNext] - this.vertices[idxXPrev],
                    this.vertices[idxXNext + 1] - this.vertices[idxXPrev + 1],
                    this.vertices[idxXNext + 2] - this.vertices[idxXPrev + 2],
                ];
                let tz = [
                    this.vertices[idxZNext] - this.vertices[idxZPrev],
                    this.vertices[idxZNext + 1] - this.vertices[idxZPrev + 1],
                    this.vertices[idxZNext + 2] - this.vertices[idxZPrev + 2],
                ];

                let nx = tx[1] * tz[2] - tx[2] * tz[1];
                let ny = tx[2] * tz[0] - tx[0] * tz[2];
                let nz = tx[0] * tz[1] - tx[1] * tz[0];

                let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (len === 0) len = 1;
                this.normals.push(-nx / len, -ny / len, -nz / len);
            }
        }

        let numX = archProfile.length;
        for (let z = 0; z < totalZLines - 1; z++) {
            for (let x = 0; x < numX - 1; x++) {
                let currentLine = z * numX;
                let nextLine = (z + 1) * numX;

                let p0 = currentLine + x;
                let p1 = currentLine + (x + 1);
                let p2 = nextLine + x;
                let p3 = nextLine + (x + 1);

                this.indices.push(p0, p2, p1);
                this.indices.push(p1, p2, p3);
                this.indices.push(p0, p1, p2);
                this.indices.push(p1, p3, p2);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
