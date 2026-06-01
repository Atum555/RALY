import { CGFobject } from "../lib/CGF.js";

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

        // A single flat triangle: an apex at the top and two base corners spread
        // along X at the ground. The blade lies in one plane (no depth), so it is
        // exactly 3 vertices instead of the old radial tuft of slices triangles.
        const x1 = -this.width / 2;
        const x2 =  this.width / 2;

        this.vertices.push(this.leanX, this.height, this.leanZ);
        this.vertices.push(x1, 0, 0);
        this.vertices.push(x2, 0, 0);

        // Outward face normal. The blade is drawn double-sided (both windings,
        // see below) under the scene's back-face culling, so the fragment shader
        // never sees a back face and cannot flip the normal toward the camera --
        // it lights the geometric normal as-is. u x v comes out pointing inward
        // (toward the blade axis), which lit the blades from the side away from
        // the sun, so take v x u to face outward.
        let ux = x1 - this.leanX, uy = -this.height, uz = -this.leanZ;
        let vx = x2 - this.leanX, vy = -this.height, vz = -this.leanZ;
        let nx = uz * vy - uy * vz;
        let ny = ux * vz - uz * vx;
        let nz = uy * vx - ux * vy;
        let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len; ny /= len; nz /= len;

        this.normals.push(nx, ny, nz);
        this.normals.push(nx, ny, nz);
        this.normals.push(nx, ny, nz);

        this.indices.push(0, 1, 2);
        this.indices.push(0, 2, 1);

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
