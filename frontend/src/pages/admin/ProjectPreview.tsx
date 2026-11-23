import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { previewProject } from "@/services/admin";
import { ProjectView } from "@/pages/public/ProjectDetail";

export default function ProjectPreview() {
  const { id = "" } = useParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "preview", id], queryFn: () => previewProject(id) });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        <span>Preview: this is how visitors will see the page once published.</span>
        <span className="flex gap-3"><Link className="underline" to={`/admin/projects/${id}`}>Edit</Link><Link className="underline" to="/admin/projects">Back to list</Link></span>
      </div>
      {isLoading ? <p role="status">Loading…</p> : isError || !data ? <p role="alert">Preview unavailable.</p> : <div className="overflow-hidden rounded-2xl bg-surface"><ProjectView p={data} /></div>}
    </div>
  );
}
