import { CGFobject, CGFappearance } from "../lib/CGF.js";
import { MyUnitCube } from "./MyUnitCube.js";
import { MyPrism } from "./MyPrism.js";
import { MyCylinder } from "./MyCylinder.js";

/**
 * MyBarn - Solid barn structure with roof and delivery drop zone
 * 
 * GEOMETRIC ARCHITECTURE:
 * 
 * BASE (MyUnitCube):
 *   - Unit cube vertices: [-0.5, +0.5] in all axes
 *   - Origin at center (0, 0, 0)
 *   - Bottom face at Y = -0.5
 *   - Positioning: Translate(0, bodyHeight/2, 0) + Scale(width, height, depth)
 *     → Bottom sits at Y = 0, top at Y = bodyHeight
 * 
 * ROOF (MyPrism with slices=3):
 *   - Triangular prism with Z-axis from 0 to 1
 *   - Triangle cross-section on XY plane, vertices on unit circle
 *   - Rotate 90° around Z-axis to align ridge with barn width
 *   - Position at Y = bodyHeight + roofHeight/2 for flush mounting
 * 
 * DROP ZONE (MyCylinder with slices=24):
 *   - Circular cylinder, Z-axis from 0 to 1, radius ~1
 *   - Has closed top/bottom caps
 *   - Rotate -90° around X-axis to lie flat on ground
 *   - Position in front of barn at Z = bodyDepth/2 + offset
 */
export class MyBarn extends CGFobject {
    constructor(scene) {
        super(scene);

        // Initialize geometric primitives
        this.base = new MyUnitCube(scene);
        this.roof = new MyPrism(scene, 3, 1);        // 3 slices = triangle
        this.dropZone = new MyCylinder(scene, 24, 1); // 24 slices = smooth circle

        // Barn dimensions (in world units)
        this.bodyWidth = 2.0;
        this.bodyDepth = 1.6;
        this.bodyHeight = 1.2;
        this.roofHeight = 0.7;

        // Materials: Flat colors only (no textures) for geometry clarity
        
        // Barn walls: warm brown wood
        this.woodMaterial = new CGFappearance(scene);
        this.woodMaterial.setAmbient(0.3, 0.2, 0.1, 1);
        this.woodMaterial.setDiffuse(0.7, 0.5, 0.3, 1);
        this.woodMaterial.setSpecular(0.08, 0.08, 0.08, 1);
        this.woodMaterial.setShininess(6.0);

        // Barn roof: darker brown
        this.roofMaterial = new CGFappearance(scene);
        this.roofMaterial.setAmbient(0.25, 0.15, 0.08, 1);
        this.roofMaterial.setDiffuse(0.5, 0.3, 0.15, 1);
        this.roofMaterial.setSpecular(0.06, 0.06, 0.06, 1);
        this.roofMaterial.setShininess(4.0);

        // Drop zone marker: bright lime green
        this.dropZoneMaterial = new CGFappearance(scene);
        this.dropZoneMaterial.setAmbient(0.2, 0.4, 0.1, 1);
        this.dropZoneMaterial.setDiffuse(0.4, 0.9, 0.2, 1);
        this.dropZoneMaterial.setSpecular(0.1, 0.2, 0.05, 1);
        this.dropZoneMaterial.setShininess(12.0);
    }

    display() {
        // === BARN BASE ===
        // MyUnitCube: vertices [-0.5, 0.5] in X, Y, Z with origin at center
        // After translate(0, bodyHeight/2, 0): bottom sits at Y=0, top at Y=bodyHeight
        // Scale applies to all axes uniformly scaling the box
        this.woodMaterial.apply();
        this.scene.pushMatrix();
        this.scene.translate(0, this.bodyHeight / 2, 0);
        this.scene.scale(this.bodyWidth, this.bodyHeight, this.bodyDepth);
        this.base.display();
        this.scene.popMatrix();

        // === BARN ROOF ===
        // MyPrism (3 slices): triangular prism with ridge parallel to Z-axis
        // After rotate(90°, Z): ridge parallel to X-axis (barn width direction)
        // Position at Y = bodyHeight + roofHeight/2 ensures flush contact with top wall
        this.roofMaterial.apply();
        this.scene.pushMatrix();
        this.scene.translate(0, this.bodyHeight + this.roofHeight / 2, 0);
        this.scene.rotate(Math.PI / 2, 0, 0, 1);  // Align ridge with barn width
        this.scene.scale(this.bodyWidth, this.roofHeight, this.bodyDepth);
        this.roof.display();
        this.scene.popMatrix();

        // === DROP ZONE ===
        // MyCylinder (24 slices): cylinder Z from 0→1, radius ~1
        // After rotate(-90°, X): cylinder axis becomes vertical, lies flat on ground
        // Scale: X,Z = radius (0.6), Y = thin disk (0.02)
        this.dropZoneMaterial.apply();
        this.scene.pushMatrix();
        this.scene.translate(0, 0.01, this.bodyDepth / 2 + 0.5);
        this.scene.rotate(-Math.PI / 2, 1, 0, 0);
        this.scene.scale(0.6, 0.02, 0.6);
        this.dropZone.display();
        this.scene.popMatrix();
    }
}
