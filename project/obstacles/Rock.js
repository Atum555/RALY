import { CGFobject, CGFappearance } from "../../lib/CGF.js";
import { fbm } from "./noiseUtils.js";

/**
 * Sphere
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class Rock extends CGFobject {
    // @param opts.slices / opts.stacks  Tessellation of this mesh (a LOD level).
    // @param opts.sx / opts.sy / opts.sz  Per-axis stretch giving the rock its
    //   lumpy silhouette. Passed in so a rock's several LOD meshes share one
    //   shape (same stretch + the position-deterministic fbm) and differ only in
    //   resolution; randomized when a Rock is built standalone.
    // @param opts.skipMaterial  Skip the standalone CGFappearance (RockField
    //   draws the pool under its own shadow-aware material instead).
    constructor(scene, opts = {}) {
        super(scene);

        this.slices = opts.slices ?? 10;
        this.stacks = opts.stacks ?? 10;
        this.radius = 1;
        this.scale = 1.5;
        this.uNoiseScale = 5.0;
        this.uNoiseStrength = 6.0;

        this.sx = opts.sx ?? 1.0 + Math.random() * (this.scale - 1.0);
        this.sy = opts.sy ?? 1.0 + Math.random() * (this.scale - 1.0);
        this.sz = opts.sz ?? 1.0 + Math.random() * (this.scale - 1.0);

        this.initBuffers();
        if (!opts.skipMaterial) this.initMaterials();
    }

    initMaterials() {
        this.material = new CGFappearance(this.scene);
        this.material.setAmbient(0.5, 0.5, 0.5, 1);
        this.material.setDiffuse(0.7, 0.7, 0.7, 1);
        this.material.setSpecular(0.2, 0.2, 0.2, 1);
        this.material.setShininess(10.0);
        this.material.loadTexture("obstacles/textures/rock.jpg");
        this.material.setTextureWrap("REPEAT", "REPEAT");
    }

    display() {
        this.scene.gl.texParameteri(this.scene.gl.TEXTURE_2D, this.scene.gl.TEXTURE_MAG_FILTER, this.scene.gl.NEAREST);
        this.material.apply();
        super.display();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        var sx = this.sx;
        var sy = this.sy;
        var sz = this.sz;

        var sliceStep = (2 * Math.PI) / this.slices;
        var stackStep = Math.PI / this.stacks;
        var index = 0;

        for (var i = 1; i < this.stacks; ++i) {
            var stackAngle = Math.PI / 2 - i * stackStep;
            var xy = this.radius * Math.cos(stackAngle);
            var z = this.radius * Math.sin(stackAngle);

            var stackBaseIndex = index;

            for (var j = 0; j < this.slices; ++j) {
                var sliceAngle = j * sliceStep;
                var x = xy * Math.cos(sliceAngle);
                var y = xy * Math.sin(sliceAngle);

                // Normals, normalized
                var nx = x / (sx * sx);
                var ny = y / (sy * sy);
                var nz = z / (sz * sz);
                var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                nx /= len;
                ny /= len;
                nz /= len;

                var displacement =
                    fbm([x * this.uNoiseScale, y * this.uNoiseScale, z * this.uNoiseScale]) * this.uNoiseStrength;

                this.vertices.push(
                    (x + nx * displacement) * sx,
                    (y + ny * displacement) * sy,
                    (z + nz * displacement) * sz,
                );
                this.normals.push(nx, ny, nz);
                this.texCoords.push(j / this.slices, i / this.stacks);

                if (i + 1 != this.stacks) {
                    var i1, i2, i3, i4;
                    if (j + 1 == this.slices) {
                        i1 = index;
                        i2 = stackBaseIndex;
                        i3 = index + this.slices;
                        i4 = stackBaseIndex + this.slices;
                    } else {
                        i1 = index;
                        i2 = index + 1;
                        i3 = index + this.slices;
                        i4 = index + this.slices + 1;
                    }
                    this.indices.push(i3, i2, i1);
                    this.indices.push(i2, i3, i4);
                }
                index++;
            }
        }

        // displacement for center vertices
        var displacement =
            fbm([0 * this.uNoiseScale, 0 * this.uNoiseScale, this.radius * sz * this.uNoiseScale]) *
            this.uNoiseStrength;

        // single top pole vertex
        var topIndex = index++;
        this.vertices.push(0, 0, (this.radius + displacement) * sz);
        this.normals.push(0, 0, 1);
        this.texCoords.push(0.5, 0);

        // single bottom pole vertex
        var bottomIndex = index++;
        this.vertices.push(0, 0, -(this.radius + displacement) * sz);
        this.normals.push(0, 0, -1);
        this.texCoords.push(0.5, 1);

        for (var i = 0; i < this.slices; ++i) {
            this.indices.push(topIndex, i, (i + 1) % this.slices);
        }

        var bottomRingStart = bottomIndex - 1 - this.slices;
        for (var i = 0; i < this.slices; ++i) {
            this.indices.push(bottomRingStart + ((i + 1) % this.slices), bottomRingStart + i, bottomIndex);
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
