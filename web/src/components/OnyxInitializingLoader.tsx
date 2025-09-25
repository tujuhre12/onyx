import { useContext } from "react";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { OnyxIcon } from "@/components/icons/icons";
import Text from "@/components-2/Text";

export function OnyxInitializingLoader() {
  const settings = useContext(SettingsContext);

  return (
    <div className="h-full w-full animate-pulse flex flex-col justify-center items-center gap-padding-button">
      <OnyxIcon size={100} className="" />
      <Text headingH3>
        Initializing {settings?.enterpriseSettings?.application_name ?? "Onyx"}
      </Text>
    </div>
  );
}
