// Dependency-free value noise with fractal Brownian motion (fBm).
//
// This is the single source of truth for terrain height: the mesh samples it
// at each grid vertex (visuals) and collision samples it at arbitrary points
// (physics). Both therefore agree on where the ground is.
export class ValueNoise {
    constructor(seed = 1337) {
        this.seed = seed | 0;
    }

    // Hash an integer lattice point to a deterministic value in [0, 1].
    hash(ix, iy) {
        let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(this.seed, 362437);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h = (h ^ (h >>> 16)) >>> 0;
        return h / 4294967295;
    }

    // Value noise at (x, y): smooth-interpolated lattice hashes. Returns [0, 1].
    noise(x, y) {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const xf = x - x0;
        const yf = y - y0;
        // Smoothstep so the gradient is continuous across cell boundaries.
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);

        const n00 = this.hash(x0, y0);
        const n10 = this.hash(x0 + 1, y0);
        const n01 = this.hash(x0, y0 + 1);
        const n11 = this.hash(x0 + 1, y0 + 1);

        const nx0 = n00 + (n10 - n00) * u;
        const nx1 = n01 + (n11 - n01) * u;
        return nx0 + (nx1 - nx0) * v;
    }

    // Sum several octaves of noise for natural-looking detail. Returns [0, 1].
    // gain is the per-octave amplitude falloff: lower = higher octaves fade out
    // faster, so the large-scale shape dominates and fine detail stays subtle.
    fbm(x, y, octaves = 4, lacunarity = 2.0, gain = 0.4) {
        let sum = 0;
        let amp = 1;
        let freq = 1;
        let norm = 0;
        for (let o = 0; o < octaves; o++) {
            sum += amp * this.noise(x * freq, y * freq);
            norm += amp;
            amp *= gain;
            freq *= lacunarity;
        }
        return sum / norm;
    }
}
