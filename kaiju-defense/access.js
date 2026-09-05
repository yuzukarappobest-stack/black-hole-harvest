const ACCESS_KEY = "miniGameAccess:kaiju-defense";
export const learningUrl = "../learn.html";

export function consumeAccess() {
  try {
    if (sessionStorage.getItem(ACCESS_KEY) !== "1") return false;
    sessionStorage.removeItem(ACCESS_KEY);
    return true;
  } catch {
    return false;
  }
}

window.addEventListener("pageshow", event => {
  if (event.persisted) window.location.replace(learningUrl);
});
