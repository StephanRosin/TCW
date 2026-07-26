/**
 * Geteilte React-Bausteine der TCW-Websites (Spielbetrieb + Waidcup):
 * Mehrsprachigkeit, Ladezustände sowie Turnierbaum- und Matchlisten-Anzeige.
 */
export { I18nProvider, useI18n } from "./I18nProvider.js";
export { useResource, type ResourceState } from "./useResource.js";
export { useHashRoute } from "./useHashRoute.js";
export { ResourceView } from "./ResourceView.js";
export { LanguageSwitch } from "./LanguageSwitch.js";
export { ThemeSwitch } from "./ThemeSwitch.js";
export { THEMES, applyTheme, getStoredTheme } from "./theme.js";
export { TournamentBracket } from "./TournamentBracket.js";
export { MatchList } from "./MatchList.js";
export { PoolStandings } from "./PoolStandings.js";
export { PlayerLink } from "./PlayerLink.js";
export { compareTournamentMatches, type MatchListOrder } from "./matchOrder.js";
export { translateRound } from "./roundLabel.js";
export { ChampionBanner } from "./ChampionBanner.js";
export { championLabelKey, poolChampionNames } from "./champion.js";
export { womenEvents, menEvents, otherEvents } from "./eventGrouping.js";
