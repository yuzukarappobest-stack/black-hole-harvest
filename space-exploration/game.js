import { BODIES, FLIGHT_SECONDS, GROUPS, HOME, crossedBody, discoveryScore, readFlight, saveFlight } from "./universe.js?v=2";
import { createTiltControls } from "./tilt.js?v=1";

const ACCESS_KEY = "miniGameAccess:space-exploration";
const learningPath = sessionStorage.getItem("miniGameReturnUrl") || "learn.html";
const learningUrl = new URL("../" + learningPath, location.href);

if (sessionStorage.getItem(ACCESS_KEY) !== "1") {
  location.replace(learningUrl);
} else {
  sessionStorage.removeItem(ACCESS_KEY);
  window.addEventListener("pageshow", event => {
    if (event.persisted) location.replace(learningUrl);
  });
  initialize().catch(() => {
    document.getElementById("introText").textContent = "3Dの画面を開けませんでした。学習メニューから戻れるよ。";
  });
}

async function initialize() {
  const { createScene } = await import("./scene.js?v=2");
  const ui = Object.fromEntries([...document.querySelectorAll("[id]")].map(node => [node.id, node]));
  ui.intro.querySelector("a").href = learningUrl;
  const view = createScene(ui.viewport);
  let storage;
  try { storage = window.localStorage; } catch { /* Flight can still run if storage is disabled. */ }
  const saved = readFlight(storage);
  const position = view.camera.position.clone().fromArray(saved.position);
  const previous = position.clone();
  const forward = position.clone();
  const right = position.clone();
  const up = position.clone().set(0, 1, 0);
  const direction = position.clone();
  const projected = position.clone();
  const bodies = BODIES.map(item => ({ ...item, center: position.clone().fromArray(item.position) }));
  const earth = bodies.find(body => body.id === "earth");
  const core = bodies.find(body => body.id === "galactic-core");
  const discovered = new Set(saved.discovered);
  const keys = new Set();
  const steeringKeys = new Map([["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]],
    ["ArrowUp", [0, 1]], ["ArrowDown", [0, -1]], ["a", [-1, 0]], ["d", [1, 0]], ["w", [0, 1]], ["s", [0, -1]]]);
  const clamp = (value, maximum = 1) => Math.max(-maximum, Math.min(maximum, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  let { yaw, pitch } = saved;
  let state = "ready";
  let drag = null, target = null, warp = false;
  let speed = 0, bank = 0, launchTime = 0, deadline = 0, lastFrame = 0;
  let lastSave = 0, noticeEnd = 0, points = discoveryScore(saved.discovered), initialPoints = points;
  let initialCount = discovered.size;
  let timeShown, regionShown, beaconShown;

  if (saved.resumed) {
    ui.introText.textContent = "前のフライトのつづきから、星を見つけよう。";
    ui.launch.textContent = "つづきから発進";
  }
  const tiltButtons = [ui.introTilt, ui.flightTilt];
  const tilt = createTiltControls((mode, message) => {
    for (const button of tiltButtons) {
      button.setAttribute("aria-pressed", String(mode === "on" || mode === "waiting"));
      button.disabled = mode === "requesting";
    }
    if (state === "ready") {
      ui.tiltStatus.textContent = message;
    } else if (state === "flying" && message) {
      showNotice(message, performance.now());
    }
  });
  for (const button of tiltButtons) button.addEventListener("click", tilt.toggle);
  ui.score.textContent = points;
  updateTime(FLIGHT_SECONDS);
  ui.launch.disabled = false;

  function record() {
    return saveFlight(storage, position.toArray(), yaw, pitch, [...discovered]);
  }

  function toggleWarp(active = !warp) {
    warp = active;
    ui.warp.setAttribute("aria-pressed", String(active));
  }

  function setMap(open) {
    ui.map.hidden = !open;
    ui.mapButton.setAttribute("aria-expanded", String(open));
    if (!open) return;
    for (const button of ui.destinations.querySelectorAll("button")) {
      const body = bodies.find(item => item.id === button.dataset.id);
      button.querySelector(".found").textContent = discovered.has(body.id) ? "✓" : "◇";
      button.querySelector("small").textContent = body.id === target?.id ? "航行中" : discovered.has(body.id) ? "発見済み" : "未発見";
    }
    ui.closeMap.focus({ preventScroll: true });
  }

  for (const [index, groupName] of GROUPS.entries()) {
    const header = document.createElement("h3");
    header.textContent = groupName;
    ui.destinations.append(header);
    for (const body of bodies.filter(item => item.region === index)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "destination";
      button.dataset.id = body.id;
      const icon = document.createElement("span");
      icon.className = "found";
      icon.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.textContent = body.name;
      const status = document.createElement("small");
      button.append(icon, name, status);
      ui.destinations.append(button);
      button.addEventListener("click", () => {
        target = body;
        setMap(false);
        ui.mapButton.focus({ preventScroll: true });
        showNotice(body.name + "へ 自動操縦", performance.now());
      });
    }
  }

  function resetEarth() {
    position.fromArray(HOME.position);
    ({ yaw, pitch } = HOME);
    target = null;
    speed = 0;
    tilt.recenter();
    toggleWarp(false);
    setMap(false);
    showNotice("地球に戻ったよ", performance.now());
    record();
  }

  function clearDrag() {
    if (!drag) return;
    const oldDrag = drag;
    drag = null;
    if (oldDrag.node.hasPointerCapture(oldDrag.id)) oldDrag.node.releasePointerCapture(oldDrag.id);
    ui.stick.firstElementChild.style.transform = "";
  }

  function attachSteering(node) {
    node.addEventListener("pointerdown", event => {
      if (state !== "flying" || drag || event.button !== 0) return;
      const area = node.getBoundingClientRect();
      drag = { node, id: event.pointerId,
        originX: node === ui.stick ? area.left + area.width / 2 : event.clientX,
        originY: node === ui.stick ? area.top + area.height / 2 : event.clientY, x: 0, y: 0 };
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener("pointermove", event => {
      if (drag?.id !== event.pointerId) return;
      const range = node === ui.stick ? 32 : 66;
      drag.x = clamp((event.clientX - drag.originX) / range);
      drag.y = clamp((drag.originY - event.clientY) / range);
      ui.stick.firstElementChild.style.transform = `translate(${drag.x * 17}px, ${-drag.y * 17}px)`;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      node.addEventListener(type, event => {
        if (drag?.id === event.pointerId) clearDrag();
      });
    }
  }

  attachSteering(view.canvas);
  attachSteering(ui.stick);
  window.addEventListener("keydown", event => {
    if (state !== "flying") return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "Escape" && !ui.map.hidden) {
      setMap(false);
      ui.mapButton.focus({ preventScroll: true });
    }
    if (!ui.map.hidden || event.ctrlKey || event.metaKey || event.altKey) return;
    if (steeringKeys.has(key)) {
      event.preventDefault();
      keys.add(key);
    } else if (key === " " && !event.target.closest?.("button, a")) {
      event.preventDefault();
      if (!event.repeat) toggleWarp();
    }
  });
  window.addEventListener("keyup", event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  window.addEventListener("blur", () => {
    keys.clear();
    clearDrag();
  });

  function showNotice(message, now) {
    ui.discovery.textContent = message;
    ui.discovery.hidden = false;
    noticeEnd = now + 2700;
  }

  function updateTime(seconds) {
    ui.timeBar.style.transform = `scaleX(${seconds / FLIGHT_SECONDS})`;
    const rounded = Math.ceil(seconds);
    if (timeShown === rounded) return;
    timeShown = rounded;
    ui.clock.textContent = `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
  }

  function updateHeading(delta) {
    let x = drag?.x || 0, y = drag?.y || 0;
    for (const key of keys) {
      const [horizontal, vertical] = steeringKeys.get(key);
      x += horizontal;
      y += vertical;
    }
    const steering = Math.abs(x) + Math.abs(y) > .06;
    if (steering && target) {
      target = null;
      showNotice("手動操縦", performance.now());
    }
    const sensor = tilt.read(delta);
    if (state === "flying" && !target && !drag && keys.size === 0 && ui.map.hidden) {
      x = sensor.x;
      y = sensor.y;
    }
    if (target) {
      direction.copy(target.center).sub(position).normalize();
      const desiredYaw = Math.atan2(direction.x, -direction.z);
      const turn = Math.atan2(Math.sin(desiredYaw - yaw), Math.cos(desiredYaw - yaw));
      const desiredPitch = Math.asin(clamp(direction.y));
      x = clamp(turn * 2.2);
      yaw += clamp(turn, delta * 2.6);
      pitch += clamp(desiredPitch - pitch, delta * 2.1);
    } else {
      yaw += clamp(x) * delta * 1.56;
      pitch += clamp(y) * delta * 1.25;
    }
    pitch = clamp(pitch, 1.48);
    bank = mix(bank, clamp(x) * -.47, Math.min(1, delta * 7));
    forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  function updatePosition(delta, now) {
    previous.copy(position);
    let nearestClearance = Infinity;
    for (const body of bodies) {
      nearestClearance = Math.min(nearestClearance, position.distanceTo(body.center) - body.radius);
    }
    let cruise = warp ? Math.min(305, 22 + Math.max(0, nearestClearance) * 2.2) : 14;
    if (target) {
      direction.copy(target.center).sub(position);
      const distance = direction.length();
      const alignment = direction.normalize().dot(forward);
      const approach = Math.min(210, 12 + Math.max(0, distance - target.scanRadius) * 1.35);
      const turningSpeed = mix(3, Math.max(cruise, approach), Math.max(0, alignment) ** 6);
      cruise = Math.min(turningSpeed, 24 + Math.max(0, distance - target.scanRadius) * 2.4);
    }
    speed = mix(speed, cruise, Math.min(1, delta * (cruise < speed ? 12 : 4)));
    position.addScaledVector(forward, speed * delta);
    let newlyFound = false;
    for (const body of bodies) {
      if (!crossedBody(previous, position, body.center, body.scanRadius)) continue;
      const isNew = !discovered.has(body.id);
      if (isNew) {
        discovered.add(body.id);
        points += body.points;
        ui.score.textContent = points;
        showNotice(`${body.name}を発見！ +${body.points} pt`, now);
        newlyFound = true;
      }
      if (target === body) {
        target = null;
        toggleWarp(false);
        speed = Math.min(speed, 14);
        // Swing around planets and stars. Keep the approach heading at nebulae and clusters.
        if (body.solid) {
          direction.copy(position).sub(body.center).normalize();
          right.crossVectors(up, direction).normalize();
          direction.addScaledVector(right, 2.6).normalize();
          if (direction.lengthSq() > 0) {
            yaw = Math.atan2(direction.x, -direction.z);
            pitch = Math.asin(clamp(direction.y, .98));
          }
        }
        if (!isNew && !newlyFound) showNotice(body.name + "に到着", now);
      }
      if (body.solid && position.distanceTo(body.center) < body.radius + 1.6) {
        direction.copy(position).sub(body.center);
        if (direction.lengthSq() === 0) direction.copy(forward).negate();
        direction.normalize();
        position.copy(body.center).addScaledVector(direction, body.radius + 1.6);
        speed = 0;
      }
    }
    if (newlyFound || now - lastSave >= 2500) {
      record();
      lastSave = now;
    }
  }

  function updateNavigation() {
    const distanceFromSun = position.length();
    let region = "太陽系";
    if (position.distanceTo(earth.center) < 33) region = "地球の近く";
    else if (position.distanceTo(core.center) < 390) region = "天の川銀河の中心部";
    else if (distanceFromSun > 1150) region = "天の川銀河";
    else if (distanceFromSun > 650) region = "太陽系の外";
    if (regionShown !== region) {
      regionShown = region;
      ui.region.textContent = region;
    }
    if (state !== "flying") return;
    let nearestNew = null, nearestDistance = Infinity;
    for (const body of bodies) {
      const distance = position.distanceToSquared(body.center);
      if (!discovered.has(body.id) && distance < nearestDistance) {
        nearestNew = body;
        nearestDistance = distance;
      }
    }
    const beacon = target || nearestNew;
    ui.beacon.hidden = !beacon;
    if (!beacon) return;

    const name = (target ? "自動操縦 • " : "") + beacon.name;
    if (beaconShown !== name) {
      ui.beaconName.textContent = name;
      beaconShown = name;
    }
    projected.copy(beacon.center).project(view.camera);
    const behind = direction.copy(beacon.center).sub(view.camera.position).dot(forward) < 0;
    const { clientWidth: width, clientHeight: height } = ui.viewport;
    const x = behind ? -projected.x : projected.x;
    const y = behind ? projected.y : -projected.y;
    const edge = behind || Math.abs(x) > .73 || Math.abs(y) > .65;
    const angle = x * x + y * y > .0001 ? Math.atan2(y, x) : (behind ? Math.PI : -Math.PI / 2);
    const margin = Math.min((width - 8) / 2, ui.beacon.offsetWidth / 2 + 8);
    const safeX = Math.min(width - margin, Math.max(margin, (1 + clamp(x, .95)) * width / 2));
    const safeY = Math.min(height * .73, Math.max(height * .25, (1 + clamp(y, .92)) * height / 2 + 24));
    ui.beacon.style.left = `${safeX}px`;
    ui.beacon.style.top = `${safeY}px`;
    ui.bearing.textContent = edge ? "▲" : "◇";
    ui.bearing.style.transform = edge ? `rotate(${angle + Math.PI / 2}rad)` : "";
  }

  function finish() {
    state = "done";
    tilt.dispose();
    const stored = record();
    clearDrag();
    setMap(false);
    ui.controls.hidden = ui.reticle.hidden = ui.beacon.hidden = ui.discovery.hidden = true;
    updateTime(0);
    ui.summary.textContent = `新しい発見 ${discovered.size - initialCount}件 ・ +${points - initialPoints} pt`;
    if (!stored) {
      ui.summaryTitle.textContent = "フライトおつかれさま";
      ui.finish.querySelector(".saved").textContent = "このブラウザに探検の記録を保存できなかったよ。";
    }
    ui.finish.hidden = false;
    ui.back.focus({ preventScroll: true });
  }

  function frame(now) {
    if (state === "flying") {
      const remaining = Math.max(0, (deadline - now) / 1000);
      // Advance in small steps even when a mobile browser renders fewer frames.
      const delta = Math.max(0, Math.min(.24, (Math.min(now, deadline) - lastFrame) / 1000));
      const steps = Math.max(1, Math.ceil(delta / .05));
      for (let step = 0; step < steps; step++) {
        updateHeading(delta / steps);
        updatePosition(delta / steps, now);
      }
      updateTime(remaining);
      if (now >= noticeEnd) ui.discovery.hidden = true;
      if (remaining === 0) finish();
    } else updateHeading(0);
    lastFrame = now;
    const elapsed = state === "ready" ? 0 : (Math.min(now, deadline) - launchTime) / 1000;
    view.render(position, forward, bank, warp, state === "flying", elapsed, state === "ready");
    updateNavigation();
    if (state !== "done") requestAnimationFrame(frame);
  }

  ui.launch.addEventListener("click", () => {
    state = "flying";
    launchTime = lastFrame = lastSave = performance.now();
    deadline = launchTime + FLIGHT_SECONDS * 1000;
    initialPoints = points;
    initialCount = discovered.size;
    tilt.recenter();
    ui.intro.hidden = true;
    ui.controls.hidden = ui.reticle.hidden = false;
    ui.mapButton.focus({ preventScroll: true });
  });
  ui.home.addEventListener("click", resetEarth);
  ui.warp.addEventListener("click", () => toggleWarp());
  ui.mapButton.addEventListener("click", () => setMap(ui.map.hidden));
  ui.closeMap.addEventListener("click", () => {
    setMap(false);
    ui.mapButton.focus({ preventScroll: true });
  });
  ui.back.addEventListener("click", () => location.replace(learningUrl));
  window.addEventListener("pagehide", () => {
    if (state === "flying") record();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "flying") record();
  });
  requestAnimationFrame(frame);
}
