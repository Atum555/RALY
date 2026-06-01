import { CGFshader } from "../../lib/CGF.js";
import { CGFGroup } from "../core/CGFGroup.js";
import { Body } from "./components/Body.js";
import { UnderBody } from "./components/UnderBody.js";
import { Cover } from "./components/Cover.js";
import { HayBale } from "../obstacles/HayBale.js";

export class Wagon extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        // -- Driving state (W/A/S/D) --
        this.steering_angle = 0;
        this.wheelRotation = 0; // rear wheels: rolls with ground speed
        // Front wheels: shared forward roll, but the steering scrub is opposite
        // on each side because the axle pivots about its centre.
        this.frontWheelRotationRight = 0;
        this.frontWheelRotationLeft = 0;
        this.last_steering_angle = 0;
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

        // Length of the front steering axle (UnderBody builds Direction with 5.5),
        // whose wheels mount at ±front_axle_beam/2 from the central pivot. That
        // half-length is the lever arm the wheels swing through when steering.
        this.front_axle_beam = 5.5;

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
        //
        // The rolling radius is read off the wheel model, not guessed: Wheel.js
        // builds its rim as WheelRim(radius = 2.0, thickness = 0.15), and the
        // rim's outer surface (the contact circle) is at radius + thickness, so
        // the tyre meets the ground at 2.15. The wheel is never scaled when
        // displayed, so that is its true world radius and sets the roll rate.
        this.axle_height = 1.0;
        this.wheel_radius = 2.15;
        this.wheel_ground_offset = this.wheel_radius - this.axle_height;

        this.position_y = 0;
        this.pitch = 0; // nose up/down, about the local x (right) axis
        this.roll = 0; // lean left/right, about the local z (forward) axis

        // -- Articulated horse team --
        // The draught horses hang off the front of the wagon on the drawbar
        // hinge, so they follow the terrain under their own feet rather than
        // riding the chassis pitch: both wagon axles stay on the ground and so
        // does the team. Their stance centre sits horse_reach ahead of the hitch
        // (the steering pivot at horse_hitch_z; UnderBody mounts Direction there)
        // and is swung by the steering angle so the team points where it is
        // steered. horse_half_length / horse_track_half are the fore-aft and
        // left-right spans used to read the local slope for the team's pitch and
        // roll (the two horses stand at x = ±2). horse_hitch_z / horse_hitch_y are
        // the front hitch (drawbar pivot) in wagon-local space, mirroring
        // UnderBody's translate(0, 1, 5.5); horse_reach is the forward gap from
        // the hitch to the team.
        this.horse_hitch_z = 5.5;
        this.horse_hitch_y = 1.0;
        this.horse_reach = 7.5;
        this.horse_half_length = 3.0;
        this.horse_track_half = 2.0;

        // Updated each frame by followTerrain(): the team's pitch and roll, the
        // world height to drop them at, and their stance centre in world XZ.
        this.horse_pitch = 0;
        this.horse_roll = 0;
        this.horse_anchor_y = 0;
        this.horse_center_x = 0;
        this.horse_center_z = 0;

        this.initComponents();
    }

    initComponents() {
        this.body = this.addPart(new Body(this.scene));
        this.under_body = this.addPart(new UnderBody(this.scene, 0.0));
        this.cover = this.addPart(new Cover(this.scene, 7.5, 5));
        this.haybale = this.addPart(new HayBale(this.scene, 10, 10));

        // Soft solid-colour shader for the body and chassis (not the hay), lit by
        // the abstract sun and taking the terrain + self shadows. _depth_pass is
        // set by ShadowMap while casting, so display() emits plain geometry then.
        this.body_shader = new CGFshader(this.scene.gl, "wagon/shaders/wagon.vert", "wagon/shaders/wagon.frag");
        this.body_shader.setUniformsValues({ u_wagon_color: [0.62, 0.46, 0.34] });
        this._depth_pass = false;
        this._ralyMode = false;
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

        // Roll the wheels at the wagon's ground speed: a wheel rolling without
        // slipping turns at angular velocity ground_speed / wheel_radius. We use
        // the horizontal ground speed (the slope speed projected by the pitch,
        // matching the kinematics above), so on a climb the wheels slow with the
        // distance actually covered over the terrain and stop when it stops.
        const ground_speed = this.speed * Math.cos(this.pitch);
        const wheel_roll = (ground_speed / this.wheel_radius) * delta_seconds;
        this.wheelRotation = (this.wheelRotation + wheel_roll) % (Math.PI * 2);

        // The steered front wheels trace a wider arc than the rear axle, so they
        // cover more ground per unit of travel and roll faster by exactly
        // 1 / cos(steering_angle) (bicycle model). Deriving their roll from that
        // distance keeps them following the real ground spin, just quicker into
        // a turn, instead of spinning by an arbitrary amount.
        const front_ground_speed = ground_speed / Math.cos(this.steering_angle);
        const front_wheel_roll = (front_ground_speed / this.wheel_radius) * delta_seconds;

        // Sweeping the steering pivots the whole front axle, so each wheel's
        // contact point arcs through (front_axle_beam / 2) * Δsteer along the
        // ground. Rolling that distance turns the wheel by arm / wheel_radius per
        // radian of steer, so the front wheels visibly spin as they are steered
        // (even at a standstill) — at a rate derived from the geometry, not a
        // guessed factor.
        const steering_change = this.steering_angle - this.last_steering_angle;
        this.last_steering_angle = this.steering_angle;
        const steering_arm = this.front_axle_beam / 2;
        const steering_scrub = (steering_arm / this.wheel_radius) * steering_change;

        // The axle pivots about its centre, so the two wheels arc in opposite
        // directions as the steering sweeps: the scrub subtracts on the right and
        // adds on the left, while both keep the shared forward roll.
        this.frontWheelRotationRight = (this.frontWheelRotationRight + front_wheel_roll - steering_scrub) % (Math.PI * 2);
        this.frontWheelRotationLeft = (this.frontWheelRotationLeft + front_wheel_roll + steering_scrub) % (Math.PI * 2);

        this.under_body.update(this.wheelRotation, this.frontWheelRotationRight, this.frontWheelRotationLeft);

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

        // -- Articulated horse team --
        // The horses hang off the front of the wagon on the drawbar hinge, so
        // they follow the terrain under their own feet instead of riding the
        // chassis pitch. Their stance centre sits horse_reach ahead of the hitch
        // (horse_hitch_z), swung by the steering angle so the team points where
        // it is steered; read the slope across horse_half_length for the team's
        // own pitch and drop them onto the ground at that stance.
        const sin_s = Math.sin(this.steering_angle);
        const cos_s = Math.cos(this.steering_angle);

        // The hitch (drawbar pivot at the wagon's front) swings back as the
        // chassis pitches up a climb or down a descent, so track its actual
        // fore-aft position rather than a fixed one: the team then keeps a steady
        // gap to the moving front instead of drifting forward over the ground.
        // The reach itself stays constant — foreshortening it by the pitch as
        // well over-pulls at steep angles and parks the horses inside the wagon.
        const cos_p = Math.cos(this.pitch);
        const hitch_fwd = this.horse_hitch_y * Math.sin(this.pitch) + this.horse_hitch_z * cos_p;
        const center_lx = this.horse_reach * sin_s;
        const center_lz = hitch_fwd + this.horse_reach * cos_s;
        const hl = this.horse_half_length;
        const ht = this.horse_track_half;

        // Steered forward (sin_s, cos_s) and right (cos_s, -sin_s) axes: sample
        // the slope fore-aft for the team's pitch and left-right for its roll,
        // exactly as the wagon does across its wheelbase and track.
        const horse_front = sample(center_lx + hl * sin_s, center_lz + hl * cos_s);
        const horse_back = sample(center_lx - hl * sin_s, center_lz - hl * cos_s);
        const horse_right = sample(center_lx + ht * cos_s, center_lz - ht * sin_s);
        const horse_left = sample(center_lx - ht * cos_s, center_lz + ht * sin_s);
        const horse_ground = sample(center_lx, center_lz);

        this.horse_pitch = -Math.atan2(horse_front - horse_back, 2 * hl);
        this.horse_roll = Math.atan2(horse_right - horse_left, 2 * ht);
        // Sit the team's stance the same height above its own terrain as the
        // wagon body rides above its wheels, so the feet meet the ground exactly
        // as they do on the flat (the front/rear axles use wheel_ground_offset).
        this.horse_anchor_y = horse_ground + this.wheel_ground_offset;
        this.horse_center_x = this.position_x + center_lx * cos_h + center_lz * sin_h;
        this.horse_center_z = this.position_z - center_lx * sin_h + center_lz * cos_h;
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        // Light the body + chassis with the soft, shadow-aware shader (skipped in
        // the shadow depth pass, which keeps the active depth shader). The horses
        // carry their own textured material, so forward the depth-pass flag for
        // their shadow casting.
        if (!this._depth_pass) this.applyBodyShader();
        this.under_body._depth_pass = this._depth_pass;

        // -- Wagon body + chassis: drive around the world, tilted on the terrain
        //    so all four wheels track the ground.
        this.scene.pushMatrix();
        this.scene.translate(this.position_x, this.position_y, this.position_z);
        this.scene.rotate(this.heading, 0, 1, 0);
        this.scene.rotate(this.pitch, 1, 0, 0);
        this.scene.rotate(this.roll, 0, 0, 1);

        this.under_body.display();

        // Body
        this.scene.translate(0, 2.4, 0);
        this.body.display();

        if (!this._ralyMode) {
            this.cover.display();
        }

        // Cargo: the bales carry their own textured, shadow-aware shader. In the
        // depth pass they emit plain geometry under the active depth shader so they
        // cast into the wagon shadow map (and self-shadow) like the body.
        this.haybale._depth_pass = this._depth_pass;
        this.displayHayBales();
        this.scene.popMatrix();

        // -- Horse team: articulated off the wagon's front, following the terrain
        //    under their own feet (their own pitch + ground height) so the team
        //    stays on the ground while the wagon's axles do too.
        if (!this._ralyMode) {
            this.displayHorses();
        }

        if (!this._depth_pass) this.scene.setActiveShader(this.scene.defaultShader);
    }

    // Draw the draught horses as a unit hinged at the wagon's front (the
    // drawbar). They share the wagon's heading and steering swing, but take their
    // own pitch and ground height — sampled in followTerrain() from the terrain
    // under their stance — so the team sits on the ground independently of how
    // the chassis is pitched.
    displayHorses() {
        this.scene.pushMatrix();
        this.scene.translate(this.horse_center_x, this.horse_anchor_y, this.horse_center_z);
        this.scene.rotate(this.heading, 0, 1, 0);
        this.scene.rotate(this.steering_angle, 0, 1, 0);
        this.scene.rotate(this.horse_pitch, 1, 0, 0);
        this.scene.rotate(this.horse_roll, 0, 0, 1);
        this.under_body.displayHorses();
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

    activateRalyMode() {
        if (this._ralyMode) return;
        this._ralyMode = true;
        this.body._ralyMode = true;
        this.under_body._ralyMode = true;
        this.under_body.direction._ralyMode = true;
        this.base_max_speed = 200.0;
        this.boost_factor = 4.0;
        this.max_speed = this.base_max_speed;
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

        // Both bales share one material: activate it (and re-upload the shadow
        // uniforms) once, then emit each bale's geometry under it — no per-bale
        // shader switch.
        this.haybale.beginBatch();

        for (const y of heights) {
            this.scene.pushMatrix();
            this.scene.translate(x, y, z);
            this.scene.rotate(Math.PI / 2, 0, 1, 0);
            this.scene.scale(scale, scale, scale);
            this.scene.translate(0, 0, -bale_half_length);
            this.haybale.displayShape();
            this.scene.popMatrix();
        }
    }
}
