import { redirect } from "next/navigation";
import { LoginPage } from "@/components/portal/GestureBridgePortal";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const code = getFirstParam(params.code);

  if (code) {
    const callbackParams = new URLSearchParams({
      code,
      next: "/learn",
    });

    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  return <LoginPage />;
}
