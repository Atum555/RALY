import { CGFapplication } from "../lib/CGF.js";
import { Scene } from "./Scene.js";
import { UI } from "./UI.js";

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
