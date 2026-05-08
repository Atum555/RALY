import { CGFobject } from "../../lib/CGF.js";
import { Sphere } from "./Sphere.js";

/**
 * Rock
 * @constructor
 * @param scene - Reference to MyScene object
 */
export class Rock extends CGFobject {
    constructor(scene) {
        super(scene);
        this.sphere = new Sphere(scene, 2, 1.5);
    }

    display() {
        this.sphere.display();
    }

    enableNormalViz() {
        this.sphere.enableNormalViz();
    }

    disableNormalViz() {
        this.sphere.disableNormalViz();
    }
}
