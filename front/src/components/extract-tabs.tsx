import { ReactNode } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface ExtractTabsProps {
  activeTab: number;
  onTabChange: (value: number) => void;
  configContent: ReactNode;
  resultsContent: ReactNode;
}

export default function ExtractTabs({ activeTab, onTabChange, configContent, resultsContent }: ExtractTabsProps) {
  return (
    <Tabs 
      value={activeTab.toString()} 
      onValueChange={(v) => onTabChange(parseInt(v, 10))} 
      className="flex flex-col h-full w-full"
    >
      <div className="bg-muted/5 border-b border-border">
        <TabsList className="h-auto rounded-none bg-transparent p-0 px-4 w-full justify-start shrink-0">
          <TabsTrigger
            className="relative rounded-none py-3 px-6 after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-primary data-[state=active]:text-primary font-medium transition-colors"
            value="0"
          >
            Configuration
          </TabsTrigger>
          <TabsTrigger
            className="relative rounded-none py-3 px-6 after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-primary data-[state=active]:text-primary font-medium transition-colors"
            value="1"
          >
            Results
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="flex-1 min-h-0 relative">
        <TabsContent value="0" className="absolute inset-0 overflow-y-auto p-6 m-0 focus-visible:outline-none">
          {configContent}
        </TabsContent>
        <TabsContent value="1" className="absolute inset-0 overflow-y-auto p-6 m-0 focus-visible:outline-none scroll-smooth">
          {resultsContent}
        </TabsContent>
      </div>
    </Tabs>
  );
}
