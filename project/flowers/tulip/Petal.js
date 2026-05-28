import { CGFobject } from "../../../../lib/CGF.js";

export class Petal extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, width, height) {
        super(scene);
        this.w = width;
        this.h = height;
        this.slices = 5;
        this.stacks = 5;
        this.initBuffers();
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
            let y = v * this.h;
            let widthFactor = Math.pow(Math.sin(v * Math.PI), 0.65);
            let zOffset = Math.sin(v * Math.PI * 0.8) * (this.w * 0.6);

            for (let i = 0; i <= this.slices; i++) {
                let u = i / this.slices;
                let x = (u - 0.5) * this.w * widthFactor;
                let localZ =
                    zOffset +
                    (1.0 - Math.pow((u - 0.5) * 2, 2)) * (this.w * 0.15);

                this.vertices.push(x, y, localZ);
                this.normals.push(0, 0.6, 0.4);
                this.texCoords.push(u, v);
            }
        }

        for (let j = 0; j < this.stacks; j++) {
            for (let i = 0; i < this.slices; i++) {
                let rowLength = this.slices + 1;
                let p0 = j * rowLength + i;
                let p1 = p0 + 1;
                let p2 = (j + 1) * rowLength + i;
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
