import { CONFIG } from "./config.js?v=5";

function traveledDistance(z) {
  return Math.max(0, Math.min(CONFIG.courseLength, CONFIG.courseStartZ - z));
}

export function courseCenterX(z) {
  let remaining = traveledDistance(z); let center = 0;
  for (const segment of CONFIG.courseSegments) {
    const length = Math.min(remaining, segment.length);
    center += length * segment.curve;
    remaining -= length;
    if (remaining <= 0) break;
  }
  return center;
}

export function courseTangent(z) {
  let remaining = traveledDistance(z);
  for (const segment of CONFIG.courseSegments) {
    if (remaining <= segment.length) {
      const length = Math.hypot(segment.curve, 1);
      return { x: segment.curve / length, z: -1 / length };
    }
    remaining -= segment.length;
  }
  return { x: 0, z: -1 };
}

export function courseYaw(z) {
  const tangent = courseTangent(z);
  return Math.atan2(tangent.x, tangent.z);
}

export function courseOffsetPoint(z, offset) {
  const tangent = courseTangent(z);
  return { x: courseCenterX(z) - tangent.z * offset, z: z + tangent.x * offset };
}
