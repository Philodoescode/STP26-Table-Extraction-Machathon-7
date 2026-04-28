"use client";

import { useState, useMemo } from "react";
import { useFileUpload } from "@/hooks/use-file-upload";
import UploadComponent from "@/components/comp-544";
import TabsComponent from "@/components/comp-433";
import StatusBadge from "@/components/comp-420";

export default function ExtractPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [progress, setProgress] = useState(0);

  const [state, actions] = useFileUpload({
    accept: "image/*,application/pdf",
    maxSize: 5 * 1024 * 1024,
  });

  const handleProcess = () => {
    if (state.files.length === 0) return;
    
    setIsProcessing(true);
    setHasProcessed(false);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          setHasProcessed(true);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const tabsData = useMemo(() => [
    {
      id: "preview",
      label: "Cropped Tables",
      badge: hasProcessed ? 2 : undefined,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {hasProcessed ? (
            <>
              <div className="border rounded-lg overflow-hidden bg-muted/10 group relative border-border">
                <img src="/api/placeholder/400/200" alt="Table 1 Preview" className="w-full h-auto opacity-75 mix-blend-screen" />
                <div className="absolute inset-0 bg-[#120F17]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <button className="bg-white text-black px-5 py-2.5 rounded-full font-medium tracking-wide text-xs uppercase hover:bg-white/90 transition-colors">
                    [ Download ]
                  </button>
                </div>
                <div className="p-3 text-xs text-muted-foreground border-t border-border tracking-wider font-mono">TABLE_1.PNG</div>
              </div>
              <div className="border rounded-lg overflow-hidden bg-muted/10 group relative border-border">
                <img src="/api/placeholder/400/200" alt="Table 2 Preview" className="w-full h-auto opacity-75 mix-blend-screen" />
                <div className="absolute inset-0 bg-[#120F17]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <button className="bg-white text-black px-5 py-2.5 rounded-full font-medium tracking-wide text-xs uppercase hover:bg-white/90 transition-colors">
                    [ Download ]
                  </button>
                </div>
                <div className="p-3 text-xs text-muted-foreground border-t border-border tracking-wider font-mono">TABLE_2.PNG</div>
              </div>
            </>
          ) : (
            <div className="col-span-full py-16 text-center text-muted-foreground font-light text-lg">
              Process a file to review your isolated and extracted structures.
            </div>
          )}
        </div>
      )
    },
    {
      id: "csv",
      label: "Output Content",
      content: (
        <div className="p-6">
          {hasProcessed ? (
            <div className="border rounded-lg overflow-hidden border-border bg-[#09080A]">
              <div className="bg-muted/50 p-4 border-b border-border flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">results.csv</span>
                <button className="bg-transparent border border-white/20 text-white px-3 py-1 rounded text-xs hover:bg-white/10 transition-colors font-medium">
                  Export CSV
                </button>
              </div>
              <div className="p-6 font-mono text-xs overflow-x-auto whitespace-pre text-gray-300 leading-loose">
                {`ID,Name,Amount,Status\n1,John Doe,1200.00,Paid\n2,Jane Smith,850.50,Pending\n3,Bob Johnson,2100.00,Paid\n4,Alice Williams,450.00,Overdue`}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground font-light text-lg">
              Raw structural data output will populate here automatically.
            </div>
          )}
        </div>
      )
    },
    {
      id: "health",
      label: "Telemetry",
      content: (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="border border-border rounded-lg p-6 bg-muted/5">
            <div className="text-sm font-light text-muted-foreground mb-2">Completion Time</div>
            <div className="text-3xl font-medium">{hasProcessed ? "1.2s" : "-"}</div>
          </div>
          <div className="border border-border rounded-lg p-6 bg-muted/5">
            <div className="text-sm font-light text-muted-foreground mb-2">Model Certainty</div>
            <div className="text-3xl font-medium">{hasProcessed ? "98.6%" : "-"}</div>
          </div>
          <div className="border border-border rounded-lg p-6 bg-muted/5">
            <div className="text-sm font-light text-muted-foreground mb-2 flex items-center justify-between">
              Engine Status
            </div>
            <div className="flex items-center mt-3">
              <StatusBadge 
                label={hasProcessed ? "Completed" : (isProcessing ? "Processing" : "Awaiting Job")} 
                statusColor={hasProcessed ? "bg-primary" : (isProcessing ? "bg-amber-500" : "bg-gray-400")} 
              />
            </div>
          </div>
        </div>
      )
    }
  ], [hasProcessed, isProcessing]);

  return (
    <div className="h-full w-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none] relative z-10 bg-transparent">
      <div className="min-h-max pt-32 pb-12 px-6 sm:px-12 lg:px-20 w-full">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge label="Systems Fully Online" statusColor="bg-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4 text-white">Console</h1>
            <p className="text-lg text-gray-400 font-light max-w-2xl">
              Securely upload a file to convert raw grids into verified data formats.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Upload Section */}
            <div className="lg:col-span-5 space-y-6">
              <div className="border border-border rounded-xl p-8 bg-[#181520]">
                <h2 className="text-xl font-medium mb-6 text-white tracking-wide">
                  Document Origin
                </h2>
                
                <UploadComponent state={state} actions={actions} />
                
                <button 
                  className="w-full mt-8 bg-white text-black font-medium py-3.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors duration-200 uppercase tracking-widest text-sm"
                  disabled={state.files.length === 0 || isProcessing}
                  onClick={handleProcess}
                >
                  {isProcessing ? `Analyzing [ ${progress}% ]` : "Commit Data"}
                </button>
              </div>

              {hasProcessed && (
                <div className="border border-border rounded-xl p-8 bg-[#181520]">
                  <h3 className="text-lg font-medium mb-5 tracking-wide text-white">Summary</h3>
                  <div className="space-y-4 font-mono text-sm tracking-wide text-gray-400">
                    <div className="flex justify-between">
                      <span className="opacity-70">Filename:</span>
                      <span className="truncate ml-4 max-w-[200px] text-white">{(state.files[0].file as any).name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Regions Found:</span>
                      <span className="text-white">2</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Engine Grade:</span>
                      <span className="text-primary font-medium">A+</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Results Section */}
            <div className="lg:col-span-7">
              <div className="border border-border rounded-xl p-2 bg-[#181520] min-h-[500px]">
                <TabsComponent tabs={tabsData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}