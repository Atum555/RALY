import { CGFobject } from "../../lib/CGF.js";

/**
 * Tree
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class Tree extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}