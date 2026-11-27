const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
export const FLIGHT_SECONDS = 60;
export const SAVE_KEY = "spaceExploration:v1";

export const GROUPS = ["太陽系", "近くの恒星", "銀河系の星雲と中心"];
const points = { planet: 10, moon: 10, star: 20, nebula: 35, center: 50 };

function body(id, name, kind, region, position, radius, tint) {
  const scanRadius = kind === "nebula" || kind === "center" ? radius * 1.35 : radius + Math.max(7, radius * .55);
  return { id, name, kind, region, position, radius, tint, scanRadius, points: id === "earth" ? 0 : points[kind] };
}

function orbit(au, phase) {
  // Preserve the order of orbital radii while compressing the outer solar system.
  const distance = 102 * Math.sqrt(au);
  return [distance * Math.cos(phase), 0, distance * Math.sin(phase)];
}

export function skyDirection(rightAscensionHours, declinationDegrees) {
  const ra = rightAscensionHours * 15 * RAD;
  const dec = declinationDegrees * RAD;
  const tilt = 23.44 * RAD;
  const x = Math.cos(dec) * Math.cos(ra);
  const equatorialY = Math.cos(dec) * Math.sin(ra);
  const equatorialZ = Math.sin(dec);
  return [x, equatorialZ * Math.cos(tilt) - equatorialY * Math.sin(tilt),
    equatorialY * Math.cos(tilt) + equatorialZ * Math.sin(tilt)];
}

function sky(ra, dec, lightYears) {
  // Catalog directions are retained. Radial distance is compressed in light-year space.
  const radius = 610 + 185 * Math.log10(lightYears + 1) ** 1.35;
  return skyDirection(ra, dec).map(value => value * radius);
}

const earthPosition = orbit(1, .44);
const moonPosition = earthPosition.map((value, index) => value + [12, 6, -40][index]);
export const BODIES = [
  body("sun", "太陽", "star", 0, [0, 0, 0], 22, 0xffbb62),
  body("mercury", "水星", "planet", 0, orbit(.39, -.94), 4, 0xa59793),
  body("venus", "金星", "planet", 0, orbit(.72, .04), 7.5, 0xe3bc81),
  body("earth", "地球", "planet", 0, earthPosition, 10, 0x6fb5ff),
  body("moon", "月", "moon", 0, moonPosition, 3.5, 0xbfc3d0),
  body("mars", "火星", "planet", 0, orbit(1.52, -.52), 6, 0xc26a4b),
  body("jupiter", "木星", "planet", 0, orbit(5.2, -.83), 19, 0xd5ab84),
  body("saturn", "土星", "planet", 0, orbit(9.58, -1.58), 16, 0xe4c78d),
  body("uranus", "天王星", "planet", 0, orbit(19.2, -2.06), 10, 0x9cdae0),
  body("neptune", "海王星", "planet", 0, orbit(30.05, -2.65), 10, 0x4d75ef),
  body("pluto", "冥王星", "planet", 0, orbit(39.5, -2.99), 3.8, 0xc4a694),
  body("proxima", "プロキシマ・ケンタウリ", "star", 1, sky(14.495, -62.68, 4.25), 9, 0xff8065),
  body("sirius", "シリウス", "star", 1, sky(6.752, -16.72, 8.6), 15, 0xb2d8ff),
  body("vega", "ベガ", "star", 1, sky(18.616, 38.78, 25), 16, 0xd0e5ff),
  body("betelgeuse", "ベテルギウス", "star", 1, sky(5.919, 7.41, 550), 34, 0xff7854),
  body("orion", "オリオン大星雲", "nebula", 2, sky(5.588, -5.39, 1500), 68, 0xf19ae0),
  body("crab", "かに星雲", "nebula", 2, sky(5.575, 22.01, 6500), 56, 0x8fb8ff),
  body("eagle", "わし星雲", "nebula", 2, sky(18.314, -13.79, 7000), 75, 0xe0a078),
  body("galactic-core", "天の川銀河の中心", "center", 2, sky(17.761, -29.01, 26000), 100, 0xffd1a0)
];
const bodyById = new Map(BODIES.map(item => [item.id, item]));
export const HOME = { position: earthPosition.map((value, index) => value + [0, 12.5, 0][index]), yaw: .29, pitch: -.16 };
export const discoveryScore = discovered => discovered.reduce((total, id) => total + bodyById.get(id).points, 0);

export function readFlight(storage) {
  const initial = { ...HOME, discovered: ["earth"], resumed: false };
  try {
    const saved = JSON.parse(storage.getItem(SAVE_KEY));
    if (!saved || !Array.isArray(saved.position) || saved.position.length !== 3 ||
        !saved.position.every(Number.isFinite) || !Number.isFinite(saved.yaw) ||
        !Number.isFinite(saved.pitch) || !Array.isArray(saved.discovered)) return initial;
    const discovered = [...new Set(["earth", ...saved.discovered.filter(id => bodyById.has(id))])];
    return { position: saved.position, yaw: saved.yaw % TAU,
      pitch: Math.max(-1.48, Math.min(1.48, saved.pitch)), discovered, resumed: true };
  } catch {
    return initial;
  }
}

export function saveFlight(storage, position, yaw, pitch, discovered) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ position, yaw, pitch, discovered }));
    return true;
  } catch {
    return false;
  }
}

// Segment-to-center distance keeps a warp frame from skipping a discovery.
export function crossedBody(start, end, center, radius) {
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const x = center.x - start.x, y = center.y - start.y, z = center.z - start.z;
  const along = lengthSquared > 0 ? Math.max(0, Math.min(1, (x * dx + y * dy + z * dz) / lengthSquared)) : 0;
  return (x - dx * along) ** 2 + (y - dy * along) ** 2 + (z - dz * along) ** 2 <= radius ** 2;
}
