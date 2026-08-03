/**
 * Use Case Resolver
 * Resolves the dual-input model (structured multi-select + freeform text)
 * into a unified list of use case profiles for all downstream engines.
 */

import useCaseProfiles from '../data/useCaseProfiles.json'
import { parseCustomUseCases } from './interpretationEngine.js'

const profilesByName = new Map(useCaseProfiles.map((p) => [p.name, p]))
const profilesById = new Map(useCaseProfiles.map((p) => [p.id, p]))

/**
 * Resolve intake data into a unified list of use case profiles.
 * Handles both structured selections (profile names) and freeform custom text.
 *
 * @param {Object} intake - The intake state object
 * @returns {{ profiles: Array, customUnmatched: string[], hasCustom: boolean }}
 */
export function resolveUseCaseProfiles(intake) {
  const structuredNames = intake?.useCases || []
  const structuredProfiles = structuredNames
    .map((name) => profilesByName.get(name))
    .filter(Boolean)

  const customParsed = parseCustomUseCases(intake?.customUseCases)

  const freeformProfiles = customParsed.matched
    .map((m) => profilesById.get(m.id))
    .filter(Boolean)
    .filter((p) => !structuredProfiles.some((sp) => sp.id === p.id))

  const allProfiles = [...structuredProfiles, ...freeformProfiles]
  const customUnmatched = customParsed.unmatched

  return {
    profiles: allProfiles,
    customUnmatched,
    hasCustom: !!(intake?.customUseCases?.trim()),
  }
}
