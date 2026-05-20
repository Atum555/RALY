import { CGFGroup } from "../core/CGFGroup.js";
import { Body } from "./components/Body.js";
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

        // -- Driving state (W/A/S/D) --

        this.position_x = 0;
        this.position_z = 0;
        this.heading = 0;
        this.speed = 0;

        this.max_speed = 15.0;
        this.min_speed = 0.0;
        this.max_steering_angle = Math.PI / 5;
        this.min_steering_angle = -Math.PI / 5;

        this.acceleration_rate = 8.0;
        this.braking_rate = 12.0;
        this.steering_rate = 1.6;
        this.wheel_base = 13.5;

        this.initComponents();
    }

    initComponents() {
        this.body = this.addPart(new Body(this.scene));
        this.under_body = this.addPart(new UnderBody(this.scene, 0.0));
        this.haybale = this.addPart(new HayBale(this.scene, 10, 10));
    }

    // =====================================================
    // Movement
    // =====================================================

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    accelerate(amount) {
        this.speed = this.clamp(this.speed + amount, this.min_speed, this.max_speed);
    }

    steer(amount) {
        this.steering_angle = this.clamp(
            this.steering_angle + amount,
            this.min_steering_angle,
            this.max_steering_angle,
        );
    }

    // =====================================================
    // Update
    // =====================================================

    update(delta_seconds = 0) {
        // Bicycle-model kinematics: the steered front wheels turn the heading
        // while the wagon rolls forward. Forward is +Z (the front axle side).
        if (delta_seconds > 0) {
            const angular_velocity =
                (this.speed * Math.tan(this.steering_angle)) / this.wheel_base;
            this.heading += angular_velocity * delta_seconds;
            this.position_x += Math.sin(this.heading) * this.speed * delta_seconds;
            this.position_z += Math.cos(this.heading) * this.speed * delta_seconds;
        }

        this.under_body.updateDirection(this.steering_angle);
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();

        // Drive the wagon around the world
        this.scene.translate(this.position_x, 0, this.position_z);
        this.scene.rotate(this.heading, 0, 1, 0);

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
