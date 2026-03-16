import { CGFobject } from "../lib/CGF.js";

/**
 * MyParallelogram
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyParallelogram extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [
            // Front face
            0, 0, 0,  // 0
            2, 0, 0,  // 1
            1, 1, 0,  // 2
            3, 1, 0,  // 3

            // Back face
            0, 0, 0,  // 4
            2, 0, 0,  // 5
            1, 1, 0,  // 6
            3, 1, 0   // 7
        ];

        this.indices = [
            // Front
            1, 2, 0,
            3, 2, 1,

            // Back
            4, 6, 5,
            5, 6, 7
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
