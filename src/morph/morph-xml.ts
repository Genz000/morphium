/**
 * Minimal XML element tree for SVG geometry: elements and attributes only, text is ignored.
 * Stored flat (children are node indexes) to keep the type non-recursive.
 */
export type XmlNode = { name: string; attrs: Record<string, string>; children: number[] };
export type XmlDocument = { nodes: XmlNode[]; root: number };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Local name without a namespace prefix (`svg:path` → `path`). */
const localName = (name: string) => name.slice(name.indexOf(":") + 1);

export function parseXml(source: string): XmlDocument | null {
  const nodes: XmlNode[] = [{ name: "#document", attrs: {}, children: [] }];
  const open: number[] = [0];
  const current = () => nodes[open[open.length - 1]];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const lt = source.indexOf("<", i);
    if (lt < 0) break;
    if (source.startsWith("<!--", lt)) { const end = source.indexOf("-->", lt + 4); i = end < 0 ? n : end + 3; continue; }
    if (source.startsWith("<![CDATA[", lt)) { const end = source.indexOf("]]>", lt + 9); i = end < 0 ? n : end + 3; continue; }
    if (source.startsWith("<?", lt)) { const end = source.indexOf("?>", lt + 2); i = end < 0 ? n : end + 2; continue; }
    if (source.startsWith("<!", lt)) {
      // DOCTYPE, possibly with an internal subset in brackets.
      let depth = 0, j = lt + 2;
      for (; j < n; j++) {
        if (source[j] === "[") depth++;
        else if (source[j] === "]") depth = Math.max(0, depth - 1);
        else if (source[j] === ">" && depth <= 0) break;
      }
      i = j + 1;
      continue;
    }
    if (source[lt + 1] === "/") {
      const end = source.indexOf(">", lt);
      const name = localName(source.slice(lt + 2, end < 0 ? n : end).trim());
      const at = open.map((index) => nodes[index].name).lastIndexOf(name);
      if (at > 0) open.length = at;
      i = end < 0 ? n : end + 1;
      continue;
    }
    // Opening tag: read name, then attributes with quoted values.
    let j = lt + 1;
    while (j < n && !/[\s/>]/.test(source[j])) j++;
    const element: XmlNode = { name: localName(source.slice(lt + 1, j)), attrs: {}, children: [] };
    let selfClosing = false;
    while (j < n) {
      while (j < n && /\s/.test(source[j])) j++;
      if (source[j] === ">") { j++; break; }
      if (source[j] === "/" && source[j + 1] === ">") { selfClosing = true; j += 2; break; }
      const nameStart = j;
      while (j < n && !/[\s=/>]/.test(source[j])) j++;
      const attrName = source.slice(nameStart, j);
      while (j < n && /\s/.test(source[j])) j++;
      let value = "";
      if (source[j] === "=") {
        j++;
        while (j < n && /\s/.test(source[j])) j++;
        const quote = source[j];
        if (quote === '"' || quote === "'") {
          const end = source.indexOf(quote, j + 1);
          value = source.slice(j + 1, end < 0 ? n : end);
          j = end < 0 ? n : end + 1;
        } else {
          const start = j;
          while (j < n && !/[\s>]/.test(source[j])) j++;
          value = source.slice(start, j);
        }
      }
      if (attrName) element.attrs[attrName] = decodeEntities(value);
      if (j === nameStart) j++;
    }
    nodes.push(element);
    current().children.push(nodes.length - 1);
    if (!selfClosing) open.push(nodes.length - 1);
    i = j;
  }
  const svg = nodes[0].children.find((index) => nodes[index].name === "svg");
  return svg === undefined ? null : { nodes, root: svg };
}

export function findById(doc: XmlDocument, id: string): XmlNode | null {
  return doc.nodes.find((node) => node.attrs.id === id) ?? null;
}
