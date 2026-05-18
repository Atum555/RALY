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
        this.gui.add(this.scene, "selectedObject", this.scene.objectIDs).name("Selected Object");

        var skyControls = this.gui.addFolder("Sky");
        //skyControls.add(this.scene, "selectedScene", this.scene.sceneIDs).name("Selected Scene(sky)");
        var sunControls = skyControls.addFolder("Sun");
        sunControls.add(this.scene, "enableDayNightCycle").name("Day/Night Cycle");
        sunControls.add(this.scene.lights[0], "enabled").name("Enabled");
        sunControls.add(this.scene.lights[0].position, "0", -20.0, 20.0).name("X Position");
        sunControls.add(this.scene.lights[0].position, "1", -20.0, 20.0).name("Y Position");
        sunControls.add(this.scene.lights[0].position, "2", -20.0, 20.0).name("Z Position");

        var cloudControls = skyControls.addFolder("Clouds");
        cloudControls.add(this.scene, "displayClouds").name("Display Clouds");
        cloudControls.add(this.scene, "cloudMode", { "Flat Quad": 0, "Sphere Mapped": 1 }).name("Cloud Mode");
        cloudControls.add(this.scene, "cloudYPosition", -20.0, 20.0).step(0.5).name("Y Position");
        cloudControls.add(this.scene, "cloudScrollSpeed", 0.0, 2.0).step(0.05).name("Scroll Speed");

        var cloudAppearance = cloudControls.addFolder("Appearance");
        cloudAppearance.add(this.scene, "cloudDark", 0.0, 1.0).step(0.05).name("Dark");
        cloudAppearance.add(this.scene, "cloudLight", 0.0, 1.0).step(0.05).name("Light");
        cloudAppearance.add(this.scene, "cloudCover", 0.0, 1.0).step(0.05).name("Cover");
        cloudAppearance.add(this.scene, "cloudAlpha", 0.0, 20.0).step(0.5).name("Alpha");
        cloudAppearance.add(this.scene, "cloudScale", 0.5, 3.0).step(0.1).name("Scale");

        var cloudColors = cloudControls.addFolder("Colors");
        cloudColors.add(this.scene, "skyTint", 0.0, 1.0).step(0.05).name("Sky Tint");
        cloudColors.addColor(this.scene.cloudColors, "SkyColour1").name("Sky Color 1");
        cloudColors.addColor(this.scene.cloudColors, "SkyColour2").name("Sky Color 2");
        cloudColors.addColor(this.scene.cloudColors, "nightColour1").name("Night Color 1");
        cloudColors.addColor(this.scene.cloudColors, "nightColour2").name("Night Color 2");
        return true;
    }
}
