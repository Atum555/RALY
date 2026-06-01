import { CGFshader, CGFtexture } from "../lib/CGF.js";
import { CGFGroup } from "../core/CGFGroup.js";
import { Cube } from "./components/Cube.js";
import { Beam } from "./components/Beam.js";
import { Prism } from "./components/Prism.js";
import { Roof } from "./components/Roof.js";

export class Barn extends CGFGroup {
    // Per-part wood tints fed to the shared shader between draws (the cube keeps a
    // neutral tint and turns the door/window mask on). The beams and roof tint the
    // wood down to a near-black timber; the gable stays plain.
    static PRISM_TINT = [0.6, 0.5, 0.4];
    static BEAM_TINT = [0.03, 0.03, 0.03];
    static ROOF_TINT = [0.03, 0.03, 0.03];

    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        this.top = 16;
        this.opening = 14;
        this.length = 48;
        this.width = 48;
        this.header = 10;
        this.pickup = { x: 0, z: 25, r: this.length / 3 };

        // Fixed world placement. The whole barn is translated to
        // (pos_x, pos_y, pos_z) and uniformly scaled by barn_scale in display().
        this.pos_x = 0;
        this.pos_z = -110;
        this.barn_scale = 2.7;

        // Sit the barn on the terrain: sample the ground height under the front
        // door (the +z opening face, at local z = length/2) and drop the floor
        // (local y 0.2) onto it so the door threshold meets the ground.
        const door_z = this.pos_z + (this.length / 2) * this.barn_scale;
        const ground_y = scene.terrain ? scene.terrain.getHeightAt(this.pos_x, door_z) : 0;
        this.pos_y = ground_y - 0.2 * this.barn_scale;

        // Set by ShadowMap while it bakes the terrain depth maps: in the depth pass
        // the timber emits plain geometry under the active depth shader instead of
        // switching to its own lit shader (see display()).
        this._depth_pass = false;

