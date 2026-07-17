/**
 * Datentransfer-Objekte (DTOs) der öffentlichen und administrativen API.
 *
 * Das Backend normalisiert alle externen Swisstennis-/MyTennis-Antworten in
 * diese sauberen, stabil benannten Strukturen. Das Frontend kennt ausschließlich
 * diese Typen und nie das Rohformat von Swisstennis.
 */
import type {
  CaptainStatus,
  Discipline,
  Gender,
  PlayoffType,
  ResultType,
  TournamentMatchStatus,
  TrainingDay,
} from "./constants.js";

export interface HealthResponse {
  ok: true;
  service: string;
  time: string;
}

// ---------------------------------------------------------------------------
// Teams & Spieler (öffentlich)
// ---------------------------------------------------------------------------

export interface PublicPlayer {
  id: number;
  name: string;
  klassierung: string;
  myTennisUrl: string;
  captainStatus: CaptainStatus;
}

export interface PublicTeam {
  id: number;
  title: string;
  gender: Gender;
  category: string;
  liga: string;
  teamziel: string;
  trainingstag: string;
  players: PublicPlayer[];
}

export interface PublicTeamsResponse {
  damen: PublicTeam[];
  herren: PublicTeam[];
}

// ---------------------------------------------------------------------------
// Trainingsplan (öffentlich)
// ---------------------------------------------------------------------------

export interface TrainingRow {
  time: string;
  courts: Array<string | null>;
}

export interface TrainingPlanResponse {
  days: Record<string, TrainingRow[]>;
}

// ---------------------------------------------------------------------------
// Klassierungsänderungen
// ---------------------------------------------------------------------------

export interface RankingChange {
  id: number;
  playerName: string;
  myTennisUrl: string;
  oldKlassierung: string;
  newKlassierung: string;
  changedAt: string;
}

export interface RankingChangesResponse {
  items: RankingChange[];
}

// ---------------------------------------------------------------------------
// Spieltermine (ClubResult, importiert)
// ---------------------------------------------------------------------------

export interface ScheduledMatch {
  round: string;
  date: string;
  time: string;
  liga: string;
  home: string;
  away: string;
  result: string;
  encountId: number;
  validated: boolean;
  year: string;
  isHomeOwn: boolean;
  playoff: boolean;
  playoffType: PlayoffType;
  playoffTitle: string;
  playoffLigueId: number;
}

export interface MatchesResponse {
  source: string;
  updatedAt: string;
  year: string;
  matches: ScheduledMatch[];
}

// ---------------------------------------------------------------------------
// Ergebnisse: Teams, Gruppenphase, Rangliste, Bracket
// ---------------------------------------------------------------------------

export interface ResultsTeam {
  teamId: number;
  liga: string;
  label: string;
  gender: Gender | "";
  prefix: string;
  group: string;
}

export interface ResultsTeamsResponse {
  items: ResultsTeam[];
}

export interface GroupMatch {
  round: string;
  date: string;
  home: string;
  away: string;
  homeIsOwn: boolean;
  awayIsOwn: boolean;
  validated: boolean;
  result: string;
  encountId: number;
}

export interface StandingRow {
  rank: number;
  teamName: string;
  points: string;
  sets: string;
  isOwn: boolean;
}

/** Beschreibt, welches Bracket (Auf-/Abstiegsrunde) geladen werden soll. */
export interface BracketRequest {
  ligueId: number;
  promotion: 0 | 1;
  type: PlayoffType;
}

export interface TeamResultsResponse {
  title: string;
  liga: string;
  group: string;
  matches: GroupMatch[];
  standings: StandingRow[];
  bracket: BracketRequest | null;
}

// ---------------------------------------------------------------------------
// Ergebnisse: Begegnungsdetail (Einzel/Doppel)
// ---------------------------------------------------------------------------

export interface EncountMatch {
  position: string;
  /** Einzel: ein Eintrag "Name (R4)". Doppel: je Spieler ein Eintrag (untereinander). */
  homeNames: string[];
  awayNames: string[];
  score: string;
  /** true = Heim gewinnt, false = Gast gewinnt, null = offen. */
  homeWon: boolean | null;
  walkover: boolean;
}

export interface EncountDetailResponse {
  homeTeam: string;
  awayTeam: string;
  homeClubNb: number;
  totalResult: string;
  date: string;
  liga: string;
  group: string;
  singles: EncountMatch[];
  doubles: EncountMatch[];
  swisstennisUrl: string;
  resultType: ResultType;
  year: string;
}

// ---------------------------------------------------------------------------
// Ergebnisse: Auf-/Abstiegs-Bracket (Grid)
// ---------------------------------------------------------------------------

export type BracketCellKind = "team" | "result" | "text" | "empty";

