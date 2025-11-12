// ========= helpers y referencias =========
const $ = (id) => document.getElementById(id);
const msg = $("msg");
const tbody = $("tbody");
const canvas = $("chart");
const ctx = canvas.getContext("2d");
const testsSummary = $("tests-summary");
const btnRegenerar = $("btnRegenerar");

function isNum(v){ return Number.isFinite(Number(v)); }
function markBad(el, bad){ if(!el) return; el.classList.toggle("bad", !!bad); }

// Derivar g y m desde N
function gmFromN(n){
  const N = Math.max(2, Number(n) || 0);
  const g = Math.max(1, Math.ceil(Math.log2(N))); // g ≥ 1
  const m = 2 ** g;
  return { g, m };
}

// Mostrar línea dinámica y actualizar input m
function updateDerived(){
  const el = $("derived");
  const n = Number($("n").value);
  if (Number.isInteger(n) && n >= 1){
    const { g, m } = gmFromN(n);
    el.textContent = `Para N = ${n} ⇒ g = ${g} (m = 2^${g} = ${m}).`;
    // pintar el input m (bloqueado) con el valor calculado
    $("m").value = m;
  } else {
    el.textContent = "";
    $("m").value = "";
  }
}

// ========= validación =========
function validar(){
  const elX0=$("x0"), elK=$("k"), elC=$("c"), elN=$("n");
  const x0=Number(elX0.value), k=Number(elK.value), c=Number(elC.value), n=Number(elN.value);

  [elX0,elK,elC,elN].forEach(e=>markBad(e,false));
  const errs=[];

  if(!isNum(x0) || !Number.isInteger(x0)) { errs.push("Semilla X₀ debe ser un número entero (sin decimales)."); markBad(elX0,true); }
  if(!isNum(k)  || !Number.isInteger(k))  { errs.push("k debe ser un número entero (sin decimales)."); markBad(elK,true); }
  if(!isNum(c)  || !Number.isInteger(c))  { errs.push("c debe ser un número entero (sin decimales)."); markBad(elC,true); }
  if(!isNum(n)  || !Number.isInteger(n))  { errs.push("N (cantidad) debe ser un número entero (sin decimales)."); markBad(elN,true); }

  if(n < 100){ errs.push("N (cantidad) debe ser ≥ 100. Ingrese 100 o más."); markBad(elN,true); }

  const { g, m } = gmFromN(n);
  const a = 1 + 4*k;

  if(!(0 <= x0 && x0 < m)){
    errs.push(`La semilla X₀ debe estar en 0 ≤ X₀ < m. Con N=${n} ⇒ g=${g} ⇒ m=${m}, elija X₀ entre 0 y ${m-1}.`);
    markBad(elX0,true);
  }

  if(errs.length){
    const html = errs.map(e => `<span class="err-line">${e}</span>`).join("");
    msg.innerHTML = `<span class="error">${html}</span>`;
    return { ok:false };
  }

  if(n > 100){
    const ok = confirm(`Generarás ${n} valores (m = 2^${g} = ${m}). ¿Deseas continuar?`);
    if(!ok) return { ok:false };
  }

  // actualizar UI informativa
  msg.innerHTML = `<span class="ok">Parámetros válidos. (a = ${a}, m = ${m}, g = ${g}).</span>`;
  $("m").value = m;        // asegura que el input m muestre el valor
  updateDerived();

  return { ok:true, a, c, m, x0, n };
}

// ========= LCG =========
function lcg({ a, c, m, x0, n }){
  let A=BigInt(a), C=BigInt(c), M=BigInt(m), X=BigInt(x0);
  const rows = [];
  const seen = new Set();
  let repeatStart = null;

  for(let k=0; k<n; k++){
    const Xk = X;
    if(repeatStart===null && seen.has(Number(Xk))) repeatStart = k; // primera repetición detectada
    const Xnext = (A*Xk + C) % M;

    rows.push({
      k,
      Xk: Number(Xk),
      Xnext: Number(Xnext),
      ri: Number(Xnext) / (m - 1),          // normalización para tabla/gráfico
      repeat: repeatStart!==null && k>=repeatStart
    });

    seen.add(Number(Xk));
    X = Xnext;
  }
  return rows;
}

// ========= Pruebas de UNIFORMIDAD e INDEPENDENCIA =========

// Prueba de uniformidad: chi-cuadrado con 10 intervalos en [0,1]
function testUniformity(riList){
  const k = 10;
  const n = riList.length;
  if (n === 0) return { pass: false, chi2: 0, crit: 0 };

  const bins = new Array(k).fill(0);
  riList.forEach(v => {
    let idx = Math.floor(v * k);
    if (idx === k) idx = k - 1;
    bins[idx]++;
  });

  const expected = n / k;
  let chi2 = 0;
  for (let i = 0; i < k; i++){
    const diff = bins[i] - expected;
    chi2 += (diff * diff) / expected;
  }

  // valor crítico para chi-cuadrado con 9 grados de libertad, α=0.05 ≈ 16.92
  const chi2Crit = 16.92;
  return {
    pass: chi2 < chi2Crit,
    chi2,
    crit: chi2Crit,
    bins
  };
}

// Prueba de independencia: correlación entre r_i y r_{i+1}
function testIndependence(riList){
  const n = riList.length;
  if (n < 3) {
    return { pass: false, corr: 0 };
  }

  const m = n - 1;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < m; i++){
    const x = riList[i];
    const y = riList[i+1];
    sumX  += x;
    sumY  += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const num = m * sumXY - sumX * sumY;
  const den = Math.sqrt(
    (m * sumX2 - sumX * sumX) *
    (m * sumY2 - sumY * sumY)
  );

  const corr = den === 0 ? 0 : num / den;
  // Umbral simple: |ρ| < 0.1 ⇒ no hay correlación "evidente"
  const pass = Math.abs(corr) < 0.1;

  return { pass, corr };
}

