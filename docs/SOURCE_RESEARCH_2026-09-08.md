# Public portal source research — 2026-09-08

Status: discovery research only. Nothing listed here is enabled for ingestion or outreach.

## Method

- Reviewed at: 2026-09-08 (Europe/Berlin)
- Scope: six public-web searches per city, five results per search; supply, demand, forum, and municipal perspectives.
- Evidence level: URLs, titles, and search-result excerpts were verified. Six selected public index flows, their policy material and six additional first-party operator profiles were inspected. No individual classified-listing detail pages were fetched.
- Policy gate: a public search result is not permission to automate collection. The source-specific outcomes below keep detail retrieval paused for every candidate.
- Safety: no login, contact, message, monitoring, crawl, private contact collection, or production-source activation was performed.
- Request accounting: 18 successful search calls returned 90 result slots (not 90 unique sources); 7 earlier search attempts were rate-limited. Policy/profile research produced 30 successful URL artifacts, with 3 rate-limited attempts subsequently repeated successfully. No broad crawler or monitor was started.

## Capability and policy review

Capability labels are cumulative observations, not permissions:

- `discovered`: a public search result identified the source.
- `public_index_observed`: the public index itself was fetched successfully.
- `contact_route_observed`: the index or policy explicitly exposed the route; it was not used.
- `automation_review`: robots plus a linked policy/terms page were reviewed where available. Outcomes are `explicit_prohibition`, `no_applicable_restriction_found`, `access_block`, or `unknown_policy`. “No applicable restriction found” is a narrow research result, not permission or legal advice.

