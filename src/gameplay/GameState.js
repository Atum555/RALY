/**
 * GameState - Pure game logic (not a CGFobject): tracks HP, score and bales, and
 * resolves the interaction types in the world XZ plane — bale pickup and barn
 * delivery by centre distance, rock damage by an oriented bounding box wrapped
 * around the wagon chassis and its horse team.
 *
 * Ported from the original logic sprint (MyGameState) onto the current scene: the
 * wagon now exposes position_x / position_z (not x / z), and the proximity radii
 * are scaled up from the old 50-unit playfield to this much larger world.
 */
export class GameState {
    constructor() {
        this.max_hp = 200;
        this.hp = this.max_hp;
        this.score = 0; // total seconds survived
        this.bales_carried = 0; // max 2 at any time
        this.total_bales_delivered = 0;
        this.last_damage = 0; // HP lost in the last rock collision
        this.last_heal = 0; // HP gained in the last barn delivery
        this.game_over = false;
        this.barn_delivery_cooldown = 0; // prevents delivery firing every frame
        this.barn_hit_cooldown = 0; // prevents barn-collision damage every frame

        // World-scale interaction radii (1 unit = 1 m; the playfield spans
        // hundreds of units, so these are larger than the original metre values).
        this.pickup_radius = 24; // how close to a bale the wagon must be to grab it
        this.max_bales = 2;

        // Slack added to obstacle collision boxes (world units), so a hit
        // registers on contact rather than only once meshes visibly overlap.
        this.box_margin = 0.5;

        // Base HP impact for a damaging obstacle hit at full speed, scaled down by
        // speed (and, for rocks, by size) in the per-obstacle handlers. Hay bales
        // are soft and deal no damage (they only deflect), so they have no entry.
        this.rock_damage = 25;
        this.barn_damage = 30;
    }

    update(delta) {
        // Passive HP drain: 1 HP per second survived.
        this.hp -= 1 * delta;
        this.score += delta;

        if (this.barn_delivery_cooldown > 0) {
            this.barn_delivery_cooldown -= delta;
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.game_over = true;
        }
    }

    // Pick up nearby bales on demand (max 2 carried); called from the P key.
    checkBalePickup(wagon, bales) {
        for (const bale of bales) {
            if (bale.collected) continue;
            const dist = Math.hypot(wagon.position_x - bale.x, wagon.position_z - bale.z);
            if (dist < this.pickup_radius && this.bales_carried < this.max_bales) {
                bale.collected = true;
                this.bales_carried++;
            }
        }
    }

    // Deliver carried bales inside the barn zone for HP; returns true on a drop
    // (so the caller can flash the drop-zone marker).
    checkBarnDelivery(wagon, barn_x, barn_z, radius) {
        const dist = Math.hypot(wagon.position_x - barn_x, wagon.position_z - barn_z);
        if (dist < radius && this.bales_carried > 0 && this.barn_delivery_cooldown <= 0) {
            this.last_heal = this.bales_carried * 75;
            this.hp = Math.min(this.max_hp, this.hp + this.last_heal);
            this.total_bales_delivered += this.bales_carried;
            this.bales_carried = 0;
            this.barn_delivery_cooldown = 3.0; // 3-second cooldown
            return true;
        }
        return false;
    }

    // Build an oriented bounding box in the XZ plane from a world centre, a yaw
    // and the half-extents along the box-local right (x) and forward (z) axes.
    // The local axes follow the scene's yaw convention (see Wagon.followTerrain
    // and the rotate(yaw, 0,1,0) used to place obstacles): local +x maps to world
    // (cos, -sin), local +z to world (sin, cos). A margin pads every box so a hit
    // registers on contact rather than only once meshes visibly overlap.
    makeBox(cx, cz, yaw, half_x, half_z) {
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        return {
            cx,
            cz,
            ux: c,
            uz: -s, // unit "right" axis (local +x) in world space
            vx: s,
            vz: c, // unit "forward" axis (local +z) in world space
            hx: half_x + this.box_margin,
            hz: half_z + this.box_margin,
        };
    }

    // Separating Axis Theorem overlap test for two oriented boxes in the XZ
    // plane: they overlap unless some box axis separates them. For each of the
    // four axes (both right/forward axes of both boxes) project the centre offset
    // and each box's extent; a gap on any axis means no collision.
    boxesOverlap(a, b) {
        const dx = b.cx - a.cx;
        const dz = b.cz - a.cz;
        const separated = (lx, lz) => {
            const dist = Math.abs(dx * lx + dz * lz);
            const ra = a.hx * Math.abs(a.ux * lx + a.uz * lz) + a.hz * Math.abs(a.vx * lx + a.vz * lz);
            const rb = b.hx * Math.abs(b.ux * lx + b.uz * lz) + b.hz * Math.abs(b.vx * lx + b.vz * lz);
            return dist > ra + rb;
        };
        return !(separated(a.ux, a.uz) || separated(a.vx, a.vz) || separated(b.ux, b.uz) || separated(b.vx, b.vz));
    }

