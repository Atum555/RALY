import { CGFGroup } from "../core/CGFGroup.js";
import { Body } from "./components/Body.js";
import { UnderBody } from "./components/UnderBody.js";
import { Cover } from "./components/Cover.js";
import { HayBale } from "../obstacles/HayBale.js";

export class Wagon extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        // -- UI-controlled state --

        this.steering_angle = 0;
        this.wheelRotation = 0;

        this.initComponents();
    }

    initComponents() {
        this.body = this.addPart(new Body(this.scene));
        this.under_body = this.addPart(new UnderBody(this.scene, 0.0));
        this.cover = this.addPart(new Cover(this.scene, 7.5, 5));
        this.haybale = this.addPart(new HayBale(this.scene, 10, 10));
    }

    // =====================================================
    // Update
    // =====================================================

    update() {
        this.under_body.updateDirection(this.steering_angle);
        this.wheelRotation = (this.wheelRotation + this.scene.delta_time * 0.003) % (Math.PI * 2);
        this.under_body.update(this.wheelRotation);
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

        this.cover.display();
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
