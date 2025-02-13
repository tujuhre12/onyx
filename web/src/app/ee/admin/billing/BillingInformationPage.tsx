"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePopup } from "@/components/admin/connectors/Popup";
import {
  fetchCustomerPortal,
  statusToDisplay,
  useBillingInformation,
} from "./utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, ArrowFatUp } from "@phosphor-icons/react";
import { CircleAlert, CircleIcon, Info } from "lucide-react";

// -----------------------------
// MAIN PAGE COMPONENT
// -----------------------------
export default function BillingInformationPage() {
  const router = useRouter();
  const { popup, setPopup } = usePopup();

  const {
    data: billingInformation,
    error,
    isLoading,
  } = useBillingInformation();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("session_id")) {
      setPopup({
        message:
          "Congratulations! Your subscription has been updated successfully.",
        type: "success",
      });
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, [setPopup]);

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (error) {
    console.error("Failed to fetch billing information:", error);
    return (
      <div className="text-center py-8 text-red-500">
        Error loading billing information. Please try again later.
      </div>
    );
  }

  if (!billingInformation) {
    return (
      <div className="text-center py-8">No billing information available.</div>
    );
  }

  const handleManageSubscription = async () => {
    try {
      const response = await fetchCustomerPortal();
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to create customer portal session: ${
            errorData.message || response.statusText
          }`
        );
      }

      const { url } = await response.json();
      if (!url) {
        throw new Error("No portal URL returned from the server");
      }
      router.push(url);
    } catch (error) {
      console.error("Error creating customer portal session:", error);
      setPopup({
        message: "Error creating customer portal session",
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <CreditCard className="mr-4 text-muted-foreground" size={24} />
            Subscription Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SubscriptionSummary billingInformation={billingInformation} />
          <BillingAlerts billingInformation={billingInformation} />
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Manage Subscription
          </CardTitle>
          <CardDescription>
            View your plan, update payment, or change subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleManageSubscription} className="w-full">
            <ArrowFatUp className="mr-2" size={16} />
            Manage Subscription
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------
// SUBCOMPONENTS
// -----------------------------

/**
 * Shows a grid of subscription details (status, seats, start/end date).
 */
function SubscriptionSummary({
  billingInformation,
}: {
  billingInformation: any;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <InfoItem
        title="Subscription Status"
        value={statusToDisplay(billingInformation.status)}
      />
      <InfoItem title="Seats" value={billingInformation.seats.toString()} />
      <InfoItem
        title="Billing Start"
        value={new Date(
          billingInformation.current_period_start
        ).toLocaleDateString()}
      />
      <InfoItem
        title="Billing End"
        value={new Date(
          billingInformation.current_period_end
        ).toLocaleDateString()}
      />
    </div>
  );
}

/**
 * Combines all relevant subscription messages into a single alert banner.
 */
function BillingAlerts({ billingInformation }: { billingInformation: any }) {
  // Evaluate statuses
  const isTrialing = billingInformation.status === "trialing";
  const isCancelled = billingInformation.cancel_at_period_end;
  const isExpired =
    new Date(billingInformation.current_period_end) < new Date();
  const noPaymentMethod = !billingInformation.payment_method_enabled;

  // Collect messages
  const messages: string[] = [];

  if (isExpired) {
    messages.push(
      "Your subscription has expired. Please resubscribe to continue using the service."
    );
  }
  if (isCancelled && !isExpired) {
    messages.push(
      `Your subscription will cancel on ${new Date(
        billingInformation.current_period_end
      ).toLocaleDateString()}. You can resubscribe before this date to remain uninterrupted.`
    );
  }
  if (isTrialing) {
    messages.push(
      `You're currently on a trial. Your trial ends on ${
        billingInformation.trial_end
          ? new Date(billingInformation.trial_end).toLocaleDateString()
          : "N/A"
      }.`
    );
  }
  if (noPaymentMethod) {
    messages.push(
      "You currently have no payment method on file. Please add one to avoid service interruption."
    );
  }

  // Decide if we need a destructive variant
  const variant = isExpired || noPaymentMethod ? "destructive" : "default";

  // If no messages, don't render an alert
  if (messages.length === 0) return null;

  return (
    <Alert variant={variant}>
      <AlertTitle className="flex items-center space-x-2">
        {variant === "destructive" ? (
          <CircleAlert className="h-4 w-4" />
        ) : (
          <Info className="h-4 w-4" />
        )}
        <span>
          {variant === "destructive"
            ? "Important Subscription Notice"
            : "Subscription Notice"}
        </span>
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1 mt-2">
          {messages.map((msg, idx) => (
            <li key={idx}>{msg}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Small component for a label/value pair.
 */
function InfoItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-muted p-4 rounded-lg">
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-lg font-semibold text-foreground dark:text-white">
        {value}
      </p>
    </div>
  );
}
