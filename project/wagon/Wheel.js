import { CGFGroup } from "../core/CGFGroup.js";
import { MyUnitCube } from "./MyUnitCube.js";
import { MyCylinder } from "./MyCylinder.js";

export class Wheel extends CGFGroup {
    constructor(scene) {
        super(scene);
        this.hub = this.addPart(new MyCylinder(scene, 12, 1));
        this.segment = this.addPart(new MyUnitCube(scene));
    }

    display() {
        let numSpokes = 12;
        let wheelRadius = 2.0;
        let rimThickness = 0.15;
        let wheelWidth = 0.3;

        this.scene.pushMatrix();
        this.scene.scale(0.3, 0.3, wheelWidth - 0.1);
        this.hub.display();
        this.scene.popMatrix();

        for (let i = 0; i < numSpokes; i++) {
            let angle = (i * 2 * Math.PI) / numSpokes;

            this.scene.pushMatrix();
            this.scene.rotate(angle, 0, 0, 1);
            this.scene.translate(0, wheelRadius / 2.0, 0);
            this.scene.scale(0.06, wheelRadius, 0.06);
            this.segment.display();
            this.scene.popMatrix();

            this.scene.pushMatrix();
            this.scene.rotate(angle, 0, 0, 1);
            this.scene.translate(0, wheelRadius, 0);

            let segmentLength =
                wheelRadius * ((2 * Math.PI) / numSpokes) * 1.05;
            this.scene.scale(segmentLength, rimThickness, wheelWidth);
            this.segment.display();
            this.scene.popMatrix();
        }
    }
}
