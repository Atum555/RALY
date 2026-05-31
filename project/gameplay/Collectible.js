import { CGFobject, CGFappearance } from "../../lib/CGF.js";

// Reveal radius (world units): the bale only draws when the wagon is within this
// distance. Scaled up from the original 8-unit value to this larger playfield.
const REVEAL_DISTANCE = 160;

/**
 * Collectible - A golden hay-bale cube the wagon can pick up (the pickup logic
 * itself lives in GameState). It hides once collected, and only reveals while the
 * wagon is near, so the player has to drive up to find it.
 *
 * A self-contained unit cube + flat golden appearance (drawn under the scene's
 * default shader), matching the original collectible rather than the textured,
 * shadow-aware HayBale the wagon hauls as cargo.
 *
 * @param {Scene} scene
 * @param {number} x - world X
 * @param {number} z - world Z
 * @param {number} ground_y - terrain height at (x, z), so it rests on the ground
 */
export class Collectible extends CGFobject {
    constructor(scene, x, z, ground_y) {
        super(scene);

        this.x = x;
        this.z = z;
        this.ground_y = ground_y || 0;
        this.collected = false;

        // Real hay bale ~3 m across; lift by half its height so it rests on Y=0.
        this.size = 3.0;

        // Flat golden hay colour. The scene draws plain appearances under the
        // default shader with no enabled CGF lights, so the colour is carried by
        // a bright ambient term rather than diffuse shading.
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.9, 0.75, 0.15, 1);
        this.material.setDiffuse(0.9, 0.75, 0.15, 1);
        this.material.setSpecular(0.2, 0.18, 0.05, 1);
        this.material.setShininess(8.0);

        this.initBuffers();
    }

    // Unit cube centred on the origin (24 verts so each face has its own normal).
    // prettier-ignore
    initBuffers() {
        this.vertices = [
            -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5, // front
            -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5, // back
            -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, // left
             0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5, // right
            -0.5,  0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -0.5, // top
            -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5,  0.5, // bottom
        ];

        this.indices = [
            0, 1, 2, 0, 2, 3,
            4, 5, 6, 4, 6, 7,
            8, 9, 10, 8, 10, 11,
            12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19,
            20, 21, 22, 20, 22, 23,
        ];

        this.normals = [
             0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
             0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,
            -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
             1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
             0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,
             0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
        ];

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    // Draw only when not yet collected and the wagon is within reveal range.
    display(wagon) {
        if (this.collected) return;
        if (wagon) {
            const dist = Math.hypot(wagon.position_x - this.x, wagon.position_z - this.z);
            if (dist > REVEAL_DISTANCE) return;
        }

        this.material.apply();

        this.scene.pushMatrix();
        this.scene.translate(this.x, this.ground_y + this.size / 2, this.z);
        this.scene.scale(this.size, this.size, this.size);
        super.display();
        this.scene.popMatrix();
    }
}
