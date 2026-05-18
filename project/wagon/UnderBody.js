import { CGFobject } from "../../lib/CGF.js";
import { Direction } from "./Direction.js";
import { Wheel } from "./Wheel.js";
import { Beam } from "./Beam.js";

/**
 * UnderBody
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class UnderBody extends CGFobject {
    constructor(scene, steeringAngle) {
        super(scene);
        this.direction = new Direction(this.scene, 5.5, steeringAngle);
        this.wheel = new Wheel(this.scene);
        this.beam = new Beam(this.scene, 5.5, 0.2);
        this.bigBeam = new Beam(this.scene, 9, 0.2);
    }

    display() {
        // Direction (with 2 wheels)
        this.scene.pushMatrix();
        this.scene.translate(0, 1, 5.5);
        this.direction.display();
        this.scene.translate(0, 0.4, 0);
        // Direction support Beam
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.scale(1.5,1,0.65);
        this.beam.display();
        this.scene.popMatrix();
        // Layer 2 support Beams
        this.scene.pushMatrix();
        this.scene.translate(1.5, 0.4, -4.5);
        this.bigBeam.display();
        this.scene.translate(-3, 0, 0);
        this.bigBeam.display();
        this.scene.popMatrix();
        // Top layer support beams
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
        // Back structure
        this.scene.pushMatrix();
        this.scene.translate(0,0, -8);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        // back wheel support beam
        this.scene.pushMatrix();
        this.scene.translate(0,0,0);
        this.scene.scale(1.5,1,0.65);
        this.beam.display();
        this.scene.popMatrix();
        this.scene.translate(0,-0.4,0);
        this.beam.display();
        this.scene.popMatrix();
        // Back wheels
        this.scene.translate(5.5 / 2,-0.4,-8);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.wheel.display();
        this.scene.translate(0,0,-5.5);
        this.scene.rotate(Math.PI, 0,1,0);
        this.wheel.display();



        this.scene.popMatrix();
    }
}
