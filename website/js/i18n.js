/* Language (CONCEPT 5.7): English is the source, every further language a
   generated mirror under <code>/. This script runs in the <head> of EVERY
   page, before anything else:
   - it redirects to the remembered language (localStorage "mechs-lang") when
     the page exists in that language (<link rel="alternate">),
   - it provides T(text): translates script-generated text through the
     dictionary from js/i18n-<code>.js (only loaded on translated pages; on
     the source page T is the identity),
   - it provides MechsI18n.back(text): the way back from the display to the
     source text, for fields that are input at the same time (slot editor). */
(function () {
    "use strict";

    var lang = (document.documentElement.getAttribute("lang") || "de").slice(0, 2);
    var words = {};

    /* --- Redirect to the wanted language ----------------------------------
       First the visitor's remembered choice, otherwise the instance's start
       language from <meta name="site-default-lang"> (which comes from
       site.json at build time). The start language matters because only ONE
       language sits at the root - an instance can therefore start in German
       even though the source is English. No guessing via navigator.language:
       a redirect should stay explainable. */
    try {
        var meta = document.querySelector('meta[name="site-default-lang"]');
        var fallback = (meta && meta.content) || "";
        if (fallback.indexOf("{{") !== -1) { fallback = ""; }   /* placeholder unfilled */
        /* The start language only counts at the ENTRANCE: on the home page
           and only in the language that sits at the root. Otherwise a shared
           link would be bent - whoever sends a particular link means its
           language too. Whether a page sits at the root is revealed by its
           own alternate link: translations point back with "../". */
        var firstAlternate = document.querySelector('link[rel="alternate"][hreflang]');
        var atTheRoot = !!firstAlternate && firstAlternate.getAttribute("href").indexOf("../") !== 0;
        var isHomePage = /(^|\/)(index\.html)?$/.test(location.pathname);
        /* The key was called "mechs-sprache" up to data version 3. It moves
           here and not in migrate.js: this script runs in the <head> and
           reads the choice before anything else is loaded. */
        var remembered = localStorage.getItem("mechs-lang");
        if (remembered === null) {
            remembered = localStorage.getItem("mechs-sprache");
            if (remembered !== null) {
                localStorage.setItem("mechs-lang", remembered);
                localStorage.removeItem("mechs-sprache");
            }
        }
        var wanted = remembered || ((isHomePage && atTheRoot) ? fallback : "");
        if (wanted && wanted !== lang) {
            var alternate = document.querySelector('link[rel="alternate"][hreflang="' + wanted + '"]');
            /* Query and fragment travel along: a share link carries its
               payload in ?mech= / ?lance=, and whoever opens it in the other
               language would otherwise land on an empty hangar. The
               alternate link never has one of its own. */
            if (alternate) { location.replace(alternate.href + location.search + location.hash); }
        }
    } catch (e) { /* localStorage blocked - then no redirect, that is fine */ }

    /* --- T(): source text -> display language -----------------------------
       The source language of the scripts is English. A translated page
       carries a dictionary (js/i18n-<code>.js), the source page none - there
       T is the identity. So what decides is the dictionary, not a hard-wired
       language code.

       Data values are combinatorial: "1/missile", "2/missile",
       "7/14/21 (water only)" - writing every combination into the dictionary
       would be hopeless. A language pack may therefore ship patterns
       (patterns.json) that apply when no entry matches. */
    var patterns = [];
    var hasWords = false;

    function applyPatterns(t) {
        var result = t;
        for (var i = 0; i < patterns.length; i++) {
            result = result.replace(patterns[i].re, patterns[i].to);
        }
        return result;
    }

    function T(text) {
        if (!hasWords || typeof text !== "string") { return text; }
        if (words[text] !== undefined) { return words[text]; }
        var trimmed = text.trim();
        if (words[trimmed] !== undefined) { return text.replace(trimmed, words[trimmed]); }
        var patterned = applyPatterns(trimmed);
        if (patterned !== trimmed) { return text.replace(trimmed, patterned); }
        return text;
    }

    /* The way back: what the user types in the display language becomes the
       source text (English) again before it is stored. Needed by the slot
       editor in the Classic hangar - there the field is display and input at
       once. Meant for short, controlled terms; if one translated text stands
       for several source texts, the first one wins. */
    var reverse = null;
    function back(text) {
        if (!hasWords || typeof text !== "string" || !text) { return text; }
        if (!reverse) {
            reverse = {};
            Object.keys(words).forEach(function (source) {
                if (reverse[words[source]] === undefined) { reverse[words[source]] = source; }
            });
        }
        return reverse[text] !== undefined ? reverse[text] : text;
    }

    /* Language switch: remember the wish, then follow the link. */
    document.addEventListener("click", function (ev) {
        /* The button (two languages) and a menu entry (more) both carry
           data-lang. */
        var button = ev.target.closest && ev.target.closest("[data-lang]");
        if (!button) { return; }
        try { localStorage.setItem("mechs-lang", button.getAttribute("data-lang")); } catch (e) {}
    });

    /* Quotation marks belong to the language: English “…”, German „…“. Both
       characters sit in the dictionary on their own, so that a language pack
       can set them without any character being fixed in the code. */
    function quote(text) {
        return T("“") + text + T("”");
    }

    /* A pattern without a replacement means "stays as it is" - it is meant
       for the generator's check run, and there is nothing to do about it in
       the browser. */
    function setPatterns(list) {
        patterns = (list || []).filter(function (p) { return p.length > 1; })
            .map(function (p) {
                return { re: new RegExp(p[0], p[2] || ""), to: p[1] };
            });
    }

    window.T = T;
    window.Z = quote;
    window.MechsI18n = {
        lang: lang,
        quote: quote,
        back: back,
        setWords: function (w, p) {
            words = w || {};
            setPatterns(p);
            hasWords = Object.keys(words).length > 0 || patterns.length > 0;
            reverse = null;
        }
    };
    /* The dictionary may already be there (i18n-<code>.js loads before this
       script). */
    if (window.MechsI18nWords) {
        words = window.MechsI18nWords;
        setPatterns(window.MechsI18nPatterns);
        hasWords = Object.keys(words).length > 0 || patterns.length > 0;
    }
})();
