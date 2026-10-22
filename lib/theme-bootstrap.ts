// Runs before first paint so pages never flash the wrong theme.
export const themeBootstrap = `try{var s=JSON.parse(localStorage.getItem("loop:settings")||"{}");document.documentElement.dataset.theme=s.theme||"paper"}catch(e){document.documentElement.dataset.theme="paper"}`;
