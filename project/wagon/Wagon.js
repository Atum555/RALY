import {
    CGFobject,
    CGFappearance,
    CGFtexture,
    CGFshader,
} from "../../lib/CGF.js";
import { Beam } from "./Beam.js";
import { Direction } from "./Direction.js";
import { WagonBody } from "./WagonBody.js";
import { UnderBody } from "./UnderBody.js";
import { HayBale } from "../obstacles/HayBale.js";

export class Wagon extends CGFobject {
    constructor(scene) {
        super(scene);
        this.beamLength = 6;
        this.haybale = new HayBale(this.scene,10,10);
        this.body = new WagonBody(this.scene);
        this.UnderBody = new UnderBody(this.scene, 0.0);
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

        this.bodyMaterial = new CGFappearance(this.scene);
        this.bodyMaterial.setAmbient(0.3, 0.3, 0.3, 1);
        this.bodyMaterial.setDiffuse(0.8, 0.8, 0.8, 1);
        this.bodyMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.bodyMaterial.setShininess(10.0);
    }

    display() {
        //this.beam.display();
        this.scene.pushMatrix();
        this.scene.translate(0,2.4,0);
        this.body.display();
        // HayBales being carried
        this.scene.translate(1,1.2,-3.6);
        this.haybaleMaterial.apply();
        this.haybale.display();
        this.scene.translate(-2,0,0);
        this.haybale.display();
        this.scene.translate(0,2,0);
        this.haybale.display();
        this.scene.translate(2,0,0);
        this.haybale.display();
        this.scene.popMatrix();
        this.bodyMaterial.apply();
        this.UnderBody.display();
    }

    enableNormalViz() {
        this.beam.enableNormalViz();
        this.body.enableNormalViz();
    }

    disableNormalViz() {
        this.beam.disableNormalViz();
        this.body.disableNormalViz();
    }

    updateDirection(angle){
        this.UnderBody.updateDirection(angle);
    }
}
