The text way to talk to the Scout; voice-first never means voice-only.

```jsx
<Composer value={draft} onChange={setDraft} onSubmit={send} onVoice={startVoice} placeholder="Möchtest du mir noch etwas sagen?" />
```

- Exactly one voice entry per screen: either the mic button in the composer or a separate "Sprechen" button, never both.
