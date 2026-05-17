import { CGFscene, CGFcamera, CGFaxis } from "../lib/CGF.js";
import { MyDiamond } from "./MyDiamond.js";
import { MyAnimatedObject } from "./MyAnimatedObject.js";

/**
 * MyScene
 * @constructor
 */
export class MyScene extends CGFscene {
  constructor() {
    super();
  }

  checkKeys() {
    var text="Keys pressed: ";
    var keysPressed=false;

    // Check for key codes e.g. in https://keycode.info/
    if (this.gui.isKeyPressed("KeyW")) {
      text+=" W ";
      keysPressed=true;
    }

    if (this.gui.isKeyPressed("KeyS")) {
      text+=" S ";
      keysPressed=true;
    }

    if (keysPressed)
      console.log(text);
  }

  init(application) {
    //#region init
    super.init(application);
    
    this.initCameras();
    this.initLights();

    //Background color
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

    this.gl.clearDepth(100.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.depthFunc(this.gl.LEQUAL);

    //Initialize scene objects
    this.axis = new CGFaxis(this);
    this.diamond = new MyDiamond(this);

    //Objects connected to MyInterface
    this.displayAxis = true;
    //#endregion

    // animation
    this.setUpdatePeriod(50); // **at least** 50 ms between animations

    this.appStartTime=Date.now(); // current time in milisecs


    this.animVal1=0;
    this.animVal2=0;
    this.animVal3=0;

    //#region Pars for anim 3
    this.startVal=0;
    this.endVal=6;
    this.animStartTimeSecs=2;
    this.animDurationSecs=3;
    this.length=(this.endVal-this.startVal);
    //#endregion
  
    //#region Ex. 4
    this.numAnimObjs=4;

    this.animObjs=[
      new MyAnimatedObject(this,0,5,1,3),
      new MyAnimatedObject(this,0,2,2,3),
      new MyAnimatedObject(this,0,1,3,2),
      new MyAnimatedObject(this,-5,5,4,3)
    ];
    //#endregion
  }

  update(t)
  {
      // Update without considering time - BAD
      this.animVal1+=0.1;

      //#region Ex.2 
      // Continuous animation based on current time and app start time 
      var timeSinceAppStart=(t-this.appStartTime)/1000.0;
      
      this.animVal2=-2+2*Math.sin(timeSinceAppStart*Math.PI*3);

      //#region Ex. 3
      // Animation based on elapsed time since animation start

      var elapsedTimeSecs=timeSinceAppStart-this.animStartTimeSecs;

      if (elapsedTimeSecs>=0 && elapsedTimeSecs<=this.animDurationSecs)
        this.animVal3=this.startVal+elapsedTimeSecs/this.animDurationSecs*this.length;

      //#region Ex. 4 
      // delegate animations to objects
      for (var i=0;i<this.numAnimObjs;i++)
        this.animObjs[i].update(timeSinceAppStart);
      //#endregion
      //#endregion
      //#endregion

      this.checkKeys();
    }

  //#region Other code
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
      vec3.fromValues(15, 15, 15),
      vec3.fromValues(0, 0, 0)
    );
  }
  setDefaultAppearance() {
    this.setAmbient(0.2, 0.4, 0.8, 1.0);
    this.setDiffuse(0.2, 0.4, 0.8, 1.0);
    this.setSpecular(0.2, 0.4, 0.8, 1.0);
    this.setShininess(10.0);
  }
  //#endregion
  display() {
    //#region camera and other stuff
    // ---- BEGIN Background, camera and axis setup
    // Clear image and depth buffer everytime we update the scene
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    // Initialize Model-View matrix as identity (no transformation
    this.updateProjectionMatrix();
    this.loadIdentity();
    // Apply transformations corresponding to the camera position relative to the origin
    this.applyViewMatrix();

    // Draw axis
    if (this.displayAxis) 
    this.axis.display();

    this.setDefaultAppearance();
    //#endregion

    // animation
    this.pushMatrix();
    this.translate(this.animVal3,0,0);

    // ---- BEGIN Primitive drawing section
    this.diamond.display();

    this.popMatrix();

    for (var i=0;i<this.numAnimObjs;i++)
    {
      this.translate(0,1,0);
      this.animObjs[i].display();
    }

    // ---- END Primitive drawing section
  }
}
