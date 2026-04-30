import { CGFinterface, dat } from "../lib/CGF.js";

export class MyInterface extends CGFinterface {
    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        // init GUI. For more information on the methods, check:
        // https://github.com/dataarts/dat.gui/blob/master/API.md
        this.gui = new dat.GUI();

        this.gui.add(this.scene, "scaleFactor", 0.1, 5).name("Scale Factor");
        this.gui.add(this.scene, "displayAxis").name("Display Axis");
        this.gui.add(this.scene, "displayNormals").name("Display Normals");
        this.gui.add(this.scene, 'selectedObject', this.scene.objectIDs).name('Selected Object')

        return true;
    }
}
