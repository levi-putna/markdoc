# UI/UX Laws — Applied Examples

Concrete before/after patterns for this project's stack (React + Tailwind + lucide-react). Use alongside [SKILL.md](SKILL.md).

## Forcing Function (destructive confirmation)

```tsx
// Before — both buttons compete equally, easy to misclick
<div className="flex gap-2 justify-end">
  <button className="btn btn-danger">Delete document</button>
  <button className="btn">Cancel</button>
</div>

// After — safe choice is the loud default; destructive choice is a quiet, tinted link
<div className="flex items-center justify-between">
  <button className="text-sm text-red-600 hover:underline">Delete document</button>
  <button autoFocus className="btn btn-primary">Cancel</button>
</div>
```

## Focus Ring (keyboard-only, DOM-following, modal-trapped)

```tsx
// Before — outline removed globally, no keyboard-only distinction
button:focus { outline: none; }

// After — Tailwind, visible only for keyboard focus
<button className="rounded-md px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
  Insert table
</button>
```

For modals/overlays like `SearchOverlay`, trap focus with a `FocusTrap`-style effect (cycle Tab/Shift+Tab within the dialog, restore focus to the trigger on close) rather than letting focus escape to the underlying document.

## Hierarchy Through Contrast (not font-size escalation)

```tsx
// Before — hierarchy from size alone
<h3 className="text-2xl font-normal">Preferences</h3>
<p className="text-lg text-gray-700">Choose your editor font.</p>

// After — same-ish size, hierarchy from weight + colour
<h3 className="text-base font-semibold text-gray-900">Preferences</h3>
<p className="text-base font-normal text-gray-500">Choose your editor font.</p>
```

## Tabular Numerals (word count, line numbers)

```tsx
// Before — proportional digits drift as they change
<span className="text-xs text-gray-500">{wordCount} words</span>

// After — fixed-width digits, no layout jitter
<span className="text-xs text-gray-500 [font-variant-numeric:tabular-nums]">
  {wordCount} words
</span>
```

## 60-30-10 Rule (colour proportion)

```tsx
// Before — accent colour scattered across toolbar, sidebar, and badges
<Toolbar className="bg-blue-50">
  <Button className="text-blue-600">Bold</Button>
  <Button className="text-blue-600">Italic</Button>
</Toolbar>

// After — neutral base (60%), muted secondary panel (30%), one accent (10%) reserved for the active/primary state only
<Toolbar className="bg-neutral-50">
  <Button className="text-neutral-700 data-[active=true]:text-accent">Bold</Button>
  <Button className="text-neutral-700 data-[active=true]:text-accent">Italic</Button>
</Toolbar>
```

## Inline Validation (validate on blur, clear on edit)

```tsx
const [error, setError] = useState<string>();

function handleBlur(value: string) {
  setError(isValidFontName(value) ? undefined : "Enter a valid font name");
}

function handleChange(value: string) {
  setFontName(value);
  if (error) setError(undefined); // clear instantly on next edit
}

<input
  value={fontName}
  onChange={(e) => handleChange(e.target.value)}
  onBlur={(e) => handleBlur(e.target.value)}
  aria-invalid={!!error}
  className={error ? "border-red-500" : "border-gray-300"}
/>
{error && <p className="text-xs text-red-600 mt-1">{error}</p>}
```

## Law of Common Region + Proximity (grouping controls)

```tsx
// Before — spacing alone tries to imply grouping
<div className="flex gap-6">
  <Button icon={Bold} /><Button icon={Italic} /><Button icon={Underline} />
  <Button icon={List} /><Button icon={ListOrdered} />
</div>

// After — shared container (common region) + tight internal spacing (proximity) per group
<div className="flex gap-4">
  <div className="flex gap-1 rounded-md bg-neutral-100 p-1">
    <Button icon={Bold} /><Button icon={Italic} /><Button icon={Underline} />
  </div>
  <div className="flex gap-1 rounded-md bg-neutral-100 p-1">
    <Button icon={List} /><Button icon={ListOrdered} />
  </div>
</div>
```

## Von Restorff Effect (reserve distinction for one thing)

```tsx
// Before — every view-mode button gets the same "active" treatment plus extra badges/colours
// After — only the truly active segment gets the accent; others stay neutral
<div className="flex rounded-md bg-neutral-100 p-0.5">
  {["Edit", "Preview", "Split"].map((mode) => (
    <button
      key={mode}
      className={
        mode === activeMode
          ? "rounded-md bg-white px-3 py-1 text-sm font-medium shadow-sm"
          : "rounded-md px-3 py-1 text-sm text-neutral-600"
      }
    >
      {mode}
    </button>
  ))}
</div>
```
