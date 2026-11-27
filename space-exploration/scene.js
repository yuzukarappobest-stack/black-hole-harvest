import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { BODIES, skyDirection } from "./universe.js?v=1";

const TAU = Math.PI * 2;
const Z = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function softLight() {
  return canvasTexture(64, 64, (ctx, width) => {
    const half = width / 2;
    const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
    glow.addColorStop(0, "#fff");
    glow.addColorStop(.23, "#ffffffdc");
    glow.addColorStop(.55, "#ffffff46");
    glow.addColorStop(1, "#ffffff00");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, width);
  });
}

function planetTexture(item) {
  const seed = [...item.id].reduce((value, char) => value * 31 + char.charCodeAt(0), 17);
  const random = randomSource(seed);
  const banded = ["jupiter", "saturn", "neptune", "uranus", "venus"].includes(item.id);
  const frequencies = Array.from({ length: 6 }, () => random() * TAU);
  return canvasTexture(384, 192, (ctx, width, height) => {
    const pixels = ctx.createImageData(width, height);
    const base = [item.tint >> 16, item.tint >> 8 & 255, item.tint & 255];
    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width * TAU;
        const grain = Math.sin(u * 13 + v * 9 + frequencies[0]) * Math.cos(v * 41 + frequencies[1]) * .32 +
          Math.sin(u * 5 - v * 13 + frequencies[2]) * Math.cos(v * 19 + frequencies[3]) * .7 +
          Math.cos(u * 3 + v * 18 + frequencies[4]) * .53 + Math.sin(u * 31 - v * 72 + frequencies[5]) * .12;
        let rgb = base;
        if (item.id === "earth") {
          const land = Math.sin(u * 2 + v * 10) + Math.cos(u * 3 - v * 13) * .61 + grain * .9;
          if (Math.abs(v - .5) > .44 + grain * .023) rgb = [225, 238, 247];
          else if (land > .57) rgb = v < .32 || v > .68 ? [71, 129, 90] : [137, 143, 77];
          else rgb = [24, 90, 171];
          if (Math.sin(u * 6 + v * 58 + grain * 2) * .65 + grain * .54 > .69) rgb = rgb.map(value => (value + 255) / 2);
        }
        const stripes = banded ? Math.sin(v * 89 + grain * .29) * .13 + Math.sin(v * 35 + grain * .36) * .11 : 0;
        const oval = Math.sin(u - 2);
        const storm = item.id === "jupiter" && (oval / .32) ** 2 + ((v - .62) / .042) ** 2 < 1;
        if (storm && Math.cos(u - 2) > 0) rgb = [177, 89, 51];
        const amplitude = item.kind === "star" ? .12 : .2;
        const light = 1 + stripes + grain * amplitude + (random() - .5) * .1;
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = rgb[channel] * light;
        pixels.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
  });
}

function sprite(map, color, width, height, opacity) {
  const object = new THREE.Sprite(new THREE.SpriteMaterial({
    map, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  object.scale.set(width, height, 1);
  return object;
}

function nebula(item, glow) {
  const group = new THREE.Group();
  const random = randomSource(item.tint);
  const halo = sprite(glow, item.tint, item.radius * 3.7, item.radius * 2.4, .24);
  group.add(halo);
  for (let index = 0; index < 28; index++) {
    const phase = random() * TAU;
    const spread = random() * item.radius;
    const width = item.radius * (.24 + random() * .85);
    const color = index % 4 === 0 ? 0xa9bbff : item.tint;
    const cloud = sprite(glow, color, width, width * (.4 + random() * .65), .12 + random() * .3);
    cloud.position.set(Math.cos(phase) * spread, Math.sin(phase) * spread * .72, (random() - .5) * item.radius);
    group.add(cloud);
  }
  return group;
}

function saturnRings(radius) {
  const group = new THREE.Group();
  const spans = [[1.28, 1.43, 0x9f846c], [1.45, 1.68, 0xe6c797],
    [1.70, 1.94, 0xb39c7d], [2.02, 2.17, 0xe1ceb0], [2.17, 2.29, 0xb39774]];
  for (const [inner, outer, color] of spans) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner * radius, outer * radius, 80),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .76 }));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
  }
  group.rotation.z = -.26;
  return group;
}

