/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function nav(el, pid) {
    // Remove active state from all nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Activate clicked nav item
    if (el && el.classList) el.classList.add('active');

    // Activate target page
    const pg = document.getElementById(pid);
    if (pg) pg.classList.add('active');

    const content = document.querySelector('.content');
    if (content) {
        content.classList.toggle('dashboard-active', pid === 'dashboard');
    }

    try {
        document.dispatchEvent(new CustomEvent('qps:page-activated', { detail: { page: pid } }));
    } catch (_) {}
}

/* =========================================================
   DEFAULT LANDING PAGE
   ========================================================= */

// Home is landing page — ensure correct initial state
window.addEventListener('DOMContentLoaded', () => {
    nav(document.querySelector('.nav-item[data-nav="home"]'), 'home');
});
