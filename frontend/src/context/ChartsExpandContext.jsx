import { createContext, useContext, useMemo } from 'react';

const ChartsExpandContext = createContext({
  expandAll: false,
  setExpandAll: () => {},
  expandAllGeneration: 0,
  lineChartFullWidth: false,
  setLineChartFullWidth: () => {},
});

export function ChartsExpandProvider({
  expandAll,
  setExpandAll,
  expandAllGeneration,
  lineChartFullWidth,
  setLineChartFullWidth,
  children,
}) {
  const value = useMemo(
    () => ({
      expandAll,
      setExpandAll,
      expandAllGeneration,
      lineChartFullWidth,
      setLineChartFullWidth,
    }),
    [expandAll, setExpandAll, expandAllGeneration, lineChartFullWidth, setLineChartFullWidth]
  );
  return (
    <ChartsExpandContext.Provider value={value}>
      {children}
    </ChartsExpandContext.Provider>
  );
}

export function useChartsExpand() {
  return useContext(ChartsExpandContext);
}

export function waitForChartRender(ms = 350) {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, ms));
    });
  });
}
