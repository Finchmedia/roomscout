# Upstream provenance

This directory began as a local fork of `packages/convex-stagehand` from
<https://github.com/browserbase/integrations> at commit
`b7bc81c6fd4e089ab0c0df2b82529b200739e458` (MIT).

RoomScout previously extended that component's hosted Stagehand REST v1
transport. The REST client and every network action were retired when browser
automation moved to the installed Stagehand v4 Node SDK. The remaining schema
and internal functions exist solely to preserve non-sensitive lifecycle metadata
for already recorded and future provider sessions; they do not implement or
proxy upstream browser automation.
