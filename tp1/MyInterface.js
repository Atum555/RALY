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
        this.gui.add(this.scene, "displayDiamond").name("Display Diamond");
        this.gui.add(this.scene, "displayTriangle").name("Display Triangle");
        this.gui.add(this.scene, "displaySmallTriangle").name("Display Small Triangle");
        this.gui.add(this.scene, "displayBigTriangle").name("Display Big Triangle");
        this.gui.add(this.scene, "displayParallelogram").name("Display Parallelogram");

        this.gui.add(this.scene, "diamondVisibility").name("Diamond Visibility");
        this.gui.add(this.scene, "triangleVisibility").name("Triangle Visibility");
        this.gui.add(this.scene, "parallelogramVisibility").name("Paralelogram Visibility");
        this.gui.add(this.scene, "bigTriangleVisibility").name("Big Triangle Visibility");
        this.gui.add(this.scene, "smallTriangleVisibility").name("Small Triangle Visibility");

        return true;
    }
}
