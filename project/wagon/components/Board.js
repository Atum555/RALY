import { CGFobject } from "../../../lib/CGF.js";
import { WagonWoodMaterial } from "../materials/WagonWoodMaterial.js";

/**
 * Board
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class Board extends CGFobject {
    constructor(scene,length,topWidth,bottomWidth) {
        super(scene);
        this.length = length;
        this.topWidth = topWidth;
        this.bottomWidth = bottomWidth;
        this.material = new WagonWoodMaterial(scene);
        this.initBuffers();
    }

    display() {
        this.material.apply();
        super.display();
    }

    initBuffers() {
        let bW = this.bottomWidth / 2;
        let tW = this.topWidth / 2;
        let halfLen = this.length / 2;

        this.vertices = [
            // bottom face (trapezoid from front to back)
            -tW, 0, halfLen,
            tW, 0, halfLen,
            -bW, 0, -halfLen,
            bW, 0, -halfLen,

            // top face (trapezoid from front to back)
            -tW, 0.25, halfLen,
            tW, 0.25, halfLen,
            -bW, 0.25, -halfLen,
            bW, 0.25, -halfLen,

            // front face
            -tW, 0, halfLen,
            tW, 0, halfLen,
            -tW, 0.25, halfLen,
            tW, 0.25, halfLen,

            // back face
            -bW, 0, -halfLen,
            bW, 0, -halfLen,
            -bW, 0.25, -halfLen,
            bW, 0.25, -halfLen,

            // left face
            -tW, 0, halfLen,
            -tW, 0.25, halfLen,
            -bW, 0, -halfLen,
            -bW, 0.25, -halfLen,

            // right face
            tW, 0, halfLen,
            tW, 0.25, halfLen,
            bW, 0, -halfLen,
            bW, 0.25, -halfLen,
        ];

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
}