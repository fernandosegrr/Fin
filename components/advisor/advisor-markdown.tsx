"use client";

import React from "react";

interface Props {
  content: string;
}

const REGEX_MONTO = /^-?\$?\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:MXN|pesos|%))?$/i;

export function renderInlineMarkdown(texto: string): React.ReactNode[] {
  const nodos: React.ReactNode[] = [];
  // Captura: `código`, **negrita**, *cursiva*
  const patron = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let ultimoIndice = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = patron.exec(texto)) !== null) {
    if (match.index > ultimoIndice) {
      nodos.push(texto.slice(ultimoIndice, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      const inner = token.slice(1, -1);
      nodos.push(
        <code
          key={`c-${key++}`}
          className="px-1.5 py-0.5 rounded-md bg-[#E8EEE7] border border-[#D4DFD3] text-[#1C3028] font-mono text-[11px] font-semibold"
        >
          {inner}
        </code>,
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      const inner = token.slice(2, -2);
      const esMonto = REGEX_MONTO.test(inner.trim());
      nodos.push(
        <strong
          key={`b-${key++}`}
          className={
            esMonto
              ? "font-extrabold text-[#184E37] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md tabular-nums"
              : "font-bold text-[#1C3028]"
          }
        >
          {inner}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const inner = token.slice(1, -1);
      nodos.push(
        <em key={`i-${key++}`} className="italic text-[#3B5246]">
          {inner}
        </em>,
      );
    }
    ultimoIndice = patron.lastIndex;
  }

  if (ultimoIndice < texto.length) {
    nodos.push(texto.slice(ultimoIndice));
  }

  return nodos;
}

function partirFilaTabla(linea: string): string[] {
  const limpia = linea.trim().replace(/^\|/, "").replace(/\|$/, "");
  return limpia.split("|").map((celda) => celda.trim());
}

function esSeparadorTabla(linea: string): boolean {
  const limpia = linea.trim();
  if (!limpia.includes("|") && !limpia.includes("-")) return false;
  const celdas = partirFilaTabla(limpia);
  return celdas.length > 0 && celdas.every((c) => /^:?-{2,}:?$/.test(c));
}

export function AdvisorMarkdown({ content }: Props) {
  const lineas = content.replace(/\r\n/g, "\n").split("\n");
  const bloques: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lineas.length) {
    const linea = lineas[i];
    const trim = linea.trim();

    if (!trim) {
      i++;
      continue;
    }

    // 1. Bloque de código ```
    if (trim.startsWith("```")) {
      const codigoLineas: string[] = [];
      i++;
      while (i < lineas.length && !lineas[i].trim().startsWith("```")) {
        codigoLineas.push(lineas[i]);
        i++;
      }
      if (i < lineas.length) i++;
      bloques.push(
        <pre
          key={`pre-${blockKey++}`}
          className="rounded-xl bg-[#1C3028] text-[#ECF3EE] p-3 text-xs font-mono overflow-x-auto my-2"
        >
          <code>{codigoLineas.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // 2. Línea divisoria ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trim)) {
      bloques.push(<hr key={`hr-${blockKey++}`} className="border-t border-[#DCE4DB] my-2.5" />);
      i++;
      continue;
    }

    // 3. Encabezados #, ##, ###, ####
    const matchHeader = /^(#{1,4})\s+(.+)$/.exec(trim);
    if (matchHeader) {
      const nivel = matchHeader[1].length;
      const textoHeader = matchHeader[2];
      const claseNivel =
        nivel === 1
          ? "text-sm sm:text-base font-black text-[#1C3028] mt-3 mb-1.5 pb-1 border-b border-[#DCE4DB]"
          : nivel === 2
            ? "text-xs sm:text-sm font-black text-[#1C3028] mt-3 mb-1 flex items-center gap-1.5"
            : "text-xs sm:text-[13px] font-extrabold text-[#286F50] mt-2.5 mb-1";
      bloques.push(
        <div key={`h-${blockKey++}`} className={claseNivel}>
          {renderInlineMarkdown(textoHeader)}
        </div>,
      );
      i++;
      continue;
    }

    // 4. Tabla Markdown
    if (trim.includes("|") && i + 1 < lineas.length && esSeparadorTabla(lineas[i + 1])) {
      const encabezados = partirFilaTabla(trim);
      const alineaciones = partirFilaTabla(lineas[i + 1]).map((sep) => {
        if (sep.startsWith(":") && sep.endsWith(":")) return "center";
        if (sep.endsWith(":")) return "right";
        return "left";
      });
      i += 2;
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].trim().includes("|") && !esSeparadorTabla(lineas[i])) {
        filas.push(partirFilaTabla(lineas[i]));
        i++;
      }

      bloques.push(
        <div
          key={`tbl-${blockKey++}`}
          className="my-2.5 overflow-x-auto rounded-xl border border-[#DCE4DB] bg-white shadow-sm"
        >
          <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-[#EFF4EE] border-b border-[#DCE4DB] text-[#1C3028]">
                {encabezados.map((col, idx) => (
                  <th
                    key={idx}
                    className={`px-3 py-2 font-extrabold whitespace-nowrap ${
                      alineaciones[idx] === "right"
                        ? "text-right"
                        : alineaciones[idx] === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {renderInlineMarkdown(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EEE7]">
              {filas.map((fila, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#F7F9F5] transition-colors">
                  {encabezados.map((_, cIdx) => {
                    const valorCelda = fila[cIdx] ?? "";
                    const pareceNumero = REGEX_MONTO.test(valorCelda.replace(/\*\*/g, "").trim());
                    const align =
                      alineaciones[cIdx] === "right" || pareceNumero
                        ? "text-right tabular-nums"
                        : alineaciones[cIdx] === "center"
                          ? "text-center"
                          : "text-left";
                    return (
                      <td key={cIdx} className={`px-3 py-2 text-[#263D33] ${align}`}>
                        {renderInlineMarkdown(valorCelda)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 5. Blockquote / Callout >
    if (trim.startsWith(">")) {
      const lineasCita: string[] = [];
      while (i < lineas.length && lineas[i].trim().startsWith(">")) {
        lineasCita.push(lineas[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      bloques.push(
        <blockquote
          key={`bq-${blockKey++}`}
          className="my-2 rounded-r-xl border-l-4 border-[#286F50] bg-emerald-500/10 px-3.5 py-2.5 text-xs sm:text-[13px] text-[#1C3028] font-medium"
        >
          {lineasCita.map((l, idx) => (
            <p key={idx} className={idx > 0 ? "mt-1" : ""}>
              {renderInlineMarkdown(l)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // 6. Lista con viñetas (-, *, •)
    if (/^([-*•])\s+/.test(trim)) {
      const items: string[] = [];
      while (i < lineas.length && /^([-*•])\s+/.test(lineas[i].trim())) {
        items.push(lineas[i].trim().replace(/^([-*•])\s+/, ""));
        i++;
      }
      bloques.push(
        <ul key={`ul-${blockKey++}`} className="my-1.5 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[#263D33]">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#286F50] shrink-0" />
              <span className="flex-1 leading-relaxed">{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // 7. Lista numerada (1., 2.)
    if (/^\d+\.\s+/.test(trim)) {
      const items: { num: string; texto: string }[] = [];
      while (i < lineas.length && /^\d+\.\s+/.test(lineas[i].trim())) {
        const m = /^(\d+)\.\s+(.+)$/.exec(lineas[i].trim());
        if (m) items.push({ num: m[1], texto: m[2] });
        i++;
      }
      bloques.push(
        <ol key={`ol-${blockKey++}`} className="my-1.5 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[#263D33]">
              <span className="inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-md bg-emerald-500/15 text-[#286F50] text-[10px] font-extrabold shrink-0 mt-0.5">
                {item.num}
              </span>
              <span className="flex-1 leading-relaxed">{renderInlineMarkdown(item.texto)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // 8. Párrafo normal
    const parrafoLineas: string[] = [];
    while (
      i < lineas.length &&
      lineas[i].trim() !== "" &&
      !lineas[i].trim().startsWith("```") &&
      !lineas[i].trim().startsWith(">") &&
      !/^(#{1,4})\s+/.test(lineas[i].trim()) &&
      !/^([-*•])\s+/.test(lineas[i].trim()) &&
      !/^\d+\.\s+/.test(lineas[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lineas[i].trim()) &&
      !(lineas[i].trim().includes("|") && i + 1 < lineas.length && esSeparadorTabla(lineas[i + 1]))
    ) {
      parrafoLineas.push(lineas[i]);
      i++;
    }
    bloques.push(
      <p key={`p-${blockKey++}`} className="leading-relaxed text-[#263D33]">
        {parrafoLineas.map((l, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInlineMarkdown(l)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return <div className="space-y-2">{bloques}</div>;
}
