"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type {
  EstablishmentRewardCatalogItem,
  RewardsPagePayload,
  RewardsPodiumEntry,
} from "src/lib/rewards/types";

type RewardsApiEnvelope =
  | (RewardsPagePayload & { success: true })
  | { success: false; error?: string };

const FIELD =
  "w-full rounded-xl border border-tonki-border bg-tonki-surface px-3 py-2.5 text-sm text-tonki-text outline-none transition-colors focus:border-tonki-accent";

function formatPoints(value: number): string {
  return value.toLocaleString("es-MX");
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
}

export function RewardsExperience() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<RewardsPagePayload | null>(null);
  const [editing, setEditing] = useState<EstablishmentRewardCatalogItem | null>(
    null
  );
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] =
    useState<EstablishmentRewardCatalogItem | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/rewards", { credentials: "include" });
    const data = await readJsonSafely<RewardsApiEnvelope>(res);
    if (!res.ok || !data?.success) {
      setPayload(null);
      return;
    }
    setPayload({
      role: data.role,
      greeting_name: data.greeting_name,
      total_points: data.total_points,
      leaderboard: data.leaderboard ?? [],
      consumptions: data.consumptions ?? [],
      catalog: data.catalog ?? [],
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleSaved = useCallback(
    (reward: EstablishmentRewardCatalogItem, isNew: boolean) => {
      setPayload((prev) => {
        if (!prev) return prev;
        if (isNew) {
          return {
            ...prev,
            catalog: [reward, ...prev.catalog],
          };
        }
        return {
          ...prev,
          catalog: prev.catalog.map((item) =>
            item.id === reward.id ? reward : item
          ),
        };
      });
      setEditing(null);
      setCreating(false);
    },
    []
  );

  const handleDeleted = useCallback((rewardId: string) => {
    setPayload((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        catalog: prev.catalog.filter((item) => item.id !== rewardId),
      };
    });
    setDeleting(null);
    setEditing((current) => (current?.id === rewardId ? null : current));
  }, []);

  if (loading) {
    return (
      <main className="mx-auto w-full px-4 py-14 text-center text-sm text-tonki-text-muted sm:px-6">
        Cargando recompensas…
      </main>
    );
  }

  const greetingName = payload?.greeting_name?.trim() || "Usuario";
  const isAdmin = payload?.role === "admin";

  return (
    <main className="mx-auto w-full px-4 pb-8 pt-6 sm:px-6">
      <Greeting name={greetingName} />

      {!isAdmin ? (
        <BalanceCard totalPoints={payload?.total_points ?? 0} />
      ) : null}

      {isAdmin ? (
        <PodiumSection
          title="Tabla de líderes"
          emptyMessage="Aún no hay usuarios con consumos en tu establecimiento."
          entries={payload?.leaderboard ?? []}
        />
      ) : (
        <PodiumSection
          title="Tabla de consumos"
          emptyMessage="Aún no tienes consumos registrados en establecimientos."
          entries={payload?.consumptions ?? []}
        />
      )}

      <ExploreRewards
        catalog={payload?.catalog ?? []}
        isAdmin={isAdmin}
        onAdd={() => {
          setEditing(null);
          setCreating(true);
        }}
        onEdit={(reward) => {
          setCreating(false);
          setEditing(reward);
        }}
        onDelete={(reward) => setDeleting(reward)}
      />

      {(creating || editing) && isAdmin ? (
        <RewardFormModal
          reward={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {deleting && isAdmin ? (
        <DeleteRewardConfirm
          reward={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      ) : null}
    </main>
  );
}

function Greeting({ name }: { name: string }) {
  return (
    <header>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-tonki-text-muted">
          Bienvenido de vuelta
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-tonki-text">
          ¡Hola, {name}!
        </h1>
      </div>
    </header>
  );
}

function BalanceCard({ totalPoints }: { totalPoints: number }) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-tonki-accent p-5 text-tonki-accent-fg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-tonki-accent-fg/70">
            Tus Tonkis
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            {formatPoints(totalPoints)}
          </p>
        </div>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tonki-accent-fg/10 text-3xl">
          🪙
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-tonki-accent-fg/80">
        Puntos acumulados por tus consumos.
      </p>
    </section>
  );
}

function PodiumSection({
  title,
  emptyMessage,
  entries,
}: {
  title: string;
  emptyMessage: string;
  entries: RewardsPodiumEntry[];
}) {
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const ordered = [byRank.get(2), byRank.get(1), byRank.get(3)].filter(
    (e): e is RewardsPodiumEntry => Boolean(e)
  );

  return (
    <section className="mt-8">
      <SectionHeading title={title} />
      {ordered.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-tonki-border bg-tonki-surface px-4 py-8 text-center text-sm text-tonki-text-muted">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-4 flex items-end justify-center gap-3 rounded-2xl border border-tonki-border bg-tonki-surface p-5">
          {ordered.map((entry) => (
            <PodiumItem key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}

const PODIUM_STYLE: Record<
  1 | 2 | 3,
  { ring: string; size: string; lift: string; medal: string }
> = {
  1: { ring: "ring-tonki-accent", size: "h-20 w-20", lift: "-mt-4", medal: "🥇" },
  2: { ring: "ring-tonki-border-strong", size: "h-16 w-16", lift: "mt-2", medal: "🥈" },
  3: { ring: "ring-tonki-border-strong", size: "h-16 w-16", lift: "mt-2", medal: "🥉" },
};

function PodiumItem({ entry }: { entry: RewardsPodiumEntry }) {
  const style = PODIUM_STYLE[entry.rank];
  const initial = entry.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`flex w-1/3 flex-col items-center ${style.lift}`}>
      <div className="relative">
        <span
          className={`flex ${style.size} items-center justify-center overflow-hidden rounded-full bg-tonki-elevated text-xl font-bold text-tonki-text ring-2 ${style.ring}`}
        >
          {entry.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.avatar_url}
              alt={entry.name}
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </span>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg">
          {style.medal}
        </span>
      </div>
      <p className="mt-3 max-w-full truncate text-sm font-semibold text-tonki-text">
        {entry.name}
      </p>
      <p className="text-xs font-medium text-tonki-text-muted">
        {formatPoints(entry.points)} pts
      </p>
    </div>
  );
}

function ExploreRewards({
  catalog,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
}: {
  catalog: EstablishmentRewardCatalogItem[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (reward: EstablishmentRewardCatalogItem) => void;
  onDelete: (reward: EstablishmentRewardCatalogItem) => void;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading title="Explora recompensas" />
        {isAdmin ? (
          <button
            type="button"
            onClick={onAdd}
            className="shrink-0 rounded-xl bg-tonki-accent px-3 py-2 text-sm font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover"
          >
            Agregar recompensa
          </button>
        ) : null}
      </div>
      {catalog.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-tonki-border bg-tonki-surface px-4 py-8 text-center text-sm text-tonki-text-muted">
          Aún no hay recompensas publicadas.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {catalog.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              isAdmin={isAdmin}
              onEdit={() => onEdit(reward)}
              onDelete={() => onDelete(reward)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RewardCard({
  reward,
  isAdmin,
  onEdit,
  onDelete,
}: {
  reward: EstablishmentRewardCatalogItem;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const imageSrc =
    reward.image_url?.trim() || "/Logos-Tonki-SVG/Isotipo caf-crema.svg";
  const isFallback = !reward.image_url?.trim();

  return (
    <article className="flex flex-col rounded-2xl border border-tonki-border bg-tonki-surface p-3 transition-colors hover:bg-tonki-surface-hover">
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-tonki-elevated">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={reward.title}
          className={
            isFallback
              ? "h-16 w-16 object-contain opacity-35"
              : "h-full w-full object-cover"
          }
        />
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="text-sm font-bold leading-snug tracking-tight text-tonki-text">
          {reward.title}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-tonki-text-muted">
          {reward.establishment_name}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-tonki-text-secondary">
          {reward.short_description}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-base">🪙</span>
            <span className="text-sm font-bold text-tonki-text">
              {formatPoints(reward.value_tonkis)}
            </span>
          </div>
          <span className="text-xs font-medium text-tonki-text-muted">
            {formatMoney(reward.value_usd)}
          </span>
        </div>
        {isAdmin ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl border border-tonki-border bg-tonki-canvas py-2.5 text-sm font-bold text-tonki-text transition-colors hover:bg-tonki-elevated"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl border border-red-200 bg-transparent py-2.5 text-sm font-bold text-tonki-danger transition-colors hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-tonki-accent py-2.5 text-sm font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover"
          >
            Reclamar
          </button>
        )}
      </div>
    </article>
  );
}

function RewardFormModal({
  reward,
  onClose,
  onSaved,
}: {
  reward: EstablishmentRewardCatalogItem | null;
  onClose: () => void;
  onSaved: (reward: EstablishmentRewardCatalogItem, isNew: boolean) => void;
}) {
  const isNew = reward === null;
  const [title, setTitle] = useState(reward?.title ?? "");
  const [shortDescription, setShortDescription] = useState(
    reward?.short_description ?? ""
  );
  const [longDescription, setLongDescription] = useState(
    reward?.long_description ?? ""
  );
  const [valueTonkis, setValueTonkis] = useState(
    reward ? String(reward.value_tonkis) : ""
  );
  const [valueUsd, setValueUsd] = useState(
    reward ? String(reward.value_usd) : ""
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    reward?.image_url?.trim() || null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setImageFile(file);
    setPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = new FormData();
      body.set("title", title);
      body.set("short_description", shortDescription);
      body.set("long_description", longDescription);
      body.set("value_tonkis", valueTonkis);
      body.set("value_usd", valueUsd);
      if (imageFile) body.set("image", imageFile);

      const res = await fetch(
        isNew ? "/api/rewards/catalog" : `/api/rewards/catalog/${reward.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          credentials: "include",
          body,
        }
      );
      const data = await readJsonSafely<{
        success?: boolean;
        error?: string;
        reward?: EstablishmentRewardCatalogItem;
      }>(res);

      if (!res.ok || !data?.success || !data.reward) {
        setError(
          data?.error ||
            (isNew
              ? "No se pudo crear la recompensa"
              : "No se pudo guardar la recompensa")
        );
        return;
      }
      onSaved(data.reward, isNew);
    } catch {
      setError(
        isNew
          ? "No se pudo crear la recompensa"
          : "No se pudo guardar la recompensa"
      );
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = preview || "/Logos-Tonki-SVG/Isotipo caf-crema.svg";
  const previewIsFallback = !preview;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 py-6 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-form-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-tonki-border bg-tonki-surface p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="reward-form-title"
              className="text-lg font-bold text-tonki-text"
            >
              {isNew ? "Agregar recompensa" : "Editar recompensa"}
            </h2>
            {reward?.establishment_name ? (
              <p className="mt-1 text-xs text-tonki-text-muted">
                {reward.establishment_name}
              </p>
            ) : (
              <p className="mt-1 text-xs text-tonki-text-muted">
                Se publicará en tu establecimiento
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-sm font-medium text-tonki-text-muted hover:bg-tonki-elevated"
          >
            Cerrar
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-tonki-danger"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-tonki-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="Vista previa"
                className={
                  previewIsFallback
                    ? "h-12 w-12 object-contain opacity-35"
                    : "h-full w-full object-cover"
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor="reward-image"
                className="mb-1 block text-sm font-medium text-tonki-text"
              >
                Imagen
              </label>
              <input
                id="reward-image"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="block w-full text-xs text-tonki-text-secondary file:mr-2 file:rounded-lg file:border-0 file:bg-tonki-accent file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-tonki-accent-fg"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="reward-title"
              className="mb-1 block text-sm font-medium text-tonki-text"
            >
              Título
            </label>
            <input
              id="reward-title"
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FIELD}
            />
          </div>

          <div>
            <label
              htmlFor="reward-short"
              className="mb-1 block text-sm font-medium text-tonki-text"
            >
              Descripción corta
            </label>
            <input
              id="reward-short"
              required
              maxLength={255}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className={FIELD}
            />
          </div>

          <div>
            <label
              htmlFor="reward-long"
              className="mb-1 block text-sm font-medium text-tonki-text"
            >
              Descripción larga
            </label>
            <textarea
              id="reward-long"
              rows={4}
              maxLength={5000}
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              className={FIELD}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reward-tonkis"
                className="mb-1 block text-sm font-medium text-tonki-text"
              >
                Valor en tonkis
              </label>
              <input
                id="reward-tonkis"
                type="number"
                min={1}
                step={1}
                required
                value={valueTonkis}
                onChange={(e) => setValueTonkis(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label
                htmlFor="reward-usd"
                className="mb-1 block text-sm font-medium text-tonki-text"
              >
                Valor en $
              </label>
              <input
                id="reward-usd"
                type="number"
                min={0}
                step="0.01"
                required
                value={valueUsd}
                onChange={(e) => setValueUsd(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-tonki-border px-4 py-2.5 text-sm font-semibold text-tonki-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-tonki-accent px-4 py-2.5 text-sm font-bold text-tonki-accent-fg disabled:opacity-60"
            >
              {saving
                ? isNew
                  ? "Creando…"
                  : "Guardando…"
                : isNew
                  ? "Crear"
                  : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteRewardConfirm({
  reward,
  onClose,
  onDeleted,
}: {
  reward: EstablishmentRewardCatalogItem;
  onClose: () => void;
  onDeleted: (rewardId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/rewards/catalog/${reward.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await readJsonSafely<{
        success?: boolean;
        error?: string;
      }>(res);
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo eliminar la recompensa");
        return;
      }
      onDeleted(reward.id);
    } catch {
      setError("No se pudo eliminar la recompensa");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 py-6 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-reward-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-tonki-border bg-tonki-surface p-5 shadow-xl">
        <h2
          id="delete-reward-title"
          className="text-lg font-bold text-tonki-text"
        >
          Eliminar recompensa
        </h2>
        <p className="mt-2 text-sm text-tonki-text-secondary">
          ¿Seguro que quieres eliminar{" "}
          <span className="font-semibold text-tonki-text">{reward.title}</span>?
          Esta acción no se puede deshacer.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-tonki-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-tonki-border px-4 py-2.5 text-sm font-semibold text-tonki-text disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-tonki-danger disabled:opacity-60"
          >
            {busy ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight text-tonki-text">{title}</h2>
    </div>
  );
}
