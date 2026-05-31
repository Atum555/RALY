import { CGFshader, CGFtexture } from "../../../lib/CGF.js";

// The draught horses' appearance: a textured, shadow-aware shader that lights the
// horses with the abstract sun and takes the terrain + wagon shadows, exactly like
// the wagon body and the hay bales (it shares their shadow-map uniforms). Owns the
// horse texture and binds it to the shader's sampler.
export class HorseMaterial {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        this.scene = scene;
        this.texture = new CGFtexture(scene, "wagon/horse/horse.jpg");

        // Textured + shadow-aware shader; u_horse_texture samples texture unit 0.
        this.shader = new CGFshader(scene.gl, "wagon/shaders/horse.vert", "wagon/shaders/horse.frag");
        this.shader.setUniformsValues({ u_horse_texture: 0 });

        this.texture_filtering_ready = false;
    }

    // =====================================================
    // Apply
    // =====================================================

    // Activate the horse shader and feed it the sun + shadow uniforms from the
    // scene's shadow maps, then bind the (mipmapped) horse texture to unit 0.
    apply() {
        const scene = this.scene;
        scene.setActiveShader(this.shader);

        const sm = scene.shadow_map;
        if (sm) {
            if (sm.enabled) sm.applyUniforms(this.shader);
            else sm.disable(this.shader);
        }

        // Bind after the shadow maps (which leave TEXTURE0 active); bind(0) also
        // sets scene.activeTexture so the texCoord attribute gets wired up.
        this.configureTextureFiltering();
        this.texture.bind(0);
    }

    // Build a mip chain for the horse texture so it stops shimmering at distance,
    // matching the hay bale's trilinear + anisotropic filtering. Runs lazily once
    // CGFtexture has finished loading (texID is set), then caches the result.
    configureTextureFiltering() {
        if (this.texture_filtering_ready || this.texture.texID === -1) return;
        const gl = this.scene.gl;

        const aniso =
            gl.getExtension("EXT_texture_filter_anisotropic") ||
            gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
            gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
        const maxAniso = aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;

        gl.bindTexture(gl.TEXTURE_2D, this.texture.texID);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.texture_filtering_ready = true;
    }
}
