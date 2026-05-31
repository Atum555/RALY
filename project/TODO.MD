# CGRA 2025/2026 - Final Project Implementation Guide & Planner

This document serves as your structured master checklist and implementation planning template for the Computer Graphics final project (Spring Prairie Landscape Game).

---

# PART I: PROJECT REQUIREMENTS

## 1. Environment (Sky, Sun, Clouds)

- [x] Create a huge half-sphere geometry with faces turned inward and inverted normals [cite: 44].
- [x] Apply a panoramic landscape/environment texture to the sky sphere [cite: 44].
- [x] Implement a Sun using a Directional Light or Spotlight [cite: 45].
- [x] **Advanced/Bonus:** Implement procedural clouds or an animated cloud layer (as a second texture) near the sky-sphere [cite: 46].

## 2. Terrain & Ground Surface

- [x] Implement an elevated terrain with subtle rolling hills using height maps [cite: 48].
- [x] Apply a soil ground texture featuring visible dirt patches [cite: 50].
- [x] Model and overlay a defined pathway for the wagon to travel along [cite: 51].
- [x] **Advanced/Bonus:** Generate the terrain procedurally [cite: 48].

## 3. Scatter Elements, Flora & Grass

- [ ] **Scatter Elements:** Place rocks with multiple textures and apply vertex perturbation for geometric variety [cite: 53].
- [ ] **Flora:** Create parameter-based flowers with natural randomness (varying textures, colors, scales, and placement) [cite: 55].
- [ ] **Grass:** Distribute dense grass patches and dead/dry grass patches across the landscape to achieve a natural prairie look [cite: 58, 59, 61].
- [ ] **Advanced/Bonus:** - [ ] Procedural generation of items/scatter elements [cite: 53].
    - [ ] Procedural generation of several components of flora items/flowers [cite: 56].
    - [ ] Custom GLSL shader to simulate "wind" moving over the grass patches [cite: 60].

## 4. Covered Wagon (Prairie Schooner)

- [x] Build a hierarchical model of a geometrically simplified wagon from scratch using WebCGF primitives [cite: 66, 67, 68].
- [x] **Mandatory Structural Components:**
    - [x] A cloth cover that occupies exactly half the wagon length to leave the captured hay bales visible inside [cite: 68].
    - [x] A wooden wagon bed [cite: 68].
    - [x] A front tongue/shaft mechanism to attach horses/mules [cite: 68].
    - [x] 4 individual wheels [cite: 68].
- [x] Import horse/mule assets in `.obj` format using the provided extra WebCGF class [cite: 69].
- [ ] **Advanced/Bonus:** Create a highly detailed wagon with complex geometries and premium textures [cite: 70].

## 5. Movement, Interaction & Animations

- [x] **Steering Mechanics:** Implement smooth keyboard control of the front steering wheel axis and the connected front tongue [cite: 73, 98]. They must rotate together on a central pivot point (in the center of the axis) as the wagon turns left or right [cite: 98].
- [ ] **Locomotion Controls (Forward Only):**
    - [x] `W` : Accelerate forward up to horse walk speed [cite: 74, 75].
    - [x] `S` : Reduce speed [cite: 74, 78].
    - [x] `A` : Steer front wheels left [cite: 74, 76].
    - [x] `D` : Steer front wheels right [cite: 74, 77].
    - [ ] `P` : Pick up a hay bale [cite: 74, 79].
    - [ ] `L` : Drop a hay bale [cite: 74, 80].
- [x] **Wheel Animation:** Animate all 4 wheels of the wagon to rotate realistically relative to the wagon's forward movement [cite: 97].
- [ ] **Pinpointing Arrow:** Model a vertical arrow hovering above hay bales that performs a time-dependent vertical floating animation [cite: 30, 98].
- [x] **Advanced/Bonus:** Implement wagon acceleration using physics/kinematics and advanced detailed horse movement [cite: 81, 99].

## 6. Gameplay, Collectible System & UI

- [ ] **Survival Mechanics:** Keep the driver "alive" as long as possible [cite: 21]. Total score is the cumulative seconds of a single gameplay session [cite: 22].
- [ ] **Health Point (HP) Economy:**
    - [ ] Wagon starts with an initial set number of HPs (e.g., 100 HP) [cite: 23, 36].
    - [ ] HP automatically decreases over time (e.g., 1 HP/second) [cite: 24, 36].
    - [ ] Hitting obstacles (rocks) inflicts damage, reducing HP by a random amount between 5 and 15 HPs [cite: 31, 40].
    - [ ] Game over occurs instantly if HP reaches zero [cite: 34].
- [ ] **Hay Bale System:**
    - [ ] Bales spawn randomly across the prairie [cite: 25].
    - [ ] Bales are only visible when the wagon is near them (pinpointed over the prairie via the animated arrow) [cite: 30].
    - [ ] Driving near a bale captures it and places it inside the wagon [cite: 27]. The wagon can hold a maximum of 2 hay bales at any given time [cite: 29].
