
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  Area,
  Btn,
  Card,
  Check,
  csv,
  ErrorNote,
  Field,
  inputCls,
  PageTitle,
  Text,
} from "@/components/admin/Form";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { get, getProject, post, put } from "@/services/admin";
import type { AdminProject, MediaItem } from "@/types/admin";

const url = z
  .string()
  .refine(
    (v) => v === "" || /^https?:\/\/\S+$/i.test(v),
    "Must start with http:// or https://"
  );

const schema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  github_url: url,
  live_url: url,
  docs_url: url,
});

const blank = {
  title: "",
  short_description: "",
  description: "",
  problem: "",
  solution: "",
  architecture: "",
  how_it_works: "",
  challenges: "",
  results: "",
  technologies: [] as string[],
  category_id: null as string | null,
  service_id: null as string | null,
  main_image_id: null as string | null,
  github_url: "",
  live_url: "",
  docs_url: "",
  completed_on: null as string | null,
  status: "in_progress",
  is_featured: false,
  skill_ids: [] as string[],
  media: [] as {
    media_id: string;
    caption: string;
    kind?: string;
    url?: string;
    thumbnail_url?: string | null;
  }[],
};

type F = typeof blank;

const TEXTS: [keyof F, string][] = [
  ["description", "Detailed description"],
  ["problem", "Problem being solved / why it was developed"],
  ["solution", "Proposed solution"],
  ["architecture", "Architecture and technologies"],
  ["how_it_works", "How the system works"],
  ["challenges", "Challenges encountered"],
  ["results", "Results and achievements (only verified facts)"],
];

