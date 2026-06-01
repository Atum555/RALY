export const fract = (x) => x - Math.floor(x);

export const mix = (a, b, t) => a * (1 - t) + b * t;

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const hash = (n) => fract(Math.sin(n) * 10000.0);

export const noise = (p) => {
    const step = [110, 241, 171];
    const i = [Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])];
    const f = [fract(p[0]), fract(p[1]), fract(p[2])];

    const n = dot(i, step);
    const u = f.map((v) => v * v * (3.0 - 2.0 * v));

    return mix(
        mix(
            mix(
                hash(n + dot(step, [0, 0, 0])),
                hash(n + dot(step, [1, 0, 0])),
                u[0],
            ),
            mix(
                hash(n + dot(step, [0, 1, 0])),
                hash(n + dot(step, [1, 1, 0])),
                u[0],
            ),
            u[1],
        ),
        mix(
            mix(
                hash(n + dot(step, [0, 0, 1])),
                hash(n + dot(step, [1, 0, 1])),
                u[0],
            ),
            mix(
                hash(n + dot(step, [0, 1, 1])),
                hash(n + dot(step, [1, 1, 1])),
                u[0],
            ),
            u[1],
        ),
        u[2],
    );
};

export const fbm = (p, octaves = 5) => {
    let total = 0.0;
    let amplitude = 0.1;
    let persistence = 0.3;
    let maxVal = 1.0;
    let tempP = [...p];

    for (let i = 0; i < octaves; i++) {
        total += noise(tempP) * amplitude;
        amplitude *= persistence;
        maxVal += amplitude;
        tempP = [tempP[0] * 2.0, tempP[1] * 2.0, tempP[2] * 2.0];
    }
    return total / maxVal;
};
