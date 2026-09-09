The single source of truth for what the Scout searches. Same element morphs from floating list to central card.

```jsx
<FactList facts={[{id:'ort',label:'Stuttgart'},{id:'budget',label:'Bis 350 € / Monat',changed:true}]} />
<FactList variant="card" facts={facts} onEdit={edit}>
  <Button size="md" block style={{marginTop:18}}>Scout losschicken</Button>
</FactList>
```

- Max five rows in the conversation view; "+2 weitere Wünsche" beyond that.
- A corrected fact stays in place and flashes orange (`changed`) for ~1 s; never add a duplicate row.
