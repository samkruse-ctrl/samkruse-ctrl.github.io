// Site entry — add listeners and logic inside init(), or import from other files.

function init() {
  // document.getElementById("main");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
