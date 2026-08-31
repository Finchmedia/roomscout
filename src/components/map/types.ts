export type MapCoordinates = [longitude: number, latitude: number];

export type MapMarketSignal = {
  id: string;
  title: string;
  coordinates: MapCoordinates;
  side: "supply" | "demand";
  locationLabel: string;
  source: string;
  freshnessLabel: string;
  priceLabel?: string;
  summary?: string;
  fitLabel?: string;
};
