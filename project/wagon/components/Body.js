import { CGFshader } from "../../../lib/CGF.js";
import { CGFGroup } from "../../core/CGFGroup.js";
import { Board } from "./Board.js";
import { CGFobjModel } from "../../../lib/extra/CGFobjModel.js";
export class Body extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        this.floorBoard = this.addPart(new Board(this.scene, 10, 4, 4));
        this.sideBoard = this.addPart(new Board(this.scene, 7.5, 1.65, 1.65));
        this.endBoard = this.addPart(new Board(this.scene, 1.5, 4.4, 4));
        this.foothold = this.addPart(new Board(this.scene, 4, 1, 1));

        this.engine = new CGFobjModel(this.scene, "wagon/engine/2GR.obj");

        // Procedural metallic, shadow-aware shader for the raly-mode engine block.
        // Unlike the wood body it carries no texture (the model has no UVs), so the
        // metal look is computed from the lighting; it reads and casts the same
        // sun/terrain/wagon shadows as the rest of the wagon. Fed the scene's shadow
        // and fog uniforms in applyEngineShader, mirroring ShadowedTexturedMaterial.
        this.engineShader = new CGFshader(this.scene.gl, "wagon/shaders/engine.vert", "wagon/shaders/engine.frag");

        // The engine .obj ships without vertex normals, so derive smooth ones once
        // it has loaded (see ensureEngineNormals) before the lit shader can shade it.
        this._engine_normals_ready = false;

        // Set by Wagon while the shadow map casts: in the depth pass the engine
        // emits plain geometry under the active depth shader instead of its metal
        // look, so it casts into the wagon shadow map like the body and horses.
        this._depth_pass = false;
        this._ralyMode = false;
    }

    // The engine model has no `vn` data, so CGFobjModel leaves it with a
    // zero-length normal buffer and the lit shader reads N = 0 everywhere — the
    // diffuse, specular and shadow terms vanish and only the flat ambient fill
    // shows. Derive smooth per-vertex normals from the triangle geometry
    // (area-weighted face normals accumulated per vertex) and re-upload the
    // buffers. Lazy: the model loads asynchronously, so this runs on the first
    // frame after it is ready. Mirrors Direction.ensureHorseNormals.
    ensureEngineNormals() {
        if (this._engine_normals_ready || !this.engine.ready) return;

        const verts = this.engine.vertices;
        const indices = this.engine.indices;
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

        this.engine.normals = normals;
        this.engine.initGLBuffers();
        this._engine_normals_ready = true;
    }

    // Activate the engine's metallic shader and feed it the scene's sun + shadow
    // uniforms (so it receives terrain and wagon shadows) and the shared distance
    // fog, the same way ShadowedTexturedMaterial.apply does for the textured parts.
    applyEngineShader() {
        const scene = this.scene;
        scene.setActiveShader(this.engineShader);

        const sm = scene.shadow_map;
        if (sm) {
            if (sm.enabled) sm.applyUniforms(this.engineShader);
            else sm.disable(this.engineShader);
        }
        if (scene.terrain) scene.terrain.uploadFogUniforms(this.engineShader);
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        // Floor
        this.scene.pushMatrix();
        this.scene.translate(0, 0, 1);
        this.floorBoard.display();
        this.scene.popMatrix();

        // End boards (front and back)
        this.displayEndBoard(4);
        this.displayEndBoard(-3.75);

        // Side boards (left and right)
        this.displaySideBoard(1);
        this.displaySideBoard(-1);

        // Foothold
        this.scene.pushMatrix();
        this.scene.translate(0, 1, 4.5);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.foothold.display();
        this.scene.popMatrix();

        // Engine
        if (this._ralyMode) {
            this.displayEngine();
        }
    }

    // Draw the raly-mode engine block. In the depth pass it just emits geometry
    // under the active depth shader, so it casts into the wagon shadow map like
    // the body; in the main pass it swaps in its own metallic, shadow-receiving
    // shader, then restores the wagon body shader still active from Wagon.display.
    displayEngine() {
        this.ensureEngineNormals();

        const wagon_shader = this._depth_pass ? null : this.scene.activeShader;
        if (!this._depth_pass) this.applyEngineShader();

        this.scene.pushMatrix();
        this.scene.translate(-4.5, 3.5, 5);
        this.scene.rotate(Math.PI / 2, 1, 0, 0);
        this.scene.scale(0.1, 0.1, 0.1);
        this.engine.display();
        this.scene.popMatrix();

        if (wagon_shader) this.scene.setActiveShader(wagon_shader);
    }

    displayEndBoard(z) {
        this.scene.pushMatrix();
        this.scene.translate(0, 0, z);
        this.scene.rotate(Math.PI / 2, -1, 0, 0);
        this.scene.translate(0, 0, 1);
        this.endBoard.display();
        this.scene.popMatrix();
    }

    displaySideBoard(side) {
        this.scene.pushMatrix();
        this.scene.translate(side * 2.1, 0.97, 0);
        this.scene.rotate((11 * Math.PI) / 24, 0, 0, side);
        this.sideBoard.display();
        this.scene.popMatrix();
    }
}
