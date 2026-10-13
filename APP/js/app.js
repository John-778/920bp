/* =========================================================================
   Digital Bus Pass - app logic (matches ./reference screenshots)
   Frontend only. State persists in localStorage. No login / backend.
   ========================================================================= */
(function () {
  "use strict";

  var STORE_KEY = "dbp_passes_v3";
  var ACTIVE_KEY = "dbp_active_v3";

  var ROUTE_TYPES = {
    Pickup: { label: "Pickup", showIn: true,  showOut: false },
    Drop:   { label: "Drop",   showIn: false, showOut: true  },
    Both:   { label: "Both",   showIn: true,  showOut: true  }
  };

  /* ----- Seed data: placeholder passes shown on a fresh install ---------
     Dummy names / employee IDs on purpose - edit them in the app.        */
  function seed() {
    return [
      {
        id: uid(),
        name: "JOHN DOE", empId: "1000001",
        startPoint: "TCS Olympus", location: "Thane Stn. E Kopari", busStop: "Thane Stn. E Kopari",
        routeType: "Drop", officeIn: "07:20", officeOut: "17:00",
        startDate: "2026-10-01", endDate: "2026-10-31",
        routeName: "TCS Olympus To Thane Stn. E Kopari Via-FAST",
        busNumber: "", seatNumber: ""
      },
      {
        id: uid(),
        name: "JANE DOE", empId: "1000002",
        startPoint: "Thane Stn. E Kopari", location: "TCS Olympus", busStop: "Thane Stn. E Kopari",
        routeType: "Both", officeIn: "07:20", officeOut: "17:45",
        startDate: "2026-10-01", endDate: "2026-10-31",
        routeName: "Thane Stn. E Kopari To TCS Olympus And Return Via-FAST",
        busNumber: "", seatNumber: ""
      }
    ];
  }

  /* ----- State ---------------------------------------------------------- */
  var passes = load();
  var activeId = localStorage.getItem(ACTIVE_KEY);
  if (!passes.length) { passes = seed(); save(); }
  if (!activeId || !byId(activeId)) { activeId = passes[0].id; }

  var current = "welcome";
  var editingId = null;
  var qrMode = false;

  /* ----- DOM refs ------------------------------------------------------- */
  var welcome = document.getElementById("welcome");
  var app     = document.getElementById("app");
  var elPass  = document.getElementById("screen-pass");
  var elList  = document.getElementById("screen-list");
  var elForm  = document.getElementById("screen-form");
  var elTitle = document.getElementById("screenTitle");
  var drawer  = document.getElementById("drawer");
  var scrim   = document.getElementById("scrim");

  /* ===================================================================== */
  /*  Helpers                                                              */
  /* ===================================================================== */
  function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; } }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(passes));
      localStorage.setItem(ACTIVE_KEY, activeId || "");
    } catch (e) {}
  }
  function uid() { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function byId(id) { for (var i = 0; i < passes.length; i++) if (passes[i].id === id) return passes[i]; return null; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function ordinal(d) {
    if (d > 3 && d < 21) return d + "th";
    switch (d % 10) { case 1: return d + "st"; case 2: return d + "nd"; case 3: return d + "rd"; default: return d + "th"; }
  }
  function fmtDate(iso) {
    if (!iso) return "-";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var m = parseInt(p[1], 10), day = parseInt(p[2], 10);
    return ordinal(day) + " " + (months[m - 1] || p[1]) + ", " + p[0];
  }

  /* ===================================================================== */
  /*  Navigation                                                           */
  /* ===================================================================== */
  function go(screen) {
    closeDrawer();

    if (screen === "welcome") { current = "welcome"; welcome.hidden = false; app.hidden = true; return; }

    // stubs for skipped features
    if (screen === "feedback") { toast("Feedback History is not part of this demo"); return; }
    if (screen === "settings") { toast("Settings are not part of this demo"); return; }
    if (screen === "logout")   { return go("welcome"); }

    welcome.hidden = true;
    app.hidden = false;
    current = screen;

    var showForm = (screen === "add" || screen === "edit");
    elPass.hidden = screen !== "pass";
    elList.hidden = screen !== "list";
    elForm.hidden = !showForm;

    if (screen === "pass") { elTitle.textContent = "Digital Bus Pass"; renderPass(); }
    else if (screen === "list") { elTitle.textContent = "Buspass Request Status"; renderList(); }
    else if (screen === "add") { elTitle.textContent = "Apply Bus Pass"; editingId = null; renderForm(null); }
    else if (screen === "edit") {
      var p = byId(activeId);
      if (!p) { toast("No pass to edit"); return go("add"); }
      elTitle.textContent = "Edit Bus Pass"; editingId = p.id; renderForm(p);
    }

    updateGreet();
    var links = drawer.querySelectorAll("nav a");
    for (var i = 0; i < links.length; i++) {
      var n = links[i].getAttribute("data-nav");
      links[i].classList.toggle("active",
        n === screen || (n === "add" && screen === "edit") || (n === "list" && screen === "list"));
    }
    elPass.scrollTop = elList.scrollTop = elForm.scrollTop = 0;
  }

  function updateGreet() {
    var p = byId(activeId);
    document.getElementById("drawerGreet").textContent = "Hi, " + ((p && p.name) || "Employee");
  }

  /* ===================================================================== */
  /*  Screen: Bus Pass view                                                */
  /* ===================================================================== */
  function renderPass() {
    var p = byId(activeId);
    if (!p) {
      elPass.innerHTML =
        '<div class="empty-state">' +
          '<svg><use href="#i-bus"/></svg>' +
          '<p>Bus pass does not exist. You can apply for a bus pass to avail bus services.</p>' +
          '<button class="btn btn-primary" style="max-width:220px;flex:none" data-nav="add">Apply Bus Pass</button>' +
        '</div>';
      return;
    }

    var rt = ROUTE_TYPES[p.routeType] || ROUTE_TYPES.Both;
    var both = rt.showIn && rt.showOut;
    var times = "";
    if (both) {
      times = '<div class="route-times both">' +
        '<span>Office In - ' + esc(p.officeIn || "-") + '</span>' +
        '<span>Office Out - ' + esc(p.officeOut || "-") + '</span></div>';
    } else if (rt.showIn) {
      times = '<div class="route-times"><span>Office In - ' + esc(p.officeIn || "-") + '</span></div>';
    } else if (rt.showOut) {
      times = '<div class="route-times"><span>Office Out - ' + esc(p.officeOut || "-") + '</span></div>';
    }

    var busSeat = "";
    if (p.busNumber || p.seatNumber) {
      busSeat =
        '<div class="bus-seat-row">' +
          '<div class="bus-no"><div class="lbl">Bus Number</div><div class="val">' + esc(p.busNumber || "-") + '</div></div>' +
          (p.seatNumber ? '<div class="seat-badge"><svg><use href="#i-seat"/></svg>' + esc(p.seatNumber) + '</div>' : "") +
        '</div>';
    }

    elPass.innerHTML =
      '<section class="route-card">' +
        '<div class="stop">' + esc(p.startPoint || "-") + '</div>' +
        '<div class="route-arrow"><svg style="color:#fff"><use href="#i-swap"/></svg></div>' +
        '<div class="stop">' + esc(p.location || "-") + '</div>' +
        times +
      '</section>' +

      '<section class="pass-card">' +
        '<div class="pass-heading">Confirmed Bus Pass</div>' +
        '<hr class="dotted" />' +

        '<div class="face face-details">' +
          '<div class="detail-grid">' +
            cell("Name", p.name) + cell("Employee ID", p.empId, true) +
            cell("Bus Stop Name", p.busStop) + cell("Route Type", rt.label, true) +
            cell("Start Date", fmtDate(p.startDate)) + cell("End Date", fmtDate(p.endDate), true) +
          '</div>' +
          (p.routeName ? '<div class="route-name">Route : ' + esc(p.routeName) + '</div>' : "") +
          busSeat +
        '</div>' +

        '<div class="face face-qr qr-face" hidden>' +
          '<div class="qr-box"></div>' +
        '</div>' +

        '<button class="toggle-btn" id="toggleBtn">' + (qrMode ? "View Details" : "View QR") + '</button>' +
      '</section>' +

      '<div class="brand-footer"><img src="assets/tcs_logo.png" alt="TATA Consultancy Services" /></div>';

    applyFace(p);
    document.getElementById("toggleBtn").onclick = function () {
      qrMode = !qrMode;
      this.textContent = qrMode ? "View Details" : "View QR";
      applyFace(p);
    };
  }

  function cell(lbl, val, right) {
    return '<div class="cell' + (right ? " right" : "") + '">' +
      '<div class="lbl">' + esc(lbl) + '</div><div class="val">' + esc(val || "-") + '</div></div>';
  }

  function applyFace(p) {
    var d = elPass.querySelector(".face-details");
    var q = elPass.querySelector(".face-qr");
    if (!d || !q) return;
    d.hidden = qrMode;
    q.hidden = !qrMode;
    if (qrMode) renderQR(p, q.querySelector(".qr-box"));
  }

  function renderQR(p, box) {
    if (!box) return;
    var payload = {
      busPassType: "C", requestId: p.id, empCode: p.empId, empName: p.name,
      tripType: p.routeType, busStop: p.busStop, routeName: p.routeName,
      pickTiming: p.officeIn, dropTiming: p.officeOut,
      startDate: p.startDate, endDate: p.endDate, ts: Date.now()
    };
    try {
      var qr = qrcode(0, "M");
      qr.addData(JSON.stringify(payload));
      qr.make();
      // Vector output: fills the card at any screen size and stays crisp, so
      // scanners read it reliably (a scaled bitmap loses whole module rows).
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
    } catch (e) { box.textContent = "Unable to render QR"; }
  }

  /* ===================================================================== */
  /*  Screen: Buspass Request Status (manage passes)                       */
  /* ===================================================================== */
  function renderList() {
    if (!passes.length) {
      elList.innerHTML =
        '<div class="empty-state"><svg><use href="#i-status"/></svg>' +
          '<p>No bus passes yet.</p>' +
          '<button class="btn btn-primary" style="max-width:220px;flex:none" data-nav="add">Apply Bus Pass</button>' +
        '</div>';
      return;
    }
    var html = '<div class="list-screen">';
    passes.forEach(function (p) {
      var rt = (ROUTE_TYPES[p.routeType] || {}).label || p.routeType || "";
      html +=
        '<div class="list-item' + (p.id === activeId ? " active" : "") + '" data-open="' + p.id + '">' +
          '<div class="li-main">' +
            '<div class="li-route">' + esc(p.startPoint || "-") + ' &rarr; ' + esc(p.location || "-") + '</div>' +
            '<div class="li-sub">' + esc(p.name || "-") + ' &middot; Emp ' + esc(p.empId || "-") + '</div>' +
          '</div>' +
          '<span class="li-badge">' + esc(rt) + '</span>' +
          '<div class="li-actions">' +
            '<button class="icon-btn" title="Edit" data-edit="' + p.id + '"><svg><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn danger" title="Delete" data-del="' + p.id + '"><svg><use href="#i-trash"/></svg></button>' +
          '</div>' +
        '</div>';
    });
    html += '<button class="btn btn-primary list-add" data-nav="add">+ Apply New Bus Pass</button>';
    html += '</div>';
    elList.innerHTML = html;
  }

  /* ===================================================================== */
  /*  Screen: Add / Edit form                                              */
  /* ===================================================================== */
  function field(id, label, val, type, attrs) {
    return '<div class="field"><label for="f_' + id + '">' + esc(label) + '</label>' +
      '<input id="f_' + id + '" type="' + (type || "text") + '" value="' + esc(val || "") + '" ' + (attrs || "") + ' /></div>';
  }

  function renderForm(p) {
    p = p || {};
    var rt = p.routeType || "Both";
    var opts = Object.keys(ROUTE_TYPES).map(function (k) {
      return '<option value="' + k + '"' + (k === rt ? " selected" : "") + '>' + esc(ROUTE_TYPES[k].label) + '</option>';
    }).join("");

    elForm.innerHTML =
      '<form class="form-screen" id="passForm" novalidate>' +
        '<div class="section-label">Employee</div>' +
        field("name", "Name", p.name) +
        field("empId", "Employee ID", p.empId) +

        '<div class="section-label">Route</div>' +
        field("startPoint", "Start Point", p.startPoint) +
        field("location", "Destination / Location", p.location) +
        field("busStop", "Bus Stop Name", p.busStop) +
        '<div class="field"><label for="f_routeType">Route Type</label><select id="f_routeType">' + opts + '</select></div>' +
        field("routeName", "Route (shown as “Route : …”)", p.routeName) +

        '<div class="section-label">Timings</div>' +
        '<div class="field-row">' +
          field("officeIn", "Office In Time", p.officeIn, "time") +
          field("officeOut", "Office Out Time", p.officeOut, "time") +
        '</div>' +
        '<div class="field-row">' +
          field("startDate", "Start Date", p.startDate, "date") +
          field("endDate", "End Date", p.endDate, "date") +
        '</div>' +

        '<div class="section-label">Bus (optional)</div>' +
        '<div class="field-row">' +
          field("busNumber", "Bus Number", p.busNumber) +
          field("seatNumber", "Seat Number", p.seatNumber) +
        '</div>' +

        '<div class="form-actions">' +
          '<button type="button" class="btn btn-ghost" id="cancelBtn">Cancel</button>' +
          '<button type="submit" class="btn btn-primary">' + (editingId ? "Save Changes" : "Add Pass") + '</button>' +
        '</div>' +
      '</form>';

    document.getElementById("cancelBtn").onclick = function () { go(editingId ? "pass" : "list"); };
    document.getElementById("passForm").onsubmit = function (e) { e.preventDefault(); submitForm(); };
  }

  function val(id) { var el = document.getElementById("f_" + id); return el ? el.value.trim() : ""; }

  function submitForm() {
    var data = {
      name: val("name"), empId: val("empId"),
      startPoint: val("startPoint"), location: val("location"), busStop: val("busStop"),
      routeType: val("routeType"), routeName: val("routeName"),
      officeIn: val("officeIn"), officeOut: val("officeOut"),
      startDate: val("startDate"), endDate: val("endDate"),
      busNumber: val("busNumber"), seatNumber: val("seatNumber")
    };
    if (!data.name || !data.startPoint || !data.location) {
      return toast("Name, Start Point and Destination are required");
    }
    if (editingId) {
      var p = byId(editingId);
      if (p) for (var k in data) p[k] = data[k];
      save(); toast("Bus pass updated");
    } else {
      data.id = uid(); passes.push(data); activeId = data.id; save(); toast("Bus pass added");
    }
    go("pass");
  }

  function deletePass(id) {
    var p = byId(id);
    if (!p) return;
    if (!window.confirm("Delete this bus pass?\n\n" + (p.startPoint || "") + " → " + (p.location || ""))) return;
    passes = passes.filter(function (x) { return x.id !== id; });
    if (activeId === id) activeId = passes.length ? passes[0].id : null;
    save(); toast("Bus pass deleted"); renderList();
  }

  /* ===================================================================== */
  /*  Events                                                               */
  /* ===================================================================== */
  function openDrawer() { updateGreet(); drawer.classList.add("open"); scrim.classList.add("open"); }
  function closeDrawer() { drawer.classList.remove("open"); scrim.classList.remove("open"); }

  document.getElementById("menuBtn").onclick = openDrawer;
  scrim.onclick = closeDrawer;
  document.getElementById("bellBtn").onclick = function () { toast("Notifications are not part of this demo"); };

  // welcome service pills
  welcome.addEventListener("click", function (e) {
    var pill = e.target.closest("[data-service]");
    if (!pill) return;
    var s = pill.getAttribute("data-service");
    if (s === "bus") { qrMode = false; go("pass"); }
    else if (s === "cab") toast("Cab Services are not part of this demo");
    else toast("Geocode Yourself is not part of this demo");
  });

  drawer.addEventListener("click", function (e) {
    var a = e.target.closest("[data-nav]");
    if (a) { e.preventDefault(); go(a.getAttribute("data-nav")); }
  });

  app.addEventListener("click", function (e) {
    var nav = e.target.closest("[data-nav]");
    if (nav) { go(nav.getAttribute("data-nav")); return; }
    var del = e.target.closest("[data-del]");
    if (del) { e.stopPropagation(); deletePass(del.getAttribute("data-del")); return; }
    var ed = e.target.closest("[data-edit]");
    if (ed) { e.stopPropagation(); activeId = ed.getAttribute("data-edit"); save(); go("edit"); return; }
    var open = e.target.closest("[data-open]");
    if (open) { activeId = open.getAttribute("data-open"); qrMode = false; save(); go("pass"); return; }
  });

  /* ----- Toast ---------------------------------------------------------- */
  var toastEl = document.getElementById("toast"), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  /* ----- Boot ----------------------------------------------------------- */
  updateGreet();
  go("welcome");
})();
