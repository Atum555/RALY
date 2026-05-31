import { CGFobject } from "../../../lib/CGF.js";

export class Board extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, length, top_width, bottom_width) {
        super(scene);
        this.length = length;
        this.top_width = top_width;
        this.bottom_width = bottom_width;
        this.initBuffers();
    }

    initBuffers() {
        const THICKNESS = 0.25;

        let top_half = this.top_width / 2;
        let bottom_half = this.bottom_width / 2;
        let half_length = this.length / 2;
        let height = THICKNESS;

        // prettier-ignore
        this.vertices = [
            // bottom face (trapezoid from front to back)
            -top_half, 0, half_length,
            top_half, 0, half_length,
            -bottom_half, 0, -half_length,
            bottom_half, 0, -half_length,

            // top face (trapezoid from front to back)
            -top_half, height, half_length,
            top_half, height, half_length,
            -bottom_half, height, -half_length,
            bottom_half, height, -half_length,

            // front face
            -top_half, 0, half_length,
            top_half, 0, half_length,
            -top_half, height, half_length,
            top_half, height, half_length,

            // back face
            -bottom_half, 0, -half_length,
            bottom_half, 0, -half_length,
            -bottom_half, height, -half_length,
            bottom_half, height, -half_length,

            // left face
            -top_half, 0, half_length,
            -top_half, height, half_length,
            -bottom_half, 0, -half_length,
            -bottom_half, height, -half_length,

            // right face
            top_half, 0, half_length,
            top_half, height, half_length,
            bottom_half, 0, -half_length,
            bottom_half, height, -half_length,
        ];

        // prettier-ignore
        this.indices = [
            // bottom
            0, 2, 1,
            1, 2, 3,
            // top
            4, 5, 6,
            5, 7, 6,
            // front
            8, 9, 10,
            9, 11, 10,
            // back
            12, 14, 13,
            13, 14, 15,
            // left
            16, 17, 18,
            17, 19, 18,
            // right
            20, 22, 21,
            22, 23, 21,
        ];

        this.texCoords = [
            // bottom
            0, 0,  1, 0,  0, 1,  1, 1,
            // top
            0, 0,  1, 0,  0, 1,  1, 1,
            // front
            0, 0,  1, 0,  0, 1,  1, 1,
            // back
            0, 0,  1, 0,  0, 1,  1, 1,
            // left
            0, 0,  1, 0,  0, 1,  1, 1,
            // right
            0, 0,  1, 0,  0, 1,  1, 1,
        ];

        // prettier-ignore
        this.normals = [
            // bottom
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            // top
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            // front
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            // back
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            // left
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            // right
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    // =====================================================
    // Display
    // =====================================================
}
