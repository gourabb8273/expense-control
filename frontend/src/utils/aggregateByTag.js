export function aggregateByTag(items, untaggedLabel = 'Untagged') {
  const map = new Map();
  (items || []).forEach((item) => {
    if (!(item.name || '').trim()) return;
    const value = Number(item.value) || 0;
    if (value <= 0) return;
    const tag = (item.tag || '').trim() || untaggedLabel;
    map.set(tag, (map.get(tag) || 0) + value);
  });
  return Array.from(map.entries()).map(([tag, value]) => ({ tag, value }));
}
