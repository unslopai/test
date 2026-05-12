import { useState, useEffect } from 'react';

export function UserProfileSlop({ userId }: { userId: string }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`https://api.example.com/users/${userId}`);
        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId]); 

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error fetching user.</div>;
  return <div>{user?.name}</div>;
}