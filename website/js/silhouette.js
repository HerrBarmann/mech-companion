/* Generic 'Mech silhouette (CONCEPT 4.4): an angular front-view SVG with the
   three surface roles base / trim / accent. The faction browser and the
   scheme workshop paint the same surfaces - you see the scheme before the
   brush touches the model. */
(function () {
    "use strict";

    var NS = "http://www.w3.org/2000/svg";
    var OUTLINE = "rgba(10,12,14,0.55)";

    /* [role, points] - the order is the drawing order */
    var SURFACES = [
        /* legs */
        ["base", "47,64 59,64 57,88 45,86"],
        ["base", "73,64 61,64 63,88 75,86"],
        ["base", "44,88 58,88 56,112 42,112"],
        ["base", "76,88 62,88 64,112 78,112"],
        /* feet */
        ["trim", "36,112 58,112 58,122 34,122"],
        ["trim", "84,112 62,112 62,122 86,122"],
        /* hip */
        ["trim", "46,54 74,54 71,64 49,64"],
        /* side torsos, bevelled */
        ["trim", "28,24 46,21 45,54 31,47"],
        ["trim", "92,24 74,21 75,54 89,47"],
        /* centre torso */
        ["base", "46,20 74,20 78,36 74,54 46,54 42,36"],
        /* chest plate */
        ["accent", "54,26 66,26 64,32 56,32"],
        /* shoulder armour */
        ["base", "16,20 34,16 36,30 18,32"],
        ["base", "104,20 86,16 84,30 102,32"],
        /* arms */
        ["base", "20,32 32,32 30,60 18,58"],
        ["base", "100,32 88,32 90,58 102,56"],
        /* fist on the left, cannon on the right (an echo of the logo) */
        ["trim", "17,60 31,60 30,72 18,72"],
        ["accent", "90,56 104,54 106,78 92,78"],
        ["accent", "95,78 103,78 103,84 95,84"],
        /* head with visor */
        ["base", "52,6 68,6 70,18 50,18"],
        ["accent", "54,10 66,10 66,14 54,14"]
    ];

    function create(colors) {
        var svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 120 126");
        svg.setAttribute("class", "mech-silhouette");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", (window.T || function (s) { return s; })("Scheme preview"));
        SURFACES.forEach(function (s) {
            var p = document.createElementNS(NS, "polygon");
            p.setAttribute("points", s[1]);
            p.setAttribute("data-role", s[0]);
            p.setAttribute("stroke", OUTLINE);
            p.setAttribute("stroke-width", "1.4");
            p.setAttribute("stroke-linejoin", "round");
            svg.appendChild(p);
        });
        paint(svg, colors);
        return svg;
    }

    function paint(svg, colors) {
        colors = colors || {};
        svg.querySelectorAll("polygon").forEach(function (p) {
            p.setAttribute("fill", colors[p.getAttribute("data-role")] || "#4A4F55");
        });
    }

    window.MechsSilhouette = { create: create, paint: paint };
})();
