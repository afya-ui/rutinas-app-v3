const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheets() {
  const auth = await getAuth();
  return google.sheets({ version: "v4", auth });
}

async function readSheet(sheets, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return res.data.values || [];
}

function normalize(v) {
  return String(v || "").toLowerCase().trim();
}

function normalizeKey(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sameKey(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

function cleanList(v) {
  return normalize(v)
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function mapCategoria(c) {
  c = normalize(c);

  if (c.includes("derma")) return "dermato";
  if (c.includes("suplement")) return "suplementos";
  if (c.includes("ejercicio")) return "ejercicio";
  if (c.includes("bienestar")) return "bienestar";
  if (c.includes("sue")) return "sueno";
  if (c.includes("wellness")) return "wellness";

  return "wellness";
}

const CAT_LABEL = {
  dermato: "Derma",
  derma: "Derma",
  suplementos: "Suplementos",
  suplemento: "Suplementos",
  ejercicio: "Ejercicio",
  bienestar: "Bienestar",
  sueno: "Sueño",
  sueño: "Sueño",
  wellness: "Wellness",
};

const TIME_LABEL = {
  manana: "Mañana",
  tarde: "Tarde",
  noche: "Noche",
};

const DAYS_ES = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];

const WELLNESS_ITEMS = [
  { nombre: "Meditación" },
  { nombre: "Sauna" },
  { nombre: "Hielos" },
];

function frecuenciaToTiempos(frecuencia) {
  let f = normalize(frecuencia)
    .replace("cada", "")
    .replace("horas", "h")
    .replace("hora", "h")
    .replace("hrs", "h")
    .replace(/\s/g, "");

  if (f === "8h" || f === "8") return ["manana", "tarde", "noche"];
  if (f === "12h" || f === "12") return ["manana", "noche"];
  if (f === "24h" || f === "24") return ["manana"];

  return ["manana"];
}

function horarioToTiempos(horario, frecuencia) {
  const h = cleanList(horario);

  if (h.length > 0) {
    return h.map(x => {
      if (x === "mañana") return "manana";
      if (x === "manana") return "manana";
      if (x === "tarde") return "tarde";
      if (x === "noche") return "noche";
      return x;
    }).filter(x => ["manana", "tarde", "noche"].includes(x));
  }

  return frecuenciaToTiempos(frecuencia);
}

function buildPlan(rows) {
  const plan = {};

  for (const row of rows) {
    const [
      nombre,
      categoria,
      frecuencia,
      horario,
      dias,
      inicio,
      duracion,
      nota,
      activo
    ] = row;

    if (!nombre) continue;
    if (["no", "false", "0", "inactivo"].includes(normalize(activo))) continue;

    const cat = mapCategoria(categoria);
    const tiempos = horarioToTiempos(horario, frecuencia);
    const diasFinal = dias && normalize(dias) !== "todos"
      ? cleanList(dias)
      : "todos";

    if (!plan[cat]) plan[cat] = { manana: {}, tarde: {}, noche: {} };

    for (const t of tiempos) {
      plan[cat][t][nombre] = {
        days: diasFinal,
        note: nota || "",
        inicio: inicio || null,
        diasCiclo: duracion ? Number(duracion) : null,
        frecuencia: frecuencia || "",
      };
    }
  }

  return plan;
}

function buildPlanItems(rows) {
  const items = [];

  for (const row of rows) {
    const [
      nombre,
      categoria,
      frecuencia,
      horario,
      dias,
      inicio,
      duracion,
      nota,
      activo
    ] = row;

    if (!nombre) continue;
    if (["no", "false", "0", "inactivo"].includes(normalize(activo))) continue;

    const cat = mapCategoria(categoria);
    const tiempos = horarioToTiempos(horario, frecuencia);
    const diasFinal = dias && normalize(dias) !== "todos"
      ? cleanList(dias)
      : "todos";

    for (const tiempo of tiempos) {
      items.push({
        categoria: cat,
        categoriaLabel: CAT_LABEL[cat] || cat,
        tiempo,
        nombre,
        days: diasFinal,
        inicio: inicio || null,
        diasCiclo: duracion ? Number(duracion) : null,
      });
    }
  }

  // Estos son los items fijos que la app muestra dentro de Wellness.
  for (const tiempo of ["manana", "tarde", "noche"]) {
    for (const w of WELLNESS_ITEMS) {
      items.push({
        categoria: "wellness",
        categoriaLabel: "Wellness",
        tiempo,
        nombre: w.nombre,
        days: "todos",
        inicio: null,
        diasCiclo: null,
        wellnessFijo: true,
      });
    }
  }

  return items;
}

function parseDateKey(value) {
  if (!value) return "";
  const s = String(value).trim();

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;

  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;

  return s;
}

function dateFromKey(key) {
  return new Date(key + "T12:00:00");
}

function keyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysKey(key, days) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + days);
  return keyFromDate(d);
}

