Operator-only table (tasks, sources). Never in the band-facing flow.

```jsx
<DataTable columns={[{key:'name',label:'Vorgang',width:'1.3fr'},{key:'src',label:'Quelle',muted:true},{key:'status',label:'Status',width:'1.2fr'}]} rows={[{name:'Anfrage Stuttgart-West',src:'roomscout.dev',status:<StatusDot tone="success">Läuft</StatusDot>}]} />
```
