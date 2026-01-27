import TodosClient from "@/components/TodosClient";
import { getFS } from "@/lib/context";
import { getTodos } from "@/lib/data/todos";

export default async function TodosPage() {
  const fs = await getFS();
  const todos = await getTodos(fs);

  return <TodosClient initialTodos={todos} />;
}
