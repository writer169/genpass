import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

const Generator = dynamic(() => import("../components/Generator"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/check")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) router.push("/login");
        else setLoading(false);
      });
  }, []);

  if (loading) return <p>Загрузка...</p>;
  return <Generator />;
}