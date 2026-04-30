import { CGFobject } from "../../lib/CGF.js";

/**
 * Rock
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class Rock extends CGFobject {
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