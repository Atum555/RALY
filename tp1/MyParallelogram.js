import { CGFobject } from "../lib/CGF.js";

export class MyParallelogram extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        // prettier-ignore
        this.vertices = [
             0,  0,  0,	 // 0
             2,  0,  0,	 // 1
             1,  1,  0,	 // 2
             3,  1,  0,	 // 3
        ];

        // Counter-clockwise reference of vertices
        // prettier-ignore
        this.indices = [
            0, 1, 2,
            2, 1, 3,

            0, 2, 1,
            2, 3, 1,
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