export interface BracketCell {
  kind: BracketCellKind;
  text: string;
  isHome: boolean;
  isOwn: boolean;
  isPending: boolean;
  encountId: number;
  resultType: ResultType;
  borderBottom: boolean;
  borderRight: boolean;
}

export interface BracketResponse {
  rows: number;
  cols: number;
  /** Grid[rowIndex][colIndex]; null = nicht belegte Position. */
  grid: Array<Array<BracketCell | null>>;
}

// ---------------------------------------------------------------------------
// Turniere (öffentlich)
// ---------------------------------------------------------------------------

export interface RegistrationPlayer {
  playerKey: string;
  name: string;
  name2: string;
  ranking: string;
  ranking2: string;
  playerUrl: string;
  playerUrl2: string;
  confirmed: boolean;
  registeredOn: string;
  note: string;
}

export interface TournamentMatch {
  matchKey: string;
  eventId: number;
  eventName: string;
  mode: string;
  poolName: string;
  roundName: string;
  scheduledDate: string;
  scheduledTime: string;
  court: string;
  side1Names: string[];
  side2Names: string[];
  result: string;
  status: TournamentMatchStatus;
  winnerSide: number;
}

/** Eine Zeile der Round-robin-Tabelle (eines Pools). */
export interface PoolStandingRow {
  rank: number;
  names: string[];
  matches: number;
  victories: number;
  sets: string;
  games: string;
}

export interface PoolStanding {
  poolName: string;
  rows: PoolStandingRow[];
}

/** Eine Partie im Tableau-Baum (Seiten können offen/leer sein = noch nicht ausgelost). */
export interface TournamentBracketMatch {
  side1Names: string[];
  side2Names: string[];
  result: string;
  winnerSide: number;
  /** Terminierung (falls von Swisstennis vorhanden) – auch bei offenen Partien. */
  scheduledDate?: string;
  scheduledTime?: string;
  court?: string;
}

export interface TournamentBracketRound {
  roundName: string;
  matches: TournamentBracketMatch[];
}

export interface TournamentBracket {
  rounds: TournamentBracketRound[];
  championNames: string[];
}

export interface TournamentEventView {
  eventId: number;
  eventName: string;
  discipline: Discipline | "";
  sortOrder: number;
  players: RegistrationPlayer[];
  matches: TournamentMatch[];
  /** Round-robin: Tabellen je Pool (leer bei Tableaux). */
  pools: PoolStanding[];
  /** Tableau: Bracket-Baum (null bei Round-robin). */
  bracket: TournamentBracket | null;
}

export interface TournamentView {
  id: number;
  name: string;
  registrationUrl: string;
  updatedAt: string;
  showsMatches: boolean;
  events: TournamentEventView[];
}

export interface TournamentsResponse {
  tournaments: TournamentView[];
}

// ---------------------------------------------------------------------------
// Agenda (Vereins-Events von tcwaidberg.ch)
// ---------------------------------------------------------------------------

export interface AgendaEvent {
  /** Exakt formatierte Datums-/Zeitangabe wie auf der Vereinsseite. */
  dateLabel: string;
  title: string;
  category: string;
  /** z. B. "Anmeldung möglich bis 10.08.2026" oder leer. */
  registrationLabel: string;
  detailUrl: string;
}

export interface AgendaResponse {
  events: AgendaEvent[];
  updatedAt: string;
}

/** Sichtbarkeit einzelner Bereiche der öffentlichen Seite (über das Admin-UI steuerbar). */
export interface SiteSettings {
  showTraining: boolean;
  showMatches: boolean;
}

// ---------------------------------------------------------------------------
// Admin-DTOs
// ---------------------------------------------------------------------------

export interface AdminTeam {
  id: number;
  displayName: string;
  gender: Gender;
  category: string;
  liga: string;
  teamziel: string;
  trainingstag: string;
}

export interface AdminPlayer {
  id: number;
  name: string;
  klassierung: string;
  mytennisId: string;
  teamId: number;
  captainStatus: CaptainStatus;
  teamDisplay: string;
}

export interface AdminTrainingSlot {
  id: number;
  day: TrainingDay;
  timeFrom: string;
  timeTo: string;
  courtNumber: number;
  teamId: number | null;
  labelOverride: string;
  displayLabel: string;
}

export interface AdminRankingChange {
  id: number;
  playerId: number;
  playerName: string;
  myTennisID: string;
  oldKlassierung: string;
  newKlassierung: string;
  changedAt: string;
}

export interface AdminTournament {
  id: number;
  name: string;
  swisstennisTournamentId: number;
  registrationUrl: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
  lastError: string;
}

export interface ApiError {
  error: string;
}

/** Autocomplete-Vorschlag für die Spielermatches-Suche. */
export interface PlayerSuggestion {
  name: string;
  key: string;
  klassierung: string;
  url: string | null;
}

