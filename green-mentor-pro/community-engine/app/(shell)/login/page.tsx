import { Leaf } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — GreenMentor Community" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <Card className="p-8 text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-[14px] bg-teal-900 text-green-500">
          <Leaf size={26} weight="fill" />
        </div>
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">
          GreenMentor Community
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-gray-600">
          Sign in to use the community tools and save your headers.
        </p>
        <div className="mt-6">
          <LoginForm next={next ?? "/"} initialError={error} />
        </div>
      </Card>
    </div>
  );
}
