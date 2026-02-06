import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { TodosClient } from "@/components/todos/todos-client";
import { getFS } from "@/lib/context";
import { getTodos } from "@/lib/data/todos";

export default async function TodosPage() {
  const fs = await getFS();
  const todos = await getTodos(fs);

  return (
    <Suspense fallback={<Loading />}>
      <TodosClient initialTodos={todos} />
    </Suspense>
  );
}
