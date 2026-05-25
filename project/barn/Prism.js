import { CGFobject } from "../../../lib/CGF.js";

export class Prism extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, width, height, length) {
        super(scene);
        this.width = width;
        this.height = height;
        this.length = length;

        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        const hw = this.width / 2;
        const hl = this.length / 2;

        const profile = [
            { x: -hw, y: 0 },
            { x: -hw * 0.7, y: this.height * 0.45 },
            { x: 0, y: this.height },
            { x: hw * 0.7, y: this.height * 0.45 },
            { x: hw, y: 0 },
        ];

        for (let i = 0; i < profile.length; i++) {
            this.vertices.push(profile[i].x, profile[i].y, -hl);
            this.normals.push(0, 0, -1);
            this.texCoords.push(i / 4, 0);
        }

        for (let i = 0; i < profile.length; i++) {
            this.vertices.push(profile[i].x, profile[i].y, hl);
            this.normals.push(0, 0, 1);
            this.texCoords.push(i / 4, 1);
        }

        for (let i = 0; i < profile.length - 1; i++) {
            let b0 = i; // Back edge current point
            let b1 = i + 1; // Back edge next point
            let f0 = i + profile.length; // Front edge current point
            let f1 = i + profile.length + 1; // Front edge next point

            // Triangle 1
            this.indices.push(b0, f0, b1);
            // Triangle 1 inv
            this.indices.push(b1, f0, b0);
            // Triangle 2
            this.indices.push(b1, f0, f1);
            // Triangle 2 inv
            this.indices.push(b1, f1, f0);
        }

        for (let i = 1; i < profile.length - 1; i++) {
            this.indices.push(0, i + 1, i);
            this.indices.push(0, i, i + 1); // Inverse face
        }

        const frontStart = profile.length;
        for (let i = 1; i < profile.length - 1; i++) {
            this.indices.push(frontStart, frontStart + i, frontStart + i + 1);
            this.indices.push(frontStart, frontStart + i + 1, frontStart + i); // Inverse face
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
