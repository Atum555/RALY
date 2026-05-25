import { CGFGroup } from "../core/CGFGroup.js";
import { Cube } from "./Cube.js";
import { Prism } from "./Prism.js";

export class Barn extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        this.top = 16;
        this.opening = 14;
        this.length = 48;
        this.width = 48;
        this.header = 10;
        this.initComponents();
    }

    initComponents() {
        this.cube = this.addPart(new Cube(this.scene, this.top, this.opening, this.length, this.header, this.width));
        this.prism = this.addPart(new Prism(this.scene, this.width, this.top, this.length));
        this.roof = null;
    }


    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();

        this.cube.display();
        this.scene.translate(0,this.top,0);
        this.prism.display();

        this.scene.popMatrix();
    }
}
