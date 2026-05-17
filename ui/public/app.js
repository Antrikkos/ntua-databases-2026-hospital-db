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
  const specs = await api("/api/specialties");
  const sel = document.getElementById("doctor-specialty");
  sel.innerHTML =
    '<option value="">— Όλες οι ειδικότητες —</option>' +
    specs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  document.getElementById("doctor-search-btn").addEventListener("click", loadDoctors);
  document.getElementById("doctor-specialty").addEventListener("change", loadDoctors);
  await loadDoctors();
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
                    ✓ Εξιτήριο
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
                  ➜ Νοσηλεία
                </button>
                <button class="btn-discharge linkish" data-id="${r.id}">
                  ✓ Αποχώρηση με οδηγίες
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

  document.getElementById("admit-dept-select").addEventListener("change", refreshAdmitBeds);

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
      msg.textContent = `OK — Νοσηλεία #${r.hospitalization_id} (triage #${r.triage_id}) δημιουργήθηκε.`;
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
  if (initAdmitIcd10) await initAdmitIcd10();
  if (initAdmitKen) await initAdmitKen();

  overlay.hidden = false;
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
  await initQueries().catch((e) => console.error("queries", e));
}

bootstrap().catch((err) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="meta" style="padding:20px;color:#b91c1c;">Startup error: ${err.message}</div>`
  );
});