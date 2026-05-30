// Mark a dat.GUI controller as display-only: disable pointer events and dim it
// so a value bound via listen() reads as an output rather than an editable control.
export function readonly(controller) {
    controller.domElement.style.pointerEvents = "none";
    controller.domElement.style.opacity = "0.6";
    return controller;
}

export function hexToRGB(hex, alpha = true) {
    const match = hex.match(/^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/);
    if (!match) throw new Error(`Invalid hex color: ${hex}`);
    const h =
        match[1].length <= 4
            ? match[1]
                  .split("")
                  .map(c => c + c)
                  .join("")
            : match[1];
    const rgb = [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
    ];
    if (!alpha) return rgb;
    return [...rgb, h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1.0];
}

// Interpolate angle a -> b by t, taking the shortest way around.
export function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * t;
}
