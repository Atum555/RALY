import { CGFobject } from "../../lib/CGF.js";
import { Petal } from "../common/Petal.js";
import { FlowerMaterial } from "../materials/FlowerMaterial.js";

export class Flower extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, color, rings = 4, petals = 8) {
        super(scene);
        this.material = new FlowerMaterial(scene, color);
        this.petal = new Petal(scene, 0.20, 0.35);
        // Geometry detail (used for distance LOD by the flower field): how many
        // petal rings and petals per ring the bloom is built from. Defaults keep
        // the full, showcase-quality head.
        this.rings_count = rings;
        this.n = petals;
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
        let n = this.n;
        let angleStep = (2 * Math.PI) / n;

        const all_rings = [
            { tilt: 0.05, yOff: 0.00 },
            { tilt: 0.25, yOff: -0.02 },
            { tilt: 0.45, yOff: -0.04 },
            { tilt: 0.70, yOff: -0.06 },
        ];
        // Outer-to-inner so a reduced ring count still reads as a flower head.
        const rings = all_rings.slice(0, Math.max(1, Math.min(all_rings.length, this.rings_count)));

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
