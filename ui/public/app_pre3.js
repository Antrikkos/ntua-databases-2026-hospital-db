// ──────────────────────────────────────────────────────────────
//  Hygeiopolis UI — frontend logic
// ──────────────────────────────────────────────────────────────

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const msg = typeof data === "object" ? data.error : data;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

function renderTable(container, rows) {
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div class="empty">No rows found.</div>';
    return;
  }
  const cols = Object.keys(rows[0]);
  const thead = `<thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (row) =>
        `<tr>${cols
          .map((c) => `<td>${row[c] === null || row[c] === undefined ? "" : escapeHtml(String(row[c]))}</td>`)
          .join("")}</tr>`
    )
    .join("")}</tbody>`;
  container.innerHTML = `<div class="results-scroll"><table>${thead}${tbody}</table></div>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  const views = document.querySelectorAll(".view");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      views.forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`view-${tab.dataset.view}`).classList.add("active");
    });
  });
}

async function loadStatus() {
  const badge = document.getElementById("status-badge");
  try {
    const h = await api("/api/health");
    badge.textContent = `DB: ${h.db}`;
  } catch (err) {
    badge.textContent = `DB: error (${err.message})`;
  }
}

// ──────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────
async function loadDashboard() {
  const summary = await api("/api/summary");
  const labels = [
    ["Doctors", summary.doctors_count],
    ["Nurses", summary.nurses_count],
    ["Admins", summary.admins_count],
    ["Patients", summary.patients_count],
    ["Hospitalizations", summary.hospitalizations_count],
    ["Departments", summary.departments_count],
    ["Prescriptions", summary.prescriptions_count],
    ["Triage Cases", summary.triage_cases_count]
  ];
  document.getElementById("summary-cards").innerHTML = labels
    .map(([l, v]) => `<div class="card"><div class="label">${l}</div><div class="value">${v ?? 0}</div></div>`)
    .join("");

  const revenue = await api("/api/dashboard/revenue");
  renderTable(document.getElementById("revenue-table"), revenue);

  const triage = await api("/api/dashboard/triage");
  const max = Math.max(...triage.map((t) => Number(t.total_cases || 0)), 1);
  document.getElementById("triage-table").innerHTML = triage
    .map(
      (t) => `
      <div class="bar-row">
        <strong>L${t.urgency_level}</strong>
        <div class="bar" style="width:${Math.max(8, (100 * t.total_cases) / max)}%"></div>
        <span>${t.total_cases}</span>
      </div>`
    )
    .join("");
}

// ──────────────────────────────────────────────────────────────
// PATIENTS
// ──────────────────────────────────────────────────────────────
async function searchPatients() {
  const search = document.getElementById("patient-search").value.trim();
  const rows = await api(`/api/patients?search=${encodeURIComponent(search)}`);
  const list = document.getElementById("patient-list");
  if (rows.length === 0) {
    list.innerHTML = '<div class="empty">No patients found.</div>';
    return;
  }
  list.innerHTML = `
    <div class="results-scroll">
      <table>
        <thead><tr><th>ΑΜΚΑ</th><th>Όνομα</th><th>Επώνυμο</th><th>Ηλικία</th><th>Ασφάλεια</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${escapeHtml(r.amka)}</td>
              <td>${escapeHtml(r.first_name || "")}</td>
              <td>${escapeHtml(r.last_name || "")}</td>
              <td>${r.age ?? ""}</td>
              <td>${escapeHtml(r.insurance_provider || "")}</td>
              <td><button class="linkish" data-amka="${escapeHtml(r.amka)}">Details</button></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  list.querySelectorAll("button[data-amka]").forEach((btn) => {
    btn.addEventListener("click", () => showPatientDetail(btn.dataset.amka));
  });
}

async function showPatientDetail(amka) {
  const data = await api(`/api/patients/${encodeURIComponent(amka)}`);
  const panel = document.getElementById("patient-detail-panel");
  panel.style.display = "block";
  const p = data.patient;
  document.getElementById("patient-detail").innerHTML = `
    <table>
      <tr><th>ΑΜΚΑ</th><td>${escapeHtml(p.amka)}</td><th>Όνομα</th><td>${escapeHtml(p.first_name || "")}</td></tr>
      <tr><th>Επώνυμο</th><td>${escapeHtml(p.last_name || "")}</td><th>Πατρώνυμο</th><td>${escapeHtml(p.fathers_name || "")}</td></tr>
      <tr><th>Ηλικία</th><td>${p.age ?? ""}</td><th>Φύλο</th><td>${escapeHtml(p.gender || "")}</td></tr>
      <tr><th>Τηλέφωνο</th><td>${escapeHtml(p.phone || "")}</td><th>Email</th><td>${escapeHtml(p.email || "")}</td></tr>
      <tr><th>Επάγγελμα</th><td>${escapeHtml(p.profession || "")}</td><th>Υπηκοότητα</th><td>${escapeHtml(p.citizenship || "")}</td></tr>
      <tr><th>Ασφάλεια</th><td colspan="3">${escapeHtml(p.insurance_provider || "")}</td></tr>
    </table>
  `;
  renderTable(document.getElementById("patient-hospitalizations"), data.hospitalizations);
  renderTable(document.getElementById("patient-allergies"), data.allergies);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function initPatients() {
  document.getElementById("patient-search-btn").addEventListener("click", searchPatients);
  document.getElementById("patient-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchPatients();
  });
  await searchPatients();

  const form = document.getElementById("new-patient-form");
  const msg = document.getElementById("new-patient-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "meta";
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const r = await api("/api/patients", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = `OK — patient ${r.amka} created.`;
      msg.classList.add("success-msg");
      form.reset();
      await searchPatients();
    } catch (err) {
      msg.textContent = `Error: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });
}

// ──────────────────────────────────────────────────────────────
// DOCTORS
// ──────────────────────────────────────────────────────────────
async function loadDoctors() {
  const search = document.getElementById("doctor-search").value.trim();
  const specialty = document.getElementById("doctor-specialty").value;
  const rows = await api(`/api/doctors?search=${encodeURIComponent(search)}&specialty=${encodeURIComponent(specialty)}`);
  renderTable(document.getElementById("doctor-list"), rows);
}

async function initDoctors() {
  // ── Search ─────────────────────────────────────────────────
  const specs = await api("/api/specialties");
  const sel = document.getElementById("doctor-specialty");
  sel.innerHTML =
    '<option value="">— Όλες οι ειδικότητες —</option>' +
    specs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  document.getElementById("doctor-search-btn").addEventListener("click", loadDoctors);
  document.getElementById("doctor-specialty").addEventListener("change", loadDoctors);
  await loadDoctors();

  // ── New doctor form ────────────────────────────────────────
  // Populate specialty dropdown
  const newSpecSel = document.getElementById("new-doctor-specialty");
  newSpecSel.innerHTML =
    '<option value="">— επίλεξε —</option>' +
    specs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  // Populate departments
  const depts = await api("/api/departments");
  document.getElementById("new-doctor-depts").innerHTML = depts
    .map((d) => `<label style="display:flex;align-items:center;gap:4px;font-size:0.85rem;cursor:pointer;padding:2px 6px;border:1px solid #bcccde;border-radius:6px;white-space:nowrap;">
      <input type="checkbox" class="new-doctor-dept-cb" value="${d.id}"> ${escapeHtml(d.name)}
    </label>`)
    .join("");

  // Populate supervisors
  async function loadSupervisors() {
    try {
      const sups = await api("/api/admin/doctors/supervisors");
      const supSel = document.getElementById("new-doctor-supervisor");
      supSel.innerHTML =
        '<option value="">— κανείς —</option>' +
        sups.map((s) => `<option value="${escapeHtml(s.staff_amka)}">${escapeHtml(s.last_name + " " + s.first_name)} (${escapeHtml(s.rank_)} · ${escapeHtml(s.specialty)})</option>`).join("");
    } catch (e) { /* non-critical */ }
  }
  await loadSupervisors();

  // Rank change → supervisor rules
  document.getElementById("new-doctor-rank").addEventListener("change", function () {
    const rank = this.value;
    const note = document.getElementById("new-doctor-supervisor-note");
    const supSel = document.getElementById("new-doctor-supervisor");
    note.style.display = "block";
    if (rank === "Ειδικευόμενος") {
      note.textContent = "⚠ Υποχρεωτικός επόπτης για Ειδικευόμενο — ελέγχεται από DB trigger.";
      note.style.background = "#fef3c7"; note.style.color = "#92400e";
      supSel.required = true;
      supSel.disabled = false;
    } else if (rank === "Διευθυντής") {
      note.textContent = "ℹ Ο Διευθυντής δεν μπορεί να έχει επόπτη.";
      note.style.background = "#eff6ff"; note.style.color = "#1d4ed8";
      supSel.value = ""; supSel.required = false; supSel.disabled = true;
    } else {
      note.textContent = "Προαιρετικός επόπτης για Επιμελητές.";
      note.style.background = "#f1f5f9"; note.style.color = "#475569";
      supSel.required = false; supSel.disabled = false;
    }
  });

  // Form submit
  const form = document.getElementById("new-doctor-form");
  const msg  = document.getElementById("new-doctor-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = ""; msg.className = "meta";

    const fd = new FormData(form);
    const deptIds = [...document.querySelectorAll(".new-doctor-dept-cb:checked")].map((cb) => Number(cb.value));
    if (deptIds.length === 0) {
      msg.textContent = "Επίλεξε τουλάχιστον ένα τμήμα.";
      msg.classList.add("error-msg"); return;
    }

    const payload = {
      amka:            fd.get("amka"),
      first_name:      fd.get("first_name"),
      last_name:       fd.get("last_name"),
      age:             Number(fd.get("age")),
      hire_date:       fd.get("hire_date"),
      email:           fd.get("email") || null,
      phone:           fd.get("phone") || null,
      license_number:  fd.get("license_number"),
      specialty:       fd.get("specialty"),
      rank:            fd.get("rank"),
      supervisor_amka: fd.get("supervisor_amka") || null,
      department_ids:  deptIds,
    };

    try {
      const r = await api("/api/admin/doctors", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = `OK — ο ιατρός ${r.amka} καταχωρήθηκε (${r.departments} τμήμα/τα).`;
      msg.classList.add("success-msg");
      form.reset();
      document.getElementById("new-doctor-supervisor-note").style.display = "none";
      document.getElementById("new-doctor-supervisor").disabled = false;
      document.querySelectorAll(".new-doctor-dept-cb").forEach((cb) => (cb.checked = false));
      await loadDoctors();
      await loadSupervisors(); // refresh supervisors list
    } catch (err) {
      msg.textContent = `Σφάλμα: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });
}

