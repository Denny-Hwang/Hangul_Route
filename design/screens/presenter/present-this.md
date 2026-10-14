# Present this on the All lessons item page (screen spec v1)

Spec: F-BROWSE-001 section 4.6 (secondary action), OD-9, PR table BR-13 · F-TCH-004 PR 6 (the presenter root it opens)
Mock: `mock/present-this.html` (the merged `browse/mock/item.html` with the button added; it links `../../browse/mock/browse.css`) · shots `present-this-375.png`, `present-this-1280.png`

## Anatomy

- In the item page's action bar, under **Preview this lesson**: **Present this** (`caregiver.browse.item.present.cta`), the browse mock's ghost button (`brand.primary` border and label, `touchTarget.child` tall, full width up to 26 rem).
- Its accessible description is "Opens the lesson as slides for a classroom screen or a TV. No one's progress changes." (`caregiver.browse.item.presentNote`).
- Shown only with a full pass (scope `full`) and once the presenter root exists, and only when `expandDeck` of the one-block deck yields at least one slide: quests from BR-13 on, stories only after F-TCH-004 PR 11, word topics only after PR 12 (before then a story or topic block expands to nothing and would land on the invalid-link state). BR-13 tests this condition per item kind. It opens `/present#d=…` with a one-block deck (`source: 'catalogue'`, picker `numbers`, 12), in a new tab, with no names.
