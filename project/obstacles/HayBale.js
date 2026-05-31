import { CGFobject, CGFshader, CGFtexture } from "../../lib/CGF.js";

export class HayBale extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);

        this.slices = 25;
        this.stacks = 3;

        // Rounded end caps: a smooth dome swept from the wall edge to a pole, so
        // the ends blend into the long edges instead of meeting them at a hard
        // rim. cap_stacks is the dome's ring resolution; cap_depth is how far it
        // bulges out along the bale's axis (per end).
        this.cap_stacks = 4;
        this.cap_depth = 0.3;

        this.initBuffers();
        this.initMaterials();

        // Set by the wagon while it bakes its shadow map: in the depth pass the
        // bale emits plain geometry under the active depth shader instead of
        // switching to its own lit shader.
        this._depth_pass = false;
    }

    initMaterials() {
        // Own CGFtexture (not a CGFappearance) so we control the filtering and can
        // build a mip chain like the terrain materials.
        this.texture = new CGFtexture(this.scene, "obstacles/textures/hay2.jpg");
        this.texture_filtering_ready = false;

        // Custom shader: textures the bale and takes the sun's terrain + self
        // shadows, the same uniforms the wagon body shader uses. u_hay_texture
        // reads from unit 0.
        this.shader = new CGFshader(this.scene.gl, "obstacles/shaders/haybale.vert", "obstacles/shaders/haybale.frag");
        this.shader.setUniformsValues({ u_hay_texture: 0 });
    }

    // =====================================================
    // Geometry
    // =====================================================

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        const alphaAng = (2 * Math.PI) / this.slices;
        const stackZ = 3 / this.stacks;
        const z_end = stackZ * this.stacks; // far end of the straight wall
        const n = 4;

        // Lamé-curve (squircle) cross-section: vertex position (px, py) and the
        // unit radial direction the surface normal points along at that slice.
        // Shared by the wall and both caps so their normals line up at the seam.
        const px = [];
        const py = [];
        const nrx = [];
        const nry = [];
        for (let i = 0; i <= this.slices; i++) {
            const ang = i * alphaAng;
            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);
            const x = Math.pow(Math.abs(cosA), 2 / n) * Math.sign(cosA);
            const y = Math.pow(Math.abs(sinA), 2 / n) * Math.sign(sinA);
            px.push(x);
            py.push(-y);
            const len = Math.hypot(x, y) || 1;
            nrx.push(x / len);
            nry.push(-y / len);
        }

        const ringStride = this.slices + 1;

        // --- Side wall: the straight body, rings of the cross-section along z ---
        for (let j = 0; j <= this.stacks; j++) {
            const z = j * stackZ;
            for (let i = 0; i <= this.slices; i++) {
                this.vertices.push(px[i], py[i], z);
                this.normals.push(nrx[i], nry[i], 0);
                this.texCoords.push(i / this.slices, j / this.stacks);
            }
            if (j < this.stacks) {
                for (let i = 0; i < this.slices; i++) {
                    const current = j * ringStride + i;
                    const next = current + 1;
                    const bottom = (j + 1) * ringStride + i;
                    const bottomNext = bottom + 1;
                    this.indices.push(current, bottom, next);
                    this.indices.push(next, bottom, bottomNext);
                }
            }
        }

        // --- Rounded end cap ---------------------------------------------------
        // Sweep the cross-section from the wall edge (phi = 0, full size, flush
        // with the wall normal) to a pole (phi = 90deg), scaling the radius by
        // cos(phi) and bulging out by cap_depth*sin(phi). The normal blends from
        // the wall's radial normal to the axis, so the rim has no hard crease.
        // `dir` is +1 for the far end (bulges to +z) and -1 for the near end.
        const buildCap = (z_base, dir) => {
            const base = this.vertices.length / 3;

            for (let k = 0; k <= this.cap_stacks; k++) {
                const phi = (k / this.cap_stacks) * (Math.PI / 2);
                const c = Math.cos(phi);
                const s = Math.sin(phi);
                const z = z_base + dir * this.cap_depth * s;
                for (let i = 0; i <= this.slices; i++) {
                    this.vertices.push(px[i] * c, py[i] * c, z);
                    this.normals.push(nrx[i] * c, nry[i] * c, dir * s);
                    // Circular layout of the texture across the cap face.
                    this.texCoords.push(0.5 + px[i] * c * 0.5, 0.5 + py[i] * c * 0.5);
                }
            }

            // Stitch consecutive rings. The far cap keeps the wall's winding; the
            // near cap is mirrored in z, so its winding is flipped to stay
            // outward-facing under back-face culling.
            for (let k = 0; k < this.cap_stacks; k++) {
                for (let i = 0; i < this.slices; i++) {
                    const current = base + k * ringStride + i;
                    const next = current + 1;
                    const inner = base + (k + 1) * ringStride + i;
                    const innerNext = inner + 1;
                    if (dir > 0) {
                        this.indices.push(current, inner, next);
                        this.indices.push(next, inner, innerNext);
                    } else {
                        this.indices.push(current, next, inner);
                        this.indices.push(next, innerNext, inner);
                    }
                }
            }
        };

        buildCap(z_end, 1); // far end
        buildCap(0, -1); // near end

        this.primitiveType = this.scene.gl.TRIANGLES;

        this.initGLBuffers();
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        // Depth pass: just emit geometry into the active depth shader so the bale
        // casts into the wagon shadow map (don't swap in the lit shader).
        if (this._depth_pass) {
            super.display();
            return;
        }

        this.applyShader();
        super.display();
    }

    // Activate the bale shader and feed it the sun + shadow uniforms from the
    // scene's shadow maps, then bind the (mipmapped) hay texture to unit 0.
    applyShader() {
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

    // Build a mip chain for the hay texture so it stops shimmering at distance,
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
