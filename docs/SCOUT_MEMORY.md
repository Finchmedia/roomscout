# Room Scout memory architecture

## Product purpose

RoomScout should remember the context that makes a long-running rehearsal-room
search work: people and band roles, musical identity, equipment, mobility,
schedules, room constraints, and collaboration preferences. It should not feel
like a generic chatbot or require the user to repeat stable context.

## Three context layers

1. **Structured search state** lives in `savedNeeds`. City, districts, budget,
   arrangement, schedule, requirements, and sharing openness are deterministic,
   editable constraints.
2. **Durable fact memory** lives in `memoryEntities` and `memoryFacts`. The
   subject/predicate/value model stays deliberately flexible so facts such as
   genres, influences, equipment relationships, transit limits, and people can
   be represented without a fixed profile form. Confidence, source,
   verification, sensitivity, and lifecycle state remain explicit.
3. **Compressed working context** lives in `memoryProfiles`. It summarizes
   musical identity, practical context, relationships, hard constraints, soft
   preferences, and worthwhile open questions. A fact-version guard prevents an
   older asynchronous rebuild from overwriting newer memory.

Every addition, supersession, deletion, import, and compression produces a
`memoryEvents` record. Users can inspect and delete active facts in the Profile
UI. Deleted or superseded facts are excluded from prompts and retrieval.

## Semantic retrieval

New active facts are embedded with `text-embedding-3-small` at 512 dimensions
and stored in a Convex vector index filtered by `ownerId`. Before a Scout turn,
the user message is embedded and the most relevant private facts are appended
to the deterministic context. Missing credentials degrade to deterministic
fact and profile context rather than blocking the conversation.

Generation and compression stay on Convex AI Gateway using
`openai/gpt-5.6-terra`. Only embeddings call the regular OpenAI endpoint with
`OPENAI_API_KEY` from the Convex deployment environment.

The Development deployment now has `OPENAI_API_KEY`. A cloud smoke test on
2026-08-28 returned the expected 512-dimensional `text-embedding-3-small`
vector without exposing the key. Use **Build semantic index** in the Profile UI
to backfill existing facts.

Cross-user band matching is not enabled by this private index. That requires a
separate, explicitly opted-in discovery profile and disclosure policy; private
memory must never become a public matching corpus implicitly.

## Context import

The Profile and first-run Scout UI provide a prompt that users can copy into an
assistant that already knows their music context. The returned text is sent to
the Gateway for candidate extraction. The raw export is not stored. Every
candidate is shown with subject, category, sensitivity, value, and relevance;
only checked and confirmed facts enter memory.

## Structured generation compatibility

An initial live `Output.object` request through
`@convex-dev/ai-sdk-provider@0.1.0` returned HTTP 400. Controlled tests isolated
the cause: the adapter did not declare the OpenAI-compatible provider's
`supportsStructuredOutputs` capability, so AI SDK discarded the schema and
downgraded the request to `response_format: { type: "json_object" }`. The same
schema worked both as a direct Gateway request and through a local copy of the
adapter with `supportsStructuredOutputs: true`.

RoomScout now uses that minimal local adapter. Structured Firecrawl
normalization, inbound-reply parsing, memory compression, and context import
use native AI SDK `Output.object` calls with strict JSON Schema plus a final Zod
validation at the application boundary. Fields that are optional in Convex are
required-but-nullable in the model schema, because OpenAI strict Structured
Outputs require every declared property to appear. `null` is converted back to
an omitted Convex field only after validation.
