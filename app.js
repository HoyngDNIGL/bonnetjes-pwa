const form = document.getElementById("form");
const wieBenJijSelect = document.getElementById("wieBenJij");
const categorieSelect = document.getElementById("categorie");
const toelichtingWrap = document.getElementById("toelichtingWrap");
const klantSelect = document.getElementById("klant");
const submitBtn = document.getElementById("submitBtn");
const statusMsg = document.getElementById("statusMsg");
const photoInput = document.getElementById("photo");
const photoHint = document.getElementById("photoHint");
const photoConfirm = document.getElementById("photoConfirm");
const wieBenJijAndersWrap = document.getElementById("wieBenJijAndersWrap");
const wieBenJijAndersInput = document.getElementById("wieBenJijAnders");
const wieBenJijAndersEmailInput = document.getElementById("wieBenJijAndersEmail");
const klantAndersWrap = document.getElementById("klantAndersWrap");
const klantAndersInput = document.getElementById("klantAnders");

// Meerdere foto's tegelijk indienen (bv. een stapel bonnetjes van één
// reis) -- allemaal met dezelfde Wie ben jij/Categorie/Klant/Toelichting,
// maar elk als eigen item in Bonnetjes. Los bijgehouden van
// photoInput.files, want een native FileList kun je niet los bewerken
// (geen enkel item verwijderen zonder alles opnieuw te kiezen).
let selectedFiles = [];
let photoPreviewUrls = [];

function renderPhotoPreviews() {
  photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  photoPreviewUrls = [];

  if (!selectedFiles.length) {
    photoConfirm.hidden = true;
    photoConfirm.innerHTML = "";
    photoHint.textContent = "Tik om een of meerdere foto's te maken of te kiezen";
    return;
  }

  photoHint.textContent = "Andere foto('s) kiezen";
  photoConfirm.hidden = false;
  photoConfirm.innerHTML = selectedFiles.map((file, i) => {
    const url = URL.createObjectURL(file);
    photoPreviewUrls.push(url);
    return `
      <div class="photo-confirm-item">
        <img src="${url}" alt="" class="photo-thumb">
        <span class="photo-check">&#10003;</span>
        <span class="photo-filename">${escapeHtml(file.name)}</span>
        <button type="button" class="photo-remove" data-index="${i}" aria-label="Foto verwijderen">&times;</button>
      </div>
    `;
  }).join("");
}

function clearAllPhotos() {
  selectedFiles = [];
  photoInput.value = "";
  renderPhotoPreviews();
}

photoInput.addEventListener("change", () => {
  selectedFiles = Array.from(photoInput.files);
  renderPhotoPreviews();
});

photoConfirm.addEventListener("click", (e) => {
  const btn = e.target.closest(".photo-remove");
  if (!btn) return;
  selectedFiles.splice(parseInt(btn.dataset.index, 10), 1);
  renderPhotoPreviews();
});

function setStatus(text, state) {
  statusMsg.textContent = text;
  if (state) {
    statusMsg.dataset.state = state;
  } else {
    delete statusMsg.dataset.state;
  }
}

function fillSelect(select, values) {
  select.innerHTML = values.map((v) => `<option value="${v}">${v}</option>`).join("");
}

fillSelect(wieBenJijSelect, [...CONFIG.employees, "Anders"]);
fillSelect(categorieSelect, CONFIG.categories);
fillSelect(klantSelect, [...CONFIG.clients, "Anders"]);

categorieSelect.addEventListener("change", () => {
  toelichtingWrap.hidden = categorieSelect.value !== "Anders";
});

wieBenJijSelect.addEventListener("change", () => {
  wieBenJijAndersWrap.hidden = wieBenJijSelect.value !== "Anders";
});

klantSelect.addEventListener("change", () => {
  klantAndersWrap.hidden = klantSelect.value !== "Anders";
});

