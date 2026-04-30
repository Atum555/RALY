import { CGFscene, CGFcamera, CGFaxis } from "../lib/CGF.js";
import { MyDiamond } from "./MyDiamond.js";
import { ObstacleScene } from "./obstacles/ObstacleScene.js";

export class MyScene extends CGFscene {
    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        this.initCameras();
        this.initLights();

        // Background color
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);

        this.gl.clearDepth(100.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.enableTextures(true);

        // Initialize scene objects
        this.axis = new CGFaxis(this);
        this.diamond = new MyDiamond(this);
        this.obstacleScene = new ObstacleScene(this);
        this.objects = [
            this.diamond,
            this.obstacleScene
        ];

        // Labels and ID's for object selection on MyInterface
        this.objectIDs = {
            Diamond: 0,
            ObstacleScene: 1,
        };
        //Other variables connected to MyInterface
        this.selectedObject = 1;
        // Objects connected to MyInterface
        this.scaleFactor = 1;
        this.displayAxis = true;
        this.displayNormals = false;
    }

    initLights() {
        this.lights[0].setPosition(15, 2, 5, 1);
        this.lights[0].setDiffuse(1.0, 1.0, 1.0, 1.0);
        this.lights[0].enable();
        this.lights[0].update();
    }

    initCameras() {
        this.camera = new CGFcamera(0.4, 0.1, 500, vec3.fromValues(15, 15, 15), vec3.fromValues(0, 0, 0));
    }

    setDefaultAppearance() {
        this.setAmbient(0.2, 0.4, 0.8, 1.0);
        this.setDiffuse(0.2, 0.4, 0.8, 1.0);
        this.setSpecular(0.2, 0.4, 0.8, 1.0);
        this.setShininess(10.0);
    }

    display() {
        // ---- BEGIN Background, camera and axis setup
        // Clear image and depth buffer every time we update the scene
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        // Initialize Model-View matrix as identity (no transformation)
        this.updateProjectionMatrix();
        this.loadIdentity();
        // Apply transformations corresponding to the camera position relative to the origin
        this.applyViewMatrix();

        // Draw axis
        if (this.displayAxis) this.axis.display();

        this.setDefaultAppearance();

        var sca = [
            this.scaleFactor,
            0.0,
            0.0,
            0.0,
            0.0,
            this.scaleFactor,
            0.0,
            0.0,
            0.0,
            0.0,
            this.scaleFactor,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
        ];

        this.multMatrix(sca);

        // ---- BEGIN Primitive drawing section
        if (this.displayNormals)
            this.objects[this.selectedObject].enableNormalViz();
        else this.objects[this.selectedObject].disableNormalViz();

        this.objects[this.selectedObject].display();

        // ---- END Primitive drawing section
    }
}
