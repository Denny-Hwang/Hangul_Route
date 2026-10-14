# Present this on the All lessons item page (screen spec v1)

Spec: F-BROWSE-001 section 4.6 (secondary action), OD-9, PR table BR-13 · F-TCH-004 PR 6 (the presenter root it opens)
Mock: `mock/present-this.html` (the merged `browse/mock/item.html` with the button added; it links `../../browse/mock/browse.css`) · shots `present-this-375.png`, `present-this-1280.png`

## Anatomy

- In the item page's action bar, under **Preview this lesson**: **Present this** (`caregiver.browse.item.present.cta`), the browse mock's ghost button (`brand.primary` border and label, `touchTarget.child` tall, full width up to 26 rem).
- Its accessible description is "Opens the lesson as slides for a classroom screen or a TV. Nothing is saved." (`caregiver.browse.item.presentNote`).
- Shown only with a full pass (scope `full`) and once the presenter root exists; for a quest, a story or a word topic. It opens `/present#d=…` with a one-block deck (`source: 'catalogue'`, picker `numbers`, 12), in a new tab, with no names.
