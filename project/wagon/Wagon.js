import { CGFshader } from "../../lib/CGF.js";
import { CGFGroup } from "../core/CGFGroup.js";
import { Body } from "./components/Body.js";
import { UnderBody } from "./components/UnderBody.js";
import { HayBale } from "../obstacles/HayBale.js";

export class Wagon extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        // -- Driving state (W/A/S/D) --
        this.steering_angle = 0;
        this.position_x = 0;
        this.position_z = 0;
        this.heading = 0;
        this.speed = 0;

        // Net acceleration actually felt this frame (throttle/brake/drag/steering
        // scrub combined), derived from the per-frame speed change. For display.
        this.acceleration = 0;
        this.last_speed = 0;

        this.base_max_speed = 50.0;
        this.max_speed = this.base_max_speed;
        this.min_speed = 0.0;

        // Holding Ctrl temporarily lifts the top speed by this factor (a boost).
        // When released, max_speed drops back and the steering scrub in update()
        // eases the over-speed back down to the normal cap.
        this.boost_factor = 2.0;
        this.max_steering_angle = Math.PI / 8;
        this.min_steering_angle = -Math.PI / 8;

        // Speed at or below which the full steering lock is available. Above it
        // the usable steering angle tapers off linearly toward
        // high_speed_steer_fraction of the lock at max_speed, so the wagon can't
        // crank the wheels hard over at speed and jackknife the load.
        this.full_steer_speed = 15.0;
        this.high_speed_steer_fraction = 0.35;

        // Sharp turns cap the top speed: at full steering lock the wagon can
        // only reach (1 - steering_speed_falloff) of its straight-line max,
        // so hauling the cargo through a tight turn forces it to slow down.
        this.steering_speed_falloff = 0.65;

        // How quickly excess speed eases down to the steering cap when turning
        // (per second). Lower = the wagon coasts off speed more gently.
        this.steering_scrub_rate = 3.5;

        this.acceleration_rate = 20.0;
        this.braking_rate = 50.0;
        this.drag_rate = 25.0; // coasting deceleration when no throttle/brake
        this.steering_rate = 2.0;
        this.wheel_base = 8.0; // front axle (z=5.5) to rear axle (z=-2.5), see UnderBody

        // True while the player is neither accelerating nor braking, so the
        // wagon coasts and drag eases it to a stop.
        this.coasting = true;

        // -- Terrain following --
        // Wheel footprint in local wagon space (right = +x, forward = +z),
        // matching the axle layout in UnderBody. Used to sit the wagon on the
        // terrain and tilt it so all four wheels track the ground.
        this.axle_front_z = 5.5;
        this.axle_rear_z = -2.5;
        this.track_half = 2.75;

        // The wheel axles sit at local y = axle_height and the wheels have
        // radius wheel_radius (see UnderBody/Wheel), so the wheels' lowest point
        // is axle_height - wheel_radius below the origin. Lift the wagon by that
        // amount so the wheels rest on the ground instead of sinking into it.
        this.axle_height = 1.0;
        this.wheel_radius = 2.0;
        this.wheel_ground_offset = this.wheel_radius - this.axle_height;

        this.position_y = 0;
        this.pitch = 0; // nose up/down, about the local x (right) axis
        this.roll = 0; // lean left/right, about the local z (forward) axis

        this.initComponents();
    }

    initComponents() {
        this.body = this.addPart(new Body(this.scene));
        this.under_body = this.addPart(new UnderBody(this.scene, 0.0));
        this.haybale = this.addPart(new HayBale(this.scene, 10, 10));

        // Soft solid-colour shader for the body and chassis (not the hay), lit by
        // the abstract sun and taking the terrain + self shadows. _depth_pass is
        // set by ShadowMap while casting, so display() emits plain geometry then.
        this.body_shader = new CGFshader(this.scene.gl, "wagon/shaders/wagon.vert", "wagon/shaders/wagon.frag");
        this.body_shader.setUniformsValues({ u_wagon_color: [0.62, 0.46, 0.34] });
        this._depth_pass = false;
    }

    // =====================================================
    // Movement
    // =====================================================

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Live steering angle in degrees, for read-only display in the UI.
    get steering_angle_degrees() {
        return (this.steering_angle * 180) / Math.PI;
    }

    // Top speed allowed at the current steering angle: full lock scrubs it
    // down to (1 - steering_speed_falloff) of the straight-line max.
    currentMaxSpeed() {
        const steer_fraction = Math.abs(this.steering_angle) / this.max_steering_angle;
        return this.max_speed * (1 - this.steering_speed_falloff * steer_fraction);
    }

    accelerate(amount) {
        // Clamp to the straight-line max; the steering cap is enforced by the
        // gradual scrub in update(), not snapped to here.
        this.speed = this.clamp(this.speed + amount, this.min_speed, this.max_speed);
    }

    // Toggle the speed boost (Ctrl). Lifts the top speed while held; the scrub
    // in update() eases any over-speed back down once it is released.
    setBoost(active) {
        this.max_speed = active ? this.base_max_speed * this.boost_factor : this.base_max_speed;
    }

    // Largest steering angle usable at the current speed: full lock at or below
    // full_steer_speed, tapering linearly to high_speed_steer_fraction of the
    // lock by max_speed.
    currentMaxSteeringAngle() {
        const t = (this.speed - this.full_steer_speed) / (this.max_speed - this.full_steer_speed);
        const fraction = 1 - (1 - this.high_speed_steer_fraction) * this.clamp(t, 0, 1);
        return this.max_steering_angle * fraction;
    }

    steer(amount) {
        const limit = this.currentMaxSteeringAngle();
        this.steering_angle = this.clamp(this.steering_angle + amount, -limit, limit);
    }

    // =====================================================
    // Update
    // =====================================================

    update(delta_seconds = 0) {
        // Drag: with no throttle or brake input, rolling resistance bleeds the
        // speed toward zero so the wagon coasts to a stop.
        if (this.coasting && delta_seconds > 0 && this.speed > 0) {
            this.speed = Math.max(this.min_speed, this.speed - this.drag_rate * delta_seconds);
        }

        // Steering into a turn lowers the speed cap; ease any excess speed
        // down to it with an exponential approach so the wagon scrubs off pace
        // gradually as it tightens its line, instead of snapping to the cap.
        if (delta_seconds > 0) {
            const steer_max = this.currentMaxSpeed();
            if (this.speed > steer_max) {
                const decay = Math.exp(-this.steering_scrub_rate * delta_seconds);
                this.speed = steer_max + (this.speed - steer_max) * decay;
            }
        }

        // Bicycle-model kinematics: the steered front wheels turn the heading
        // while the wagon rolls forward. Forward is +Z (the front axle side).
        //
        // The rear axle is the reference point: it rolls straight along the
        // heading and the wagon yaws about it. Integrating the centre instead
        // would give the rear axle a lateral velocity, sliding it to the
        // outside of a turn and making the front wheels understeer.
        if (delta_seconds > 0) {
            const sin_h = Math.sin(this.heading);
            const cos_h = Math.cos(this.heading);

            // The wagon's speed is measured along the slope it sits on, so its
            // horizontal (XZ) component shrinks with the pitch. On a steep climb
            // cos(pitch) approaches zero, which keeps the wagon from racing
            // straight up a near-vertical wall.
            const ground_speed = this.speed * Math.cos(this.pitch);

            // Rear axle in world space (local z = axle_rear_z), advanced along
            // the current heading.
            let rear_x = this.position_x + this.axle_rear_z * sin_h;
            let rear_z = this.position_z + this.axle_rear_z * cos_h;
            rear_x += ground_speed * sin_h * delta_seconds;
            rear_z += ground_speed * cos_h * delta_seconds;

            // Turn about the rear axle.
            const angular_velocity = (this.speed * Math.tan(this.steering_angle)) / this.wheel_base;
            this.heading += angular_velocity * delta_seconds;

            // Re-attach the origin rigidly ahead of the rear axle along the new
            // heading.
            this.position_x = rear_x - this.axle_rear_z * Math.sin(this.heading);
            this.position_z = rear_z - this.axle_rear_z * Math.cos(this.heading);
        }

        this.under_body.updateDirection(this.steering_angle);

        // Net acceleration over the full frame: compares against the speed at the
        // end of the previous frame, so it folds in the throttle/brake applied
        // before update() as well as the drag and steering scrub applied above.
        if (delta_seconds > 0) {
            this.acceleration = (this.speed - this.last_speed) / delta_seconds;
            this.last_speed = this.speed;
        }

        this.followTerrain();
    }

    // Sit the wagon on the terrain and tilt it to match the slope, by sampling
    // the ground height under each of the four wheels.
    followTerrain() {
        const terrain = this.scene.terrain;
        if (!terrain) return;

        const cos_h = Math.cos(this.heading);
        const sin_h = Math.sin(this.heading);

        // Ground height under a wheel at local offset (right, forward), rotated
        // into world space by the current heading.
        const sample = (lx, lz) => {
            const dx = lx * cos_h + lz * sin_h;
            const dz = -lx * sin_h + lz * cos_h;
            return terrain.getHeightAt(this.position_x + dx, this.position_z + dz);
        };

        const fl = sample(-this.track_half, this.axle_front_z);
        const fr = sample(this.track_half, this.axle_front_z);
        const rl = sample(-this.track_half, this.axle_rear_z);
        const rr = sample(this.track_half, this.axle_rear_z);

        const front = (fl + fr) / 2;
        const rear = (rl + rr) / 2;
        const left = (fl + rl) / 2;
        const right = (fr + rr) / 2;

        this.position_y = (fl + fr + rl + rr) / 4 + this.wheel_ground_offset;
        this.pitch = -Math.atan2(front - rear, this.axle_front_z - this.axle_rear_z);
        this.roll = Math.atan2(right - left, 2 * this.track_half);
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();

        // Drive the wagon around the world, riding on top of the terrain
        this.scene.translate(this.position_x, this.position_y, this.position_z);
        this.scene.rotate(this.heading, 0, 1, 0);
        this.scene.rotate(this.pitch, 1, 0, 0);
        this.scene.rotate(this.roll, 0, 0, 1);

        // Light the body + chassis with the soft, shadow-aware shader (skipped in
        // the shadow depth pass, which keeps the active depth shader).
        if (!this._depth_pass) this.applyBodyShader();

        // Chassis
        this.under_body.display();

        // Body
        this.scene.translate(0, 2.4, 0);
        this.body.display();

        // Cargo: the bales carry their own textured, shadow-aware shader. In the
        // depth pass they emit plain geometry under the active depth shader so they
        // cast into the wagon shadow map (and self-shadow) like the body.
        this.haybale._depth_pass = this._depth_pass;
        this.displayHayBales();
        if (!this._depth_pass) this.scene.setActiveShader(this.scene.defaultShader);

        this.scene.popMatrix();
    }

    // Activate the body shader and feed it the sun + shadow uniforms from the
    // scene's shadow maps, so the body lights softly and takes terrain and self
    // shadows. Falls back to a plain unshadowed look if shadows are off.
    applyBodyShader() {
        this.scene.setActiveShader(this.body_shader);
        const sm = this.scene.shadow_map;
        if (!sm) return;
        if (sm.enabled) sm.applyUniforms(this.body_shader);
        else sm.disable(this.body_shader);
    }

    displayHayBales() {
        // Two bales turned 90° so they lie crosswise, stacked one on top of the
        // other at the back of the wagon (relative to the body frame).
        const x = 0;
        const z = -2.6;
        const scale = 0.9;
        const heights = [1.1, 2.7];

        // The bale runs from local z = 0 to z = 3, so its centre sits at z = 1.5;
        // shift back by that after the turn to keep it centred across the wagon.
        const bale_half_length = 1.5;

        for (const y of heights) {
            this.scene.pushMatrix();
            this.scene.translate(x, y, z);
            this.scene.rotate(Math.PI / 2, 0, 1, 0);
            this.scene.scale(scale, scale, scale);
            this.scene.translate(0, 0, -bale_half_length);
            this.haybale.display();
            this.scene.popMatrix();
        }
    }
}
