const VELKYN_API_ORIGIN = (() => {
    const host = window.location.hostname || "";
    const port = window.location.port || "";
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";

    if (isLocal && port === "5500") {
        return "http://127.0.0.1:8000";
    }

    return window.location.origin;
})();

window.__VELKYN_API_ORIGIN = VELKYN_API_ORIGIN;

/* =========================================================
   TOPBAR AUTO-HIDE + REVEAL
   ========================================================= */
const topbar = document.getElementById('topbar');
let hideT = null;

// Hide after initial delay
setTimeout(() => topbar.classList.add('hidden'), 3200);

function showBar() {
    clearTimeout(hideT);
    topbar.classList.remove('hidden');
}

function schedHide() {
    hideT = setTimeout(() => topbar.classList.add('hidden'), 2000);
}

// Reveal when mouse touches top edge
document.addEventListener('mousemove', e => {
    if (e.clientY < 8) showBar();
});

topbar.addEventListener('mouseenter', showBar);
topbar.addEventListener('mouseleave', schedHide);
document.getElementById('trig').addEventListener('mouseenter', showBar);


/* =========================================================
   UPTIME TIMER
   ========================================================= */
let sec = 0;

setInterval(() => {
    sec++;
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');

    const el = document.getElementById('uptime');
    if (el) el.textContent = `${h}:${m}:${s}`;
}, 1000);

/* =========================================================
   GLOBAL ENGINE LOADER
   ========================================================= */
window.engineLoader = (() => {
    let progressTimer = null;
    let logTimers = [];

    const refs = () => ({
        loader: document.getElementById('simLoad'),
        ringArc: document.getElementById('ringArc'),
        ringPct: document.getElementById('ringPct'),
        bar: document.getElementById('simBar'),
        sub: document.getElementById('simSub'),
        lbl: document.getElementById('simLbl'),
        log: document.getElementById('simLog'),
    });

    const clearTimers = () => {
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
        logTimers.forEach(clearTimeout);
        logTimers = [];
    };

    const buildLogMessages = (engine, detail) => [
        { t: 100, cls: 'hi', msg: `// INITIALISING ${engine.toUpperCase()} ENGINE` },
        { t: 480, cls: '', msg: `  ► ${detail || 'loading parameters...'} ` },
        { t: 920, cls: '', msg: '  ► validating input payload...' },
        { t: 1320, cls: 'hi', msg: '// RUNNING CORE COMPUTATION' },
        { t: 1750, cls: '', msg: '  ► processing numerical output...' },
        { t: 2200, cls: '', msg: '  ► assembling chart-ready data...' },
        { t: 2650, cls: 'hi', msg: '// FINALISING RESPONSE' },
    ];

    const setProgress = (value) => {
        const { ringArc, ringPct, bar } = refs();
        if (!ringArc || !ringPct || !bar) return;

        const pct = Math.max(0, Math.min(100, value));
        const dash = 333 - (333 * pct / 100);
        ringArc.style.strokeDashoffset = String(dash);
        ringPct.textContent = `${Math.floor(pct)}%`;
        bar.style.width = `${pct.toFixed(1)}%`;
    };

    const start = (engine, expectedMs = 2400, message = 'Running simulation...') => {
        const { loader, sub, lbl, log } = refs();
        if (!loader || !sub || !lbl || !log) return;

        clearTimers();
        setProgress(0);
        lbl.textContent = engine;
        sub.textContent = message.toUpperCase();
        log.innerHTML = '';

        loader.style.display = 'block';
        loader.style.opacity = '0';
        loader.style.transform = 'translate(-50%, calc(-50% + 8px))';
        requestAnimationFrame(() => {
            loader.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
            loader.style.opacity = '1';
            loader.style.transform = 'translate(-50%, -50%)';
        });

        const started = Date.now();
        progressTimer = setInterval(() => {
            const elapsed = Date.now() - started;
            const head = Math.min(92, (elapsed / Math.max(900, expectedMs)) * 92);
            const tail = 7 * (1 - Math.exp(-Math.max(0, elapsed - expectedMs) / 2800));
            setProgress(Math.min(99, head + tail));
        }, 90);

        buildLogMessages(engine, message).forEach(({ t, cls, msg }) => {
            const tid = setTimeout(() => {
                const line = document.createElement('div');
                line.className = `sim-log-line${cls ? ` ${cls}` : ''}`;
                line.textContent = msg;
                log.appendChild(line);
                log.scrollTop = log.scrollHeight;
            }, t);
            logTimers.push(tid);
        });
    };

    const stop = (success = true, message = '') => {
        const { loader, sub, log } = refs();
        if (!loader || !sub || !log) return;

        clearTimers();

        if (message) {
            sub.textContent = message.toUpperCase();
        }

        const doneLine = document.createElement('div');
        doneLine.className = `sim-log-line ${success ? 'ok' : 'hi'}`;
        doneLine.textContent = success ? '  ✓ simulation complete' : '  ✕ run failed';
        log.appendChild(doneLine);
        log.scrollTop = log.scrollHeight;

        if (!success) {
            loader.style.transition = 'opacity 0.2s ease';
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                loader.style.opacity = '1';
            }, 220);
            setProgress(0);
            return;
        }

        setProgress(100);
        setTimeout(() => {
            loader.style.transition = 'opacity 0.35s ease';
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                loader.style.opacity = '1';
                setProgress(0);
            }, 370);
        }, 320);
    };

    return { start, stop };
})();
