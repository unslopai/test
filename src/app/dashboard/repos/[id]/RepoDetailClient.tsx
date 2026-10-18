'use client';

/**
 * Kunden-Detailseite eines Repos (DASHBOARD_UX_SPEC.md §3): Scan-Historie mit
 * aufklappbaren Findings (Progressive Disclosure, volle Lesbarkeit ohne
 * Aktionen — der PR bleibt die einzige Wahrheit), WebhookHealthPanel für
 * Legacy-Repos, den Fork-PR-Schalter (SERVER_AUDIT_2026-09 M3) und die Danger
 * Zone mit Kontext-Dialog (§6.1).
 *
 * Side-Effects (Fetch, Refocus-Refresh, Pagination) leben in useScanHistory;
 * diese Komponente hält nur UI-Zustand (aufgeklappter Scan, Dialog, Busy).
 */
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import PageShell from '../../PageShell';
import ConfirmDialog from '../../ConfirmDialog';
import WebhookHealthPanel from '../../WebhookHealthPanel';
import ForkPrSwitch from './ForkPrSwitch';
import { useToast } from '../../Toast';
import { useScanHistory, type ScanIssueView, type ScanView } from './useScanHistory';

interface RepoDetailClientProps {
    /** Gatekeeper repo uuid — Schlüssel der Scan-API und des Webhook-Panels. */
    readonly repoId: string;
    readonly fullName: string;
    /** DB-Status (nicht der Display-Status der Liste). */
    readonly status: string;
    /** GitHub-numerische ID — Contract von POST /api/repos/disconnect. */
    readonly githubRepoId: number;
    readonly prReviewsEnabled: boolean;
    /** Verbunden ohne App-Installation ⇒ Repo-Webhook prüfbar/reparierbar (D8). */
    readonly isLegacyRepo: boolean;
    /** Startwert von repositories.review_fork_prs. */
    readonly reviewForkPrs: boolean;
}

