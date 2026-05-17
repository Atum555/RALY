import { CGFobject } from "../lib/CGF.js";

/**
 * MyCylinder
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyCylinder extends CGFobject {
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
        var n = 4; // The "Roundedness" factor. Try 4 for a squircle, 10 for a box.

        for (var j = 0; j <= this.stacks; j++) {
            ang = 0;
            for (var i = 0; i < this.slices; i++) {
                var cosA = Math.cos(ang);
                var sinA = Math.sin(ang);

                // Calculate the "push out" factor (Superellipse formula)
                var x = Math.pow(Math.abs(cosA), 2 / n) * Math.sign(cosA);
                var y = Math.pow(Math.abs(sinA), 2 / n) * Math.sign(sinA);

                this.vertices.push(x, -y, z);
                // Normals
                var normal = [x, -y, 0];
                var nsize = Math.sqrt(
                    normal[0] * normal[0] +
                        normal[1] * normal[1] +
                        normal[2] * normal[2],
                );
                normal[0] /= nsize;
                normal[1] /= nsize;
                normal[2] /= nsize;

                this.normals.push(...normal);
                ang += alphaAng;
            }
            // Indices
            for (var i = 0; i < this.slices; i++) {
                this.indices.push(
                    this.slices * j + i + 0,
                    this.slices * j + i + this.slices,
                    this.slices * j + i + 1,
                ); // side tri 1
                this.indices.push(
                    this.slices * j + i + 0,
                    this.slices * j + i + this.slices - 1,
                    this.slices * j + i + this.slices,
                ); // side tri 1
            }

            z += stackZ;
        }
        // Faces
        this.vertices.push(0, 0, 0);
        this.normals.push(0, 0, -1);
        this.vertices.push(0, 0, z - stackZ);
        this.normals.push(0, 0, 1);

        for (var i = 0; i < this.slices; i++) {
            this.indices.push(
                this.vertices.length / 3 - 2,
                i,
                (i + 1) % this.slices,
            );
            this.indices.push(
                this.vertices.length / 3 - 1,
                this.vertices.length / 3 - (3 + i),
                this.vertices.length / 3 - (3 + ((i + 1) % this.slices)),
            );
        }

        /*
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
                var normal = [x1,-y1,0];
                var normal2 = [x2,-y2,0];

                // normalization
                var nsize = Math.sqrt(
                    normal[0] * normal[0] +
                        normal[1] * normal[1] +
                        normal[2] * normal[2],
                );
                normal[0] /= nsize;
                normal[1] /= nsize;
                normal[2] /= nsize;

                nsize = Math.sqrt(
                    normal2[0] * normal2[0] +
                        normal2[1] * normal2[1] +
                        normal2[2] * normal2[2],
                );

                normal2[0] /= nsize;
                normal2[1] /= nsize;
                normal2[2] /= nsize;

                // push normal once for each vertex of this triangle
                this.normals.push(0, 0, j == 0 ? -1 : 0);
                this.normals.push(...normal);
                this.normals.push(...normal2);
                this.normals.push(0, 0, j == this.stacks - 1 ? 1 : 0);
                this.normals.push(...normal);
                this.normals.push(...normal2);

                ang += alphaAng;
            }
            z += stackZ;
        }
        */
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
