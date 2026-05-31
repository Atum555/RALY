import { CGFobject } from "../../lib/CGF.js";

export class GrassBlade extends CGFobject {
    constructor(scene, slices, height, width, depth, leanX, leanZ) {
        super(scene);
        this.slices = slices;
        this.height = height;
        this.width = width;
        this.depth = depth;
        this.leanX = leanX;
        this.leanZ = leanZ;
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];

        let ang = 0;
        let alphaAng = 2*Math.PI/this.slices;

        for (let i = 0; i < this.slices; i++) {

            let z1 = Math.sin(ang) * this.depth / 2;
            let z2 = Math.sin(ang + alphaAng) * this.depth / 2;
            let x1 = Math.cos(ang) * this.width / 2;
            let x2 = Math.cos(ang + alphaAng) * this.width / 2;

            this.vertices.push(this.leanX, this.height, this.leanZ);
            this.vertices.push(x1, 0, z1);
            this.vertices.push(x2, 0, z2);

            let ux = x1 - this.leanX, uy = -this.height, uz = z1 - this.leanZ;
            let vx = x2 - this.leanX, vy = -this.height, vz = z2 - this.leanZ;
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx /= len; ny /= len; nz /= len;

            this.normals.push(nx, ny, nz);
            this.normals.push(nx, ny, nz);
            this.normals.push(nx, ny, nz);

            let base = i * 3;
            this.indices.push(base, base + 1, base + 2);
            this.indices.push(base, base + 2, base + 1);
            ang += alphaAng;
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
