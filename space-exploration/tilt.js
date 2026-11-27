const RAD = Math.PI / 180;
const DEAD_ZONE = 3.5 * RAD;
const FULL_TURN = 25 * RAD;

function screenAngle() {
  return Number.isFinite(screen.orientation?.angle) ? screen.orientation.angle : (window.orientation || 0);
}

function screenPose(beta, gamma, angle) {
  const pitch = beta * RAD;
  const roll = gamma * RAD;
  const rotation = angle * RAD;
  // Express the world up vector in screen coordinates, including landscape orientation.
  const upX = -Math.cos(pitch) * Math.sin(roll);
  const upY = Math.sin(pitch);
  const upZ = Math.cos(pitch) * Math.cos(roll);
  const right = upX * Math.cos(rotation) - upY * Math.sin(rotation);
  const up = upX * Math.sin(rotation) + upY * Math.cos(rotation);
  return [Math.asin(Math.max(-1, Math.min(1, -right))), Math.atan2(up, upZ)];
}

function turnAmount(angle, neutral) {
  const difference = Math.atan2(Math.sin(angle - neutral), Math.cos(angle - neutral));
  const amount = Math.max(0, Math.abs(difference) - DEAD_ZONE) / (FULL_TURN - DEAD_ZONE);
  return Math.sign(difference) * Math.min(1, amount);
}

export function createTiltControls(onChange) {
  const output = { x: 0, y: 0 };
  let state = "off";
  let available = true, sensorTimeout;
  let angle, latest, center;

  function reset() {
    center = latest;
    output.x = output.y = 0;
  }

  function stop(message = "") {
    window.clearTimeout(sensorTimeout);
    window.removeEventListener("deviceorientation", onOrientation);
    screen.orientation?.removeEventListener("change", onScreenRotation);
    window.removeEventListener("orientationchange", onScreenRotation);
    document.removeEventListener("visibilitychange", onVisibility);
    latest = undefined;
    reset();
    state = "off";
    onChange(state, message);
  }

  function onScreenRotation() {
    if (screenAngle() !== angle) {
      latest = undefined;
      reset();
    }
  }

  function onVisibility() {
    if (document.hidden) {
      latest = undefined;
      reset();
    }
  }

  function onOrientation(event) {
    if (document.hidden || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    const currentAngle = screenAngle();
    if (angle !== currentAngle) {
      angle = currentAngle;
      center = undefined;
    }
    latest = screenPose(event.beta, event.gamma, currentAngle);
    center ??= latest;
    if (state === "waiting") {
      window.clearTimeout(sensorTimeout);
      state = "on";
      onChange(state, "傾き操作オン。今の持ち方が進む向きの基準だよ。");
    }
  }

  async function toggle() {
    if (state === "requesting" || !available) return;
    if (state !== "off") {
      stop("傾き操作オフ");
      return;
    }

    const sensor = window.DeviceOrientationEvent;
    if (!window.isSecureContext || !sensor) {
      stop("このブラウザでは傾き操作が使えないよ。画面をスライドして操縦してね。");
      return;
    }
    state = "requesting";
    onChange(state, "傾き操作の許可を確認中…");
    try {
      if (typeof sensor.requestPermission === "function" && await sensor.requestPermission() !== "granted") {
        if (available) stop("傾き操作が許可されなかったよ。画面をスライドして操縦してね。");
        return;
      }
    } catch {
      if (available) stop("傾き操作を開始できなかったよ。画面をスライドして操縦してね。");
      return;
    }
    if (!available) return;
    state = "waiting";
    onChange(state, "いつもの持ち方で、端末を少し傾けてみよう。");
    window.addEventListener("deviceorientation", onOrientation);
    screen.orientation?.addEventListener("change", onScreenRotation);
    window.addEventListener("orientationchange", onScreenRotation);
    document.addEventListener("visibilitychange", onVisibility);
    sensorTimeout = window.setTimeout(() => {
      stop("端末の傾きを読み取れなかったよ。画面をスライドして操縦してね。");
    }, 3200);
  }

  function read(delta) {
    if (!latest || !center || state !== "on") return output;
    const blend = 1 - Math.exp(-12 * delta);
    output.x += (turnAmount(latest[0], center[0]) - output.x) * blend;
    output.y += (turnAmount(latest[1], center[1]) - output.y) * blend;
    return output;
  }

  return {
    toggle, read, recenter: reset,
    dispose() {
      available = false;
      stop();
    }
  };
}
