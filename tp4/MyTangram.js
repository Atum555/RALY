import { CGFobject } from "../lib/CGF.js";
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
    }

    display() {
        this.scene.tangramTexture.apply();
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
        this.bigTriangle.updateTexCoords([1, 0, 1, 1, 0.5, 0.5]);
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
        this.bigTriangle.updateTexCoords([0, 0, 1, 0, 0.5, 0.5]);
        this.bigTriangle.display();
        this.scene.popMatrix();

        // * parallelogram
        this.scene.pushMatrix();
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
        this.scene.rotate(Math.PI, 0, 0, 1);

        this.triangle.display();
        this.scene.popMatrix();

        // * close small triangle
        this.scene.pushMatrix();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(Math.PI / 2, 0, 0, -1);

        this.smallTriangle.updateTexCoords([0.25, 0.75, 0.75, 0.75, 0.5, 0.5]);
        this.smallTriangle.display();
        this.scene.popMatrix();

        //* far small triangle
        this.scene.pushMatrix();

        this.scene.translate(1.71, -1.13, 0);
        this.scene.rotate(Math.PI / 4, 0, 0, -1);
        this.smallTriangle.updateTexCoords([0, 0, 0, 0.5, 0.25, 0.25]);
        this.smallTriangle.display();
        this.scene.popMatrix();

        //* diamond
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

        this.diamond.display();
        this.scene.popMatrix();
    }
}
