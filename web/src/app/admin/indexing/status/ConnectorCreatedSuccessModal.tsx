"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckmarkIcon } from "@/components/icons/icons";

export function ConnectorCreatedSuccessModal() {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  // Close the modal and update the URL to remove the query param
  const handleClose = () => {
    setOpen(false);
    router.replace("/admin/indexing/status");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 transition-all duration-200 animate-in fade-in">
            <CheckmarkIcon
              size={32}
              className="text-green-600 dark:text-green-400"
            />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-2xl font-bold">
              Congratulations!
            </DialogTitle>
            <DialogDescription className="text-lg">
              You've successfully created your first connector.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="bg-neutral-100 dark:bg-neutral-900 p-5 rounded-lg my-4 border border-neutral-200 dark:border-neutral-700 shadow-sm dark:shadow-md dark:shadow-black/10">
          <h3 className="font-semibold text-lg mb-2 flex items-center">
            <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 mr-2 animate-pulse"></div>
            Syncing in progress
          </h3>
          <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
            It will take some time to sync your documents. You'll know it's
            complete when the "Last Indexed" field is filled in on the
            Connectors page.
          </p>
        </div>

        <DialogFooter className="flex justify-center sm:justify-center pt-2">
          <Button
            onClick={handleClose}
            variant="default"
            size="lg"
            className="font-medium transition-all duration-200 hover:shadow-md dark:hover:bg-primary/90 dark:hover:shadow-lg dark:hover:shadow-primary/20"
          >
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
