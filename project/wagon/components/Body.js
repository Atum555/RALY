import { CGFGroup } from "../../core/CGFGroup.js";
import { Board } from "./Board.js";
import { CGFobjModel } from "../../../lib/extra/CGFobjModel.js";
export class Body extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        this.floorBoard = this.addPart(new Board(this.scene, 10, 4, 4));
        this.sideBoard = this.addPart(new Board(this.scene, 7.5, 1.65, 1.65));
        this.endBoard = this.addPart(new Board(this.scene, 1.5, 4.4, 4));
        this.foothold = this.addPart(new Board(this.scene, 4, 1, 1));

        this.engine = new CGFobjModel(this.scene, "wagon/engine/2GR.obj");
        this._ralyMode = false;
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        // Floor
        this.scene.pushMatrix();
        this.scene.translate(0, 0, 1);
        this.floorBoard.display();
        this.scene.popMatrix();

        // End boards (front and back)
        this.displayEndBoard(4);
        this.displayEndBoard(-3.75);

        // Side boards (left and right)
        this.displaySideBoard(1);
        this.displaySideBoard(-1);

        // Foothold
        this.scene.pushMatrix();
        this.scene.translate(0, 1, 4.5);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.foothold.display();
        this.scene.popMatrix();

        // Engine
        if (this._ralyMode) {
            this.scene.pushMatrix();
            this.scene.translate(-4.5, 3.5, 5);
            this.scene.rotate(Math.PI / 2, 1, 0, 0);
            this.scene.scale(0.1, 0.1, 0.1);
            this.engine.display();
            this.scene.popMatrix();
        }
    }

    displayEndBoard(z) {
        this.scene.pushMatrix();
        this.scene.translate(0, 0, z);
        this.scene.rotate(Math.PI / 2, -1, 0, 0);
        this.scene.translate(0, 0, 1);
        this.endBoard.display();
        this.scene.popMatrix();
    }

    displaySideBoard(side) {
        this.scene.pushMatrix();
        this.scene.translate(side * 2.1, 0.97, 0);
        this.scene.rotate((11 * Math.PI) / 24, 0, 0, side);
        this.sideBoard.display();
        this.scene.popMatrix();
    }
}
