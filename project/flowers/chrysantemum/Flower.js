import { CGFobject } from "../../../lib/CGF.js";
import { Petal } from "../common/Petal.js";
import { FlowerMaterial } from "../materials/FlowerMaterial.js";

export class Flower extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, color) {
        super(scene);
        this.material = new FlowerMaterial(scene, color);
        this.petal = new Petal(scene, 0.20, 0.35);
    }

    // =====================================================
    // Display
    // =====================================================

    setDefaultAppearance() {
        this.material.apply();
    }

    enableNormalViz() {
        this.petal.enableNormalViz();
    }

    disableNormalViz() {
        this.petal.disableNormalViz();
    }

    display() {
        this.setDefaultAppearance();
        let n = 8;
        let angleStep = (2 * Math.PI) / n;

        const rings = [
            { tilt: 0.05, yOff: 0.00 },
            { tilt: 0.25, yOff: -0.02 },
            { tilt: 0.45, yOff: -0.04 },
            { tilt: 0.70, yOff: -0.06 },
        ];

        for (let r = 0; r < rings.length; r++) {
            let offset = (r % 2 === 0) ? 0 : angleStep / 2;
            for (let i = 0; i < n; i++) {
                this.scene.pushMatrix();
                this.scene.rotate(i * angleStep + offset, 0, 1, 0);
                this.scene.translate(0, rings[r].yOff, 0);
                this.scene.rotate(rings[r].tilt, 1, 0, 0);
                this.petal.display();
                this.scene.popMatrix();
            }
        }
    }
}
