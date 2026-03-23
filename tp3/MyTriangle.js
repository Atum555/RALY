import { CGFobject } from "../lib/CGF.js";

export class MyTriangle extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [
            // Front
            -1,  1, 0,
            -1, -1, 0,
             1, -1, 0,

            // Back
            -1,  1, 0,
            -1, -1, 0,
             1, -1, 0
        ];

        this.indices = [
            // Front
            0, 1, 2,

            // Back
            5, 4, 3
        ];

        this.normals = [
            // Front
             0, 0, 1,
             0, 0, 1,
             0, 0, 1,

            // Back
             0, 0, -1,
             0, 0, -1,
             0, 0, -1
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
