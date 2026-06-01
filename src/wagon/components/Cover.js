import { CGFGroup } from "../../core/CGFGroup.js";
import { CoverBeam } from "./CoverBeam.js";
import { CoverCloth } from "./CoverCloth.js";
import { getBeamZPositions } from "./CoverUtils.js";

export class Cover extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, length, nBeams) {
        super(scene);
        this.nBeams = nBeams;
        this.length = length;
        this._depth_pass = false;
        this.coverBeam = this.addPart(new CoverBeam(this.scene, 0.1, 12));
        this.coverCloth = this.addPart(new CoverCloth(this.scene, 0.1, 12, nBeams, length, 1.0));
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.coverCloth._depth_pass = this._depth_pass;
        this.displayCoverBeams();
        this.coverCloth.display();
    }

    displayCoverBeams() {
        let positions = getBeamZPositions(this.nBeams, this.length);
        for (let i = 0; i < this.nBeams; i++) {
            this.scene.pushMatrix();
            this.scene.translate(0, 0, positions[i]);
            this.coverBeam.display();
            this.scene.popMatrix();
        }
    }
}
