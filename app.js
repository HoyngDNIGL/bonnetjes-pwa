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

// --- Bon-wizard: croppen (perspectief-correctie) / laden / controleren ---

// Standaard "unit-square naar quadrilateral"-projectie (Heckbert),
// gebruikt om een 3x3 projectiematrix te vinden die twee viervlakken op
// elkaar afbeeldt. m = [m0 m1 m2, m3 m4 m5, m6 m7 m8] (rij-majeur).
function adj3(m) {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}
function multmm(a, b) {
  const c = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[i * 3 + k] * b[k * 3 + j];
      c[i * 3 + j] = sum;
    }
  }
  return c;
}
function multmv(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}
function basisToPoints(x0, y0, x1, y1, x2, y2, x3, y3) {
  const m = [x0, x1, x2, y0, y1, y2, 1, 1, 1];
  const v = multmv(adj3(m), [x3, y3, 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
// Matrix die punt (x0s,y0s)..(x3s,y3s) afbeeldt op (x0d,y0d)..(x3d,y3d).
function general2DProjection(x0s, y0s, x1s, y1s, x2s, y2s, x3s, y3s, x0d, y0d, x1d, y1d, x2d, y2d, x3d, y3d) {
  const s = basisToPoints(x0s, y0s, x1s, y1s, x2s, y2s, x3s, y3s);
  const d = basisToPoints(x0d, y0d, x1d, y1d, x2d, y2d, x3d, y3d);
  return multmm(d, adj3(s));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// corners = [linksboven, rechtsboven, rechtsonder, linksonder], in
// natuurlijke pixelcoördinaten van de bron-afbeelding. Rekent de
// perspectief-correctie (hoeken "rechttrekken" naar een rechthoek, niet
// zomaar een rechte crop) pixel-voor-pixel uit met bilineaire sampling.
function warpPerspective(img, corners) {
  const [tl, tr, br, bl] = corners;
  const widthTop = dist(tl, tr);
  const widthBottom = dist(bl, br);
  const heightLeft = dist(tl, bl);
  const heightRight = dist(tr, br);
  let outW = Math.round((widthTop + widthBottom) / 2) || 1;
  let outH = Math.round((heightLeft + heightRight) / 2) || 1;
  const MAX_SIDE = 1500;
  const schaal = Math.min(1, MAX_SIDE / Math.max(outW, outH));
  outW = Math.max(200, Math.round(outW * schaal));
  outH = Math.max(200, Math.round(outH * schaal));

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.naturalWidth;
  srcCanvas.height = img.naturalHeight;
  srcCanvas.getContext("2d").drawImage(img, 0, 0);
  const srcCtx = srcCanvas.getContext("2d");
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;

  const destCanvas = document.createElement("canvas");
  destCanvas.width = outW;
  destCanvas.height = outH;
  const destCtx = destCanvas.getContext("2d");
  const destImgData = destCtx.createImageData(outW, outH);
  const destData = destImgData.data;

  // M beeldt een punt in het doel (rechthoek) af op de bijbehorende
  // (fractionele) positie in de bron -- zo kunnen we per doelpixel
  // "terugvragen" welke bronpixel erbij hoort (inverse sampling).
  const M = general2DProjection(
    0, 0, outW, 0, outW, outH, 0, outH,
    tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
  );

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const w = M[6] * dx + M[7] * dy + M[8];
      const sx = (M[0] * dx + M[1] * dy + M[2]) / w;
      const sy = (M[3] * dx + M[4] * dy + M[5]) / w;
      const di = (dy * outW + dx) * 4;
      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const fx = sx - x0;
        const fy = sy - y0;
        const i00 = (y0 * srcW + x0) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + srcW * 4;
        const i11 = i01 + 4;
        for (let c = 0; c < 4; c++) {
          const top = srcData[i00 + c] + (srcData[i10 + c] - srcData[i00 + c]) * fx;
          const bottom = srcData[i01 + c] + (srcData[i11 + c] - srcData[i01 + c]) * fx;
          destData[di + c] = top + (bottom - top) * fy;
        }
      } else {
        destData[di + 3] = 255;
        destData[di] = destData[di + 1] = destData[di + 2] = 255;
      }
    }
  }
  destCtx.putImageData(destImgData, 0, 0);
  return destCanvas;
}

function canvasToJpegFile(canvas, filename, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(new File([blob], filename, { type: "image/jpeg" })), "image/jpeg", quality);
  });
}

