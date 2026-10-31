"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Factor = { id: string; factor_type: string; status: string };

export function TwoFactorPanel({ nextPath, setup }: { nextPath: string; setup: boolean }) {
  const [factor, setFactor] = useState<Factor | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError) setError("Impossible de charger la configuration de sécurité.");
      const enrolled = data?.totp.find((item) => item.status === "verified");
      setFactor(enrolled ?? null);
      setLoading(false);
    });
  }, []);

  async function startEnrollment() {
    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "NovaConnect Authenticator",
      issuer: "NovaConnect",
    });
    if (enrollError || !data.totp) {
      const detail = enrollError?.message.toLowerCase() ?? "";
      setError(
        detail.includes("not enabled") || detail.includes("unsupported")
          ? "La 2FA TOTP n'est pas activée dans les paramètres Authentication de Supabase."
          : "Impossible d'activer la vérification en deux étapes. Vérifie que TOTP est activé dans Supabase, puis réessaie.",
      );
    } else {
      setFactor({ id: data.id, factor_type: "totp", status: "unverified" });
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    setSubmitting(false);
  }

  async function verifyCode() {
    if (!factor || code.trim().length !== 6) {
      setError("Saisis le code à 6 chiffres affiché par ton application.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeError || !challenge) {
      setError("Impossible de créer le challenge de sécurité. Réessaie.");
      setSubmitting(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("Ce code est invalide ou a expiré. Réessaie avec un nouveau code.");
      setSubmitting(false);
      return;
    }
    if (setup) {
      setFactor({ ...factor, status: "verified" });
      setCode("");
      setSubmitting(false);
      return;
    }
    window.location.assign(nextPath);
  }

  async function disableFactor() {
    if (!factor || !window.confirm("Désactiver la vérification en deux étapes ?")) return;
    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (unenrollError) {
      setError("La désactivation nécessite une session récemment vérifiée.");
      setSubmitting(false);
      return;
    }
    setFactor(null);
    setQrCode(null);
    setSecret(null);
    setDisabled(true);
    setSubmitting(false);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement de la sécurité…</p>;

  const isEnrollment = factor?.status === "unverified";
  const needsVerification = factor !== null && !isEnrollment;

  return (
    <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/10 sm:p-8">
      <Link href="/" className="text-sm font-semibold text-primary hover:underline">
        NovaConnect
      </Link>
      <p className="mt-6 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Sécurité
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {needsVerification ? "Vérifiez votre identité" : "Vérification en deux étapes"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {needsVerification
          ? "Saisissez le code temporaire généré par votre application d’authentification."
          : "Protégez votre compte avec une application comme Google Authenticator ou Authy."}
      </p>

      {!factor && (
        <Button className="mt-7 w-full" onClick={startEnrollment} disabled={submitting}>
          {submitting ? "Préparation…" : "Configurer la 2FA"}
        </Button>
      )}

      {isEnrollment && (
        <div className="mt-7 space-y-5">
          <div className="rounded-xl bg-muted p-4 text-center">
            {qrCode && (
              // The QR value is supplied by Supabase as an SVG data URI.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode}
                alt="QR code pour configurer NovaConnect"
                className="mx-auto h-44 w-44"
              />
            )}
          </div>
          {secret && (
            <p className="rounded-lg border border-border bg-background p-3 text-center font-mono text-xs break-all text-foreground">
              {secret}
            </p>
          )}
          <CodeInput code={code} setCode={setCode} />
          <Button className="w-full" onClick={verifyCode} disabled={submitting}>
            {submitting ? "Vérification…" : "Activer la vérification"}
          </Button>
        </div>
      )}

      {needsVerification && (
        <div className="mt-7 space-y-5">
          <CodeInput code={code} setCode={setCode} />
          <Button className="w-full" onClick={verifyCode} disabled={submitting}>
            {submitting ? "Vérification…" : "Continuer"}
          </Button>
          {setup && (
            <Button
              variant="outline"
              className="w-full"
              onClick={disableFactor}
              disabled={submitting}
            >
              Désactiver la 2FA
            </Button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {setup && disabled && (
        <p className="mt-4 text-center text-sm text-success">La 2FA est désactivée.</p>
      )}
    </section>
  );
}

function CodeInput({ code, setCode }: { code: string; setCode: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-foreground" htmlFor="mfa-code">
      Code à 6 chiffres
      <input
        id="mfa-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        className="border-input rounded-lg border bg-background px-3 py-3 text-center text-lg font-semibold tracking-[0.45em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