// Normalizes free-typed names so "niels", "NIELS" and "Niels" all become
// the same string -- otherwise casing typos would create separate
// "people"/"clients" downstream instead of matching the existing one.
function titleCase(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Returns the select's value, or the free-text "Anders" field's value
// (title-cased) when "Anders" is chosen -- the flow always receives a
// plain name/client string either way, no special-casing needed downstream.
function resolveWithAnders(select, andersInput) {
  return select.value === "Anders" ? titleCase(andersInput.value) : select.value;
}

// E-mailadres voor de "Needs EUR amount"-notificatie: bij een vaste
// medewerker uit CONFIG.employeeEmails, bij "Anders" het handmatig
// ingevulde adres.
function resolveSubmittedByEmail(select, andersEmailInput) {
  if (select.value === "Anders") return andersEmailInput.value.trim();
  return CONFIG.employeeEmails[select.value] || "";
}

// Resizes to maxDim on the long edge and returns just the base64 payload
// (no "data:image/jpeg;base64," prefix) at the given JPEG quality.
function compressImageToBase64(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height >= width && height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = () => reject(new Error("kon foto niet lezen"));
    img.src = url;
  });
}

// --- Tabs ---
const tabButtons = {
  bon: document.getElementById("tabBonBtn"),
  overzicht: document.getElementById("tabOverzichtBtn"),
  uitbetaal: document.getElementById("tabUitbetaalBtn"),
};
const tabPanels = {
  bon: document.getElementById("tabBon"),
  overzicht: document.getElementById("tabOverzicht"),
  uitbetaal: document.getElementById("tabUitbetaal"),
};

function selectTab(name) {
  for (const key of Object.keys(tabButtons)) {
    const active = key === name;
    tabButtons[key].classList.toggle("active", active);
    tabButtons[key].setAttribute("aria-selected", String(active));
    tabPanels[key].hidden = !active;
  }
}

for (const key of Object.keys(tabButtons)) {
  tabButtons[key].addEventListener("click", () => selectTab(key));
}

// --- Overzicht opvragen ---
const overzichtForm = document.getElementById("overzichtForm");
const overzichtSubmitBtn = document.getElementById("overzichtSubmitBtn");
const overzichtStatusMsg = document.getElementById("overzichtStatusMsg");
const startdatumInput = document.getElementById("startdatum");
const einddatumInput = document.getElementById("einddatum");
const medewerkerSelect = document.getElementById("medewerker");
const overzichtKlantSelect = document.getElementById("overzichtKlant");
const medewerkerWrap = document.getElementById("medewerkerWrap");
const overzichtKlantWrap = document.getElementById("overzichtKlantWrap");
const filterTypeRadios = document.querySelectorAll('input[name="filterType"]');
const emailInput = document.getElementById("email");

fillSelect(medewerkerSelect, CONFIG.employees);
fillSelect(overzichtKlantSelect, CONFIG.clients);

// Medewerker and Klant are mutually exclusive filters -- only one select
// shows at a time, so it's never ambiguous which one actually applies.
function updateFilterTypeUI() {
  const active = document.querySelector('input[name="filterType"]:checked').value;
  medewerkerWrap.hidden = active !== "medewerker";
  overzichtKlantWrap.hidden = active !== "klant";
}
filterTypeRadios.forEach((radio) => radio.addEventListener("change", updateFilterTypeUI));
updateFilterTypeUI();

// Auto-inserts dashes as the user types digits, so the field always reads
// dd-mm-jjjj regardless of the device's locale settings (unlike a native
// <input type="date">, whose displayed/typed format follows the OS
// language and can silently swap day/month).
function formatDatumInput(e) {
  const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
  let out = digits;
  if (digits.length > 4) out = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  else if (digits.length > 2) out = `${digits.slice(0, 2)}-${digits.slice(2)}`;
  e.target.value = out;
}
startdatumInput.addEventListener("input", formatDatumInput);
einddatumInput.addEventListener("input", formatDatumInput);