export default function RepoDetailClient({
    repoId,
    fullName,
    status,
    githubRepoId,
    prReviewsEnabled,
    isLegacyRepo,
    reviewForkPrs,
}: RepoDetailClientProps) {
    const t = useTranslations('repoDetail');
    const tDashboard = useTranslations('dashboard');

    const scanHistory = useScanHistory(repoId, {
        loadFailed: t('history.loadFailed'),
        network: tDashboard('errors.network'),
    });

    return (
        <PageShell
            breadcrumb={(
                <Link href="/dashboard" className="shrink-0 text-sm text-ink-muted transition hover:text-ink">
                    {t('backToRepos')}
                </Link>
            )}
            title={fullName}
            titleAccessory={(
                <>
                    <StatusBadge status={status} />
                    {prReviewsEnabled && (
                        <span
                            title={tDashboard('prReviewsTooltip')}
                            className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent"
                        >
                            {tDashboard('prReviewsBadge')}
                        </span>
                    )}
                </>
            )}
            headerActions={(
                <a
                    href={`https://github.com/${fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-overlay"
                >
                    {t('viewOnGitHub')}
                </a>
            )}
        >
            <ScanHistorySection scanHistory={scanHistory} />

            {isLegacyRepo && (
                <section className="mt-10">
                    <h2 className="mb-3 text-lg font-semibold">{t('webhookHeading')}</h2>
                    <WebhookHealthPanel repoId={repoId} />
                </section>
            )}

            {prReviewsEnabled && (
                <ForkPrSwitch repoId={repoId} initialReviewForkPrs={reviewForkPrs} />
            )}

            {status === 'active' && (
                <DangerZone fullName={fullName} githubRepoId={githubRepoId} />
            )}
        </PageShell>
    );
}

// =============================================================================
// Status
// =============================================================================

/** Literal-Union statt string: next-intl typisiert die Katalog-Keys strikt. */
type StatusLabelKey = 'statusActive' | 'statusSyncing' | 'statusError' | 'statusPendingActivation' | 'statusNotConnected';

function StatusBadge({ status }: { readonly status: string }) {
    const t = useTranslations('dashboard');

    // Dieselbe Farb-/Label-Semantik wie die Listen-Punkte; 'deactivated'
    // (Soft-Delete) zeigt sich wie überall als "nicht verbunden".
    const badgeByStatus: Record<string, { className: string; labelKey: StatusLabelKey }> = {
        active: { className: 'bg-accent/10 text-accent', labelKey: 'statusActive' },
        syncing: { className: 'bg-warn/10 text-warn', labelKey: 'statusSyncing' },
        error: { className: 'bg-danger/10 text-danger', labelKey: 'statusError' },
        pending_activation: { className: 'bg-warn/10 text-warn', labelKey: 'statusPendingActivation' },
    };
    const badge = badgeByStatus[status]
        ?? { className: 'bg-surface-overlay text-ink-muted', labelKey: 'statusNotConnected' };

    return (
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${badge.className}`}>
            {t(badge.labelKey)}
        </span>
    );
}

// =============================================================================
// Scan-Historie
// =============================================================================

function ScanHistorySection({ scanHistory }: {
    readonly scanHistory: ReturnType<typeof useScanHistory>;
}) {
    const t = useTranslations('repoDetail.history');
    // Ein Scan offen zur Zeit — Progressive Disclosure statt Findings-Wand.
    const [expandedScanId, setExpandedScanId] = useState<string | null>(null);

    return (
        <section>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('heading')}</h2>
                <button
                    onClick={scanHistory.refresh}
                    disabled={scanHistory.loadState === 'loading'}
                    className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-overlay disabled:opacity-50"
                >
                    {scanHistory.loadState === 'loading' ? t('refreshing') : t('refresh')}
                </button>
            </div>

            {scanHistory.errorMessage && (
                <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {scanHistory.errorMessage}
                </div>
            )}

            {scanHistory.loadState === 'loading' && scanHistory.scans.length === 0 && (
                <p className="py-8 text-sm text-ink-muted">{t('loading')}</p>
            )}

            {scanHistory.loadState === 'loaded' && scanHistory.scans.length === 0 && (
                /* Dot-Grid-Empty-State (Muster v1). */
                <p className="marketing-dot-grid rounded-xl border border-edge px-6 py-12 text-center text-ink-muted">
                    {t('empty')}
                </p>
            )}

            <ul className="grid gap-3">
                {scanHistory.scans.map((scan) => (
                    <ScanRow
                        key={scan.id}
                        scan={scan}
                        isExpanded={expandedScanId === scan.id}
                        onToggle={() => setExpandedScanId(expandedScanId === scan.id ? null : scan.id)}
                    />
                ))}
            </ul>

            {scanHistory.hasMore && (
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={scanHistory.loadMore}
                        disabled={scanHistory.isLoadingMore}
                        className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-overlay disabled:opacity-50"
                    >
                        {scanHistory.isLoadingMore ? t('loadingMore') : t('loadMore')}
                    </button>
                </div>
            )}
        </section>
    );
}

function ScanRow({ scan, isExpanded, onToggle }: {
    readonly scan: ScanView;
    readonly isExpanded: boolean;
    readonly onToggle: () => void;
}) {
    const t = useTranslations('repoDetail.history');
    const format = useFormatter();
    // Expliziter Bezugspunkt (sonst loggt next-intl ENVIRONMENT_FALLBACK);
    // das Minuten-Intervall lässt die Zeiten bei offenem Tab weiterticken.
    const now = useNow({ updateInterval: 60_000 });

    return (
        <li className="rounded-xl border border-edge bg-surface-raised">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {scan.prUrl && scan.prNumber !== null ? (
                        <a
                            href={scan.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-ink hover:underline"
                        >
                            {t('prLink', { number: scan.prNumber })}
                        </a>
                    ) : (
                        <span className="font-medium text-ink">{t('localScan')}</span>
                    )}
                    <span className="text-xs text-ink-muted">
                        {format.relativeTime(new Date(scan.createdAt), now)}
                    </span>
                    <ScanVerdictLabel scan={scan} />
                    {scan.integrityScore !== null && (
                        <span className="text-xs text-ink-muted">
                            {t('integrity', { score: scan.integrityScore })}
                        </span>
                    )}
                </div>
                {scan.issueCount > 0 && (
                    <button
                        onClick={onToggle}
                        aria-expanded={isExpanded}
                        className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                            isExpanded
                                ? 'border-accent/40 bg-accent/10 text-accent'
                                : 'border-edge text-ink-muted hover:bg-surface-overlay'
                        }`}
                    >
                        {t('toggleFindings', { count: scan.issueCount })}
                    </button>
                )}
            </div>
            {isExpanded && <FindingsList issues={scan.issues} />}
        </li>
    );
}

function ScanVerdictLabel({ scan }: { readonly scan: ScanView }) {
    const t = useTranslations('repoDetail.history');

    if (scan.status === 'pending' || scan.status === 'processing') {
        return <span className="text-xs text-warn">{t('statusRunning')}</span>;
    }
    if (scan.status === 'error') {
        return <span className="text-xs text-danger">{t('statusError')}</span>;
    }
    if (scan.verdict === 'clean') {
        return <span className="text-xs text-accent">{t('verdictClean')}</span>;
    }
    if (scan.verdict === 'slop') {
        return <span className="text-xs text-danger">{t('verdictSlop', { count: scan.issueCount })}</span>;
    }
    return <span className="text-xs text-ink-muted">{t('verdictNeutral')}</span>;
}

function FindingsList({ issues }: { readonly issues: readonly ScanIssueView[] }) {
    const t = useTranslations('repoDetail.findings');

    return (
        <ul className="grid gap-3 border-t border-edge px-5 py-4">
            {issues.map((issue, issueIndex) => (
                <li key={`${issue.path}:${issue.line}:${issueIndex}`} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                                issue.severity === 'CRITICAL'
                                    ? 'bg-danger/10 text-danger'
                                    : 'bg-warn/10 text-warn'
                            }`}
                        >
                            {issue.severity}
                        </span>
                        <code className="text-xs text-ink">{issue.rule}</code>
                        <code className="break-all text-xs text-ink-muted">
                            {issue.path}:{issue.line}
                        </code>
                        <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-muted">
                            {issue.source === 'prescan' ? t('sourcePrescan') : t('sourceLlm')}
                        </span>
                        {issue.confidence !== null && (
                            <span className="text-[10px] text-ink-muted">
                                {t('confidence', { value: issue.confidence })}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 leading-relaxed text-ink-muted">{issue.critique}</p>
                </li>
            ))}
        </ul>
    );
}

// =============================================================================
// Danger Zone (§6.1)
// =============================================================================

function DangerZone({ fullName, githubRepoId }: {
    readonly fullName: string;
    readonly githubRepoId: number;
}) {
    const t = useTranslations('repoDetail.dangerZone');
    const tDialog = useTranslations('confirmDialogs.deactivateRepo');
    const tDashboard = useTranslations('dashboard');
    const tToast = useTranslations('toasts');
    const { showToast } = useToast();
    const router = useRouter();

    const [showsConfirmDialog, setShowsConfirmDialog] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Stabile Referenz: der Dialog-Effekt (Focus/Scroll) hängt an onClose —
    // eine Inline-Lambda würde ihn bei jedem Render neu aufsetzen.
    const closeConfirmDialog = useCallback(() => setShowsConfirmDialog(false), []);

    const handleDeactivate = async () => {
        setIsDeactivating(true);
        setErrorMessage(null);

        try {
            const response = await fetch('/api/repos/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoId: githubRepoId, fullName }),
            });
            const responseBody = await response.json();

            if (!response.ok) {
                // Ein 5xx trägt nur einen Diagnose-Code (SERVER_AUDIT_2026-09 L4).
                const serverErrorCode = response.status >= 500 ? undefined : responseBody.error;
                setErrorMessage(serverErrorCode ?? tDashboard('errors.disconnectFailed'));
                setShowsConfirmDialog(false);
                return;
            }

            // Zurück zur Liste; der Toast überlebt die Navigation, weil der
            // Provider im Dashboard-Layout hängt.
            showToast(tToast('reviewsStopped', { fullName }));
            router.push('/dashboard');
        } catch (deactivateError: unknown) {
            setErrorMessage(deactivateError instanceof Error ? deactivateError.message : tDashboard('errors.unknown'));
            setShowsConfirmDialog(false);
        } finally {
            setIsDeactivating(false);
        }
    };

    return (
        <section className="mt-10 rounded-xl border border-danger/40 px-5 py-4">
            <h2 className="text-sm font-semibold text-danger">{t('heading')}</h2>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">{t('description')}</p>
                <button
                    onClick={() => setShowsConfirmDialog(true)}
                    className="shrink-0 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 active:scale-[0.97]"
                >
                    {t('deactivate')}
                </button>
            </div>
            {errorMessage && (
                <p className="mt-2 text-xs text-danger">{errorMessage}</p>
            )}

            {showsConfirmDialog && (
                <ConfirmDialog
                    title={tDialog('title')}
                    body={<p>{tDialog('body', { fullName })}</p>}
                    confirmLabel={tDialog('confirm')}
                    cancelLabel={tDialog('cancel')}
                    busy={isDeactivating}
                    busyLabel={tDialog('busy')}
                    onCancel={closeConfirmDialog}
                    onConfirm={() => void handleDeactivate()}
                />
            )}
        </section>
    );
}
