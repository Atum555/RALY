import { CGFshader, CGFtexture } from "../../lib/CGF.js";

// Shared appearance for objects lit by the abstract sun and shadowed by the
// terrain + wagon shadow maps: owns a texture and a textured, shadow-aware
// shader, feeds the shader the scene's shadow-map uniforms, and binds the
// (mipmapped) texture to unit 0. The shader's sampler uniform must read from
// texture unit 0; pass its name as `samplerName`.
//
// Used by the wagon's horses and the hay bales, which differ only in their
// texture, shader, and sampler-uniform name.
export class ShadowedTexturedMaterial {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, texturePath, vertPath, fragPath, samplerName) {
        this.scene = scene;
        this.texture = new CGFtexture(scene, texturePath);

        // Textured + shadow-aware shader; its sampler reads from texture unit 0.
        this.shader = new CGFshader(scene.gl, vertPath, fragPath);
        this.shader.setUniformsValues({ [samplerName]: 0 });

        this.texture_filtering_ready = false;
    }

    // =====================================================
    // Apply
    // =====================================================

    // Activate the shader and feed it the sun + shadow uniforms from the scene's
    // shadow maps, then bind the (mipmapped) texture to unit 0.
    apply() {
        const scene = this.scene;
        scene.setActiveShader(this.shader);

        const sm = scene.shadow_map;
        if (sm) {
            if (sm.enabled) sm.applyUniforms(this.shader);
            else sm.disable(this.shader);
        }

        // Distance fog, shared with the terrain so textured obstacles fade into
        // the same horizon haze. setUniformsValues only writes uniforms the shader
        // declares, so materials whose shader has no fog (the horses) ignore it.
        if (scene.terrain) scene.terrain.uploadFogUniforms(this.shader);

        // Bind after the shadow maps (which leave TEXTURE0 active); bind(0) also
        // sets scene.activeTexture so the texCoord attribute gets wired up.
        this.configureTextureFiltering();
        this.texture.bind(0);
    }

    // Build a mip chain for the texture so it stops shimmering at distance,
    // matching the terrain's trilinear + anisotropic filtering. Runs lazily once
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
