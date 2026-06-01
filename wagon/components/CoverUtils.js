export function buildArchProfile(halfWidth, slices, offset = 0) {
    const alpha = (11 * Math.PI) / 24;
    const boardLength = 4;
    const cosAlpha = Math.cos(alpha);
    const sinAlpha = Math.sin(alpha);

    const topX = halfWidth + boardLength * cosAlpha;
    const topY = boardLength * sinAlpha;
    const radius = topX;

    let hw = halfWidth;
    let baseY = 0;

    if (offset !== 0) {
        hw = halfWidth + offset * cosAlpha;
        baseY = offset * sinAlpha;
    }

    let path = [];

    // Left straight section
    let nx = -sinAlpha;
    let ny = cosAlpha;
    path.push({ x: -hw, y: baseY, nx: nx, ny: ny });
    path.push({ x: -topX, y: topY, nx: nx, ny: ny });

    // Curved arch
    for (let i = 1; i < slices; i++) {
        let angle = Math.PI - (i * Math.PI) / slices;
        let cx = radius * Math.cos(angle);
        let cy = radius * Math.sin(angle) + topY;
        nx = Math.cos(angle);
        ny = Math.sin(angle);
        path.push({ x: cx, y: cy, nx: nx, ny: ny });
    }

    // Right straight section
    nx = sinAlpha;
    ny = cosAlpha;
    path.push({ x: topX, y: topY, nx: nx, ny: ny });
    path.push({ x: hw, y: baseY, nx: nx, ny: ny });

    return path;
}

export function getBeamZPositions(numBeams, totalLength) {
    let positions = [];
    for (let i = 0; i < numBeams; i++) {
        positions.push(-(totalLength / 2) + i * (totalLength / (numBeams - 1)));
    }
    return positions;
}