// Parses a strict dd-mm-jjjj string, rejecting both malformed input and
// calendar-invalid dates (e.g. 31-02-2026) -- returns null for either.
function parseDutchDate(value) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return { iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

function setOverzichtStatus(text, state) {
  overzichtStatusMsg.textContent = text;
  if (state) {
    overzichtStatusMsg.dataset.state = state;
  } else {
    delete overzichtStatusMsg.dataset.state;
  }
}

// Steps through a few plausible-sounding stages once, then holds on the
// last one until the request actually finishes -- there's no real
// progress info coming back from the flow (one HTTP call, one response),
// this is purely so the wait doesn't look frozen. Doesn't loop back to
// the start. Returns a function that stops it.
function startOverzichtVoortgang() {
  const stappen = ["Bonnetjes zoeken...", "Overzicht maken...", "Mail versturen..."];
  let i = 0;
  let timer = null;
  setOverzichtStatus(stappen[0]);
  function volgende() {
    i++;
    if (i >= stappen.length) return;
    setOverzichtStatus(stappen[i]);
    timer = setTimeout(volgende, 2500);
  }
  timer = setTimeout(volgende, 2500);
  return () => clearTimeout(timer);
}

overzichtForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!CONFIG.overviewFlowUrl) {
    setOverzichtStatus("Overzicht-flow is nog niet gekoppeld (overviewFlowUrl ontbreekt in config.js).", "error");
    return;
  }
  const startdatum = parseDutchDate(startdatumInput.value);
  const einddatum = parseDutchDate(einddatumInput.value);
  if (!startdatum || !einddatum) {
    setOverzichtStatus("Vul een geldige datum in (dd-mm-jjjj).", "error");
    return;
  }
  if (einddatum.iso < startdatum.iso) {
    setOverzichtStatus("Einddatum ligt voor de startdatum.", "error");
    return;
  }

  const filterType = document.querySelector('input[name="filterType"]:checked').value;

  overzichtSubmitBtn.disabled = true;
  const stopVoortgang = startOverzichtVoortgang();
  try {
    const res = await fetch(CONFIG.overviewFlowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Startdatum: startdatum.iso,
        Einddatum: einddatum.iso,
        Medewerker: filterType === "medewerker" ? medewerkerSelect.value : "",
        Klant: filterType === "klant" ? overzichtKlantSelect.value : "",
        Email: emailInput.value,
      }),
    });

    if (!res.ok) throw new Error("serverfout (" + res.status + ")");

    stopVoortgang();
    setOverzichtStatus("Overzicht wordt gegenereerd, je ontvangt zo een e-mail.", "success");
    overzichtForm.reset();
    fillSelect(medewerkerSelect, CONFIG.employees);
    fillSelect(overzichtKlantSelect, CONFIG.clients);
    updateFilterTypeUI();
  } catch (err) {
    stopVoortgang();
    setOverzichtStatus("Er ging iets mis: " + err.message, "error");
  } finally {
    overzichtSubmitBtn.disabled = false;
  }
});

// --- Uitbetaalronde (Flow 4) ---
// Pincode is puur een drempel tegen per-ongeluk-klikken door de 3
// medewerkers, geen echte beveiliging -- staat gewoon leesbaar in deze
// broncode, net als de rest van de configuratie. Voor dit team en dit
// risiconiveau (geen login op de hele app, zie config.js) is dat bewust
// voldoende.
const pinCijfers = Array.from(document.querySelectorAll(".pin-cijfer"));
const pincodeWrap = document.getElementById("pincodeWrap");
const pincodeStatusMsg = document.getElementById("pincodeStatusMsg");
const uitbetaalActieWrap = document.getElementById("uitbetaalActieWrap");
const uitbetaalSubmitBtn = document.getElementById("uitbetaalSubmitBtn");
const uitbetaalStatusMsg = document.getElementById("uitbetaalStatusMsg");
const bonnetjesLijst = document.getElementById("bonnetjesLijst");
const selecteerAllesBtn = document.getElementById("selecteerAllesBtn");
const deselecteerAllesBtn = document.getElementById("deselecteerAllesBtn");

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

