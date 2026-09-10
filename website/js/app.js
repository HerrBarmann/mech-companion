/* Shared app logic: theme, table mode, service worker, update notice. Runs
   on every page. Paths resolve relative to where this script sits, so the
   pages work at any directory depth. */
(function () {
    "use strict";

    var ROOT = new URL("..", document.currentScript.src);

    /* --- Theme: dark is the default, light the remembered deviation ------ */
    var themeButton = document.getElementById("theme-btn");
    if (themeButton) {
        themeButton.addEventListener("click", function () {
            var root = document.documentElement;
            var light = root.dataset.theme === "light";
            if (light) { delete root.dataset.theme; } else { root.dataset.theme = "light"; }
            try { localStorage.setItem("mechs-theme", light ? "dark" : "light"); } catch (e) {}
            setThemeColor();
        });
    }
    function setThemeColor() {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.content = document.documentElement.dataset.theme === "light" ? "#F6F5F2" : "#14161A";
        }
    }
    setThemeColor();

    /* --- Table mode: keep the display awake (Screen Wake Lock API) -------
       The button only appears if the browser has the API. The lock is lost
       when the tab changes and is taken again on the way back, as long as
       the mode is on. */
    var tableButton = document.getElementById("table-btn");
    if (tableButton && "wakeLock" in navigator) {
        tableButton.hidden = false;
        var lock = null;
        var active = false;

        function takeLock() {
            navigator.wakeLock.request("screen").then(function (l) {
                lock = l;
                l.addEventListener("release", function () { lock = null; });
            }).catch(function () {
                active = false;
                tableButton.setAttribute("aria-pressed", "false");
            });
        }
        tableButton.addEventListener("click", function () {
            active = !active;
            tableButton.setAttribute("aria-pressed", String(active));
            if (active) { takeLock(); }
            else if (lock) { lock.release(); lock = null; }
        });
        document.addEventListener("visibilitychange", function () {
            if (active && document.visibilityState === "visible" && !lock) { takeLock(); }
        });
    }

    /* --- Service worker + update notice ---------------------------------- */
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register(new URL("sw.js", ROOT)).then(function (reg) {
            reg.addEventListener("updatefound", function () {
                var fresh = reg.installing;
                if (!fresh) { return; }
                fresh.addEventListener("statechange", function () {
                    /* "installed" WITH an existing controller means an update,
                       not a first install. */
                    if (fresh.state === "installed" && navigator.serviceWorker.controller) {
                        showUpdateNotice(fresh);
                    }
                });
            });
        }).catch(function () { /* offline or file:// - no harm done */ });

        var reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
            if (reloaded) { return; }
            reloaded = true;
            location.reload();
        });
    }

    function showUpdateNotice(worker) {
        if (document.querySelector(".update-notice")) { return; }
        var box = document.createElement("div");
        box.className = "flash flash-ok update-notice";
        box.innerHTML = T("New version available") + " ";
        var button = document.createElement("button");
        button.className = "btn btn-small";
        button.textContent = T("Reload");
        button.addEventListener("click", function () {
            worker.postMessage({ type: "activate-now" });
        });
        box.appendChild(button);
        document.body.appendChild(box);
    }
})();
