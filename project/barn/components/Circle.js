import { CGFobject } from "../../../lib/CGF.js";
import { CircleMaterial } from "../materials/circleMaterial.js";

export class Circle extends CGFobject {
    constructor(scene, radius, slices) {
        super(scene);
        this.radius = radius;
        this.slices = slices;
        this.wasPlayerInside = false;
        this.material = new CircleMaterial(this.scene);
        this.initBuffers();
    }

    update(isPlayerInside) {
        if (this.wasPlayerInside === isPlayerInside) return;

        if (isPlayerInside) {
            this.material.setEmission(0.6, 0.9, 0.7, 1.0);
        } else {
            this.material.setEmission(0.95, 0.92, 0.82, 1.0);
        }
        this.wasPlayerInside = isPlayerInside;
    }

    display() {
        this.material.apply();
        super.display();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        this.vertices.push(0, 0.1, 0);
        this.normals.push(0, 1, 0);
        this.texCoords.push(0.5, 0.5);

        let angle = 0;
        let alphaAng = (2 * Math.PI) / this.slices;

        for (let i = 0; i <= this.slices; i++) {
            let cosA = Math.cos(angle);
            let sinA = Math.sin(angle);

            let x = this.radius * cosA;
            let z = this.radius * sinA;
            this.vertices.push(x, 0.1, z);
            this.normals.push(0, 1, 0);
            let u = 0.5 + cosA * 0.5;
            let v = 0.5 + sinA * 0.5;
            this.texCoords.push(u, v);

            angle += alphaAng;
        }

        for (let i = 1; i <= this.slices; i++) {
            let center = 0;
            let currentVert = i;
            let nextVert = i + 1;
            this.indices.push(center, currentVert, nextVert);
            // inv
            this.indices.push(center, nextVert, currentVert);
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}