async function laadBonnetjesLijst() {
  bonnetjesLijst.innerHTML = '<p class="bon-lijst-empty">Bonnetjes laden...</p>';
  if (!CONFIG.listFlowUrl) {
    bonnetjesLijst.innerHTML = '<p class="bon-lijst-empty">listFlowUrl ontbreekt in config.js.</p>';
    return;
  }
  try {
    const res = await fetch(CONFIG.listFlowUrl, { method: "POST" });
    if (!res.ok) throw new Error("serverfout (" + res.status + ")");
    const items = await res.json();
    if (!items.length) {
      bonnetjesLijst.innerHTML = '<p class="bon-lijst-empty">Geen openstaande bonnetjes gevonden.</p>';
      return;
    }
    bonnetjesLijst.innerHTML = items.map((item) => `
      <label class="bon-checkbox">
        <input type="checkbox" class="bon-check" value="${item.ID}" checked>
        <span>
          <div class="bon-checkbox-main">${escapeHtml(item.Vendor)} &middot; &euro; ${escapeHtml(item.AmountEUR)}</div>
          <div class="bon-checkbox-sub">${escapeHtml(item.ReceiptDate)} &middot; ${escapeHtml(item.SubmittedBy || "onbekend")}</div>
        </span>
      </label>
    `).join("");
  } catch (err) {
    bonnetjesLijst.innerHTML = `<p class="bon-lijst-empty">Kon de lijst niet laden: ${escapeHtml(err.message)}</p>`;
  }
}

selecteerAllesBtn.addEventListener("click", () => {
  bonnetjesLijst.querySelectorAll(".bon-check").forEach((cb) => { cb.checked = true; });
});
deselecteerAllesBtn.addEventListener("click", () => {
  bonnetjesLijst.querySelectorAll(".bon-check").forEach((cb) => { cb.checked = false; });
});

// Individuele pincode-vakjes die vanzelf doorschakelen en automatisch
// controleren zodra alle vakjes gevuld zijn (zoals een telefoon-pincode),
// i.p.v. één tekstveld met een aparte "Ontgrendelen"-knop.
function checkPincode() {
  const waarde = pinCijfers.map((el) => el.value).join("");
  if (waarde.length < pinCijfers.length) return;

  if (waarde === CONFIG.uitbetaalPincode) {
    pincodeWrap.hidden = true;
    uitbetaalActieWrap.hidden = false;
    laadBonnetjesLijst();
  } else {
    pincodeStatusMsg.textContent = "Onjuiste pincode.";
    pincodeStatusMsg.dataset.state = "error";
    pinCijfers.forEach((el) => {
      el.value = "";
      el.dataset.error = "true";
    });
    pinCijfers[0].focus();
    setTimeout(() => pinCijfers.forEach((el) => delete el.dataset.error), 300);
  }
}

pinCijfers.forEach((el, i) => {
  el.addEventListener("input", () => {
    el.value = el.value.replace(/\D/g, "").slice(0, 1);
    delete pincodeStatusMsg.dataset.state;
    pincodeStatusMsg.textContent = "";
    if (el.value && i < pinCijfers.length - 1) {
      pinCijfers[i + 1].focus();
    }
    checkPincode();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !el.value && i > 0) {
      pinCijfers[i - 1].focus();
    }
  });
});

