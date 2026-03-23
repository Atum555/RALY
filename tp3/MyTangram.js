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
        this.objects = [this.diamond,this.triangle,this.bigTriangle,this.parallelogram,this.smallTriangle]
        this.initMaterials();
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

    initMaterials() {
        this.orangeMaterial = this.createMaterial(1.0, 0.6, 0.0);
        this.blueMaterial = this.createMaterial(31 / 255, 143 / 255, 214 / 255);
        this.yellowMaterial = this.createMaterial(1.0, 1.0, 0.0);
        this.pinkMaterial = this.createMaterial(
            229 / 255,
            138 / 255,
            183 / 255,
        );
        this.greenMaterial = this.createMaterial(0.0, 1.0, 0.0);
        this.redMaterial = this.createMaterial(1.0, 0.0, 0.0);
        this.purpleMaterial = this.createMaterial(
            163 / 255,
            91 / 255,
            198 / 255,
        );
    }

    createMaterial(r, g, b) {
        const material = new CGFappearance(this.scene);
        material.setAmbient(r * 0.3, g * 0.3, b * 0.3, 1.0);
        material.setDiffuse(r, g, b, 1.0);
        material.setSpecular(0.9, 0.9, 0.9, 1.0);
        material.setShininess(80.0);
        return material;
    }

    display() {
        // * big triangle left
        this.scene.pushMatrix();
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

        this.orangeMaterial.apply();
        this.bigTriangle.display();
        this.scene.popMatrix();

        // * big triangle left 2
        this.scene.pushMatrix();
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

        this.blueMaterial.apply();
        this.bigTriangle.display();
        this.scene.popMatrix();

        // * parallelogram
        this.scene.pushMatrix();
        // Mirroring on X flips the winding order, so temporarily swap the front face.
        this.scene.gl.frontFace(this.scene.gl.CW);
        // prettier-ignore
        var invert = [
            -1,0,0,0,
            0,1,0,0,
            0,0,1,0,
            0,0,0,1
        ];
        this.scene.multMatrix(invert);

        this.yellowMaterial.apply();
        this.parallelogram.display();
        this.scene.gl.frontFace(this.scene.gl.CCW);
        this.scene.popMatrix();

        // * normal triangle
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI, 0, 0, 1);

        this.pinkMaterial.apply();
        this.triangle.display();
        this.scene.popMatrix();

        // * close small triangle
        this.scene.pushMatrix();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(Math.PI / 2, 0, 0, -1);

        this.redMaterial.apply();
        this.smallTriangle.display();
        this.scene.popMatrix();

        //* far small triangle
        this.scene.pushMatrix();

        this.scene.translate(1.71, -1.13, 0);
        this.scene.rotate(Math.PI / 4, 0, 0, -1);
        this.purpleMaterial.apply();
        this.smallTriangle.display();
        this.scene.popMatrix();

        // Diamond / square - Custom material
        this.scene.pushMatrix();

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

        this.scene.customMaterial.apply();
        this.diamond.display();
        this.scene.popMatrix();
    }
}
