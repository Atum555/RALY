import { CGFobject } from "../../../lib/CGF.js";

// Barn roof shell. Pure geometry: the Barn drives the shared wood shader, so this
// just emits the mesh and draws the same in the lit pass and the shadow depth pass.
export class Roof extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, width, height, length, thickness, overhangSide, overhangLength) {
        super(scene);
        this.width = width;
        this.height = height;
        this.length = length;
        this.thickness = thickness;
        this.overhangSide = overhangSide;
        this.overhangLength = overhangLength;
        this.initBuffers();
    }

    // =====================================================
    // Buffers
    // =====================================================

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        const hw = this.width / 2;
        const hl = this.length / 2 + this.overhangLength;

        const baseProfile = [
            { x: -hw, y: -4 },
            { x: -hw * 0.7, y: this.height * 0.45 },
            { x: 0, y: this.height },
            { x: hw * 0.7, y: this.height * 0.45 },
            { x: hw, y: -4 },
        ];

        const numPoints = baseProfile.length;
        const outerProfile = [];
        const innerProfile = [];

        for (let i = 0; i < numPoints; i++) {
            let dx = 0;
            let dy = 0;

            if (i === 0) {
                let nX = -(baseProfile[1].y - baseProfile[0].y);
                let nY = baseProfile[1].x - baseProfile[0].x;
                let len = Math.sqrt(nX * nX + nY * nY);
                dx = nX / len;
                dy = nY / len;
            } else if (i === numPoints - 1) {
                let nX = -(baseProfile[numPoints - 1].y - baseProfile[numPoints - 2].y);
                let nY = baseProfile[numPoints - 1].x - baseProfile[numPoints - 2].x;
                let len = Math.sqrt(nX * nX + nY * nY);
                dx = nX / len;
                dy = nY / len;
            } else {
                let v1x = baseProfile[i].x - baseProfile[i - 1].x;
                let v1y = baseProfile[i].y - baseProfile[i - 1].y;
                let l1 = Math.sqrt(v1x * v1x + v1y * v1y);
                v1x /= l1;
                v1y /= l1;

                let v2x = baseProfile[i + 1].x - baseProfile[i].x;
                let v2y = baseProfile[i + 1].y - baseProfile[i].y;
                let l2 = Math.sqrt(v2x * v2x + v2y * v2y);
                v2x /= l2;
                v2y /= l2;

                let tx = v1x + v2x;
                let ty = v1y + v2y;
                let lenT = Math.sqrt(tx * tx + ty * ty);
                tx /= lenT;
                ty /= lenT;

                dx = -ty;
                dy = tx;
            }

            let extSide = i === 0 || i === numPoints - 1 ? this.overhangSide : 0;

            outerProfile.push({
                x: baseProfile[i].x + dx * this.thickness + (i === 0 ? -extSide : i === numPoints - 1 ? extSide : 0),
                y: baseProfile[i].y + dy * this.thickness,
            });

            innerProfile.push({
                x: baseProfile[i].x + (i === 0 ? -extSide : i === numPoints - 1 ? extSide : 0),
                y: baseProfile[i].y,
            });
        }

        const buildSegment = (p0, p1, nX, nY, nZ, isOuter, uScale) => {
            let startIdx = this.vertices.length / 3;

            this.vertices.push(p0.x, p0.y, -hl);
            this.normals.push(nX, nY, nZ);
            this.texCoords.push(0, 0);

            this.vertices.push(p1.x, p1.y, -hl);
            this.normals.push(nX, nY, nZ);
            this.texCoords.push(uScale, 0);

            this.vertices.push(p0.x, p0.y, hl);
            this.normals.push(nX, nY, nZ);
            this.texCoords.push(0, 1);

            this.vertices.push(p1.x, p1.y, hl);
            this.normals.push(nX, nY, nZ);
            this.texCoords.push(uScale, 1);

            if (isOuter) {
                this.indices.push(startIdx, startIdx + 2, startIdx + 1);
                this.indices.push(startIdx + 1, startIdx + 2, startIdx + 3);
            } else {
                this.indices.push(startIdx, startIdx + 1, startIdx + 2);
                this.indices.push(startIdx + 1, startIdx + 3, startIdx + 2);
            }
        };

        for (let i = 0; i < numPoints - 1; i++) {
            let dx = outerProfile[i + 1].x - outerProfile[i].x;
            let dy = outerProfile[i + 1].y - outerProfile[i].y;
            let len = Math.sqrt(dx * dx + dy * dy);
            let nX = -dy / len;
            let nY = dx / len;

            buildSegment(outerProfile[i], outerProfile[i + 1], nX, nY, 0, true, len * 4);
            buildSegment(innerProfile[i], innerProfile[i + 1], -nX, -nY, 0, false, len * 4);
        }

        const buildCap = (zVal, nZ, isFront) => {
            let startIdx = this.vertices.length / 3;

            for (let i = 0; i < numPoints; i++) {
                this.vertices.push(innerProfile[i].x, innerProfile[i].y, zVal);
                this.normals.push(0, 0, nZ);
                this.texCoords.push(((innerProfile[i].x + hw) / this.width) * 4, innerProfile[i].y / this.height);
            }

            for (let i = 0; i < numPoints; i++) {
                this.vertices.push(outerProfile[i].x, outerProfile[i].y, zVal);
                this.normals.push(0, 0, nZ);
                this.texCoords.push(((outerProfile[i].x + hw) / this.width) * 4, outerProfile[i].y / this.height);
            }

            for (let i = 0; i < numPoints - 1; i++) {
                let i0 = startIdx + i;
                let i1 = startIdx + i + 1;
                let o0 = startIdx + numPoints + i;
                let o1 = startIdx + numPoints + i + 1;

                if (isFront) {
                    this.indices.push(i1, o0, i0);
                    this.indices.push(i1, o1, o0);
                } else {
                    this.indices.push(i1, i0, o0);
                    this.indices.push(i1, o0, o1);
                }
            }
        };

        buildCap(-hl, -1, false);
        buildCap(hl, 1, true);

        const buildSideEdge = (idx, isLeft) => {
            let startIdx = this.vertices.length / 3;
            let pI = innerProfile[idx];
            let pO = outerProfile[idx];

            let nX = isLeft ? -1 : 1;

            this.vertices.push(pI.x, pI.y, -hl);
            this.normals.push(nX, 0, 0);
            this.texCoords.push(0, 0);

            this.vertices.push(pO.x, pO.y, -hl);
            this.normals.push(nX, 0, 0);
            this.texCoords.push(this.thickness * 4, 0);

            this.vertices.push(pI.x, pI.y, hl);
            this.normals.push(nX, 0, 0);
            this.texCoords.push(0, 1);

            this.vertices.push(pO.x, pO.y, hl);
            this.normals.push(nX, 0, 0);
            this.texCoords.push(this.thickness * 4, 1);

            if (isLeft) {
                this.indices.push(startIdx, startIdx + 2, startIdx + 1);
                this.indices.push(startIdx + 1, startIdx + 2, startIdx + 3);
            } else {
                this.indices.push(startIdx, startIdx + 1, startIdx + 2);
                this.indices.push(startIdx + 1, startIdx + 3, startIdx + 2);
            }
        };

        buildSideEdge(0, true);
        buildSideEdge(numPoints - 1, false);

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
