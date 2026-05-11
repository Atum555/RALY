import { CGFobject } from "../../lib/CGF.js";

/**
 * SkySphere
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class SkySphere extends CGFobject {
    constructor(scene) {
        super(scene);

        this.slices = 30;
        this.stacks = 30;
        this.radius = 20;
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        var x, y, z, xy;
        var nx, ny, nz;
        var lengthInv = 1 / this.radius;
        var s, t;

        var sliceStep = (2 * Math.PI) / this.slices;
        var stackStep = Math.PI / this.stacks;
        var sliceAngle, stackAngle;

        for (var i = 0; i <= this.stacks / 2; ++i) {
            stackAngle = Math.PI / 2 - i * stackStep; // starting from pi/2 to -pi/2
            xy = this.radius * Math.cos(stackAngle); // r * cos(u)
            z = this.radius * Math.sin(stackAngle); // r * sin(u)

            // Vertex + Normals
            for (var j = 0; j <= this.slices; ++j) {
                sliceAngle = j * sliceStep; // starting from 0 to 2pi

                // vertex position (x, y, z)
                x = xy * Math.cos(sliceAngle); // r * cos(u) * cos(v)
                y = xy * Math.sin(sliceAngle); // r * cos(u) * sin(v)
                this.vertices.push(x);
                this.vertices.push(y);
                this.vertices.push(z);

                // normalized vertex normal (nx, ny, nz)
                nx = x * lengthInv;
                ny = y * lengthInv;
                nz = z * lengthInv;
                this.normals.push(-nx);
                this.normals.push(-ny);
                this.normals.push(-nz);

                // vertex tex coord (s, t) range between [0, 1]
                s = j / this.slices;
                t = i / (this.stacks / 2);
                this.texCoords.push(s);
                this.texCoords.push(t);
            }
        }
        var k1, k2;
        for (var i = 0; i < this.stacks / 2; ++i) {
            k1 = i * (this.slices + 1); // Beginning of current stack
            k2 = k1 + this.slices + 1; // Beginning of next stack

            for (var j = 0; j < this.slices; ++j, ++k1, ++k2) {
                // 2 triangles per sector excluding first and last stacks
                // k1 => k2 => k1+1
                if (i != 0) {
                    this.indices.push(k1 + 1);
                    this.indices.push(k2);
                    this.indices.push(k1);
                }

                // k1+1 => k2 => k2+1
                if (i != this.stacks - 1) {
                    this.indices.push(k2 + 1);
                    this.indices.push(k2);
                    this.indices.push(k1 + 1);
                }
            }
        }

        // The defined indices (and corresponding vertices)
        // will be read in groups of three to draw triangles
        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }

}
