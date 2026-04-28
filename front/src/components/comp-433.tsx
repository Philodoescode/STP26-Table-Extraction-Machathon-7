import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: number;
}

export interface TabsComponentProps {
  tabs: TabItem[];
  defaultTabId?: string;
}

export default function Component({ tabs, defaultTabId }: TabsComponentProps) {
  const initialTab = defaultTabId || (tabs.length > 0 ? tabs[0].id : "");
  const [activeTab, setActiveTab] = useState(initialTab);

  if (tabs.length === 0) return null;

  return (
    <div className="w-full flex flex-col h-full">
      <div className="w-full border-b border-border overflow-x-auto pb-1 mb-2 no-scrollbar">
        <div className="flex w-max space-x-2 px-4 pt-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative group inline-flex items-center px-4 py-2 font-medium text-sm transition-colors rounded-md ${
                  isActive 
                    ? "bg-white text-black" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <Badge
                    className={`ml-2 transition-opacity ${
                      isActive ? "bg-black/10 text-black border-transparent" : "bg-primary/20 text-primary opacity-60 group-hover:opacity-100"
                    }`}
                    variant="secondary"
                  >
                    {tab.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 w-full relative">
        {tabs.map((tab) => (
          <div 
            key={tab.id} 
            className={`w-full h-full transition-opacity duration-300 ${activeTab === tab.id ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 pointer-events-none hidden'}`}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}