/** Ein an einem Match beteiligter Spieler (Partner oder Gegner). */
export interface PlayerMatchParticipant {
  name: string;
  url: string | null;
}

/** Ein Match aus Sicht des gesuchten Spielers. */
export interface PlayerMatchView {
  competition: string;
  competitionCode: string;
  discipline: "single" | "double";
  date: string;
  /** Der gesuchte Spieler selbst (Name inkl. Klassierung). */
  player: PlayerMatchParticipant;
  partner: PlayerMatchParticipant | null;
  opponents: PlayerMatchParticipant[];
  result: string;
  won: boolean | null;
  matchUrl: string | null;
}

export interface PlayerMatchesResponse {
  player: string;
  matches: PlayerMatchView[];
}

/** Eine belegte Platz-Buchung (GotCourts) für die Anzeige im Plätze-Tab. */
export interface CourtBooking {
  /** Platzbezeichnung wie bei GotCourts, z. B. "Platz 1". */
  court: string;
  /** Beginn als "HH:MM". */
  from: string;
  /** Ende als "HH:MM". */
  to: string;
  /** Beschreibung/Spieler, z. B. "Clubmeisterschaften" oder "J. Lanker". */
  who: string;
}

/** Ein Zeitblock (aktuelle bzw. nächste Stunde) mit den belegten Plätzen. */
export interface CourtBlock {
  /** Zeitfenster als "HH:MM–HH:MM". */
  label: string;
  /** True für die aktuell laufende Stunde (Tennisball-Markierung). */
  live: boolean;
  /** Nur belegte Plätze, nach Platznummer sortiert. */
  bookings: CourtBooking[];
}

/** Platzbelegung für den Plätze-Tab: aktuelle und (falls belegt) folgende Stunde. */
export interface CourtsResponse {
  /** Abgefragtes Datum als "YYYY-MM-DD". */
  date: string;
  /** Ob GotCourts konfiguriert und erreichbar war. */
  available: boolean;
  /** [aktuelle Stunde, ggf. nächste Stunde]. */
  blocks: CourtBlock[];
}

/** Ein Eintrag im Ergebnis-Ticker: zuletzt gespielte Matches clubweit. */
export interface TickerMatch {
  /** Anzeige-Datum (D.M.YYYY) oder leer. */
  date: string;
  competitionCode: string;
  competition: string;
  discipline: "single" | "double";
  /** Spieler (inkl. Klassierung, mit Profil-URL) je Seite; Doppel = zwei Einträge. */
  side1: PlayerMatchParticipant[];
  side2: PlayerMatchParticipant[];
  result: string;
  /** 0 = unbekannt, 1/2 = Siegerseite. */
  winnerSide: number;
  matchUrl: string | null;
}

export interface TickerResponse {
  matches: TickerMatch[];
}

/** Eine Partie in der Waidcup-Live-Anzeige („Wer spielt gerade"). */
export interface WaidcupLiveMatch {
  court: string;
  eventName: string;
  side1Names: string[];
  side2Names: string[];
  /** "YYYY-MM-DD" (für „Als Nächstes" über Tagesgrenzen). */
  scheduledDate: string;
  /** "HH:MM". */
  scheduledTime: string;
  /** Ergebnis (z. B. "6:2 6:3"), leer wenn noch nicht gespielt. */
  result: string;
  /** Gewinnerseite: 1, 2 oder 0 (offen/unbekannt). */
  winnerSide: number;
}

/** Eine Person im Bezahlt-Tracking (aggregiert über alle Konkurrenzen). */
export interface WaidcupPaymentPerson {
  /** Stabiler Schlüssel (registry_id oder Namens-Schlüssel). */
  personKey: string;
  name: string;
  /** Konkurrenz-Disziplinen der Person, z. B. ["MS","DM"]. */
  disciplines: string[];
  playsSingles: boolean;
  playsMixed: boolean;
  /** Zu zahlender Gesamtbetrag in CHF. */
  cost: number;
  /** Frühestes terminiertes Match ("YYYY-MM-DD" / "HH:MM"), sonst leer. */
  firstMatchDate: string;
  firstMatchTime: string;
  paid: boolean;
}

export interface WaidcupPaymentsResponse {
  persons: WaidcupPaymentPerson[];
  /** Summe der offenen bzw. bereits bezahlten Beträge (CHF). */
  totalOpen: number;
  totalPaid: number;
}

/** Live-Board des Waidcups: laufende und nächste Partien. */
export interface WaidcupLiveResponse {
  /** Läuft jetzt (heute terminiert, Startzeit erreicht, noch ohne Resultat); nach Platz sortiert. */
  now: WaidcupLiveMatch[];
  /** Als Nächstes (Termin in der Zukunft); nach Zeitpunkt sortiert. */
  upcoming: WaidcupLiveMatch[];
}
