/* Campaign page (CONCEPT §10, F9): create and switch between named
   campaigns, see the condition of the units and repair them, read the battle
   log. One script for both systems - which one is meant stands in
   <body data-system="…">. */
(function () {
    "use strict";

    var SYSTEM = document.body.dataset.system;
    var S = window.MechsStorage;
    var K = window.MechsCampaign;
    var ROOT = new URL("..", document.currentScript.src);
    var T = window.T || function (s) { return s; };

    var listBox = document.getElementById("campaign-list");
    var stateBox = document.getElementById("state-list");
    var recordBox = document.getElementById("record-list");
    var logBox = document.getElementById("log-list");
    var message = document.getElementById("message");
    var rules = null;   /* classic-rules.json, only for the crit names */

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function showMessage(text, ok) {
        message.textContent = text;
        message.className = "flash " + (ok === false ? "flash-err" : "flash-ok");
        message.hidden = false;
        clearTimeout(showMessage.t);
        showMessage.t = setTimeout(function () { message.hidden = true; }, 6000);
    }
    function mechs() { return S.loadHangar(SYSTEM).mechs; }
    function critName(id) {
        var def = rules && rules.critComponents &&
            rules.critComponents.filter(function (c) { return c.id === id; })[0];
        return def ? T(def.name) : id;
    }

    /* --- Campaigns --------------------------------------------------------- */
    function renderCampaigns() {
        listBox.innerHTML = "";
        var all = K.campaigns(SYSTEM);
        var activeId = K.activeId(SYSTEM);
        all.forEach(function (c) {
            var card = el("article", "card campaign-card" + (c.id === activeId ? " highlight" : ""));
            var header = el("div", "pip-label");
            header.appendChild(el("span", "", c.id === activeId ? T("Active") : T("Campaign")));
            header.appendChild(el("span", "", T("since") + " " + c.created));
            card.appendChild(header);
            card.appendChild(el("h3", "", c.name));

            var damaged = Object.keys(c.states || {}).length;
            var entries = (c.log || []).length;
            card.appendChild(el("p", "mech-stats",
                damaged + " " + T(damaged === 1 ? "unit with damage" : "units with damage") +
                " · " + entries + " " + T(entries === 1 ? "battle in the log" : "battles in the log")));

            var buttons = el("p", "cta");
            if (c.id !== activeId) {
                var activate = el("button", "btn btn-small btn-primary", "Activate");
                activate.type = "button";
                activate.addEventListener("click", function () {
                    K.activate(SYSTEM, c.id);
                    renderAll();
                    showMessage(Z(c.name) + " " + T("is now the active campaign."));
                });
                buttons.appendChild(activate);
            }
            var rename = el("button", "btn btn-small", "Rename");
            rename.type = "button";
            rename.addEventListener("click", function () {
                var name = prompt(T("New name for the campaign:"), c.name);
                if (name === null) { return; }
                name = name.trim();
                if (!name) { return; }
                K.rename(SYSTEM, c.id, name);
                renderAll();
            });
            buttons.appendChild(rename);
            var remove = el("button", "btn btn-small btn-danger", "Delete");
            remove.type = "button";
            remove.addEventListener("click", function () {
                if (!confirm(Z(c.name) + " " + T("delete together with its condition and log?"))) { return; }
                if (!K.remove(SYSTEM, c.id)) {
                    showMessage(T("The last campaign cannot be deleted."), false);
                    return;
                }
                renderAll();
                showMessage(Z(c.name) + " " + T("has been deleted."));
            });
            buttons.appendChild(remove);
            card.appendChild(buttons);
            listBox.appendChild(card);
        });
    }

    document.getElementById("new-btn").addEventListener("click", function () {
        var name = prompt(T("Name of the new campaign:"), T("New campaign"));
        if (name === null) { return; }
        name = name.trim();
        if (!name) { return; }
        var c = K.create(SYSTEM, name);
        renderAll();
        showMessage(Z(c.name) + " " + T("has been created and is active."));
    });

    /* --- Condition of the units -------------------------------------------- */
    function renderState() {
        stateBox.innerHTML = "";
        var damaged = mechs().filter(function (m) { return K.stateOf(SYSTEM, m.id); });
        document.getElementById("state-empty").hidden = damaged.length !== 0;
        damaged.forEach(function (m) {
            var row = el("div", "state-row");
            var info = el("div");
            info.appendChild(el("strong", "", m.name));
            info.appendChild(K.badge(SYSTEM, m));
            row.appendChild(info);
            var button = el("button", "btn btn-small", "Workshop");
            button.type = "button";
            button.addEventListener("click", function () {
                K.workshop({
                    system: SYSTEM, mech: m, storage: S, critName: critName,
                    onDone: function (fullyRepaired) {
                        renderAll();
                        showMessage(Z(m.name) + " " +
                            T(fullyRepaired ? "is ready for action again." : "was partially repaired."));
                    }
                });
            });
            row.appendChild(button);
            stateBox.appendChild(row);
        });
    }

    /* --- Record: battles fought, kills ------------------------------------- */
    /* Battles count themselves at the end of a battle. Kills cannot: this
       app tracks your own lance and never sees the other side, so that
       number is set by hand - which is also the honest place for it, since
       what counts as a kill is a table's own convention. */
    function renderRecord() {
        recordBox.innerHTML = "";
        var byId = {};
        mechs().forEach(function (m) { byId[m.id] = m; });
        var rows = K.records(SYSTEM)
            .filter(function (r) { return byId[r.mechId]; })
            .sort(function (a, b) { return (b.battles - a.battles) || (b.kills - a.kills); });
        document.getElementById("record-empty").hidden = rows.length !== 0;

        rows.forEach(function (r) {
            var m = byId[r.mechId];
            var row = el("div", "state-row");
            var info = el("div");
            /* Unit and pilot names are what a person typed - past T(). */
            var name = document.createElement("strong");
            name.textContent = m.name;
            info.appendChild(name);
            var pilot = (m.pilot && m.pilot.name) || "";
            var line = document.createElement("span");
            line.className = "mech-stats";
            /* Label before the number, so no singular and plural forms are
               needed - and a single lowercase word like "battles" would
               never reach the dictionary anyway. */
            line.textContent = (pilot ? pilot + " · " : "") + T("Battles") + " " + r.battles;
            info.appendChild(line);
            row.appendChild(info);

            /* Kills as a stepper - the same shape the trackers use. */
            var box = el("div", "record-kills");
            box.appendChild(el("span", "pip-label", "Kills"));
            var minus = el("button", "btn btn-small", "−");
            minus.type = "button";
            var value = el("span", "record-value", String(r.kills));
            var plus = el("button", "btn btn-small", "+");
            plus.type = "button";
            function change(by) {
                var next = K.setRecord(SYSTEM, r.mechId, { kills: r.kills + by });
                r.kills = next.kills || 0;
                value.textContent = String(r.kills);
            }
            minus.addEventListener("click", function () { change(-1); });
            plus.addEventListener("click", function () { change(1); });
            box.appendChild(minus); box.appendChild(value); box.appendChild(plus);
            row.appendChild(box);
            recordBox.appendChild(row);
        });
    }

    /* --- Log ---------------------------------------------------------------- */
    function renderLog() {
        logBox.innerHTML = "";
        var entries = K.log(SYSTEM);
        document.getElementById("log-empty").hidden = entries.length !== 0;
        entries.forEach(function (entry, index) {
            var card = el("article", "card log-entry");
            var header = el("div", "pip-label");
            header.appendChild(el("span", "", entry.date));
            header.appendChild(el("span", "", entry.rounds
                ? entry.rounds + " " + T(entry.rounds === 1 ? "round" : "rounds") : ""));
            card.appendChild(header);
            if (entry.note) { card.appendChild(el("p", "log-note", entry.note)); }
            (entry.units || []).forEach(function (u) {
                var row = el("p", "mech-stats" + (u.destroyed ? " destroyed-row" : ""));
                row.textContent = u.name + " – " + u.summary;
                card.appendChild(row);
            });
            var remove = el("button", "btn btn-small btn-danger", "Delete entry");
            remove.type = "button";
            remove.addEventListener("click", function () {
                if (!confirm(T("Delete this log entry?"))) { return; }
                K.removeLogEntry(SYSTEM, index);
                renderLog();
            });
            card.appendChild(remove);
            logBox.appendChild(card);
        });
    }

    function renderAll() {
        renderCampaigns();
        renderState();
        renderRecord();
        renderLog();
        var active = K.active(SYSTEM);
        document.getElementById("active-name").textContent = active.name;
    }

    if (SYSTEM === "classic") {
        fetch(new URL("data/classic-rules.json", ROOT))
            .then(function (r) { return r.json(); })
            .then(function (d) { rules = d; })
            .catch(function () {});
    }
    renderAll();
})();
