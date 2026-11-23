import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Area,
  Btn,
  Card,
  csv,
  ErrorNote,
  Field,
  inputCls,
  PageTitle,
  Text,
} from "@/components/admin/Form";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { del, get, post, put } from "@/services/admin";
import { Markdown } from "@/utils/markdown";

interface Art {
  id?: string;
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  cover_id: string | null;
  category_id: string | null;
  tags: string[];
  seo_description: string;
  is_published?: boolean;
  published_at: string | null;
}

const blank: Art = {
  title: "",
  excerpt: "",
  content: "",
  cover_id: null,
  category_id: null,
  tags: [],
  seo_description: "",
  published_at: null,
};

const toLocal = (iso: string | null) =>
  iso
    ? new Date(
        new Date(iso).getTime() -
          new Date(iso).getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16)
    : "";

export default function Articles() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin", "articles"],
    queryFn: () => get<Art[]>("/articles"),
  });

  const cats = useQuery({
    queryKey: ["admin", "article-cats"],
    queryFn: () => get<{ id: string; name: string }[]>("/article-categories"),
  });

  const [edit, setEdit] = useState<Art | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [preview, setPreview] = useState(false);
  const [pick, setPick] = useState(false);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    setPreview(false);
  }, [edit?.id]);

  const done = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["articles"] });
  };

  const save = useMutation({
    mutationFn: (a: Art) =>
      a.id
        ? put<Art>(`/articles/${a.id}`, a)
        : post<Art>("/articles", a),

    onSuccess: (a) => {
      setEdit(a);
      setTagsInput(a.tags.join(", "));
      done();
    },
  });

  const toggle = useMutation({
    mutationFn: (a: Art) =>
      post(`/articles/${a.id}/publish`, {
        published: !a.is_published,
      }),
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/articles/${id}`),
    onSuccess: () => {
      setEdit(null);
      setTagsInput("");
      done();
    },
  });

  const addCat = useMutation({
    mutationFn: () => post("/article-categories", { name: newCat }),
    onSuccess: () => {
      setNewCat("");
      done();
    },
  });

  if (edit) {
    const set = <K extends keyof Art>(k: K) => (v: Art[K]) =>
      setEdit({ ...edit, [k]: v });

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();

          save.mutate({
            ...edit,
            tags: csv(tagsInput),
          });
        }}
        className="max-w-4xl space-y-4"
      >
        <PageTitle
          action={
            <div className="flex gap-2">
              <Btn
                type="button"
                variant="ghost"
                onClick={() => {
                  setEdit(null);
                  setTagsInput("");
                }}
              >
                Back
              </Btn>

              <Btn type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save draft"}
              </Btn>
            </div>
          }
        >
          {edit.id ? "Edit article" : "New article"}
        </PageTitle>

        <ErrorNote error={save.error ?? toggle.error} />

        {save.isSuccess && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            Saved.
          </p>
        )}

        <Card className="space-y-4">
          <Text
            label="Title *"
            required
            value={edit.title}
            onChange={set("title")}
          />

          <Text
            label="Excerpt"
            value={edit.excerpt}
            onChange={set("excerpt")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select
                className={inputCls}
                value={edit.category_id ?? ""}
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

            <Text
              label="Tags"
              hint="Comma separated, e.g. Python, FastAPI, React"
              value={tagsInput}
              onChange={setTagsInput}
            />
          </div>

          <Field label="Publish date (optional; a future date schedules it)">
            <input
              type="datetime-local"
              className={inputCls}
              value={toLocal(edit.published_at)}
              onChange={(e) =>
                set("published_at")(
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null
                )
              }
            />
          </Field>

          <Area
            label="SEO description"
            rows={2}
            hint="Up to 320 characters; shown in search results and link previews."
            value={edit.seo_description}
            onChange={set("seo_description")}
          />

          <div className="flex gap-2">
            <Btn
              type="button"
              variant="ghost"
              onClick={() => setPick(true)}
            >
              {edit.cover_id ? "Change cover image" : "Choose cover image"}
            </Btn>

            {edit.cover_id && (
              <Btn
                type="button"
                variant="ghost"
                onClick={() => set("cover_id")(null)}
              >
                Remove cover
              </Btn>
            )}
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">
              Content (Markdown)
            </h2>

            <Btn
              type="button"
              variant="ghost"
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Edit" : "Preview"}
            </Btn>
          </div>

          {preview ? (
            <div className="min-h-48 rounded-lg bg-surface p-4">
              <Markdown text={edit.content} />
            </div>
          ) : (
            <textarea
              aria-label="Article content"
              rows={18}
              className={`${inputCls} font-mono`}
              value={edit.content}
              onChange={(e) => set("content")(e.target.value)}
            />
          )}

          <p className="text-xs text-slate-500">
            Supports # headings, **bold**, `code`, lists, &gt; quotes,
            ``` code blocks, links and images (![alt](/media/…)).
            Raw HTML is never rendered.
          </p>
        </Card>

        {edit.id && (
          <div className="flex gap-2">
            <Btn
              type="button"
              variant="ghost"
              onClick={() =>
                toggle.mutate(edit, {
                  onSuccess: (_d, a) =>
                    setEdit({
                      ...a,
                      is_published: !a.is_published,
                    }),
                })
              }
            >
              {edit.is_published ? "Unpublish" : "Publish"}
            </Btn>

            <Btn
              type="button"
              variant="danger"
              onClick={() =>
                window.confirm("Delete this article?") &&
                remove.mutate(edit.id!)
              }
            >
              Delete
            </Btn>
          </div>
        )}

        {pick && (
          <MediaPicker
            kind="image"
            onClose={() => setPick(false)}
            onPick={(m) => {
              set("cover_id")(m.id);
              setPick(false);
            }}
          />
        )}
      </form>
    );
  }

  return (
    <>
      <PageTitle
        action={
          <Btn
            onClick={() => {
              setTagsInput("");
              setEdit({ ...blank });
            }}
          >
            New article
          </Btn>
        }
      >
        Articles
      </PageTitle>

      <ErrorNote error={toggle.error ?? addCat.error} />

      <form
        className="mb-4 flex max-w-sm items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newCat.trim()) addCat.mutate();
        }}
      >
        <div className="flex-1">
          <Text
            label="New category"
            value={newCat}
            onChange={setNewCat}
          />
        </div>

        <Btn type="submit">Add</Btn>
      </form>

      <Card>
        {list.data?.length === 0 && (
          <p className="py-6 text-center text-sm">
            No articles yet.
          </p>
        )}

        <ul className="divide-y divide-slate-100">
          {list.data?.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium text-navy">{a.title}</p>

                <p
                  className={`text-xs ${
                    a.is_published
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {a.is_published
                    ? a.published_at &&
                      new Date(a.published_at) > new Date()
                      ? `Scheduled for ${new Date(
                          a.published_at
                        ).toLocaleString()}`
                      : "Published"
                    : "Draft"}
                </p>
              </div>

              <div className="flex gap-2">
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setTagsInput(a.tags.join(", "));
                    setEdit(a);
                  }}
                >
                  Edit
                </Btn>

                <Btn
                  variant="ghost"
                  onClick={() => toggle.mutate(a)}
                >
                  {a.is_published ? "Unpublish" : "Publish"}
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}