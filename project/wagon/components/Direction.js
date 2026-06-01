import { CGFobjModel } from "../../../lib/extra/CGFobjModel.js";
import { CGFGroup } from "../../core/CGFGroup.js";
import { Beam } from "./Beam.js";
import { Wheel } from "./Wheel.js";
import { ShadowedTexturedMaterial } from "../../core/ShadowedTexturedMaterial.js";

export class Direction extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, beam_length, steering_angle) {
        super(scene);

        this.beam_length = beam_length;
        this.steering_angle = steering_angle;

        this.beam = this.addPart(new Beam(this.scene, this.beam_length, 0.2));
        this.wheel = this.addPart(new Wheel(this.scene));
        this.horse = new CGFobjModel(this.scene, "wagon/horse/horse.obj");
        this.horseMaterial = new ShadowedTexturedMaterial(
            this.scene,
            "wagon/horse/horse.jpg",
            "wagon/shaders/horse.vert",
            "wagon/shaders/horse.frag",
            "u_horse_texture",
        );

        // Set by UnderBody (in turn from Wagon) while the shadow map casts: in the
        // depth pass the horses emit plain geometry under the active depth shader
        // instead of swapping in their textured look.
        this._depth_pass = false;

        // Set by Wagon when the "raly" cheat is active: flips the axle 180°
        // so the front wheels face backward and steering is visually reversed.
        this._ralyMode = false;

        // horse.obj ships without vertex normals, so we derive smooth ones once it
        // has loaded (see ensureHorseNormals) before the lit shader can shade it.
        this._horse_normals_ready = false;
    }

    // The horse model has no `vn` data, so CGFobjModel leaves it with a zero-length
    // normal buffer and the lit shader reads N = 0 everywhere -- the diffuse and
    // shadow terms vanish and only the flat ambient fill shows. Derive smooth
    // per-vertex normals from the triangle geometry (area-weighted face normals
    // accumulated per vertex) and re-upload the buffers. Lazy: the model loads
    // asynchronously, so this runs on the first frame after it is ready.
    ensureHorseNormals() {
        if (this._horse_normals_ready || !this.horse.ready) return;

        const verts = this.horse.vertices;
        const indices = this.horse.indices;
        const normals = new Array(verts.length).fill(0);

        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i] * 3;
            const b = indices[i + 1] * 3;
            const c = indices[i + 2] * 3;

            const e1x = verts[b] - verts[a];
            const e1y = verts[b + 1] - verts[a + 1];
            const e1z = verts[b + 2] - verts[a + 2];
            const e2x = verts[c] - verts[a];
            const e2y = verts[c + 1] - verts[a + 1];
            const e2z = verts[c + 2] - verts[a + 2];

            // Cross product, left unnormalized so larger faces weight more.
            const nx = e1y * e2z - e1z * e2y;
            const ny = e1z * e2x - e1x * e2z;
            const nz = e1x * e2y - e1y * e2x;

            normals[a] += nx;
            normals[a + 1] += ny;
            normals[a + 2] += nz;
            normals[b] += nx;
            normals[b + 1] += ny;
            normals[b + 2] += nz;
            normals[c] += nx;
            normals[c + 1] += ny;
            normals[c + 2] += nz;
        }

        for (let i = 0; i < normals.length; i += 3) {
            const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
            normals[i] /= len;
            normals[i + 1] /= len;
            normals[i + 2] /= len;
        }

        this.horse.normals = normals;
        this.horse.initGLBuffers();
        this._horse_normals_ready = true;
    }

    // =====================================================
    // Update
    // =====================================================

    updateDirection(angle) {
        this.steering_angle = angle;
    }

    update(rightWheelRotation, leftWheelRotation = rightWheelRotation) {
        this.rightWheelRotation = rightWheelRotation;
        this.leftWheelRotation = leftWheelRotation;
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();
        // Steer the whole axle by the current steering angle. The horses are
        // drawn by Wagon in its own articulated frame (displayHorses), not here.
        this.scene.rotate(this.steering_angle, 0, 1, 0);
        this.displayBeams();
        this.displayWheels();

        this.scene.popMatrix();
    }

    // Draw the two side-by-side horses about their stance centre. Wagon places
    // this frame on the terrain ahead of the wagon and tilts it to the local
    // slope; the local layout (the x = ±2 spacing and the mount height) matches
    // the offsets the chassis used to draw them at — UnderBody's
    // translate(0, 1, 5.5) and the team's translate(2, 2, 10) — folded so the
    // forward reach now lives in Wagon's frame and the centre sits at z = 0.
    displayHorses() {
        this.ensureHorseNormals();

        this.scene.pushMatrix();
        this.scene.translate(2, 3, 0);
        this.scene.scale(0.8, 0.8, 0.8);

        // Depth pass: just emit the geometry into the active depth shader so the
        // horses cast into the wagon shadow map (don't swap in the lit shader).
        if (this._depth_pass) {
            this.horse.display();
            this.scene.translate(-4 / 0.8, 0, 0);
            this.horse.display();
            this.scene.popMatrix();
            return;
        }

        // The horses carry their own textured, shadow-aware shader (set by
        // horseMaterial.apply) rather than the solid-colour wagon body shader still
        // active from Wagon.display. Restore that shader afterwards so the beams and
        // wheels keep their wagon look.
        const wagon_shader = this.scene.activeShader;

        this.horseMaterial.apply();
        this.horse.display();
        this.scene.translate(-4 / 0.8, 0, 0);
        this.horse.display();

        this.scene.setActiveShader(wagon_shader);
        this.scene.popMatrix();
    }

    displayBeams() {
        // Longitudinal beam reaching forward from the rear axle cross beam.
        // Hidden in raly mode.
        this.scene.pushMatrix();
        this.scene.translate(0, 0, this.beam_length / 2);
        if (!this._ralyMode) {
            this.beam.display();
        }

        // Back cross beam (the steering axle that carries the two front wheels)
        this.scene.pushMatrix();
        this.scene.translate(0, 0, -this.beam_length / 2);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.beam.display();
        this.scene.popMatrix();
        this.scene.popMatrix();
    }

    displayWheels() {
        // Steering wheels mounted at each end of the axle (mirrored). Each side
        // takes its own rotation so the steering scrub can spin them opposite.
        this.scene.pushMatrix();
        this.scene.translate(this.beam_length / 2, 0, 0);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.rotate(this.rightWheelRotation, 0, 0, 1);
        this.wheel.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(-this.beam_length / 2, 0, 0);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.rotate(Math.PI, 0, 1, 0);
        this.scene.rotate(-this.leftWheelRotation, 0, 0, 1);
        this.wheel.display();
        this.scene.popMatrix();
    }
}
