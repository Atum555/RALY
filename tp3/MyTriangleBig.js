import { CGFobject } from "../lib/CGF.js";

/**
 * MyTriangleBig
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyTriangleBig extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [
            // Front
            -2, 0, 0,
             0, 2, 0,
             2, 0, 0,

            // Back
            -2, 0, 0,
             0, 2, 0,
             2, 0, 0
        ];

        this.indices = [
            // Front
            2, 1, 0,

            // Back
            3, 4, 5
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
