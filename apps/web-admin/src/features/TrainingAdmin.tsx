/**
 * Trainingsraster: Wochentage als Tabs, 30-Minuten-Zeilen (18:00–22:00),
 * Plätze 1–4 als Spalten. Ein Speichern-Button sichert alle Änderungen.
 * Aufeinanderfolgende gleiche Zellen werden zu einem Slot zusammengefasst.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import {
  PUBLIC_TRAINING_COURTS,
  TRAINING_DAYS,
  TRAINING_GRID_SLOTS,
  type AdminTeam,
  type AdminTrainingSlot,
  type TrainingDay,
} from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import { useAsync } from "../useAsync.js";
import { useMutation } from "../useMutation.js";
import { StatusMessage } from "../components/Status.js";

const LABEL_PRIORITY = ["12h", "JIC 1", "Freitagsdoppel"];
const FREE_VALUE = "";

function cellKey(day: string, rowIndex: number, court: number): string {
  return `${day}|${rowIndex}|${court}`;
}

function slotCovers(slot: AdminTrainingSlot, day: string, court: number, from: string, to: string): boolean {
  return slot.day === day && slot.courtNumber === court && slot.timeFrom <= from && slot.timeTo >= to;
}

function buildGrid(slots: AdminTrainingSlot[]): Map<string, string> {
  const grid = new Map<string, string>();
  for (const day of TRAINING_DAYS) {
    TRAINING_GRID_SLOTS.forEach((row, rowIndex) => {
      for (const court of PUBLIC_TRAINING_COURTS) {
        const slot = slots.find((candidate) => slotCovers(candidate, day, court, row.from, row.to));
        let value = FREE_VALUE;
        if (slot?.teamId) value = `team:${slot.teamId}`;
        else if (slot?.labelOverride) value = `label:${slot.labelOverride}`;
        grid.set(cellKey(day, rowIndex, court), value);
      }
    });
  }
  return grid;
}

function specialLabels(slots: AdminTrainingSlot[]): string[] {
  const labels = new Set(slots.map((slot) => slot.labelOverride).filter((label) => label !== ""));
  return [...labels].sort((a, b) => {
    const rankA = LABEL_PRIORITY.indexOf(a);
    const rankB = LABEL_PRIORITY.indexOf(b);
    if (rankA !== -1 || rankB !== -1) {
      return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
    }
    return a.localeCompare(b, "de");
  });
}

interface BulkItem {
  day: string;
  time_from: string;
  time_to: string;
  court_number: number;
  team_id: number | "";
  label_override: string;
}

/** Fasst aufeinanderfolgende gleiche Zellen je Tag/Platz zu einem Slot zusammen. */
function gridToItems(grid: Map<string, string>): BulkItem[] {
  const items: BulkItem[] = [];
  for (const day of TRAINING_DAYS) {
    for (const court of PUBLIC_TRAINING_COURTS) {
      let start: number | null = null;
      const flush = (endRowExclusive: number, value: string): void => {
        if (start === null || value === FREE_VALUE) return;
        const from = TRAINING_GRID_SLOTS[start]!.from;
        const to = TRAINING_GRID_SLOTS[endRowExclusive - 1]!.to;
        const isTeam = value.startsWith("team:");
        items.push({
          day,
          time_from: from,
          time_to: to,
          court_number: court,
          team_id: isTeam ? Number(value.slice(5)) : "",
          label_override: isTeam ? "" : value.slice(6),
        });
      };
      let currentValue = FREE_VALUE;
      TRAINING_GRID_SLOTS.forEach((_, rowIndex) => {
        const value = grid.get(cellKey(day, rowIndex, court)) ?? FREE_VALUE;
        if (value !== currentValue) {
          flush(rowIndex, currentValue);
          currentValue = value;
          start = value === FREE_VALUE ? null : rowIndex;
        }
      });
      flush(TRAINING_GRID_SLOTS.length, currentValue);
    }
  }
  return items;
}

export function TrainingAdmin(): JSX.Element {
  const slotsState = useAsync(adminApi.trainingSlots);
  const teamsState = useAsync(adminApi.teams);
  const { status, busy, run } = useMutation(slotsState.reload);
  const [grid, setGrid] = useState<Map<string, string>>(new Map());
  const [activeDay, setActiveDay] = useState<TrainingDay>("Montag");

  useEffect(() => {
    if (slotsState.data) setGrid(buildGrid(slotsState.data));
  }, [slotsState.data]);

  const labels = useMemo(() => specialLabels(slotsState.data ?? []), [slotsState.data]);
  const teams: AdminTeam[] = teamsState.data ?? [];

  const setCell = (rowIndex: number, court: number, value: string): void => {
    setGrid((current) => {
      const next = new Map(current);
      next.set(cellKey(activeDay, rowIndex, court), value);
      return next;
    });
  };

  const save = (): void => {
    void run(() => adminApi.saveTrainingGrid(gridToItems(grid)), "Trainingsraster gespeichert.");
  };

  if (slotsState.loading || teamsState.loading) return <p className="muted">Lädt…</p>;
  if (slotsState.error) return <div className="msg msg--err">{slotsState.error}</div>;

  return (
    <div>
      <h2>Trainingsraster</h2>
      <div className="toolbar">
        {TRAINING_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            className={`btn${day === activeDay ? " btn--primary" : ""}`}
            onClick={() => setActiveDay(day)}
          >
            {day}
          </button>
        ))}
        <button type="button" className="btn btn--primary btn--push-right" disabled={busy} onClick={save}>
          Alles speichern
        </button>
      </div>
      <StatusMessage status={status} />
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Zeit</th>
              {PUBLIC_TRAINING_COURTS.map((court) => (
                <th key={court}>Platz {court}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRAINING_GRID_SLOTS.map((row, rowIndex) => (
              <tr key={row.from}>
                <td className="muted">{row.from}–{row.to}</td>
                {PUBLIC_TRAINING_COURTS.map((court) => (
                  <td key={court}>
                    <select
                      value={grid.get(cellKey(activeDay, rowIndex, court)) ?? FREE_VALUE}
                      onChange={(e) => setCell(rowIndex, court, e.target.value)}
                    >
                      <option value={FREE_VALUE}>– Frei –</option>
                      <optgroup label="Teams">
                        {teams.map((team) => (
                          <option key={team.id} value={`team:${team.id}`}>{team.displayName}</option>
                        ))}
                      </optgroup>
                      {labels.length > 0 ? (
                        <optgroup label="Sonderbelegung">
                          {labels.map((label) => (
                            <option key={label} value={`label:${label}`}>{label}</option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