// ──────────────────────────────────────────────────────────────
// HOSPITALIZATIONS
// ──────────────────────────────────────────────────────────────
function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `€${num.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderActiveHospitalizations(rows) {
  const container = document.getElementById("hosp-active-list");
  document.getElementById("hosp-active-count").textContent = `(${rows.length})`;
  if (rows.length === 0) {
    container.innerHTML = '<div class="empty">Δεν υπάρχουν ενεργές νοσηλείες.</div>';
    return;
  }
  container.innerHTML = `
    <div class="results-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Ασθενής</th><th>ΑΜΚΑ</th><th>Τμήμα</th><th>Κλίνη</th>
            <th>Εισαγωγή</th><th>Ημέρες</th><th>ICD-10 Εισ.</th><th>ΚΕΝ</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
              <tr>
                <td>${r.id}</td>
                <td>${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}</td>
                <td>${escapeHtml(r.patient_amka || "")}</td>
                <td>${escapeHtml(r.department || "")}</td>
                <td>${escapeHtml(r.bed_number || String(r.bed_id || ""))}</td>
                <td>${formatDateTime(r.admission_date)}</td>
                <td>${r.stay_days ?? ""}</td>
                <td>${escapeHtml(r.admission_diagnosis_icd10 || "")}</td>
                <td>${escapeHtml(r.ken_code || "")}</td>
                <td>
                  <button class="btn-discharge-hosp" data-id="${r.id}"
                          data-name="${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}"
                          data-admission="${escapeHtml(r.admission_date || "")}">
                    Εξιτήριο
                  </button>
                </td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  container.querySelectorAll(".btn-discharge-hosp").forEach((btn) => {
    btn.addEventListener("click", () => {
      openDischargeModal({
        hospitalization_id: btn.dataset.id,
        patient_name: btn.dataset.name,
        admission_date: btn.dataset.admission
      });
    });
  });
}

function renderCompletedHospitalizations(rows) {
  const container = document.getElementById("hosp-completed-list");
  document.getElementById("hosp-completed-count").textContent = `(${rows.length})`;
  if (rows.length === 0) {
    container.innerHTML = '<div class="empty">Δεν υπάρχουν ολοκληρωμένες νοσηλείες.</div>';
    return;
  }
  container.innerHTML = `
    <div class="results-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Ασθενής</th><th>ΑΜΚΑ</th><th>Τμήμα</th>
            <th>Εισαγωγή</th><th>Έξοδος</th><th>Ημέρες</th>
            <th>ICD-10 Εισ.</th><th>ICD-10 Εξ.</th><th>ΚΕΝ</th><th>Κόστος</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
              <tr>
                <td>${r.id}</td>
                <td>${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}</td>
                <td>${escapeHtml(r.patient_amka || "")}</td>
                <td>${escapeHtml(r.department || "")}</td>
                <td>${formatDateTime(r.admission_date)}</td>
                <td>${formatDateTime(r.discharge_date)}</td>
                <td>${r.stay_days ?? ""}</td>
                <td>${escapeHtml(r.admission_diagnosis_icd10 || "")}</td>
                <td>${escapeHtml(r.discharge_diagnosis_icd10 || "")}</td>
                <td>${escapeHtml(r.ken_code || "")}</td>
                <td>${formatCurrency(r.total_cost)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

async function loadHospitalizations() {
  try {
    const [active, completed] = await Promise.all([
      api("/api/hospitalizations?status=active"),
      api("/api/hospitalizations?status=completed")
    ]);
    renderActiveHospitalizations(active);
    renderCompletedHospitalizations(completed);
    document.getElementById("hosp-counts").textContent =
      `${active.length} ενεργές · ${completed.length} ολοκληρωμένες`;
  } catch (err) {
    document.getElementById("hosp-active-list").innerHTML =
      `<div class="empty error-msg">${escapeHtml(err.message)}</div>`;
  }
}

let dischargeIcd10Refresh = null;

function initDischargeModal() {
  const overlay = document.getElementById("discharge-modal");
  document.getElementById("discharge-modal-close").addEventListener("click", () => (overlay.hidden = true));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });

  dischargeIcd10Refresh = attachSearchSelect(
    "discharge-icd10-search",
    "discharge-icd10-select",
    "/api/icd10/search?q=",
    (r) =>
      `<option value="${escapeHtml(r.code)}">${escapeHtml(r.code)} — ${escapeHtml((r.description || "").slice(0, 80))}</option>`
  );

  const form = document.getElementById("discharge-form");
  const msg = document.getElementById("discharge-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "meta";
    const payload = Object.fromEntries(new FormData(form).entries());
    const id = payload.hospitalization_id;
    if (payload.discharge_date && payload.discharge_date.includes("T")) {
      payload.discharge_date = payload.discharge_date.replace("T", " ") + ":00";
    }
    try {
      const r = await api(`/api/hospitalizations/${id}/discharge`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      msg.textContent = `OK — έξοδος καταχωρήθηκε. Συνολικό κόστος: ${formatCurrency(r.hospitalization?.total_cost)}.`;
      msg.classList.add("success-msg");
      await loadHospitalizations();
      setTimeout(() => {
        overlay.hidden = true;
        msg.textContent = "";
      }, 1400);
    } catch (err) {
      msg.textContent = `Σφάλμα: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });
}

