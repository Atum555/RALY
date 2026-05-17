import { CGFappearance, CGFobject } from "../lib/CGF.js";
import { MyUnitCube } from "./MyUnitCube.js";

export class MyWagon extends CGFobject {
    constructor(scene) {
        super(scene);

        this.body = new MyUnitCube(scene);
        // TODO: Replace MyUnitCube placeholder with the final hierarchical Wagon model.

        this.x = 0;
        this.z = 0;
        this.speed = 0;
        this.angle = 0;
        this.steeringAngle = 0;

        this.maxSpeed = 2.0;
        this.minSpeed = 0.0;
        this.maxSteeringAngle = Math.PI / 5;
        this.minSteeringAngle = -Math.PI / 5;

        this.accelerationRate = 1.8;
        this.brakingRate = 2.4;
        this.steeringRate = 1.9;
        this.wheelBase = 1.7;

        this.bodyWidth = 1.1;
        this.bodyHeight = 0.55;
        this.bodyLength = 2.0;

        this.bodyMaterial = new CGFappearance(scene);
        this.bodyMaterial.setAmbient(0.24, 0.15, 0.08, 1);
        this.bodyMaterial.setDiffuse(0.65, 0.42, 0.22, 1);
        this.bodyMaterial.setSpecular(0.08, 0.08, 0.08, 1);
        this.bodyMaterial.setShininess(8.0);
    }

    clamp(value, minimumValue, maximumValue) {
        return Math.max(minimumValue, Math.min(maximumValue, value));
    }

    accelerate(value) {
        this.speed = this.clamp(this.speed + value, this.minSpeed, this.maxSpeed);
    }

    steer(value) {
        this.steeringAngle = this.clamp(
            this.steeringAngle + value,
            this.minSteeringAngle,
            this.maxSteeringAngle,
        );
    }

    update(deltaTimeSeconds) {
        // Kinematics: Emulates front-wheel steering. Body angle slowly interpolates towards steering angle during forward movement.
        if (typeof deltaTimeSeconds !== "number" || deltaTimeSeconds <= 0) {
            return;
        }

        const angularVelocity =
            this.speed * Math.tan(this.steeringAngle) / this.wheelBase;

        this.angle += angularVelocity * deltaTimeSeconds;

        this.x += Math.sin(this.angle) * this.speed * deltaTimeSeconds;
        this.z += Math.cos(this.angle) * this.speed * deltaTimeSeconds;
    }

    display() {
        this.bodyMaterial.apply();

        this.scene.pushMatrix();
        this.scene.translate(this.x, this.bodyHeight / 2, this.z);
        this.scene.rotate(this.angle, 0, 1, 0);
        this.scene.scale(this.bodyWidth, this.bodyHeight, this.bodyLength);
        this.body.display();
        this.scene.popMatrix();
    }
}