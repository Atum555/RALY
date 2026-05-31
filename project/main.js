import { CGFapplication } from "../lib/CGF.js";
import { Scene } from "./Scene.js";
import { UI } from "./UI.js";

(function () {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attributes) {
        if (
            type === "webgl" ||
            type === "webgl2" ||
            type === "experimental-webgl"
        ) {
            attributes = attributes || {};
            attributes.powerPreference = "high-performance";
            attributes.failIfMajorPerformanceCaveat = false;
        }
        return originalGetContext.call(this, type, attributes);
    };
})();

function main() {
    const app = new CGFapplication(document.body);
    const scene = new Scene();
    const ui = new UI();

    app.init();
    app.setScene(scene);
    app.setInterface(ui);
    ui.setActiveCamera(scene.camera);

    app.run();
}

main();
