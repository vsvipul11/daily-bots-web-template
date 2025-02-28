"use client";

import { useEffect, useState } from "react";
import App from "./App";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadClient = async () => {
      try {
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize client:", error);
        setIsLoading(false);
      }
    };
    
    loadClient();
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <App />
        )}
      </div>
    </main>
  );
}
