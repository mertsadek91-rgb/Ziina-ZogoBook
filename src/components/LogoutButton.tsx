"use client";

export function LogoutButton() {
  return (
    <button
      className="text-sm text-gray-500 hover:text-gray-800"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        location.href = "/login";
      }}
    >
      خروج
    </button>
  );
}
