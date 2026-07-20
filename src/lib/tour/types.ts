export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  path: string;
  /** Wartość atrybutu data-tour na elemencie UI. */
  target?: string;
  title: string;
  body: string;
  /** Krótki przykład (opcjonalnie). */
  example?: string;
  placement: TourPlacement;
}
