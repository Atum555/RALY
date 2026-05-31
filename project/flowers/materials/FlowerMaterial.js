import { CGFappearance } from "../../../lib/CGF.js";

export class FlowerMaterial extends CGFappearance {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, color) {
        super(scene);
        this.setAmbient(color[0], color[1], color[2], 1);
        this.setDiffuse(color[0], color[1], color[2], 1);
        this.setSpecular(0.0, 0.0, 0.0, 1);
    }
}
