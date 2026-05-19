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

        // == Scene ============================================

        this.gui.add(this.scene, "scale_factor", 0.1, 5).name("Scale Factor");
        this.gui.add(this.scene, "display_axis").name("Display Axis");
        this.gui.add(this.scene, "display_normals").name("Display Normals");
        this.gui.add(this.scene, "selected_object", this.scene.object_ids).name("Selected Object");

        // == Sky ==============================================

        const sky_controls = this.gui.addFolder("Sky");
        const sky_radius = sky_controls.add(this.scene, "sky_radius", 100, 1000).step(10).name("Radius");
        sky_radius.onChange(value => {
            this.scene.sky_sphere.radius = value;
            this.scene.sky_sphere.initBuffers();
        });
        const sky_slices = sky_controls.add(this.scene, "sky_slices", 4, 100).step(1).name("Slices");
        sky_slices.onChange(value => {
            this.scene.sky_sphere.slices = value;
            this.scene.sky_sphere.initBuffers();
        });
        const sky_stacks = sky_controls.add(this.scene, "sky_stacks", 4, 100).step(1).name("Stacks");
        sky_stacks.onChange(value => {
            this.scene.sky_sphere.stacks = value;
            this.scene.sky_sphere.initBuffers();
        });

        var sky_colors = sky_controls.addFolder("Colors");
        sky_colors.addColor(this.scene.sky_colors, "sky_day_colour_1").name("Day Color 1");
        sky_colors.addColor(this.scene.sky_colors, "sky_day_colour_2").name("Day Color 2");
        sky_colors.addColor(this.scene.sky_colors, "sky_night_colour_1").name("Night Color 1");
        sky_colors.addColor(this.scene.sky_colors, "sky_night_colour_2").name("Night Color 2");

        // -- Clouds -------------------------------------------

        const cloud_controls = sky_controls.addFolder("Clouds");
        cloud_controls.add(this.scene, "sky_clouds_display").name("Display Clouds");
        cloud_controls.add(this.scene, "sky_clouds_scale", 0.001, 1.0).step(0.01).name("Scale");
        cloud_controls.add(this.scene, "sky_clouds_scroll_speed", 0.0, 2.0).step(0.05).name("Scroll Speed");
        cloud_controls.add(this.scene, "sky_clouds_alpha", 0.0, 20.0).step(0.5).name("Alpha");
        cloud_controls.add(this.scene, "sky_clouds_cover", 0.0, 1.0).step(0.05).name("Cover");
        cloud_controls.add(this.scene, "sky_clouds_light", 0.0, 1.0).step(0.05).name("Light");
        cloud_controls.add(this.scene, "sky_clouds_dark", 0.0, 1.0).step(0.05).name("Dark");
        cloud_controls.add(this.scene, "sky_clouds_tint", 0.0, 1.0).step(0.05).name("Tint");

        // -- Sun ----------------------------------------------

        const sun_controls = sky_controls.addFolder("Sun");
        sun_controls.add(this.scene, "sky_sun_day_night_cycle").name("Day/Night Cycle");

        const sun = this.scene.lights[MyScene.Lights.SUN];
        sun_controls.add(sun, "enabled").name("Enabled");
        sun_controls.add(sun.position, "0", -20.0, 20.0).name("X Position");
        sun_controls.add(sun.position, "1", -20.0, 20.0).name("Y Position");
        sun_controls.add(sun.position, "2", -20.0, 20.0).name("Z Position");

        // == Obstacles ========================================

        var obstacle_controls = this.gui.addFolder("Obstacles");

        // -- Hay Bale -----------------------------------------

        var haybale_controls = obstacle_controls.addFolder("Hay Bale");
        const obstacles_haybale_slices = haybale_controls.add(this.scene, "obstacles_haybale_slices", 3, 100).step(1);
        obstacles_haybale_slices.name("Slices");
        obstacles_haybale_slices.onChange(v => {
            this.scene.haybale.slices = v;
            this.scene.haybale.initBuffers();
            this.scene.haybale.initNormalVizBuffers();
        });
        const obstacles_haybale_stacks = haybale_controls.add(this.scene, "obstacles_haybale_stacks", 1, 50).step(1);
        obstacles_haybale_stacks.name("Stacks");
        obstacles_haybale_stacks.onChange(v => {
            this.scene.haybale.stacks = v;
            this.scene.haybale.initBuffers();
            this.scene.haybale.initNormalVizBuffers();
        });

        // -- Rock ---------------------------------------------

        var rock_controls = obstacle_controls.addFolder("Rock");
        const obstacles_rock_radius = rock_controls.add(this.scene, "obstacles_rock_radius", 0.1, 5).step(0.1);
        obstacles_rock_radius.name("Radius");
        obstacles_rock_radius.onChange(v => {
            this.scene.rock.radius = v;
            this.scene.rock.initBuffers();
            this.scene.rock.initNormalVizBuffers();
        });
        const obstacles_rock_scale = rock_controls.add(this.scene, "obstacles_rock_scale", 1, 3);
        obstacles_rock_scale.step(0.1).name("Scale");
        obstacles_rock_scale.onChange(v => {
            this.scene.rock.scale = v;
            this.scene.rock.initBuffers();
            this.scene.rock.initNormalVizBuffers();
        });

        return true;
    }
}
