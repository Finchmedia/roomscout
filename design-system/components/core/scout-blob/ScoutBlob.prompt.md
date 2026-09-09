The Scout blob is RoomScout's assistant presence; use it wherever the Scout "is" on a screen, free-floating, never inside a card.

```jsx
<ScoutBlob size={168} state="idle" />
<ScoutBlob size={96} state="speaking" />
<ScoutBlob size={58} state="listening" />
```

- `state`: `idle` (breathing), `speaking`, `listening`, `still`.
- Shrinks when a decision or offer takes priority (168 → 96 → 58).
- One blob per screen. No rings, no audio meters.
