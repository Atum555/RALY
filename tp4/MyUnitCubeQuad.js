import { CGFobject } from "../lib/CGF.js";
import { MyQuad } from "./MyQuad.js";

/**
 * MyUnitCubeQuad
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class MyUnitCubeQuad extends CGFobject {
    constructor(
        scene,
        topTex = null,
        frontTex = null,
        rightTex = null,
        backTex = null,
        leftTex = null,
        bottomTex = null,
    ) {
        super(scene);
        this.quad = new MyQuad(scene);
        this.topTex = topTex;
        this.frontTex = frontTex;
        this.rightTex = rightTex;
        this.backTex = backTex;
        this.leftTex = leftTex;
        this.bottomTex = bottomTex;
    }

    display() {
        // upper face
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, -1, 0, 0);
        this.scene.translate(0, 0, 0.5);
        if (this.topTex) {
            this.scene.mineTexture.setTexture(this.topTex);
            this.scene.mineTexture.apply();
            if (this.scene.filter)
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.NEAREST,
                );
            else
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.LINEAR,
                );
        }
        this.quad.display();
        this.scene.popMatrix();

        // lower face
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, 1, 0, 0);
        this.scene.translate(0, 0, 0.5);
        if (this.bottomTex) {
            this.scene.mineTexture.setTexture(this.bottomTex);
            this.scene.mineTexture.apply();
            if (this.scene.filter)
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.NEAREST,
                );
            else
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.LINEAR,
                );
        }
        this.quad.display();
        this.scene.popMatrix();

        // front face
        this.scene.pushMatrix();
        this.scene.translate(0, 0, 0.5);
        if (this.frontTex) {
            this.scene.mineTexture.setTexture(this.frontTex);
            this.scene.mineTexture.apply();
            if (this.scene.filter)
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.NEAREST,
                );
            else
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.LINEAR,
                );
        }
        this.quad.display();
        this.scene.popMatrix();

        // back face
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI, 0, 1, 0);
        this.scene.translate(0, 0, 0.5);
        if (this.backTex) {
            this.scene.mineTexture.setTexture(this.backTex);
            this.scene.mineTexture.apply();
            if (this.scene.filter)
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.NEAREST,
                );
            else
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.LINEAR,
                );
        }
        this.quad.display();
        this.scene.popMatrix();

        // left face
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, 0, -1, 0);
        this.scene.translate(0, 0, 0.5);
        if (this.leftTex) {
            this.scene.mineTexture.setTexture(this.leftTex);
            this.scene.mineTexture.apply();
            if (this.scene.filter)
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.NEAREST,
                );
            else
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.LINEAR,
                );
        }
        this.quad.display();
        this.scene.popMatrix();

        // right face
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.translate(0, 0, 0.5);
        if (this.rightTex) {
            this.scene.mineTexture.setTexture(this.rightTex);
            this.scene.mineTexture.apply();
            if (this.scene.filter)
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.NEAREST,
                );
            else
                this.scene.gl.texParameteri(
                    this.scene.gl.TEXTURE_2D,
                    this.scene.gl.TEXTURE_MAG_FILTER,
                    this.scene.gl.LINEAR,
                );
        }
        this.quad.display();
        this.scene.popMatrix();
    }
}
