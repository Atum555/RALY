/**
 * GameState - Pure game logic (not a CGFobject): tracks HP, score and bales, and
 * resolves the three interaction types via 2D distance between centres in the
 * world XZ plane — bale pickup, barn delivery and rock damage.
 *
 * Ported from the original logic sprint (MyGameState) onto the current scene: the
 * wagon now exposes position_x / position_z (not x / z), and the proximity radii
 * are scaled up from the old 50-unit playfield to this much larger world.
 */
export class GameState {
    constructor() {
        this.max_hp = 1000;
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
        this.pickup_radius = 14; // how close to a bale the wagon must be to grab it
        this.rock_hit_radius = 9; // contact radius around a hazard rock
        this.max_bales = 2;
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
            this.last_heal = this.bales_carried * 200;
            this.hp = Math.min(this.max_hp, this.hp + this.last_heal);
            this.total_bales_delivered += this.bales_carried;
            this.bales_carried = 0;
            this.barn_delivery_cooldown = 3.0; // 3-second cooldown
            return true;
        }
        return false;
    }

    // Apply HP damage on rock contact, scaled by how fast the wagon is going and
    // how big the rock is, with a per-rock cooldown so a single rock can't drain
    // HP every frame while the wagon sits against it. A hard nudge into a boulder
    // hurts; brushing a pebble at a crawl barely registers.
    checkRockCollisions(wagon, rocks, delta) {
        for (const rock of rocks) {
            const dist = Math.hypot(wagon.position_x - rock.x, wagon.position_z - rock.z);
            if (dist < this.rock_hit_radius && rock.damageCooldown <= 0) {
                // Speed factor: ~0 when stopped, ~1 at normal top speed, up to ~2
                // when boosting. Size factor: rock scale (~1.6 pebble..5 boulder)
                // normalised so a big rock roughly doubles a small one's hit.
                const speed_factor = Math.abs(wagon.speed) / wagon.base_max_speed;
                const size_factor = (rock.scale || 1) / 5;
                // Base 25 HP impact, scaled by both, with a small floor so even a
                // gentle tap stings.
                this.last_damage = Math.max(2, Math.round(25 * speed_factor * size_factor));
                this.hp = Math.max(0, this.hp - this.last_damage);
                rock.damageCooldown = 2.0;
                // Bounce the wagon back off the rock it struck.
                wagon.applyKnockback(rock.x, rock.z);
            }
        }

        // Decrement all active damage cooldowns.
        for (const rock of rocks) {
            if (rock.damageCooldown > 0) rock.damageCooldown -= delta;
        }
    }

    // Solid barn collision: the wagon can't drive through the barn. The barn's
    // footprint is a rectangle (it's a square building), so this is an AABB test
    // rather than a circle — a circle around the centre would reach out past the
    // door and block the delivery approach. On contact the wagon takes
    // speed-scaled damage and is knocked back, on its own cooldown so it doesn't
    // drain HP every frame while pressed against the wall. `barn_x/z` is the barn
    // centre and `half_x/half_z` its footprint half-extents (all world units).
    checkBarnCollision(wagon, barn_x, barn_z, half_x, half_z, delta) {
        if (this.barn_hit_cooldown > 0) this.barn_hit_cooldown -= delta;

        const dx = wagon.position_x - barn_x;
        const dz = wagon.position_z - barn_z;
        if (Math.abs(dx) < half_x && Math.abs(dz) < half_z && this.barn_hit_cooldown <= 0) {
            const speed_factor = Math.abs(wagon.speed) / wagon.base_max_speed;
            // Base 30 HP wall impact, scaled by speed, with a small floor.
            this.last_damage = Math.max(2, Math.round(30 * speed_factor));
            this.hp = Math.max(0, this.hp - this.last_damage);
            this.barn_hit_cooldown = 1.0;
            wagon.applyKnockback(barn_x, barn_z);
        }
    }
}
