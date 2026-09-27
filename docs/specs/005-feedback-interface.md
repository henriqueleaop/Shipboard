# Sprint 005 interface inventory

The Shipboard redesign uses an ink/navy navigation surface, warm neutral canvas,
teal primary actions and restrained amber accents. Status colors always pair
with labels. Type, spacing, borders and focus styles are shared across every
screen. The product language remains English. No decorative control implies an
unavailable feature.

The public board presents product identity, a suggestion action, sort/filter
controls and rows with vote, title, description and status. Suggestion detail
uses a readable content column and compact status/action panel. Owner pages use
a navigation rail on desktop, compact navigation on mobile, board context and
actionable feedback rows. Home explains the real feedback loop; auth shows
email/password and GitHub only when the provider is configured.

Verify home, login, registration, owned-board list and empty state, board
creation, metadata settings, public board and filtered empty state, suggestion
detail/submission, owner feedback/status editor, and not-found/error states at
1440, 768 and 390 pixels, with a 320-pixel overflow check and 200% zoom.
Capture and inspect representative rendered screenshots with disposable data.
Keyboard focus, non-color-only state, long content and reduced motion are
mandatory. Product copy must match implemented behavior.

Every editable field has an explicit policy. Email uses its native input mode
and shared validation while retaining valid plus aliases. Password is never
normalized and has an accessible visibility control. Board name and free-text
descriptions retain valid Unicode and punctuation. The board slug has a URL
preview and an explicit action to apply a canonical suggestion; invalid input
is explained without silently renaming it. Suggestion title and description
use shared trimmed validation. Sort and status controls contain only supported
values and use accessible labels. All fields preserve paste, autofill, undo,
middle edits and IME composition, with associated errors and visible progress.
