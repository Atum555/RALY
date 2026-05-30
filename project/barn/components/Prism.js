import { CGFobject } from "../../../lib/CGF.js";

/**
 * Prism
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class Prism extends CGFobject {
    constructor(scene, slices, stacks) {
        super(scene);

        this.slices = slices;
        this.stacks = stacks;

        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];

        var ang = 0;
        var alphaAng = (2 * Math.PI) / this.slices;
        var z = 0;
        var stackZ = 1 / this.stacks;
        for (var j = 0; j < this.stacks; j++) {
            for (var i = 0; i < this.slices; i++) {
                var y1 = Math.sin(ang);
                var y2 = Math.sin(ang + alphaAng);
                var x1 = Math.cos(ang);
                var x2 = Math.cos(ang + alphaAng);

                this.vertices.push(0, 0, z);
                this.vertices.push(x1, -y1, z);
                this.vertices.push(x2, -y2, z);
                this.vertices.push(0, 0, z + stackZ);
                this.vertices.push(x1, -y1, z + stackZ);
                this.vertices.push(x2, -y2, z + stackZ);

                this.indices.push(
                    this.slices * j * 6 + 6 * i,
                    this.slices * j * 6 + 6 * i + 1,
                    this.slices * j * 6 + 6 * i + 2,
                ); // lower face
                this.indices.push(
                    this.slices * j * 6 + 6 * i + 5,
                    this.slices * j * 6 + 6 * i + 4,
                    this.slices * j * 6 + 6 * i + 3,
                ); // upper face
                this.indices.push(
                    this.slices * j * 6 + 6 * i + 4,
                    this.slices * j * 6 + 6 * i + 2,
                    this.slices * j * 6 + 6 * i + 1,
                ); // side tri 1
                this.indices.push(
                    this.slices * j * 6 + 6 * i + 4,
                    this.slices * j * 6 + 6 * i + 5,
                    this.slices * j * 6 + 6 * i + 2,
                ); // side tri 2

                // triangle normal computed by cross product of two edges
                var normal = [y2 - y1, x2 - x1, 0];

                // normalization
                var nsize = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
                normal[0] /= nsize;
                normal[1] /= nsize;
                normal[2] /= nsize;

                // push normal once for each vertex of this triangle
                this.normals.push(0, 0, j == 0 ? -1 : 0);
                this.normals.push(...normal);
                this.normals.push(...normal);
                this.normals.push(0, 0, j == this.stacks - 1 ? 1 : 0);
                this.normals.push(...normal);
                this.normals.push(...normal);

                ang += alphaAng;
            }
            z += stackZ;
        }

        // The defined indices (and corresponding vertices)
        // will be read in groups of three to draw triangles
        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }

    /**
     * Called when user interacts with GUI to change object's complexity.
     * @param {integer} complexity - changes number of slices
     */
    updateBuffers(complexity) {
        this.slices = 3 + Math.round(9 * complexity); //complexity varies 0-1, so slices varies 3-12
        //this.stacks = 1 + Math.round(9 * complexity); //complexity varies 0-1, so stacks varies 1-10
        // reinitialize buffers
        this.initBuffers();
        this.initNormalVizBuffers();
    }
}
