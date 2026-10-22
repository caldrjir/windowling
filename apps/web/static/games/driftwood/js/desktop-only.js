'use strict';
// Windowling Game Center: DRIFTWOOD is for computers only (mouse + keyboard). Phones and
// tablets (no hover, coarse pointer) go back to the center, which explains why.
if (matchMedia('(hover: none) and (pointer: coarse)').matches) location.replace('/');
