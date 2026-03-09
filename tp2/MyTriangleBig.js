import { CGFobject } from "../lib/CGF.js";

/**
 * MyTriangleSmall
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyTriangleBig extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        // prettier-ignore
        this.vertices = [
            -2, 0, 0, // 0
            0, 2, 0,  // 1
            2, 0, 0 // 2
        ];

        // prettier-ignore
        this.indices = [
            2, 1, 0
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }
}