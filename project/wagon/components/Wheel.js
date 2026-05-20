import { CGFGroup } from "../../core/CGFGroup.js";
import { UnitCube } from "./UnitCube.js";
import { Cylinder } from "./Cylinder.js";

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
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.displayHub();
        this.displaySpokes();
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

            // Rim segment
            this.scene.pushMatrix();
            this.scene.rotate(angle, 0, 0, 1);
            this.scene.translate(0, this.wheel_radius, 0);
            const segment_length = this.wheel_radius * ((2 * Math.PI) / this.num_spokes) * 1.05;
            this.scene.scale(segment_length, this.rim_thickness, this.wheel_width);
            this.segment.display();
            this.scene.popMatrix();
        }
    }
}
