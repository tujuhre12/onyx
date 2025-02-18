import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { User } from "@/lib/types";
import { PopupSpec } from "@/components/admin/connectors/Popup";
import { RefreshCcw } from "lucide-react";

interface ResetPasswordModalProps {
  user: User;
  onClose: () => void;
  setPopup: (spec: PopupSpec) => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  setPopup,
}) => {
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/password/reset_password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_email: user.email }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewPassword(data.new_password);
        setPopup({ message: "Password reset successfully", type: "success" });
      } else {
        const errorData = await response.json();
        setPopup({
          message: errorData.detail || "Failed to reset password",
          type: "error",
        });
      }
    } catch (error) {
      setPopup({
        message: "An error occurred while resetting the password",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal onOutsideClick={onClose} width="rounded-lg w-full max-w-md">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
        <p className="mb-4">
          Are you sure you want to reset the password for {user.email}?
        </p>
        {newPassword ? (
          <div className="mb-4">
            <p className="font-semibold">New Password:</p>
            <p className="bg-gray-100 p-2 rounded">{newPassword}</p>
            <p className="text-sm text-gray-500 mt-2">
              Please securely communicate this password to the user.
            </p>
          </div>
        ) : (
          <Button
            onClick={handleResetPassword}
            disabled={isLoading}
            className="w-full mb-4"
          >
            {isLoading ? (
              "Resetting..."
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Reset Password
              </>
            )}
          </Button>
        )}
        <Button variant="outline" onClick={onClose} className="w-full">
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default ResetPasswordModal;
