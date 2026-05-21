import { CGFGroup } from "../../core/CGFGroup.js";
import { CoverBeam } from "./CoverBeam.js";
import { CoverCloth } from "./CoverCloth.js";

export class Cover extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, length, nBeams) {
        super(scene);
        this.nBeams = nBeams;
        this.length = length;
        this.coverBeam = this.addPart(new CoverBeam(this.scene, 0.1, 12));
        this.coverCloth = this.addPart(new CoverCloth(this.scene,0.1,12,nBeams,length,1.0));
    }

    // =====================================================
    // Display
    // =====================================================

    display(){
        this.displayCoverBeams();
        this.coverCloth.display();
    }


    displayCoverBeams(){
        for (let i = 0; i < this.nBeams; i++) {
            this.scene.pushMatrix();

            let zOffset = -(this.length / 2) + i * (this.length / (this.nBeams- 1));
            this.scene.translate(0, 0, zOffset);

            this.coverBeam.display();
            this.scene.popMatrix();
        }
    }
}