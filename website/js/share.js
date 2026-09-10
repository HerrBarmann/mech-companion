/* Share a lance (CONCEPT §10, F3): a whole force as a compact link (a
   database reference plus the pilot per unit, no full text) and a QR code to
   photograph at the table. The recipient resolves the references against
   their own database - custom builds still travel only as single-unit links.
   QR: the bundled library vendor/qrcode.js (MIT), no foreign servers. */
(function () {
    "use strict";

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function b64url(text) {
        var bytes = new TextEncoder().encode(text), bin = "";
        bytes.forEach(function (b) { bin += String.fromCharCode(b); });
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function fromB64url(encoded) {
        var bin = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        return new TextDecoder().decode(bytes);
    }

    /* entries: [{q: db id|null, n: name, ...pilot fields}] -> hangar.html?lance=… */
    function lanceLink(entries) {
        var url = new URL("hangar.html", location.href);
        url.search = "";
        url.searchParams.set("lance", b64url(JSON.stringify(entries)));
        return url.toString();
    }
    function fromLanceLink() {
        /* The parameter was called "lanze" up to data version 3 - shared
           links outlive a rename. */
        var params = new URLSearchParams(location.search);
        var value = params.get("lance") || params.get("lanze");
        if (!value) { return null; }
        try {
            var list = JSON.parse(fromB64url(value));
            return Array.isArray(list) && list.length ? list : null;
        } catch (e) { return null; }
    }

    var box = null;
    /* Shows the link, a QR code if it is short enough, and a copy button. */
    function dialog(link, title, note) {
        if (!box) {
            box = document.createElement("dialog");
            box.className = "dialog-box share-dialog";
            box.addEventListener("click", function (ev) { if (ev.target === box) { box.close(); } });
            document.body.appendChild(box);
        }
        box.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", title));
        box.appendChild(header);
        if (note) { box.appendChild(el("p", "hint", note)); }

        if (window.qrcode && link.length <= 2300) {
            try {
                var qr = window.qrcode(0, "M");
                qr.addData(link);
                qr.make();
                var qrBox = el("div", "qr-box");
                qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
                box.appendChild(qrBox);
            } catch (e) { /* too long for a QR code - then just the link */ }
        }
        var field = document.createElement("input");
        field.type = "text"; field.readOnly = true; field.value = link;
        field.setAttribute("aria-label", T("Share link"));
        field.addEventListener("focus", function () { field.select(); });
        box.appendChild(field);

        var footer = el("p", "cta");
        var copy = el("button", "btn btn-primary", "Copy link");
        copy.type = "button";
        copy.addEventListener("click", function () {
            (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
                .then(function () { copy.textContent = T("Link copied ✓"); })
                .catch(function () { field.focus(); });
        });
        var close = el("button", "btn btn-small", "Close");
        close.type = "button";
        close.addEventListener("click", function () { box.close(); });
        footer.appendChild(copy); footer.appendChild(close);
        box.appendChild(footer);
        box.showModal();
    }

    window.MechsShare = { lanceLink: lanceLink, fromLanceLink: fromLanceLink, dialog: dialog };
})();
