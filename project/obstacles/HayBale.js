import { CGFobject, CGFappearance } from "../../lib/CGF.js";

/**
 * MyCylinder
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class HayBale extends CGFobject {
    constructor(scene, slices, stacks) {
        super(scene);

        this.slices = slices;
        this.stacks = stacks;

        this.initBuffers();
        this.initMaterials();
    }

    initMaterials() {
        this.material = new CGFappearance(this.scene);
        this.material.setAmbient(0.3, 0.3, 0.3, 1);
        this.material.setDiffuse(0.8, 0.8, 0.8, 1);
        this.material.setSpecular(0.1, 0.1, 0.1, 1);
        this.material.setShininess(10.0);
        this.material.loadTexture("obstacles/textures/hay2.jpg");
        this.material.setTextureWrap("REPEAT", "REPEAT");
    }

    display() {
        this.scene.gl.texParameteri(
            this.scene.gl.TEXTURE_2D,
            this.scene.gl.TEXTURE_MAG_FILTER,
            this.scene.gl.NEAREST,
        );
        this.material.apply();
        super.display();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        var ang = 0;
        var alphaAng = (2 * Math.PI) / this.slices;
        var z = 0;
        var stackZ = 3 / this.stacks;
        var n = 4;

        for (var j = 0; j <= this.stacks; j++) {
            ang = 0;
            // extra iteration for texture
            for (var i = 0; i <= this.slices; i++) {
                var cosA = Math.cos(ang);
                var sinA = Math.sin(ang);

                // Lamé Curve :)
                var x = Math.pow(Math.abs(cosA), 2 / n) * Math.sign(cosA);
                var y = Math.pow(Math.abs(sinA), 2 / n) * Math.sign(sinA);

                this.vertices.push(x, -y, z);
                this.normals.push(x, -y, 0);

                this.texCoords.push(i / this.slices, j / this.stacks);

                ang += alphaAng;
            }

            // Indices
            if (j < this.stacks) {
                for (var i = 0; i < this.slices; i++) {
                    var current = j * (this.slices + 1) + i;
                    var next = current + 1;
                    var bottom = (j + 1) * (this.slices + 1) + i;
                    var bottomNext = bottom + 1;

                    this.indices.push(current, bottom, next);
                    this.indices.push(next, bottom, bottomNext);
                }
            }
            z += stackZ;
        }
        // Faces
        this.vertices.push(0, 0, 0);
        this.normals.push(0, 0, -1);
        this.vertices.push(0, 0, z - stackZ);
        this.normals.push(0, 0, 1);

        this.texCoords.push(0.5, 0.5);
        this.texCoords.push(0.5, 0.5);

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
        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }

}
