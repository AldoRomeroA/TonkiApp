import { PostFeed } from "./PostFeed";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-[600px] px-4 pb-8 pt-6 sm:px-6">
      <h1 className="sr-only">Publicaciones</h1>
      <PostFeed />
    </main>
  );
}
