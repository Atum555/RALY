import { CGFGroup } from "../core/CGFGroup.js";
import { Circle } from "./Circle.js";
import { Cube } from "./Cube.js";
import { BarnWoodMaterial } from "./materials/BarnWoodMaterial.js";
import { Beam } from "./Beam.js";
import { Prism } from "./Prism.js";
import { Roof } from "./Roof.js";

export class Barn extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

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
        this.material = new BarnWoodMaterial(scene);
        this.initComponents();
    }

    initComponents() {
        this.cube = this.addPart(new Cube(this.scene, this.top, this.opening, this.length, this.header, this.width));
        this.prism = this.addPart(new Prism(this.scene, this.width, this.top, this.length));
        this.beam = this.addPart(new Beam(this.scene,16,0.4));
        this.roof = this.addPart(new Roof(this.scene,this.width,this.top,this.length,2,5,5));
        this.circle = this.addPart(new Circle(this.scene, this.pickup["r"], 50));
    }


    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();
        this.scene.translate(0, this.elevation, 0);
        this.displayBeams();
        this.scene.pushMatrix();

        this.cube.display();
        this.scene.translate(0, this.top, 0);
        this.prism.display();
        this.roof.display();
        this.scene.popMatrix();
        this.scene.pushMatrix();
        this.scene.translate(this.pickup["x"], 0, this.pickup["z"]);
        this.circle.display();
        this.scene.popMatrix();
        this.scene.popMatrix();
    }

    displayFrontBeams(){
        this.scene.pushMatrix();
        this.scene.translate(this.length / 2 - 0.4 ,8.2,this.length / 2 + 1 - 0.9);
        this.scene.rotate(Math.PI / 2, 1, 0, 0);
        this.beam.display();
        this.scene.translate(-this.opening - 2.3,0,0);
        this.beam.display();
        this.scene.translate(-this.opening -0.6,0,0);
        this.beam.display();
        this.scene.translate(-this.opening - 2.3, 0, 0);
        this.beam.display();
        this.scene.rotate(Math.PI / 2, 0,1,0);
        this.scene.scale(1,1,2.95);
        this.scene.translate(2.2,0,8);
        this.beam.display();
        this.scene.translate(5.4,0,0);
        this.beam.display();
        this.scene.popMatrix();
    }

    displayBeams(){
        this.scene.pushMatrix();
        for(let i = 0; i < 4; i++){
            this.displayFrontBeams();
            this.scene.rotate(Math.PI / 2, 0, 1,0);
        }
        this.scene.popMatrix();
    }
}
