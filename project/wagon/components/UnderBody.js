import { CGFGroup } from "../../core/CGFGroup.js";
import { Direction } from "./Direction.js";
import { Wheel } from "./Wheel.js";
import { Beam } from "./Beam.js";

export class UnderBody extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, steering_angle) {
        super(scene);

        this.direction = this.addPart(new Direction(this.scene, 5.5, steering_angle));
        this.beam = this.addPart(new Beam(this.scene, 5.5, 0.2));
        this.big_beam = this.addPart(new Beam(this.scene, 9, 0.2));
        this.wheel = this.addPart(new Wheel(this.scene));
    }

    // =====================================================
    // Update
    // =====================================================

    updateDirection(angle) {
        this.direction.updateDirection(angle);
    }

    update(wheelRotation) {
        this.wheelRotation = wheelRotation;
        this.direction.update(wheelRotation);
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();

        // Move to the front axle frame; the rest of the chassis is laid out
        // relative to it.
        this.scene.translate(0, 1, 5.5);

        // Steering direction (with its 2 front wheels)
        this.direction.display();

        // Lift to the support-beam layer
        this.scene.translate(0, 0.4, 0);

        this.displayFrontBeam();
        this.displayLowerBeams();
        this.displayTopBeams();
        this.displayBackStructure();
        this.displayBackWheels();

        this.scene.popMatrix();
    }

    displayFrontBeam() {
        // Cross beam supporting the steering direction
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.scale(1.5, 1, 0.65);
        this.beam.display();
        this.scene.popMatrix();
    }

    displayLowerBeams() {
        // Pair of long beams running the length of the chassis
        this.scene.pushMatrix();
        this.scene.translate(1.5, 0.4, -4.5);
        this.big_beam.display();
        this.scene.translate(-3, 0, 0);
        this.big_beam.display();
        this.scene.popMatrix();
    }

    displayTopBeams() {
        // Three evenly spaced cross beams on the top layer
        this.scene.pushMatrix();
        this.scene.translate(0, 0.8, -0.4);
        this.scene.scale(0.7, 1, 1);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.beam.display();
        this.scene.translate(4, 0, 0);
        this.beam.display();
        this.scene.translate(4, 0, 0);
        this.beam.display();
        this.scene.popMatrix();
    }

    displayBackStructure() {
        // Cross beams bracing the rear axle
        this.scene.pushMatrix();
        this.scene.translate(0, 0, -8);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        // Back wheel support beam
        this.scene.pushMatrix();
        this.scene.scale(1.5, 1, 0.65);
        this.beam.display();
        this.scene.popMatrix();
        this.scene.translate(0, -0.4, 0);
        this.beam.display();
        this.scene.popMatrix();
    }

    displayBackWheels() {
        // Rear axle wheels (mirrored left and right)
        this.scene.pushMatrix();
        this.scene.translate(5.5 / 2, -0.4, -8);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.rotate(this.wheelRotation, 0, 0, 1);
        this.wheel.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(-5.5 / 2, -0.4, -8);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.rotate(Math.PI, 0, 1, 0);
        this.scene.rotate(-this.wheelRotation, 0, 0, 1);
        this.wheel.display();
        this.scene.popMatrix();
    }
}
