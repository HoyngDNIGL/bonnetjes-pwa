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

fillSelect(wieBenJijSelect, CONFIG.employees);
fillSelect(categorieSelect, CONFIG.categories);
fillSelect(klantSelect, CONFIG.clients);

categorieSelect.addEventListener("change", () => {
  toelichtingWrap.hidden = categorieSelect.value !== "Anders";
});

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

  submitBtn.disabled = true;
  try {
    setStatus("Foto comprimeren...");
    const photoBase64 = await compressImageToBase64(file, 1600, 0.7);

    setStatus("Bezig met versturen...");
    const res = await fetch(CONFIG.flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SubmittedBy: wieBenJijSelect.value,
        Categorie: categorieSelect.value,
        Toelichting: document.getElementById("toelichting").value,
        Klant: klantSelect.value,
        FileName: `${Date.now()}.jpg`,
        PhotoBase64: photoBase64,
      }),
    });

    if (!res.ok) throw new Error("serverfout (" + res.status + ")");

    setStatus("Bon verstuurd, bedankt!", "success");
    form.reset();
    fillSelect(wieBenJijSelect, CONFIG.employees);
    fillSelect(categorieSelect, CONFIG.categories);
    fillSelect(klantSelect, CONFIG.clients);
    toelichtingWrap.hidden = true;
    clearPhoto();
  } catch (err) {
    setStatus("Er ging iets mis: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});
