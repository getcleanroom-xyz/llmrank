import { useState, createContext, useContext, type ReactNode } from "react";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue>({ activeTab: "", setActiveTab: () => {} });

export function Tabs({ defaultTab, children, className = "" }: { defaultTab: string; children: ReactNode; className?: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bu-tabs ${className}`} role="tablist">{children}</div>;
}

export function Tab({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  return (
    <button
      role="tab"
      aria-selected={activeTab === id}
      className={`bu-tab ${activeTab === id ? "bu-tab-active" : ""} ${className}`}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

export function TabPanel({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== id) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
