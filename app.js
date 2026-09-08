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
