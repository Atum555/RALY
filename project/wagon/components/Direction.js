import { CGFGroup } from "../../core/CGFGroup.js";
import { Beam } from "./Beam.js";
import { Wheel } from "./Wheel.js";

export class Direction extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, beam_length, steering_angle) {
        super(scene);

        this.beam_length = beam_length;
        this.steering_angle = steering_angle;

        this.beam = this.addPart(new Beam(this.scene, this.beam_length, 0.2));
        this.wheel = this.addPart(new Wheel(this.scene));
    }

    // =====================================================
    // Update
    // =====================================================

    updateDirection(angle) {
        this.steering_angle = angle;
    }

    update(wheelRotation) {
        this.wheelRotation = wheelRotation;
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();

        // Steer the whole axle by the current steering angle
        this.scene.rotate(this.steering_angle, 0, 1, 0);

        this.displayBeams();
        this.displayWheels();

        this.scene.popMatrix();
    }

    displayBeams() {
        // Longitudinal beam with a cross beam at each end (the axle frame)
        this.scene.pushMatrix();
        this.scene.translate(0, 0, this.beam_length / 2);
        this.beam.display();

        // Front cross beam
        this.scene.pushMatrix();
        this.scene.translate(0, 0, this.beam_length / 2);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.beam.display();
        this.scene.popMatrix();

        // Back cross beam
        this.scene.pushMatrix();
        this.scene.translate(0, 0, -this.beam_length / 2);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.beam.display();
        this.scene.popMatrix();
        this.scene.popMatrix();
    }

    displayWheels() {
        // Steering wheels mounted at each end of the axle (mirrored)
        this.scene.pushMatrix();
        this.scene.translate(this.beam_length / 2, 0, 0);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.rotate(this.wheelRotation, 0, 0, 1);
        this.wheel.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(-this.beam_length / 2, 0, 0);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.rotate(Math.PI, 0, 1, 0);
        this.scene.rotate(-this.wheelRotation, 0, 0, 1);
        this.wheel.display();
        this.scene.popMatrix();
    }
}
