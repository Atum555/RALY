import { CGFobject } from "../../../lib/CGF.js";
import { BarnWoodMaterial } from "./materials/BarnWoodMaterial.js";

export class Cube extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

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
        this.material = new BarnWoodMaterial(this.scene);
        this.initBuffers();
    }

    // =====================================================
    // Display
    // =====================================================

    display(){
        this.material.apply();
        super.display();
    }

    // =====================================================
    // Buffers
    // =====================================================

    // prettier-ignore
    initBuffers() {
        const t = this.top;
        const h = this.halfOpening;
        const hl = this.halfLength;
        const w = this.halfWidth;
        const hb = this.headerBottom;

        this.vertices = [
            // Front face
             -w,  0.2,  hl,
              w,  0.2,  hl,
              w,  t,    hl,
             -w,  t,    hl,

            // Back face
            -w, 0.2, -hl,
            -w,  t, -hl,
             w,  t, -hl,
             w, 0.2, -hl,

            // Left face
            -w, 0.2,  -hl,
            -w, 0.2,   hl,
            -w,  t,   hl,
            -w,  t,  -hl,

            // Right face
             w, 0.2,  -hl,
             w,  t,  -hl,
             w,  t,   hl,
             w, 0.2,   hl,

            // Top face
            -w,  t, -hl,
            -w,  t,  hl,
             w,  t,  hl,
             w,  t, -hl,

            // Bottom face
            -w, 0.2, -hl,
             w, 0.2, -hl,
             w, 0.2,  hl,
            -w, 0.2,  hl,

            // Front opening
             -h, 0.2,  hl,
              h, 0.2,  hl,
              h, hb,  hl,
             -h, hb,  hl,
              h, t,   hl,
             -h, t,   hl,

            // Back opening
             -h, 0.2,  -hl,
              h, 0.2,  -hl,
              h, hb, -hl,
             -h, hb, -hl,
              h, t,  -hl,
             -h, t,  -hl,

            // Duplicated opening corners
             -h, t,   hl,
              h, t,   hl,
             -h, t,  -hl,
              h, t,  -hl,

            // Front door closure
             -h, 0.2,  hl,
              h, 0.2,  hl,
              h, hb,  hl,
             -h, hb,  hl,

            // Back door closure
             -h, 0.2,  -hl,
              h, 0.2,  -hl,
              h, hb, -hl,
             -h, hb, -hl,
        ];

        // prettier-ignore
        this.indices = [
            // Front left wall
             0, 24, 36,
             0, 36,  3,
             0, 36, 24,
             0,  3, 36,

            // Front right wall
            25,  1,  2,
            25,  2, 37,
            25,  2,  1,
            25, 37,  2,

            // Front top header
            27, 26, 28,
            27, 28, 29,
            27, 28, 26,
            27, 29, 28,

            // Back left wall
             4, 30, 38,
             4, 38,  5,
             4, 38, 30,
             4,  5, 38,

            // Back right wall
            31,  7,  6,
            31,  6, 39,
            31,  6,  7,
            31, 39,  6,

            // Back top header
            33, 32, 34,
            33, 34, 35,
            33, 34, 32,
            33, 35, 34,

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

            // Front door
            40, 41, 42,
            40, 42, 43,
            40, 42, 41,
            40, 43, 42,

            // Back door
            44, 45, 46,
            44, 46, 47,
            44, 46, 45,
            44, 47, 46,
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

            // Top unused
             0,  1,  0,
             0,  1,  0,
             0,  1,  0,
             0,  1,  0,

            // Bottom
             0, -1,  0,
             0, -1,  0,
             0, -1,  0,
             0, -1,  0,

            // Front opening
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,

            // Back opening
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,

            // Duplicated corners
             0,  0,  1,
             0,  0,  1,
             0,  0, -1,
             0,  0, -1,

            // Front door
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,
             0,  0,  1,

            // Back door
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
             0,  0, -1,
        ];

        const uLeft = 0;
        const uInnerL = 2 * (w - h) / w;
        const uInnerR = 2 * (w + h) / w;
        const uRight = 4;
        const vBottom = t > 0 ? 1 - 0.2 / t : 1;
        const vHeader = t > 0 ? 1 - hb / t : 0;
        const vTop = 0;

        // prettier-ignore
        this.texCoords = [
            // Front face
            uLeft, vBottom,
            uRight, vBottom,
            uRight, vTop,
            uLeft, vTop,

            // Back face
            uLeft, vBottom,
            uLeft, vTop,
            uRight, vTop,
            uRight, vBottom,

            // Left face
            0, 1,
            4, 1,
            4, 0,
            0, 0,

            // Right face
            0, 1,
            0, 0,
            4, 0,
            4, 1,

            // Top unused
            0, 1,
            4, 1,
            4, 0,
            0, 0,

            // Bottom face
            0, 1,
            4, 1,
            4, 0,
            0, 0,

            // Front opening
            uInnerL, vBottom,
            uInnerR, vBottom,
            uInnerR, vHeader,
            uInnerL, vHeader,
            uInnerR, vTop,
            uInnerL, vTop,

            // Back opening
            uInnerL, vBottom,
            uInnerR, vBottom,
            uInnerR, vHeader,
            uInnerL, vHeader,
            uInnerR, vTop,
            uInnerL, vTop,

            // Duplicated corners
            uInnerL, vTop,
            uInnerR, vTop,
            uInnerL, vTop,
            uInnerR, vTop,

            // Front door
            0, 1,
            1, 1,
            1, 0,
            0, 0,

            // Back door
            0, 1,
            1, 1,
            1, 0,
            0, 0,
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
