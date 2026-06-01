import { CGFappearance } from "../../lib/CGF.js";

export class StemMaterial extends CGFappearance {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, color) {
        super(scene);
        color = color || [0.3, 0.6, 0.2];
        this.setAmbient(color[0], color[1], color[2], 1);
        this.setDiffuse(color[0], color[1], color[2], 1);
        this.setSpecular(0.0, 0.0, 0.0, 1);
    }
}
