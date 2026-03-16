import { CGFobject, CGFappearance } from "../lib/CGF.js";
import { MyDiamond } from "./MyDiamond.js";
import { MyTriangle } from "./MyTriangle.js";
import { MyParallelogram } from "./MyParallelogram.js";
import { MyTriangleBig } from "./MyTriangleBig.js";
import { MyTriangleSmall } from "./MyTriangleSmall.js";

/**
 * MyTangram
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyTangram extends CGFobject {
    constructor(scene) {
        super(scene);
        this.diamond = new MyDiamond(scene);
        this.triangle = new MyTriangle(scene);
        this.parallelogram = new MyParallelogram(scene);
        this.bigTriangle = new MyTriangleBig(scene);
        this.smallTriangle = new MyTriangleSmall(scene);

        this.objects = [
            this.diamond,
            this.triangle,
            this.parallelogram,
            this.bigTriangle,
            this.smallTriangle,
        ];

        this.initMaterials();
    }

    initMaterials() {
        // Red Diffuse (no ambient, no specular)
        this.materialRed = new CGFappearance(this.scene);
        this.materialRed.setAmbient(1, 0.0, 0.0, 1.0);
        this.materialRed.setDiffuse(0, 0, 0, 1.0);
        this.materialRed.setSpecular(1, 0, 0, 1.0);
        this.materialRed.setShininess(10.0);

        this.materialBlue = new CGFappearance(this.scene);
        this.materialBlue.setAmbient(0, 0.0, 1, 1.0);
        this.materialBlue.setDiffuse(0, 0, 0, 1.0);
        this.materialBlue.setSpecular(0, 0, 1, 1.0);
        this.materialBlue.setShininess(10.0);

        this.materialGreen = new CGFappearance(this.scene);
        this.materialGreen.setAmbient(0.0, 1, 0.0, 1.0);
        this.materialGreen.setDiffuse(0, 0, 0, 1.0);
        this.materialGreen.setSpecular(0, 1, 0, 1.0);
        this.materialGreen.setShininess(10.0);

        this.materialYellow = new CGFappearance(this.scene);
        this.materialYellow.setAmbient(1, 1.0, 0.0, 1.0);
        this.materialYellow.setDiffuse(0, 0, 0, 1.0);
        this.materialYellow.setSpecular(1, 1, 0, 1.0);
        this.materialYellow.setShininess(10.0);

        this.materialPurple = new CGFappearance(this.scene);
        this.materialPurple.setAmbient(0.5, 0.0, 0.5, 1.0);
        this.materialPurple.setDiffuse(0, 0, 0, 1.0);
        this.materialPurple.setSpecular(0.5, 0, 0.5, 1.0);
        this.materialPurple.setShininess(10.0);

        this.materialPink = new CGFappearance(this.scene);
        this.materialPink.setAmbient(1.0, 0.7, 0.8, 1.0);
        this.materialPink.setDiffuse(0, 0, 0, 1.0);
        this.materialPink.setSpecular(1, 0.7, 0.8, 1.0);
        this.materialPink.setShininess(10.0);

        this.materialOrange = new CGFappearance(this.scene);
        this.materialOrange.setAmbient(1.0, 0.67, 0.0, 0.5);
        this.materialOrange.setDiffuse(0, 0, 0, 1.0);
        this.materialOrange.setSpecular(1, 0.67, 0, 1.0);
        this.materialOrange.setShininess(10.0);
    }

    initNormalVizBuffers() {
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].initNormalVizBuffers();
        }
    }

    enableNormalViz() {
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].enableNormalViz();
        }
    }

    disableNormalViz() {
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].disableNormalViz();
        }
    }

    display() {
        // * big triangle left
        this.scene.pushMatrix();
        this.materialOrange.apply();
        // prettier-ignore
        var tran = [
            1,0, 0, 0,
            0,1, 0, 0,
            0,0, 1, 0,
            -4,0, 0, 1
        ];
        // prettier-ignore
        var rot= [
            Math.cos(Math.PI / 2), Math.sin(Math.PI / 2), 0 , 0,
            -Math.sin(Math.PI/ 2), Math.cos(Math.PI / 2), 0, 0, 
            0, 0, 1, 0,
            0, 0, 0, 1
        ];

        this.scene.multMatrix(tran);
        this.scene.multMatrix(rot);

        this.bigTriangle.display();
        this.scene.popMatrix();

        // * big triangle left 2
        this.scene.pushMatrix();
        this.materialBlue.apply();
        // prettier-ignore
        var tran = [
            1,0, 0, 0,
            0,1, 0, 0,
            0,0, 1, 0,
            -4,0, 0, 1
        ];
        // prettier-ignore
        var rot= [
            Math.cos(- Math.PI / 2), Math.sin(- Math.PI / 2), 0 , 0,
            -Math.sin(- Math.PI/ 2), Math.cos(- Math.PI / 2), 0, 0, 
            0, 0, 1, 0,
            0, 0, 0, 1
        ];

        this.scene.multMatrix(tran);
        this.scene.multMatrix(rot);

        this.bigTriangle.display();
        this.scene.popMatrix();

        // * parallelogram
        this.scene.pushMatrix();
        this.materialYellow.apply();
        // prettier-ignore
        var invert = [
            -1,0,0,0,
            0,1,0,0,
            0,0,1,0,
            0,0,0,1
        ];
        this.scene.multMatrix(invert);

        this.parallelogram.display();
        this.scene.popMatrix();

        // * normal triangle
        this.scene.pushMatrix();
        this.materialPink.apply();
        this.scene.rotate(Math.PI, 0, 0, 1);

        this.triangle.display();
        this.scene.popMatrix();

        // * close small triangle
        this.scene.pushMatrix();
        this.materialRed.apply();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(Math.PI / 2, 0, 0, -1);

        this.smallTriangle.display();
        this.scene.popMatrix();

        //* far small triangle
        this.scene.pushMatrix();
        this.materialPurple.apply();
        this.scene.translate(1.71, -1.13, 0);
        this.scene.rotate(Math.PI / 4, 0, 0, -1);
        this.smallTriangle.display();
        this.scene.popMatrix();

        //* diamond
        this.scene.pushMatrix();
        this.scene.customMaterial.apply();
        // prettier-ignore
        tran = [
            1,0, 0, 0,
            0,1, 0, 0,
            0,0, 1, 0,
            1.71,0.29, 0, 1
        ];

        // prettier-ignore
        rot = [
            Math.cos(- Math.PI / 4), Math.sin(- Math.PI / 4), 0 , 0,
            -Math.sin(- Math.PI/ 4), Math.cos(- Math.PI / 4), 0, 0, 
            0, 0, 1, 0,
            0, 0, 0, 1
        ];

        this.scene.multMatrix(tran);
        this.scene.multMatrix(rot);

        this.diamond.display();
        this.scene.popMatrix();
    }
}
