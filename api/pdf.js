// api/pdf.js
// Requiere: puppeteer-core y @sparticuz/chromium en package.json (dependencies)

const fs = require("fs");
const path = require("path");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

/* Utilidades pequeñas */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function num(n, dec = 2) {
  const x = Number(n || 0);
  return x.toFixed(dec);
}
function formatPEN(n) {
  const v = Number(n || 0);
  return `S/ ${v.toFixed(2)}`;
}
function todayPE() {
  const d = new Date();
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function rowsToHTML(filas = []) {
  return filas
    .map(
      (r) => `
    <tr>
      <td>${esc(r.fecha)}</td>
      <td>${esc(r.dia)}</td>
      <td>${esc(r.tutor)}</td>
      <td>${esc(r.modalidad)}</td>
      <td class="num">${num(r.horas)}</td>
      <td class="num">${num(r.precioHora)}</td>
      <td class="num strong">${formatPEN(r.importe)}</td>
    </tr>
  `
    )
    .join("");
}

module.exports = async (req, res) => {
  try {
    /* ============================
       PASO 1: PRUEBA RÁPIDA (?test=1)
       ============================ */
    if (req.method === "GET" && req.query.test === "1") {
      const executablePath = await chromium.executablePath();
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
      });

      const page = await browser.newPage();
      await page.setContent(
        `
        <!doctype html><html><body style="font-family:system-ui; padding:24px">
          <h1>PDF OK</h1>
          <p>Render básico sin plantilla. Puppeteer + Chromium están funcionando 👍</p>
          <small>${new Date().toISOString()}</small>
        </body></html>
      `,
        { waitUntil: "load" }
      );

      const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      return res.status(200).send(pdfBuffer);
    }

    /* ============================
       CARGA DE PLANTILLAS (HTML/CSS)
       ============================ */
    let htmlTpl, cssTpl;
    try {
      htmlTpl = fs.readFileSync(
        path.join(process.cwd(), "templates/proforma.html"),
        "utf8"
      );
    } catch (e) {
      return res
        .status(500)
        .json({
          error: "TEMPLATE_READ_FAIL_HTML",
          detail: String(e?.message || e),
        });
    }
    try {
      cssTpl = fs.readFileSync(
        path.join(process.cwd(), "templates/proforma.css"),
        "utf8"
      );
    } catch (e) {
      return res
        .status(500)
        .json({
          error: "TEMPLATE_READ_FAIL_CSS",
          detail: String(e?.message || e),
        });
    }

    /* ============================
       ENTRADA DE DATOS (GET demo / POST real)
       ============================ */
    let payload = {};
    if (req.method === "POST") {
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks).toString("utf8") || "{}";
        payload = JSON.parse(body);
      } catch (e) {
        return res
          .status(400)
          .json({ error: "BAD_JSON", detail: String(e?.message || e) });
      }
    } else {
      // GET demo para probar rápido sin frontend
      payload = {
        alumno: req.query.alumno || "Alumno Demo",
        tutor: req.query.tutor || "Tutor Demo",
        paquete: req.query.paquete || "5 sesiones – 7.5 h",
        filas: [
          {
            fecha: "01/12/2025",
            dia: "Lunes",
            tutor: "Juan Pérez",
            modalidad: "Presencial",
            horas: 1.5,
            precioHora: 60,
            importe: 90,
          },
          {
            fecha: "03/12/2025",
            dia: "Miércoles",
            tutor: "Juan Pérez",
            modalidad: "Presencial",
            horas: 1.5,
            precioHora: 60,
            importe: 90,
          },
          {
            fecha: "05/12/2025",
            dia: "Viernes",
            tutor: "Juan Pérez",
            modalidad: "Presencial",
            horas: 1.5,
            precioHora: 60,
            importe: 90,
          },
        ],
      };
    }

    const {
      alumno = "",
      tutor = "",
      paquete = "",
      filas = [],
      totales = {},
    } = payload;

    const totalHoras =
      totales.totalHoras ?? filas.reduce((a, b) => a + Number(b.horas || 0), 0);
    const totalImporte =
      totales.totalImporte ??
      filas.reduce((a, b) => a + Number(b.importe || 0), 0);

    const tableRows = rowsToHTML(filas);
    let html = htmlTpl
      .replace("{{INLINE_STYLES}}", `<style>${cssTpl}</style>`)
      .replace("{{FECHA_HOY}}", esc(todayPE()))
      .replace("{{ALUMNO}}", esc(alumno))
      .replace("{{TUTOR}}", esc(tutor))
      .replace("{{PAQUETE}}", esc(paquete))
      .replace("{{TABLE_ROWS}}", tableRows)
      .replace("{{TOTAL_HORAS}}", num(totalHoras))
      .replace("{{TOTAL_IMPORTE}}", esc(formatPEN(totalImporte)));

    /* ============================
       RENDER PDF (Puppeteer + Chromium)
       ============================ */
    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
    });

    await browser.close();

    const safeName = String(alumno || "Alumno").replace(/[\\/:*?"<>|]+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Proforma_${safeName}.pdf"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    // Errores genéricos (incluye puppeteer/chromium)
    return res
      .status(500)
      .json({ error: "PDF_ERROR", detail: String(e?.message || e) });
  }
};
