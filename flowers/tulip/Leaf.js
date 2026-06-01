import { CGFobject } from "../../lib/CGF.js";
import { StemMaterial } from "../materials/StemMaterial.js";

export class Leaf extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, scale, color, slices, stacks) {
        super(scene);
        this.scale = scale;
        this.slices = slices;
        this.stacks = stacks;
        this.material = new StemMaterial(scene, color);
        this.initBuffers();
    }

    // =====================================================
    // Display
    // =====================================================

    setDefaultAppearance() {
        this.material.apply();
    }

    display() {
        super.display();
    }

    // =====================================================
    // Buffers
    // =====================================================

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        for (let j = 0; j <= this.stacks; j++) {
            let v = j / this.stacks;
            let y = v * this.scale;
            let widthFactor = Math.sin(v * Math.PI) * 0.6;
            let zCurve = Math.sin(v * Math.PI * 0.6) * 0.3;

            for (let i = 0; i <= this.slices; i++) {
                let u = i / this.slices;
                let x = (u - 0.5) * widthFactor * this.scale;
                let z = zCurve * this.scale;

                this.vertices.push(x, y, z);
                this.normals.push(0, 0.6, 0.4);
                this.texCoords.push(u, v);
            }
        }

        for (let j = 0; j < this.stacks; j++) {
            for (let i = 0; i < this.slices; i++) {
                let row = this.slices + 1;
                let p0 = j * row + i;
                let p1 = p0 + 1;
                let p2 = (j + 1) * row + i;
                let p3 = p2 + 1;

                this.indices.push(p0, p1, p2);
                this.indices.push(p1, p3, p2);
                this.indices.push(p0, p2, p1);
                this.indices.push(p1, p2, p3);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
