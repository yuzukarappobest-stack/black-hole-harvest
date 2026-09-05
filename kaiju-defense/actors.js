import * as T from "./vendor/three.module.js";
import { block } from "./world.js";

export function soldier(scene) {
  const root = new T.Group(), body = new T.Group(); root.add(body); scene.add(root);
  const suit = new T.MeshStandardMaterial({ color: 0x476c77, roughness: .7 }), armor = new T.MeshStandardMaterial({ color: 0xc0d3cc, roughness: .5 });
  const dark = new T.MeshStandardMaterial({ color: 0x203744 }), visor = new T.MeshStandardMaterial({ color: 0xffc573, emissive: 0xb37924, emissiveIntensity: .5 });
  block(body, suit, 0, 1.1, 0, .62, .8, .4); block(body, armor, 0, 1.25, -.23, .54, .42, .12);
  block(body, dark, 0, 1.16, .3, .43, .55, .25);
  const head = new T.Mesh(new T.SphereGeometry(.28, 10, 8), armor); head.position.y = 1.8; body.add(head);
  block(body, visor, 0, 1.8, -.245, .39, .12, .1);
  const legs = [];
  for (const x of [-.21, .21]) {
    const pivot = new T.Group(); pivot.position.set(x, .83, 0); body.add(pivot);
    block(pivot, suit, 0, -.35, 0, .23, .7, .27); block(pivot, dark, 0, -.7, -.08, .25, .18, .4); legs.push(pivot);
    block(body, armor, x * 2, 1.22, -.19, .2, .55, .27);
  }
  block(body, dark, .43, 1.22, -.62, .17, .2, .9);
  const muzzle = new T.Object3D(); muzzle.position.set(.43, 1.22, -1.1); body.add(muzzle);
  return { root, body, legs, muzzle };
}

export function monster(scene) {
  const root = new T.Group(); scene.add(root);
  const skin = new T.MeshStandardMaterial({ color: 0x386c5d, roughness: .95, flatShading: true });
  const belly = new T.MeshStandardMaterial({ color: 0x819a72, roughness: .9, flatShading: true });
  const plates = new T.MeshStandardMaterial({ color: 0xe6a261, emissive: 0x803a12, emissiveIntensity: .25, flatShading: true });
  const eye = new T.MeshBasicMaterial({ color: 0xffde61 });
  const teeth = new T.MeshStandardMaterial({ color: 0xffe6bb });
  const geo = new T.IcosahedronGeometry(1, 1);
  function lump(parent, material, position, scale) { const mesh = new T.Mesh(geo, material); mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; parent.add(mesh); mesh.userData.monster = true; return mesh; }
  const torso = lump(root, skin, [0, 8.2, 0], [3.5, 5.1, 2.6]);
  lump(root, belly, [0, 7.6, -1.95], [2.2, 3.3, .8]);
  lump(root, skin, [0, 12.8, -.6], [2.1, 2.5, 2]);
  const head = new T.Group(); head.position.set(0, 14.2, -1.2); root.add(head);
  lump(head, skin, [0, 0, -.7], [2.1, 1.5, 2.2]);
  lump(head, new T.MeshBasicMaterial({ color: 0x17292a }), [0, -.55, -2.05], [1.5, .28, .9]);
  lump(head, skin, [0, -.85, -1.1], [1.8, .45, 1.9]);
  for (const x of [-1, 1]) {
    const horn = new T.Mesh(new T.ConeGeometry(.45, 1.7, 5), plates); horn.position.set(x * 1.4, 1.3, -.1); horn.rotation.z = -x * .4; head.add(horn);
    lump(head, eye, [x * 1.65, .36, -1.75], [.26, .19, .2]);
    for (let i = 0; i < 4; i++) {
      const tooth = new T.Mesh(new T.ConeGeometry(.16, .6, 5), teeth); tooth.position.set(x * (1.4 - i * .2), -.55, -2.6 + i * .35); tooth.rotation.z = Math.PI; head.add(tooth);
    }
  }
  const limbs = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(side * 2.05, 4.6, .2); root.add(leg);
    lump(leg, skin, [0, -1.7, 0], [1.5, 2.8, 1.6]); lump(leg, skin, [0, -3.8, -.75], [1.65, .8, 2.2]); limbs.push(leg);
    for (let i = 0; i < 3; i++) lump(leg, teeth, [i * .58 - .6, -3.9, -2.3], [.25, .25, .8]);
    const arm = new T.Group(); arm.position.set(side * 3, 10.8, -.4); root.add(arm);
    lump(arm, skin, [side * .6, -1.6, -.5], [1, 2.3, 1]); lump(arm, skin, [side * .8, -3, -1.4], [1.1, .85, 1.2]); limbs.push(arm);
  }
  for (let i = 0; i < 8; i++) {
    const spine = new T.Mesh(new T.ConeGeometry(.85, 2.7, 4), plates); spine.position.set(0, 4 + i * 1.35, 2.4 - Math.max(0, i - 4) * .5); spine.rotation.x = .8; spine.userData.monster = true; root.add(spine);
  }
  for (let i = 0; i < 7; i++) lump(root, skin, [Math.sin(i * .4) * 1.6, 3 - i * .32, 2.4 + i * 1.3], [1.5 - i * .17, 1.4 - i * .15, 1.8]);
  const mouth = new T.Object3D(); mouth.position.set(0, -.5, -3); head.add(mouth);
  return { root, torso, head, limbs, mouth };
}
