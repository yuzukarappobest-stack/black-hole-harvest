import * as C from './vendor/cannon-es.js';
import { CONFIG } from './config.js';

export class BattlePhysics {
  constructor() {
    this.world = new C.World({ gravity: new C.Vec3(0, 0, 0) });
    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = .82;
    this.world.solver.iterations = 10;
    this.bodies = [];
    this.cooldown = 0;
  }
  reset(types, onHit) {
    for (const b of this.bodies) this.world.removeBody(b);
    this.cooldown = 0; this.world.time = 0; this.world.accumulator = 0;
    this.bodies = types.map((type, i) => {
      const body = new C.Body({ mass: type.mass, shape: new C.Sphere(.82), linearDamping: .35, fixedRotation: true });
      body.linearFactor.set(1, 0, 1); body.angularFactor.set(0, 0, 0); body.position.set(i ? 1 : -1, 0, i ? -3.9 : 3.9); this.world.addBody(body); return body;
    });
    this.bodies[0].addEventListener('collide', event => {
      if (event.body !== this.bodies[1] || this.cooldown > 0) return;
      const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
      if (speed < .8) return;
      this.cooldown = .5; onHit(speed);
    });
  }
  accelerate(index, x, z, speed, dt, dash = false) {
    const b = this.bodies[index];
    const gain = dash ? 4 : 1.45;
    b.velocity.x += (x * speed - b.velocity.x) * Math.min(1, dt * gain);
    b.velocity.z += (z * speed - b.velocity.z) * Math.min(1, dt * gain);
    // A gentle inward slope lets idle tops orbit, but cannot cancel a strong hit.
    b.velocity.x -= b.position.x * dt * .18; b.velocity.z -= b.position.z * dt * .18;
  }
  impulse(index, x, z, strength) { this.bodies[index].applyImpulse(new C.Vec3(x * strength, 0, z * strength)); }
  step(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    // The sloped rim returns slow tops. A fast impact can still carry one over it.
    for (const body of this.bodies) {
      const r = Math.hypot(body.position.x, body.position.z);
      if (r > 5.8 && r <= CONFIG.radius) {
        const inward = (r - 5.8) ** 2 * 35 * dt;
        body.velocity.x -= body.position.x / r * inward;
        body.velocity.z -= body.position.z / r * inward;
      }
    }
    this.world.step(1 / 120, dt, 8);
  }
  outside(index) { const p = this.bodies[index].position; return Math.hypot(p.x, p.z) > CONFIG.radius; }
}
