"use client";

import { CreditCard, ArrowFatUp } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { usePopup } from "@/components/admin/connectors/Popup";
import {
  fetchCustomerPortal,
  statusToDisplay,
  useBillingInformation,
} from "./utils";
import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircleIcon } from "lucide-react";

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
    return <div>Loading...</div>;
  }

  if (error) {
    console.error("Failed to fetch billing information:", error);
    return (
      <div>Error loading billing information. Please try again later.</div>
    );
  }

  if (!billingInformation) {
    return <div>No billing information available.</div>;
  }

  const isTrialing = billingInformation.status === "trialing";
  const isCancelled = billingInformation.cancel_at_period_end;
  const isExpired =
    new Date(billingInformation.current_period_end) < new Date();

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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <CreditCard className="mr-4 text-text-600" size={24} />
            Subscription Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoItem
              title="Subscription Status"
              value={statusToDisplay(billingInformation.status)}
            />
            <InfoItem
              title="Seats"
              value={billingInformation.seats.toString()}
            />
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

          {isCancelled && (
            <Alert>
              <AlertTitle>Subscription Cancelled</AlertTitle>
              <AlertDescription>
                Your subscription will end on{" "}
                {new Date(
                  billingInformation.current_period_end
                ).toLocaleDateString()}
                . You can resubscribe to continue using the service after this
                date.
              </AlertDescription>
            </Alert>
          )}

          {isTrialing && (
            <Alert>
              <CircleIcon className="h-4 w-4" />
              <AlertTitle>Trial Period</AlertTitle>
              <AlertDescription>
                Your trial ends on{" "}
                {billingInformation.trial_end
                  ? new Date(billingInformation.trial_end).toLocaleDateString()
                  : "N/A"}
                .
                {!billingInformation.payment_method_enabled &&
                  " Add a payment method to continue using the service after the trial."}
              </AlertDescription>
            </Alert>
          )}

          {!billingInformation.payment_method_enabled && (
            <Alert variant="destructive">
              <AlertTitle>Payment Method Required</AlertTitle>
              <AlertDescription>
                You need to add a payment method before your trial ends to
                continue using the service.
              </AlertDescription>
            </Alert>
          )}

          {isExpired && (
            <Alert variant="destructive">
              <AlertTitle>Subscription Expired</AlertTitle>
              <AlertDescription>
                Your subscription has expired. Please resubscribe to continue
                using the service.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">
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

interface InfoItemProps {
  title: string;
  value: string;
}

function InfoItem({ title, value }: InfoItemProps) {
  return (
    <div className="bg-background-50 p-4 rounded-lg">
      <p className="text-sm font-medium text-text-500">{title}</p>
      <p className="text-lg font-semibold text-text-900">{value}</p>
    </div>
  );
}
