// Tiny helper for angular physics with tooth damping
export class SpinPhysics{
  constructor(){ this.angle=0; this.vel=0; this.acc=0; }
  step(dt){ // dt seconds
    this.vel += this.acc * dt;
    // base damping
    this.vel *= 0.995;
    this.angle = (this.angle + this.vel * dt) % (Math.PI*2);
    this.acc = 0;
  }
  addImpulse(v){ this.vel += v; }
  addFriction(k){ this.vel *= (1-k); }
}
