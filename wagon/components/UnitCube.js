import { CGFobject } from "../../lib/CGF.js";

export class UnitCube extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        this.initBuffers();
    }

    // =====================================================
    // Buffers
    // =====================================================

    // prettier-ignore
    initBuffers() {
        this.vertices = [
            // Front face
            -0.5, -0.5,  0.5,
             0.5, -0.5,  0.5,
             0.5,  0.5,  0.5,
            -0.5,  0.5,  0.5,

            // Back face
            -0.5, -0.5, -0.5,
            -0.5,  0.5, -0.5,
             0.5,  0.5, -0.5,
             0.5, -0.5, -0.5,

            // Left face
            -0.5, -0.5, -0.5,
            -0.5, -0.5,  0.5,
            -0.5,  0.5,  0.5,
            -0.5,  0.5, -0.5,

            // Right face
             0.5, -0.5, -0.5,
             0.5,  0.5, -0.5,
             0.5,  0.5,  0.5,
             0.5, -0.5,  0.5,

            // Top face
            -0.5,  0.5, -0.5,
            -0.5,  0.5,  0.5,
             0.5,  0.5,  0.5,
             0.5,  0.5, -0.5,

            // Bottom face
            -0.5, -0.5, -0.5,
             0.5, -0.5, -0.5,
             0.5, -0.5,  0.5,
            -0.5, -0.5,  0.5
        ];

        // prettier-ignore
        this.indices = [
            0, 1, 2,
            0, 2, 3,

            4, 5, 6,
            4, 6, 7,

            8, 9, 10,
            8, 10, 11,

            12, 13, 14,
            12, 14, 15,

            16, 17, 18,
            16, 18, 19,

            20, 21, 22,
            20, 22, 23
        ];

        this.texCoords = [
            // Front
            0, 0,  1, 0,  0, 1,  1, 1,
            // Back
            0, 0,  1, 0,  0, 1,  1, 1,
            // Left
            0, 0,  1, 0,  0, 1,  1, 1,
            // Right
            0, 0,  1, 0,  0, 1,  1, 1,
            // Top
            0, 0,  1, 0,  0, 1,  1, 1,
            // Bottom
            0, 0,  1, 0,  0, 1,  1, 1,
        ];

        // prettier-ignore
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

    // =====================================================
    // Display
    // =====================================================
    // Display is inherited from CGFobject; rendering runs under the body shader
    // (set by Wagon.applyBodyShader), which provides the wood texture + shadows.
}
