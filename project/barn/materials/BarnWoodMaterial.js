import { CGFappearance } from "../../../lib/CGF.js";

export class BarnWoodMaterial extends CGFappearance {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        this.setAmbient(1, 0.3, 0.3, 1);
        this.setDiffuse(0.8, 0.3, 0.3, 1);
        this.setSpecular(0, 0, 0, 1);
        this.setShininess(100.0);
        this.loadTexture("barn/textures/wood.jpg");
        this.setTextureWrap("REPEAT", "REPEAT");
    }
}
