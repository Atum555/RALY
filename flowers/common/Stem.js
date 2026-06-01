import { CGFobject } from "../../lib/CGF.js";
import { StemMaterial } from "../materials/StemMaterial.js";

export class Stem extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, radius, color) {
        super(scene);
        this.slices = 6;
        this.scale = radius;
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

        let ang = 0;
        let alphaAng = 2 * Math.PI / this.slices;

        for (let i = 0; i <= this.slices; i++) {
            this.vertices.push(this.scale * Math.cos(ang), 0, -Math.sin(ang) * this.scale);
            this.vertices.push(this.scale * Math.cos(ang), 1, -Math.sin(ang) * this.scale);
            this.normals.push(Math.cos(ang), 0, -Math.sin(ang));
            this.normals.push(Math.cos(ang), 0, -Math.sin(ang));

            if (i < this.slices) {
                this.indices.push(2 * i, 2 * i + 2, 2 * i + 1);
                this.indices.push(2 * i + 1, 2 * i + 2, 2 * i + 3);
            }
            ang += alphaAng;
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
