/**
 * Exploratory selection tracking and multiplicity disclosure.
 */

export interface SelectionMetadata {
  selection_status: "predefined" | "exploratory_map_selected";
  screening_family_id?: string | null;
  contrast_family_id?: string | null;
  selection_method: "preset" | "map_draw" | "manual_coordinates";
  selected_at: string;
}

export function recordExploratoryDraw(
  screeningMapFamilyId?: string | null
): SelectionMetadata {
  return {
    selection_status: "exploratory_map_selected",
    screening_family_id: screeningMapFamilyId || null,
    contrast_family_id: null, // Distinct from screening family!
    selection_method: "map_draw",
    selected_at: new Date().toISOString(),
  };
}

export function recordPredefinedPreset(presetId: string): SelectionMetadata {
  return {
    selection_status: "predefined",
    screening_family_id: null,
    contrast_family_id: `predefined_${presetId}`,
    selection_method: "preset",
    selected_at: new Date().toISOString(),
  };
}