- [ ] **The Barn & Delivery Zone:**
    - [ ] Model a simple barn using a Cube (wood plank texture) and a roof made of half a prism (dark wood texture) [cite: 83, 84]. Apply textures for windows and doors [cite: 85].
    - [ ] Create a delimited circular area in front of the barn [cite: 28, 86].
    - [ ] When the wagon intersects this circular area, change the boundary color of the area and unload the bales, adding their health value (e.g., 50 HP per bale) to the wagon's health [cite: 28, 39].
- [ ] **DAT.gui Interface:** Use numeric bars to display:
    - [ ] Current health points (HP) [cite: 92, 93].
    - [ ] Instantaneous damage due to collisions [cite: 92, 94].
    - [ ] Instantaneous health restored at delivery [cite: 92, 94].
    - [ ] Total number of bales successfully dropped in the circular area [cite: 92, 94].
    - [ ] Score (survival time in seconds) [cite: 92, 94].

## 7. Project Management, Git & Delivery Artifacts

- [ ] **Git Milestones & Schedule (Suggested):**
    - [ ] `environment` (Week 8): Sky, sun, clouds (Requires 2 screenshots) [cite: 105, 109].
    - [ ] `terrain` (Week 9): Terrain, ground, scatter elements (Requires 2 screenshots) [cite: 105, 109].
    - [ ] `flora` (Week 10): Flowers and grass (Requires 2 screenshots) [cite: 105, 109].
    - [ ] `interaction` (Week 11): Wagon interaction and wheel animations (Requires 2 screenshots) [cite: 105, 109].
    - [ ] `gameplay` (Week 11): Collectible system and DAT.gui (Requires 2 screenshots) [cite: 105, 109].
    - [ ] `final` (Week 12): README, video, final screenshots [cite: 105, 109].
- [ ] **Moodle Deliverables (Deadline: Friday, 29th May):**
    - [ ] **Project ZIP (`project-t<class>g<group>-N.zip`):** Source code, WebCGF library, and updated `README.md` [cite: 136, 137, 138].
    - [ ] **5 PNG Screenshots (Full HD 1920x1080, named `project-t<class>g<group>-N.png`):**
        - [ ] Screenshot 1: Overall scene overview (wide angle) [cite: 140, 142].
        - [ ] Screenshot 2: Flower, rocks, and floor detail [cite: 140, 143].
        - [ ] Screenshot 3: Wagon close-up (showing model detail/textures) [cite: 140, 144].
        - [ ] Screenshot 4: Animated shader example (Animated GIF format) [cite: 140, 145].
    - [ ] **Demonstration Video (`project-t<class>g<group>.mp4`):** Exactly 1 minute (H.264 codec), capturing a scene tour, wagon movement/steering controls, hay bale pickup/delivery mechanics, and custom shaders [cite: 147, 148, 149, 150].
- [ ] **Root `README.md` File Contents:**
    - [ ] Project title, class section, group members (Names + Student IDs) [cite: 127].
    - [ ] Description of scene and completed features (including chosen bonuses) [cite: 127, 130].
    - [ ] Setup and execution instructions (dependencies, launching guide) [cite: 128].
    - [ ] Keyboard controls reference table [cite: 129].
    - [ ] Known bugs/limitations and an AI use declaration [cite: 130, 134].

---

# PART II: OUR IDEAS

## 1. Environment (Sky, Sun, Clouds)

- **Texture/Skybox Choice:** _ **Lighting Configuration (Color, Direction, Intensity):** _ **Advanced Features Implementation Strategy:** ## 2. Terrain & Ground Surface
- **Heightmap Source / Generation Method:** _ **Ground and Pathway Texture Assets:** _ **Advanced Features Implementation Strategy:** ## 3. Scatter Elements, Flora & Grass
- **Rock Geometries & Randomization Parameters:** _ **Flower Variety & Distribution Logic:** _ **Grass Rendering Method & Wind Shader Design:** ## 4. Covered Wagon (Prairie Schooner)
- **Hierarchical Model Structure & Scene Graph Plan:** _ **Texture Mapping (Wood, Cloth, Wheels):** _ **Advanced Details Planning:** ## 5. Movement, Interaction & Animations
- **Velocity, Turning, and Translation Math:** _ **Wheel Rotation Calculation (Relationship to Distance Covered):** _ **Arrow Floating Function (e.g., Sine Wave Expression):** ## 6. Gameplay, Collectible System & UI
- **Collision Detection Tolerances (Center-to-Center Distances):** _ **Spawn Logic for Random Hay Bales:** _ **UI Layout & State Management:** ## 7. Project Management, Git & Delivery Artifacts
- **Group Member Task Allocation:** _ **Internal Milestones & Code Integration Dates:** _ **Video Recording & Presentation Plan:**
