import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users, FileText, Loader2, GitBranch } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import {
  extractContributors,
  fetchContributors,
  fetchContributorDetail,
  fetchSimilarContributors,
  fetchFileContributors,
  fetchSimilarRepos,
  type BackendContributor,
  type BackendContributorFile,
  type SimilarContributor,
  type SimilarRepo,
} from '../services/backend';

export const ContributorsPanel = () => {
  const { isBackendMode, backendRepo, selectedNode } = useAppState();
  const [contributors, setContributors] = useState<BackendContributor[]>([]);
  const [selectedContributorId, setSelectedContributorId] = useState<string | null>(null);
  const [contributorDetail, setContributorDetail] = useState<{ contributor: BackendContributor | null; files: BackendContributorFile[] } | null>(null);
  const [similarContributors, setSimilarContributors] = useState<SimilarContributor[]>([]);
  const [fileContributors, setFileContributors] = useState<BackendContributor[]>([]);
  const [similarRepos, setSimilarRepos] = useState<SimilarRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubToken, setGithubToken] = useState('');

  const selectedFilePath = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.label === 'File') return selectedNode.properties.filePath;
    if (selectedNode.label === 'FileContribution') return selectedNode.properties.filePath;
    return null;
  }, [selectedNode]);

  const loadContributors = async () => {
    if (!backendRepo) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchContributors(backendRepo);
      setContributors(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load contributors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!backendRepo) return;
    setIsExtracting(true);
    setError(null);
    try {
      await extractContributors(backendRepo, {
        githubOwner: githubOwner.trim() || undefined,
        githubRepo: githubRepo.trim() || undefined,
        githubToken: githubToken.trim() || undefined,
      });
      await loadContributors();
    } catch (err: any) {
      setError(err?.message || 'Failed to extract contributors');
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    if (!isBackendMode || !backendRepo) return;
    void loadContributors();
    void fetchSimilarRepos(backendRepo).then(setSimilarRepos).catch(() => {});
  }, [isBackendMode, backendRepo]);

  useEffect(() => {
    if (!backendRepo || !selectedContributorId) {
      setContributorDetail(null);
      setSimilarContributors([]);
      return;
    }

    let cancelled = false;
    const loadDetail = async () => {
      try {
        const detail = await fetchContributorDetail(backendRepo, selectedContributorId);
        if (!cancelled) setContributorDetail(detail);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load contributor');
      }
    };
    const loadSimilar = async () => {
      try {
        const similar = await fetchSimilarContributors(backendRepo, selectedContributorId, 5);
        if (!cancelled) setSimilarContributors(similar);
      } catch {
        if (!cancelled) setSimilarContributors([]);
      }
    };
    void loadDetail();
    void loadSimilar();
    return () => { cancelled = true; };
  }, [backendRepo, selectedContributorId]);

  useEffect(() => {
    if (!backendRepo || !selectedFilePath) {
      setFileContributors([]);
      return;
    }
    let cancelled = false;
    fetchFileContributors(backendRepo, selectedFilePath)
      .then((rows) => {
        if (!cancelled) setFileContributors(rows);
      })
      .catch(() => {
        if (!cancelled) setFileContributors([]);
      });
    return () => { cancelled = true; };
  }, [backendRepo, selectedFilePath]);

  if (!isBackendMode) {
    return (
      <div className="p-4 text-sm text-text-muted">
        Connect to the local backend to view contributor data.
      </div>
    );
  }

  if (!backendRepo) {
    return (
      <div className="p-4 text-sm text-text-muted">
        Select a repository to load contributor data.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle bg-elevated/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Users className="w-4 h-4 text-accent" />
            Contributors
          </div>
          <button
            onClick={loadContributors}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <input
            type="text"
            placeholder="GitHub owner (optional)"
            value={githubOwner}
            onChange={(e) => setGithubOwner(e.target.value)}
            className="w-full px-3 py-2 bg-elevated border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted"
          />
          <input
            type="text"
            placeholder="GitHub repo (optional)"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            className="w-full px-3 py-2 bg-elevated border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted"
          />
          <input
            type="password"
            placeholder="GitHub token (optional)"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            className="w-full px-3 py-2 bg-elevated border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted"
          />
          <button
            onClick={handleExtract}
            disabled={isExtracting}
            className="w-full px-3 py-2 bg-accent text-white text-xs font-medium rounded hover:bg-accent-dim disabled:opacity-60"
          >
            {isExtracting ? 'Extracting…' : 'Extract contributors'}
          </button>
          <p className="text-[11px] text-text-muted">
            Uses git history; GitHub fields enrich usernames & avatars.
          </p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-rose-300 bg-rose-500/10 border-b border-rose-500/30">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading contributors...
          </div>
        ) : contributors.length === 0 ? (
          <div className="text-sm text-text-muted">
            No contributor data yet. Run extraction above.
          </div>
        ) : (
          <div className="space-y-2">
            {contributors.map((contrib) => (
              <button
                key={contrib.id}
                onClick={() => setSelectedContributorId(contrib.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded border text-left transition-colors ${
                  selectedContributorId === contrib.id
                    ? 'border-accent/60 bg-accent/10'
                    : 'border-border-subtle bg-elevated hover:border-accent/40'
                }`}
              >
                {contrib.avatarUrl ? (
                  <img src={contrib.avatarUrl} alt={contrib.name} className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-surface text-text-muted flex items-center justify-center text-xs">
                    {contrib.name?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{contrib.name || 'Unknown'}</div>
                  <div className="text-[11px] text-text-muted truncate">
                    {contrib.githubUsername || contrib.email || 'Unknown'}
                  </div>
                </div>
                <div className="text-[11px] text-text-muted">
                  {contrib.filesTouched ?? 0} files
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedFilePath && (
          <div className="pt-3 border-t border-border-subtle">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
              <FileText className="w-3.5 h-3.5" />
              Contributors for selected file
            </div>
            {fileContributors.length === 0 ? (
              <div className="text-xs text-text-muted">No contributors found.</div>
            ) : (
              <div className="space-y-1">
                {fileContributors.map((contrib) => (
                  <div key={contrib.id} className="text-xs text-text-primary">
                    {contrib.githubUsername || contrib.name || contrib.email || contrib.id}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {contributorDetail?.contributor && (
          <div className="pt-3 border-t border-border-subtle space-y-3">
            <div className="text-xs text-text-secondary uppercase tracking-wide">
              Contributor Details
            </div>
            <div className="text-sm text-text-primary">
              {contributorDetail.contributor.name || 'Unknown'}
            </div>
            <div className="text-xs text-text-muted">
              {contributorDetail.contributor.githubUsername || contributorDetail.contributor.email || 'No contact info'}
            </div>
            <div>
              <div className="text-xs text-text-secondary mb-2">Files touched</div>
              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                {contributorDetail.files.map((file) => (
                  <div key={file.filePath} className="text-[11px] text-text-muted flex justify-between gap-3">
                    <span className="truncate">{file.filePath}</span>
                    <span>{file.commits} commits</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary mb-2">Similar contributors</div>
              {similarContributors.length === 0 ? (
                <div className="text-xs text-text-muted">No similar contributors found.</div>
              ) : (
                <div className="space-y-1">
                  {similarContributors.map((c) => (
                    <div key={c.id} className="text-[11px] text-text-muted flex justify-between gap-3">
                      <span className="truncate">{c.githubUsername || c.name || c.email}</span>
                      <span>{Math.round(c.similarity * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {similarRepos.length > 0 && (
          <div className="pt-3 border-t border-border-subtle">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
              <GitBranch className="w-3.5 h-3.5" />
              Similar repos
            </div>
            <div className="space-y-1">
              {similarRepos.map((repo) => (
                <div key={repo.name} className="text-[11px] text-text-muted flex justify-between gap-3">
                  <span className="truncate">{repo.name}</span>
                  <span>{Math.round(repo.similarity * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
