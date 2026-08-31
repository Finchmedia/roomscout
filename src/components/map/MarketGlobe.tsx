import { MinusCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapCoordinates, MapMarketSignal } from "./types";
import styles from "./MarketGlobe.module.css";

const GERMANY_CENTER: MapCoordinates = [10.4515, 51.1657];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type MarketGlobeProps = {
  signals: MapMarketSignal[];
  accessToken?: string;
  initialCenter?: MapCoordinates;
  initialZoom?: number;
  selectedSignalId?: string;
  autoRotate?: boolean;
  className?: string;
  onSignalSelect?: (signal: MapMarketSignal | null) => void;
  onVisibleSignalsChange?: (signals: MapMarketSignal[]) => void;
};

export function MarketGlobe({
  signals,
  accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined,
  initialCenter = GERMANY_CENTER,
  initialZoom = 2.5,
  selectedSignalId,
  autoRotate = true,
  className = "",
  onSignalSelect,
  onVisibleSignalsChange,
}: MarketGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  const signalsRef = useRef(signals);
  const interactingRef = useRef(false);
  const rotateRef = useRef(autoRotate);
  const onSignalSelectRef = useRef(onSignalSelect);
  const onVisibleSignalsChangeRef = useRef(onVisibleSignalsChange);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [internalSelectedId, setInternalSelectedId] = useState(selectedSignalId);
  const [visibleSignals, setVisibleSignals] = useState<MapMarketSignal[]>(signals);

  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { rotateRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => { onSignalSelectRef.current = onSignalSelect; }, [onSignalSelect]);
  useEffect(() => { onVisibleSignalsChangeRef.current = onVisibleSignalsChange; }, [onVisibleSignalsChange]);
  const selectedId = selectedSignalId ?? internalSelectedId;

  const updateVisibleSignals = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const visible = signalsRef.current.filter((signal) => bounds.contains(signal.coordinates));
    setVisibleSignals(visible);
    onVisibleSignalsChangeRef.current?.(visible);
  }, []);

  const spinGlobe = useCallback(() => {
    const map = mapRef.current;
    if (!map || !rotateRef.current || interactingRef.current || prefersReducedMotion()) return;
    const zoom = map.getZoom();
    const maxSpinZoom = 5;
    const slowSpinZoom = 3;
    if (zoom >= maxSpinZoom) return;

    let degreesPerSecond = 360 / 240;
    if (zoom > slowSpinZoom) {
      degreesPerSecond *= (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
    }
    const center = map.getCenter();
    center.lng -= degreesPerSecond;
    map.easeTo({ center, duration: 1_000, easing: (progress) => progress });
  }, []);

  const selectSignal = useCallback((signal: MapMarketSignal) => {
    interactingRef.current = true;
    setInternalSelectedId(signal.id);
    onSignalSelectRef.current?.(signal);
    const reducedMotion = prefersReducedMotion();
    mapRef.current?.flyTo({ center: signal.coordinates, zoom: 10.5, duration: reducedMotion ? 0 : 1_100, essential: !reducedMotion });
  }, []);

  const resetOverview = useCallback(() => {
    setInternalSelectedId(undefined);
    onSignalSelectRef.current?.(null);
    interactingRef.current = false;
    const reducedMotion = prefersReducedMotion();
    mapRef.current?.flyTo({ center: initialCenter, zoom: initialZoom, duration: reducedMotion ? 0 : 1_400, essential: !reducedMotion });
  }, [initialCenter, initialZoom]);

  useEffect(() => {
    if (!accessToken || !containerRef.current || mapRef.current) {
      return;
    }
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    void import("mapbox-gl").then(({ default: mapbox }) => {
      if (disposed || !containerRef.current) return;
      mapbox.accessToken = accessToken;
      mapboxRef.current = mapbox;

      const map = new mapbox.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: initialCenter,
        zoom: initialZoom,
        projection: "globe",
        attributionControl: true,
      });
      mapRef.current = map;
      map.scrollZoom.disable();

      const pause = () => { interactingRef.current = true; };
      const resume = () => { interactingRef.current = false; spinGlobe(); };
      const handleMoveEnd = () => { updateVisibleSignals(); spinGlobe(); };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.metaKey || event.ctrlKey) map.scrollZoom.enable();
      };
      const handleKeyUp = () => map.scrollZoom.disable();

      map.on("style.load", () => {
        try {
          map.setFog({
            color: "rgba(0, 0, 0, 0.16)",
            "high-color": "rgba(255, 107, 44, 0.18)",
            "horizon-blend": 0.2,
            "space-color": "rgb(0, 0, 0)",
            "star-intensity": 0.38,
          });
        } catch {
          // A map style can load before all globe internals are ready; the map remains usable.
        }
      });
      map.on("load", () => {
        if (!map.getSource("roomscout-country-boundaries")) {
          map.addSource("roomscout-country-boundaries", { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" });
          map.addLayer({
            id: "roomscout-country-boundaries",
            type: "line",
            source: "roomscout-country-boundaries",
            "source-layer": "country_boundaries",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "rgb(255, 107, 44)", "line-opacity": 0.72, "line-width": 1 },
          });
        }
        map.addSource("roomscout-signals", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 7,
          clusterRadius: 48,
        });
        map.addLayer({
          id: "roomscout-clusters",
          type: "circle",
          source: "roomscout-signals",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "rgba(255, 107, 44, 0.88)",
            "circle-stroke-color": "rgba(255, 255, 255, 0.72)",
            "circle-stroke-width": 1,
            "circle-radius": ["step", ["get", "point_count"], 18, 10, 23, 50, 29],
          },
        });
        map.addLayer({
          id: "roomscout-cluster-count",
          type: "symbol",
          source: "roomscout-signals",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
          paint: { "text-color": "#080808" },
        });
        map.addLayer({
          id: "roomscout-unclustered",
          type: "circle",
          source: "roomscout-signals",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["match", ["get", "side"], "demand", "#f0b36c", "#ff6b2c"],
            "circle-radius": 7,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
          },
        });
        map.on("click", "roomscout-clusters", (event) => {
          const feature = map.queryRenderedFeatures(event.point, { layers: ["roomscout-clusters"] })[0] as unknown as {
            properties?: Record<string, unknown>;
            geometry?: { type?: string; coordinates?: unknown[] };
          } | undefined;
          const clusterId = feature?.properties?.cluster_id;
          const coordinates = feature?.geometry?.type === "Point" ? feature.geometry.coordinates : undefined;
          const source = map.getSource("roomscout-signals") as mapboxgl.GeoJSONSource | undefined;
          if (typeof clusterId !== "number" || !coordinates || !source) return;
          source.getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (error || zoom === null || zoom === undefined) return;
            map.easeTo({ center: [Number(coordinates[0]), Number(coordinates[1])], zoom });
          });
        });
        map.on("click", "roomscout-unclustered", (event) => {
          const feature = event.features?.[0] as unknown as { properties?: Record<string, unknown> } | undefined;
          const id = feature?.properties?.id;
          const signal = signalsRef.current.find((candidate) => candidate.id === id);
          if (signal) selectSignal(signal);
        });
        for (const layer of ["roomscout-clusters", "roomscout-unclustered"]) {
          map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        }
        setLoaded(true);
        updateVisibleSignals();
        spinGlobe();
      });
      map.on("error", (event) => setError(event.error?.message ?? "The map could not load."));
      map.on("mousedown", pause);
      map.on("touchstart", pause);
      map.on("dragstart", pause);
      map.on("mouseup", resume);
      map.on("touchend", resume);
      map.on("dragend", resume);
      map.on("pitchend", resume);
      map.on("rotateend", resume);
      map.on("moveend", handleMoveEnd);
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("keyup", handleKeyUp);

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);

      map.once("remove", () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keyup", handleKeyUp);
      });
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Mapbox GL could not be loaded.");
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
      setLoaded(false);
    };
  }, [accessToken, initialCenter, initialZoom, selectSignal, spinGlobe, updateVisibleSignals]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource("roomscout-signals") as mapboxgl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: signals.map((signal) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: signal.coordinates },
        properties: { id: signal.id, side: signal.side },
      })),
    });
    if (map.getLayer("roomscout-unclustered")) {
      map.setPaintProperty("roomscout-unclustered", "circle-radius", ["case", ["==", ["get", "id"], selectedId ?? ""], 10, 7]);
      map.setPaintProperty("roomscout-unclustered", "circle-stroke-width", ["case", ["==", ["get", "id"], selectedId ?? ""], 3, 1]);
    }
    updateVisibleSignals();
  }, [loaded, selectedId, signals, updateVisibleSignals]);

  const selectedSignal = signals.find((signal) => signal.id === selectedId);
  const displayError = accessToken ? error : "VITE_MAPBOX_ACCESS_TOKEN is required to render the market globe.";

  return (
    <section aria-label="RoomScout market map" className={`${styles.root}${className ? ` ${className}` : ""}`}>
      <div className={styles.map} ref={containerRef} />
      {displayError ? <div className={styles.error} role="alert">{displayError}</div> : null}
      <p className={styles.hint}>Hold <strong>⌘ or Ctrl</strong> while scrolling to zoom. Drag the globe to explore current market signals.</p>
      <aside className={styles.panel}>
        <header className={styles.panelHeader}><h2>Signals in view</h2><span className={styles.count}>{visibleSignals.length} visible</span></header>
        {selectedSignal ? (
          <div className={styles.detail}>
            <div className={styles.detailTop}><div><span className={styles.side}>{selectedSignal.side}</span><h3>{selectedSignal.title}</h3></div><button aria-label="Close signal detail" className={styles.closeButton} onClick={resetOverview} type="button"><X aria-hidden="true" size={15} /></button></div>
            <p>{selectedSignal.summary ?? `${selectedSignal.locationLabel} · ${selectedSignal.source}`}</p>
            <div className={styles.detailMeta}><span className={styles.pill}>{selectedSignal.locationLabel}</span>{selectedSignal.priceLabel ? <span className={styles.pill}>{selectedSignal.priceLabel}</span> : null}<span className={styles.pill}>{selectedSignal.freshnessLabel}</span></div>
            {selectedSignal.fitLabel ? <p>{selectedSignal.fitLabel}</p> : null}
            <button className={styles.overviewButton} onClick={resetOverview} type="button"><MinusCircle aria-hidden="true" size={15} />Back to overview</button>
          </div>
        ) : null}
        <div className={styles.list}>
          {visibleSignals.length === 0 ? <p className={styles.empty}>No geocoded signals in this view. Zoom out to widen the market window.</p> : visibleSignals.map((signal) => (
            <button className={`${styles.card}${signal.id === selectedId ? ` ${styles.cardSelected}` : ""}`} key={signal.id} onClick={() => selectSignal(signal)} type="button">
              <span className={styles.cardTop}><span className={styles.side}>{signal.side}</span><span className={styles.freshness}>{signal.freshnessLabel}</span></span>
              <h3>{signal.title}</h3>
              <p>{signal.locationLabel}{signal.priceLabel ? ` · ${signal.priceLabel}` : ""}</p>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
