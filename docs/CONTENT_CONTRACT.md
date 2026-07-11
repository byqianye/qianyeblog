# Garden Content Contract

The `blog` collection is the single source of public garden entries.

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `kind` | `article \| note \| resource` | yes | Controls browsing and presentation. |
| `title` | string | yes | Non-empty public title. |
| `description` | string | yes | Search and social summary. |
| `pubDate` | date | yes | Initial publication date. |
| `updatedDate` | date | no | Material revision date. |
| `tags` | string[] | yes | Defaults to an empty list. |
| `cover` | string | no | Original local media path. |
| `coverAlt` | string | no | Required by editorial policy when a cover conveys information. |
| `externalUrl` | URL | resource only | Required for `resource`; forbidden invalid URLs. |
| `featured` | boolean | yes | Defaults to false. |
| `draft` | boolean | yes | Defaults to false and is excluded publicly. |

Public routes remain `/blog` and `/blog/:slug`. Search records retain `title`, `description`, and `url`, and add `kind`, `tags`, and `externalUrl`.
