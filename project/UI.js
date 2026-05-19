import { CGFinterface, dat } from "../lib/CGF.js";

export class UI extends CGFinterface {
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

        const sky = this.scene.sky_sphere;
        const rebuild_sky = () => {
            sky.initBuffers();
            sky.initNormalVizBuffers();
        };
        const sky_controls = this.gui.addFolder("Sky");
        sky_controls.add(sky, "sky_radius", 100, 1000).step(10).name("Radius").onChange(rebuild_sky);
        sky_controls.add(sky, "sky_slices", 4, 100).step(1).name("Slices").onChange(rebuild_sky);
        sky_controls.add(sky, "sky_stacks", 4, 100).step(1).name("Stacks").onChange(rebuild_sky);
        sky_controls.add(sky, "day_night_cycle_speed", 0.0, 5.0).step(0.05).name("Day/Night Speed");
        sky_controls.add(sky, "sky_sun_moon_display").name("Sun / Moon");

        var sky_colors = sky_controls.addFolder("Colors");
        sky_colors.addColor(sky.sky_colors, "sky_day_colour_1").name("Day Color 1");
        sky_colors.addColor(sky.sky_colors, "sky_day_colour_2").name("Day Color 2");
        sky_colors.addColor(sky.sky_colors, "sky_night_colour_1").name("Night Color 1");
        sky_colors.addColor(sky.sky_colors, "sky_night_colour_2").name("Night Color 2");

        // -- Clouds -------------------------------------------

        const cloud_controls = sky_controls.addFolder("Clouds");
        cloud_controls.add(sky, "sky_clouds_display").name("Display Clouds");
        cloud_controls.add(sky, "sky_clouds_drift_speed", 0.0, 0.1).step(0.001).name("Drift Speed");
        cloud_controls.add(sky, "sky_clouds_scale", 0.001, 1.0).step(0.01).name("Scale");
        cloud_controls.add(sky, "sky_clouds_alpha", 0.0, 20.0).step(0.5).name("Alpha");
        cloud_controls.add(sky, "sky_clouds_cover", 0.0, 1.0).step(0.05).name("Cover");
        cloud_controls.add(sky, "sky_clouds_light", 0.0, 1.0).step(0.05).name("Light");
        cloud_controls.add(sky, "sky_clouds_dark", 0.0, 1.0).step(0.05).name("Dark");

        // == Obstacles ========================================

        var obstacle_controls = this.gui.addFolder("Obstacles");

        // -- Hay Bale -----------------------------------------

        const haybale = this.scene.haybale;
        const rebuild_haybale = () => {
            haybale.initBuffers();
            haybale.initNormalVizBuffers();
        };
        var haybale_controls = obstacle_controls.addFolder("Hay Bale");
        haybale_controls.add(haybale, "slices", 3, 100).step(1).name("Slices").onChange(rebuild_haybale);
        haybale_controls.add(haybale, "stacks", 1, 50).step(1).name("Stacks").onChange(rebuild_haybale);

        // -- Rock ---------------------------------------------

        const rock = this.scene.rock;
        const rebuild_rock = () => {
            rock.initBuffers();
            rock.initNormalVizBuffers();
        };
        var rock_controls = obstacle_controls.addFolder("Rock");
        rock_controls.add(rock, "radius", 0.1, 5).step(0.1).name("Radius").onChange(rebuild_rock);
        rock_controls.add(rock, "scale", 1, 3).step(0.1).name("Scale").onChange(rebuild_rock);

        return true;
    }
}
