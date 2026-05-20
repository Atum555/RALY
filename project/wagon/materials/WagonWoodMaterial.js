import { CGFappearance } from "../../../lib/CGF.js";

export class WagonWoodMaterial extends CGFappearance {
    constructor(scene) {
        super(scene);
        this.setAmbient(0.3, 0.3, 0.3, 1);
        this.setDiffuse(0.8, 0.8, 0.8, 1);
        this.setSpecular(0.1, 0.1, 0.1, 1);
        this.setShininess(10.0);
    }
}
