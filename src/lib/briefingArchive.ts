import items from '../data/published-briefings.json'
import type { Briefing } from './briefings'

// Imported by the lazy archive page and search dialog, never by the home preview.
export const briefings = items as Briefing[]
