import { CGFobject } from "../lib/CGF.js";

export class MyTriangleSmall extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        // prettier-ignore
        this.vertices = [
            -1,  0,  0,	 // 0
             1,  0,  0,	 // 1
             0,  1,  0,	 // 2
        ];

        // Counter-clockwise reference of vertices
        // prettier-ignore
        this.indices = [
            0, 1, 2,
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