uitbetaalSubmitBtn.addEventListener("click", async () => {
  if (!CONFIG.flow4Url) {
    uitbetaalStatusMsg.textContent = "Uitbetaalronde-flow is nog niet gekoppeld (flow4Url ontbreekt in config.js).";
    uitbetaalStatusMsg.dataset.state = "error";
    return;
  }

  const geselecteerdeIds = Array.from(bonnetjesLijst.querySelectorAll(".bon-check:checked"))
    .map((cb) => parseInt(cb.value, 10));
  if (!geselecteerdeIds.length) {
    uitbetaalStatusMsg.textContent = "Selecteer eerst minstens één bonnetje.";
    uitbetaalStatusMsg.dataset.state = "error";
    return;
  }

  uitbetaalSubmitBtn.disabled = true;
  uitbetaalStatusMsg.textContent = "Uitbetaalronde wordt gestart...";
  delete uitbetaalStatusMsg.dataset.state;
  try {
    const res = await fetch(CONFIG.flow4Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ItemIds: geselecteerdeIds }),
    });
    if (!res.ok) throw new Error("serverfout (" + res.status + ")");
    uitbetaalStatusMsg.textContent = "Uitbetaalronde gestart -- je ontvangt zo het overzicht per e-mail.";
    uitbetaalStatusMsg.dataset.state = "success";
  } catch (err) {
    uitbetaalStatusMsg.textContent = "Er ging iets mis: " + err.message;
    uitbetaalStatusMsg.dataset.state = "error";
  } finally {
    uitbetaalSubmitBtn.disabled = false;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedFiles.length) {
    setStatus("Kies eerst minstens één foto.");
    return;
  }

  const submittedBy = resolveWithAnders(wieBenJijSelect, wieBenJijAndersInput);
  if (!submittedBy) {
    setStatus("Vul je naam in.", "error");
    return;
  }
  const submittedByEmail = resolveSubmittedByEmail(wieBenJijSelect, wieBenJijAndersEmailInput);
  if (!submittedByEmail || !submittedByEmail.includes("@")) {
    setStatus("Vul een geldig e-mailadres in.", "error");
    return;
  }
  const klant = resolveWithAnders(klantSelect, klantAndersInput);
  if (!klant) {
    setStatus("Vul de klantnaam in.", "error");
    return;
  }

  submitBtn.disabled = true;
  const teVersturen = selectedFiles;
  const opnieuwProberen = [];
  let gelukt = 0;

  try {
    for (let i = 0; i < teVersturen.length; i++) {
      const file = teVersturen[i];
      setStatus(teVersturen.length > 1
        ? `Bonnetje ${i + 1} van ${teVersturen.length} versturen...`
        : "Bezig met versturen...");
      try {
        const photoBase64 = await compressImageToBase64(file, 1600, 0.7);
        const res = await fetch(CONFIG.flowUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            SubmittedBy: submittedBy,
            SubmittedByEmail: submittedByEmail,
            Categorie: categorieSelect.value,
            Toelichting: document.getElementById("toelichting").value,
            Klant: klant,
            FileName: `${Date.now()}_${i}.jpg`,
            PhotoBase64: photoBase64,
          }),
        });
        if (!res.ok) throw new Error("serverfout (" + res.status + ")");
        gelukt++;
      } catch (err) {
        // Foto blijft in de lijst staan zodat je 'm zo opnieuw kan
        // proberen, zonder de al gelukte foto's nogmaals te versturen.
        opnieuwProberen.push(file);
      }
    }

    selectedFiles = opnieuwProberen;
    renderPhotoPreviews();

    if (!opnieuwProberen.length) {
      setStatus(gelukt === 1 ? "Bon verstuurd, bedankt!" : `${gelukt} bonnen verstuurd, bedankt!`, "success");
      form.reset();
      fillSelect(wieBenJijSelect, [...CONFIG.employees, "Anders"]);
      fillSelect(categorieSelect, CONFIG.categories);
      fillSelect(klantSelect, [...CONFIG.clients, "Anders"]);
      toelichtingWrap.hidden = true;
      wieBenJijAndersWrap.hidden = true;
      wieBenJijAndersInput.value = "";
      wieBenJijAndersEmailInput.value = "";
      klantAndersWrap.hidden = true;
      klantAndersInput.value = "";
      clearAllPhotos();
    } else {
      setStatus(`${gelukt} van ${teVersturen.length} bonnen verstuurd, ${opnieuwProberen.length} mislukt -- probeer de overgebleven foto('s) opnieuw.`, "error");
    }
  } finally {
    submitBtn.disabled = false;
  }
});
