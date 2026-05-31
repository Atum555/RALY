import { CGFobject } from "../../../lib/CGF.js";
import { Petal } from "../common/Petal.js";
import { FlowerMaterial } from "../materials/FlowerMaterial.js";

export class Flower extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, color, petalsPerRing = 5) {
        super(scene);
        this.petalsPerRing = petalsPerRing;
        this.material = new FlowerMaterial(scene, color);
        this.petal = new Petal(scene, 0.4, 0.7);
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
        let angleStep = (2 * Math.PI) / this.petalsPerRing;

        for (let i = 0; i < this.petalsPerRing; i++) {
            this.scene.pushMatrix();
            this.scene.rotate(i * angleStep, 0, 1, 0);
            this.scene.rotate(0.05, 1, 0, 0);
            this.petal.display();
            this.scene.popMatrix();
        }

        for (let i = 0; i < this.petalsPerRing; i++) {
            this.scene.pushMatrix();
            this.scene.rotate(i * angleStep + angleStep / 2, 0, 1, 0);
            this.scene.translate(0, -0.05, 0.03);
            this.scene.rotate(0.10, 1, 0, 0);
            this.petal.display();
            this.scene.popMatrix();
        }
    }
}
