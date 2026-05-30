"use client"
import { signIn, useSession, SessionProvider } from "next-auth/react"

function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Loading...</div>
  }

  if (session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Welcome, {session.user?.name}</h1>
        <p>Email: {session.user?.email}</p>
        <p>Personal OS is ready to build.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Personal OS</h1>
      <button onClick={() => signIn("google")}>Sign in with Google</button>
    </div>
  )
}

export default function Page() {
  return (
    <SessionProvider>
      <Home />
    </SessionProvider>
  )
}