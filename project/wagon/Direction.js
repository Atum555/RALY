import { CGFGroup } from "../core/CGFGroup.js";
import { Beam } from "./Beam.js";
import { Wheel } from "./Wheel.js";

export class Direction extends CGFGroup {
    constructor(scene,beamLength,steeringAngle) {
        super(scene);
        this.beamLength = beamLength;
        this.wheel = this.addPart(new Wheel(this.scene));
        this.beam = this.addPart(new Beam(this.scene, this.beamLength, 0.2));
        this.steeringAngle = steeringAngle;
    }

    display() {
        this.scene.pushMatrix();
        this.scene.rotate(this.steeringAngle,0,1,0);
        this.scene.pushMatrix();
        this.scene.translate(0,0,this.beamLength / 2);
        this.beam.display();
        this.scene.pushMatrix();
        this.scene.translate(0,0,this.beamLength / 2);
        this.scene.rotate(Math.PI / 2,0,1,0);
        this.beam.display();
        this.scene.popMatrix();
        this.scene.pushMatrix();
        this.scene.translate(0, 0, - this.beamLength / 2);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.beam.display();
        this.scene.popMatrix();
        this.scene.popMatrix();
        
        this.scene.pushMatrix();
        this.scene.translate(this.beamLength / 2,0,0);
        this.scene.rotate(Math.PI / 2,0,1,0);
        this.wheel.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate( - this.beamLength / 2, 0, 0);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.rotate(Math.PI,0 , 1, 0);
        this.wheel.display();
        this.scene.popMatrix();
        this.scene.popMatrix();
    }

    updateDirection(angle){
        this.steeringAngle = angle
    }
}
