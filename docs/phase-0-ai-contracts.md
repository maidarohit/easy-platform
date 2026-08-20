# Phase 0 AI integration contract baseline

This document records the production integration contracts present before the
Project Workspace work. Phase 0 deliberately makes no runtime changes. The
offline tests in `tests/contracts/ai-module-contracts.test.mjs` guard these
contracts without sending requests to n8n.

## Shared behavior

- All generation operations use `POST` with a JSON request body.
- Route handlers are thin server-side proxies and forward the incoming body to
  n8n without schema validation or authentication.
- Branding AI and Website AI are exceptions: their client pages call n8n
  directly.
- JSON result shapes are not uniform. Frontends currently accept combinations
  of `output`, `content`, `result`, `text`, or a raw object.
- Image AI returns `image/png`; Video AI returns `video/mp4`.
- Inputs and outputs normally live only in React component state. Marketing AI
  additionally uses the browser keys `marketingProjects` and
  `selectedMarketingProject`.

## Module contracts

| Module | Frontend | App endpoint / direct upstream | Request fields | Response consumed |
| --- | --- | --- | --- | --- |
| AI Manager | `/ai-manager` | `/api/ai-manager` -> authenticated n8n webhook | `companyName`, `businessDescription`, `industry`, `businessGoal` | `output` object |
| Analytics AI | `/analytics-ai` | `/api/analytics-ai` -> authenticated n8n webhook | company profile, traffic, leads, sales, revenue, budget and goal fields | `output` or raw JSON |
| Branding AI | `/branding-ai` | `/api/branding-ai` -> authenticated n8n webhook | `companyName`, `industry`, `targetAudience`, `brandStyle`, `brandDescription` | `output` object |
| Website AI | `/dashboard/website-ai` | direct n8n UUID webhook | same five brand fields | `output` object |
| Marketing AI | `/marketing-ai` | `/api/marketing-ai` -> n8n UUID webhook | five brand fields; edit/regenerate calls add current result and section instructions | nested JSON normalized by the page |
| Sales AI | `/sales-ai` | `/api/sales-ai` -> n8n UUID webhook | `companyName`, `industry`, `salesGoal`, `targetAudience`, `businessDescription` | `output` or raw JSON |
| SEO AI | `/seo-ai` | `/api/seo-ai` -> n8n UUID webhook | five brand fields | nested JSON normalized by the page |
| UI/UX AI | `/uiux-ai` | `/api/uiux-ai` -> authenticated n8n webhook | five brand fields | nested JSON normalized by the page |
| Content AI | `/dashboard/content-ai` | `/api/content-ai` -> authenticated n8n webhook | `prompt`, `contentType`, `tone`, `audience`, `length`, `keywords` | content/output/text/result |
| Logo AI | `/dashboard/logo-ai` | `/api/logo-ai` -> authenticated n8n webhook | `companyName`, `industry`, `brandStyle`, `logoIdea` | `output` or raw JSON |
| Image AI | `/dashboard/image-ai` | `/api/image-ai` -> authenticated n8n webhook | `prompt`, `style`, `size` | PNG blob |
| Presentation AI | `/dashboard/presentation-ai` | `/api/presentation-ai` -> authenticated n8n webhook | topic, type, audience, tone, slide count, key points and design style | presentation/content/output/result/text |
| Video AI | `/dashboard/video-ai` | `/api/video-ai` -> authenticated n8n webhook | prompt plus visual, camera, lighting, duration and aspect settings | MP4 blob |

## Automation Hub contracts

| Mode | Endpoint | Request fields |
| --- | --- | --- |
| Content | `/api/automation/content` | `businessName`, `contentType`, `targetAudience`, `tone`, `topic`, `instructions` |
| Email | `/api/automation/email` | `businessName`, `targetAudience`, `tone`, `topic`, `instructions` |
| Social | `/api/automation/social` | business fields plus `platform` and `postType` |
| Workflow | `/api/automation/workflow` | `businessName`, `automationGoal`, `trigger`, `actions`, `tools`, `instructions` |
| Pipeline | `/api/automation/pipeline` | `businessName`, `pipelineGoal`, `capabilities`, `instructions` |

All five modes consume JSON and select `content`, `output`, or `result` in the
frontend. The separate `/dashboard/automation/email` page is currently empty.

## Compatibility requirements for later phases

1. Do not rename existing fields or change their value formats before the n8n
   workflows are versioned.
2. Preserve binary transport for Image AI and Video AI.
3. Preserve raw n8n output while introducing any future normalized envelope.
4. Add server proxies for Branding AI and Website AI before adding project or
   authentication metadata to their requests.
5. Treat the Marketing AI local-storage format as migration input, not as the
   future shared project schema.
6. Do not make live n8n calls in automated tests; use fixtures or mocked fetch
   when behavioral integration tests are introduced.
