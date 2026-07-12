"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  fetchAirdropConfig,
  saveAirdropConfig,
} from "src/lib/airdrop/fetchAirdropConfigClient";
import {
  formatAirdropDateInput,
  type AirdropConfigFormValues,
} from "src/lib/airdrop/schemas";
import type { AirdropConfigRecord } from "src/lib/airdrop/types";

const ACCENT_BUTTON =
  "inline-flex items-center justify-center rounded-xl bg-tonki-accent px-5 py-2.5 text-sm font-semibold leading-none text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

const FIELD =
  "w-full rounded-xl border border-tonki-border bg-tonki-surface px-4 py-3 text-tonki-text outline-none transition-colors focus:border-tonki-accent";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

function emptyForm(): AirdropConfigFormValues {
  return {
    amount: 0,
    scheduled_date: "",
    scheduled_end_date: "",
    periodicity_months: 1,
    max_users: 10,
  };
}

function formFromConfig(config: AirdropConfigRecord): AirdropConfigFormValues {
  return {
    amount: config.amount,
    scheduled_date: formatAirdropDateInput(config.scheduled_date),
    scheduled_end_date: formatAirdropDateInput(config.scheduled_end_date),
    periodicity_months: config.periodicity_months,
    max_users: config.max_users,
  };
}

function CurrentConfigSummary({ config }: { config: AirdropConfigRecord }) {
  return (
    <div className="rounded-xl border border-tonki-border border-l-4 border-l-tonki-accent bg-tonki-canvas px-4 py-4">
      <p className="text-sm font-semibold text-tonki-text">Configuración actual</p>
      <ul className="mt-3 space-y-2 text-sm text-tonki-text-secondary">
        <li>
          Monto:{" "}
          <span className="font-semibold text-tonki-text">
            {config.amount.toLocaleString("es", { maximumFractionDigits: 7 })} XLM
          </span>
        </li>
        <li>
          Fecha inicio programada:{" "}
          <span className="font-semibold text-tonki-text">
            {new Date(config.scheduled_date).toLocaleDateString("es", {
              dateStyle: "medium",
            })}
          </span>
        </li>
        {config.scheduled_end_date ? (
          <li>
            Fecha final programada:{" "}
            <span className="font-semibold text-tonki-text">
              {new Date(config.scheduled_end_date).toLocaleDateString("es", {
                dateStyle: "medium",
              })}
            </span>
          </li>
        ) : null}
        <li>
          Periodicidad:{" "}
          <span className="font-semibold text-tonki-text">
            cada {config.periodicity_months} mes(es)
          </span>
        </li>
        <li>
          Máx. usuarios:{" "}
          <span className="font-semibold text-tonki-text">{config.max_users}</span>
        </li>
      </ul>
    </div>
  );
}

export default function AdminAirdropConfigurePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState<AirdropConfigRecord | null>(
    null
  );
  const [form, setForm] = useState<AirdropConfigFormValues>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchAirdropConfig({
      networkErrorMessage: "No se pudo cargar la configuración",
    });

    if (!result.ok) {
      setError(result.error);
      setSavedConfig(null);
    } else {
      setSavedConfig(result.data.config);
      if (result.data.config) {
        setForm(formFromConfig(result.data.config));
      } else {
        setForm(emptyForm());
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setSubmitting(true);

      const result = await saveAirdropConfig(form);

      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      setSavedConfig(result.config);
      setForm(formFromConfig(result.config));
      setSuccess("Configuración guardada correctamente.");
      setSubmitting(false);

      window.setTimeout(() => {
        router.push("/admin/airdrop");
      }, 600);
    },
    [form, router]
  );

  if (loading) {
    return (
      <main className="mx-auto w-full px-4 py-14 text-center text-sm text-tonki-text-muted sm:px-6">
        Cargando configuración…
      </main>
    );
  }

  return (
    <main className="mx-auto w-full border-x border-tonki-border pb-10">
      <header className="border-b border-tonki-border px-4 py-5 sm:px-6">
        <Link
          href="/admin/airdrop"
          className="text-sm font-medium text-tonki-text-muted transition-colors hover:text-tonki-accent"
        >
          ← Volver al airdrop
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-tonki-text">
          Configuración de Airdrop
        </h1>
        <p className="mt-1 text-sm text-tonki-text-muted">
          Define monto, fecha y límites para el reparto.
        </p>
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-tonki-danger"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            role="status"
            className="rounded-xl border border-tonki-accent/40 bg-tonki-accent/10 px-4 py-3 text-sm font-medium text-tonki-text"
          >
            {success}
          </p>
        ) : null}

        {savedConfig ? (
          <CurrentConfigSummary config={savedConfig} />
        ) : (
          <p className="rounded-xl border border-tonki-border bg-tonki-canvas px-4 py-3 text-sm text-tonki-text-muted">
            No hay configuración guardada. Completa el formulario para crear una
            nueva.
          </p>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4 rounded-xl border border-tonki-border bg-tonki-surface p-4 shadow-sm sm:p-5"
        >
          <div>
            <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-tonki-text">
              Monto total del airdrop (XLM)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.0000001"
              min="0.0000001"
              required
              value={form.amount || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  amount: e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="scheduled_date" className="mb-1.5 block text-sm font-medium text-tonki-text">
              Fecha inicio programada
            </label>
            <input
              id="scheduled_date"
              name="scheduled_date"
              type="date"
              required
              value={form.scheduled_date}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  scheduled_date: e.target.value,
                }))
              }
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="scheduled_end_date" className="mb-1.5 block text-sm font-medium text-tonki-text">
              Fecha final programada
            </label>
            <input
              id="scheduled_end_date"
              name="scheduled_end_date"
              type="date"
              required
              min={form.scheduled_date || undefined}
              value={form.scheduled_end_date}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  scheduled_end_date: e.target.value,
                }))
              }
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="periodicity_months" className="mb-1.5 block text-sm font-medium text-tonki-text">
              Periodicidad (meses)
            </label>
            <select
              id="periodicity_months"
              name="periodicity_months"
              required
              value={form.periodicity_months}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  periodicity_months: Number(e.target.value),
                }))
              }
              className={FIELD}
            >
              {MONTH_OPTIONS.map((month) => (
                <option key={month} value={month}>
                  {month} mes(es)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="max_users" className="mb-1.5 block text-sm font-medium text-tonki-text">
              Cantidad máxima de usuarios
            </label>
            <input
              id="max_users"
              name="max_users"
              type="number"
              min={1}
              step={1}
              required
              value={form.max_users || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  max_users:
                    e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
              className={FIELD}
            />
          </div>

          <button type="submit" disabled={submitting} className={ACCENT_BUTTON}>
            {submitting ? "Guardando…" : "Guardar configuración"}
          </button>
        </form>
      </div>
    </main>
  );
}
