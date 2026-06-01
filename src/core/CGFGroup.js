import { CGFobject } from "../lib/CGF.js";

export class CGFGroup extends CGFobject {
    constructor(scene) {
        super(scene);
        this.parts = [];
    }

    addPart(part) {
        this.parts.push(part);
        return part;
    }

    enableNormalViz() {
        for (const p of this.parts) p.enableNormalViz();
    }

    disableNormalViz() {
        for (const p of this.parts) p.disableNormalViz();
    }
}