async function openDischargeModal({ hospitalization_id, patient_name, admission_date }) {
  const overlay = document.getElementById("discharge-modal");
  const form = document.getElementById("discharge-form");
  const msg = document.getElementById("discharge-message");
  msg.textContent = "";
  msg.className = "meta";
  form.reset();
  form.elements["hospitalization_id"].value = hospitalization_id;

  document.getElementById("discharge-patient-info").innerHTML = `
    <div><strong>Ασθενής:</strong> ${escapeHtml(patient_name)}</div>
    <div class="muted">Νοσηλεία #${escapeHtml(hospitalization_id)} · Εισαγωγή ${escapeHtml(formatDateTime(admission_date))}</div>
  `;

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  form.elements["discharge_date"].value = now.toISOString().slice(0, 16);

  if (dischargeIcd10Refresh) await dischargeIcd10Refresh();
  overlay.hidden = false;
}

async function initHospitalizations() {
  const depts = await api("/api/departments");
  const deptSel = document.getElementById("hosp-dept-select");
  deptSel.innerHTML = depts.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");

  const refreshBeds = async () => {
    const id = deptSel.value;
    const beds = await api(`/api/beds/available?departmentId=${id}`);
    const bedSel = document.getElementById("hosp-bed-select");
    bedSel.innerHTML = beds.length
      ? beds.map((b) => `<option value="${b.id}">${escapeHtml(b.bed_number)} — ${escapeHtml(b.type)}</option>`).join("")
      : '<option value="">— καμία διαθέσιμη κλίνη —</option>';
  };
  deptSel.addEventListener("change", refreshBeds);
  await refreshBeds();

  document.getElementById("hosp-refresh-btn").addEventListener("click", loadHospitalizations);
  initDischargeModal();
  await loadHospitalizations();

  const form = document.getElementById("new-hosp-form");
  const msg = document.getElementById("new-hosp-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "meta";
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.admission_date && payload.admission_date.includes("T")) {
      payload.admission_date = payload.admission_date.replace("T", " ") + ":00";
    }
    try {
      const r = await api("/api/hospitalizations", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = `OK — hospitalization #${r.hospitalization_id} created.`;
      msg.classList.add("success-msg");
      form.reset();
      await refreshBeds();
      await loadHospitalizations();
    } catch (err) {
      msg.textContent = `Trigger/DB error: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });
}

// ──────────────────────────────────────────────────────────────
// PRESCRIPTIONS
// ──────────────────────────────────────────────────────────────
async function loadPrescriptions() {
  const rows = await api("/api/prescriptions");
  renderTable(document.getElementById("prescriptions-list"), rows);
}

async function initPrescriptions() {
  await loadPrescriptions();

  const searchInput = document.getElementById("medicine-search");
  const medSelect = document.getElementById("medicine-select");

  const refreshMeds = async () => {
    const meds = await api(`/api/medicines/search?q=${encodeURIComponent(searchInput.value.trim())}`);
    medSelect.innerHTML = meds.length
      ? meds.map((m) => `<option value="${escapeHtml(m.code)}">${escapeHtml(m.brand_name)} (${escapeHtml(m.code)})</option>`).join("")
      : '<option value="">— Δεν βρέθηκαν φάρμακα —</option>';
  };
  searchInput.addEventListener("input", debounce(refreshMeds, 250));
  await refreshMeds();

  const form = document.getElementById("new-prescription-form");
  const msg = document.getElementById("new-prescription-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "meta";
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await api("/api/prescriptions", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = "OK — prescription saved.";
      msg.classList.add("success-msg");
      form.reset();
      await refreshMeds();
      await loadPrescriptions();
    } catch (err) {
      msg.textContent = `Trigger blocked: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ──────────────────────────────────────────────────────────────
// TRIAGE / ΤΕΠ
// ──────────────────────────────────────────────────────────────
const URGENCY_LABELS = {
  1: "Άμεσο",
  2: "Επείγον",
  3: "Επιτακτικό",
  4: "Λιγότερο επείγον",
  5: "Μη επείγον"
};

let triageRefreshTimer = null;

function urgencyBadge(level) {
  const l = Number(level);
  return `<span class="urgency-badge u${l}" title="${escapeHtml(URGENCY_LABELS[l] || "")}">L${l} · ${escapeHtml(URGENCY_LABELS[l] || "")}</span>`;
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("el-GR", { hour12: false });
}

async function loadTriageQueue() {
  const container = document.getElementById("triage-queue");
  const counter = document.getElementById("queue-count");
  try {
    const rows = await api("/api/triage/queue");
    counter.textContent = rows.length === 0
      ? "Καμία αναμονή"
      : `${rows.length} ασθενής/-είς στη λίστα`;

    if (rows.length === 0) {
      container.innerHTML = '<div class="empty">Δεν υπάρχουν περιστατικά σε αναμονή.</div>';
      return;
    }

    container.innerHTML = `
      <div class="queue-list">
        ${rows
          .map(
            (r, idx) => `
            <div class="queue-row u${r.urgency_level}">
              <div class="queue-rank">#${idx + 1}</div>
              <div class="queue-main">
                <div class="queue-line1">
                  ${urgencyBadge(r.urgency_level)}
                  <strong>${escapeHtml(r.last_name || "")} ${escapeHtml(r.first_name || "")}</strong>
                  <span class="muted">ΑΜΚΑ ${escapeHtml(r.patient_amka)}</span>
                  <span class="muted">· ${r.age ?? "?"} ετών · ${escapeHtml(r.gender || "")}</span>
                </div>
                <div class="queue-line2">
                  <span class="muted">Άφιξη:</span> ${formatDateTime(r.arrival_time)}
                  <span class="muted">· Αναμονή:</span> <strong>${r.waiting_minutes ?? 0}'</strong>
                  ${r.nurse_amka ? `<span class="muted">· Triage:</span> ${escapeHtml((r.nurse_last || "") + " " + (r.nurse_first || ""))}` : ""}
                </div>
                <div class="queue-symptoms">${escapeHtml(r.symptoms || "—")}</div>
              </div>
              <div class="queue-actions">
                <button class="btn-admit" data-id="${r.id}" data-amka="${escapeHtml(r.patient_amka)}"
                        data-name="${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}">
                  Νοσηλεία
                </button>
                <button class="btn-discharge linkish" data-id="${r.id}">
                  Αποχώρηση με οδηγίες
                </button>
              </div>
            </div>`
          )
          .join("")}
      </div>`;

    container.querySelectorAll(".btn-admit").forEach((btn) => {
      btn.addEventListener("click", () => {
        openAdmitModal({
          triage_id: btn.dataset.id,
          patient_amka: btn.dataset.amka,
          patient_name: btn.dataset.name
        });
      });
    });
    container.querySelectorAll(".btn-discharge").forEach((btn) => {
      btn.addEventListener("click", () => dischargeTriage(btn.dataset.id));
    });
  } catch (err) {
    container.innerHTML = `<div class="empty error-msg">Σφάλμα φόρτωσης: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadTriageHistory() {
  const container = document.getElementById("triage-history");
  try {
    const rows = await api("/api/triage/history");
    if (rows.length === 0) {
      container.innerHTML = '<div class="empty">—</div>';
      return;
    }
    container.innerHTML = `
      <table>
        <thead><tr><th>Ώρα</th><th>Ασθενής</th><th>Επ.</th><th>Έκβαση</th><th>Λεπτά</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `
              <tr>
                <td>${formatDateTime(r.resolved_at)}</td>
                <td>${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}</td>
                <td>${urgencyBadge(r.urgency_level)}</td>
                <td>${r.outcome === "Admitted" ? `Νοσηλεία (#${r.hospitalization_id ?? "?"})` : "Οδηγίες"}</td>
                <td>${r.handled_in_minutes ?? ""}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty error-msg">${escapeHtml(err.message)}</div>`;
  }
}

async function dischargeTriage(id) {
  if (!confirm("Επιβεβαίωση: ο ασθενής αποχωρεί με οδηγίες;")) return;
  try {
    await api(`/api/triage/${id}/discharge`, { method: "POST", body: "{}" });
    await Promise.all([loadTriageQueue(), loadTriageHistory()]);
  } catch (err) {
    alert(`Αποτυχία: ${err.message}`);
  }
}

async function initTriage() {
  const nurseSel = document.getElementById("triage-nurse-select");
  try {
    const nurses = await api("/api/triage/nurses");
    nurseSel.innerHTML = nurses.length
      ? nurses
          .map(
            (n) =>
              `<option value="${escapeHtml(n.staff_amka)}">${escapeHtml((n.last_name || "") + " " + (n.first_name || ""))} — ${escapeHtml(n.rank_ || "")}</option>`
          )
          .join("")
      : '<option value="">— καμία διαθέσιμη νοσηλεύτρια —</option>';
  } catch (err) {
    nurseSel.innerHTML = `<option value="">σφάλμα: ${escapeHtml(err.message)}</option>`;
  }

  document.getElementById("queue-refresh-btn").addEventListener("click", () => {
    loadTriageQueue();
    loadTriageHistory();
  });

  const autoCheck = document.getElementById("queue-autorefresh");
  const setupAutoRefresh = () => {
    clearInterval(triageRefreshTimer);
    if (autoCheck.checked) {
      triageRefreshTimer = setInterval(loadTriageQueue, 10000);
    }
  };
  autoCheck.addEventListener("change", setupAutoRefresh);
  setupAutoRefresh();

  const form = document.getElementById("new-triage-form");
  const msg = document.getElementById("new-triage-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "meta";
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.urgency_level = Number(payload.urgency_level);
    if (payload.arrival_time) {
      payload.arrival_time = payload.arrival_time.replace("T", " ") + ":00";
    } else {
      delete payload.arrival_time;
    }
    try {
      const r = await api("/api/triage", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = `OK — triage #${r.triage_id} προστέθηκε στη λίστα.`;
      msg.classList.add("success-msg");
      form.reset();
      // Restore default urgency selection (3) after reset
      form.querySelector('[name="urgency_level"]').value = "3";
      await Promise.all([loadTriageQueue(), loadTriageHistory()]);
    } catch (err) {
      msg.textContent = `Σφάλμα: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });

  await Promise.all([loadTriageQueue(), loadTriageHistory()]);
  initAdmitModal();
}

// ──────────────────────────────────────────────────────────────
// ADMIT MODAL — admit a triage patient to a department/bed
// ──────────────────────────────────────────────────────────────
let admitDeptsCache = null;

async function refreshAdmitBeds() {
  const deptId = document.getElementById("admit-dept-select").value;
  const bedSel = document.getElementById("admit-bed-select");
  if (!deptId) {
    bedSel.innerHTML = '<option value="">— επίλεξε τμήμα —</option>';
    return;
  }
  try {
    const beds = await api(`/api/beds/available?departmentId=${deptId}`);
    bedSel.innerHTML = beds.length
      ? beds.map((b) => `<option value="${b.id}">${escapeHtml(b.bed_number)} — ${escapeHtml(b.type)}</option>`).join("")
      : '<option value="">— καμία διαθέσιμη κλίνη —</option>';
  } catch (err) {
    bedSel.innerHTML = `<option value="">σφάλμα: ${escapeHtml(err.message)}</option>`;
  }
}

async function refreshAdmitDoctors() {
  const deptId = document.getElementById("admit-dept-select").value;
  const docSel = document.getElementById("admit-doctor-select");
  if (!deptId) {
    docSel.innerHTML = '<option value="">— επίλεξε τμήμα πρώτα —</option>';
    return;
  }
  try {
    const docs = await api(`/api/doctors/by-department?department_id=${deptId}`);
    const RANK_ICON = {
      "Διευθυντής":    "👑",
      "Επιμελητής Α'": "🔵",
      "Επιμελητής Β'": "🟢",
      "Ειδικευόμενος": "🟡",
    };
    docSel.innerHTML = docs.length
      ? docs.map((d) => {
          const icon = RANK_ICON[d.rank_] || "👨‍⚕️";
          return `<option value="${escapeHtml(d.amka)}">${icon} ${escapeHtml(d.last_name + " " + d.first_name)} — ${escapeHtml(d.specialty)} (${escapeHtml(d.rank_)})</option>`;
        }).join("")
      : '<option value="">— κανείς διαθέσιμος —</option>';
  } catch (err) {
    docSel.innerHTML = `<option value="">σφάλμα: ${escapeHtml(err.message)}</option>`;
  }
}

function attachSearchSelect(searchId, selectId, fetchUrl, mapItem) {
  const input = document.getElementById(searchId);
  const select = document.getElementById(selectId);
  const refresh = async () => {
    try {
      const rows = await api(`${fetchUrl}${encodeURIComponent(input.value.trim())}`);
      select.innerHTML = rows.length
        ? rows.map((r) => mapItem(r)).join("")
        : '<option value="">— καμία επιλογή —</option>';
    } catch (err) {
      select.innerHTML = `<option value="">σφάλμα: ${escapeHtml(err.message)}</option>`;
    }
  };
  input.addEventListener("input", debounce(refresh, 250));
  return refresh;
}

let initAdmitIcd10 = null;
let initAdmitKen = null;

function initAdmitModal() {
  const overlay = document.getElementById("admit-modal");
  const closeBtn = document.getElementById("admit-modal-close");
  closeBtn.addEventListener("click", () => (overlay.hidden = true));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });

  document.getElementById("admit-dept-select").addEventListener("change", () => {
    refreshAdmitBeds();
    refreshAdmitDoctors();
  });

  initAdmitIcd10 = attachSearchSelect(
    "admit-icd10-search",
    "admit-icd10-select",
    "/api/icd10/search?q=",
    (r) => `<option value="${escapeHtml(r.code)}">${escapeHtml(r.code)} — ${escapeHtml((r.description || "").slice(0, 80))}</option>`
  );
  initAdmitKen = attachSearchSelect(
    "admit-ken-search",
    "admit-ken-select",
    "/api/ken/search?q=",
    (r) => `<option value="${escapeHtml(r.code)}">${escapeHtml(r.code)} — ${escapeHtml((r.description || "").slice(0, 60))} (€${r.base_cost ?? "?"}, ${r.average_stay_days ?? "?"}d)</option>`
  );

  const form = document.getElementById("admit-form");
  const msg = document.getElementById("admit-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "meta";
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.admission_date && payload.admission_date.includes("T")) {
      payload.admission_date = payload.admission_date.replace("T", " ") + ":00";
    }
    try {
      const r = await api("/api/hospitalizations", { method: "POST", body: JSON.stringify(payload) });
      const docInfo = payload.attending_doctor_amka ? ` · Υπεύθ. ιατρός: ${escapeHtml(document.getElementById("admit-doctor-select").selectedOptions[0]?.text || payload.attending_doctor_amka)}` : "";
      msg.textContent = `OK — Νοσηλεία #${r.hospitalization_id} (triage #${r.triage_id}) δημιουργήθηκε.${docInfo}`;
      msg.classList.add("success-msg");
      setTimeout(() => {
        overlay.hidden = true;
        msg.textContent = "";
      }, 1200);
      await Promise.all([loadTriageQueue(), loadTriageHistory(), loadHospitalizations().catch(() => {})]);
    } catch (err) {
      msg.textContent = `Σφάλμα: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });
}

async function openAdmitModal({ triage_id, patient_amka, patient_name }) {
  const overlay = document.getElementById("admit-modal");
  const form = document.getElementById("admit-form");
  const msg = document.getElementById("admit-message");
  msg.textContent = "";
  msg.className = "meta";
  form.reset();
  form.elements["triage_id"].value = triage_id;
  form.elements["patient_amka"].value = patient_amka;

  document.getElementById("admit-patient-info").innerHTML = `
    <div><strong>Ασθενής:</strong> ${escapeHtml(patient_name)}</div>
    <div class="muted">ΑΜΚΑ ${escapeHtml(patient_amka)} · triage #${escapeHtml(triage_id)}</div>
  `;

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  form.elements["admission_date"].value = now.toISOString().slice(0, 16);

  if (!admitDeptsCache) {
    admitDeptsCache = await api("/api/departments");
  }
  const deptSel = document.getElementById("admit-dept-select");
  deptSel.innerHTML = admitDeptsCache.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
  await refreshAdmitBeds();
  await refreshAdmitDoctors();
  if (initAdmitIcd10) await initAdmitIcd10();
  if (initAdmitKen) await initAdmitKen();

  overlay.hidden = false;
}

// ──────────────────────────────────────────────────────────────
// REVIEWS / ΑΞΙΟΛΟΓΗΣΕΙΣ
// ──────────────────────────────────────────────────────────────
function starsDisplay(value, count) {
  const v = Number(value);
  if (!v || Number.isNaN(v)) return `<span class="stars-empty">— χωρίς αξιολογήσεις —</span>`;
  const full = Math.round(v);
  const stars = "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  return `<span class="stars" title="${v.toFixed(2)} / 5">${stars}</span> <span class="muted">${v.toFixed(2)}${count !== undefined ? ` · ${count} κριτικές` : ""}</span>`;
}

function buildRatingInput(name, current) {
  // 1..5 radio buttons + an "uncleared" option (no rating)
  const opts = [1, 2, 3, 4, 5]
    .map(
      (n) => `
        <label class="rating-star">
          <input type="radio" name="${name}" value="${n}" ${Number(current) === n ? "checked" : ""} />
          <span>${n}</span>
        </label>`
    )
    .join("");
  return `<span class="rating-row">${opts}</span>`;
}

function renderRatingInputs() {
  document.querySelectorAll("#new-review-form .rating-input").forEach((el) => {
    const field = el.dataset.field;
    el.innerHTML = buildRatingInput(field, null);
  });
}

async function loadReviewsDoctorsSummary() {
  const list = document.getElementById("reviews-doctors-list");
  const counter = document.getElementById("reviews-doctors-count");
  try {
    const rows = await api("/api/reviews/doctors-summary");
    counter.textContent = rows.length === 0 ? "— καμία αξιολόγηση —" : `${rows.length} ιατροί με αξιολογήσεις`;
    if (rows.length === 0) {
      list.innerHTML = '<div class="empty">Δεν υπάρχουν ακόμη αξιολογήσεις ιατρών.</div>';
      return;
    }
    list.innerHTML = `
      <div class="results-scroll">
        <table>
          <thead>
            <tr><th>Ιατρός</th><th>Ειδικότητα</th><th>Βαθμίδα</th><th>Μ.Ο.</th><th>#</th><th></th></tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
                <tr>
                  <td>${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}</td>
                  <td>${escapeHtml(r.specialty || "")}</td>
                  <td>${escapeHtml(r.rank_ || "")}</td>
                  <td>${starsDisplay(r.avg_medical_care, undefined)}</td>
                  <td>${r.review_count}</td>
                  <td><button class="linkish btn-doctor-reviews" data-amka="${escapeHtml(r.staff_amka)}">Προβολή</button></td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
    list.querySelectorAll(".btn-doctor-reviews").forEach((btn) => {
      btn.addEventListener("click", () => showDoctorReviews(btn.dataset.amka));
    });
  } catch (err) {
    list.innerHTML = `<div class="empty error-msg">${escapeHtml(err.message)}</div>`;
  }
}

async function showDoctorReviews(amka) {
  const panel = document.getElementById("reviews-doctor-detail-panel");
  const summary = document.getElementById("reviews-doctor-summary");
  const detail = document.getElementById("reviews-doctor-detail");
  const nameSpan = document.getElementById("reviews-doctor-name");
  try {
    const data = await api(`/api/reviews/doctor/${encodeURIComponent(amka)}`);
    const d = data.doctor;
    nameSpan.textContent = `— ${(d.last_name || "") + " " + (d.first_name || "")}`;
    summary.innerHTML = `
      <table>
        <tr>
          <th>ΑΜΚΑ</th><td>${escapeHtml(d.staff_amka)}</td>
          <th>Ειδικότητα</th><td>${escapeHtml(d.specialty || "")}</td>
          <th>Βαθμίδα</th><td>${escapeHtml(d.rank_ || "")}</td>
        </tr>
        <tr>
          <th>Μ.Ο. Ποιότητας ιατρ. φροντίδας</th>
          <td colspan="5">${starsDisplay(d.avg_medical_care, d.review_count)}</td>
        </tr>
      </table>`;
    if (data.reviews.length === 0) {
      detail.innerHTML = '<div class="empty">Δεν υπάρχουν επιμέρους αξιολογήσεις.</div>';
    } else {
      detail.innerHTML = `
        <div class="results-scroll">
          <table>
            <thead>
              <tr><th>Νοσηλεία</th><th>Τμήμα</th><th>Ασθενής</th><th>Έξοδος</th><th>Βαθμός</th></tr>
            </thead>
            <tbody>
              ${data.reviews
                .map(
                  (r) => `
                  <tr>
                    <td>#${r.hospitalization_id}</td>
                    <td>${escapeHtml(r.department || "")}</td>
                    <td>${escapeHtml((r.patient_last || "") + " " + (r.patient_first || ""))}</td>
                    <td>${formatDateTime(r.discharge_date)}</td>
                    <td>${starsDisplay(r.medical_care, undefined)}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    alert(`Σφάλμα: ${err.message}`);
  }
}

async function loadReviewsHospList() {
  const list = document.getElementById("reviews-hosp-list");
  try {
    const rows = await api("/api/reviews/hospitalizations");
    if (rows.length === 0) {
      list.innerHTML = '<div class="empty">Δεν υπάρχουν ολοκληρωμένες νοσηλείες.</div>';
      return;
    }
    const evaluated = rows.filter((r) => Number(r.has_evaluation) === 1);
    list.innerHTML = `
      <div class="muted" style="margin-bottom:6px;">
        ${evaluated.length} / ${rows.length} νοσηλείες έχουν αξιολογηθεί
      </div>
      <div class="results-scroll">
        <table>
          <thead>
            <tr><th>#</th><th>Ασθενής</th><th>Τμήμα</th><th>Έξοδος</th>
                <th>Νοσηλ. φροντ.</th><th>Καθαρ.</th><th>Φαγητό</th><th>Συν. εμπ.</th><th>Ιατροί</th></tr>
          </thead>
          <tbody>
            ${rows
              .map((r) =>
                Number(r.has_evaluation) === 1
                  ? `
                  <tr>
                    <td>#${r.id}</td>
                    <td>${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}</td>
                    <td>${escapeHtml(r.department || "")}</td>
                    <td>${formatDateTime(r.discharge_date)}</td>
                    <td>${r.nursing_care ?? "—"}</td>
                    <td>${r.cleanliness ?? "—"}</td>
                    <td>${r.food ?? "—"}</td>
                    <td>${r.overall_experience ?? "—"}</td>
                    <td>${r.doctor_reviews}</td>
                  </tr>`
                  : `
                  <tr class="muted-row">
                    <td>#${r.id}</td>
                    <td>${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))}</td>
                    <td>${escapeHtml(r.department || "")}</td>
                    <td>${formatDateTime(r.discharge_date)}</td>
                    <td colspan="5"><em class="muted">— δεν έχει αξιολογηθεί —</em></td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    list.innerHTML = `<div class="empty error-msg">${escapeHtml(err.message)}</div>`;
  }
}

async function loadReviewsEligible() {
  const sel = document.getElementById("review-hosp-select");
  try {
    const rows = await api("/api/reviews/eligible");
    sel.innerHTML =
      '<option value="">— επιλέξτε νοσηλεία —</option>' +
      rows
        .map(
          (r) => `
          <option value="${r.id}">
            #${r.id} · ${escapeHtml((r.last_name || "") + " " + (r.first_name || ""))} ·
            ${escapeHtml(r.department || "")} · έξοδος ${escapeHtml((r.discharge_date || "").slice(0, 10))}
          </option>`
        )
        .join("");
  } catch (err) {
    sel.innerHTML = `<option value="">σφάλμα: ${escapeHtml(err.message)}</option>`;
  }
}

async function loadDoctorRatingsForHosp(hospId) {
  const container = document.getElementById("review-doctor-ratings");
  if (!hospId) {
    container.innerHTML = '<div class="empty">— επιλέξτε πρώτα νοσηλεία —</div>';
    return;
  }
  try {
    const data = await api(`/api/reviews/hospitalization/${encodeURIComponent(hospId)}/doctors`);
    if (!data.doctors.length) {
      container.innerHTML =
        '<div class="empty">Δεν βρέθηκαν ιατροί που συνταγογράφησαν κατά τη νοσηλεία.</div>';
      return;
    }
    container.innerHTML = data.doctors
      .map((d, idx) => {
        const already = d.existing_rating !== null && d.existing_rating !== undefined;
        return `
          <div class="doctor-rating-row" data-amka="${escapeHtml(d.staff_amka || d.doctor_amka)}">
            <div class="doctor-rating-name">
              <strong>${escapeHtml((d.last_name || "") + " " + (d.first_name || ""))}</strong>
              <span class="muted">· ${escapeHtml(d.specialty || "")} · ${escapeHtml(d.rank_ || "")}</span>
              ${already ? `<span class="muted">· ήδη βαθμολογημένος (${d.existing_rating}/5)</span>` : ""}
            </div>
            <div class="doctor-rating-stars">
              ${already
                ? `<em class="muted">δεν επιτρέπεται επανυποβολή</em>`
                : buildRatingInput(`doctor_rating_${idx}`, null)}
              <input type="hidden" name="doctor_amka_${idx}" value="${escapeHtml(d.doctor_amka)}" />
            </div>
          </div>`;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<div class="empty error-msg">${escapeHtml(err.message)}</div>`;
  }
}

function collectReviewPayload(form) {
  const fd = new FormData(form);
  const hospitalization_id = fd.get("hospitalization_id");
  const get = (name) => {
    const v = fd.get(name);
    return v ? Number(v) : null;
  };
  const payload = {
    hospitalization_id,
    nursing_care: get("nursing_care"),
    cleanliness: get("cleanliness"),
    food: get("food"),
    overall_experience: get("overall_experience"),
    doctor_ratings: []
  };
  // Walk rows in the doctor ratings panel
  document.querySelectorAll("#review-doctor-ratings .doctor-rating-row").forEach((row, idx) => {
    const amkaInput = row.querySelector(`input[name="doctor_amka_${idx}"]`);
    const radio = row.querySelector(`input[name="doctor_rating_${idx}"]:checked`);
    if (amkaInput && radio) {
      payload.doctor_ratings.push({
        doctor_amka: amkaInput.value,
        medical_care: Number(radio.value)
      });
    }
  });
  return payload;
}

async function initReviews() {
  await Promise.all([loadReviewsDoctorsSummary(), loadReviewsHospList(), loadReviewsEligible()]);
  renderRatingInputs();

  document.getElementById("reviews-refresh-btn").addEventListener("click", () => {
    Promise.all([loadReviewsDoctorsSummary(), loadReviewsHospList(), loadReviewsEligible()]).catch(() => {});
  });

  const hospSelect = document.getElementById("review-hosp-select");
  hospSelect.addEventListener("change", () => loadDoctorRatingsForHosp(hospSelect.value));

  const form = document.getElementById("new-review-form");
  const msg = document.getElementById("new-review-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "meta";
    const payload = collectReviewPayload(form);
    if (!payload.hospitalization_id) {
      msg.textContent = "Παρακαλώ επιλέξτε νοσηλεία.";
      msg.classList.add("error-msg");
      return;
    }
    try {
      await api(`/api/reviews/hospitalization/${encodeURIComponent(payload.hospitalization_id)}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      msg.textContent = "OK — η αξιολόγηση καταχωρήθηκε.";
      msg.classList.add("success-msg");
      form.reset();
      renderRatingInputs();
      document.getElementById("review-doctor-ratings").innerHTML =
        '<div class="empty">— επιλέξτε πρώτα νοσηλεία —</div>';
      await Promise.all([loadReviewsDoctorsSummary(), loadReviewsHospList(), loadReviewsEligible()]);
    } catch (err) {
      msg.textContent = `Σφάλμα: ${err.message}`;
      msg.classList.add("error-msg");
    }
  });
}

// ──────────────────────────────────────────────────────────────
// QUERIES Q1 - Q15
// ──────────────────────────────────────────────────────────────
let queryDefs = [];

async function initQueries() {
  queryDefs = await api("/api/queries");
  const select = document.getElementById("query-select");
  select.innerHTML = queryDefs.map((q) => `<option value="${q.id}">${q.id} — ${escapeHtml(q.title)}</option>`).join("");

  const onSelect = async () => {
    const def = queryDefs.find((q) => q.id === select.value);
    renderQueryParams(def);
    document.getElementById("query-notes").textContent = def.notes || "";
    document.getElementById("query-source").textContent = ` — sql/${def.id}.sql`;
    document.getElementById("query-result-meta").textContent = "";
    document.getElementById("query-results").innerHTML = "";

    const sql = await fetch(`/api/queries/${def.id}/sql`).then((r) => r.text());
    document.getElementById("query-sql").textContent = sql;
  };
  select.addEventListener("change", onSelect);
  await onSelect();

  document.getElementById("run-query-btn").addEventListener("click", async () => {
    const def = queryDefs.find((q) => q.id === select.value);
    const meta = document.getElementById("query-result-meta");
    meta.textContent = "Running...";
    meta.className = "meta";

    const payload = {};
    document.querySelectorAll("#query-params input").forEach((inp) => {
      payload[inp.name] = inp.type === "number" && inp.value ? Number(inp.value) : inp.value;
    });

    try {
      const r = await api(`/api/queries/${def.id}/run`, { method: "POST", body: JSON.stringify(payload) });
      meta.textContent = `${r.queryId} returned ${r.rowCount} row(s)`;
      meta.classList.add("success-msg");
      renderTable(document.getElementById("query-results"), r.rows);
    } catch (err) {
      meta.textContent = `Error: ${err.message}`;
      meta.classList.add("error-msg");
      document.getElementById("query-results").innerHTML = "";
    }
  });
}

function renderQueryParams(def) {
  const root = document.getElementById("query-params");
  root.innerHTML = "";
  (def.params || []).forEach((p) => {
    const wrap = document.createElement("label");
    wrap.textContent = p.label || p.name;
    const inp = document.createElement("input");
    inp.name = p.name;
    inp.type = p.type || "text";
    if (p.defaultValue !== null && p.defaultValue !== undefined) inp.value = p.defaultValue;
    else if (inp.type === "date") inp.value = new Date().toISOString().slice(0, 10);
    wrap.appendChild(inp);
    root.appendChild(wrap);
  });
}


// ──────────────────────────────────────────────────────────────
// ADMIN — Cascade Delete + Shifts
// ──────────────────────────────────────────────────────────────

const ADMIN_ENTITY_CFG = {
  patient:              { search: (q) => `/api/patients?search=${encodeURIComponent(q)}`,  keyField: "amka",       label: (r) => `${r.last_name} ${r.first_name}`, sub: (r) => `ΑΜΚΑ ${r.amka} · ${r.age}χρ` },
  doctor:               { search: (q) => `/api/doctors?search=${encodeURIComponent(q)}`,   keyField: "staff_amka", label: (r) => `${r.last_name} ${r.first_name}`, sub: (r) => `${r.specialty} · ${r.rank_}` },
  nurse:                { search: () => `/api/triage/nurses`,                               keyField: "staff_amka", label: (r) => `${r.last_name} ${r.first_name}`, sub: (r) => `${r.rank_} · ${r.department||"—"}`, clientFilter: true },
  hospitalization:      { search: () => `/api/hospitalizations?status=all`,                 keyField: "id",         label: (r) => `#${r.id} — ${r.last_name} ${r.first_name}`, sub: (r) => `${r.department} · ${(r.admission_date||"").slice(0,10)}`, clientFilter: true },
  shift:                { search: () => `/api/shifts`,                                      keyField: "id",         label: (r) => `${(r.shift_date||"").slice(0,10)} ${r.shift_type}`, sub: (r) => `${r.doctors||0}γιατ · ${r.nurses||0}νοσ · ${r.admins||0}διοικ`, clientFilter: true },
  eval_hospitalization: { search: () => `/api/reviews/hospitalizations`,                   keyField: "id",         label: (r) => `Νοσηλεία #${r.id} — ${r.last_name} ${r.first_name}`, sub: (r) => `${r.department} · ${(r.discharge_date||"").slice(0,10)}`, clientFilter: true, preFilter: (rows) => rows.filter((r) => r.has_evaluation) },
  eval_doctor:          { search: () => `/api/reviews/doctors-summary`,                    keyField: "staff_amka", label: (r) => `${r.last_name} ${r.first_name}`, sub: (r) => `${r.review_count} αξιολογήσεις · μ.ο. ${r.avg_medical_care}⭐`, clientFilter: true, compositeKey: true },
};

const IMPACT_LABELS = {
  hospitalizations: "Νοσηλείες", triage_records: "Triage", prescriptions: "Συνταγές",
  allergies: "Αλλεργίες", lab_tests: "Εξετάσεις", procedures: "Επεμβάσεις",
  hospitalization_reviews: "Αξ.νοσηλείας", doctor_reviews: "Αξ.ιατρού",
  department_assignments: "Συμμ.τμημάτων", surgeries_as_lead: "Χειρ.ως lead",
  surgeries_as_assistant: "Χειρ.ως βοηθός", reviews_received: "Αξιολογήσεις",
  shift_assignments: "Βάρδιες", supervised_residents_unlinked: "Ειδ/νοι αποσύνδεση",
  directs_departments: "Διευθύνει (BLOCK)", active_surgeries: "Ενεργ.χειρ.(BLOCK)",
  assignments: "Αναθέσεις", assistants: "Βοηθοί", eval_hospitalization: "Αξ.νοσηλείας",
  eval_doctor: "Αξ.ιατρού",
};

let _adminSelected = null;

function initAdmin() {
  const entitySel = document.getElementById("admin-entity-type");
  const searchInp = document.getElementById("admin-search-input");
  const resultsList = document.getElementById("admin-results-list");
  const impactBox = document.getElementById("admin-impact-box");
  const deleteMsg = document.getElementById("admin-delete-msg");

  // ── Entity type change ─────────────────────────────────────
  entitySel.addEventListener("change", () => {
    _adminSelected = null;
    searchInp.disabled = !entitySel.value;
    resultsList.style.display = "none";
    impactBox.style.display = "none";
    deleteMsg.textContent = "";
    if (entitySel.value) doAdminSearch("");
  });

  let _searchTimer = null;
  searchInp.addEventListener("input", (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => doAdminSearch(e.target.value.trim()), 250);
  });

  async function doAdminSearch(term) {
    const entity = entitySel.value;
    if (!entity) return;
    const cfg = ADMIN_ENTITY_CFG[entity];
    try {
      let rows = await api(cfg.search(term));
      if (cfg.preFilter) rows = cfg.preFilter(rows);
      if (cfg.clientFilter && term) {
        const t = term.toLowerCase();
        rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(t));
      }
      rows = rows.slice(0, 40);
      if (rows.length === 0) {
        resultsList.innerHTML = '<div class="empty">Καμία εγγραφή.</div>';
      } else {
        resultsList.innerHTML = rows.map((r, i) => `
          <div class="admin-result-row" data-i="${i}" style="padding:8px 10px;border-bottom:1px solid #f1f3f5;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
            <div><div>${escapeHtml(cfg.label(r))}</div><div class="muted">${escapeHtml(cfg.sub(r))}</div></div>
            <button class="linkish admin-select-btn" data-i="${i}">Επιλογή</button>
          </div>`).join("");
        resultsList.querySelectorAll(".admin-select-btn").forEach((btn) => {
          btn.addEventListener("click", () => selectAdminItem(rows[Number(btn.dataset.i)], cfg));
        });
      }
      resultsList.style.display = "block";
    } catch (err) {
      resultsList.innerHTML = `<div class="empty error-msg">${escapeHtml(err.message)}</div>`;
      resultsList.style.display = "block";
    }
  }

  async function selectAdminItem(item, cfg) {
    _adminSelected = { item, cfg };
    const key = item[cfg.keyField];
    const impactList = document.getElementById("admin-impact-list");
    const evalDocList = document.getElementById("admin-eval-doctor-list");
    evalDocList.style.display = "none";
    impactList.innerHTML = '<li class="muted">Υπολογισμός...</li>';
    impactBox.style.display = "block";
    deleteMsg.textContent = "";
    document.getElementById("admin-confirm-delete").disabled = false;

    try {
      if (cfg.compositeKey) {
        // eval_doctor: load list of individual reviews
        const data = await api(`/api/reviews/doctor/${encodeURIComponent(key)}`);
        impactList.innerHTML = `<li>Ιατρός: <strong>${escapeHtml(item.last_name + " " + item.first_name)}</strong></li>
          <li>Επιλέξτε αξιολογήσεις προς διαγραφή:</li>`;
        if (data.reviews && data.reviews.length > 0) {
          evalDocList.style.display = "block";
          evalDocList.innerHTML = data.reviews.map((r) => `
            <label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.85rem;cursor:pointer;">
              <input type="checkbox" class="eval-doc-cb" data-hosp="${r.hospitalization_id}" data-amka="${escapeHtml(key)}">
              Νοσηλεία #${r.hospitalization_id} · ${(r.admission_date||"").slice(0,10)} ·
              <strong>${"★".repeat(r.medical_care)}${"☆".repeat(5-r.medical_care)}</strong>
            </label>`).join("") +
            `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.85rem;cursor:pointer;margin-top:4px;">
              <input type="checkbox" id="eval-doc-select-all"> <em>Επιλογή όλων</em>
            </label>`;
          document.getElementById("eval-doc-select-all")?.addEventListener("change", (e) => {
            document.querySelectorAll(".eval-doc-cb").forEach((cb) => (cb.checked = e.target.checked));
          });
        }
      } else {
        const data = await api(`/api/admin/impact/${entitySel.value}/${encodeURIComponent(key)}`);
        const entries = Object.entries(data.impact || {}).filter(([, v]) => v > 0);
        if (entries.length === 0) {
          impactList.innerHTML = '<li class="muted">Δεν υπάρχουν εξαρτημένες εγγραφές.</li>';
        } else {
          impactList.innerHTML = entries
            .map(([k, v]) => `<li><strong>${v}</strong> ${IMPACT_LABELS[k] || k}</li>`)
            .join("");
        }
      }
    } catch (err) {
      impactList.innerHTML = `<li class="error-msg">${escapeHtml(err.message)}</li>`;
    }
  }

  document.getElementById("admin-cancel-delete").addEventListener("click", () => {
    _adminSelected = null;
    impactBox.style.display = "none";
    deleteMsg.textContent = "";
  });

  document.getElementById("admin-confirm-delete").addEventListener("click", async () => {
    if (!_adminSelected) return;
    if (!confirm("Είσαι σίγουρος; Η ενέργεια είναι μη αναστρέψιμη.")) return;
    const { item, cfg } = _adminSelected;
    const entity = entitySel.value;
    const key = item[cfg.keyField];
    const btn = document.getElementById("admin-confirm-delete");
    btn.disabled = true;
    deleteMsg.textContent = ""; deleteMsg.className = "meta";

    try {
      if (cfg.compositeKey) {
        const checked = [...document.querySelectorAll(".eval-doc-cb:checked")];
        if (checked.length === 0) throw new Error("Επίλεξε τουλάχιστον μία αξιολόγηση.");
        let deleted = 0;
        for (const cb of checked) {
          const r = await api(`/api/admin/delete/eval_doctor/${encodeURIComponent(cb.dataset.hosp)}/${encodeURIComponent(cb.dataset.amka)}`, { method: "DELETE" });
          deleted += r.deleted?.eval_doctor || 0;
        }
        deleteMsg.textContent = `OK — διαγράφηκαν ${deleted} αξιολόγηση(εις).`;
      } else {
        const r = await api(`/api/admin/delete/${entity}/${encodeURIComponent(key)}`, { method: "DELETE" });
        const summary = Object.entries(r.deleted || {}).filter(([,v])=>v>0).map(([k,v])=>`${IMPACT_LABELS[k]||k}:${v}`).join(", ");
        deleteMsg.textContent = `OK — διαγράφηκε. ${summary}`;
      }
      deleteMsg.classList.add("success-msg");
      _adminSelected = null;
      impactBox.style.display = "none";
      resultsList.style.display = "none";
      searchInp.value = "";
    } catch (err) {
      deleteMsg.textContent = `Σφάλμα: ${err.message}`;
      deleteMsg.classList.add("error-msg");
    } finally {
      btn.disabled = false;
    }
  });

  // ── Shifts ────────────────────────────────────────────────
  const shiftDate = document.getElementById("shift-date");
  const shiftType = document.getElementById("shift-type");
  const shiftDept = document.getElementById("shift-dept");
  shiftDate.value = new Date().toISOString().slice(0, 10);

  // Load departments into shift form
  api("/api/departments").then((depts) => {
    shiftDept.innerHTML = depts.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
  }).catch(() => {});

  let _shiftStaff = [];
  let _selectedAmkas = new Set();

  function renderShiftStaff() {
    const list = document.getElementById("shift-staff-list");
    list.innerHTML = _shiftStaff.map((s) => {
      const sub = s.staff_type === "Doctor" ? `${s.specialty} · ${s.doctor_rank}`
                : s.staff_type === "Nurse"  ? s.nurse_rank : s.admin_role;
      const sel = _selectedAmkas.has(s.amka);
      return `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid #f1f3f5;cursor:pointer;background:${sel?"#eff6ff":"#fff"};">
        <input type="checkbox" class="shift-cb" data-amka="${escapeHtml(s.amka)}" ${sel?"checked":""}>
        <span style="font-size:0.75rem;padding:1px 6px;border-radius:10px;background:${s.staff_type==="Doctor"?"#dbeafe":s.staff_type==="Nurse"?"#d1fae5":"#fef3c7"};color:#1d2733;">${s.staff_type}</span>
        <strong>${escapeHtml(s.last_name + " " + s.first_name)}</strong>
        <span class="muted">${escapeHtml(sub||"")}</span>
      </label>`;
    }).join("");
    list.querySelectorAll(".shift-cb").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        if (e.target.checked) _selectedAmkas.add(e.target.dataset.amka);
        else _selectedAmkas.delete(e.target.dataset.amka);
        updateShiftCounts();
      });
    });
    updateShiftCounts();
  }

  function updateShiftCounts() {
    const sel = _shiftStaff.filter((s) => _selectedAmkas.has(s.amka));
    const doc = sel.filter((s)=>s.staff_type==="Doctor").length;
    const nur = sel.filter((s)=>s.staff_type==="Nurse").length;
    const adm = sel.filter((s)=>s.staff_type==="Admin").length;
    const SENIOR = ["Επιμελητής Α'", "Διευθυντής"];
    const hasSr = sel.some((s)=>s.staff_type==="Doctor"&&SENIOR.includes(s.doctor_rank));
    const hasRes = sel.some((s)=>s.staff_type==="Doctor"&&s.doctor_rank==="Ειδικευόμενος");
    const ok = (n, min) => `<span style="padding:3px 8px;border-radius:6px;font-size:0.82rem;background:${n>=min?"#d1fae5":"#fef3c7"};color:${n>=min?"#065f46":"#92400e"};">${n}/${min}</span>`;
    document.getElementById("shift-counts").innerHTML =
      `${ok(doc,3)} Ιατροί ${ok(nur,6)} Νοσηλευτές ${ok(adm,2)} Διοικ.` +
      (hasRes&&!hasSr ? ` <span style="color:#b91c1c;font-size:0.82rem;">⚠ Senior απαιτείται</span>` : "");
  }

  document.getElementById("shift-autofill-btn").addEventListener("click", async () => {
    if (!shiftDate.value || !shiftDept.value) { alert("Συμπλήρωσε ημερομηνία και τμήμα."); return; }
    const warn = document.getElementById("shift-autofill-warning");
    warn.textContent = "Αναζήτηση..."; warn.className = "meta";
    document.getElementById("shift-staff-box").style.display = "block";
    try {
      const data = await api("/api/shifts/autofill", { method: "POST", body: JSON.stringify({
        shift_date: shiftDate.value, shift_type: shiftType.value, department_id: Number(shiftDept.value)
      })});
      _selectedAmkas = new Set([...data.suggested.doctors, ...data.suggested.nurses, ...data.suggested.admins].map((s)=>s.amka));
      // Load full staff list for the dept
      _shiftStaff = await api(`/api/shifts/staff/by-department?department_id=${shiftDept.value}`);
      warn.textContent = data.warnings.length ? "⚠ " + data.warnings.join(" · ") : "✓ Πλήρης κάλυψη με βάση τους triggers";
      warn.className = data.warnings.length ? "meta error-msg" : "meta success-msg";
      renderShiftStaff();
    } catch (err) {
      warn.textContent = `Σφάλμα: ${err.message}`; warn.className = "meta error-msg";
    }
  });

  document.getElementById("shift-manual-btn").addEventListener("click", async () => {
    if (!shiftDept.value) { alert("Επίλεξε τμήμα."); return; }
    document.getElementById("shift-staff-box").style.display = "block";
    document.getElementById("shift-autofill-warning").textContent = "Χειροκίνητη επιλογή — στόχος 3/6/2.";
    _selectedAmkas.clear();
    _shiftStaff = await api(`/api/shifts/staff/by-department?department_id=${shiftDept.value}`).catch(()=>[]);
    renderShiftStaff();
  });

  document.getElementById("shift-cancel-btn").addEventListener("click", () => {
    document.getElementById("shift-staff-box").style.display = "none";
    _selectedAmkas.clear(); _shiftStaff = [];
  });

  document.getElementById("shift-submit-btn").addEventListener("click", async () => {
    if (_selectedAmkas.size === 0) { alert("Επίλεξε τουλάχιστον ένα μέλος."); return; }
    const msg = document.getElementById("shift-submit-msg");
    msg.textContent = "Υποβολή..."; msg.className = "meta";
    document.getElementById("shift-submit-btn").disabled = true;
    try {
      const r = await api("/api/shifts", { method: "POST", body: JSON.stringify({
        shift_date: shiftDate.value, shift_type: shiftType.value,
        department_id: Number(shiftDept.value), staff_amkas: [..._selectedAmkas]
      })});
      msg.textContent = `OK — Βάρδια #${r.shift_id} με ${r.assigned} άτομα.`;
      msg.classList.add("success-msg");
      document.getElementById("shift-staff-box").style.display = "none";
      _selectedAmkas.clear(); _shiftStaff = [];
    } catch (err) {
      msg.textContent = `Σφάλμα: ${err.message}`; msg.classList.add("error-msg");
      document.getElementById("shift-submit-btn").disabled = false;
    }
  });
}

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────
async function bootstrap() {
  setupTabs();
  await loadStatus();
  await loadDashboard().catch((e) => console.error("dashboard", e));
  await initPatients().catch((e) => console.error("patients", e));
  await initDoctors().catch((e) => console.error("doctors", e));
  await initHospitalizations().catch((e) => console.error("hospitalizations", e));
  await initPrescriptions().catch((e) => console.error("prescriptions", e));
  await initTriage().catch((e) => console.error("triage", e));
  await initReviews().catch((e) => console.error("reviews", e));
  await initQueries().catch((e) => console.error("queries", e));
  initAdmin();
}

bootstrap().catch((err) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="meta" style="padding:20px;color:#b91c1c;">Startup error: ${err.message}</div>`
  );
});