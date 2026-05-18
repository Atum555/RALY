import { CGFobject } from "../../lib/CGF.js";

/**
 * Beam
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class Beam extends CGFobject {
    constructor(scene,length,segments) {
        super(scene);
        this.length = length;
        this.segments = segments;
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [
            // Front face
            -0.125, -0.125,  (this.length / 2),
             0.125, -0.125,  (this.length / 2),
             0.125,  0.125,  (this.length / 2),
            -0.125,  0.125,  (this.length / 2),

            // Back face
            -0.125, -0.125, -(this.length / 2),
            -0.125,  0.125, -(this.length / 2),
             0.125,  0.125, -(this.length / 2),
             0.125, -0.125, -(this.length / 2),

            // Left face
            -0.125,  0.125,  (this.length / 2),
            -0.125, -0.125, -(this.length / 2),
            -0.125, -0.125,  (this.length / 2),
            -0.125,  0.125, -(this.length / 2),

            // Right face
             0.125, -0.125, -(this.length / 2),
             0.125,  0.125, -(this.length / 2),
             0.125,  0.125,  (this.length / 2),
             0.125, -0.125,  (this.length / 2),

            // Top face
            -0.125,  0.125, -(this.length / 2),
            -0.125,  0.125,  (this.length / 2),
             0.125,  0.125,  (this.length / 2),
             0.125,  0.125, -(this.length / 2),

            // Bottom face
            -0.125, -0.125, -(this.length / 2),
             0.125, -0.125, -(this.length / 2),
             0.125, -0.125,  (this.length / 2),
            -0.125, -0.125,  (this.length / 2)
        ];

        this.indices = [
            0, 1, 2,
            0, 2, 3,

            4, 5, 6,
            4, 6, 7,

            8, 9, 10,
            8, 11, 9,

            12, 13, 14,
            12, 14, 15,

            16, 17, 18,
            16, 18, 19,

            20, 21, 22,
            20, 22, 23
        ];

        this.normals = [
            // Front
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,

            // Back
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,

            // Left
            -1,  0,  0,
            -1,  0,  0,
            -1,  0,  0,
            -1,  0,  0,

            // Right
             1,  0,  0,
             1,  0,  0,
             1,  0,  0,
             1,  0,  0,

            // Top
             0,  1,  0,
             0,  1,  0,
             0,  1,  0,
             0,  1,  0,

            // Bottom
             0, -1,  0,
             0, -1,  0,
             0, -1,  0,
             0, -1,  0
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}