const wizardOverlay = document.getElementById("wizardOverlay");
const wizardProgress = document.getElementById("wizardProgress");
const wizardStatusMsg = document.getElementById("wizardStatusMsg");
const stepCrop = document.getElementById("stepCrop");
const stepLoading = document.getElementById("stepLoading");
const stepConfirm = document.getElementById("stepConfirm");
const cropStage = document.getElementById("cropStage");
const cropImage = document.getElementById("cropImage");
const cropPoly = document.getElementById("cropPoly");
const cropHandles = Array.from(document.querySelectorAll(".crop-handle"));
const cropSkipBtn = document.getElementById("cropSkipBtn");
const cropConfirmBtn = document.getElementById("cropConfirmBtn");
const wizardLoadingText = document.getElementById("wizardLoadingText");
const confirmThumb = document.getElementById("confirmThumb");
const confirmAmount = document.getElementById("confirmAmount");
const confirmCurrency = document.getElementById("confirmCurrency");
const confirmVendor = document.getElementById("confirmVendor");
const confirmDate = document.getElementById("confirmDate");
const confirmKlant = document.getElementById("confirmKlant");
const confirmMedewerker = document.getElementById("confirmMedewerker");
const confirmRetryBtn = document.getElementById("confirmRetryBtn");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");

function showWizardStep(name) {
  stepCrop.hidden = name !== "crop";
  stepLoading.hidden = name !== "loading";
  stepConfirm.hidden = name !== "confirm";
  wizardStatusMsg.textContent = "";
  delete wizardStatusMsg.dataset.state;
}

function setWizardProgress(text) {
  wizardProgress.textContent = text;
}

function setWizardLoadingText(text) {
  wizardLoadingText.textContent = text;
}

function setWizardStatus(text, state) {
  wizardStatusMsg.textContent = text;
  if (state) wizardStatusMsg.dataset.state = state;
  else delete wizardStatusMsg.dataset.state;
}

// Positioneert de 4 sleep-handvaten + de blauwe polygoon-omtrek op basis
// van corners (in CSS-pixels t.o.v. cropStage).
function renderCropHandles(corners) {
  cropPoly.setAttribute("points", corners.map((c) => `${c.x},${c.y}`).join(" "));
  cropHandles.forEach((el, i) => {
    el.style.left = `${corners[i].x}px`;
    el.style.top = `${corners[i].y}px`;
  });
}

