import {
    CGFobject,
    CGFappearance,
    CGFtexture,
    CGFshader,
} from "../../lib/CGF.js";
import { Beam } from "./Beam.js";
import { Direction } from "./Direction.js";
import { WagonBody } from "./WagonBody.js";

export class Wagon extends CGFobject {
    constructor(scene) {
        super(scene);
        this.beamLength = 3;
        this.beam = new Beam(this.scene,this.beamLength,0);
        this.body = new WagonBody(this.scene);
        this.direction = new Direction(this.scene,this.beamLength,0);
        this.initMaterials();
    }

    initMaterials() {
        this.haybaleMaterial = new CGFappearance(this.scene);
        this.haybaleMaterial.setAmbient(0.3, 0.3, 0.3, 1);
        this.haybaleMaterial.setDiffuse(0.8, 0.8, 0.8, 1);
        this.haybaleMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.haybaleMaterial.setShininess(10.0);
        this.haybaleMaterial.loadTexture("obstacles/textures/hay2.jpg");
        this.haybaleMaterial.setTextureWrap("REPEAT", "REPEAT");
    }

    display() {
        //this.beam.display();
        this.body.display();
    }

    enableNormalViz() {
        this.beam.enableNormalViz();
        this.body.enableNormalViz();
    }

    disableNormalViz() {
        this.beam.disableNormalViz();
        this.body.disableNormalViz();
    }
}
