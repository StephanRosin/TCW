/**
 * Rendert je nach Ladezustand einen Spinner, eine Fehlermeldung oder die Daten.
 * Hält die Lade-/Fehlerbehandlung an einer Stelle (DRY) statt in jeder View.
 */
import type { JSX, ReactNode } from "react";
import type { ResourceState } from "../api/useResource.js";
import { useI18n } from "../i18n/I18nProvider.js";

interface DataViewProps<TData> {
  state: ResourceState<TData>;
  errorKey: string;
  children: (data: TData) => ReactNode;
}

export function DataView<TData>({ state, errorKey, children }: DataViewProps<TData>): JSX.Element {
  const { t } = useI18n();

  if (state.status === "loading") {
    return (
      <div className="state" role="status">
        <div className="spinner" aria-hidden="true" />
        {t("common.loading")}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="state state--error" role="alert">
        {t(errorKey)}
      </div>
    );
  }
  return <div className="fade-in">{children(state.data)}</div>;
}
