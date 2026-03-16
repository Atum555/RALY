import { CGFobject } from "../lib/CGF.js";

/**
 * MyTriangleSmall
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyTriangleSmall extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        // prettier-ignore
        this.vertices = [
            -1, 0, 0, // 0
            0, 1, 0,  // 1
            1, 0, 0 // 2
        ];

        // prettier-ignore
        this.indices = [
            2, 1, 0
        ];

        this.normals = [];
        for (var i = 0; i <= 3; i++) {
            this.normals.push(0, 0, 1);
        }
        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }
}
