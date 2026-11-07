// JUST MOG IT v2 — tiny extras. No dependencies, no build step.

// Duplicate every ticker's content so the CSS marquee loop is seamless.
document.querySelectorAll("[data-ticker]").forEach(function (track) {
  track.innerHTML += track.innerHTML;
});

// The cat points at you. Click it and it jabs. As it should.
(function () {
  var wrap = document.getElementById("mascotWrap");
  if (!wrap) return;

  wrap.addEventListener("mouseenter", function () {
    wrap.style.transform = "scale(1.04) rotate(1.2deg)";
  });
  wrap.addEventListener("mouseleave", function () {
    wrap.style.transform = "";
  });
  wrap.addEventListener("click", function () {
    wrap.classList.remove("jab");
    // force reflow so the animation can restart
    void wrap.offsetWidth;
    wrap.classList.add("jab");
  });
})();

// Launches feed — rendered from launches.json, newest first.
(function () {
  var feed = document.getElementById("launchFeed");
  if (!feed) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  fetch("launches.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (items) {
      feed.innerHTML = "";
      if (!items || !items.length) {
        feed.appendChild(el("p", "launch-loading", "No launches yet. The cat is warming up."));
        return;
      }
      items.forEach(function (it, i) {
        var num = items.length - i;
        var card = el("article", "launch-card " + (i % 2 ? "tilt-r" : "tilt-l"));

        var top = el("div", "launch-top");
        top.appendChild(el("span", "launch-num", "#" + String(num).padStart(3, "0")));
        top.appendChild(el("span", "launch-meta", it.date + " · " + it.venue));
        card.appendChild(top);

        card.appendChild(el("h3", "launch-name", it.name + " "));
        card.querySelector(".launch-name").appendChild(el("span", "launch-ticker", "$" + it.ticker));
        card.appendChild(el("p", "launch-story", it.story));

        var caRow = el("div", "launch-ca");
        caRow.appendChild(el("span", "launch-ca-label", "CA"));
        var code = el("code", "launch-ca-value", it.ca);
        caRow.appendChild(code);
        var btn = el("button", "launch-copy", "COPY");
        btn.type = "button";
        btn.addEventListener("click", function () {
          var done = function () {
            btn.textContent = "COPIED ✓";
            setTimeout(function () { btn.textContent = "COPY"; }, 1400);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(it.ca).then(done, done);
          } else { done(); }
        });
        caRow.appendChild(btn);
        card.appendChild(caRow);

        var tx = el("a", "launch-tx", "CREATE TX ↗");
        tx.href = "https://solscan.io/tx/" + it.tx;
        tx.target = "_blank";
        tx.rel = "noopener";
        card.appendChild(tx);

        feed.appendChild(card);
      });
    })
    .catch(function () {
      feed.innerHTML = "";
      feed.appendChild(el("p", "launch-loading", "The launch list is napping. Refresh in a sec."));
    });
})();

// CTA click = tiny burst of mog confetti.
(function () {
  var bits = ["★", "🐱", "💥", "👉", "✦"];
  document.querySelectorAll(".cta-main").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var rect = btn.getBoundingClientRect();
      var parent = btn.offsetParent || document.body;
      var prect = parent.getBoundingClientRect();
      for (var i = 0; i < 10; i++) {
        var s = document.createElement("span");
        s.className = "burst-bit";
        s.textContent = bits[Math.floor(Math.random() * bits.length)];
        s.style.left = (rect.left - prect.left + rect.width / 2) + "px";
        s.style.top = (rect.top - prect.top) + "px";
        var ang = Math.random() * Math.PI * 2;
        var dist = 60 + Math.random() * 90;
        s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
        s.style.setProperty("--dy", (Math.sin(ang) * dist - 50) + "px");
        s.style.setProperty("--rot", (Math.random() * 260 - 130) + "deg");
        parent.appendChild(s);
        (function (el) { setTimeout(function () { el.remove(); }, 850); })(s);
      }
    });
  });
})();
