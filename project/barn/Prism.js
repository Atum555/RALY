import { CGFobject } from "../../../lib/CGF.js";
import { BarnWoodMaterial } from "./materials/BarnWoodMaterial.js";

export class Prism extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, width, height, length) {
        super(scene);
        this.width = width;
        this.height = height;
        this.length = length;
        this.material = new BarnWoodMaterial(this.scene);
        this.initBuffers();
    }

    display() {
        this.material.apply();
        super.display();
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
            this.texCoords.push(i / 4 * 4, 0);
        }

        for (let i = 0; i < profile.length; i++) {
            this.vertices.push(profile[i].x, profile[i].y, hl);
            this.normals.push(0, 0, 1);
            this.texCoords.push(i / 4 * 4, 1);
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

        const backCapStart = this.vertices.length / 3;

        for (let i = 0; i < profile.length; i++) {
            this.vertices.push(profile[i].x, profile[i].y, -hl);
            this.normals.push(0, 0, -1);

            let u = (profile[i].x + hw) / this.width * 4;
            let v = profile[i].y / this.height;
            this.texCoords.push(u, v);
        }

        for (let i = 1; i < profile.length - 1; i++) {
            this.indices.push(backCapStart, backCapStart + i + 1, backCapStart + i);
            this.indices.push(backCapStart, backCapStart + i, backCapStart + i + 1);
        }

        const frontCapStart = this.vertices.length / 3;
        for (let i = 0; i < profile.length; i++) {
            this.vertices.push(profile[i].x, profile[i].y, hl);
            this.normals.push(0, 0, 1);
            let u = (profile[i].x + hw) / this.width * 4;
            let v = profile[i].y / this.height;
            this.texCoords.push(u, v);
        }

        for (let i = 1; i < profile.length - 1; i++) {
            this.indices.push(
                frontCapStart,
                frontCapStart + i,
                frontCapStart + i + 1,
            );
            this.indices.push(
                frontCapStart,
                frontCapStart + i + 1,
                frontCapStart + i,
            );
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
