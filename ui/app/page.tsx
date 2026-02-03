import { Suspense } from "react";
import { TodosClient } from "@/components/todos/todos-client";
import { getFS } from "@/lib/context";
import { getTodos } from "@/lib/data/todos";

export default async function TodosPage() {
  const fs = await getFS();
  const todos = await getTodos(fs);

  return (
    <Suspense>
      <TodosClient initialTodos={todos} />
    </Suspense>
  );
}
