import { CGFGroup } from "../../core/CGFGroup.js";
import { UnitCube } from "./UnitCube.js";
import { Cylinder } from "./Cylinder.js";
import { WheelRim } from "./WheelRim.js";

export class Wheel extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        // -- Geometry parameters --

        this.num_spokes = 12;
        this.wheel_radius = 2.0;
        this.rim_thickness = 0.15;
        this.wheel_width = 0.3;

        this.hub = this.addPart(new Cylinder(scene, 12, 1));
        this.segment = this.addPart(new UnitCube(scene));
        this.rim = this.addPart(new WheelRim(this.scene,2,0.15,0.3,48))
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.displayHub();
        this.displaySpokes();
        this.rim.display();
    }

    displayHub() {
        // Central cylinder
        this.scene.pushMatrix();
        this.scene.scale(0.3, 0.3, this.wheel_width - 0.1);
        this.hub.display();
        this.scene.popMatrix();
    }

    displaySpokes() {
        // Evenly spaced spokes, each capped by a rim segment
        for (let i = 0; i < this.num_spokes; i++) {
            const angle = (i * 2 * Math.PI) / this.num_spokes;

            // Spoke
            this.scene.pushMatrix();
            this.scene.rotate(angle, 0, 0, 1);
            this.scene.translate(0, this.wheel_radius / 2.0, 0);
            this.scene.scale(0.06, this.wheel_radius, 0.06);
            this.segment.display();
            this.scene.popMatrix();

        }
    }
}
