import { CGFobject, CGFshader } from "../../lib/CGF.js";
import { hexToRGB } from "../utils.js";

export class SkySphere extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        // -- UI-controlled state --

        this.sky_radius = 5000;
        this.sky_slices = 100;
        this.sky_stacks = 100;
        this.day_night_cycle_speed = 1;
        this.sky_sun_moon_display = true;

        this.sky_colors = {
            sky_day_colour_1: "#3366cc",
            sky_day_colour_2: "#6db3ff",
            sky_night_colour_1: "#050b1a",
            sky_night_colour_2: "#0a1329",
        };

        this.sky_clouds_display = true;
        this.sky_clouds_drift_speed = 0.003;
        this.sky_clouds_scale = 0.3;
        this.sky_clouds_alpha = 8.0;
        this.sky_clouds_cover = 0.2;
        this.sky_clouds_light = 0.3;
        this.sky_clouds_dark = 0.5;

        // -- Internal state --

        this.time_of_day = 2.5;
        this.day_factor = 0;
        this.sky_clouds_drift = 0;

        this.initBuffers();
        this.initShaders();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        let pos_x, pos_y, pos_z, ring_radius;
        let normal_x, normal_y, normal_z;
        const inverse_radius = 1 / this.sky_radius;
        let tex_u, tex_v;

        const half_stacks = Math.floor(this.sky_stacks / 2);
        const slice_angle_step = (2 * Math.PI) / this.sky_slices;
        const stack_angle_step = Math.PI / 2 / half_stacks;
        let slice_angle, stack_angle;

        for (let stack_index = 0; stack_index <= half_stacks; ++stack_index) {
            stack_angle = Math.PI / 2 - stack_index * stack_angle_step;
            ring_radius = this.sky_radius * Math.cos(stack_angle);
            pos_y = this.sky_radius * Math.sin(stack_angle);

            for (let slice_index = 0; slice_index <= this.sky_slices; ++slice_index) {
                slice_angle = slice_index * slice_angle_step;

                pos_x = ring_radius * Math.cos(slice_angle);
                pos_z = -ring_radius * Math.sin(slice_angle);
                this.vertices.push(pos_x);
                this.vertices.push(pos_y);
                this.vertices.push(pos_z);

                normal_x = pos_x * inverse_radius;
                normal_y = pos_y * inverse_radius;
                normal_z = pos_z * inverse_radius;
                this.normals.push(-normal_x * 30);
                this.normals.push(-normal_y * 30);
                this.normals.push(-normal_z * 30);

                tex_u = slice_index / this.sky_slices;
                tex_v = stack_index / half_stacks;
                this.texCoords.push(tex_u);
                this.texCoords.push(tex_v);
            }
        }
        let current_ring_start, next_ring_start;
        for (let stack_index = 0; stack_index < half_stacks; ++stack_index) {
            current_ring_start = stack_index * (this.sky_slices + 1);
            next_ring_start = current_ring_start + this.sky_slices + 1;

            for (
                let slice_index = 0;
                slice_index < this.sky_slices;
                ++slice_index, ++current_ring_start, ++next_ring_start
            ) {
                if (stack_index != 0) {
                    this.indices.push(current_ring_start + 1);
                    this.indices.push(next_ring_start);
                    this.indices.push(current_ring_start);
                }

                this.indices.push(next_ring_start + 1);
                this.indices.push(next_ring_start);
                this.indices.push(current_ring_start + 1);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    initShaders() {
        this.sphere_shader = new CGFshader(
            this.scene.gl,
            "sky/shaders/sphereClouds.vert",
            "sky/shaders/sphereClouds.frag",
        );
    }

    // =====================================================
    // Update
    // =====================================================

    update(delta_time) {
        // Update clouds
        this.sky_clouds_drift += this.sky_clouds_drift_speed * delta_time * 0.001;

        // Update Day/Night cycle
        this.time_of_day += this.day_night_cycle_speed * delta_time * 0.0001;

        const sun_pitch = (this.time_of_day / (Math.PI * 2)) * Math.PI;
        const sun_y = Math.sin(sun_pitch);

        // sun_y map from [-0.1, 0.2] to [0, 1]
        this.day_factor = Math.max(0, Math.min(1, (sun_y + 0.1) / (0.3)));
        this.day_factor = this.day_factor * this.day_factor;

        const radius = 20.0;
        const x = -2;
        const y = Math.sin(sun_pitch) * radius;
        const z = -Math.cos(sun_pitch) * radius;
        const { Lights } = this.scene.constructor;
        const sun = this.scene.lights[Lights.SUN];
        const moon = this.scene.lights[Lights.MOON];

        sun.setPosition(x, y - 3.5, -z, 1.0);
        moon.setPosition(x, -y + 3.5, z, 1.0);

        const buffer = 3.0;
        if (y > -buffer) sun.enable();
        else sun.disable();
        if (y < buffer) moon.enable();
        else moon.disable();

        sun.update();
        moon.update();
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.setActiveShader(this.sphere_shader);

        this.sphere_shader.setUniformsValues({
            radius: this.sky_radius,
            sun_moon_display: this.sky_sun_moon_display,
            day_colour1: hexToRGB(this.sky_colors["sky_day_colour_1"], false),
            day_colour2: hexToRGB(this.sky_colors["sky_day_colour_2"], false),
            night_colour1: hexToRGB(this.sky_colors["sky_night_colour_1"], false),
            night_colour2: hexToRGB(this.sky_colors["sky_night_colour_2"], false),
            cloud_display: this.sky_clouds_display,
            cloud_drift: this.sky_clouds_drift,
            cloud_scale: this.sky_clouds_scale,
            cloud_alpha: this.sky_clouds_alpha,
            cloud_cover: this.sky_clouds_cover,
            cloud_light: this.sky_clouds_light,
            cloud_dark: this.sky_clouds_dark,
            sun_angle: this.time_of_day,
            day_factor: this.day_factor,
        });
        super.display();

        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
