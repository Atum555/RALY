import { CGFappearance, CGFtexture } from "../../../lib/CGF.js";

export class HorseMaterial extends CGFappearance {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        const texture = new CGFtexture(scene, "wagon/horse/horse.jpg");
        this.setTexture(texture);
        this.setAmbient(1, 1, 1, 1);
        this.setDiffuse(1, 1, 1, 1);
        this.setSpecular(0.1, 0.1, 0.1, 1);
        this.setShininess(10.0);
    }
}
