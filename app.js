// -------- helpers ----------
const $ = (id) => document.getElementById(id);
const msg = $("msg"), tbody = $("tbody"), canvas = $("chart"), ctx = canvas.getContext("2d");

function isNum(v) { return Number.isFinite(Number(v)); }
function markBad(el, bad) { if (!el) return; el.classList.toggle("bad", !!bad); }

// -------- validación ----------
function validar() {
    const elX0 = $("x0"), elK = $("k"), elG = $("g"), elC = $("c"), elN = $("n");
    const x0 = Number(elX0.value), k = Number(elK.value), g = Number(elG.value),
        c = Number(elC.value), n = Number(elN.value);

    [elX0, elK, elG, elC, elN].forEach(e => markBad(e, false));
    const errs = [];

    // enteros
    if (!isNum(x0) || !Number.isInteger(x0)) { errs.push("Semilla X₀ debe ser un número entero (sin decimales)."); markBad(elX0, true); }
    if (!isNum(k) || !Number.isInteger(k)) { errs.push("k debe ser un número entero (sin decimales)."); markBad(elK, true); }
    if (!isNum(g) || !Number.isInteger(g)) { errs.push("g debe ser un número entero (sin decimales)."); markBad(elG, true); }
    if (!isNum(c) || !Number.isInteger(c)) { errs.push("c debe ser un número entero (sin decimales)."); markBad(elC, true); }
    if (!isNum(n) || !Number.isInteger(n)) { errs.push("N (cantidad) debe ser un número entero (sin decimales)."); markBad(elN, true); }

    // parámetros derivados
    const a = 1 + 4 * k;
    const m = 2 ** g;

    if (g <= 0) { errs.push("g debe ser mayor que 0. Con g>0 se obtiene m = 2^g > 1."); markBad(elG, true); }
    if (!(0 <= x0 && x0 < m)) { errs.push(`La semilla X₀ debe estar en 0 ≤ X₀ < m. Con g=${g} ⇒ m=${m}, elija X₀ entre 0 y ${m - 1}.`); markBad(elX0, true); }
    if (n < 100) { errs.push("N (cantidad) debe ser ≥ 100. Ingrese 100 o más."); markBad(elN, true); }

    if (errs.length) {
        msg.innerHTML = `<span class="error"><ul style="margin:6px 0 0 16px;">${errs.map(e => `<li>${e}</li>`).join("")}</ul></span>`;
        return { ok: false };
    }

    if (n > 100) {
        const ok = confirm(`Generarás ${n} valores. ¿Deseas continuar?`);
        if (!ok) return { ok: false };
    }

    msg.innerHTML = `<span class="ok">Parámetros válidos. (a = ${a}, m = ${m}).</span>`;
    return { ok: true, a, c, m, x0, n };
}

// -------- LCG ----------
function lcg({ a, c, m, x0, n }) {
    let A = BigInt(a), C = BigInt(c), M = BigInt(m), X = BigInt(x0);
    const rows = [];
    const seen = new Set();
    let repeatStart = null;

    for (let k = 0; k < n; k++) {
        const Xk = X;
        if (repeatStart === null && seen.has(Number(Xk))) repeatStart = k; // primera repetición
        const Xnext = (A * Xk + C) % M;

        rows.push({
            k,
            Xk: Number(Xk),
            Xnext: Number(Xnext),
            ri: Number(Xnext) / (m - 1),     // normalización para tabla/grafico
            repeat: repeatStart !== null && k >= repeatStart
        });

        seen.add(Number(Xk));
        X = Xnext;
    }
    return rows;
}

// -------- render tabla ----------
function renderTabla(rows) {
    tbody.innerHTML = "";
    const fr = document.createDocumentFragment();
    for (const r of rows) {
        const tr = document.createElement("tr");
        tr.className = r.repeat ? "repeat" : "";
        tr.innerHTML = `<td>${r.k + 1}</td><td>${r.Xk}</td><td>${r.Xnext}</td><td>${r.ri.toFixed(4)}</td>`;
        fr.appendChild(tr);
    }
    tbody.appendChild(fr);
}

// -------- render scatter ----------
function renderScatter(rows) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // ejes
    ctx.save();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(50, H - 40); ctx.lineTo(W - 20, H - 40); ctx.stroke(); // X (índice i)
    ctx.beginPath(); ctx.moveTo(50, 20); ctx.lineTo(50, H - 40); ctx.stroke(); // Y (valor normalizado)
    ctx.fillStyle = "#94a3b8"; ctx.font = "12px system-ui";
    ctx.fillText("i", W - 30, H - 18); ctx.fillText("r", 34, 16); ctx.fillText("0", 36, H - 44); ctx.fillText("1", 36, 24);

    const left = 50, right = W - 20, top = 20, bottom = H - 40, width = right - left, height = bottom - top;
    const n = rows.length || 1;
    const cA = "#22c55e", cB = "#f59e0b"; // no repetido / repetido

    for (let j = 0; j < n; j++) {
        const r = rows[j];
        const x = left + (j / (n - 1 || 1)) * width;     // índice i
        const y = top + (1 - r.ri) * height;       // r_i ∈ [0,1]
        ctx.fillStyle = r.repeat ? cB : cA;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    // leyenda
    ctx.fillStyle = "#94a3b8"; ctx.font = "12px system-ui";
    ctx.fillText("Leyenda:", right - 150, top + 10);
    ctx.fillStyle = cA; ctx.beginPath(); ctx.arc(right - 92, top + 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#cbd5e1"; ctx.fillText(" no repetido", right - 84, top + 12);
    ctx.fillStyle = cB; ctx.beginPath(); ctx.arc(right - 92, top + 28, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#cbd5e1"; ctx.fillText(" repetido", right - 84, top + 32);

    ctx.restore();
}

// -------- acciones ----------
function generar() {
    const val = validar();
    if (!val.ok) return;
    const rows = lcg(val);
    renderTabla(rows);
    renderScatter(rows);
}
function reiniciar() {
    $("x0").value = 6; $("k").value = 3; $("g").value = 3; $("c").value = 7; $("n").value = 120;
    tbody.innerHTML = ""; ctx.clearRect(0, 0, canvas.width, canvas.height); msg.textContent = "";
    renderScatter([]); // ejes vacíos
}

// init
$("btnGenerar").addEventListener("click", generar);
$("btnReiniciar").addEventListener("click", reiniciar);
renderScatter([]); // dibujo ejes al inicio
