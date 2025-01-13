import { ErrorCallout } from "@/components/ErrorCallout";
import Text from "@/components/ui/text";
import CardSection from "@/components/admin/CardSection";
import { HeaderWrapper } from "@/components/header/HeaderWrapper";
import { AssistantEditor } from "@/app/admin/assistants/AssistantEditor";
import { SuccessfulPersonaUpdateRedirectType } from "@/app/admin/assistants/enums";
import { fetchAssistantEditorInfoSS } from "@/lib/assistants/fetchPersonaEditorInfoSS";
import { DeletePersonaButton } from "@/app/admin/assistants/[id]/DeletePersonaButton";
import { LargeBackButton } from "../../LargeBackButton";
import Title from "@/components/ui/title";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [values, error] = await fetchAssistantEditorInfoSS(params.id);

  let body;
  if (!values) {
    body = (
      <div className="px-32">
        <ErrorCallout errorTitle="Something went wrong :(" errorMsg={error} />
      </div>
    );
  } else {
    body = (
      <div className="w-full py-16">
        <div className="px-32">
          <div className="mx-auto container">
            <AssistantEditor
              {...values}
              defaultPublic={false}
              redirectType={SuccessfulPersonaUpdateRedirectType.CHAT}
            />
          </div>
        </div>
      </div>
    );
  }

  return <div>{body}</div>;
}
