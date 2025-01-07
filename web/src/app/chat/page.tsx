import WrappedChat from "./WrappedChat";

export default async function Page(props: {
  searchParams: Promise<{ [key: string]: string }>;
}) {
  const searchParams = await props.searchParams;
  const firstMessage = searchParams.firstMessage;

  return (
    <div>
      <WrappedChat firstMessage={firstMessage} initiallyToggled={false} />;
    </div>
  );
}
