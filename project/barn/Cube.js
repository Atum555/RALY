import { CGFobject } from "../../../lib/CGF.js";

export class Cube extends CGFobject {
    constructor(scene, top, opening, length, header, width) {
        super(scene);
        this.top = top;
        this.opening = opening;
        this.length = length;
        this.width = width;
        this.halfOpening = opening / 2;
        this.halfLength = length / 2;
        this.halfWidth = width / 2;
        this.headerBottom = header;
        this.initBuffers();
    }

    display() {
        super.display();
    }

    // prettier-ignore
    initBuffers() {
        const t = this.top;
        const h = this.halfOpening;
        const hl = this.halfLength;
        const w = this.halfWidth;
        const hb = this.headerBottom;

        this.vertices = [
            // Front face
             -w,  0.0,  hl,
              w,  0.0,  hl,
              w,  t,    hl,
             -w,  t,    hl,

            // Back face
            -w, 0, -hl,
            -w,  t, -hl,
             w,  t, -hl,
             w, 0, -hl,

            // Left face
            -w, 0,  -hl,
            -w, 0,   hl,
            -w,  t,  hl,
            -w,  t, -hl,

            // Right face
             w, 0,  -hl,
             w,  t, -hl,
             w,  t,  hl,
             w, 0,   hl,

            // Top face (unused, kept for reuse)
            -w,  t, -hl,
            -w,  t,  hl,
             w,  t,  hl,
             w,  t, -hl,

            // Bottom face
            -w, 0, -hl,
             w, 0, -hl,
             w, 0,  hl,
            -w, 0,  hl,

            // Front opening edges
             -h, 0,   hl,
              h, 0,   hl,
              h, hb,  hl,
             -h, hb,  hl,
              h, t,   hl,
             -h, t,   hl,

            // Back opening edges
             -h, 0,  -hl,
              h, 0,  -hl,
              h, hb, -hl,
             -h, hb, -hl,
              h, t,  -hl,
             -h, t,  -hl,
        ];

        // prettier-ignore
        this.indices = [
            // Front left wall
             0, 24, 29,
             0, 29,  3,
             0, 29, 24,
             0,  3, 29,

            // Front right wall
            25,  1,  2,
            25,  2, 28,
            25,  2,  1,
            25, 28,  2,

            // Front top header
            27, 26, 28,
            27, 28, 29,
            27, 28, 26,
            27, 29, 28,

            // Back left wall
             4, 35, 30,
             4,  5, 35,
             4, 30, 35,
             4, 35,  5,

            // Back right wall
            31,  6,  7,
            31, 34,  6,
            31,  7,  6,
            31,  6, 34,

            // Back top header
            33, 34, 32,
            33, 35, 34,
            33, 32, 34,
            33, 34, 35,

            // Left face
             8,  9, 10,
             8, 10, 11,
             8, 10,  9,
             8, 11, 10,

            // Right face
            12, 13, 14,
            12, 14, 15,
            12, 14, 13,
            12, 15, 14,

            // Bottom face
            20, 22, 21,
            20, 23, 22,
            20, 21, 22,
            20, 22, 23,
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

            // Top (unused)
             0,  1,  0,
             0,  1,  0,
             0,  1,  0,
             0,  1,  0,

            // Bottom
             0, -1,  0,
             0, -1,  0,
             0, -1,  0,
             0, -1,  0,

            // Front opening edges
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,

            // Back opening edges
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
