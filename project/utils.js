export function hexToRGB(hex) {
    const match = hex.match(/^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/);
    if (!match) throw new Error(`Invalid hex color: ${hex}`);
    const h =
        match[1].length <= 4
            ? match[1]
                  .split("")
                  .map(c => c + c)
                  .join("")
            : match[1];
    return [
        parseInt(h.substring(0, 2), 16) / 255,
        parseInt(h.substring(2, 4), 16) / 255,
        parseInt(h.substring(4, 6), 16) / 255,
        h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1.0,
    ];
}
