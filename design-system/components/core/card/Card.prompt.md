Container for anything that needs to stand out from the grain background.

```jsx
<Card size="lg"><Overline>Raum in Stuttgart-West</Overline>…</Card>
<Card size="sm" tone="faint" padding="14px 18px">…</Card>
<Card tone="accent">Freigabe nötig</Card>
<Card tone="panel" size="panel" padding={0}>settings shell</Card>
```

- Background rgba(18,14,12,.72), border rgba(255,200,160,.14). No blur, no glow, no gradient fills.
- `rust` tone is the warm lock-notice ("Verbindliche Entscheidungen bleiben bei dir.").
