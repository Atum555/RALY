import { CGFobject } from "../../lib/CGF.js";

export class Beam extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, length, thickness) {
        super(scene);

        this.length = length;
        this.thickness = thickness;
        this.initBuffers();
    }

    // =====================================================
    // Buffers
    // =====================================================

    // prettier-ignore
    initBuffers() {
        this.vertices = [
            // Front face
            -this.thickness, -this.thickness,  (this.length / 2),
             this.thickness, -this.thickness,  (this.length / 2),
             this.thickness,  this.thickness,  (this.length / 2),
            -this.thickness,  this.thickness,  (this.length / 2),

            // Back face
            -this.thickness, -this.thickness, -(this.length / 2),
            -this.thickness,  this.thickness, -(this.length / 2),
             this.thickness,  this.thickness, -(this.length / 2),
             this.thickness, -this.thickness, -(this.length / 2),

            // Left face
            -this.thickness,  this.thickness,  (this.length / 2),
            -this.thickness, -this.thickness, -(this.length / 2),
            -this.thickness, -this.thickness,  (this.length / 2),
            -this.thickness,  this.thickness, -(this.length / 2),

            // Right face
             this.thickness, -this.thickness, -(this.length / 2),
             this.thickness,  this.thickness, -(this.length / 2),
             this.thickness,  this.thickness,  (this.length / 2),
             this.thickness, -this.thickness,  (this.length / 2),

            // Top face
            -this.thickness,  this.thickness, -(this.length / 2),
            -this.thickness,  this.thickness,  (this.length / 2),
             this.thickness,  this.thickness,  (this.length / 2),
             this.thickness,  this.thickness, -(this.length / 2),

            // Bottom face
            -this.thickness, -this.thickness, -(this.length / 2),
             this.thickness, -this.thickness, -(this.length / 2),
             this.thickness, -this.thickness,  (this.length / 2),
            -this.thickness, -this.thickness,  (this.length / 2)
        ];

        // prettier-ignore
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
