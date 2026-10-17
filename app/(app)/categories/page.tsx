import { Suspense } from "react";
import type { Metadata } from "next";
import { getUser } from "@/lib/session";
import { listCategories } from "@/lib/data";
import { CategoryManager } from "@/components/category-manager";
import { PageHeader, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Categories"
        description="Built-in categories are shared by everyone. Add your own, or add subcategories to any category."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Categories />
      </Suspense>
    </>
  );
}

async function Categories() {
  const user = await getUser();
  return <CategoryManager categories={await listCategories(user.id)} />;
}
