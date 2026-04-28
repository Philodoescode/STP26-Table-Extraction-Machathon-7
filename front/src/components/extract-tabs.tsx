import React from "react";
import { BoxIcon, HouseIcon, PanelsTopLeftIcon } from "lucide-react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  const initialTab = defaultTabId || (tabs.length > 0 ? tabs[0].id : "tab-1");

  if (tabs.length === 0) return null;

  return (
    <Tabs defaultValue={initialTab} className="w-full h-full flex flex-col">
      <ScrollArea>
        <TabsList className="relative mb-3 h-auto w-full justify-start gap-0.5 bg-transparent p-0 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border">
          {tabs.map((tab, index) => (
            <TabsTrigger
              key={tab.id}
              className="overflow-hidden rounded-b-none border-x border-t bg-muted py-2 data-[state=active]:z-10 data-[state=active]:shadow-none"
              value={tab.id}
            >
              {index === 0 && <HouseIcon aria-hidden="true" className="-ms-0.5 me-1.5 opacity-60" size={16} />}
              {index === 1 && <PanelsTopLeftIcon aria-hidden="true" className="-ms-0.5 me-1.5 opacity-60" size={16} />}
              {index === 2 && <BoxIcon aria-hidden="true" className="-ms-0.5 me-1.5 opacity-60" size={16} />}
              {tab.label}
              {tab.badge !== undefined && (
                <Badge
                  className="ml-2 bg-primary/20 text-primary hover:bg-primary/20 border-transparent"
                  variant="secondary"
                >
                  {tab.badge}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex-1 w-full relative">
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0 h-full w-full">
            {tab.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
