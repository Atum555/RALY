import { CGFappearance } from "../../../lib/CGF.js";

export class BarnWoodMaterial extends CGFappearance {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        this.setAmbient(0.8,0.8,0.8,1);
        this.setDiffuse(0.8,0.8,0.8,1);
        this.setSpecular(0.8,0.8,0.8,1);
        this.setShininess(15.0);
        this.loadTexture("barn/textures/wood.jpg");
        this.setTextureWrap("REPEAT", "REPEAT");
    }
}
