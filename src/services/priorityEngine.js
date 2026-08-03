/**
 * Priority Engine
 * Scores and ranks data sources based on use-case relevance,
 * gap closure, domain contribution, ingest efficiency, and dependencies.
 */

import { calculateSourcePriority } from './coverageEngine.js'
import { calculateSourceSize } from './sizingEngine.js'
import sourceCatalogTree from '../data/sources.json' with { type: 'json' }

/**
 * Score all sources relative to the current planning context.
 */
export function scoreAllSources(sourceCatalog, useCases, currentCoverage, sourceStates) {
  const scored = []

  for (const source of sourceCatalog) {
    const ss = sourceStates[source.id] || {}
    const estimate = calculateSourceSize(source, ss, { catalog: sourceCatalogTree, allInputs: sourceStates })
    const priority = calculateSourcePriority(source, useCases, currentCoverage, estimate.expected)

    let statusBonus = 0
    if (ss.status === 'current') statusBonus = 10
    else if (ss.status === 'future') statusBonus = 5

    const dependenciesMet = checkDependencies(source, sourceStates)

    scored.push({
      id: source.id,
      name: source.name,
      category: source.category,
      status: ss.status || 'unknown',
      priorityScore: priority.score + statusBonus,
      reasons: priority.reasons,
      estimatedGB: estimate.expected,
      confidence: estimate.confidence,
      valuePerGB: estimate.expected > 0 ? priority.score / estimate.expected : 0,
      dependenciesMet,
      stage: determineStage(priority.score, ss.status),
    })
  }

  scored.sort((a, b) => b.priorityScore - a.priorityScore)
  return scored
}

/**
 * Get the next highest-priority unconfigured source.
 */
export function getNextPriority(scoredSources) {
  return scoredSources.find((s) => s.status === 'unknown' || !s.status) || null
}

/**
 * Get sources that would close specific coverage gaps.
 */
export function getGapClosers(scoredSources, gaps) {
  const gapSet = new Set(gaps)
  return scoredSources.filter((s) => {
    return s.reasons.some((r) => {
      const match = r.match(/Fills required gap: (.+?) \(/)
      return match && gapSet.has(match[1].replace(/ /g, '_'))
    })
  })
}

function checkDependencies(source, sourceStates) {
  const deps = source.dependencies || []
  if (deps.length === 0) return { met: true, missing: [] }

  const missing = deps.filter((depId) => {
    const depState = sourceStates[depId]
    return !depState || (depState.status !== 'current' && depState.status !== 'future')
  })

  return { met: missing.length === 0, missing }
}

function determineStage(priorityScore, status) {
  if (status === 'current') return 'crawl'
  if (priorityScore >= 40) return 'walk'
  if (priorityScore >= 20) return 'walk'
  return 'run'
}