function addBody(scene, item, glow) {
  let object;
  if (item.kind === "nebula" || item.kind === "center") {
    object = nebula(item, glow);
    if (item.kind === "center") {
      object.add(sprite(glow, 0xffd7b1, item.radius * 3, item.radius * 1.15, .62));
      object.add(sprite(glow, 0xffeeee, item.radius * .65, item.radius * .5, .85));
    }
  } else {
    object = new THREE.Group();
    const map = planetTexture(item);
    const material = item.kind === "star"
      ? new THREE.MeshBasicMaterial({ map })
      : new THREE.MeshLambertMaterial({ map });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(item.radius, 40, 24), material);
    object.add(globe);
    if (item.kind === "star") object.add(sprite(glow, item.tint, item.radius * 5, item.radius * 5, .68));
    if (item.id === "saturn") object.add(saturnRings(item.radius));
    if (item.id === "earth") {
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(item.radius * 1.035, 40, 24),
        new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          vertexShader: `varying vec3 n; varying vec3 face;
            void main() { vec4 p = modelViewMatrix * vec4(position, 1.0);
              n = normalize(normalMatrix * normal); face = normalize(-p.xyz);
              gl_Position = projectionMatrix * p; }`,
          fragmentShader: `varying vec3 n; varying vec3 face;
            void main() { float rim = pow(1.0 - max(0.0, dot(normalize(n), normalize(face))), 3.2);
              gl_FragColor = vec4(.22, .62, 1.0, rim * .7); }`
        }));
      object.add(atmosphere);
    }
    object.userData.globe = globe;
  }
  object.position.fromArray(item.position);
  scene.add(object);
  return object;
}

function pointsCloud(positions, colors, glow, size, opacity, sizeAttenuation) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    vertexColors: true, map: glow, size, opacity, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation
  }));
}

function starfield(glow) {
  const random = randomSource(16023);
  const sky = new THREE.Group();
  for (const [count, size, opacity] of [[2100, 2.1, .85], [240, 4, 1]]) {
    const positions = [], colors = [];
    for (let index = 0; index < count; index++) {
      const y = random() * 2 - 1;
      const phase = random() * TAU;
      const radial = Math.sqrt(1 - y * y);
      positions.push(7300 * radial * Math.cos(phase), 7300 * y, 7300 * radial * Math.sin(phase));
      colors.push(.58 + random() * .42, .65 + random() * .35, .83 + random() * .17);
    }
    sky.add(pointsCloud(positions, colors, glow, size, opacity, false));
  }
  return sky;
}

function galacticDisk(glow) {
  const center = new THREE.Vector3().fromArray(BODIES.find(body => body.id === "galactic-core").position);
  const normal = new THREE.Vector3().fromArray(skyDirection(12.857, 27.13));
  const radial = center.clone().normalize();
  const tangent = normal.clone().cross(radial).normalize();
  const random = randomSource(21085);
  const positions = [], colors = [];
  const particle = new THREE.Vector3();
  for (let index = 0; index < 4600; index++) {
    const span = .08 + random() * .92;
    const radius = span * 3850;
    const phase = (index % 4) * TAU / 4 + span * 5 + (random() - .5) * (1.25 - .65 * span);
    const height = (random() - .5) * (90 + 550 * (1 - span) ** 5);
    particle.copy(center).addScaledVector(radial, Math.cos(phase) * radius)
      .addScaledVector(tangent, Math.sin(phase) * radius).addScaledVector(normal, height);
    positions.push(...particle);
    colors.push(.93 - span * .36, .71 - span * .09, .65 + span * .32);
  }
  return pointsCloud(positions, colors, glow, 11, .37, true);
}

