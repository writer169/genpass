// pages/index.js
import Head from 'next/head';
import Tree from '../components/Tree';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const owner = 'writer169';
  const [repo, setRepo] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (router.query.repo) {
      setRepo(router.query.repo);
    }
  }, [router.query.repo]);

  // Загрузка списка репозиториев только для авторизованных пользователей
  useEffect(() => {
    if (status === "authenticated" && session?.isAllowed) {
      fetchRepos();
    }
  }, [status, session]);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/github/repos`);
      if (response.ok) {
        const data = await response.json();
        setRepos(data);
      } else {
        console.error("Failed to fetch repositories");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    router.push(`/?repo=${repo}`, undefined, { shallow: true });
  };

  const handleRepoClick = (repoName) => {
    setRepo(repoName);
    router.push(`/?repo=${repoName}`, undefined, { shallow: true });
  };

  useEffect(() => {
    console.log("useEffect for redirect triggered. Status:", status);
    if (status === "unauthenticated") {
      console.log("Redirecting to signin");
      // Добавляем редирект с callbackUrl, чтобы вернуться на ту же страницу после авторизации
      const callbackUrl = router.asPath;
      router.push(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return; // Важно добавить return, чтобы остановить дальнейшее выполнение
    }
  }, [status, router]);

  // Не отображаем контент, пока идет проверка аутентификации или пользователь не авторизован
  if (status === "loading" || status === "unauthenticated") {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>;
  }

  if (status === "authenticated" && !session?.isAllowed) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Unauthorized Access</h1>
        <p>You are not authorized to view this content.</p>
        <button onClick={signOut} style={{ padding: "10px 20px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div>
      <Head>
        <title>GitHub Repo Viewer</title>
        <meta name="description" content="View GitHub repository structure" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1>GitHub Repository Viewer</h1>
          <div>
            {session && (
              <span style={{ marginRight: "10px" }}>
                Signed in as {session.user.email}
              </span>
            )}
            <button onClick={signOut} style={{ padding: "8px 12px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Sign Out
            </button>
          </div>
        </div>

        <p>Owner: {owner}</p>
        <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <label htmlFor="repo">Repository:</label>
            <input
              type="text"
              id="repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
            />
            <button type="submit" style={{ padding: "8px 12px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              View
            </button>
          </div>
        </form>

        {/* Список репозиториев */}
        <div style={{ marginBottom: "20px" }}>
          <h2>Repositories</h2>
          {loading ? (
            <p>Loading repositories...</p>
          ) : repos.length > 0 ? (
            <div>
              {repos.map(repoItem => {
                const isSelected = repoItem.name === repo;
                return (
                  <div key={repoItem.id}>
                    <div 
                      style={{ 
                        border: "1px solid #ddd", 
                        padding: "15px", 
                        borderRadius: isSelected ? "8px 8px 0 0" : "8px",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                        backgroundColor: isSelected ? "#e6ffe6" : "white",
                        marginBottom: isSelected ? 0 : "15px"
                      }}
                      onClick={() => handleRepoClick(repoItem.name)}
                    >
                      <h3 style={{ margin: "0 0 8px 0" }}>{repoItem.name}</h3>
                      <p style={{ margin: "0 0 5px 0", fontSize: "13px", color: "#555" }}>
                        Owner: {repoItem.owner}
                      </p>
                      <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666", minHeight: "40px" }}>
                        {repoItem.description || "No description"}
                      </p>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        alignItems: "center", 
                        fontSize: "12px", 
                        color: "#999" 
                      }}>
                        <span>Updated: {new Date(repoItem.updated_at).toLocaleDateString()}</span>
                        <span style={{ 
                          backgroundColor: repoItem.private ? "#ffe6e6" : "#e6ffe6", 
                          padding: "2px 6px", 
                          borderRadius: "4px",
                          color: repoItem.private ? "#cc0000" : "#007700"
                        }}>
                          {repoItem.private ? "Private" : "Public"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Показываем дерево непосредственно под выбранной карточкой */}
                    {isSelected && (
                      <div 
                        style={{ 
                          border: "1px solid #ddd", 
                          borderTop: "none", 
                          padding: "15px", 
                          borderRadius: "0 0 8px 8px", 
                          marginBottom: "15px",
                          backgroundColor: "#f9f9f9"
                        }}
                      >
                        <Tree owner={owner} repo={repoItem.name} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No repositories found.</p>
          )}
        </div>
      </main>
    </div>
  );
}