function daysBetween(aKey, bKey) {
  return Math.round((dateFromKey(bKey) - dateFromKey(aKey)) / 86400000);
}

function getPeriodRange(periodo) {
  const now = new Date();
  const today = keyFromDate(now);

  if (periodo === "7d") {
    return {
      start: addDaysKey(today, -6),
      end: today,
      label: "Últimos 7 días",
    };
  }

  if (periodo === "mes_anterior") {
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);
    const lastPrevMonth = new Date(firstThisMonth);
    lastPrevMonth.setDate(0);
    const firstPrevMonth = new Date(lastPrevMonth.getFullYear(), lastPrevMonth.getMonth(), 1, 12);

    return {
      start: keyFromDate(firstPrevMonth),
      end: keyFromDate(lastPrevMonth),
      label: "Mes anterior",
    };
  }

  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  return {
    start: keyFromDate(firstThisMonth),
    end: today,
    label: "Este mes",
  };
}

function dayOk(item, fechaKey) {
  const dias = item.days || "todos";
  if (dias === "todos") return true;

  const dow = DAYS_ES[dateFromKey(fechaKey).getDay()];
  if (Array.isArray(dias)) return dias.includes(dow);

  return String(dias)
    .split(",")
    .map(x => normalizeKey(x))
    .includes(normalizeKey(dow));
}

function itemExpectedOnDate(item, fechaKey) {
  if (!dayOk(item, fechaKey)) return false;

  if (item.inicio) {
    const inicio = parseDateKey(item.inicio);
    if (fechaKey < inicio) return false;

    if (item.diasCiclo) {
      const diff = daysBetween(inicio, fechaKey);
      if (diff < 0 || diff >= Number(item.diasCiclo)) return false;
    }
  }

  return true;
}

function calcExpected(item, start, end) {
  let expected = 0;
  let cursor = start;

  while (cursor <= end) {
    if (itemExpectedOnDate(item, cursor)) expected++;
    cursor = addDaysKey(cursor, 1);
  }

  return expected;
}

function checkCompletedValue(v) {
  const s = normalizeKey(v);
  return ["true", "si", "yes", "1", "x", "ok", "aplicado", "completado", "done"].includes(s);
}

function checkKey(categoria, tiempo, nombre) {
  return `${normalizeKey(categoria)}||${normalizeKey(tiempo)}||${normalizeKey(nombre)}`;
}

function buildInsight(pct, fuerte, debil, horarioDebil) {
  if (pct >= 80) {
    return `Vas creando una base sólida. Tu punto más fuerte es ${fuerte || "tu constancia"} y puedes cuidar ${debil || "los detalles"} para mantener el ritmo.`;
  }
  if (pct >= 50) {
    return `Ya hay avance. Refuerza ${debil || "lo más irregular"}${horarioDebil ? `, especialmente en ${horarioDebil.toLowerCase()}` : ""}, para acercarte a resultados más claros.`;
  }
  return `Estás empezando. Enfócate en recuperar ritmo con pocas acciones clave y vuelve a aparecer hoy.`;
}

