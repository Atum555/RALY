import { CGFobject } from "../lib/CGF.js";

/**
 * MyUnitCube
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyUnitCube extends CGFobject {
    constructor(scene) {
        super(scene);

        this.initBuffers();
    }

    initBuffers() {
        // prettier-ignore
        this.vertices = [
            -0.5,  -0.5,  -0.5,	 // 0
             0.5, -0.5,  -0.5,	 // 1
             0.5,  0.5,  -0.5,	 // 2
             -0.5, 0.5,  -0.5,  // 3
            -0.5,  -0.5,  0.5,	 // 4
             0.5, -0.5,   0.5,	 // 5
             0.5,  0.5,   0.5,	 // 6
             -0.5, 0.5,   0.5,  // 7

            -0.5,  -0.5,  -0.5,	 // 0
             0.5, -0.5,  -0.5,	 // 1
             0.5,  0.5,  -0.5,	 // 2
             -0.5, 0.5,  -0.5,  // 3
            -0.5,  -0.5,  0.5,	 // 4
             0.5, -0.5,   0.5,	 // 5
             0.5,  0.5,   0.5,	 // 6
             -0.5, 0.5,   0.5,  // 7

            -0.5,  -0.5,  -0.5,	 // 0
             0.5, -0.5,  -0.5,	 // 1
             0.5,  0.5,  -0.5,	 // 2
             -0.5, 0.5,  -0.5,  // 3
            -0.5,  -0.5,  0.5,	 // 4
             0.5, -0.5,   0.5,	 // 5
             0.5,  0.5,   0.5,	 // 6
             -0.5, 0.5,   0.5,  // 7
        ];

        // Counter-clockwise reference of vertices
        // prettier-ignore
        this.indices = [
            // far face
            2,1,0,
            2,0,3,

            // close face
            4,5,6,
            6,7,4,

            // bottom face
            0,5,4,
            0,1,5,

            // upper face
            6,2,3,
            6,3,7,

            // right face
            6,1,2,
            6,5,1,

            // left face
            4, 3, 0,
            4, 7, 3
        ];

        // prettier-ignore
        this.normals = [
            0,-1,0,
            0,-1,0,
            0,1,0,
            0,1,0,
            0,-1,0,
            0,-1,0,
            0,1,0,
            0,1,0,

            0,0,-1,
            0,0,-1,
            0,0,-1,
            0,0,-1,
            0,0,1,
            0,0,1,
            0,0,1,
            0,0,1,
            
            -1,0,0,
            1,0,0,
            1,0,0,
            -1,0,0,
            -1,0,0,
            1,0,0,
            1,0,0,
            -1,0,0,
        ];

        // The defined indices (and corresponding vertices)
        // will be read in groups of three to draw triangles
        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