// Toont de crop-stap voor `file` en lost de returned promise op met het
// (evt.) bijgesneden bestand zodra de gebruiker bevestigt of overslaat.
function runCropStep(file) {
  return new Promise((resolve) => {
    showWizardStep("crop");
    const url = URL.createObjectURL(file);
    cropImage.src = url;

    let corners = null; // CSS-pixel-coördinaten t.o.v. cropStage
    let naturalToCss = 1;
    let offsetX = 0;
    let offsetY = 0;

    function initCorners() {
      const stageRect = cropStage.getBoundingClientRect();
      const iw = cropImage.naturalWidth;
      const ih = cropImage.naturalHeight;
      const scale = Math.min(stageRect.width / iw, stageRect.height / ih);
      const dispW = iw * scale;
      const dispH = ih * scale;
      offsetX = (stageRect.width - dispW) / 2;
      offsetY = (stageRect.height - dispH) / 2;
      naturalToCss = scale;
      const pad = 14; // iets binnen de rand, makkelijker beetpakken
      corners = [
        { x: offsetX + pad, y: offsetY + pad },
        { x: offsetX + dispW - pad, y: offsetY + pad },
        { x: offsetX + dispW - pad, y: offsetY + dispH - pad },
        { x: offsetX + pad, y: offsetY + dispH - pad },
      ];
      renderCropHandles(corners);
    }

    cropImage.onload = initCorners;
    if (cropImage.complete && cropImage.naturalWidth) initCorners();

    let dragIndex = null;
    function onPointerDown(e) {
      dragIndex = parseInt(e.currentTarget.dataset.corner, 10);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e) {
      if (dragIndex === null) return;
      const stageRect = cropStage.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - stageRect.left, 0), stageRect.width);
      const y = Math.min(Math.max(e.clientY - stageRect.top, 0), stageRect.height);
      corners[dragIndex] = { x, y };
      renderCropHandles(corners);
    }
    function onPointerUp() {
      dragIndex = null;
    }
    cropHandles.forEach((el) => {
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerup", onPointerUp);
    });

    function cleanup() {
      cropHandles.forEach((el) => {
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
      });
      cropSkipBtn.removeEventListener("click", onSkip);
      cropConfirmBtn.removeEventListener("click", onConfirm);
      URL.revokeObjectURL(url);
    }

    function onSkip() {
      cleanup();
      resolve(file);
    }

    async function onConfirm() {
      // Corners staan in CSS-pixels t.o.v. cropStage -- omrekenen naar
      // natuurlijke pixelcoördinaten van de originele foto.
      const naturalCorners = corners.map((c) => ({
        x: (c.x - offsetX) / naturalToCss,
        y: (c.y - offsetY) / naturalToCss,
      }));
      cropConfirmBtn.disabled = true;
      cropConfirmBtn.textContent = "Bezig...";
      // Laat de "Bezig..."-tekst renderen vóór de (synchrone, zware) warp.
      await new Promise((r) => setTimeout(r, 30));
      try {
        const canvas = warpPerspective(cropImage, naturalCorners);
        const cropped = await canvasToJpegFile(canvas, file.name, 0.85);
        cleanup();
        resolve(cropped);
      } catch (err) {
        // Bijsnijden mislukt (zeldzaam) -- gewoon de originele foto
        // gebruiken i.p.v. de gebruiker vast te laten lopen.
        cleanup();
        resolve(file);
      } finally {
        cropConfirmBtn.disabled = false;
        cropConfirmBtn.textContent = "Bijsnijden";
      }
    }

    cropSkipBtn.addEventListener("click", onSkip);
    cropConfirmBtn.addEventListener("click", onConfirm);
  });
}

// Toont het controlescherm met wat Claude uit de foto las + de al
// ingevulde Klant/Medewerker. Lost op met "confirm" of "retry".
function runConfirmStep(file, extraction, meta) {
  return new Promise((resolve) => {
    showWizardStep("confirm");
    const url = URL.createObjectURL(file);
    confirmThumb.src = url;
    const bedrag = typeof extraction.amount === "number"
      ? extraction.amount.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "?";
    confirmAmount.textContent = `${bedrag}`;
    confirmCurrency.textContent = extraction.currency || "?";
    confirmVendor.textContent = extraction.vendor || "-";
    confirmDate.textContent = extraction.receiptDate || "-";
    confirmKlant.textContent = meta.klant || "-";
    confirmMedewerker.textContent = meta.submittedBy || "-";

    function cleanup() {
      confirmRetryBtn.removeEventListener("click", onRetry);
      confirmSubmitBtn.removeEventListener("click", onSubmit);
      URL.revokeObjectURL(url);
    }
    function onRetry() {
      cleanup();
      resolve("retry");
    }
    function onSubmit() {
      cleanup();
      resolve("confirm");
    }
    confirmRetryBtn.addEventListener("click", onRetry);
    confirmSubmitBtn.addEventListener("click", onSubmit);
  });
}

