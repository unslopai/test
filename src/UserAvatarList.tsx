import { useEffect, useState } from 'react';

interface UserSummary {
  readonly id: number;
  readonly displayName: string;
  readonly avatarUrl: string;
}

interface UserAvatarListProps {
  readonly teamId: string;
}

/**
 * Lists the avatars of a team's members. Fetches once per team change and
 * ignores late responses after unmount via an abort flag.
 */
export function UserAvatarList({ teamId }: UserAvatarListProps) {
  const [members, setMembers] = useState<readonly UserSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    fetch(`/api/teams/${encodeURIComponent(teamId)}/members`, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
        return response.json() as Promise<readonly UserSummary[]>;
      })
      .then(setMembers)
      .catch((fetchError: unknown) => {
        if (abortController.signal.aborted) return;
        console.error('Failed to load team members', fetchError);
        setLoadFailed(true);
      });

    return () => abortController.abort();
  }, [teamId]);

  if (loadFailed) {
    return <p role="alert">Team members could not be loaded.</p>;
  }

  return (
    <ul className="avatar-list">
      {members.map((member) => (
        <li key={member.id}>
          <img src={member.avatarUrl} alt={member.displayName} width={32} height={32} />
          <span>{member.displayName}</span>
        </li>
      ))}
    </ul>
  );
}