function buildRitmoReport(planRows, checkRows, periodo) {
  const { start, end, label } = getPeriodRange(periodo);
  const items = buildPlanItems(planRows);

  const byKey = {};
  for (const item of items) {
    const key = checkKey(item.categoria, item.tiempo, item.nombre);
    if (!byKey[key]) {
      byKey[key] = {
        ...item,
        esperados: 0,
        usados: 0,
      };
    }
    byKey[key].esperados += calcExpected(item, start, end);
  }

  for (const row of checkRows) {
    const [fechaRaw, categoria, tiempo, nombre, completado] = row;
    const fecha = parseDateKey(fechaRaw);
    if (!fecha || fecha < start || fecha > end) continue;
    if (!checkCompletedValue(completado)) continue;

    const key = checkKey(categoria, tiempo, nombre);
    if (!byKey[key]) {
      const cat = mapCategoria(categoria);
      byKey[key] = {
        categoria: cat,
        categoriaLabel: CAT_LABEL[cat] || cat,
        tiempo,
        nombre,
        esperados: 0,
        usados: 0,
      };
    }

    byKey[key].usados += 1;
  }

  const productos = Object.values(byKey)
    .filter(x => x.esperados > 0 || x.usados > 0)
    .map(x => {
      const pct = x.esperados ? Math.min(100, Math.round((x.usados / x.esperados) * 100)) : null;
      return {
        categoria: x.categoria,
        categoriaLabel: x.categoriaLabel || CAT_LABEL[x.categoria] || x.categoria,
        tiempo: x.tiempo,
        nombre: x.nombre,
        esperados: x.esperados,
        usados: x.usados,
        pct,
      };
    })
    .sort((a, b) => {
      const aScore = a.esperados ? a.pct : 101;
      const bScore = b.esperados ? b.pct : 101;
      if (aScore !== bScore) return aScore - bScore;
      return String(a.nombre).localeCompare(String(b.nombre));
    });

  const totalEsperados = productos.reduce((sum, p) => sum + Number(p.esperados || 0), 0);
  const totalUsados = productos.reduce((sum, p) => sum + Number(p.usados || 0), 0);
  const pct = totalEsperados ? Math.min(100, Math.round((totalUsados / totalEsperados) * 100)) : 0;

  const catMap = {};
  const timeMap = {};

  for (const p of productos) {
    if (!catMap[p.categoria]) {
      catMap[p.categoria] = {
        categoria: p.categoria,
        label: p.categoriaLabel || CAT_LABEL[p.categoria] || p.categoria,
        esperados: 0,
        usados: 0,
      };
    }
    catMap[p.categoria].esperados += Number(p.esperados || 0);
    catMap[p.categoria].usados += Number(p.usados || 0);

    if (!timeMap[p.tiempo]) {
      timeMap[p.tiempo] = {
        tiempo: p.tiempo,
        label: TIME_LABEL[p.tiempo] || p.tiempo,
        esperados: 0,
        usados: 0,
      };
    }
    timeMap[p.tiempo].esperados += Number(p.esperados || 0);
    timeMap[p.tiempo].usados += Number(p.usados || 0);
  }

  const categorias = Object.values(catMap).map(c => ({
    ...c,
    pct: c.esperados ? Math.min(100, Math.round((c.usados / c.esperados) * 100)) : 0,
  })).sort((a,b)=> b.pct - a.pct);

  const horarios = Object.values(timeMap).map(t => ({
    ...t,
    pct: t.esperados ? Math.min(100, Math.round((t.usados / t.esperados) * 100)) : 0,
  })).sort((a,b)=> b.pct - a.pct);

  const fuerte = categorias.length ? categorias[0].label : "";
  const debil = categorias.length ? categorias[categorias.length - 1].label : "";
  const mejorHorario = horarios.length ? horarios[0].label : "";
  const horarioDebil = horarios.length ? horarios[horarios.length - 1].label : "";

  return {
    periodo: periodo || "mes",
    periodoLabel: label,
    start,
    end,
    esperados: totalEsperados,
    usados: totalUsados,
    pendientes: Math.max(0, totalEsperados - totalUsados),
    pct,
    fuerte,
    debil,
    mejorHorario,
    horarioDebil,
    insight: buildInsight(pct, fuerte, debil, horarioDebil),
    categorias,
    horarios,
    productos,
  };
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const sheets = await getSheets();
    const { action, data } = JSON.parse(event.body || "{}");

    if (action === "getPlan") {
      const rows = await readSheet(sheets, "plan!A2:I");
      const plan = buildPlan(rows);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ plan }),
      };
    }

    if (action === "getChecks") {
      const { fecha } = data || {};
      const rows = await readSheet(sheets, "checks!A2:E");
      const checks = {};

      for (const row of rows) {
        const [f, categoria, tiempo, nombre, completado] = row;
        if (fecha && f !== fecha) continue;

        if (!checks[categoria]) checks[categoria] = {};
        if (!checks[categoria][tiempo]) checks[categoria][tiempo] = {};

        checks[categoria][tiempo][nombre] = checkCompletedValue(completado);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ checks }),
      };
    }

    if (action === "getRitmoReport") {
      const { periodo } = data || {};
      const [planRows, checkRows] = await Promise.all([
        readSheet(sheets, "plan!A2:I"),
        readSheet(sheets, "checks!A2:E"),
      ]);

      const report = buildRitmoReport(planRows, checkRows, periodo || "mes");

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ report }),
      };
    }

    if (action === "getUsageCounts") {
      const rows = await readSheet(sheets, "checks!A2:E");
      const usageCounts = {};

      for (const row of rows) {
        const [fecha, categoria, tiempo, nombre, completado] = row;
        if (!fecha || !categoria || !tiempo || !nombre) continue;
        if (!checkCompletedValue(completado)) continue;

        const key = checkKey(categoria, tiempo, nombre);
        usageCounts[key] = (usageCounts[key] || 0) + 1;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ usageCounts }),
      };
    }

    if (action === "getHistorial") {
      const { categoria, tiempo, nombre } = data || {};
      const rows = await readSheet(sheets, "checks!A2:E");

      const historial = [];

      for (const row of rows) {
        const [fecha, c, t, n, completado] = row;

        if (sameKey(c, categoria) && sameKey(t, tiempo) && sameKey(n, nombre)) {
          historial.push({
            fecha: parseDateKey(fecha),
            completado: checkCompletedValue(completado)
          });
        }
      }

      historial.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ historial }),
      };
    }

    if (action === "saveCheck") {
      const { fecha, categoria, tiempo, nombre, completado } = data;

      if (!fecha || !categoria || !tiempo || !nombre) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Faltan datos para guardar el check" }),
        };
      }

      const rows = await readSheet(sheets, "checks!A2:E");
      let rowNumberToUpdate = null;

      for (let i = 0; i < rows.length; i++) {
        const [f, c, t, n] = rows[i];

        if (parseDateKey(f) === parseDateKey(fecha) && sameKey(c, categoria) && sameKey(t, tiempo) && sameKey(n, nombre)) {
          rowNumberToUpdate = i + 2; // A2:E empieza en la fila 2
          break;
        }
      }

      const values = [[parseDateKey(fecha), categoria, tiempo, nombre, String(!!completado)]];

      if (rowNumberToUpdate) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `checks!A${rowNumberToUpdate}:E${rowNumberToUpdate}`,
          valueInputOption: "RAW",
          requestBody: { values },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: "checks!A:E",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Acción no válida" }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
