One action per screen: a single orange primary pill, everything else quieter.

```jsx
<Button size="lg" icon={<Icon name="mic" size={20} />}>Mit Scout sprechen</Button>
<Button variant="secondary">Suchauftrag ansehen</Button>
<Button variant="tint" size="sm">Ja, Mittwoch passt</Button>
<Button variant="ghost" icon={<Icon name="keyboard" size={20} />}>Lieber schreiben</Button>
<Button variant="link">Noch etwas ändern</Button>
```

- Primary: 600 weight, white text, hover #ff7a3d; lg/md sizes carry the orange glow shadow.
- `tint` is the answer-suggestion chip (orange tint, warm text).
- `link` underline uses rgba(255,220,190,.35) with 4px offset.