// Ejecuta ambas pruebas y actualiza la UI
function runTests(rows){
  if (!testsSummary || !rows || rows.length === 0){
    if (testsSummary) testsSummary.innerHTML = "";
    if (btnRegenerar) btnRegenerar.disabled = true;
    return;
  }

  const riList = rows.map(r => r.ri);

  const uni = testUniformity(riList);
  const indep = testIndependence(riList);
  const globalPass = uni.pass && indep.pass;

  const uniText = uni.pass ? "Aprobada" : "No aprobada";
  const indepText = indep.pass ? "Aprobada" : "No aprobada";
  const globalText = globalPass
    ? "Los números generados SON válidos según las pruebas."
    : "Los números generados NO son válidos según las pruebas.";

  testsSummary.innerHTML = `
    <p><strong>Prueba de uniformidad</strong>:
      <span class="${uni.pass ? "pass" : "fail"}">${uniText}</span>
      (χ² = ${uni.chi2.toFixed(2)}, crítico ≈ ${uni.crit.toFixed(2)})
    </p>
    <p><strong>Prueba de independencia</strong>:
      <span class="${indep.pass ? "pass" : "fail"}">${indepText}</span>
      (ρ ≈ ${indep.corr.toFixed(3)}, se acepta si |ρ| &lt; 0.1)
    </p>
    <p class="global">
      <strong>Conclusión:</strong>
      <span class="${globalPass ? "pass" : "fail"}">${globalText}</span>
    </p>
  `;

  // Botón de regenerar: solo habilitado si NO pasan las pruebas
  if (btnRegenerar){
    btnRegenerar.disabled = globalPass;
  }
}

// ========= render de tabla =========
function renderTabla(rows){
  tbody.innerHTML = "";
  const fr = document.createDocumentFragment();
  for(const r of rows){
    const tr = document.createElement("tr");
    tr.className = r.repeat ? "repeat" : "";
    tr.innerHTML = `<td>${r.k+1}</td><td>${r.Xk}</td><td>${r.Xnext}</td><td>${r.ri.toFixed(4)}</td>`;
    fr.appendChild(tr);
  }
  tbody.appendChild(fr);
}

// ========= render del scatter =========
function renderScatter(rows){
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);

  // ejes
  ctx.save();
  ctx.strokeStyle = "#2b3b64"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(50,H-40); ctx.lineTo(W-20,H-40); ctx.stroke(); // X (índice i)
  ctx.beginPath(); ctx.moveTo(50,20);   ctx.lineTo(50,H-40);   ctx.stroke(); // Y (valor)
  ctx.fillStyle = "#a9b4c6"; ctx.font = "12px system-ui";
  ctx.fillText("i", W-30, H-18); ctx.fillText("r", 34, 16); ctx.fillText("0", 36, H-44); ctx.fillText("1", 36, 24);

  const left=50, right=W-20, top=20, bottom=H-40, width=right-left, height=bottom-top;
  const n=rows.length || 1;

  // colores de puntos (elegantes)
  const cA = "#ffffff";  // no repetido
  const cB = "#60a5fa";  // repetido (celeste)

  for(let j=0;j<n;j++){
    const r = rows[j];
    const x = left + (j/(n-1||1))*width;     // índice i
    const y = top + (1 - r.ri)*height;       // r_i ∈ [0,1]
    ctx.fillStyle = r.repeat ? cB : cA;
    ctx.beginPath(); ctx.arc(x,y,2.2,0,Math.PI*2); ctx.fill();
  }

  // leyenda
  ctx.fillStyle="#a9b4c6"; ctx.font="12px system-ui";
  ctx.fillText("Leyenda:", right-150, top+10);
  ctx.fillStyle=cA; ctx.beginPath(); ctx.arc(right-92, top+8, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="#dbe7ff"; ctx.fillText(" no repetido", right-84, top+12);
  ctx.fillStyle=cB; ctx.beginPath(); ctx.arc(right-92, top+28, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="#dbe7ff"; ctx.fillText(" repetido", right-84, top+32);

  ctx.restore();
}

// ========= acciones =========
function generar(){
  const val = validar();
  if(!val.ok) return;
  const rows = lcg(val);      // genera EXACTAMENTE n filas
  renderTabla(rows);
  renderScatter(rows);
  runTests(rows);             // ejecutar pruebas al generar
}

function reiniciar(){
  $("x0").value=6; $("k").value=3; $("c").value=7; $("n").value=120;
  tbody.innerHTML="";
  ctx.clearRect(0,0,canvas.width,canvas.height);
  msg.textContent="";
  renderScatter([]); // ejes vacíos
  updateDerived();

  if (testsSummary) testsSummary.innerHTML = "";
  if (btnRegenerar) btnRegenerar.disabled = true;
}

// init
$("btnGenerar").addEventListener("click", generar);
$("btnReiniciar").addEventListener("click", reiniciar);
$("n").addEventListener("input", updateDerived);

if (btnRegenerar){
  btnRegenerar.addEventListener("click", () => {
    // Simplemente vuelve a generar con los parámetros actuales
    generar();
  });
}

updateDerived();          // pinta “Para N = … ⇒ g = … (m = 2^g = …)”
renderScatter([]);        // dibujo ejes al inicio
