/**
 * Blendet den 3D-Tour-Tab auf schmalen (mobilen) Viewports aus – der Rundgang
 * braucht Maus und Pointer-Lock und ist auf Touch nicht sinnvoll bedienbar.
 */
import type { NavItem } from "./navigation.js";

export function filterNavForViewport(items: readonly NavItem[], isMobile: boolean): NavItem[] {
  return items.filter((item) => !(isMobile && item.view === "tour"));
}