export default function ProjectEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();

  const [f, setF] = useState<F>(blank);
  const [technologiesInput, setTechnologiesInput] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<"main" | "gallery" | null>(null);

  const existing = useQuery({
    queryKey: ["admin", "project", id],
    queryFn: () => getProject(id!),
    enabled: !isNew,
  });

  const cats = useQuery({
    queryKey: ["admin", "project-categories"],
    queryFn: () => get<{ id: string; name: string }[]>("/project-categories"),
  });

  const svcs = useQuery({
    queryKey: ["admin", "services"],
    queryFn: () => get<{ id: string; title: string }[]>("/services"),
  });

  const skills = useQuery({
    queryKey: ["admin", "skills"],
    queryFn: () => get<{ id: string; name: string }[]>("/skills"),
  });

  // Load existing project data when editing.
  useEffect(() => {
    if (existing.data) {
      const project = {
        ...blank,
        ...(existing.data as AdminProject),
      };

      setF(project);
      setTechnologiesInput(project.technologies.join(", "));
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        technologies: csv(technologiesInput),
        media: f.media.map((m) => ({
          media_id: m.media_id,
          caption: m.caption,
        })),
        completed_on: f.completed_on || null,
      };

      return isNew
        ? post<AdminProject>("/projects", body)
        : put<AdminProject>(`/projects/${id}`, body);
    },

    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["projects"] });

      if (isNew) {
        nav(`/admin/projects/${p.id}`, { replace: true });
      }
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const r = schema.safeParse(f);

    if (!r.success) {
      setErrs(
        Object.fromEntries(
          r.error.issues.map((i) => [i.path[0], i.message])
        )
      );
      return;
    }

    setErrs({});
    save.mutate();
  };

  const set = <K extends keyof F>(k: K) => (v: F[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const sel =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

  const onPick = (m: MediaItem) => {
    if (picker === "main") {
      setF((prev) => ({ ...prev, main_image_id: m.id }));
    } else if (picker === "gallery") {
      setF((prev) => {
        if (prev.media.some((x) => x.media_id === m.id)) {
          return prev;
        }

        return {
          ...prev,
          media: [
            ...prev.media,
            {
              media_id: m.id,
              caption: "",
              kind: m.kind,
              url: m.url,
              thumbnail_url: m.thumbnail_url,
            },
          ],
        };
      });
    }

    setPicker(null);
  };

  const moveMedia = (i: number, d: number) => {
    setF((prev) => {
      const a = [...prev.media];
      [a[i], a[i + d]] = [a[i + d], a[i]];
      return { ...prev, media: a };
    });
  };

  if (!isNew && existing.isLoading) {
    return <p role="status">Loading…</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-4xl space-y-6">
      <PageTitle
        action={
          <div className="flex gap-2">
            <Link
              to="/admin/projects"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Back
            </Link>

            {!isNew && (
              <Link
                to={`/admin/projects/${id}/preview`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Preview
              </Link>
            )}

            <Btn type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save draft"}
            </Btn>
          </div>
        }
      >
        {isNew ? "New project" : "Edit project"}
      </PageTitle>

      <ErrorNote error={save.error} />

      {save.isSuccess && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          Saved. Use Publish on the project list when it is ready.
        </p>
      )}

      <Card className="space-y-4">
        <Text
          label="Title *"
          value={f.title}
          onChange={set("title")}
          error={errs.title}
        />

        <Text
          label="Short description"
          value={f.short_description}
          onChange={set("short_description")}
          hint="Required to publish."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category">
            <select
              className={sel}
              value={f.category_id ?? ""}
              onChange={(e) =>
                set("category_id")(e.target.value || null)
              }
            >
              <option value="">None</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Related service">
            <select
              className={sel}
              value={f.service_id ?? ""}
              onChange={(e) =>
                set("service_id")(e.target.value || null)
              }
            >
              <option value="">None</option>
              {svcs.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Project status">
            <select
              className={sel}
              value={f.status}
              onChange={(e) => set("status")(e.target.value)}
            >
              {["completed", "in_progress", "prototype", "research"].map(
                (s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                )
              )}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Completion date (leave empty if not finished)">
            <input
              type="date"
              className={inputCls}
              value={f.completed_on ?? ""}
              onChange={(e) =>
                set("completed_on")(e.target.value || null)
              }
            />
          </Field>

          <Text
            label="Technologies"
            hint="Comma separated, e.g. Python, FastAPI, React, PostgreSQL"
            value={technologiesInput}
            onChange={setTechnologiesInput}
          />
        </div>

        <Check
          label="Featured on the homepage"
          checked={f.is_featured}
          onChange={set("is_featured")}
        />
      </Card>

      <Card className="space-y-4">
        {TEXTS.map(([k, label]) => (
          <Area
            key={k}
            label={label}
            rows={4}
            value={f[k] as string}
            onChange={set(k) as (v: string) => void}
          />
        ))}
      </Card>

      <Card className="grid gap-4 sm:grid-cols-3">
        <Text
          label="GitHub repository"
          value={f.github_url}
          onChange={set("github_url")}
          error={errs.github_url}
        />

        <Text
          label="Live project URL"
          value={f.live_url}
          onChange={set("live_url")}
          error={errs.live_url}
        />

        <Text
          label="Documentation URL"
          value={f.docs_url}
          onChange={set("docs_url")}
          error={errs.docs_url}
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">
          Related skills
        </h2>

        <div className="flex flex-wrap gap-3">
          {skills.data?.map((s) => (
            <Check
              key={s.id}
              label={s.name}
              checked={f.skill_ids.includes(s.id)}
              onChange={(v) =>
                set("skill_ids")(
                  v
                    ? [...f.skill_ids, s.id]
                    : f.skill_ids.filter((x) => x !== s.id)
                )
              }
            />
          ))}

          {skills.data?.length === 0 && (
            <p className="text-sm">No skills yet.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">
          Media
        </h2>

        <div className="flex flex-wrap gap-2">
          <Btn
            type="button"
            variant="ghost"
            onClick={() => setPicker("main")}
          >
            {f.main_image_id ? "Change main image" : "Choose main image"}
          </Btn>

          {f.main_image_id && (
            <Btn
              type="button"
              variant="ghost"
              onClick={() => set("main_image_id")(null)}
            >
              Remove main image
            </Btn>
          )}

          <Btn
            type="button"
            variant="ghost"
            onClick={() => setPicker("gallery")}
          >
            Add screenshot or video
          </Btn>
        </div>

        <ul className="space-y-2">
          {f.media.map((m, i) => (
            <li
              key={m.media_id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"
            >
              {m.kind === "image" ? (
                <img
                  src={m.thumbnail_url ?? m.url}
                  alt=""
                  className="h-12 w-16 rounded object-cover"
                />
              ) : (
                <span className="grid h-12 w-16 place-items-center rounded bg-slate-100 text-xs">
                  {m.kind}
                </span>
              )}

              <input
                aria-label="Caption"
                placeholder="Caption"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                value={m.caption}
                onChange={(e) =>
                  set("media")(
                    f.media.map((x, j) =>
                      j === i
                        ? { ...x, caption: e.target.value }
                        : x
                    )
                  )
                }
              />

              <Btn
                type="button"
                variant="ghost"
                disabled={i === 0}
                onClick={() => moveMedia(i, -1)}
                aria-label="Move up"
              >
                ↑
              </Btn>

              <Btn
                type="button"
                variant="ghost"
                disabled={i === f.media.length - 1}
                onClick={() => moveMedia(i, 1)}
                aria-label="Move down"
              >
                ↓
              </Btn>

              <Btn
                type="button"
                variant="ghost"
                onClick={() =>
                  set("media")(f.media.filter((_, j) => j !== i))
                }
              >
                Remove
              </Btn>
            </li>
          ))}
        </ul>
      </Card>

      {picker && (
        <MediaPicker
          kind={picker === "main" ? "image" : undefined}
          onClose={() => setPicker(null)}
          onPick={onPick}
        />
      )}
    </form>
  );
}
