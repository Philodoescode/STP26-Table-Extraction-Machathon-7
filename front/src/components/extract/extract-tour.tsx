import { useEffect, useState } from "react";
import { useTour } from "@/components/tour";
import type { TourStep } from "@/components/tour";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "motion/react";

export default function ExtractTour() {
  const { startTour, setSteps, isTourCompleted, setIsTourCompleted } = useTour();
  const [showInitialDialog, setShowInitialDialog] = useState(false);

  const TOUR_STORAGE_KEY = "table_extraction_has_completed_tour";

  useEffect(() => {
    const hasCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (hasCompleted === "true") {
      setIsTourCompleted(true);
    } else {
      const timer = setTimeout(() => setShowInitialDialog(true), 500);
      return () => clearTimeout(timer);
    }
  }, [setIsTourCompleted]);

  const allSteps: TourStep[] = [
    {
      selectorId: "tour-upload-area",
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">Welcome to Tablesmith!</h3>
          <p className="text-sm text-muted-foreground">
            Let's get started by uploading a document. You can drag and drop any{" "}
            <strong>PDF or Image</strong> (JPG/PNG) here, and our AI will handle the rest.
          </p>
        </div>
      ),
      position: "right",
    },
    {
      selectorId: "tour-config-tab",
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">Choose Your Engine</h3>
          <p className="text-sm text-muted-foreground">
            Select <strong>"Fast"</strong> for quick results on clear documents, or{" "}
            <strong>"Accurate"</strong> for complex tables that need extra precision. You can
            also toggle <strong>Confidence Levels</strong> to see how sure the AI is about
            each cell.
          </p>
        </div>
      ),
      position: "left",
    },
    {
      selectorId: "tour-run-button",
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">Ready to Process?</h3>
          <p className="text-sm text-muted-foreground">
            Once your file is uploaded and settings are adjusted, click <strong>Run</strong>.
            We'll analyze your document, detect table structures, and extract the data in
            seconds.
          </p>
        </div>
      ),
      position: "bottom",
    },
    {
      selectorId: "tour-upload-area",
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">See the Magic</h3>
          <p className="text-sm text-muted-foreground">
            Look at your document! The <strong>bounding boxes</strong> show exactly where the
            AI found tables. Hover over a box to highlight the corresponding data, or
            double-click to zoom in for a closer look.
          </p>
        </div>
      ),
      position: "right",
    },
    {
      selectorId: "tour-results-tab",
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">Perfect Your Data </h3>
          <p className="text-sm text-muted-foreground">
            Here is your extracted data. You can <strong>edit any cell</strong> directly if
            you spot a typo. Cells with low confidence will be highlighted in yellow or red—
            keep an eye on those!
          </p>
        </div>
      ),
      position: "left",
    },
    {
      selectorId: "tour-export-button",
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">You're Done!</h3>
          <p className="text-sm text-muted-foreground">
            Your data is ready for the world. Click <strong>Export</strong> to download your
            tables as a <strong>CSV or Excel</strong> file.
          </p>
        </div>
      ),
      position: "bottom",
    },
  ];

  const handleStartTour = () => {
    setShowInitialDialog(false);
    setSteps(allSteps);
    setTimeout(() => {
      startTour();
    }, 100);
  };

  const handleSkipTour = () => {
    setShowInitialDialog(false);
    setIsTourCompleted(true);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  };

  useEffect(() => {
    if (isTourCompleted) {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    }
  }, [isTourCompleted]);

  return (
    <AlertDialog open={showInitialDialog} onOpenChange={setShowInitialDialog}>
      <AlertDialogContent className="max-w-md p-6 border-border">
        <AlertDialogHeader className="flex w-full flex-col items-center justify-center text-center">
          <div className="relative mb-12 flex w-full justify-center">
            <motion.div
              initial={{ scale: 0.7, filter: "blur(10px)" }}
              animate={{
                scale: 1,
                filter: "blur(0px)",
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
              }}
              className="flex cursor-pointer items-center justify-center transition-all duration-200 ease-in-out"
              style={{
                textShadow: `10px 10px 0px color-mix(in oklch, var(--primary) 80%, transparent), 
                             15px 15px 0px color-mix(in oklch, var(--primary) 60%, transparent), 
                             20px 20px 0px color-mix(in oklch, var(--primary) 40%, transparent), 
                             25px 25px 0px color-mix(in oklch, var(--primary) 20%, transparent), 
                             45px 45px 10px color-mix(in oklch, var(--primary) 10%, transparent)`,
              }}
              whileHover={{ textShadow: "none" }}
            >
              <div className="flex items-center justify-center gap-0.5 text-center text-6xl font-black italic leading-none tracking-tighter">
                <span className="text-primary">T</span>
                <span className="text-chart-2">S</span>
              </div>
            </motion.div>
          </div>

          <AlertDialogTitle className="w-full text-center text-xl font-medium">
            Welcome to Tablesmith!
          </AlertDialogTitle>

          <AlertDialogDescription className="mt-2 text-center text-sm text-muted-foreground">
            Take a quick tour to learn how to extract tabular data from your documents in
            seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-6 space-y-3">
          <Button onClick={handleStartTour} className="w-full">
            Start Tour
          </Button>

          <Button
            onClick={handleSkipTour}
            variant="ghost"
            className="w-full transition-colors hover:bg-primary/10 hover:text-primary"
          >
            Skip Tour
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}