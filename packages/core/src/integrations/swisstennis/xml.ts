/**
 * XML-Parsing der Swisstennis-Antworten.
 *
 * Swisstennis hat `outputFormat=JSON` abgeschaltet (HTTP 403, ab 2026-06-30);
 * `outputFormat=XML` liefert dieselben Daten weiter. Der Parser bildet das XML
 * exakt in die Objektform ab, die die bestehenden Mapper zuvor aus dem JSON
 * gelesen haben:
 *  - Element-Text steht unter `content` (auch bei reinen Textknoten),
 *  - Attribute werden zu direkten Feldern (ohne Präfix),
 *  - Zahlen/Booleans werden typisiert,
 *  - mehrfache gleichnamige Kinder werden zu Arrays (Mapper nutzen ohnehin
 *    `asArray`-Helfer für Einzel/Liste).
 */
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "content",
  // Wie die frühere JSON-API: reine Textelemente werden zum String, nur
  // Elemente mit Attributen/Kindern werden zum Objekt mit `content`.
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  // Swisstennis kodiert Umlaute als numerische Entities (z. B. &#246; = ö);
  // diese müssen dekodiert werden, sonst erscheint "246;" statt "ö".
  htmlEntities: true,
});

/** Parst eine Swisstennis-XML-Antwort in die von den Mappern erwartete Objektform. */
export function parseSwisstennisXml(xml: string): unknown {
  return parser.parse(xml);
}
