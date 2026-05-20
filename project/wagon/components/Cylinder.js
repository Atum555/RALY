import { CGFobject } from "../../../lib/CGF.js";
import { WagonWoodMaterial } from "../materials/WagonWoodMaterial.js";

export class Cylinder extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, slices, stacks) {
        super(scene);

        this.slices = slices;
        this.stacks = stacks;

        this.material = new WagonWoodMaterial(scene);

        this.initBuffers();
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.material.apply();
        super.display();
    }

    // =====================================================
    // Buffers
    // =====================================================

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];

        const alpha_ang = (2 * Math.PI) / this.slices;
        const stack_z = 1 / this.stacks;
        let z = 0;

        // Side surface: one ring of vertices per stack level
        for (let j = 0; j <= this.stacks; j++) {
            let ang = 0;
            for (let i = 0; i < this.slices; i++) {
                const x = Math.cos(ang);
                const y = Math.sin(ang);

                this.vertices.push(x, -y, z);

                // Outward radial normal (already unit length on the circle)
                const normal = [x, -y, 0];
                const n_size = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
                normal[0] /= n_size;
                normal[1] /= n_size;
                normal[2] /= n_size;

                this.normals.push(...normal);
                ang += alpha_ang;
            }

            // Triangles linking this ring to the next one
            for (let i = 0; i < this.slices; i++) {
                this.indices.push(this.slices * j + i + 0, this.slices * j + i + this.slices, this.slices * j + i + 1); // side tri 1
                this.indices.push(
                    this.slices * j + i + 0,
                    this.slices * j + i + this.slices - 1,
                    this.slices * j + i + this.slices,
                ); // side tri 2
            }

            z += stack_z;
        }

        // Cap centres (bottom then top)
        this.vertices.push(0, 0, 0);
        this.normals.push(0, 0, -1);
        this.vertices.push(0, 0, z - stack_z);
        this.normals.push(0, 0, 1);

        // Cap triangles fanning out from each centre
        for (let i = 0; i < this.slices; i++) {
            this.indices.push(this.vertices.length / 3 - 2, i, (i + 1) % this.slices);
            this.indices.push(
                this.vertices.length / 3 - 1,
                this.vertices.length / 3 - (3 + i),
                this.vertices.length / 3 - (3 + ((i + 1) % this.slices)),
            );
        }

        // The defined indices (and corresponding vertices)
        // will be read in groups of three to draw triangles
        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }

    // =====================================================
    // Update
    // =====================================================

    updateBuffers(complexity) {
        // complexity varies 0-1, so slices varies 3-12
        this.slices = 3 + Math.round(9 * complexity);

        // reinitialize buffers
        this.initBuffers();
        this.initNormalVizBuffers();
    }
}
