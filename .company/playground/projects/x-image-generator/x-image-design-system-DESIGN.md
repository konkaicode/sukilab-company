# X Image Design System

## Overview

X Image Design System is a clean, high-contrast design system built for social media infographic slides. It is optimized for 1200×675px (16:9) images for X (Twitter) posts. The foundation of soft purple-gray backgrounds with white floating cards and vibrant orange accents creates a modern, readable, and visually distinctive style that stands out in timelines.

**Scope**: This design system is for use within the `x-image-generator` project only.

**Target output**: 1200×675px PNG images (exported via browser screenshot or Playwright)

---

## Canvas

- **Slide size**: 1200 × 675 px
- **Aspect ratio**: 16:9
- **Background**: Surface Default (#E4E4EE) — soft purple-gray
- **Background decoration**: Two soft white circles (right-top and left-bottom) to add depth

### Background Decorations
- **Top-right circle**: 680×680px, `rgba(255,255,255,0.18)`, positioned at top:-270px right:-180px
- **Bottom-left circle**: 440×440px, `rgba(255,255,255,0.11)`, positioned at bottom:-190px left:-110px

---

## Colors

- **Background**: #E4E4EE — slide canvas, soft purple-gray
- **Surface**: #FFFFFF — card backgrounds
- **Item Background**: #F3F3FA — list/grid item rows, subtle purple-tinted gray
- **Primary Text**: #1C1C1E — headlines, card text, strong labels
- **Muted Text**: #6B7280 — descriptions, notes, sub-labels
- **Arrow / Before Label**: #AAAAB8 — Before label, arrow symbols, inactive states

- **Accent Orange**: #F97316 — badge, After label, icon strokes, highlight text
- **Orange Light**: #FFF3E0 — question icon background, bulb icon background, badge glow

- **Success Green**: #22C55E — check icon stroke, grid item check
- **Green Light**: #F0FDF4 — check icon background circle
- **Error Red**: #EF4444 — cross icon stroke, error state
- **Red Light**: #FEF2F2 — cross icon background circle

- **Arrow Gray**: #C0C0CC — the → arrow between Before/After cards

---

## Typography

- **Headline Font**: Noto Sans JP
- **Body Font**: Noto Sans JP (same family, different weights)

Font weights available: Regular (400), Medium (500), Bold (700), Black (900)

### Line Height — Global Rule

**All text uses line-height: 160% (1.6) uniformly.**
Do not use any other line-height value. 160% ensures readable spacing across Japanese characters at all sizes.

### Scale

- **Slide Title**: Noto Sans JP 40–44px Black (900), #1C1C1E, letter-spacing -0.5px, line-height 160%
- **Badge Number**: Noto Sans JP 30px Black (900), #FFFFFF, line-height 160%
- **Card Text**: Noto Sans JP 24–26px Bold (700), #1C1C1E, line-height 160%
- **List/Grid Item Text**: Noto Sans JP 19–22px Bold (700), #1C1C1E, line-height 160%
- **Description / Sub Text**: Noto Sans JP 14–16px Medium (500), #6B7280, line-height 160%
- **Before / After Label**: Noto Sans JP 38px Black (900), letter-spacing 1px, line-height 160%
- **Note / Caption**: Noto Sans JP 15–17px Medium (500), #6B7280, centered, line-height 160%
- **Speech Bubble Text**: Noto Sans JP 15–17px Medium (500), #1C1C1E, line-height 160%

---

## Spacing

Base unit: **8px**

- **xs**: 4px — icon internal gaps
- **sm**: 8px — between icon and text in a row
- **md**: 16px — card internal small gaps
- **lg**: 24px — section gaps
- **xl**: 36–44px — title margin-bottom
- **2xl**: 48px — card padding horizontal
- **slide-pad-x**: 90–220px — horizontal margin from slide edge to card

---

## Figma Auto Layout Rules

**All frames must use Auto Layout.** Manual positioning (absolute x/y) is not used for content elements. This ensures vertical centering, consistent spacing, and easy editing.

### Slide Root Frame
- Direction: **Vertical**
- Horizontal alignment: **Center**
- Vertical alignment: **Center** (space elements evenly in the 675px height)
- Padding: **64px top/bottom, 0px left/right** (slide edge breathing room)
- Gap between title and card: **36–40px**

### Card (Wide / Summary)
- Direction: **Vertical**
- Horizontal alignment: **Center**
- Vertical alignment: **Center**
- Padding: **40px top/bottom, 48–56px left/right**
- Gap between internal elements: **16–20px**

### Card (Half — Before/After row)
- The **row container** holding both half-cards and arrow: Direction Horizontal, alignment Center, gap 0
- Each **half-card**: Direction Vertical, alignment Center, padding 38px top/bottom, 44px left/right, gap 12px

### List Item Row
- Direction: **Horizontal**
- Horizontal alignment: **Left**
- Vertical alignment: **Center**
- Padding: **14px top/bottom, 20px left/right**
- Gap between icon and text: **16px**

### Grid Item
- Direction: **Horizontal**
- Horizontal alignment: **Left**
- Vertical alignment: **Center**
- Padding: **14px top/bottom, 18px left/right**
- Gap between icon and text: **14px**

### Grid Container (2-column)
- Direction: **Horizontal**, wrap enabled
- Column gap: **24px**, Row gap: **12px**

---

### Padding Hierarchy — From Outside to Inside

Padding decreases as elements nest deeper. This creates a natural visual hierarchy.

```
Slide root      → 64px  (top/bottom breathing room)
  └ Card        → 48px  (horizontal), 40px (vertical)
      └ Item row → 20px (horizontal), 14px (vertical)
          └ Icon → 0px  (icon is fixed size, no extra padding)
```

| Level | Element | Horizontal | Vertical |
|-------|---------|-----------|---------|
| 1 | Slide root | — | 64px |
| 2 | Card (Wide) | 48–56px | 40px |
| 3 | List/Grid Item | 18–20px | 14px |
| 4 | Icon area | 0px | 0px |

**Rule**: Never let an inner element have more padding than its parent.

---

## Border Radius

- **sm** (12px): Grid items
- **DEFAULT** (14px): List item rows
- **card** (28px): All main cards
- **full** (9999px): Badges, icon backgrounds (circles)

---

## Elevation

Cards use a two-layer diffused shadow to float cleanly above the background.

- **Card shadow layer 1**: 0 2px 8px rgba(15,23,42,0.06) — subtle base
- **Card shadow layer 2**: 0 12px 40px rgba(15,23,42,0.10) — main floating effect
- **Badge shadow**: 0 4px 18px rgba(249,115,22,0.38) — orange glow

---

## Components

### Badge
Circular orange indicator, typically contains a number or short symbol.

- Size: 62×62px, border-radius: full
- Fill: #F97316
- Text: #FFFFFF, 30px, Black
- Shadow: 0 4px 18px rgba(249,115,22,0.38)
- Usage: Top-left of slide title row (optional — omit for non-numbered posts)

---

### Slide Title
Displayed above the main card. Centered or left-aligned.

- Font: Noto Sans JP 40–44px Black
- Color: #1C1C1E
- Width: 1200px, text-align: center
- Margin-bottom: 36–44px

---

### Card (Wide)
Full-width card for single-focus slides (problem list, grid, summary).

- Width: 820–840px
- Min-height: 380–420px
- Padding: 40px vertical, 48–56px horizontal
- Fill: #FFFFFF
- Border-radius: 28px
- Shadow: Card shadow (two layers)
- Centered horizontally on slide (margin: auto)

---

### Card (Half — Before/After)
Used in pairs for Before/After comparison slides.

- Width: 420px each
- Min-height: 248–268px
- Padding: 38–40px vertical, 44px horizontal
- Fill: #FFFFFF
- Border-radius: 28px
- Shadow: Card shadow (two layers)
- Text-align: center, items centered vertically

**Left card = Before**: Positioned at x≈90px from slide left
**Right card = After**: Positioned at x≈690px from slide left

---

### Arrow (Before → After)
Separates Before and After cards.

- Character: `→`
- Font: 36–42px Bold
- Color: #C0C0CC
- Position: Centered between the two cards (x≈552px)

---

### Before / After Labels
Displayed below the Before/After cards.

- Before: 38px Black, color: #AAAAB8, centered under left card
- After: 38px Black, color: #F97316, centered under right card
- Margin-top from cards: ~20px

---

### List Item Row
Used in the Problem slide. Horizontal row with icon + text.

- Width: 748px, height: 64–68px
- Fill: #F3F3FA
- Border-radius: 14px
- Padding: 13–16px vertical, 22px horizontal
- Icon: 40px circle (left), text at x=68px
- Gap between rows: 12–14px

---

### Grid Item
Used in the Feature/Checklist slide. 2-column grid.

- Width: 360–372px, height: 66–68px
- Fill: #F3F3FA
- Border-radius: 12px
- Padding: 14–16px vertical, 18–20px horizontal
- Icon: 40–42px circle (left), text at x=64px
- Grid: 2 columns, gap-x: 24–28px, gap-y: 12–14px

---

### Character — Noruman (のるまんレッグ)

An orange round bear character used to add personality and commentary to slides. Noruman speaks via a speech bubble to deliver reactions, tips, or casual comments alongside the main content.

**Character image file**: `noruman-leg.png`
**Character size**: 96×96px (standard), 120×120px (emphasis)

#### Speech Bubble (吹き出し)

The bubble floats to the left or right of Noruman, depending on the slide layout.

**Shape**:
- Background: #FFFFFF
- Border-radius: 16px
- Border: 1.5px solid #E4E4EE
- Shadow: 0 4px 16px rgba(15,23,42,0.10)
- Min-width: 200px, Max-width: 320px
- Padding: 14px horizontal, 12px vertical

**Tail (吹き出しの尾)**:
- A small triangle pointing toward Noruman
- Size: 10×8px
- Fill: #FFFFFF
- Stroke: 1.5px #E4E4EE (visible on two sides only)
- Position: bottom-left of bubble (if Noruman is on the right), bottom-right (if Noruman is on the left)

**Text inside bubble**:
- Font: Noto Sans JP 15px Medium (500)
- Color: #1C1C1E
- Line-height: 160%
- Max 2–3 lines

#### Auto Layout for Character Block

The character + bubble group uses Auto Layout:

- Direction: **Horizontal**
- Vertical alignment: **Bottom** (Noruman sits at bottom, bubble floats up)
- Gap: **8px** between bubble and character
- The entire block is positioned at the **bottom-right or bottom-left corner** of the slide

```
Slide root (Vertical Auto Layout)
  └ Main content (title + card)
  └ Character Row (Horizontal, bottom-aligned)
      ├ [Speech Bubble]
      │    [Bubble text]
      │    [Tail ▽]
      └ [Noruman image]
```

#### Placement Variants

**Right variant** (Noruman sits at bottom-right):
- Character at right, bubble to the left
- Used as default

**Left variant** (Noruman sits at bottom-left):
- Character at left, bubble to the right
- Used when slide content is right-heavy

#### Tone of Speech Bubble Text

- Casual, first-person, light commentary
- Examples:
  - 「これ、めっちゃ大事！」
  - 「わかる〜！」
  - 「仕組み化、大事だよね」
  - 「ここ、ポイント！」
- Maximum 30 characters per bubble
- No formal language — keep it friendly and reactive

---

### Icons

#### Question Mark (Problem / Caution)
- Background circle: 40px, fill: #FFF3E0
- Icon stroke: #F97316, 2.2px
- Path: Rounded ? with small dot below

#### Check Mark (Success / After)
- Background circle: 40–52px, fill: #F0FDF4 (grid) or outline only (card)
- Icon stroke: #22C55E, 2.2–2.4px
- Path: `M 9 15 L 14 20 L 21 11` (scaled)

#### Cross Mark (Error / Before)
- Background circle: 40–52px, fill: #FEF2F2 (card)
- Icon stroke: #EF4444, 2.4px
- Path: Two diagonal lines (×)

#### Down Arrow (Scroll / Call to Action)
- Background circle: 52px, fill: #E4E4EE
- Icon stroke: #AEAEBE, 2.4px
- Path: Vertical line with downward chevron

#### Light Bulb (Summary / Insight)
- Background circle: 72–80px, fill: #FFF3E0
- Bulb body: 34–38px circle outline, stroke: #F97316, 2.4px
- Neck lines: 2 horizontal lines below bulb
- Optional: 3 short ray lines above/sides

---

## Slide Patterns

### Pattern A — Problem / Question List
Single wide card with a vertical list of question/issue items.

```
[Slide Title (centered, no badge)]
[Wide Card]
  [List Item Row] × 3
  [Note text (centered, muted)]
```

- Use when: Introducing a relatable problem or pain points
- Item icon: Question Mark (orange)
- No badge needed; title is the hook

---

### Pattern B — Before / After
Two half-cards side by side with an arrow between them.

```
[Slide Title (centered)]
        [Before Card]  →  [After Card]
         Before              After
```

- Use when: Showing improvement, transformation, or a tip in action
- Before card icon: Cross (red) or Down Arrow
- After card icon: Check Mark (green)
- Labels: Before = #AAAAB8, After = #F97316

---

### Pattern C — Feature / Checklist Grid
Wide card with a 2-column grid of check items.

```
[Slide Title (centered)]
[Wide Card]
  [Sub note (centered, muted)]
  [Grid Item] [Grid Item]
  [Grid Item] [Grid Item]
  [Grid Item] [Grid Item]
```

- Use when: Listing features, capabilities, or checklist items
- Item icon: Check Mark (green), small version
- Max 6 items (3 rows × 2 columns). Use "…etc" for overflow.

---

### Pattern D — Summary / Insight
Wide card centered, with a large icon, main message, and sub-description.

```
[Slide Title (centered)]
[Wide Card]
  [Icon (centered)]
  [Main Message (centered, large, bold)]
  [Sub Description (centered, muted)]
```

- Use when: Closing a series, summarizing a takeaway, or delivering the key insight
- Icon: Light Bulb (orange) for insight/tip, Check (green) for resolution
- Main message: 2 lines max, 26–28px Black
- Sub description: 2 lines max, 16–17px Medium, muted

---

### Pattern E — With Character Comment (Noruman)
Any of Patterns A–D with Noruman added at the bottom corner with a speech bubble.

```
[Slide Title (centered)]
[Main Card  ← same as A/B/C/D]

[Character Row — bottom of slide]
  [Speech Bubble]  [Noruman image]
```

Figma Auto Layout for this pattern:
- Slide root: Vertical, gap between main content group and character row = 24px
- Character row: Horizontal, bottom-aligned, pushed to right edge (right padding 32px)
- The character row sits inside the slide root's Auto Layout flow — never absolutely positioned

- Use when: Wanting to add personality, a reaction, or a casual highlight
- Bubble text: Short, casual, 1–2 lines, max 30 chars
- Combine with any Pattern A–D

---

## Do's and Don'ts

1. **Do** maintain the soft purple-gray background — it creates the calm, digestible feel.
2. **Do** use white cards with strong corner radii (28px) — the floating card look is the signature of this system.
3. **Do** keep slide titles concise: ideally 15 characters or fewer in Japanese.
4. **Do** use orange (#F97316) as the primary accent — for After labels, badges, and highlight elements only.
5. **Don't** add more than 3 list items (Pattern A) or 6 grid items (Pattern C) — keep it scannable.
6. **Don't** mix Before/After patterns with grid patterns on the same slide.
7. **Don't** use fonts other than Noto Sans JP — consistency in weight and feel is critical.
8. **Don't** change the card shadow — the two-layer diffused shadow is intentional and gives the depth.
9. **Do** keep text in cards short: card text should be readable at a glance (2 lines max for main message).
10. **Don't** add background colors to slides other than #E4E4EE — the subtle purple-gray is the visual anchor.
11. **Do** use Auto Layout for every frame — no manual x/y positioning for content elements.
12. **Do** set line-height to 160% on all text — never override this for individual elements.
13. **Do** follow the padding hierarchy (slide 64px → card 48px → item 20px) — padding must decrease as you go deeper.
14. **Don't** absolutely position the Noruman character — always include it in the slide root's Auto Layout flow.
15. **Don't** make Noruman's speech bubble text formal or long — max 30 characters, casual tone only.
