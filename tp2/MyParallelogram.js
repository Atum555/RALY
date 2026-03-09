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
        // prettier-ignore
        this.vertices = [
            0, 0, 0, // 0
            2, 0, 0, // 1
            1, 1, 0, // 2
            3, 1, 0  // 3
        ];

        // Clockwise is back visibility, counterclockwise is front visibility
        // prettier-ignore
        this.indices = [
            1, 2, 0,
            3, 2, 1,
            0, 2, 1,
            1, 2, 3
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }
}
