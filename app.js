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
const photoThumb = document.getElementById("photoThumb");
const photoFilename = document.getElementById("photoFilename");
const photoRemoveBtn = document.getElementById("photoRemoveBtn");
const wieBenJijAndersWrap = document.getElementById("wieBenJijAndersWrap");
const wieBenJijAndersInput = document.getElementById("wieBenJijAnders");
const klantAndersWrap = document.getElementById("klantAndersWrap");
const klantAndersInput = document.getElementById("klantAnders");

let photoPreviewUrl = null;

function clearPhoto() {
  photoInput.value = "";
  if (photoPreviewUrl) {
    URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = null;
  }
  photoConfirm.hidden = true;
  photoHint.textContent = "Tik om een foto te maken of te kiezen";
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (photoPreviewUrl) {
    URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = null;
  }
  if (!file) {
    photoConfirm.hidden = true;
    photoHint.textContent = "Tik om een foto te maken of te kiezen";
    return;
  }
  photoPreviewUrl = URL.createObjectURL(file);
  photoThumb.src = photoPreviewUrl;
  photoFilename.textContent = file.name;
  photoConfirm.hidden = false;
  photoHint.textContent = "Andere foto kiezen";
});

photoRemoveBtn.addEventListener("click", clearPhoto);

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
const tabBonBtn = document.getElementById("tabBonBtn");
const tabOverzichtBtn = document.getElementById("tabOverzichtBtn");
const tabBonPanel = document.getElementById("tabBon");
const tabOverzichtPanel = document.getElementById("tabOverzicht");

function selectTab(name) {
  const isBon = name === "bon";
  tabBonBtn.classList.toggle("active", isBon);
  tabOverzichtBtn.classList.toggle("active", !isBon);
  tabBonBtn.setAttribute("aria-selected", String(isBon));
  tabOverzichtBtn.setAttribute("aria-selected", String(!isBon));
  tabBonPanel.hidden = !isBon;
  tabOverzichtPanel.hidden = isBon;
}

tabBonBtn.addEventListener("click", () => selectTab("bon"));
tabOverzichtBtn.addEventListener("click", () => selectTab("overzicht"));

// --- Overzicht opvragen ---
const overzichtForm = document.getElementById("overzichtForm");
const overzichtSubmitBtn = document.getElementById("overzichtSubmitBtn");
const overzichtStatusMsg = document.getElementById("overzichtStatusMsg");
const startdatumInput = document.getElementById("startdatum");
const einddatumInput = document.getElementById("einddatum");
const medewerkerSelect = document.getElementById("medewerker");
const overzichtKlantSelect = document.getElementById("overzichtKlant");
const emailInput = document.getElementById("email");

fillSelect(medewerkerSelect, ["Alle medewerkers", ...CONFIG.employees]);
fillSelect(overzichtKlantSelect, ["Alle klanten", ...CONFIG.clients]);

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

  overzichtSubmitBtn.disabled = true;
  const stopVoortgang = startOverzichtVoortgang();
  try {
    const res = await fetch(CONFIG.overviewFlowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Startdatum: startdatum.iso,
        Einddatum: einddatum.iso,
        Medewerker: medewerkerSelect.value === "Alle medewerkers" ? "" : medewerkerSelect.value,
        Klant: overzichtKlantSelect.value === "Alle klanten" ? "" : overzichtKlantSelect.value,
        Email: emailInput.value,
      }),
    });

    if (!res.ok) throw new Error("serverfout (" + res.status + ")");

    stopVoortgang();
    setOverzichtStatus("Overzicht wordt gegenereerd, je ontvangt zo een e-mail.", "success");
    overzichtForm.reset();
    fillSelect(medewerkerSelect, ["Alle medewerkers", ...CONFIG.employees]);
    fillSelect(overzichtKlantSelect, ["Alle klanten", ...CONFIG.clients]);
  } catch (err) {
    stopVoortgang();
    setOverzichtStatus("Er ging iets mis: " + err.message, "error");
  } finally {
    overzichtSubmitBtn.disabled = false;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.getElementById("photo").files[0];
  if (!file) {
    setStatus("Kies eerst een foto.");
    return;
  }

  const submittedBy = resolveWithAnders(wieBenJijSelect, wieBenJijAndersInput);
  if (!submittedBy) {
    setStatus("Vul je naam in.", "error");
    return;
  }
  const klant = resolveWithAnders(klantSelect, klantAndersInput);
  if (!klant) {
    setStatus("Vul de klantnaam in.", "error");
    return;
  }

  submitBtn.disabled = true;
  try {
    setStatus("Foto comprimeren...");
    const photoBase64 = await compressImageToBase64(file, 1600, 0.7);

    setStatus("Bezig met versturen...");
    const res = await fetch(CONFIG.flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SubmittedBy: submittedBy,
        Categorie: categorieSelect.value,
        Toelichting: document.getElementById("toelichting").value,
        Klant: klant,
        FileName: `${Date.now()}.jpg`,
        PhotoBase64: photoBase64,
      }),
    });

    if (!res.ok) throw new Error("serverfout (" + res.status + ")");

    setStatus("Bon verstuurd, bedankt!", "success");
    form.reset();
    fillSelect(wieBenJijSelect, [...CONFIG.employees, "Anders"]);
    fillSelect(categorieSelect, CONFIG.categories);
    fillSelect(klantSelect, [...CONFIG.clients, "Anders"]);
    toelichtingWrap.hidden = true;
    wieBenJijAndersWrap.hidden = true;
    wieBenJijAndersInput.value = "";
    klantAndersWrap.hidden = true;
    klantAndersInput.value = "";
    clearPhoto();
  } catch (err) {
    setStatus("Er ging iets mis: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});
