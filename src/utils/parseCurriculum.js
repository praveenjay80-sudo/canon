// Strip markdown bold/italic and leading # from a line before matching
function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

export function parseCurriculum(text) {
  if (!text) return null;

  const result = {
    topic: '', overview: '', levelRange: '', tracks: [],
    courses: [], totalCurriculum: '',
  };

  const lines = text.split('\n');
  let i = 0;
  let currentCourse = null;
  let overviewLines = [];
  let collectingOverview = false;
  let workSection = 'textbooks'; // 'textbooks' | 'papers'

  const pushCourse = () => {
    if (currentCourse) result.courses.push(currentCourse);
  };

  const newCourse = (number, name) => ({
    number, name,
    level: '', duration: '', prereqs: '', skills: [], milestone: '', description: '',
    textbooks: [], papers: [],
  });

  // Normalize em-dash variants to a consistent separator for splitting
  const normSep = s => s.replace(/ — /g, ' -- ').replace(/—/g, '--');

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = clean(raw);

    // TOPIC
    const topicMatch = trimmed.match(/^TOPIC:\s*(.+)$/i);
    if (topicMatch) {
      result.topic = topicMatch[1].trim();
      collectingOverview = false;
      i++; continue;
    }

    // LEVEL RANGE
    const levelRangeMatch = trimmed.match(/^LEVEL RANGE:\s*(.+)$/i);
    if (levelRangeMatch) {
      result.levelRange = levelRangeMatch[1].trim();
      collectingOverview = false;
      i++; continue;
    }

    // TRACKS
    const tracksMatch = trimmed.match(/^TRACKS?:\s*(.+)$/i);
    if (tracksMatch) {
      result.tracks = tracksMatch[1].split(',').map(t => t.trim()).filter(Boolean);
      collectingOverview = false;
      i++; continue;
    }

    // OVERVIEW
    if (trimmed.match(/^OVERVIEW:\s*/i)) {
      collectingOverview = true;
      const inline = trimmed.replace(/^OVERVIEW:\s*/i, '').trim();
      if (inline) overviewLines.push(inline);
      i++; continue;
    }

    // TOTAL CURRICULUM
    const totalMatch = trimmed.match(/^TOTAL CURRICULUM:\s*(.+)$/i);
    if (totalMatch) {
      result.totalCurriculum = totalMatch[1].trim();
      collectingOverview = false;
      if (overviewLines.length && !result.overview) result.overview = overviewLines.join(' ');
      i++; continue;
    }

    // COURSE N:
    const courseMatch = trimmed.match(/^COURSE\s+(\d+):\s*(.+)$/i);
    if (courseMatch) {
      collectingOverview = false;
      if (overviewLines.length && !result.overview) result.overview = overviewLines.join(' ');
      pushCourse();
      currentCourse = newCourse(parseInt(courseMatch[1]), courseMatch[2].trim());
      workSection = 'textbooks';
      i++; continue;
    }

    // --- separator
    if (trimmed === '---' || trimmed === '***') {
      collectingOverview = false;
      i++; continue;
    }

    // Collect overview lines (stop at any known keyword)
    if (collectingOverview && trimmed && !trimmed.match(/^(COURSE|LEVEL RANGE|TOTAL|TRACKS?|---)/i)) {
      overviewLines.push(trimmed);
      i++; continue;
    }

    if (currentCourse) {
      // LEVEL
      const levelMatch = trimmed.match(/^LEVEL:\s*(.+)$/i);
      if (levelMatch) { currentCourse.level = levelMatch[1].trim(); i++; continue; }

      // DURATION
      const durationMatch = trimmed.match(/^DURATION:\s*(.+)$/i);
      if (durationMatch) { currentCourse.duration = durationMatch[1].trim(); i++; continue; }

      // PREREQS
      const prereqsMatch = trimmed.match(/^PREREQS?:\s*(.+)$/i);
      if (prereqsMatch) { currentCourse.prereqs = prereqsMatch[1].trim(); i++; continue; }

      // SKILLS
      const skillsMatch = trimmed.match(/^SKILLS?:\s*(.+)$/i);
      if (skillsMatch) {
        currentCourse.skills = skillsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        i++; continue;
      }

      // MILESTONE
      const milestoneMatch = trimmed.match(/^MILESTONE:\s*(.+)$/i);
      if (milestoneMatch) { currentCourse.milestone = milestoneMatch[1].trim(); i++; continue; }

      // TEXTBOOKS: subsection marker
      if (trimmed.match(/^TEXTBOOKS?:/i)) { workSection = 'textbooks'; i++; continue; }

      // PAPERS: / SEMINAL PAPERS: subsection marker
      if (trimmed.match(/^(?:SEMINAL\s+)?PAPERS?:/i)) { workSection = 'papers'; i++; continue; }

      // Work item (- ...) or (* ...)
      if (trimmed.match(/^[-*]\s+/)) {
        const workLine = normSep(trimmed.replace(/^[-*]\s+/, '').trim());
        if (workSection === 'papers') {
          const dashIdx = workLine.indexOf(' -- ');
          const ref = dashIdx !== -1 ? workLine.slice(0, dashIdx).trim() : workLine;
          const rationale = dashIdx !== -1 ? workLine.slice(dashIdx + 4).trim() : '';
          currentCourse.papers.push({ ref, rationale });
        } else {
          const parts = workLine.split(' -- ');
          const ref = parts[0]?.trim() || workLine;
          const second = parts[1]?.trim() || '';
          const third = parts[2]?.trim() || '';
          const countMatch = second.match(/(\d[\d,]*)\s+(?:university\s+)?courses?/i)
            || workLine.match(/(\d[\d,]*)\s+(?:university\s+)?courses?/i);
          const syllabusCount = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : null;
          const role = third || (second && !countMatch ? second : '');
          currentCourse.textbooks.push({ ref, syllabusCount, role, focus: '' });
        }
        i++; continue;
      }

      // Focus line -> or → (textbooks only)
      if (trimmed.match(/^[-=]>|^→/) || raw.match(/^\s+[-=]>|^\s+→/)) {
        if (workSection === 'textbooks' && currentCourse.textbooks.length > 0) {
          const focus = trimmed
            .replace(/^[-=]>\s*|^→\s*/i, '')
            .replace(/^(?:Typically covers:|Focus:)\s*/i, '')
            .trim();
          currentCourse.textbooks[currentCourse.textbooks.length - 1].focus = focus;
        }
        i++; continue;
      }

      // Description — first substantive line in a course before TEXTBOOKS:
      if (trimmed && !currentCourse.description && workSection === 'textbooks'
          && !trimmed.match(/^(COURSE|LEVEL|DURATION|PREREQ|SKILL|MILESTONE|TEXTBOOK|PAPER|TOTAL|---)/i)) {
        currentCourse.description = trimmed;
      }
    }

    i++;
  }

  pushCourse();
  if (overviewLines.length && !result.overview) result.overview = overviewLines.join(' ');

  return result;
}