        this.initMaterials();
        this.initComponents();
    }

    // One shadow-aware wood shader and one set of textures for the whole barn, so
    // every timber part draws under a single program (the per-part tint/mask is a
    // cheap uniform update between draws -- see display()). The samplers are wired
    // once: wood on unit 0, door/window/mask on 1/2/3; the shadow maps live on
    // 8/9/10 (ShadowMap.applyUniforms), so they never collide.
    initMaterials() {
        const gl = this.scene.gl;
        this.shader = new CGFshader(gl, "barn/shaders/barn.vert", "barn/shaders/barn.frag");
        this.shader.setUniformsValues({ uSampler: 0, uSampler2: 1, uSampler3: 2, uSampler4: 3, uAOStrength: 1.0 });

        this.woodTex = new CGFtexture(this.scene, "barn/textures/wood.jpg");
        this.doorTex = new CGFtexture(this.scene, "barn/textures/door.jpg");
        this.windowTex = new CGFtexture(this.scene, "barn/textures/windows.jpg");
        this.maskTex = new CGFtexture(this.scene, "barn/textures/mask.jpg");
    }

    initComponents() {
        this.cube = this.addPart(new Cube(this.scene, this.top, this.opening, this.length, this.header, this.width));
        this.prism = this.addPart(new Prism(this.scene, this.width, this.top, this.length));
        this.beam = this.addPart(new Beam(this.scene, 16, 0.4));
        this.roof = this.addPart(new Roof(this.scene, this.width, this.top, this.length, 2, 5, 5));
    }

    // Activate the shared wood shader, feed it the scene's sun + shadow-map
    // uniforms (so the timber takes the terrain, wagon and its own shadows), and
    // bind the four textures. The three photo textures get a trilinear mipmap
    // chain so distant timber doesn't shimmer; the mask reads crisply on NEAREST.
    beginWood() {
        const scene = this.scene;
        scene.setActiveShader(this.shader);

        const sm = scene.shadow_map;
        if (sm) {
            if (sm.enabled) sm.applyUniforms(this.shader);
            else sm.disable(this.shader);
        }

        const gl = scene.gl;
        this.bindMipmapped(this.woodTex, 0);
        this.bindMipmapped(this.doorTex, 1);
        this.bindMipmapped(this.windowTex, 2);

        // bind() returns false (and leaves nothing bound) until the image has
        // loaded, so gate the one-time NEAREST setup on it -- otherwise the
        // texParameteri calls fire against an unbound target and WebGL warns.
        if (this.maskTex.bind(3) && !this.maskTex._filtered) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            this.maskTex._filtered = true;
        }
    }

    // Bind a photo texture on `unit` and, the first frame its image has finished
    // loading, build a full mipmap chain with trilinear minification (mag stays
    // LINEAR). CGFtexture never mipmaps on its own, so we do it here; the one-time
    // generateMipmap is gated by a flag, so steady-state frames just rebind.
    bindMipmapped(tex, unit) {
        const gl = this.scene.gl;
        if (tex.bind(unit) && !tex._mipmapped) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            tex._mipmapped = true;
        }
    }

    // =====================================================
    // Display
    // =====================================================

    // One frame of the barn. The main pass binds the wood shader once and draws
    // every timber part under it, updating only the cheap tint/mask uniforms
    // between draws -- no per-part shader switches. The depth pass (driven by
    // ShadowMap via _depth_pass) skips all of that and emits plain geometry under
    // the active depth shader so the barn casts into the terrain maps. The pickup
    // marker is painted by the terrain shader (see Terrain.display), not here.
    display() {
        const depth = this._depth_pass;
        const scene = this.scene;

        scene.pushMatrix();
        scene.translate(this.pos_x, this.pos_y, this.pos_z);
        scene.scale(this.barn_scale, this.barn_scale, this.barn_scale);

        if (!depth) this.beginWood();

        // Beams (all 24 share one tint/mask: set once, draw them all). The fake AO
        // is keyed to the box's barn-space height; the beams' nested transforms put
        // their local space out of that frame, so AO is switched off for them.
        if (!depth) this.shader.setUniformsValues({ uWoodTint: Barn.BEAM_TINT, uUseMask: 0.0, uAOStrength: 0.0 });
        this.displayBeams();

        scene.pushMatrix();
        // Cube walls: neutral tint with the door/window mask on. Ground-contact AO
        // lives on the walls only (their local y is already barn height: 0.2 at the
        // floor), so it is switched back on here after the beams turned it off.
        if (!depth) this.shader.setUniformsValues({ uWoodTint: [1, 1, 1], uUseMask: 1.0, uAOStrength: 1.0 });
        this.cube.display();

        // Gable + roof sit above the ground band, so AO is switched off for them.
        scene.translate(0, this.top, 0);
        if (!depth) this.shader.setUniformsValues({ uWoodTint: Barn.PRISM_TINT, uUseMask: 0.0, uAOStrength: 0.0 });
        this.prism.display();
        if (!depth) this.shader.setUniformsValues({ uWoodTint: Barn.ROOF_TINT, uUseMask: 0.0 });
        this.roof.display();
        scene.popMatrix();

        scene.popMatrix();

        if (!depth) scene.setActiveShader(scene.defaultShader);
    }

    displayFrontBeams() {
        this.scene.pushMatrix();
        this.scene.translate(this.length / 2 - 0.4, 8.2, this.length / 2 + 1 - 0.9);
        this.scene.rotate(Math.PI / 2, 1, 0, 0);
        this.beam.display();
        this.scene.translate(-this.opening - 2.3, 0, 0);
        this.beam.display();
        this.scene.translate(-this.opening - 0.6, 0, 0);
        this.beam.display();
        this.scene.translate(-this.opening - 2.3, 0, 0);
        this.beam.display();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.scale(1, 1, 2.95);
        this.scene.translate(2.2, 0, 8);
        this.beam.display();
        this.scene.translate(5.4, 0, 0);
        this.beam.display();
        this.scene.popMatrix();
    }

    displayBeams() {
        this.scene.pushMatrix();
        for (let i = 0; i < 4; i++) {
            this.displayFrontBeams();
            this.scene.rotate(Math.PI / 2, 0, 1, 0);
        }
        this.scene.popMatrix();
    }
}