// Stuurt Flow 0 aan met de nieuwe, tweefasige "Actie"-contract:
// "extract" (foto uploaden + laten uitlezen door Claude, geen
// lijst-item aangemaakt) en "bevestig" (definitief opslaan als item).
// Zie CLAUDE.md voor het volledige contract dat Flow 0 moet volgen.
async function extractBonnetje(file, index) {
  const photoBase64 = await compressImageToBase64(file, 1600, 0.75);
  const filename = `${Date.now()}_${index}.jpg`;
  const res = await fetch(CONFIG.flowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Actie: "extract", FileName: filename, PhotoBase64: photoBase64 }),
  });
  if (!res.ok) throw new Error("serverfout (" + res.status + ")");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "extractie mislukt");
  return { ...data, filename };
}

async function bevestigBonnetje(extraction, meta) {
  const res = await fetch(CONFIG.flowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Actie: "bevestig",
      PhotoRef: extraction.photoRef,
      FileName: extraction.filename,
      SubmittedBy: meta.submittedBy,
      SubmittedByEmail: meta.submittedByEmail,
      Categorie: meta.categorie,
      Toelichting: meta.toelichting,
      Klant: meta.klant,
      Amount: extraction.amount,
      Currency: extraction.currency,
      Vendor: extraction.vendor,
      ReceiptDate: extraction.receiptDate,
    }),
  });
  if (!res.ok) throw new Error("serverfout (" + res.status + ")");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "opslaan mislukt");
}

// Loopt de hele wizard (croppen -> lezen -> controleren -> opslaan) af
// voor elke foto in `files`. Retourneert welke foto's zijn gelukt en
// welke niet (met reden), zodat mislukte foto's opnieuw geprobeerd
// kunnen worden zonder de al gelukte nogmaals te versturen.
async function runBonWizard(files, meta) {
  const mislukt = [];
  let gelukt = 0;
  wizardOverlay.hidden = false;
  try {
    for (let i = 0; i < files.length; i++) {
      setWizardProgress(files.length > 1 ? `Bonnetje ${i + 1} van ${files.length}` : "Bonnetje");
      let file = await runCropStep(files[i]);

      let klaar = false;
      while (!klaar) {
        showWizardStep("loading");
        setWizardLoadingText("Bonnetje wordt gelezen...");
        let extraction;
        try {
          extraction = await extractBonnetje(file, i);
        } catch (err) {
          mislukt.push(files[i]);
          setWizardStatus("Kon dit bonnetje niet lezen: " + err.message, "error");
          await new Promise((r) => setTimeout(r, 1800));
          klaar = true;
          break;
        }

        const actie = await runConfirmStep(file, extraction, meta);
        if (actie === "retry") {
          file = await runCropStep(file);
          continue;
        }

        showWizardStep("loading");
        setWizardLoadingText("Bonnetje wordt opgeslagen...");
        try {
          await bevestigBonnetje(extraction, meta);
          gelukt++;
        } catch (err) {
          mislukt.push(files[i]);
          setWizardStatus("Kon dit bonnetje niet opslaan: " + err.message, "error");
          await new Promise((r) => setTimeout(r, 1800));
        }
        klaar = true;
      }
    }
  } finally {
    wizardOverlay.hidden = true;
  }
  return { gelukt, mislukt };
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
  setStatus("");

  try {
    const { gelukt, mislukt } = await runBonWizard(teVersturen, {
      submittedBy,
      submittedByEmail,
      categorie: categorieSelect.value,
      toelichting: document.getElementById("toelichting").value,
      klant,
    });

    selectedFiles = mislukt;
    renderPhotoPreviews();

    if (!mislukt.length) {
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
    } else if (gelukt) {
      setStatus(`${gelukt} van ${teVersturen.length} bonnen verstuurd, ${mislukt.length} mislukt -- probeer de overgebleven foto('s) opnieuw.`, "error");
    } else {
      setStatus("Er ging iets mis -- probeer het opnieuw.", "error");
    }
  } finally {
    submitBtn.disabled = false;
  }
});
