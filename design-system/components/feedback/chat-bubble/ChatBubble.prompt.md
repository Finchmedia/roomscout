Chat exchange inside the clarification card or the transcript drawer. Wrap in a flex column.

```jsx
<div style={{display:'flex',flexDirection:'column',gap:12}}>
  <ChatBubble who="user">Ja, Mittwoch passt auch.</ChatBubble>
  <ChatBubble who="scout">Alles klar, Mittwoch geht also auch. Ich kläre den Rest.</ChatBubble>
</div>
```

- The Scout's reply has no bubble in the main flow; only the transcript boxes both.
