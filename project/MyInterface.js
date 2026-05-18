import { CGFinterface, dat } from "../lib/CGF.js";
import { MyScene } from "./MyScene.js";

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
        sunControls.add(this.scene, "sky_sun_dayNightCycle").name("Day/Night Cycle");
        const sun = this.scene.lights[MyScene.Lights.SUN];
        sunControls.add(sun, "enabled").name("Enabled");
        sunControls.add(sun.position, "0", -20.0, 20.0).name("X Position");
        sunControls.add(sun.position, "1", -20.0, 20.0).name("Y Position");
        sunControls.add(sun.position, "2", -20.0, 20.0).name("Z Position");

        var cloudControls = skyControls.addFolder("Clouds");
        cloudControls.add(this.scene, "sky_clouds_display").name("Display Clouds");
        cloudControls.add(this.scene, "sky_clouds_mode", { "Flat Quad": 0, "Sphere Mapped": 1 }).name("Cloud Mode");
        cloudControls.add(this.scene, "sky_clouds_yPosition", -20.0, 20.0).step(0.5).name("Y Position");
        cloudControls.add(this.scene, "sky_clouds_scrollSpeed", 0.0, 2.0).step(0.05).name("Scroll Speed");

        var cloudAppearance = cloudControls.addFolder("Appearance");
        cloudAppearance.add(this.scene, "sky_clouds_appearance_dark", 0.0, 1.0).step(0.05).name("Dark");
        cloudAppearance.add(this.scene, "sky_clouds_appearance_light", 0.0, 1.0).step(0.05).name("Light");
        cloudAppearance.add(this.scene, "sky_clouds_appearance_cover", 0.0, 1.0).step(0.05).name("Cover");
        cloudAppearance.add(this.scene, "sky_clouds_appearance_alpha", 0.0, 20.0).step(0.5).name("Alpha");
        cloudAppearance.add(this.scene, "sky_clouds_appearance_scale", 0.5, 3.0).step(0.1).name("Scale");

        var cloudColors = cloudControls.addFolder("Colors");
        cloudColors.add(this.scene, "sky_clouds_colors_skyTint", 0.0, 1.0).step(0.05).name("Sky Tint");
        cloudColors.addColor(this.scene.sky_clouds_colors, "SkyColour1").name("Sky Color 1");
        cloudColors.addColor(this.scene.sky_clouds_colors, "SkyColour2").name("Sky Color 2");
        cloudColors.addColor(this.scene.sky_clouds_colors, "nightColour1").name("Night Color 1");
        cloudColors.addColor(this.scene.sky_clouds_colors, "nightColour2").name("Night Color 2");

        var obstacleControls = this.gui.addFolder("Obstacles");

        var haybaleControls = obstacleControls.addFolder("Hay Bale");
        haybaleControls.add(this.scene, "obstacles_haybale_slices", 3, 100).step(1).name("Slices").onChange((v) => {
            this.scene.haybale.slices = v;
            this.scene.haybale.initBuffers();
            this.scene.haybale.initNormalVizBuffers();
        });
        haybaleControls.add(this.scene, "obstacles_haybale_stacks", 1, 50).step(1).name("Stacks").onChange((v) => {
            this.scene.haybale.stacks = v;
            this.scene.haybale.initBuffers();
            this.scene.haybale.initNormalVizBuffers();
        });

        var rockControls = obstacleControls.addFolder("Rock");
        rockControls.add(this.scene, "obstacles_rock_radius", 0.1, 5).step(0.1).name("Radius").onChange((v) => {
            this.scene.rock.radius = v;
            this.scene.rock.initBuffers();
            this.scene.rock.initNormalVizBuffers();
        });
        rockControls.add(this.scene, "obstacles_rock_scale", 1, 3).step(0.1).name("Scale").onChange((v) => {
            this.scene.rock.scale = v;
            this.scene.rock.initBuffers();
            this.scene.rock.initNormalVizBuffers();
        });

        return true;
    }
}
