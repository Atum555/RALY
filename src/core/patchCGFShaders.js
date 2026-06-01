import { CGFshader } from "../lib/CGF.js";

// =====================================================
// WebCGF shader-switch stall removal
// =====================================================
//
// CGF carries a shader's uniform values over to the next one whenever you
// switch the active shader. setActiveShader(sh) calls sh.importUniforms(old),
// which calls old.getUniformsValues() -- and that reads EVERY uniform of the
// outgoing shader back from the GPU with gl.getUniform(). gl.getUniform is a
// synchronous read: it flushes the command queue and blocks the CPU until the
// GPU has caught up (a full pipeline stall). The shadow shader has many
// uniforms, so each material.apply() / setActiveShader costs dozens of stalls,
// and the per-frame total dominates the frame -- ~90% of it, dropping the
// scene to ~20 FPS.
//
// The carried-over values are exactly the ones we last *wrote* via
// setUniformsValues, so there is no need to read them back from the GPU at all.
// This patch keeps the carry-over behaviour but sources it from a JS-side cache
// we update on every setUniformsValues, eliminating the readback entirely.
//
// Behaviourally identical to stock CGF, minus the stalls:
//   - getUniformsValues() returns our cache instead of reading the GPU.
//   - Uniforms never set keep their GPU default on both shaders, so omitting
//     them from the carry-over changes nothing.
//   - Array/struct values are snapshotted on write, so later in-place mutation
//     of a reused matrix buffer can't desync the cache from the GPU.

// Snapshot a uniform value so a later in-place mutation of a reused buffer
// (e.g. the scene's single mvMatrix Float32Array) can't change what we cached.
function cloneUniformValue(value) {
    if (value == null || typeof value !== "object") return value; // number / bool
    if (ArrayBuffer.isView(value) || Array.isArray(value)) return value.slice();
    const out = {}; // nested struct uniform
    for (const key in value) out[key] = cloneUniformValue(value[key]);
    return out;
}

// Merge an incoming setUniformsValues dict into the running cache, snapshotting
// leaves. Only keys actually present in the dict are touched (matching CGF,
// which only sets uniforms the caller provides).
function mergeIntoCache(cache, dict) {
    for (const key in dict) {
        const incoming = dict[key];
        if (
            incoming != null &&
            typeof incoming === "object" &&
            !ArrayBuffer.isView(incoming) &&
            !Array.isArray(incoming)
        ) {
            const nested = cache[key] && typeof cache[key] === "object" ? cache[key] : {};
            mergeIntoCache(nested, incoming);
            cache[key] = nested;
        } else {
            cache[key] = cloneUniformValue(incoming);
        }
    }
}

let patched = false;

export function patchCGFShaders() {
    if (patched) return;
    patched = true;

    const proto = CGFshader.prototype;
    const originalSet = proto.setUniformsValues;

    // Record every write into a per-shader cache, then set as usual.
    proto.setUniformsValues = function (udict) {
        if (!this._uniformCache) this._uniformCache = {};
        mergeIntoCache(this._uniformCache, udict);
        return originalSet.call(this, udict);
    };

    // The expensive call: return the cache instead of reading the GPU back.
    // importUniforms() consumes this and feeds it straight to setUniformsValues
    // on the incoming shader, so the carry-over still happens -- stall-free.
    proto.getUniformsValues = function () {
        return this._uniformCache || {};
    };
}
