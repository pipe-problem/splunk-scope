import SourceIntelSections from './SourceIntelSections.jsx';

export default function SourceMoreInfoPanel({ source, useCases, sourceStates }) {
  if (!source) return null;
  return (
    <SourceIntelSections
      source={source}
      useCases={useCases}
      sourceStates={sourceStates}
      showSizingReference={false}
      showOverlap
    />
  );
}
