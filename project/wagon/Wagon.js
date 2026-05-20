import { CGFGroup } from "../core/CGFGroup.js";
import { WagonBody } from "./components/WagonBody.js";
import { UnderBody } from "./components/UnderBody.js";
import { HayBale } from "../obstacles/HayBale.js";

export class Wagon extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        // -- UI-controlled state --

        this.steering_angle = 0;

        this.initComponents();
    }

    initComponents() {
        this.body = this.addPart(new WagonBody(this.scene));
        this.under_body = this.addPart(new UnderBody(this.scene, 0.0));
        this.haybale = this.addPart(new HayBale(this.scene, 10, 10));
    }

    // =====================================================
    // Update
    // =====================================================

    update() {
        this.under_body.updateDirection(this.steering_angle);
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();

        // Chassis
        this.under_body.display();

        // Body
        this.scene.translate(0, 2.4, 0);
        this.body.display();

        // Cargo
        this.displayHayBales();

        this.scene.popMatrix();
    }

    displayHayBales() {
        // 2x2 stack of hay bales, relative to the body frame.
        const positions = [
            [1, 1.2, -3.6],
            [-1, 1.2, -3.6],
            [-1, 3.2, -3.6],
            [1, 3.2, -3.6],
        ];

        for (const [x, y, z] of positions) {
            this.scene.pushMatrix();
            this.scene.translate(x, y, z);
            this.haybale.display();
            this.scene.popMatrix();
        }
    }
}
