/**
 * Einmaliger Agenda-Import (für Tests und manuelle Aktualisierung).
 */
import { createAgendaImporter, getPublicAgenda, loadConfig, openDatabase } from "@tcw/core";

const config = loadConfig();

async function main(): Promise<void> {
  const database = openDatabase({ filePath: config.dbFilePath });
  const importer = createAgendaImporter(config, database);
  const count = await importer.importAgenda();
  console.log(`Agenda importiert: ${count} Events.`);
  const agenda = getPublicAgenda(database);
  console.log(`Laufend/bevorstehend: ${agenda.events.length}`);
  for (const event of agenda.events) {
    console.log(`  ${event.dateLabel}  ${event.title}  [${event.category}]` + (event.registrationLabel ? `  · ${event.registrationLabel}` : ""));
  }
  database.close();
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
