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

    /* --- Bottom nav out of the keyboard's way ---------------------------- */
    /* A fixed element is pinned to the LAYOUT viewport, and the on-screen
       keyboard does not shrink that - it only shrinks the visual viewport.
       So the bar sits behind the keyboard, and scrolling drags it up across
       it. Reported from the hangar: type in the search field, scroll the
       results, and the bar climbs over the keyboard.

       Repositioning it per visualViewport would mean listening to two
       events on every scroll frame. Hiding it is both simpler and what you
       actually want: while typing you need the results, not the areas. The
       room it occupied stays reserved, so nothing jumps under the finger. */
    var KEYBOARD_TYPES = {
        text: 1, search: 1, email: 1, url: 1, tel: 1, number: 1,
        password: 1, date: 1, "datetime-local": 1, month: 1, time: 1, week: 1
    };
    function raisesKeyboard(node) {
        if (!node) { return false; }
        if (node.isContentEditable) { return true; }
        var tag = node.tagName;
        if (tag === "TEXTAREA") { return true; }
        if (tag !== "INPUT") { return false; }
        return !!KEYBOARD_TYPES[(node.type || "text").toLowerCase()];
    }
    function syncKeyboardState() {
        document.body.classList.toggle("keyboard-open", raisesKeyboard(document.activeElement));
    }
    document.addEventListener("focusin", syncKeyboardState);
    /* On blur the next field may already be taking focus - deciding a tick
       later keeps the bar from flashing when moving between two inputs. */
    document.addEventListener("focusout", function () { setTimeout(syncKeyboardState, 0); });
})();
