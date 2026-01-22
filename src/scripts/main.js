document.addEventListener("DOMContentLoaded", () => {
  const el = document.querySelector(
    '[data-total-performance="dashboard"]'
  );

  if (!el) {
    console.error(
      "[STEP 1 FAIL] Asset Summary target DOM NOT FOUND"
    );
  } else {
    console.log(
      "[STEP 1 OK] Asset Summary target DOM FOUND",
      el
    );
    el.style.minHeight = "240px";
    el.style.border = "2px dashed #68FE1D";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.color = "#68FE1D";
    el.textContent = "STEP 1 OK – Asset Summary Target Ready";
  }
});
