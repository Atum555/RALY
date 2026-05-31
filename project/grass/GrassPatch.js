import { CGFobject, CGFshader } from "../../lib/CGF.js";
import { CGFGroup } from "../core/CGFGroup.js";
import { GrassBlade } from "./GrassBlade.js";

const CLUSTER_TYPES = [
    { count: 3, radius: 0.06 },
    { count: 4, radius: 0.07 },
    { count: 4, radius: 0.08 },
    { count: 5, radius: 0.08 },
    { count: 6, radius: 0.09 },
];

const CLUSTER_BLADES = [
    [0, 0, 1],
    [0, 1, 1, 2],
    [1, 2, 2, 3],
    [1, 2, 3, 3, 4],
    [0, 1, 2, 3, 4, 4],
];

export class GrassPatch extends CGFobject {
    constructor(scene, gridSize) {
        super(scene);
        this.gridSize = 30;
        this.windEnabled = false;
        this.windStrength = 0.2;
        this.windSpeed = 1.0;
        this.windSpatialFreq = 0.5;
        this.windTime = 0;

        this.bladePool = [
            new GrassBlade(scene, 3, 0.4, 0.08, 0.04,  0.03,  0.01),
            new GrassBlade(scene, 3, 0.5, 0.10, 0.05, -0.04,  0.02),
            new GrassBlade(scene, 3, 0.7, 0.18, 0.09,  0.06, -0.03),
            new GrassBlade(scene, 3, 1.0, 0.14, 0.07, -0.07,  0.04),
            new GrassBlade(scene, 3, 1.2, 0.22, 0.11,  0.08,  0.05),
            new GrassBlade(scene, 3, 0.7, 0.14, 0.07, -0.10,  0.01),
            new GrassBlade(scene, 3, 1.0, 0.18, 0.09,  0.03, -0.06),
        ];

        this.buildCombinedMesh();
        this.initShaders();
    }

    buildCombinedMesh() {
        let verts = [];
        let idxs = [];
        let norms = [];
        let vertexOffset = 0;

        let half = this.gridSize / 2;
        let spacing = 0.2;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                let cellX = (col - half + (Math.random() - 0.5) * 0.4) * spacing;
                let cellZ = (row - half + (Math.random() - 0.5) * 0.4) * spacing;
                let cellRot = (Math.random() - 0.5) * 0.5;
                let cosC = Math.cos(cellRot), sinC = Math.sin(cellRot);

                let clusterIdx = Math.floor(Math.random() * 5);
                let cluster = CLUSTER_TYPES[clusterIdx];
                let bladeIndices = CLUSTER_BLADES[clusterIdx];

                let angleOffset = Math.random() * Math.PI * 2;

                for (let bladeIdx = 0; bladeIdx < cluster.count; bladeIdx++) {
                    let angle = angleOffset + (bladeIdx / cluster.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                    let radius = cluster.radius + (Math.random() - 0.5) * 0.02;
                    let poolIdx = bladeIndices[bladeIdx % bladeIndices.length];
                    let bunchX = Math.cos(angle) * radius;
                    let bunchZ = Math.sin(angle) * radius;
                    let bladeRot = (Math.random() - 0.5) * 0.3;
                    let cosB = Math.cos(bladeRot), sinB = Math.sin(bladeRot);

                    let blade = this.bladePool[poolIdx];

                    for (let v = 0; v < blade.vertices.length; v += 3) {
                        let px = blade.vertices[v], py = blade.vertices[v + 1], pz = blade.vertices[v + 2];
                        let rx1 = px * cosB - pz * sinB;
                        let rz1 = px * sinB + pz * cosB;
                        let tx1 = rx1 + bunchX, tz1 = rz1 + bunchZ;
                        let rx2 = tx1 * cosC - tz1 * sinC;
                        let rz2 = tx1 * sinC + tz1 * cosC;
                        verts.push(rx2 + cellX, py, rz2 + cellZ);
                    }

                    for (let n = 0; n < blade.normals.length; n += 3) {
                        let nx = blade.normals[n], ny = blade.normals[n + 1], nz = blade.normals[n + 2];
                        let rnx1 = nx * cosB - nz * sinB;
                        let rnz1 = nx * sinB + nz * cosB;
                        let rnx2 = rnx1 * cosC - rnz1 * sinC;
                        let rnz2 = rnx1 * sinC + rnz1 * cosC;
                        norms.push(rnx2, ny, rnz2);
                    }

                    for (let i = 0; i < blade.indices.length; i++) {
                        idxs.push(blade.indices[i] + vertexOffset);
                    }

                    vertexOffset += blade.vertices.length / 3;
                }
            }
        }

        this.vertices = verts;
        this.indices = idxs;
        this.normals = norms;
        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    initShaders() {
        this.shader = new CGFshader(
            this.scene.gl,
            "grass/shaders/grass.vert",
            "grass/shaders/grass.frag",
        );
        this.shader.setUniformsValues({
            uTime: 0,
            uWindEnabled: 0,
            uWindStrength: this.windStrength,
            uWindSpeed: this.windSpeed,
            uWindSpatialFreq: this.windSpatialFreq,
        });
    }

    update(deltaTime) {
        if (this.windEnabled) {
            this.windTime += deltaTime * 0.001;
        }
    }

    display() {
        this.shader.setUniformsValues({
            uTime: this.windTime,
            uWindEnabled: this.windEnabled ? 1 : 0,
            uWindStrength: this.windStrength,
            uWindSpeed: this.windSpeed,
            uWindSpatialFreq: this.windSpatialFreq,
        });
        this.scene.setActiveShader(this.shader);
        super.display();
        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
