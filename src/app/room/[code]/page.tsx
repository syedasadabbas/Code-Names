import RoomClient from "@/components/RoomClient";

// Rooms are live and per-request; never statically prerender this route.
export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}
