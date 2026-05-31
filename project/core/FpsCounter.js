// A tiny on-screen FPS readout. It lives in its own DOM overlay above the WebGL
// canvas (the canvas can't draw HUD text itself), so it stays independent of the
// scene graph. tick() is called once per rendered frame: it averages the frame
// intervals over a short window and refreshes the label a few times a second so
// the number is readable rather than flickering every frame.
export class FpsCounter {
    constructor() {
        this.el = document.createElement("div");
        Object.assign(this.el.style, {
            position: "fixed",
            top: "8px",
            left: "8px",
            zIndex: "1000",
            padding: "2px 8px",
            font: "13px/1.4 monospace",
            color: "#0f0",
            background: "rgba(0, 0, 0, 0.5)",
            borderRadius: "4px",
            pointerEvents: "none", // never intercept clicks/drags meant for the canvas
            userSelect: "none",
        });
        this.el.textContent = "-- FPS";
        document.body.appendChild(this.el);

        this.frames = 0; // frames since the last label refresh
        this.elapsed = 0; // ms accumulated since the last label refresh
        this.REFRESH_MS = 500; // how often the displayed number updates
    }

    // dt is the last frame's duration in milliseconds.
    tick(dt) {
        this.frames++;
        this.elapsed += dt;
        if (this.elapsed >= this.REFRESH_MS) {
            const fps = (this.frames * 1000) / this.elapsed;
            this.el.textContent = `${fps.toFixed(0)} FPS`;
            this.frames = 0;
            this.elapsed = 0;
        }
    }
}
