import { CGFGroup } from "../core/CGFGroup.js";
import { Circle } from "./Circle.js";
import { Cube } from "./Cube.js";
import { Prism } from "./Prism.js";
//import { Roof } from "./Roof.js";

export class Barn extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================
// TODO Add shader for windows and door, essentially allowing it to have a second and third texture
// TODO since we're already gonna be using a shader why not also do it for the white beams that can be added detail to the barn
// TODO Fix the roof

    constructor(scene, radius = 96, elevation = 0) {
        super(scene);
        this.radius = radius;
        this.elevation = elevation;
        this.top = 16;
        this.opening = 14;
        this.length = 48;
        this.width = 48;
        this.header = 10;
        this.pickup = {x: 0, z: 48, r : this.length / 2}
        this.initComponents();
    }

    initComponents() {
        this.cube = this.addPart(new Cube(this.scene, this.top, this.opening, this.length, this.header, this.width));
        this.prism = this.addPart(new Prism(this.scene, this.width, this.top, this.length));
        //this.roof = this.addPart(new Roof(this.scene,this.width,this.top,this.length,2,5,5));
        this.circle = this.addPart(new Circle(this.scene, this.pickup["r"], 50));
    }


    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();
        this.scene.translate(0, this.elevation, 0);
        this.scene.pushMatrix();

        this.cube.display();
        this.scene.translate(0, this.top, 0);
        this.prism.display();
//        this.roof.display();
        this.scene.popMatrix();
        this.scene.pushMatrix();
        this.scene.translate(this.pickup["x"], 0, this.pickup["z"]);
        this.circle.display();
        this.scene.popMatrix();
        this.scene.popMatrix();
    }
}
