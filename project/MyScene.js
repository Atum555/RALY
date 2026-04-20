import {
    CGFscene,
    CGFcamera,
    CGFaxis,
    CGFappearance,
    CGFtexture,
} from "../lib/CGF.js";
import { MyDiamond } from "./MyDiamond.js";
import { MyQuad } from "./MyQuad.js";
import { SkySphere } from "./SkySphere.js";

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
        this.sphere = new SkySphere(this);
        this.quad = new MyQuad(this);
        this.objects = [this.diamond, this.sphere, this.quad];

        // Labels and ID's for object selection on MyInterface
        this.objectIDs = {
            Diamond: 0,
            Sphere: 1,
            Quad: 2,
        };
        //Other variables connected to MyInterface
        this.selectedObject = 2;
        // Objects connected to MyInterface
        this.scaleFactor = 1;
        this.displayAxis = true;
        this.displayNormals = false;

        this.quadMaterial = new CGFappearance(this);
        this.quadMaterial.setAmbient(0.1, 0.1, 0.1, 1);
        this.quadMaterial.setDiffuse(0.9, 0.9, 0.9, 1);
        this.quadMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.quadMaterial.setShininess(10.0);
        this.quadMaterial.loadTexture("textures/texture.jpg");
        this.quadMaterial.setTextureWrap("REPEAT", "REPEAT");
    }

    initLights() {
        this.lights[0].setPosition(15, 2, 5, 1);
        this.lights[0].setDiffuse(1.0, 1.0, 1.0, 1.0);
        this.lights[0].enable();
        this.lights[0].update();
    }

    initCameras() {
        this.camera = new CGFcamera(
            0.4,
            0.1,
            500,
            vec3.fromValues(0, 0, 15),
            vec3.fromValues(0, 0, 0),
        );
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

        this.quadMaterial.apply();
        this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_MAG_FILTER,
            this.gl.NEAREST,
        );
        // ---- BEGIN Primitive drawing section

        this.pushMatrix();
        this.translate(0,-10,0);
        this.rotate(-Math.PI / 2, 1, 0, 0);
        this.sphere.display();
        this.popMatrix();
        
        // used for displaying objects in testing
        this.objects[this.selectedObject].display();


        if (this.displayNormals)
            this.objects[this.selectedObject].enableNormalViz();
        else this.objects[this.selectedObject].disableNormalViz();

        // ---- END Primitive drawing section
    }
}
