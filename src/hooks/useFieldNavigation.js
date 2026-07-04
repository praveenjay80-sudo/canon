import { useState, useCallback, useEffect } from 'react';
import { fetchOpenAlexTaxonomy } from '../utils/openAlexTaxonomy';
import { ACADEMIC_TAXONOMY } from '../constants/academicTaxonomy';

function buildFallback() {
  const fieldNames = Object.keys(ACADEMIC_TAXONOMY);
  const fieldUrls = {};
  const fieldSubfields = {};
  const subfieldUrls = {};
  const subfieldTopics = {};
  for (const field of fieldNames) {
    fieldSubfields[field] = Object.keys(ACADEMIC_TAXONOMY[field]);
    for (const sf of fieldSubfields[field]) {
      subfieldTopics[sf] = (ACADEMIC_TAXONOMY[field][sf] || []).map(t => ({ name: t, url: null }));
    }
  }
  return { fieldNames, fieldUrls, fieldSubfields, subfieldUrls, subfieldTopics };
}

export function useFieldNavigation() {
  const [expandedFields, setExpandedFields] = useState(new Set());
  const [expandedSubfields, setExpandedSubfields] = useState(new Set());
  const [taxonomy, setTaxonomy] = useState(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);

  useEffect(() => {
    fetchOpenAlexTaxonomy()
      .then(setTaxonomy)
      .catch(() => setTaxonomy(buildFallback()))
      .finally(() => setTaxonomyLoading(false));
  }, []);

  const data = taxonomy || buildFallback();

  const clickTopLevel = useCallback((field) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  }, []);

  const clickSubfield = useCallback((parent, subfield) => {
    const key = `${parent}::${subfield}`;
    setExpandedSubfields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const isFieldExpanded = useCallback((field) => expandedFields.has(field), [expandedFields]);
  const isSubfieldExpanded = useCallback((key) => expandedSubfields.has(key), [expandedSubfields]);

  const getSubfields = useCallback((field) => data.fieldSubfields[field] || [], [data]);
  const getSubSubfields = useCallback((_field, sf) => (data.subfieldTopics[sf] || []).map(t => t.name), [data]);

  const getFieldUrl = useCallback((field) => data.fieldUrls[field] || null, [data]);
  const getSubfieldUrl = useCallback((sf) => data.subfieldUrls[sf] || null, [data]);
  const getTopicUrl = useCallback((sf, topic) => {
    const t = (data.subfieldTopics[sf] || []).find(x => x.name === topic);
    return t?.url || null;
  }, [data]);

  const clear = useCallback(() => {
    setExpandedFields(new Set());
    setExpandedSubfields(new Set());
  }, []);

  const topicCount = Object.values(data.subfieldTopics).reduce((sum, arr) => sum + arr.length, 0);

  return {
    clickTopLevel, clickSubfield,
    isFieldExpanded, isSubfieldExpanded,
    getSubfields, getSubSubfields,
    getFieldUrl, getSubfieldUrl, getTopicUrl,
    fieldNames: data.fieldNames,
    taxonomyLoading,
    topicCount,
    clear,
  };
}
