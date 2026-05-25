import { CGFappearance } from "../../../lib/CGF.js";

export class CircleMaterial extends CGFappearance {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        this.setAmbient(0, 0, 0, 1.0);
        this.setDiffuse(0, 0, 0, 1.0);
        this.setSpecular(0, 0, 0, 1.0);
        this.setShininess(0.0);
        this.setEmission(0.95, 0.92, 0.82, 1.0);
    }
}
