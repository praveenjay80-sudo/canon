export function parsePrerequisites(text) {
  if (!text) return null;

  const result = { work: '', field: '', difficulty: '', context: '', phases: [], totalPath: '' };
  const lines = text.split('\n');
  let currentPhase = null;
  let collectingContext = false;
  let contextLines = [];

  for (const line of lines) {
    const workMatch = line.match(/^WORK:\s*(.+)$/);
    if (workMatch) { result.work = workMatch[1].trim(); collectingContext = false; continue; }

    const fieldMatch = line.match(/^FIELD:\s*(.+)$/);
    if (fieldMatch) { result.field = fieldMatch[1].trim(); collectingContext = false; continue; }

    const diffMatch = line.match(/^DIFFICULTY:\s*(.+)$/);
    if (diffMatch) { result.difficulty = diffMatch[1].trim(); collectingContext = false; continue; }

    if (line.match(/^CONTEXT:\s*/)) {
      collectingContext = true;
      const inline = line.replace(/^CONTEXT:\s*/, '').trim();
      if (inline) contextLines.push(inline);
      continue;
    }

    const totalMatch = line.match(/^TOTAL PATH:\s*(.+)$/);
    if (totalMatch) {
      result.totalPath = totalMatch[1].trim();
      collectingContext = false;
      if (contextLines.length) result.context = contextLines.join(' ');
      continue;
    }

    const phaseMatch = line.match(/^PHASE\s+(\d+):\s*(.+)$/i);
    if (phaseMatch) {
      collectingContext = false;
      if (contextLines.length && !result.context) result.context = contextLines.join(' ');
      if (currentPhase) result.phases.push(currentPhase);
      currentPhase = { number: parseInt(phaseMatch[1]), name: phaseMatch[2].trim(), focus: '', works: [] };
      continue;
    }

    if (line.trim() === '---') { collectingContext = false; continue; }

    if (collectingContext && line.trim()) { contextLines.push(line.trim()); continue; }

    if (!currentPhase) continue;

    if (line.match(/^-\s+/)) {
      const workLine = line.slice(2).trim();
      const dashIdx = workLine.indexOf(' — ');
      currentPhase.works.push({
        ref: dashIdx >= 0 ? workLine.slice(0, dashIdx) : workLine,
        rationale: dashIdx >= 0 ? workLine.slice(dashIdx + 3) : '',
        focus: '',
      });
    } else if (line.match(/^\s*→\s*/) && currentPhase.works.length > 0) {
      const focusText = line.replace(/^\s*→\s*(Focus:\s*)?/, '').trim();
      currentPhase.works[currentPhase.works.length - 1].focus = focusText;
    } else if (line.trim() && !currentPhase.focus) {
      currentPhase.focus = line.trim();
    }
  }

  if (currentPhase) result.phases.push(currentPhase);
  if (contextLines.length && !result.context) result.context = contextLines.join(' ');
  return result;
}