function rocket(glow) {
  const root = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe5edf7, metalness: .26, roughness: .35 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd44d5b, metalness: .2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x143454, metalness: .4, roughness: .3 });
  const cockpit = new THREE.MeshStandardMaterial({ color: 0x55caf8, emissive: 0x11508c, metalness: .46, roughness: .23 });
  function piece(geometry, material, axisPosition) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = axisPosition;
    root.add(mesh);
    return mesh;
  }
  piece(new THREE.CylinderGeometry(.33, .41, 1.17, 18), white, -.02);
  piece(new THREE.ConeGeometry(.34, .82, 18), red, .95);
  piece(new THREE.CylinderGeometry(.37, .31, .21, 16), dark, -.71);
  const window = piece(new THREE.SphereGeometry(.19, 14, 10), cockpit, .28);
  window.position.z = .291;
  window.scale.z = .32;
  for (let i = 0; i < 3; i++) {
    const frame = new THREE.Group();
    frame.rotation.y = i * TAU / 3;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(.36, .72, 3), red);
    fin.position.set(.45, -.42, 0);
    fin.scale.set(1.38, 1.22, .42);
    fin.rotation.z = .3;
    frame.add(fin);
    root.add(frame);
  }
  const flame = piece(new THREE.ConeGeometry(.21, 1.25, 13),
    new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: .84 }), -1.33);
  flame.rotation.z = Math.PI;
  const plume = sprite(glow, 0x397ffa, 1.7, 2.45, .85);
  plume.position.y = -1.26;
  root.add(plume);
  root.rotation.x = -Math.PI / 2;
  const ship = new THREE.Group();
  ship.add(root);
  ship.userData = { flame, plume };
  return ship;
}

export function createScene(viewport) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x060a17);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.domElement.setAttribute("aria-hidden", "true");
  viewport.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, .07, 15000);
  const glow = softLight();
  const stars = starfield(glow);
  scene.add(stars, galacticDisk(glow), new THREE.AmbientLight(0xa1b1e3, .82));
  const light = new THREE.PointLight(0xffebd9, 2.45, 0, 0);
  scene.add(light);
  const shipLight = new THREE.DirectionalLight(0xcbe4ff, 1.8);
  shipLight.position.set(-2, 5, 3);
  const ship = rocket(glow);
  const shipRig = new THREE.Group();
  shipRig.add(ship, shipLight);
  shipLight.target = ship;
  scene.add(shipRig);
  const planets = BODIES.map(item => addBody(scene, item, glow));
  const chase = new THREE.Vector3();
  const look = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const resize = () => {
    const { clientWidth: width, clientHeight: height } = viewport;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  window.addEventListener("resize", resize);
  resize();

  return {
    camera,
    canvas: renderer.domElement,
    render(position, forward, bank, warp, running, seconds, preview) {
      shipRig.position.copy(position);
      shipRig.quaternion.setFromUnitVectors(Z, forward);
      camera.up.copy(UP);
      right.crossVectors(forward, UP).normalize();
      up.crossVectors(right, forward).normalize();
      ship.rotation.z = bank;
      const { flame, plume } = ship.userData;
      flame.visible = plume.visible = running;
      flame.scale.y = (warp ? 1.9 : 1) * (1 + Math.sin(seconds * 32) * .12);
      plume.material.opacity = warp ? .95 : .65;

      chase.copy(position).addScaledVector(forward, -5.8).addScaledVector(up, 2);
      look.copy(position).addScaledVector(forward, 29).addScaledVector(up, 1.25);
      if (preview) {
        chase.addScaledVector(right, 8).addScaledVector(up, 2.6).addScaledVector(forward, -7);
        look.copy(position).addScaledVector(forward, 12).addScaledVector(up, -1);
      }
      camera.position.copy(chase);
      camera.lookAt(look);
      const fov = (camera.aspect < .8 ? 68 : 59) + (warp && running ? 10 : 0);
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      stars.position.copy(camera.position);
      for (const planet of planets) {
        if (planet.userData.globe) planet.userData.globe.rotation.y = seconds * .12;
      }
      renderer.render(scene, camera);
    }
  };
}
