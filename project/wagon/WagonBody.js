import { CGFobject } from "../../lib/CGF.js";
import { Board } from "./Board.js";
/**
 * WagonBody
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class WagonBody extends CGFobject {
    constructor(scene) {
        super(scene);

        
        this.floorBoard = new Board(this.scene, 8, 4, 4);
        this.sideBoard = new Board(this.scene,7.5,1.65,1.65)
        this.bargeBoard = new Board(this.scene, 1.5, 4.4,4);
        this.hold = new Board(this.scene, 4, 0.75, 0.75);
        this.seat = new Board(this.scene, 4, 1, 1);
    }
    
    display(){
        this.floorBoard.display();
        
        // Frontboard
        this.scene.pushMatrix();
        this.scene.translate(0,0,4);
        this.scene.rotate(Math.PI / 2, -1,0,0);
        this.scene.translate(0,0,1);
        this.bargeBoard.display();
        this.scene.popMatrix();
        
        // Backboard
        this.scene.pushMatrix();
        this.scene.translate(0, 0, -3.75);
        this.scene.rotate(Math.PI / 2, -1, 0, 0);
        this.scene.translate(0, 0, 1);
        this.bargeBoard.display();
        this.scene.popMatrix();

        // SideBoards
        this.scene.pushMatrix();
        this.scene.translate(2.1,0.97,0);
        this.scene.rotate((11 *Math.PI)/24, 0,0,1);
        this.sideBoard.display();
        this.scene.popMatrix();

        // SideBoards
        this.scene.pushMatrix();
        this.scene.translate(-2.1,0.97,0);
        this.scene.rotate((11 *Math.PI)/24, 0,0,-1);
        this.sideBoard.display();
        this.scene.popMatrix();

        // Foothold
        this.scene.pushMatrix();
        this.scene.translate(0,0.7,4.25);
        this.scene.rotate(Math.PI / 2, 0, 1,0);
        this.hold.display();
        this.scene.popMatrix();

        // Seat
        this.scene.pushMatrix();
        this.scene.translate(0,1.55,3);
        this.scene.rotate(Math.PI / 2, 0, 1,0);
        this.seat.display();
        this.scene.popMatrix();

        // Seat Back
        this.scene.pushMatrix();
        this.scene.translate(0,2,2);
        this.scene.rotate(Math.PI / 2, 0, 1,0);
        this.scene.rotate(Math.PI / 3, 0,0,1);
        this.seat.display();
        this.scene.popMatrix();
    }
}