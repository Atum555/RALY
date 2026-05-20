import { CGFobject } from "../../lib/CGF.js";
import { WagonBody } from "./WagonBody.js";
import { UnderBody } from "./UnderBody.js";
import { HayBale } from "../obstacles/HayBale.js";

export class Wagon extends CGFobject {
    constructor(scene) {
        super(scene);

        // -- UI-controlled state --

        this.steering_angle = 0;

        this.initComponents();
    }

    initComponents() {
        this.body = new WagonBody(this.scene);
        this.under_body = new UnderBody(this.scene, 0.0);
        this.haybale = new HayBale(this.scene, 10, 10);
    }

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

    enableNormalViz() {
        this.body.enableNormalViz();
        this.under_body.enableNormalViz();
        this.haybale.enableNormalViz();
    }

    disableNormalViz() {
        this.body.disableNormalViz();
        this.under_body.disableNormalViz();
        this.haybale.disableNormalViz();
    }

    update() {
        this.under_body.updateDirection(this.steering_angle);
    }
}
