import { CGFobject } from "../lib/CGF.js";

/**
 * MyDiamond
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyDiamond extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [
            // Front face
            -1,  0,  0,
             0, -1,  0,
             0,  1,  0,
             1,  0,  0,

            // Back face
            -1,  0,  0,
             0, -1,  0,
             0,  1,  0,
             1,  0,  0
        ];

        this.indices = [
            // Front
            0, 1, 2,
            1, 3, 2,

            // Back
            6, 5, 4,
            6, 7, 5
        ];

        this.normals = [
            // Front
             0, 0, 1,
             0, 0, 1,
             0, 0, 1,
             0, 0, 1,

            // Back
             0, 0, -1,
             0, 0, -1,
             0, 0, -1,
             0, 0, -1
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
