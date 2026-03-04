/* =========================================================
   HOME PAGE LOGIC
   ========================================================= */
window.addEventListener("DOMContentLoaded", () => {
   const carousel = document.querySelector(".eng-carousel");
   if (!carousel) return;

   carousel.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      carousel.scrollBy({ left: e.deltaY, behavior: "smooth" });
   }, { passive: false });
});

console.log("Home module loaded.");
