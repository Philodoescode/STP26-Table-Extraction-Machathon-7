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
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => setShowInitialDialog(true), 500);
      return () => clearTimeout(timer);
    }
  }, [setIsTourCompleted]);

  const allSteps: TourStep[] = [
    {
      selectorId: "tour-upload-area",
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">Welcome to Table Extraction!</h3>
          <p className="text-sm text-muted-foreground">
            Let's get started by uploading a document. You can drag and drop any <strong>PDF or Image</strong> (JPG/PNG) here, and our AI will handle the rest.
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
            Select <strong>"Fast"</strong> for quick results on clear documents, or <strong>"Accurate"</strong> for complex tables that need extra precision. You can also toggle <strong>Confidence Levels</strong> to see how sure the AI is about each cell.
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
            Once your file is uploaded and settings are adjusted, click <strong>Run</strong>. We'll analyze your document, detect table structures, and extract the data in seconds.
          </p>
        </div>
      ),
      position: "bottom",
    },
    {
      selectorId: "tour-upload-area", // This targets the document viewer area in post-processing
      content: (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-lg">See the Magic</h3>
          <p className="text-sm text-muted-foreground">
            Look at your document! The <strong>bounding boxes</strong> show exactly where the AI found tables. Hover over a box to highlight the corresponding data, or double-click to zoom in for a closer look.
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
            Here is your extracted data. You can <strong>edit any cell</strong> directly if you spot a typo. Cells with low confidence will be highlighted in yellow or red—keep an eye on those!
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
            Your data is ready for the world. Click <strong>Export</strong> to download your tables as a <strong>CSV or Excel</strong> file.
          </p>
        </div>
      ),
      position: "bottom",
    }
  ];

  const handleStartTour = () => {
    setShowInitialDialog(false);
    setSteps(allSteps);
    // Small timeout to allow steps to be set
    setTimeout(() => {
      startTour();
    }, 100);
  };

  const handleSkipTour = () => {
    setShowInitialDialog(false);
    setIsTourCompleted(true);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  };

  // If tour completes, set the local storage flag
  useEffect(() => {
    if (isTourCompleted) {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    }
  }, [isTourCompleted]);

  return (
    <AlertDialog open={showInitialDialog} onOpenChange={setShowInitialDialog}>
      <AlertDialogContent className="max-w-md p-6 light bg-background text-foreground border-border">
        <AlertDialogHeader className="flex flex-col items-center justify-center">
          <div className="relative mb-4">
            <motion.div
              initial={{ scale: 0.7, filter: "blur(10px)" }}
              animate={{
                scale: 1,
                filter: "blur(0px)",
                y: [0, -8, 0],
                rotate: [10, -5, 10],
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
                y: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
                rotate: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
              className="flex items-center justify-center"
            >
              <div className="text-6xl font-black tracking-tighter flex gap-1 items-center">
                <span className="text-primary">T</span>
                <span className="text-chart-1">S</span>
              </div>
            </motion.div>
          </div>
          <AlertDialogTitle className="text-center text-xl font-medium">
            Welcome to Table Extraction!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground mt-2 text-center text-sm">
            Take a quick tour to learn how to extract tabular data from your documents in seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-6 space-y-3">
          <Button onClick={handleStartTour} className="w-full">
            Start Tour
          </Button>
          <Button onClick={handleSkipTour} variant="ghost" className="w-full text-foreground/80 hover:text-foreground">
            Skip Tour
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