| Source | Observed capability | Contact route actually observed | Automation review and evidence | Detail decision |
| --- | --- | --- | --- | --- |
| Kleinanzeigen (Stuttgart) | `discovered`, `public_index_observed`, `contact_route_observed`, `automation_review: explicit_prohibition` | Platform messaging requires registration/login; the terms also describe account, email, and phone verification | [`robots.txt`](https://www.kleinanzeigen.de/robots.txt) permits the inspected index path but excludes account, message, search, and multiple filtered paths. [Terms](https://themen.kleinanzeigen.de/nutzungsbedingungen/) expressly prohibit crawlers, spiders, scrapers, or other automated collection without written consent. | No listing details; not an ingestion candidate without written consent |
| Musik-Anzeigen (Baden-Württemberg and Hamburg) | `discovered`, index fetch attempted, `automation_review: access_block` | Unknown; the intended public index was replaced by a bot-protection response | [`robots.txt`](https://www.musik-anzeigen.com/robots.txt) only excluded a monitor script at review time, but robots is not permission and the site denied the automated index flow. Applicable terms remain unknown because they could not be reached from that response. | Stop; no retries into listing paths and no details |
| Proberaumplattform Berlin | `discovered`, `public_index_observed`, `contact_route_observed`, `automation_review: explicit_prohibition` | The terms specify a web form that forwards user-entered contact data by email to the provider; login and contact links are public | [`robots.txt`](https://www.proberaumplattform-berlin.de/robots.txt) had no observed disallow rule for the index. [Terms](https://www.proberaumplattform-berlin.de/nutzungsbedingungen/) restrict portal data to individual information, require written consent for other use, prohibit commercial reproduction in websites/databases, and prohibit robots/spiders/scrapers/crawlers. | No listing details; not an ingestion candidate without written consent |
| Berlinmusiker | `discovered`, `public_index_observed`, `contact_route_observed`, `automation_review: unknown_policy` | Public login and site-contact links; privacy policy describes email contact, but a listing-specific reply route was not verified | [`robots.txt`](https://www.berlinmusiker.de/robots.txt) excludes system/share paths but not the inspected homepage. The linked [privacy policy](https://www.berlinmusiker.de/datenschutz.html) governs personal data and rejects commercial reuse of imprint contacts; applicable automation/use terms were not found. | No listing details pending operator clarification |
| Bandnet Hamburg | `discovered`, `public_index_observed`, `contact_route_observed`, `automation_review: no_applicable_restriction_found` | Public login and site-contact links; current terms say users can receive contact requests from unregistered visitors, but the listing-specific route was not exercised | Fresh [`robots.txt`](https://bandnet.hamburg/robots.txt) allowed the inspected category and excluded `/cgi-bin/`. Current [terms](https://bandnet.hamburg/site/content/conditions) prohibit systematic harvesting of user contact data for disclosure to third parties; no separate restriction applicable to bounded public listing metadata was found. | No details in this run; candidate for bounded operator review with contact data excluded |

Result: none of the six city/source selections passed the policy gate for automated listing-detail collection. `public_index_observed` therefore remains a research observation only; it must not be mapped to “approved”.

## Stuttgart

| Portal/source | Flow | Contact/auth path | Verification | Policy status |
| --- | --- | --- | --- | --- |
| [Kleinanzeigen — Proberaum Stuttgart](https://www.kleinanzeigen.de/s-stuttgart/proberaum/k0l9280) | Mixed supply listings; result excerpts showed room shares and rentals | Platform messaging; registration/login required | Public index observed | Explicit prohibition on automated collection without written consent; no details fetched |
| [Musik-Anzeigen — Proberäume Baden-Württemberg](https://www.musik-anzeigen.com/proberaum-baden-wuerttemberg) | Mixed supply and demand classifieds | Unknown | Search excerpt found; direct index inspection returned bot protection | Access blocked / applicable policy unknown; no details fetched |
| [MMC Stuttgart](https://mmc-stuttgart.de/proberaum-mieten.html) | Direct commercial supply | On-page contact-data form and telephone route observed, not used | First-party offer page observed | Named-bot restrictions make policy unknown; see operator follow-up |
| [Proberaum Stuttgart](https://proberaum-stuttgart.de/) | Direct shared-room supply | On-page inquiry/contact section observed, not used | First-party hours, equipment, and monthly price observed | No applicable restriction found, but no robots file or use terms; operator review needed |
| [City of Stuttgart — rehearsal-room study](https://www.stuttgart.de/kultur/kulturservice/kulturentwicklung/proberaumstudie) | Municipal market context, not listings | Municipal information page | Official source verifies scarcity and rising rents as a local context signal | Reference source only; not an ingestion candidate |

Supply and demand: supply is visible through classifieds and direct operators; demand appeared in classifieds/forums, but no clearly current, purpose-built Stuttgart demand index was verified.

Post-review candidate status: Kleinanzeigen has an explicit prohibition; Musik-Anzeigen is access-blocked with unknown policy. First-party Proberaum Stuttgart remains a bounded operator-review candidate. The municipal study is market evidence rather than inventory.

## Berlin

| Portal/source | Flow | Contact/auth path | Verification | Policy status |
| --- | --- | --- | --- | --- |
| [Proberaumplattform Berlin — provider list](https://www.proberaumplattform-berlin.de/anbieterliste/) | Curated supply/provider directory | Web form forwards user-entered details to provider | Public directory and terms observed | Explicit restriction to individual information; commercial database/republication and crawler use require consent; no details fetched |
| [Kleinanzeigen — Proberaum Berlin](https://www.kleinanzeigen.de/s-berlin/proberaum/k0l3331) | Mixed supply and sharing listings | Platform messaging; registration/login required | Search excerpts observed; Stuttgart index used for shared-domain flow review | Explicit prohibition on automated collection without written consent; no details fetched |
| [Berlinmusiker](https://www.berlinmusiker.de/) | Musician/band demand and community classifieds | Public login/site contact; listing reply route unknown | Public homepage observed | No applicable automation restriction found in robots/privacy review, but no relevant use terms found; operator review required before details |
| [Musicboard Berlin — rehearsal spaces](https://www.musicboard-berlin.de/vermittlung/proberaeume/) | Officially supported directory/context | Links onward to providers and platforms | Official source names private and subsidized room providers | Reference/discovery source; downstream policies still apply |
| [Kultur Räume Berlin — room portal](https://raumportal.kulturraeume.berlin/de/raume/f4085168-1ddb-47e4-a5ca-f50ffba25d54/e8585117-f7d5-4657-9567-32f39f022652) | Public/subsidized supply | General email route observed, not used; application route unknown | Public room metadata observed with PII redaction | Robots allows `/` with crawl-delay 3; no applicable reuse terms found; operator review needed |

Supply and demand: Berlin has strong supply coverage through a dedicated directory, public cultural infrastructure, operators, and classifieds. Berlinmusiker and forums expose demand/community signals.

Post-review candidate status: Proberaumplattform Berlin has an explicit prohibition for the proposed database use; Berlinmusiker has unknown policy. Kultur Räume Berlin and noisy Rooms are bounded operator-review candidates. Kleinanzeigen remains a discovery comparison only.

## Hamburg

| Portal/source | Flow | Contact/auth path | Verification | Policy status |
| --- | --- | --- | --- | --- |
| [Bandnet Hamburg — rooms available](https://bandnet.hamburg/anzeige/kategorie/19/proberaum-frei) | Local supply classifieds | Login/site contact observed; terms say users can accept contact requests from unregistered visitors, but listing route was not exercised | Public category, current robots, privacy, and current linked terms observed | Terms explicitly forbid systematic harvesting of user contact data for disclosure to third parties; no separate restriction on bounded public listing metadata was found. Operator review required; no details fetched |
| [Kleinanzeigen — Proberaum Hamburg](https://www.kleinanzeigen.de/s-hamburg/proberaum/k0l9409) | Mixed supply, shares, and demand | Platform messaging; registration/login required | Search excerpts observed; shared-domain policy review completed | Explicit prohibition on automated collection without written consent; no details fetched |
| [Musik-Anzeigen — Hamburg rooms](https://www.musik-anzeigen.com/proberaum-hamburg) | Mixed room classifieds | Unknown | Search excerpt found; direct index inspection returned bot protection | Access blocked / applicable policy unknown; no details fetched |
| [Bandtown — Hamburg rooms](https://www.bandtown.de/de/proberaeume-uebungsraueme-hamburg) | First-party rooms plus third-party supply guide | Online booking and site contact observed, not used | Public first-party and guide metadata observed | No applicable restriction found for its first-party room page; third-party entries remain discovery-only |
| [Hamburg.de — Bandhaus rehearsal rooms](https://www.hamburg.de/politik-und-verwaltung/behoerden/behoerde-fuer-kultur-und-medien/aktuelles/pressemeldungen/proberaeume-im-bandhaus-520130) | Municipal supply announcement/context | Official information page | Official source confirms rehearsal opportunities at Bandhaus Barmbek | Reference source only; not a general index |

Supply and demand: Hamburg shows substantial supply across local classifieds and operators. Demand appears in Kleinanzeigen, forums, and community posts, but currentness and reusable structure vary.

Post-review candidate status: Bandnet had no applicable restriction for bounded public listing metadata in the reviewed materials, but requires operator review and exclusion of contact data; Musik-Anzeigen is access-blocked with unknown policy. No source is production-enabled.

## First-party/operator profile follow-up

These are bounded public-page observations, not blanket legal approvals or recurring-crawl authorizations. No booking, form, login, or contact route was exercised.

| City/source | Public facts and contact flow observed | Robots / applicable terms | Research viability |
| --- | --- | --- | --- |
| Stuttgart — [MMC](https://mmc-stuttgart.de/proberaum-mieten.html) | First-party room offer; asks visitors to leave contact details or call | Robots lists many named blocked agents but no wildcard rule was observed; no general site-use terms were linked from the offer page | Policy unknown due unusually restrictive named-bot file; operator review needed before any reuse |
| Stuttgart — [Proberaum Stuttgart](https://proberaum-stuttgart.de/) | First-party availability, equipment, weekly price, and on-page inquiry/contact section | `robots.txt` returned not found; no applicable use terms were linked | No applicable restriction found, but absence of policy is not permission. Viable only for a one-source operator review/consent path |
| Berlin — [noisy Rooms](https://noisy-rooms.com/) | First-party rooms, indicative hourly prices, contact form, and authenticated online booking/payment flow | Robots allows the public content path and excludes admin/login/search paths. Linked AGB governs binding booking/payment but contains no observed restriction on reading public first-party room facts | Strong metadata candidate for bounded operator review; RoomScout must never automate the booking/payment flow |
| Berlin — [Kultur Räume Berlin room portal](https://raumportal.kulturraeume.berlin/de/raume/f4085168-1ddb-47e4-a5ca-f50ffba25d54/e8585117-f7d5-4657-9567-32f39f022652) | Public cultural-room record with availability, occupancy, and rent metadata; general site email link observed | Robots explicitly allows `/` with a three-second crawl delay. Only privacy/imprint links were found, not applicable reuse terms | Strongest structured-public candidate for bounded operator review; preserve provenance/freshness and exclude contact data |
| Hamburg — [Bandtown](https://www.bandtown.de/de/proberaeume-uebungsraueme-hamburg) | Own hourly/day room booking plus a public guide to third-party room operators; online booking and contact links observed | Robots allows the inspected page and excludes admin/login/search. Linked terms apply to forum/classified use; no restriction applicable to reading the first-party room page was found | Candidate for Bandtown's own room metadata after operator review; third-party guide entries should remain discovery links, not copied inventory |
| Hamburg — [Bandhaus Hamburg](https://www.bandhaus-hamburg.de/) | First-party room-rental description and public contact page | Robots permits the homepage while excluding account/search/API and structured-format paths; privacy/imprint but no general use terms were linked | Viable first-party metadata candidate for bounded operator review; do not use excluded API/structured paths |

Actual next candidates, subject to a human operator decision: Kultur Räume Berlin (structured public cultural supply), noisy Rooms (first-party Berlin supply), Bandhaus Hamburg (first-party supply), Bandtown's own rooms, and Proberaum Stuttgart. Stuttgart remains the weakest city because neither first-party site published a clear automation/reuse policy. Classified portals with explicit prohibitions or access blocks are excluded from the candidate set.

## Decision gate

Before any ingestion experiment, review the current robots directives and applicable terms for one candidate at a time, document allowed paths and rate limits, and obtain a clear go/no-go decision. Only after a positive review should a separate, capped run fetch at most five listing details for that source. Contact mechanisms must remain metadata only; no messages or account creation are authorized by this research.
