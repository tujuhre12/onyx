"use client";

import { ArrayHelpers, ErrorMessage, Field, useFormikContext } from "formik";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";

import { useEffect } from "react";
import { FiInfo, FiTrash2, FiPlus, FiRefreshCcw } from "react-icons/fi";
import { StarterMessage } from "./interfaces";
import { Label, TextFormField } from "@/components/admin/connectors/Field";
import { Button } from "@/components/ui/button";
import { SwapIcon } from "@/components/icons/icons";

export default function StarterMessagesList({
  values,
  arrayHelpers,
  isRefreshing,
  touchStarterMessages,
  debouncedRefreshPrompts,
  autoStarterMessageEnabled,
  errors,
  setFieldValue,
}: {
  values: StarterMessage[];
  arrayHelpers: ArrayHelpers;
  isRefreshing: boolean;
  touchStarterMessages: () => void;
  debouncedRefreshPrompts: (
    values: StarterMessage[],
    setFieldValue: any
  ) => void;
  autoStarterMessageEnabled: boolean;
  errors: any;
  setFieldValue: any;
}) {
  const { handleChange } = useFormikContext();

  // Group starter messages into rows of 2 for display purposes
  const rows = values.reduce((acc: StarterMessage[][], curr, i) => {
    if (i % 2 === 0) acc.push([curr]);
    else acc[acc.length - 1].push(curr);
    return acc;
  }, []);

  const canAddMore = values.length <= 6;

  return (
    <div className="mt-4 flex flex-col gap-6">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-start gap-4">
          <div className="grid grid-cols-2 gap-6 w-full  max-w-4xl">
            {row.map((starterMessage, colIndex) => (
              <div
                key={rowIndex * 2 + colIndex}
                className="bg-white/90 w-full border border-border rounded-lg shadow-md transition-shadow duration-200 p-4"
              >
                <div className="space-y-5">
                  {isRefreshing ? (
                    <div className="w-full">
                      <div className="w-full">
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                      </div>

                      <div>
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                      </div>

                      <div>
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-24 w-full bg-gray-200 rounded animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <TextFormField
                        label="Name"
                        name={`starter_messages.${
                          rowIndex * 2 + colIndex
                        }.name`}
                        placeholder="Enter a name..."
                        onChange={(e: any) => {
                          touchStarterMessages();
                          handleChange(e);
                        }}
                      />
                      <TextFormField
                        label="Message"
                        name={`starter_messages.${
                          rowIndex * 2 + colIndex
                        }.message`}
                        placeholder="Enter the message..."
                        onChange={(e: any) => {
                          touchStarterMessages();
                          handleChange(e);
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              arrayHelpers.remove(rowIndex * 2 + 1);
              arrayHelpers.remove(rowIndex * 2);
            }}
            className="p-1.5 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors mt-2"
            aria-label="Delete row"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      ))}

      <div className="relative gap-x-2 flex w-fit">
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                onClick={() => debouncedRefreshPrompts(values, setFieldValue)}
                disabled={
                  !autoStarterMessageEnabled ||
                  isRefreshing ||
                  (Object.keys(errors).length > 0 &&
                    Object.keys(errors).some(
                      (key) => !key.startsWith("starter_messages")
                    ))
                }
                className={`
                            ${
                              isRefreshing || !autoStarterMessageEnabled
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
                            }
                          `}
              >
                <div className="flex items-center gap-x-2">
                  {isRefreshing ? (
                    <FiRefreshCcw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <SwapIcon className="w-4 h-4 text-white" />
                  )}
                  Generate
                </div>
              </Button>
            </TooltipTrigger>
            {!autoStarterMessageEnabled && (
              <TooltipContent side="top" align="center">
                <p className="bg-background-900 max-w-[200px] text-sm p-1.5 text-white">
                  No LLM providers configured. Generation is not available.
                </p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        {canAddMore && (
          <Button
            type="button"
            className="w-fit"
            onClick={() => {
              arrayHelpers.push({
                name: "",
                message: "",
              });
              arrayHelpers.push({
                name: "",
                message: "",
              });
            }}
          >
            <FiPlus size={16} />
            <span>Add Row</span>
          </Button>
        )}
      </div>
    </div>
  );
}
