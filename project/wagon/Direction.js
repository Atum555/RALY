import {
    CGFobject,
    CGFappearance,
    CGFtexture,
    CGFshader,
} from "../../lib/CGF.js";
import { Beam } from "./Beam.js";

export class Direction extends CGFobject {
    constructor(scene,beamLength,steeringAngle) {
        super(scene);
        this.beamLength = beamLength;
        this.beam = new Beam(this.scene,this.beamLength,0);
        this.steeringAngle = steeringAngle;
    }

    display() {
        this.scene.pushMatrix();
        this.scene.rotate(this.steeringAngle,0,1,0);
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
    }

    enableNormalViz() {
        this.beam.enableNormalViz();
    }

    disableNormalViz() {
        this.beam.disableNormalViz();
    }
}
