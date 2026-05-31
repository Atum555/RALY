import { CGFshader } from "../../lib/CGF.js";
import { CGFGroup } from "../core/CGFGroup.js";
import { GrassBunch } from "./GrassBunch.js";

export class GrassPatch extends CGFGroup {
    constructor(scene, gridSize) {
        super(scene);
        this.gridSize = 20;
        this.windEnabled = false;
        this.windStrength = 0.2;
        this.windSpeed = 1.0;
        this.windSpatialFreq = 0.5;
        this.windTime = 0;

        this.bunches = [];
        this.initGrid();
        this.initShaders();
    }

    initGrid() {
        let half = this.gridSize / 2;
        let spacing = 0.2;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                let cx = (col - half + (Math.random() - 0.5) * 0.4) * spacing;
                let cz = (row - half + (Math.random() - 0.5) * 0.4) * spacing;
                let type = Math.floor(Math.random() * 5);
                let bunch = this.addPart(new GrassBunch(this.scene, type));
                this.bunches.push({ obj: bunch, x: cx, z: cz });
            }
        }
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

        for (let b of this.bunches) {
            this.scene.pushMatrix();
            this.scene.translate(b.x, 0, b.z);
            b.obj.display();
            this.scene.popMatrix();
        }

        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
