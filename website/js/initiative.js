/* Initiative tracker for the round bar (CONCEPT §10, F7): both sides roll
   2D6, the winner acts last, the loser moves first. Alpha Strike: with an
   uneven number of units the larger side moves proportionally more models
   per pass. The result lives in the battle state (state.initiative) and is
   dropped with the next round. */
(function () {
    "use strict";

    var T = window.T || function (s) { return s; };
    var PIPS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function d6() { return 1 + Math.floor(Math.random() * 6); }

    /* How does the larger side spread its moves? 6 against 4 -> 2·2·1·1 */
    function distribution(larger, smaller) {
        var base = Math.floor(larger / smaller), extra = larger % smaller, sequence = [];
        for (var i = 0; i < smaller; i++) { sequence.push(base + (i < extra ? 1 : 0)); }
        return sequence;
    }

    /* options: { state, save, rerender, alphaStrike, ownCount } */
    function bar(options) {
        var state = options.state;
        var container = document.createDocumentFragment();
        var ini = state.initiative && state.initiative.round === state.round ? state.initiative : null;
        if (ini && ini.us !== ini.enemy) {
            var weWin = ini.us > ini.enemy;
            container.appendChild(el("span", "initiative-badge",
                T("Initiative:") + " " + (weWin ? T("us") : T("Enemy")) + " (" + ini.us + ":" + ini.enemy + ") · " +
                (weWin ? T("enemy moves first") : T("we move first"))));
        }
        var button = el("button", "btn btn-small", "Initiative");
        button.type = "button";
        button.addEventListener("click", function () { dialog(options); });
        container.appendChild(button);
        return container;
    }

    var box = null;
    function dialog(options) {
        var state = options.state;
        if (!box) {
            box = document.createElement("dialog");
            box.className = "dialog-box";
            box.addEventListener("click", function (ev) { if (ev.target === box) { box.close(); } });
            document.body.appendChild(box);
        }
        box.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", T("Initiative · round") + " " + state.round));
        header.appendChild(el("span", "", "2D6"));
        box.appendChild(header);

        var values = state.initiative && state.initiative.round === state.round
            ? { us: state.initiative.us, enemy: state.initiative.enemy,
                usCount: state.initiative.usCount, enemyCount: state.initiative.enemyCount }
            : { us: 0, enemy: 0, usCount: options.ownCount || 4, enemyCount: options.ownCount || 4 };

        function row(key, label) {
            var r = el("div", "initiative-row");
            r.appendChild(el("span", "initiative-label", label));
            var display = el("span", "initiative-roll", values[key] ? String(values[key]) : "–");
            var field = document.createElement("input");
            field.type = "number"; field.min = "2"; field.max = "12"; field.inputMode = "numeric";
            field.value = values[key] || "";
            field.setAttribute("aria-label", T(label) + " " + T("(own roll)"));
            field.addEventListener("input", function () {
                values[key] = parseInt(field.value, 10) || 0;
                display.textContent = values[key] ? String(values[key]) : "–";
                renderResult();
            });
            r.appendChild(display); r.appendChild(field);
            return { el: r, display: display, field: field };
        }
        var us = row("us", "Us");
        var enemy = row("enemy", "Enemy");
        box.appendChild(us.el); box.appendChild(enemy.el);

        var rollBoth = el("button", "btn btn-primary dice-btn", "Roll both");
        rollBoth.type = "button";
        rollBoth.addEventListener("click", function () {
            var a = d6(), b = d6(), c = d6(), d = d6();
            values.us = a + b; values.enemy = c + d;
            us.display.textContent = PIPS[a - 1] + PIPS[b - 1] + " " + values.us;
            enemy.display.textContent = PIPS[c - 1] + PIPS[d - 1] + " " + values.enemy;
            us.field.value = values.us; enemy.field.value = values.enemy;
            renderResult();
        });
        box.appendChild(rollBoth);

        var result = el("p", "heat-effect");
        box.appendChild(result);

        if (options.alphaStrike) {
            var countBox = el("div", "initiative-counts");
            [["usCount", "Our units"], ["enemyCount", "Enemy units"]].forEach(function (p) {
                var label = el("label", "", p[1]);
                var f = document.createElement("input");
                f.type = "number"; f.min = "1"; f.max = "40"; f.inputMode = "numeric";
                f.value = values[p[0]];
                f.addEventListener("input", function () { values[p[0]] = parseInt(f.value, 10) || 1; renderResult(); });
                label.appendChild(f);
                countBox.appendChild(label);
            });
            box.appendChild(countBox);
        }
        var sequence = el("p", "hint");
        box.appendChild(sequence);

        function renderResult() {
            sequence.textContent = "";
            if (!values.us || !values.enemy) { result.textContent = ""; return; }
            if (values.us === values.enemy) { result.textContent = T("Tie – roll again."); return; }
            var weWin = values.us > values.enemy;
            result.textContent = (weWin ? T("We win the initiative") : T("The enemy wins the initiative")) +
                " – " + (weWin ? T("The enemy moves first, we act last.") : T("we move first, the enemy acts last."));
            if (options.alphaStrike && values.usCount && values.enemyCount && values.usCount !== values.enemyCount) {
                var weAreLarger = values.usCount > values.enemyCount;
                var spread = distribution(Math.max(values.usCount, values.enemyCount),
                                          Math.min(values.usCount, values.enemyCount));
                sequence.textContent = (weAreLarger ? T("Us") : T("Enemy")) + " " + T("moves per pass") + " " +
                    spread.join(" · ") + " " + T("units, the other side 1 each.");
            }
        }
        renderResult();

        var footer = el("p", "cta");
        var apply = el("button", "btn btn-primary", "Apply");
        apply.type = "button";
        apply.addEventListener("click", function () {
            if (values.us && values.enemy && values.us !== values.enemy) {
                state.initiative = { round: state.round, us: values.us, enemy: values.enemy,
                                     usCount: values.usCount, enemyCount: values.enemyCount };
            } else {
                delete state.initiative;
            }
            options.save();
            box.close();
            options.rerender();
        });
        var close = el("button", "btn btn-small", "Close");
        close.type = "button";
        close.addEventListener("click", function () { box.close(); });
        footer.appendChild(apply); footer.appendChild(close);
        box.appendChild(footer);
        box.showModal();
    }

    window.MechsInitiative = { bar: bar };
})();