    // The wagon's two collision boxes in world space: the chassis (aligned to the
    // heading, spanning the wheelbase and track) and the horse team (aligned to
    // heading + steering, at the team's stance centre). Obstacles are tested
    // against both, so a hit on either the wagon or the horses counts.
    playerBoxes(wagon) {
        const wagon_center_lz = (wagon.axle_front_z + wagon.axle_rear_z) / 2;
        const sin_h = Math.sin(wagon.heading);
        const cos_h = Math.cos(wagon.heading);
        const chassis = this.makeBox(
            wagon.position_x + wagon_center_lz * sin_h,
            wagon.position_z + wagon_center_lz * cos_h,
            wagon.heading,
            wagon.track_half,
            (wagon.axle_front_z - wagon.axle_rear_z) / 2,
        );
        const horses = this.makeBox(
            wagon.horse_center_x,
            wagon.horse_center_z,
            wagon.heading + wagon.steering_angle,
            wagon.horse_track_half,
            wagon.horse_half_length,
        );
        return [chassis, horses];
    }

    // Does an obstacle box overlap either of the wagon's boxes?
    hitsPlayer(player_boxes, obstacle_box) {
        return this.boxesOverlap(player_boxes[0], obstacle_box) || this.boxesOverlap(player_boxes[1], obstacle_box);
    }

    // Apply HP damage on rock contact, scaled by how fast the wagon is going and
    // how big the rock is, with a per-rock cooldown so a single rock can't drain
    // HP every frame while the wagon sits against it. A hard nudge into a boulder
    // hurts; brushing a pebble at a crawl barely registers. Each rock is an
    // oriented box (its silhouette is roughly round, so the box is square and the
    // yaw barely matters) tested against the wagon and horse boxes.
    checkRockCollisions(wagon, rocks, delta) {
        const boxes = this.playerBoxes(wagon);
        for (const rock of rocks) {
            const half = rock.scale || 1; // base radius 1, scaled per placement
            const rock_box = this.makeBox(rock.x, rock.z, rock.rot_y || 0, half, half);
            if (this.hitsPlayer(boxes, rock_box) && rock.damageCooldown <= 0) {
                // Speed factor: ~0 when stopped, ~1 at normal top speed, up to ~2
                // when boosting. Size factor: rock scale (~1.6 pebble..5 boulder)
                // normalised so a big rock roughly doubles a small one's hit.
                const speed_factor = Math.abs(wagon.speed) / wagon.base_max_speed;
                const size_factor = (rock.scale || 1) / 5;
                // Scaled by both, with a small floor so even a gentle tap stings.
                this.last_damage = Math.max(2, Math.round(this.rock_damage * speed_factor * size_factor));
                this.hp = Math.max(0, this.hp - this.last_damage);
                rock.damageCooldown = 2.0;
                // Stop and turn the wagon away from the rock it struck.
                wagon.avoidObstacle(rock.x, rock.z);
            }
        }

        // Decrement all active damage cooldowns.
        for (const rock of rocks) {
            if (rock.damageCooldown > 0) rock.damageCooldown -= delta;
        }
    }

    // Solid hay bales: an uncollected bale blocks and deflects the wagon but does
    // no damage (hay is soft) — a hit just stops the wagon and turns it away.
    // Each bale is an oriented box with its long axis along the placement yaw;
    // collected bales are skipped, since the field hides them. `half_x/half_z` are
    // the bale half-extents in world units (the cross-section across local x, the
    // length along local z), passed in from the scene so they track the field's
    // bale size and scale.
    checkBaleCollisions(wagon, bales, half_x, half_z, delta) {
        const boxes = this.playerBoxes(wagon);
        for (const bale of bales) {
            if (bale.collected) {
                bale.damageCooldown = 0;
                continue;
            }
            const bale_box = this.makeBox(bale.x, bale.z, bale.yaw || 0, half_x, half_z);
            if (this.hitsPlayer(boxes, bale_box) && (bale.damageCooldown || 0) <= 0) {
                // Soft: deflect only, no HP loss. The cooldown keeps a hit from
                // re-firing every frame and locking the wagon into a spin while
                // it is still overlapping the bale.
                bale.damageCooldown = 2.0;
                wagon.avoidObstacle(bale.x, bale.z);
            }
        }

        for (const bale of bales) {
            if (bale.damageCooldown > 0) bale.damageCooldown -= delta;
        }
    }

    // Solid barn collision: the wagon can't drive through the barn. The barn is
    // an axis-aligned box (yaw 0) tested against the wagon and horse boxes, so the
    // chassis or the team brushing a wall registers — not just the wagon's centre
    // crossing in. The footprint stays the building's own extents, so the delivery
    // zone in front of the door (outside the box) is still reachable. On contact
    // the wagon takes speed-scaled damage and is knocked back, on its own cooldown
    // so it doesn't drain HP every frame while pressed against the wall.
    // `barn_x/z` is the barn centre and `half_x/half_z` its footprint half-extents.
    checkBarnCollision(wagon, barn_x, barn_z, half_x, half_z, delta) {
        if (this.barn_hit_cooldown > 0) this.barn_hit_cooldown -= delta;
        if (this.barn_hit_cooldown > 0) return;

        const barn_box = this.makeBox(barn_x, barn_z, 0, half_x, half_z);
        if (this.hitsPlayer(this.playerBoxes(wagon), barn_box)) {
            const speed_factor = Math.abs(wagon.speed) / wagon.base_max_speed;
            // Wall impact scaled by speed, with a small floor.
            this.last_damage = Math.max(2, Math.round(this.barn_damage * speed_factor));
            this.hp = Math.max(0, this.hp - this.last_damage);
            this.barn_hit_cooldown = 1.0;
            wagon.avoidObstacle(barn_x, barn_z);
        }
    }
}
